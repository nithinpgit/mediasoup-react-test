import React, { useState, useEffect, useRef } from 'react';
import MediaSoupService from './services/MediaSoupService';
import JoinRoom from './components/JoinRoom';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [currentPeerId, setCurrentPeerId] = useState('');
  const [error, setError] = useState('');
  
  const mediaSoupService = useRef(new MediaSoupService());

  useEffect(() => {
    const service = mediaSoupService.current;
    
    // Set up event handlers
    service.onConnectionStateChange = (state) => {
      setIsConnected(state === 'connected');
      if (state === 'disconnected') {
        setError('Connection lost. Please refresh and try again.');
      }
    };

    service.onPeerJoined = (data) => {
      console.log('Peer joined:', data);
      setParticipantCount(prev => prev + 1);
    };

    service.onPeerLeft = (data) => {
      console.log('Peer left:', data);
      setParticipantCount(prev => Math.max(1, prev - 1));
      // Remove streams from this peer
      setRemoteStreams(prev => prev.filter(stream => stream.peerId !== data.peerId));
    };

    service.onNewConsumer = (consumer) => {
      console.log('New consumer:', consumer);
      const stream = new MediaStream([consumer.track]);
      
      setRemoteStreams(prev => {
        // Check if we already have a stream container for this peer
        const existingIndex = prev.findIndex(s => s.peerId === consumer.appData.peerId);
        
        if (existingIndex >= 0) {
          // Update existing peer's stream
          const updated = [...prev];
          const existingStreamData = updated[existingIndex];
          
          if (consumer.kind === 'video') {
            // Replace or add video track
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              // Remove existing video tracks and add new one
              existingStreamData.stream.getVideoTracks().forEach(track => {
                existingStreamData.stream.removeTrack(track);
              });
              existingStreamData.stream.addTrack(videoTrack);
            }
          } else if (consumer.kind === 'audio') {
            // Replace or add audio track
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
              // Remove existing audio tracks and add new one
              existingStreamData.stream.getAudioTracks().forEach(track => {
                existingStreamData.stream.removeTrack(track);
              });
              existingStreamData.stream.addTrack(audioTrack);
            }
          }
          
          // Update consumer ID to latest (for cleanup purposes)
          updated[existingIndex] = {
            ...existingStreamData,
            consumerId: consumer.id,
            lastUpdated: Date.now()
          };
          
          return updated;
        } else {
          // Create new stream container for this peer
          return [...prev, {
            peerId: consumer.appData.peerId,
            stream: stream,
            consumerId: consumer.id,
            kind: consumer.kind,
            lastUpdated: Date.now()
          }];
        }
      });
    };

    service.onConsumerClosed = (consumerId) => {
      console.log('Consumer closed:', consumerId);
      setRemoteStreams(prev => prev.filter(stream => stream.consumerId !== consumerId));
    };

    return () => {
      service.disconnect();
    };
  }, []);

  const handleJoinRoom = async (roomId, displayName) => {
    setIsConnecting(true);
    setError('');
    
    try {
      const service = mediaSoupService.current;
      
      // Connect to server
      await service.connect();
      setCurrentPeerId(service.socket.id);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      setLocalStream(stream);
      
      // Join room
      const response = await service.joinRoom(roomId, { displayName });
      setParticipantCount(response.peers.length + 1);
      
      // Create transports
      await service.createTransports();
      
      // Start producing media
      await service.produceMedia(stream);
      
      // Consume existing producers
      await service.getExistingProducers();
      
      setIsInRoom(true);
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message || 'Failed to join room. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const handleLeaveRoom = () => {
    const service = mediaSoupService.current;
    service.disconnect();
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Reset state
    setIsInRoom(false);
    setIsConnected(false);
    setRemoteStreams([]);
    setParticipantCount(1);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setCurrentPeerId('');
    setError('');
  };

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <JoinRoom 
        onJoinRoom={handleJoinRoom}
        isConnecting={isConnecting}
      />
    );
  }

  return (
    <div className="app-container">
      <VideoGrid
        localStream={localStream}
        remoteStreams={remoteStreams}
        localPeerId={currentPeerId}
      />
      <Controls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onLeaveRoom={handleLeaveRoom}
        participantCount={participantCount}
      />
    </div>
  );
}

export default App;
