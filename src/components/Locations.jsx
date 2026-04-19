// src/components/Locations.jsx
import { useState } from 'react';
import DEX from './DEX';
import CasinoDome from './CasinoDome';
import PredictionMarket from './PredictionMarket';
import './Locations.css';

export default function Locations() {
  const [activeLocation, setActiveLocation] = useState(null);

  const locations = [
    {
      id: 'dex',
      name: 'Trading Station',
      icon: '💱',
      description: 'Exchange Credits ↔ MORPH',
      color: '#00bcd4',
      component: DEX
    },
    {
      id: 'casino',
      name: 'Casino Dome',
      icon: '🎰',
      description: 'Coin Flip, Dice, Slots',
      color: '#d946ef',
      component: CasinoDome
    },
    {
      id: 'predictions',
      name: 'Prediction Hub',
      icon: '🔮',
      description: 'Bet on future outcomes',
      color: '#8b5cf6',
      component: PredictionMarket
    }
  ];

  if (activeLocation) {
    const ActiveComponent = activeLocation.component;
    return <ActiveComponent onBack={() => setActiveLocation(null)} />;
  }

  return (
    <div className="locations-container">
      {/* Header */}
      <div className="locations-header">
        <h1>🗺️ Colony Locations</h1>
        <p className="locations-subtitle">
          Visit different facilities on your planet
        </p>
      </div>

      {/* Locations Grid */}
      <div className="locations-grid">
        {locations.map(location => (
          <div
            key={location.id}
            className="location-card"
            style={{ borderColor: location.color }}
            onClick={() => setActiveLocation(location)}
          >
            <div className="location-icon" style={{ background: location.color }}>
              {location.icon}
            </div>
            <div className="location-info">
              <h3>{location.name}</h3>
              <p>{location.description}</p>
            </div>
            <button 
              className="visit-btn"
              style={{ background: location.color }}
            >
              Visit →
            </button>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="locations-info">
        <h4>ℹ️ About Locations</h4>
        <ul>
          <li><strong>Trading Station:</strong> Convert your Credits to MORPH and vice versa</li>
          <li><strong>Casino Dome:</strong> Test your luck in various games</li>
          <li><strong>Prediction Hub:</strong> Place bets on future events</li>
        </ul>
      </div>
    </div>
  );
}
