// src/components/PredictionMarket.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import './PredictionMarket.css';

// Sample prediction markets
const SAMPLE_MARKETS = [
  {
    id: 'btc_50k',
    question: 'Will Bitcoin reach $50,000 by end of month?',
    category: 'crypto',
    outcomes: ['Yes', 'No'],
    pool: { Yes: 150, No: 200 },
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    resolved: false
  },
  {
    id: 'top_player',
    question: 'Who will have the highest score this week?',
    category: 'leaderboard',
    outcomes: ['Player A', 'Player B', 'Player C'],
    pool: { 'Player A': 50, 'Player B': 75, 'Player C': 25 },
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    resolved: false
  }
];

export default function PredictionMarket({ onBack }) {
  const [telegramId, setTelegramId] = useState('demo');
  const [morphBalance, setMorphBalance] = useState(0);
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState(0.1);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user ?? { id: 'demo' };
    setTelegramId(user.id.toString());
    loadData(user.id.toString());
  }, []);

  const loadData = async (uid) => {
    try {
      // Load user balance
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        setMorphBalance(data.balances?.morph || 0);
      }

      // Load active markets
      setMarkets(SAMPLE_MARKETS);

      // Load user's bets
      const betsRef = collection(db, 'prediction_bets');
      const betsSnap = await getDocs(betsRef);
      const userBets = [];
      
      betsSnap.forEach(doc => {
        const bet = doc.data();
        if (bet.userId === uid) {
          userBets.push({ id: doc.id, ...bet });
        }
      });
      
      setMyBets(userBets);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const calculateOdds = (market, outcome) => {
    const totalPool = Object.values(market.pool).reduce((a, b) => a + b, 0);
    const outcomePool = market.pool[outcome] || 0;
    
    if (outcomePool === 0) return 5.0; // Max odds for new outcomes
    
    const impliedProbability = outcomePool / totalPool;
    const odds = 1 / impliedProbability;
    
    return Math.min(odds, 10).toFixed(2); // Cap at 10x
  };

  const calculatePotentialWin = (market, outcome, amount) => {
    const odds = parseFloat(calculateOdds(market, outcome));
    return (amount * odds).toFixed(2);
  };

  const placeBet = async () => {
    if (!selectedMarket || !selectedOutcome || betAmount <= 0) {
      alert('Please select an outcome and enter bet amount');
      return;
    }

    if (betAmount > morphBalance) {
      alert('Insufficient MORPH balance!');
      return;
    }

    if (betAmount < 0.1) {
      alert('Minimum bet is 0.1 MORPH');
      return;
    }

    try {
      const userRef = doc(db, 'users', telegramId);
      
      // Deduct MORPH from user balance
      await updateDoc(userRef, {
        'balances.morph': increment(-betAmount)
      });

      // Save bet
      const betRef = doc(collection(db, 'prediction_bets'));
      await setDoc(betRef, {
        userId: telegramId,
        marketId: selectedMarket.id,
        outcome: selectedOutcome,
        amount: betAmount,
        odds: parseFloat(calculateOdds(selectedMarket, selectedOutcome)),
        timestamp: serverTimestamp(),
        resolved: false
      });

      // Update local state
      setMorphBalance(prev => prev - betAmount);
      alert(`✅ Bet placed! ${betAmount} MORPH on "${selectedOutcome}"`);
      
      // Reset form
      setSelectedMarket(null);
      setSelectedOutcome(null);
      setBetAmount(0.1);
      
      // Reload bets
      loadData(telegramId);
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet. Please try again.');
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return 'Ending soon';
  };

  if (loading) {
    return (
      <div className="prediction-container">
        <div className="loading">Loading markets...</div>
      </div>
    );
  }

  return (
    <div className="prediction-container">
      {/* Header */}
      <div className="prediction-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🔮 Prediction Hub</h2>
        <div className="balance-display">
          💎 {morphBalance.toFixed(2)} MORPH
        </div>
      </div>

      {/* Active Markets */}
      <div className="markets-section">
        <h3>Active Markets</h3>
        
        <div className="markets-list">
          {markets.map(market => (
            <div 
              key={market.id} 
              className={`market-card ${selectedMarket?.id === market.id ? 'selected' : ''}`}
              onClick={() => setSelectedMarket(market)}
            >
              <div className="market-header">
                <span className="market-category">{market.category}</span>
                <span className="market-deadline">
                  ⏰ {formatTime(market.deadline)}
                </span>
              </div>
              
              <h4 className="market-question">{market.question}</h4>
              
              <div className="outcomes-grid">
                {market.outcomes.map(outcome => (
                  <div key={outcome} className="outcome-option">
                    <span className="outcome-name">{outcome}</span>
                    <span className="outcome-odds">
                      {calculateOdds(market, outcome)}x
                    </span>
                    <span className="outcome-pool">
                      Pool: {market.pool[outcome] || 0} MORPH
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet Placement */}
      {selectedMarket && (
        <div className="bet-panel">
          <h3>Place Your Bet</h3>
          <p className="bet-question">{selectedMarket.question}</p>
          
          <div className="outcome-selector">
            {selectedMarket.outcomes.map(outcome => (
              <button
                key={outcome}
                className={`outcome-btn ${selectedOutcome === outcome ? 'active' : ''}`}
                onClick={() => setSelectedOutcome(outcome)}
              >
                {outcome}
                <span className="odds-badge">
                  {calculateOdds(selectedMarket, outcome)}x
                </span>
              </button>
            ))}
          </div>
          
          <div className="bet-amount">
            <label>Bet Amount (MORPH)</label>
            <div className="amount-input-group">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max={morphBalance}
                value={betAmount}
                onChange={(e) => setBetAmount(parseFloat(e.target.value))}
              />
              <button 
                className="max-btn"
                onClick={() => setBetAmount(morphBalance)}
              >
                MAX
              </button>
            </div>
          </div>
          
          {selectedOutcome && (
            <div className="potential-win">
              Potential Win: <strong>{calculatePotentialWin(selectedMarket, selectedOutcome, betAmount)} MORPH</strong>
            </div>
          )}
          
          <button 
            className="place-bet-btn"
            onClick={placeBet}
            disabled={!selectedOutcome || betAmount <= 0}
          >
            Place Bet
          </button>
        </div>
      )}

      {/* My Bets */}
      <div className="my-bets-section">
        <h3>My Active Bets</h3>
        
        {myBets.length === 0 ? (
          <p className="no-bets">No active bets yet</p>
        ) : (
          <div className="bets-list">
            {myBets.map(bet => {
              const market = markets.find(m => m.id === bet.marketId);
              if (!market) return null;
              
              return (
                <div key={bet.id} className="bet-card">
                  <div className="bet-info">
                    <span className="bet-market">{market.question}</span>
                    <span className="bet-outcome">Outcome: {bet.outcome}</span>
                    <span className="bet-details">
                      {bet.amount} MORPH @ {bet.odds}x
                    </span>
                  </div>
                  <div className="bet-status">
                    <span className="status-badge pending">Pending</span>
                    <span className="potential-payout">
                      Potential: {(bet.amount * bet.odds).toFixed(2)} MORPH
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="prediction-info">
        <h4>ℹ️ How it works</h4>
        <ul>
          <li>Place bets on future outcomes using MORPH tokens</li>
          <li>Odds are calculated based on the betting pool</li>
          <li>Winners share the losing pool proportionally</li>
          <li>5% house edge is applied to payouts</li>
        </ul>
      </div>
    </div>
  );
}
