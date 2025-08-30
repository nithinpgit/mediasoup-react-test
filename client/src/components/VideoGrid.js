import React from 'react';
import './VideoGrid.css';

const VideoTile = ({ stream, peerId, isLocal = false, muted = false }) => {
  const videoRef = React.useRef();

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="video-element"
      />
      <div className="video-overlay">
        <span className="peer-label">
          {isLocal ? 'You' : `Peer ${peerId.substring(0, 8)}`}
        </span>
      </div>
    </div>
  );
};

const VideoGrid = ({ localStream, remoteStreams, localPeerId }) => {
  const getGridClass = (totalVideos) => {
    if (totalVideos <= 1) return 'grid-1';
    if (totalVideos <= 4) return 'grid-2x2';
    if (totalVideos <= 9) return 'grid-3x3';
    if (totalVideos <= 16) return 'grid-4x4';
    return 'grid-5x5';
  };

  const totalVideos = (localStream ? 1 : 0) + remoteStreams.length;
  const gridClass = getGridClass(totalVideos);

  return (
    <div className={`video-grid ${gridClass}`}>
      {localStream && (
        <VideoTile
          stream={localStream}
          peerId={localPeerId}
          isLocal={true}
          muted={true}
        />
      )}
      {remoteStreams.map((streamData, index) => (
        <VideoTile
          key={streamData.consumerId || `${streamData.peerId}-${streamData.kind}-${index}`}
          stream={streamData.stream}
          peerId={streamData.peerId || `remote-${index}`}
          isLocal={false}
        />
      ))}
    </div>
  );
};

export default VideoGrid;
