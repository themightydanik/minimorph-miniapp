// src/components/ExpeditionRun.jsx
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import './ExpeditionRun.css';

// Игровые события с выборами
const EVENTS = [
  {
    id: 'rare_artifact',
    title: '💎 Rare Artifact Discovered!',
    description: 'You found something valuable. Risk going deeper or secure your loot?',
    choices: [
      { 
        text: 'Go Deeper', 
        risk: 0.5, 
        rewardMultiplier: 2.0,
        successText: 'Jackpot! Double rewards!',
        failText: 'Ambush! Lost half your loot.'
      },
      { 
        text: 'Secure Loot', 
        risk: 0, 
        rewardMultiplier: 1.0,
        successText: 'Safe choice. Rewards secured.',
        failText: '' // No fail for safe choice
      }
    ]
  },
  {
    id: 'hostile_entity',
    title: '👾 Hostile Entity!',
    description: 'Enemy detected ahead. Fight or flee?',
    choices: [
      { 
        text: 'Fight', 
        risk: 0.7, 
        rewardMultiplier: 1.5,
        successText: 'Victory! Bonus rewards.',
        failText: 'Defeated! Energy drained.'
      },
      { 
        text: 'Flee', 
        risk: 0.2, 
        rewardMultiplier: 0.8,
        successText: 'Escaped safely.',
        failText: 'Caught! Some loot lost.'
      }
    ]
  },
  {
    id: 'shortcut',
    title: '🔀 Shortcut Found!',
    description: 'A risky shortcut or the safe long route?',
    choices: [
      { 
        text: 'Take Shortcut', 
        risk: 0.6, 
        rewardMultiplier: 1.3,
        successText: 'Made it through! Time saved.',
        failText: 'Trap! You\'re hurt.'
      },
      { 
        text: 'Long Route', 
        risk: 0, 
        rewardMultiplier: 1.0,
        successText: 'Slow but steady.',
        failText: ''
      }
    ]
  },
  {
    id: 'mystery_box',
    title: '📦 Mystery Container!',
    description: 'Open it or leave it alone?',
    choices: [
      { 
        text: 'Open', 
        risk: 0.4, 
        rewardMultiplier: 1.8,
        successText: 'Treasure inside!',
        failText: 'Booby trap! Resources lost.'
      },
      { 
        text: 'Leave It', 
        risk: 0, 
        rewardMultiplier: 1.0,
        successText: 'Better safe than sorry.',
        failText: ''
      }
    ]
  }
];

