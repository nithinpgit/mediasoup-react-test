import React from 'react';
import './Controls.css';

const Controls = ({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeaveRoom,
  participantCount
}) => {
  return (
    <div className="controls-container">
      <div className="controls-left">
        <span className="participant-count">
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="controls-center">
        <button
          className={`control-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
          onClick={onToggleAudio}
          title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          <span className="control-icon">
            {isAudioEnabled ? '🎤' : '🎤'}
          </span>
          <span className="control-label">
            {isAudioEnabled ? 'Mute' : 'Unmute'}
          </span>
        </button>

        <button
          className={`control-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
          onClick={onToggleVideo}
          title={isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
        >
          <span className="control-icon">
            {isVideoEnabled ? '📹' : '📹'}
          </span>
          <span className="control-label">
            {isVideoEnabled ? 'Stop Video' : 'Start Video'}
          </span>
        </button>

        <button
          className="control-btn leave-btn"
          onClick={onLeaveRoom}
          title="Leave Room"
        >
          <span className="control-icon">📞</span>
          <span className="control-label">Leave</span>
        </button>
      </div>
      
      <div className="controls-right">
        {/* Future: Add screen share, chat, etc. */}
      </div>
    </div>
  );
};

export default Controls;
