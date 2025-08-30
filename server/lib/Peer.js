class Peer {
  constructor(id, socket, peerInfo) {
    this.id = id;
    this.socket = socket;
    this.peerInfo = peerInfo;
    this.transports = new Map(); // transportId -> Transport
    this.producers = new Map(); // producerId -> Producer
    this.consumers = new Map(); // consumerId -> Consumer
    this.closed = false;
  }

  addTransport(transport) {
    this.transports.set(transport.id, transport);
  }

  getTransport(transportId) {
    return this.transports.get(transportId);
  }

  addProducer(producer) {
    this.producers.set(producer.id, producer);
  }

  getProducer(producerId) {
    return this.producers.get(producerId);
  }

  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer);
  }

  getConsumer(consumerId) {
    return this.consumers.get(consumerId);
  }

  removeConsumer(consumerId) {
    this.consumers.delete(consumerId);
  }

  getProducers() {
    return Array.from(this.producers.values());
  }

  getConsumers() {
    return Array.from(this.consumers.values());
  }

  close() {
    if (this.closed) return;

    console.log(`Closing peer ${this.id}`);
    this.closed = true;

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all transports
    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();
  }
}

module.exports = Peer;