export default function ExpeditionRun({ 
  missionType, 
  telegramId, 
  currentEnergy, 
  labBoost,
  onComplete,
  onExit 
}) {
  const canvasRef = useRef(null);
  
  // Game state
  const [phase, setPhase] = useState('prep'); // prep, running, event, complete
  const [distance, setDistance] = useState(0);
  const [score, setScore] = useState(0);
  const [rewards, setRewards] = useState({ credits: 0, morph: 0 });
  const [currentEvent, setCurrentEvent] = useState(null);
  const [eventResult, setEventResult] = useState(null);
  const [gameTime, setGameTime] = useState(missionType.duration);
  
  // Player state
  const [playerY, setPlayerY] = useState(150);
  const [isJumping, setIsJumping] = useState(false);
  const [velocity, setVelocity] = useState(0);
  
  // Obstacles
  const [obstacles, setObstacles] = useState([]);
  const [collectibles, setCollectibles] = useState([]);
  
  // Game loop
  const gameSpeed = useRef(3);
  const animationRef = useRef(null);
  const lastEventDistance = useRef(0);

  // Initialize game
  useEffect(() => {
    if (phase === 'running') {
      const gameLoop = setInterval(() => {
        updateGame();
      }, 1000 / 60); // 60 FPS

      return () => clearInterval(gameLoop);
    }
  }, [phase, distance, obstacles, collectibles, playerY, velocity]);

  // Timer
  useEffect(() => {
    if (phase === 'running') {
      const timer = setInterval(() => {
        setGameTime(prev => {
          if (prev <= 1) {
            finishMission();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [phase]);

  const startMission = () => {
    setPhase('running');
    setDistance(0);
    setScore(0);
    setRewards({ 
      credits: missionType.baseReward.credits, 
      morph: missionType.baseReward.morph 
    });
    spawnObstacle();
    spawnCollectible();
  };

  const updateGame = () => {
    // Update distance
    setDistance(prev => prev + gameSpeed.current);
    
    // Apply gravity
    if (isJumping || playerY < 150) {
      setVelocity(prev => prev + 0.8); // Gravity
      setPlayerY(prev => {
        const newY = prev + velocity;
        if (newY >= 150) {
          setIsJumping(false);
          return 150;
        }
        return newY;
      });
    }
    
    // Move obstacles
    setObstacles(prev => 
      prev.map(obs => ({ ...obs, x: obs.x - gameSpeed.current }))
        .filter(obs => obs.x > -50)
    );
    
    // Move collectibles
    setCollectibles(prev =>
      prev.map(col => ({ ...col, x: col.x - gameSpeed.current }))
        .filter(col => col.x > -30)
    );
    
    // Check collisions
    checkCollisions();
    
    // Spawn new obstacles
    if (Math.random() < 0.02) spawnObstacle();
    if (Math.random() < 0.01) spawnCollectible();
    
    // Trigger events
    if (distance - lastEventDistance.current > 500 && Math.random() < 0.3) {
      triggerEvent();
    }
    
    // Update score
    setScore(Math.floor(distance / 10));
  };

  const jump = () => {
    if (!isJumping && playerY >= 150) {
      setIsJumping(true);
      setVelocity(-15);
    }
  };

  const spawnObstacle = () => {
    const types = ['rock', 'crater', 'spike'];
    setObstacles(prev => [...prev, {
      id: Date.now(),
      x: 800,
      y: 170,
      width: 40,
      height: 30,
      type: types[Math.floor(Math.random() * types.length)]
    }]);
  };

  const spawnCollectible = () => {
    setCollectibles(prev => [...prev, {
      id: Date.now(),
      x: 800,
      y: 100 + Math.random() * 50,
      type: Math.random() < 0.8 ? 'credit' : 'morph'
    }]);
  };

  const checkCollisions = () => {
    // Check obstacle collisions
    obstacles.forEach(obs => {
      if (
        obs.x < 100 && obs.x > 50 &&
        playerY + 40 > obs.y
      ) {
        // Hit obstacle - reduce rewards
        setRewards(prev => ({
          credits: Math.max(0, prev.credits - 20),
          morph: Math.max(0, prev.morph - 0.02)
        }));
        setObstacles(prev => prev.filter(o => o.id !== obs.id));
      }
    });
    
    // Check collectible collisions
    collectibles.forEach(col => {
      if (
        col.x < 100 && col.x > 50 &&
        Math.abs((playerY + 20) - col.y) < 30
      ) {
        if (col.type === 'credit') {
          setRewards(prev => ({ ...prev, credits: prev.credits + 10 }));
        } else {
          setRewards(prev => ({ ...prev, morph: prev.morph + 0.05 }));
        }
        setCollectibles(prev => prev.filter(c => c.id !== col.id));
      }
    });
  };

  const triggerEvent = () => {
    setPhase('event');
    lastEventDistance.current = distance;
    const randomEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    setCurrentEvent(randomEvent);
  };

  const handleEventChoice = (choice) => {
    const success = Math.random() > choice.risk;
    
    if (success) {
      setRewards(prev => ({
        credits: Math.floor(prev.credits * choice.rewardMultiplier),
        morph: prev.morph * choice.rewardMultiplier
      }));
      setEventResult({ success: true, message: choice.successText });
    } else {
      setRewards(prev => ({
        credits: Math.floor(prev.credits * 0.5),
        morph: prev.morph * 0.5
      }));
      setEventResult({ success: false, message: choice.failText });
    }
    
    setTimeout(() => {
      setEventResult(null);
      setCurrentEvent(null);
      setPhase('running');
    }, 2000);
  };

  const finishMission = async () => {
    setPhase('complete');
    
    // Apply lab boost
    const finalCredits = Math.floor(rewards.credits * labBoost);
    const finalMorph = rewards.morph * labBoost;
    
    try {
      const userRef = doc(db, 'users', telegramId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        
        // Update balances
        await updateDoc(userRef, {
          'balances.credits': increment(finalCredits),
          'balances.morph': increment(finalMorph),
          'balances.energy': increment(-missionType.energyCost),
          
          // Update stats
          'missions.stats.totalRuns': increment(1),
          'missions.stats.bestScore': Math.max(data.missions?.stats?.bestScore || 0, score),
          'missions.stats.totalMorphEarned': increment(finalMorph)
        });
      }
      
      // Notify parent
      setTimeout(() => {
        onComplete({ credits: finalCredits, morph: finalMorph, score });
      }, 3000);
    } catch (error) {
      console.error('Error saving results:', error);
    }
  };

  // Render
  useEffect(() => {
    if (!canvasRef.current || phase !== 'running') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    ctx.fillStyle = '#1a1f3a';
    ctx.fillRect(0, 200, canvas.width, 50);
    
    // Draw player
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(50, playerY, 40, 40);
    
    // Draw obstacles
    obstacles.forEach(obs => {
      ctx.fillStyle = '#f44336';
      if (obs.type === 'rock') {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      } else if (obs.type === 'crater') {
        ctx.fillStyle = '#333';
        ctx.fillRect(obs.x, 200, obs.width, 20);
      }
    });
    
    // Draw collectibles
    collectibles.forEach(col => {
      ctx.fillStyle = col.type === 'credit' ? '#ffd700' : '#9c27b0';
      ctx.beginPath();
      ctx.arc(col.x, col.y, 15, 0, Math.PI * 2);
      ctx.fill();
    });
    
  }, [obstacles, collectibles, playerY, phase]);

  if (phase === 'prep') {
    return (
      <div className="expedition-prep">
        <h2>🚀 {missionType.name}</h2>
        <p className="mission-brief">{missionType.description}</p>
        
        <div className="prep-stats">
          <div className="prep-stat">
            <span className="label">Energy Cost</span>
            <span className="value">⚡ {missionType.energyCost}</span>
          </div>
          <div className="prep-stat">
            <span className="label">Duration</span>
            <span className="value">⏱️ {missionType.duration}s</span>
          </div>
          <div className="prep-stat">
            <span className="label">Base Reward</span>
            <span className="value">
              💰 {Math.floor(missionType.baseReward.credits * labBoost)}
              <br />
              💎 {(missionType.baseReward.morph * labBoost).toFixed(2)}
            </span>
          </div>
        </div>
        
        <button className="start-btn" onClick={startMission}>
          Launch Mission 🚀
        </button>
        <button className="back-btn" onClick={onExit}>
          Cancel
        </button>
      </div>
    );
  }

  if (phase === 'event') {
    return (
      <div className="event-modal">
        {eventResult ? (
          <div className={`event-result ${eventResult.success ? 'success' : 'failure'}`}>
            <h2>{eventResult.success ? '✅ Success!' : '❌ Failed!'}</h2>
            <p>{eventResult.message}</p>
          </div>
        ) : (
          <>
            <h2>{currentEvent.title}</h2>
            <p>{currentEvent.description}</p>
            <div className="event-choices">
              {currentEvent.choices.map((choice, idx) => (
                <button
                  key={idx}
                  className="choice-btn"
                  onClick={() => handleEventChoice(choice)}
                >
                  <span className="choice-text">{choice.text}</span>
                  <span className="choice-stats">
                    Risk: {(choice.risk * 100).toFixed(0)}%
                    <br />
                    Reward: x{choice.rewardMultiplier}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="mission-complete">
        <h2>🎉 Mission Complete!</h2>
        <div className="final-stats">
          <div className="stat">
            <span className="label">Distance</span>
            <span className="value">{distance}m</span>
          </div>
          <div className="stat">
            <span className="label">Score</span>
            <span className="value">{score}</span>
          </div>
          <div className="stat highlight">
            <span className="label">Rewards</span>
            <span className="value">
              💰 {Math.floor(rewards.credits * labBoost)}
              <br />
              💎 {(rewards.morph * labBoost).toFixed(2)}
            </span>
          </div>
          {labBoost > 1 && (
            <div className="boost-indicator">
              Lab Boost: +{((labBoost - 1) * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>
    );
  }

  // Running phase
  return (
    <div className="expedition-run">
      {/* HUD */}
      <div className="game-hud">
        <div className="hud-left">
          <span>⏱️ {gameTime}s</span>
          <span>📏 {distance}m</span>
        </div>
        <div className="hud-right">
          <span>💰 {Math.floor(rewards.credits)}</span>
          <span>💎 {rewards.morph.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={250}
        className="game-canvas"
      />
      
      {/* Controls */}
      <div className="game-controls">
        <button 
          className="jump-btn"
          onClick={jump}
          onTouchStart={jump}
        >
          JUMP 🚀
        </button>
      </div>
      
      <div className="game-hint">
        Tap JUMP or press SPACE to avoid obstacles
      </div>
    </div>
  );
}
