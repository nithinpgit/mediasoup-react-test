const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mediasoup = require('mediasoup');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const Room = require('./lib/Room');
const Peer = require('./lib/Peer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Global variables
const workers = [];
const rooms = new Map(); // roomId -> Room
let nextWorkerIndex = 0;

// Initialize MediaSoup workers
async function initializeWorkers() {
  const { numWorkers } = config.mediasoup;
  
  console.log(`Creating ${numWorkers} MediaSoup workers...`);
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on('died', () => {
      console.error('MediaSoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
    console.log(`Worker ${i} created [pid:${worker.pid}]`);
  }
}

// Get next worker using round-robin
function getNextWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

// Get or create room
async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  
  if (!room) {
    console.log(`Creating new room: ${roomId}`);
    const worker = getNextWorker();
    room = new Room(roomId, worker, io);
    await room.init();
    rooms.set(roomId, room);
  }
  
  return room;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
  let currentRoom = null;
  let currentPeer = null;

  // Join room
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, peerInfo } = data;
      console.log(`Peer ${socket.id} joining room ${roomId}`);
      
      const room = await getOrCreateRoom(roomId);
      const peer = new Peer(socket.id, socket, peerInfo);
      
      currentRoom = room;
      currentPeer = peer;
      
      room.addPeer(peer);
      socket.join(roomId);
      
      // Send router RTP capabilities to the client
      callback({
        success: true,
        rtpCapabilities: room.getRouterRtpCapabilities(),
        peers: room.getAllPeers().map(p => ({
          id: p.id,
          peerInfo: p.peerInfo
        }))
      });
      
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Create WebRTC transport
  socket.on('create-transport', async (data, callback) => {
    try {
      const { direction } = data; // 'send' or 'recv'
      
      if (!currentRoom || !currentPeer) {
        throw new Error('Peer not in a room');
      }
      
      const transport = await currentRoom.router.createWebRtcTransport({
        listenIps: config.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
      });
      
      currentPeer.addTransport(transport);
      
      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });
      
      callback({
        success: true,
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
      
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Connect transport
  socket.on('connect-transport', async (data, callback) => {
    try {
      const { transportId, dtlsParameters } = data;
      
      if (!currentPeer) {
        throw new Error('Peer not found');
      }
      
      const transport = currentPeer.getTransport(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }
      
      await transport.connect({ dtlsParameters });
      callback({ success: true });
      
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Produce media (audio/video)
  socket.on('produce', async (data, callback) => {
    try {
      const { transportId, kind, rtpParameters } = data;
      
      if (!currentPeer || !currentRoom) {
        throw new Error('Peer not in room');
      }
      
      const transport = currentPeer.getTransport(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }
      
      const producer = await transport.produce({ kind, rtpParameters });
      currentPeer.addProducer(producer);
      
      producer.on('transportclose', () => {
        console.log('Producer transport closed');
        producer.close();
      });
      
      // Notify other peers about new producer
      currentRoom.broadcastToOthers(currentPeer.id, 'new-producer', {
        peerId: currentPeer.id,
        producerId: producer.id,
        kind: producer.kind
      });
      
      callback({ success: true, producerId: producer.id });
      
    } catch (error) {
      console.error('Error producing:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Consume media from other peers
  socket.on('consume', async (data, callback) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;
      
      if (!currentPeer || !currentRoom) {
        throw new Error('Peer not in room');
      }
      
      const transport = currentPeer.getTransport(transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }
      
      // Check if we can consume
      if (!currentRoom.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }
      
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused
      });
      
      currentPeer.addConsumer(consumer);
      
      consumer.on('transportclose', () => {
        console.log('Consumer transport closed');
        currentPeer.removeConsumer(consumer.id);
      });
      
      consumer.on('producerclose', () => {
        console.log('Consumer producer closed');
        currentPeer.removeConsumer(consumer.id);
        socket.emit('consumer-closed', { consumerId: consumer.id });
      });
      
      callback({
        success: true,
        consumerId: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      });
      
    } catch (error) {
      console.error('Error consuming:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Resume consumer
  socket.on('resume-consumer', async (data, callback) => {
    try {
      const { consumerId } = data;
      
      if (!currentPeer) {
        throw new Error('Peer not found');
      }
      
      const consumer = currentPeer.getConsumer(consumerId);
      if (!consumer) {
        throw new Error('Consumer not found');
      }
      
      await consumer.resume();
      callback({ success: true });
      
    } catch (error) {
      console.error('Error resuming consumer:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Get producers from other peers
  socket.on('get-producers', (data, callback) => {
    try {
      if (!currentRoom || !currentPeer) {
        throw new Error('Peer not in room');
      }
      
      const producers = [];
      for (const peer of currentRoom.getAllPeers()) {
        if (peer.id !== currentPeer.id) {
          for (const producer of peer.getProducers()) {
            producers.push({
              peerId: peer.id,
              producerId: producer.id,
              kind: producer.kind
            });
          }
        }
      }
      
      callback({ success: true, producers });
      
    } catch (error) {
      console.error('Error getting producers:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (currentRoom && currentPeer) {
      currentRoom.removePeer(currentPeer.id);
      
      // Remove room if empty
      if (currentRoom.peers.size === 0) {
        rooms.delete(currentRoom.id);
      }
    }
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', workers: workers.length, rooms: rooms.size });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    peers: room.peers.size
  }));
  res.json(roomList);
});

// Initialize and start server
async function startServer() {
  try {
    await initializeWorkers();
    
    server.listen(config.httpServer.listenPort, config.httpServer.listenIp, () => {
      console.log(`Server running on http://${config.httpServer.listenIp}:${config.httpServer.listenPort}`);
      console.log(`Socket.IO server ready for connections`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing server...');
  
  // Close all rooms
  for (const room of rooms.values()) {
    room.close();
  }
  
  // Close all workers
  for (const worker of workers) {
    worker.close();
  }
  
  process.exit(0);
});

startServer();
