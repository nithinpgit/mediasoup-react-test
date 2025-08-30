import { Device } from 'mediasoup-client';
import io from 'socket.io-client';

class MediaSoupService {
  constructor() {
    this.socket = null;
    this.device = null;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.producers = new Map(); // kind -> Producer
    this.consumers = new Map(); // consumerId -> Consumer
    this.peers = new Map(); // peerId -> peerInfo
    this.isConnected = false;
    this.roomId = null;
    
    // Event callbacks
    this.onPeerJoined = null;
    this.onPeerLeft = null;
    this.onNewConsumer = null;
    this.onConsumerClosed = null;
    this.onConnectionStateChange = null;
  }

  async connect(serverUrl = 'http://classes.sacglobal.co') {
    try {
      this.socket = io(serverUrl);
      
      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isConnected = true;
        this.onConnectionStateChange?.('connected');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
        this.onConnectionStateChange?.('disconnected');
      });

      this.socket.on('peer-joined', (data) => {
        console.log('Peer joined:', data);
        this.peers.set(data.peerId, data.peerInfo);
        this.onPeerJoined?.(data);
      });

      this.socket.on('peer-left', (data) => {
        console.log('Peer left:', data);
        this.peers.delete(data.peerId);
        this.onPeerLeft?.(data);
        
        // Close consumers from this peer
        for (const [consumerId, consumer] of this.consumers) {
          if (consumer.appData.peerId === data.peerId) {
            consumer.close();
            this.consumers.delete(consumerId);
            this.onConsumerClosed?.(consumerId);
          }
        }
      });

      this.socket.on('new-producer', async (data) => {
        console.log('New producer:', data);
        // Store the peer info for this producer
        this.currentProducerPeer = data.peerId;
        await this.consumeMedia(data.producerId, data.peerId);
      });

      this.socket.on('consumer-closed', (data) => {
        console.log('Consumer closed:', data);
        const consumer = this.consumers.get(data.consumerId);
        if (consumer) {
          consumer.close();
          this.consumers.delete(data.consumerId);
          this.onConsumerClosed?.(data.consumerId);
        }
      });

      return new Promise((resolve) => {
        this.socket.on('connect', () => resolve());
      });
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }

  async joinRoom(roomId, peerInfo) {
    try {
      this.roomId = roomId;
      
      const response = await this.socketRequest('join-room', {
        roomId,
        peerInfo
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // Initialize device with router RTP capabilities
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: response.rtpCapabilities });

      // Store existing peers
      response.peers.forEach(peer => {
        if (peer.id !== this.socket.id) {
          this.peers.set(peer.id, peer.peerInfo);
        }
      });

      console.log('Joined room successfully');
      return response;
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  async createTransports() {
    try {
      // Create producer transport
      const producerResponse = await this.socketRequest('create-transport', {
        direction: 'send'
      });

      if (!producerResponse.success) {
        throw new Error(producerResponse.error);
      }

      this.producerTransport = this.device.createSendTransport(producerResponse.transportOptions);

      this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          const response = await this.socketRequest('connect-transport', {
            transportId: this.producerTransport.id,
            dtlsParameters
          });
          
          if (response.success) {
            callback();
          } else {
            errback(new Error(response.error));
          }
        } catch (error) {
          errback(error);
        }
      });

      this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const response = await this.socketRequest('produce', {
            transportId: this.producerTransport.id,
            kind,
            rtpParameters
          });
          
          if (response.success) {
            callback({ id: response.producerId });
          } else {
            errback(new Error(response.error));
          }
        } catch (error) {
          errback(error);
        }
      });

      // Create consumer transport
      const consumerResponse = await this.socketRequest('create-transport', {
        direction: 'recv'
      });

      if (!consumerResponse.success) {
        throw new Error(consumerResponse.error);
      }

      this.consumerTransport = this.device.createRecvTransport(consumerResponse.transportOptions);

      this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          const response = await this.socketRequest('connect-transport', {
            transportId: this.consumerTransport.id,
            dtlsParameters
          });
          
          if (response.success) {
            callback();
          } else {
            errback(new Error(response.error));
          }
        } catch (error) {
          errback(error);
        }
      });

      console.log('Transports created successfully');
    } catch (error) {
      console.error('Failed to create transports:', error);
      throw error;
    }
  }

  async produceMedia(stream) {
    try {
      if (!this.producerTransport) {
        throw new Error('Producer transport not created');
      }

      const tracks = stream.getTracks();
      
      for (const track of tracks) {
        const producer = await this.producerTransport.produce({ track });
        this.producers.set(track.kind, producer);
        
        producer.on('transportclose', () => {
          console.log('Producer transport closed');
          this.producers.delete(track.kind);
        });

        console.log(`${track.kind} producer created:`, producer.id);
      }
    } catch (error) {
      console.error('Failed to produce media:', error);
      throw error;
    }
  }

  async consumeMedia(producerId, peerId = null) {
    try {
      if (!this.consumerTransport || !this.device) {
        console.warn('Consumer transport or device not ready');
        return;
      }

      const response = await this.socketRequest('consume', {
        transportId: this.consumerTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });

      if (!response.success) {
        console.error('Failed to consume:', response.error);
        return;
      }

      const consumer = await this.consumerTransport.consume({
        id: response.consumerId,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters
      });

      // Store peer info in consumer appData
      consumer.appData = { peerId: peerId || this.findPeerByProducerId(producerId) };
      
      this.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => {
        console.log('Consumer transport closed');
        this.consumers.delete(consumer.id);
      });

      // Resume consumer
      await this.socketRequest('resume-consumer', {
        consumerId: consumer.id
      });

      console.log(`${consumer.kind} consumer created:`, consumer.id);
      this.onNewConsumer?.(consumer);

      return consumer;
    } catch (error) {
      console.error('Failed to consume media:', error);
    }
  }

  async getExistingProducers() {
    try {
      const response = await this.socketRequest('get-producers', {});
      
      if (response.success) {
        for (const producer of response.producers) {
          await this.consumeMedia(producer.producerId, producer.peerId);
        }
      }
    } catch (error) {
      console.error('Failed to get existing producers:', error);
    }
  }

  findPeerByProducerId(producerId) {
    // We need to track this properly - for now, we'll use the producer info from server
    // This will be set properly when we get the producer info from 'new-producer' event
    return this.currentProducerPeer || 'unknown';
  }

  closeProducer(kind) {
    const producer = this.producers.get(kind);
    if (producer) {
      producer.close();
      this.producers.delete(kind);
    }
  }

  disconnect() {
    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close transports
    if (this.producerTransport) {
      this.producerTransport.close();
      this.producerTransport = null;
    }

    if (this.consumerTransport) {
      this.consumerTransport.close();
      this.consumerTransport = null;
    }

    // Close device
    this.device = null;

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.peers.clear();
  }

  socketRequest(event, data = {}) {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, data, (response) => {
        resolve(response);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error(`Socket request timeout: ${event}`));
      }, 10000);
    });
  }
}

export default MediaSoupService;
