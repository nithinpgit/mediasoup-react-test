import React, { useState } from 'react';
import './JoinRoom.css';

const JoinRoom = ({ onJoinRoom, isConnecting }) => {
  const [roomId, setRoomId] = useState('100');
  const [displayName, setDisplayName] = useState(`user-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomId.trim() && displayName.trim()) {
      onJoinRoom(roomId.trim(), displayName.trim());
    }
  };

  const generateRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomId);
  };

  return (
    <div className="join-room-container">
      <div className="join-room-card">
        <h1 className="app-title">MediaSoup Conference</h1>
        <p className="app-subtitle">Join or create a multiparty video conference</p>
        
        <form onSubmit={handleSubmit} className="join-form">
          <div className="form-group">
            <label htmlFor="displayName">Your Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={30}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomId">Room ID</label>
            <div className="room-input-group">
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID"
                maxLength={10}
                required
              />
              <button
                type="button"
                onClick={generateRoomId}
                className="generate-btn"
                title="Generate random room ID"
              >
                🎲
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="join-btn"
            disabled={isConnecting || !roomId.trim() || !displayName.trim()}
          >
            {isConnecting ? (
              <>
                <span className="spinner"></span>
                Joining...
              </>
            ) : (
              'Join Room'
            )}
          </button>
        </form>

        <div className="info-section">
          <h3>Features</h3>
          <ul>
            <li>✅ Support for 10+ participants</li>
            <li>✅ High-quality audio and video</li>
            <li>✅ Real-time communication</li>
            <li>✅ Responsive design</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
