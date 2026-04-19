// src/components/Missions.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import ExpeditionRun from './ExpeditionRun';
import './Missions.css';

const MISSION_TYPES = [
  {
    id: 'easy',
    name: 'Scout Mission',
    difficulty: 'Easy',
    energyCost: 10,
    baseReward: { credits: 50, morph: 0.05 },
    duration: 60, // seconds
    unlocked: true,
    icon: '🔭',
    description: 'Quick scouting run. Low risk, steady rewards.',
    color: '#4caf50'
  },
  {
    id: 'medium',
    name: 'Resource Expedition',
    difficulty: 'Medium',
    energyCost: 20,
    baseReward: { credits: 150, morph: 0.15 },
    duration: 90,
    unlocked: true,
    icon: '⛏️',
    description: 'Deeper exploration. Better rewards, more challenges.',
    color: '#ff9800'
  },
  {
    id: 'hard',
    name: 'Deep Space Run',
    difficulty: 'Hard',
    energyCost: 30,
    baseReward: { credits: 400, morph: 0.5 },
    duration: 120,
    unlocked: false, // Требует Spaceport level 1
    icon: '🚀',
    description: 'High-risk, high-reward. Unlocks at Spaceport Lv.1',
    color: '#f44336'
  },
  {
    id: 'epic',
    name: 'Void Challenge',
    difficulty: 'Epic',
    energyCost: 50,
    baseReward: { credits: 1000, morph: 2.0 },
    duration: 180,
    unlocked: false, // Требует Spaceport level 3
    icon: '💫',
    description: 'Extreme danger. Massive rewards. Unlocks at Spaceport Lv.3',
    color: '#9c27b0'
  }
];

export default function Missions() {
  const [telegramId, setTelegramId] = useState('demo');
  const [balances, setBalances] = useState({ credits: 0, energy: 60, morph: 0 });
  const [buildings, setBuildings] = useState({});
  const [activeMission, setActiveMission] = useState(null);
  const [stats, setStats] = useState({
    totalRuns: 0,
    bestScore: 0,
    totalMorphEarned: 0
  });

  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: 'demo' };
    const uid = user.id.toString();
    setTelegramId(uid);

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setBalances(data.balances || { credits: 0, energy: 60, morph: 0 });
        setBuildings(data.colony?.buildings || {});
        setStats(data.missions?.stats || {
          totalRuns: 0,
          bestScore: 0,
          totalMorphEarned: 0
        });
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const startMission = (missionType) => {
    if (balances.energy < missionType.energyCost) {
      alert('❌ Not enough energy! Wait for regeneration or upgrade your Habitat.');
      return;
    }

    if (!missionType.unlocked) {
      alert(`🔒 This mission requires Spaceport level ${missionType.id === 'hard' ? 1 : 3}`);
      return;
    }

    setActiveMission(missionType);
  };

  const handleMissionComplete = async (results) => {
    // Apply Lab boost
    const labBoost = buildings.lab?.boost || 1.0;
    const finalCredits = Math.floor(results.credits * labBoost);
    const finalMorph = results.morph * labBoost;

    // Update will be handled by ExpeditionRun
    setActiveMission(null);
    
    // Refresh balances
    await initUser();
  };

  // Check unlocks based on Spaceport level
  const unlockedMissions = MISSION_TYPES.map(mission => {
    const spaceportLevel = buildings.spaceport?.level || 0;
    
    let unlocked = mission.unlocked;
    if (mission.id === 'hard') unlocked = spaceportLevel >= 1;
    if (mission.id === 'epic') unlocked = spaceportLevel >= 3;
    
    return { ...mission, unlocked };
  });

  if (activeMission) {
    return (
      <ExpeditionRun
        missionType={activeMission}
        telegramId={telegramId}
        currentEnergy={balances.energy}
        labBoost={buildings.lab?.boost || 1.0}
        onComplete={handleMissionComplete}
        onExit={() => setActiveMission(null)}
      />
    );
  }

  return (
    <div className="missions-container">
      {/* Header */}
      <div className="missions-header">
        <h1>🚀 Mission Control</h1>
        <div className="energy-display">
          <span className="energy-icon">⚡</span>
          <span className="energy-value">{balances.energy}</span>
          <span className="energy-max">/ {buildings.habitat?.energyCap || 60}</span>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="stats-panel">
        <div className="stat-item">
          <span className="stat-label">Total Runs</span>
          <span className="stat-value">{stats.totalRuns || 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Best Score</span>
          <span className="stat-value">{stats.bestScore || 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">MORPH Earned</span>
          <span className="stat-value">{(stats.totalMorphEarned || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Mission Cards */}
      <div className="missions-grid">
        {unlockedMissions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            labBoost={buildings.lab?.boost || 1.0}
            onStart={() => startMission(mission)}
          />
        ))}
      </div>

      {/* Tips */}
      <div className="missions-tips">
        <h3>💡 Tips</h3>
        <ul>
          <li>Energy regenerates 3 points every 15 minutes</li>
          <li>Upgrade Lab to boost mission rewards</li>
          <li>Upgrade Habitat to increase max energy</li>
          <li>Unlock Spaceport to access harder missions</li>
        </ul>
      </div>
    </div>
  );
}

// Mission Card Component
function MissionCard({ mission, labBoost, onStart }) {
  const boostedCredits = Math.floor(mission.baseReward.credits * labBoost);
  const boostedMorph = (mission.baseReward.morph * labBoost).toFixed(2);

  return (
    <div 
      className={`mission-card ${!mission.unlocked ? 'locked' : ''}`}
      style={{ borderColor: mission.color }}
    >
      <div className="mission-icon" style={{ background: mission.color }}>
        {mission.icon}
      </div>

      <div className="mission-info">
        <h3>{mission.name}</h3>
        <span className="mission-difficulty" style={{ color: mission.color }}>
          {mission.difficulty}
        </span>
        <p className="mission-description">{mission.description}</p>
      </div>

      <div className="mission-rewards">
        <div className="reward-item">
          <span>💰 {boostedCredits}</span>
          {labBoost > 1 && <span className="boost-badge">+{((labBoost - 1) * 100).toFixed(0)}%</span>}
        </div>
        <div className="reward-item">
          <span>💎 {boostedMorph}</span>
        </div>
      </div>

      <div className="mission-footer">
        <span className="energy-cost">⚡ {mission.energyCost}</span>
        <span className="duration">⏱️ {mission.duration}s</span>
      </div>

      <button
        className="start-mission-btn"
        onClick={onStart}
        disabled={!mission.unlocked}
        style={{ background: mission.unlocked ? mission.color : '#666' }}
      >
        {mission.unlocked ? 'Start Mission' : '🔒 Locked'}
      </button>
    </div>
  );
}
