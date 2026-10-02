import React, { useState } from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import './Home.css';

const Home = () => {
  const [email, setEmail] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Joining Room:', { email, roomCode });
  };

  return (
    <div className="polaroid-wrapper">
      <div className="polaroid-card">
        {/* Washi Tape */}
        <div className="washi-tape" />

        {/* Camera Viewfinder Screen */}
        <div className="viewfinder">
          <div className="viewfinder-header">
            <div className="brand">
              <Camera className="brand-icon" size={20} />
              <span className="brand-text">PHOTO-BOOTH v1.001</span>
            </div>
            <div className="rec-dot" />
          </div>

          {/* Form */}
          <form id="room-form" onSubmit={handleSubmit} className="retro-form">
            <div className="input-group">
              <label htmlFor="email">Your Email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="user@vintage.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="retro-input"
              />
            </div>

            <div className="input-group">
              <label htmlFor="code">Room Code</label>
              <input
                id="code"
                type="text"
                required
                maxLength={6}
                placeholder="X89-A2"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="retro-input code-input"
              />
            </div>
          </form>

          {/* Rainbow Strip Decal */}
          <div className="rainbow-strip">
            <div className="stripe-red" />
            <div className="stripe-orange" />
            <div className="stripe-yellow" />
            <div className="stripe-green" />
            <div className="stripe-blue" />
          </div>
        </div>

        {/* Polaroid Bottom Caption */}
        <div className="polaroid-footer">
          <div className="caption">
            <span className="handwritten">Snap into the session...</span>
            <span className="date-stamp">
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Shutter Submit Button */}
          <button type="submit" form="room-form" className="shutter-btn" title="Enter Room">
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;