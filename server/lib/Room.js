const { v4: uuidv4 } = require('uuid');

class Room {
  constructor(roomId, worker, io) {
    this.id = roomId;
    this.router = null;
    this.peers = new Map(); // peerId -> Peer
    this.worker = worker;
    this.io = io;
    this.closed = false;
  }

  async init() {
    const mediaCodecs = [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ];

    this.router = await this.worker.createRouter({ mediaCodecs });
    console.log(`Room ${this.id} created with router`);
  }

  addPeer(peer) {
    this.peers.set(peer.id, peer);
    console.log(`Peer ${peer.id} added to room ${this.id}. Total peers: ${this.peers.size}`);
    
    // Notify other peers about the new peer
    this.broadcastToOthers(peer.id, 'peer-joined', {
      peerId: peer.id,
      peerInfo: peer.peerInfo,
    });
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
      console.log(`Peer ${peerId} removed from room ${this.id}. Total peers: ${this.peers.size}`);
      
      // Notify other peers about the peer leaving
      this.broadcastToOthers(peerId, 'peer-left', { peerId });
    }

    // Close room if no peers left
    if (this.peers.size === 0) {
      this.close();
    }
  }

  getPeer(peerId) {
    return this.peers.get(peerId);
  }

  getAllPeers() {
    return Array.from(this.peers.values());
  }

  broadcastToOthers(excludePeerId, event, data) {
    for (const peer of this.peers.values()) {
      if (peer.id !== excludePeerId) {
        peer.socket.emit(event, data);
      }
    }
  }

  broadcast(event, data) {
    for (const peer of this.peers.values()) {
      peer.socket.emit(event, data);
    }
  }

  close() {
    if (this.closed) return;

    console.log(`Closing room ${this.id}`);
    this.closed = true;

    // Close all peers
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();

    // Close router
    if (this.router) {
      this.router.close();
    }
  }

  getRouterRtpCapabilities() {
    return this.router.rtpCapabilities;
  }
}

module.exports = Room;
