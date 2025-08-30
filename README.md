# MediaSoup Multiparty Conference Application

A real-time multiparty video conferencing application built with MediaSoup, React, and Node.js. Supports 10+ participants with high-quality audio and video streaming.

## Features

- ✅ **Multiparty Support**: Handle 10+ participants simultaneously
- ✅ **High-Quality Media**: VP8/VP9/H264 video codecs and Opus audio
- ✅ **Real-time Communication**: WebRTC with MediaSoup SFU architecture
- ✅ **Responsive Design**: Works on desktop and mobile devices
- ✅ **Audio/Video Controls**: Mute/unmute audio and video
- ✅ **Room-based**: Join specific rooms with room IDs
- ✅ **Peer Management**: Real-time join/leave notifications

## Tech Stack

### Backend
- **Node.js** - Server runtime
- **MediaSoup** - WebRTC SFU (Selective Forwarding Unit)
- **Socket.IO** - Real-time signaling
- **Express** - HTTP server

### Frontend
- **React** - UI framework
- **MediaSoup Client** - WebRTC client library
- **Socket.IO Client** - Real-time communication

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Modern web browser with WebRTC support

### Installation

1. **Clone and install dependencies:**
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install
```

2. **Start the server:**
```bash
# From root directory
npm start
# or
node server/server.js
```

3. **Start the client (in another terminal):**
```bash
cd client
npm start
```

4. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - Enter your name and room ID
   - Allow camera and microphone access
   - Start conferencing!

## Project Structure

```
mediasoup-react/
├── server/
│   ├── server.js          # Main server file
│   ├── config.js          # MediaSoup configuration
│   └── lib/
│       ├── Room.js        # Room management
│       └── Peer.js        # Peer management
├── client/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── services/
│   │   │   └── MediaSoupService.js  # MediaSoup client service
│   │   └── components/
│   │       ├── JoinRoom.js     # Room joining interface
│   │       ├── VideoGrid.js    # Video grid layout
│   │       └── Controls.js     # Media controls
│   └── public/
└── package.json
```

## Configuration

### Server Configuration (`server/config.js`)

- **Worker Settings**: CPU cores, RTC ports, logging
- **Media Codecs**: VP8, VP9, H264, Opus support
- **Transport Settings**: WebRTC transport configuration

### Client Configuration

The client automatically connects to `http://localhost:3001` by default. To change the server URL, modify the `connect()` call in `MediaSoupService.js`.

## Usage

### Joining a Room

1. Enter your display name
2. Enter a room ID (or generate a random one)
3. Click "Join Room"
4. Allow camera/microphone permissions
5. Start conferencing!

### Controls

- **Mute/Unmute Audio**: Toggle microphone
- **Start/Stop Video**: Toggle camera
- **Leave Room**: Exit the conference

### Room Management

- Rooms are created automatically when the first user joins
- Rooms are destroyed when the last user leaves
- Room IDs are case-insensitive and can be shared with others

## Architecture

### MediaSoup SFU Architecture

```
Client A ──┐
           ├── MediaSoup Router ──┐
Client B ──┘                     ├── All Clients
           ┌─────────────────────┘
Client C ──┘
```

- **SFU (Selective Forwarding Unit)**: Server forwards media streams without transcoding
- **Efficient Bandwidth**: Each client sends once, receives multiple streams
- **Scalable**: Supports many participants with minimal server resources

### Communication Flow

1. **Signaling**: Socket.IO handles room joining, transport creation, producer/consumer management
2. **Media Transport**: WebRTC handles actual audio/video streaming
3. **Room Management**: Server manages peers, producers, and consumers per room

## Scaling for Production

### Server Scaling
- **Multiple Workers**: Automatically uses all CPU cores
- **Load Balancing**: Deploy multiple server instances behind a load balancer
- **Redis**: Use Redis adapter for Socket.IO clustering

### Network Considerations
- **STUN/TURN**: Configure STUN/TURN servers for NAT traversal
- **Firewall**: Open UDP ports 10000-10100 for RTC traffic
- **SSL**: Use HTTPS/WSS in production

### Performance Optimization
- **Simulcast**: Enable simulcast for better quality adaptation
- **SVC**: Use SVC codecs for temporal/spatial scalability
- **Bandwidth Management**: Implement adaptive bitrate control

## Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Ensure HTTPS in production
   - Check browser permissions
   - Try different browsers

2. **Connection Issues**
   - Check firewall settings
   - Verify server is running on correct port
   - Check network connectivity

3. **Audio/Video Quality**
   - Check bandwidth limitations
   - Verify codec support
   - Monitor CPU usage

### Debug Mode

Enable debug logging by modifying `config.js`:
```javascript
worker: {
  logLevel: 'debug',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
}
```

## Development

### Adding Features

- **Screen Sharing**: Extend MediaSoupService to handle screen capture
- **Chat**: Add text messaging with Socket.IO
- **Recording**: Implement server-side recording
- **Authentication**: Add user authentication and room permissions

### Testing

```bash
# Run server tests
npm test

# Run client tests
cd client && npm test
```

## License

MIT License - feel free to use this project for your own applications.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review MediaSoup documentation
3. Check browser console for errors
4. Ensure all dependencies are properly installed

---

**Happy Conferencing! 🎥📞**
