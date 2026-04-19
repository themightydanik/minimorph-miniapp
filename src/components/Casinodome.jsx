import React, { useState, useEffect } from 'react';
import './CasinoDome.css';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CasinoDome = ({ telegramId, onBack }) => {
  // Balance state
  const [credits, setCredits] = useState(0);
  
  // Game selection
  const [activeGame, setActiveGame] = useState('coinflip'); // 'coinflip', 'dice', 'slots'
  
  // Coin Flip state
  const [coinBetAmount, setCoinBetAmount] = useState('');
  const [coinChoice, setCoinChoice] = useState(''); // 'heads' or 'tails'
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  
  // Dice Roll state
  const [diceBetAmount, setDiceBetAmount] = useState('');
  const [diceChoice, setDiceChoice] = useState(''); // 1-6
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState(null);
  
  // Slots state
  const [slotsBetAmount, setSlotsBetAmount] = useState('');
  const [slotsSpinning, setSlotsSpinning] = useState(false);
  const [slotsResult, setSlotsResult] = useState(['🍒', '🍋', '🍊']);
  const [lastWin, setLastWin] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    gamesPlayed: 0
  });
  
  // Symbols for slots
  const slotSymbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎'];
  
  // Payout tables
  const COIN_PAYOUT = 1.95; // 50% chance, 5% house edge
  const DICE_PAYOUT = 5.7;  // 16.67% chance, 5% house edge
  const SLOTS_PAYOUTS = {
    '💎💎💎': 50,   // Jackpot
    '⭐⭐⭐': 20,   // Stars
    '🍇🍇🍇': 10,   // Grapes
    '🍉🍉🍉': 7,    // Watermelon
    '🍊🍊🍊': 5,    // Orange
    '🍋🍋🍋': 4,    // Lemon
    '🍒🍒🍒': 3,    // Cherry
    'ANY_TWO': 1.5 // Any 2 matching
  };

  useEffect(() => {
    loadBalance();
    loadStats();
  }, [telegramId]);

  const loadBalance = async () => {
    try {
      const userRef = doc(db, 'users', telegramId);
      const balancesRef = doc(userRef, 'balances', 'current');
      const balancesSnap = await getDoc(balancesRef);
      
      if (balancesSnap.exists()) {
        const data = balancesSnap.data();
        setCredits(data.credits || 0);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const loadStats = async () => {
    try {
      const userRef = doc(db, 'users', telegramId);
      const statsRef = doc(userRef, 'casino_stats', 'overall');
      const statsSnap = await getDoc(statsRef);
      
      if (statsSnap.exists()) {
        setStats(statsSnap.data());
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const updateBalance = async (amount) => {
    try {
      const userRef = doc(db, 'users', telegramId);
      const balancesRef = doc(userRef, 'balances', 'current');
      
      await updateDoc(balancesRef, {
        credits: increment(amount)
      });
      
      setCredits(prev => prev + amount);
    } catch (error) {
      console.error('Error updating balance:', error);
      throw error;
    }
  };

  const recordGame = async (game, betAmount, payout, won) => {
    try {
      // Update stats
      const userRef = doc(db, 'users', telegramId);
      const statsRef = doc(userRef, 'casino_stats', 'overall');
      
      await updateDoc(statsRef, {
        totalWagered: increment(betAmount),
        totalWon: increment(won ? payout : 0),
        totalLost: increment(won ? 0 : betAmount),
        gamesPlayed: increment(1)
      });
      
      // Record in history
      await addDoc(collection(db, 'casino_history'), {
        userId: telegramId,
        game: game,
        betAmount: betAmount,
        payout: payout,
        won: won,
        timestamp: serverTimestamp()
      });
      
      // Update local stats
      setStats(prev => ({
        totalWagered: prev.totalWagered + betAmount,
        totalWon: prev.totalWon + (won ? payout : 0),
        totalLost: prev.totalLost + (won ? 0 : betAmount),
        gamesPlayed: prev.gamesPlayed + 1
      }));
    } catch (error) {
      console.error('Error recording game:', error);
    }
  };

  // COIN FLIP
  const handleCoinFlip = async () => {
    const betAmount = parseFloat(coinBetAmount);
    
    if (!betAmount || betAmount <= 0) {
      alert('Enter a valid bet amount!');
      return;
    }
    
    if (!coinChoice) {
      alert('Choose Heads or Tails!');
      return;
    }
    
    if (betAmount > credits) {
      alert('Insufficient credits!');
      return;
    }
    
    setCoinFlipping(true);
    setCoinResult(null);
    
    // Deduct bet
    await updateBalance(-betAmount);
    
    // Simulate coin flip (2 seconds)
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === coinChoice;
      const payout = won ? betAmount * COIN_PAYOUT : 0;
      
      setCoinResult({ side: result, won });
      setCoinFlipping(false);
      
      if (won) {
        updateBalance(payout);
        setLastWin(payout);
        setTimeout(() => setLastWin(null), 3000);
      }
      
      recordGame('coinflip', betAmount, payout, won);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setCoinResult(null);
        setCoinBetAmount('');
        setCoinChoice('');
      }, 3000);
    }, 2000);
  };

  // DICE ROLL
  const handleDiceRoll = async () => {
    const betAmount = parseFloat(diceBetAmount);
    
    if (!betAmount || betAmount <= 0) {
      alert('Enter a valid bet amount!');
      return;
    }
    
    if (!diceChoice) {
      alert('Pick a number 1-6!');
      return;
    }
    
    if (betAmount > credits) {
      alert('Insufficient credits!');
      return;
    }
    
    setDiceRolling(true);
    setDiceResult(null);
    
    // Deduct bet
    await updateBalance(-betAmount);
    
    // Simulate dice roll (2 seconds)
    setTimeout(() => {
      const result = Math.floor(Math.random() * 6) + 1;
      const won = result === parseInt(diceChoice);
      const payout = won ? betAmount * DICE_PAYOUT : 0;
      
      setDiceResult({ number: result, won });
      setDiceRolling(false);
      
      if (won) {
        updateBalance(payout);
        setLastWin(payout);
        setTimeout(() => setLastWin(null), 3000);
      }
      
      recordGame('dice', betAmount, payout, won);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setDiceResult(null);
        setDiceBetAmount('');
        setDiceChoice('');
      }, 3000);
    }, 2000);
  };

  // SLOTS
  const handleSlotsSpin = async () => {
    const betAmount = parseFloat(slotsBetAmount);
    
    if (!betAmount || betAmount <= 0) {
      alert('Enter a valid bet amount!');
      return;
    }
    
    if (betAmount > credits) {
      alert('Insufficient credits!');
      return;
    }
    
    setSlotsSpinning(true);
    
    // Deduct bet
    await updateBalance(-betAmount);
    
    // Simulate spinning (3 seconds)
    setTimeout(() => {
      // Generate result
      const reel1 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
      const reel2 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
      const reel3 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
      
      const result = [reel1, reel2, reel3];
      setSlotsResult(result);
      setSlotsSpinning(false);
      
      // Check for wins
      let payout = 0;
      const resultString = result.join('');
      
      if (SLOTS_PAYOUTS[resultString]) {
        // All three match
        payout = betAmount * SLOTS_PAYOUTS[resultString];
      } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        // Any two match
        payout = betAmount * SLOTS_PAYOUTS.ANY_TWO;
      }
      
      const won = payout > 0;
      
      if (won) {
        updateBalance(payout);
        setLastWin(payout);
        setTimeout(() => setLastWin(null), 3000);
      }
      
      recordGame('slots', betAmount, payout, won);
      
      // Reset bet amount after 2 seconds
      setTimeout(() => {
        setSlotsBetAmount('');
      }, 2000);
    }, 3000);
  };

  return (
    <div className="casino-container">
      {/* Header */}
      <div className="casino-header">
        <button className="casino-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2 className="casino-title">🎰 Casino Dome</h2>
        <div className="casino-balance">
          💳 {credits.toLocaleString()} Credits
        </div>
      </div>

      {/* Win Celebration */}
      {lastWin && (
        <div className="win-celebration">
          <div className="win-amount">🎉 +{lastWin.toLocaleString()} Credits!</div>
        </div>
      )}

      {/* Game Tabs */}
      <div className="game-tabs">
        <button 
          className={`game-tab ${activeGame === 'coinflip' ? 'active' : ''}`}
          onClick={() => setActiveGame('coinflip')}
        >
          🪙 Coin Flip
        </button>
        <button 
          className={`game-tab ${activeGame === 'dice' ? 'active' : ''}`}
          onClick={() => setActiveGame('dice')}
        >
          🎲 Dice Roll
        </button>
        <button 
          className={`game-tab ${activeGame === 'slots' ? 'active' : ''}`}
          onClick={() => setActiveGame('slots')}
        >
          🎰 Slots
        </button>
      </div>

      {/* COIN FLIP GAME */}
      {activeGame === 'coinflip' && (
        <div className="game-panel">
          <div className="game-title">🪙 Coin Flip</div>
          <div className="game-description">
            Pick Heads or Tails. Win 1.95x your bet!
          </div>

          {/* Coin Display */}
          <div className={`coin-display ${coinFlipping ? 'flipping' : ''}`}>
            {coinResult ? (
              <div className={`coin-result ${coinResult.won ? 'win' : 'lose'}`}>
                <div className="coin-face">
                  {coinResult.side === 'heads' ? '👑' : '💰'}
                </div>
                <div className="coin-outcome">
                  {coinResult.won ? 'YOU WIN!' : 'YOU LOSE'}
                </div>
              </div>
            ) : (
              <div className="coin-idle">
                <div className="coin-face">🪙</div>
              </div>
            )}
          </div>

          {/* Choice Buttons */}
          <div className="choice-buttons">
            <button
              className={`choice-btn ${coinChoice === 'heads' ? 'selected' : ''}`}
              onClick={() => setCoinChoice('heads')}
              disabled={coinFlipping}
            >
              <div className="choice-icon">👑</div>
              <div className="choice-label">Heads</div>
            </button>
            <button
              className={`choice-btn ${coinChoice === 'tails' ? 'selected' : ''}`}
              onClick={() => setCoinChoice('tails')}
              disabled={coinFlipping}
            >
              <div className="choice-icon">💰</div>
              <div className="choice-label">Tails</div>
            </button>
          </div>

          {/* Bet Input */}
          <div className="bet-input-group">
            <label className="bet-label">Bet Amount</label>
            <div className="bet-input-wrapper">
              <input
                type="number"
                className="bet-input"
                placeholder="Enter amount..."
                value={coinBetAmount}
                onChange={(e) => setCoinBetAmount(e.target.value)}
                disabled={coinFlipping}
              />
              <button
                className="max-bet-btn"
                onClick={() => setCoinBetAmount(credits.toString())}
                disabled={coinFlipping}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Play Button */}
          <button
            className="play-btn"
            onClick={handleCoinFlip}
            disabled={coinFlipping || !coinBetAmount || !coinChoice}
          >
            {coinFlipping ? 'FLIPPING...' : 'FLIP COIN'}
          </button>

          {/* Payout Info */}
          <div className="payout-info">
            <div className="payout-label">Win Payout:</div>
            <div className="payout-value">{COIN_PAYOUT}x</div>
          </div>
        </div>
      )}

      {/* DICE ROLL GAME */}
      {activeGame === 'dice' && (
        <div className="game-panel">
          <div className="game-title">🎲 Dice Roll</div>
          <div className="game-description">
            Pick a number 1-6. Win 5.7x your bet!
          </div>

          {/* Dice Display */}
          <div className={`dice-display ${diceRolling ? 'rolling' : ''}`}>
            {diceResult ? (
              <div className={`dice-result ${diceResult.won ? 'win' : 'lose'}`}>
                <div className="dice-number">{diceResult.number}</div>
                <div className="dice-outcome">
                  {diceResult.won ? 'YOU WIN!' : 'YOU LOSE'}
                </div>
              </div>
            ) : (
              <div className="dice-idle">
                <div className="dice-number">🎲</div>
              </div>
            )}
          </div>

          {/* Number Selection */}
          <div className="number-grid">
            {[1, 2, 3, 4, 5, 6].map(num => (
              <button
                key={num}
                className={`number-btn ${diceChoice === num.toString() ? 'selected' : ''}`}
                onClick={() => setDiceChoice(num.toString())}
                disabled={diceRolling}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Bet Input */}
          <div className="bet-input-group">
            <label className="bet-label">Bet Amount</label>
            <div className="bet-input-wrapper">
              <input
                type="number"
                className="bet-input"
                placeholder="Enter amount..."
                value={diceBetAmount}
                onChange={(e) => setDiceBetAmount(e.target.value)}
                disabled={diceRolling}
              />
              <button
                className="max-bet-btn"
                onClick={() => setDiceBetAmount(credits.toString())}
                disabled={diceRolling}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Play Button */}
          <button
            className="play-btn"
            onClick={handleDiceRoll}
            disabled={diceRolling || !diceBetAmount || !diceChoice}
          >
            {diceRolling ? 'ROLLING...' : 'ROLL DICE'}
          </button>

          {/* Payout Info */}
          <div className="payout-info">
            <div className="payout-label">Win Payout:</div>
            <div className="payout-value">{DICE_PAYOUT}x</div>
          </div>
        </div>
      )}

      {/* SLOTS GAME */}
      {activeGame === 'slots' && (
        <div className="game-panel">
          <div className="game-title">🎰 Slots</div>
          <div className="game-description">
            Match 3 symbols to win big! Check payout table below.
          </div>

          {/* Slot Machine */}
          <div className="slot-machine">
            <div className={`reels ${slotsSpinning ? 'spinning' : ''}`}>
              <div className="reel">{slotsResult[0]}</div>
              <div className="reel">{slotsResult[1]}</div>
              <div className="reel">{slotsResult[2]}</div>
            </div>
          </div>

          {/* Bet Input */}
          <div className="bet-input-group">
            <label className="bet-label">Bet Amount</label>
            <div className="bet-input-wrapper">
              <input
                type="number"
                className="bet-input"
                placeholder="Enter amount..."
                value={slotsBetAmount}
                onChange={(e) => setSlotsBetAmount(e.target.value)}
                disabled={slotsSpinning}
              />
              <button
                className="max-bet-btn"
                onClick={() => setSlotsBetAmount(credits.toString())}
                disabled={slotsSpinning}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Play Button */}
          <button
            className="play-btn slots"
            onClick={handleSlotsSpin}
            disabled={slotsSpinning || !slotsBetAmount}
          >
            {slotsSpinning ? 'SPINNING...' : 'SPIN'}
          </button>

          {/* Payout Table */}
          <div className="payout-table">
            <div className="payout-table-title">💰 Payout Table</div>
            <div className="payout-row">
              <span className="payout-combo">💎💎💎</span>
              <span className="payout-mult">50x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">⭐⭐⭐</span>
              <span className="payout-mult">20x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">🍇🍇🍇</span>
              <span className="payout-mult">10x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">🍉🍉🍉</span>
              <span className="payout-mult">7x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">🍊🍊🍊</span>
              <span className="payout-mult">5x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">🍋🍋🍋</span>
              <span className="payout-mult">4x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">🍒🍒🍒</span>
              <span className="payout-mult">3x</span>
            </div>
            <div className="payout-row">
              <span className="payout-combo">Any 2 Match</span>
              <span className="payout-mult">1.5x</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel */}
      <div className="stats-panel">
        <div className="stats-title">📊 Your Stats</div>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Games Played</div>
            <div className="stat-value">{stats.gamesPlayed}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Total Wagered</div>
            <div className="stat-value">{stats.totalWagered.toLocaleString()}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Total Won</div>
            <div className="stat-value won">{stats.totalWon.toLocaleString()}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Total Lost</div>
            <div className="stat-value lost">{stats.totalLost.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="casino-info-box">
        <h4>ℹ️ How to Play</h4>
        <ul>
          <li><strong>Coin Flip:</strong> 50/50 chance, pays 1.95x</li>
          <li><strong>Dice Roll:</strong> 1 in 6 chance, pays 5.7x</li>
          <li><strong>Slots:</strong> Match symbols for payouts up to 50x!</li>
          <li><strong>House Edge:</strong> 5% on all games</li>
          <li>All games use Credits - play responsibly!</li>
        </ul>
      </div>
    </div>
  );
};

export default CasinoDome;
