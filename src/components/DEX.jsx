// src/components/DEX.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './firebase';
import './DEX.css';

export default function DEX({ onBack }) {
  const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'demo';
  
  const [morphBalance, setMorphBalance] = useState(0);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [swapDirection, setSwapDirection] = useState('morph_to_credits'); // or 'credits_to_morph'
  const [inputAmount, setInputAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(10); // 1 MORPH = 10 Credits (базовий курс)
  const [slippage, setSlippage] = useState(0.5); // 0.5% слипідж
  const [recentSwaps, setRecentSwaps] = useState([]);
  const [loading, setLoading] = useState(false);

  // Завантажити баланси при монтуванні
  useEffect(() => {
    loadBalances();
    loadRecentSwaps();
  }, [userId]);

  // Динамічний курс обміну (симуляція волатильності)
  useEffect(() => {
    const interval = setInterval(() => {
      // Невеликі коливання курсу ±2%
      const volatility = (Math.random() - 0.5) * 0.4; // -0.2 до +0.2
      const baseRate = 10;
      const newRate = baseRate + volatility;
      setExchangeRate(Number(newRate.toFixed(2)));
    }, 5000); // Оновлення кожні 5 секунд

    return () => clearInterval(interval);
  }, []);

  const loadBalances = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        setMorphBalance(data.balances?.morph || 0);
        setCreditsBalance(data.balances?.credits || 0);
      }
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadRecentSwaps = async () => {
    try {
      const swapsRef = collection(db, 'dex_swaps');
      const q = query(
        swapsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);
      const swaps = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setRecentSwaps(swaps);
    } catch (error) {
      console.error('Error loading swaps:', error);
    }
  };

  // Розрахунок виходу з урахуванням слипіджу
  const calculateOutput = () => {
    if (!inputAmount || isNaN(inputAmount)) return 0;
    
    const amount = parseFloat(inputAmount);
    if (amount <= 0) return 0;

    let output;
    if (swapDirection === 'morph_to_credits') {
      // MORPH → Credits
      output = amount * exchangeRate;
    } else {
      // Credits → MORPH
      output = amount / exchangeRate;
    }

    // Застосувати слипідж (користувач отримує трохи менше)
    const slippageAmount = output * (slippage / 100);
    const finalOutput = output - slippageAmount;
    
    return finalOutput;
  };

  // Розрахунок мінімального отримання (з урахуванням максимального слипіджу)
  const calculateMinReceived = () => {
    const output = calculateOutput();
    return output * 0.99; // Гарантований мінімум (додаткові -1%)
  };

  const handleSwap = async () => {
    const amount = parseFloat(inputAmount);
    
    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }

    // Перевірка балансу
    if (swapDirection === 'morph_to_credits' && amount > morphBalance) {
      alert('Insufficient MORPH balance');
      return;
    }
    
    if (swapDirection === 'credits_to_morph' && amount > creditsBalance) {
      alert('Insufficient Credits balance');
      return;
    }

    setLoading(true);

    try {
      const output = calculateOutput();
      const userRef = doc(db, 'users', userId);

      // Atomic update обох балансів
      if (swapDirection === 'morph_to_credits') {
        // MORPH → Credits
        await updateDoc(userRef, {
          'balances.morph': increment(-amount),
          'balances.credits': increment(output)
        });
      } else {
        // Credits → MORPH
        await updateDoc(userRef, {
          'balances.credits': increment(-amount),
          'balances.morph': increment(output)
        });
      }

      // Зберегти запис про swap
      await addDoc(collection(db, 'dex_swaps'), {
        userId,
        direction: swapDirection,
        inputAmount: amount,
        outputAmount: output,
        exchangeRate,
        slippage,
        timestamp: serverTimestamp()
      });

      // Оновити локальні баланси
      await loadBalances();
      await loadRecentSwaps();
      
      setInputAmount('');
      alert(`Swap successful! Received ${output.toFixed(2)} ${swapDirection === 'morph_to_credits' ? 'Credits' : 'MORPH'}`);
    } catch (error) {
      console.error('Swap error:', error);
      alert('Swap failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFlipDirection = () => {
    setSwapDirection(prev => 
      prev === 'morph_to_credits' ? 'credits_to_morph' : 'morph_to_credits'
    );
    setInputAmount('');
  };

  const handleMaxInput = () => {
    if (swapDirection === 'morph_to_credits') {
      setInputAmount(morphBalance.toString());
    } else {
      setInputAmount(creditsBalance.toString());
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const output = calculateOutput();
  const minReceived = calculateMinReceived();

  return (
    <div className="dex-container">
      {/* Header */}
      <div className="dex-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2 className="dex-title">💱 Trading Station</h2>
        <div className="dex-balances">
          <div className="balance-item">
            <span className="balance-label">MORPH</span>
            <span className="balance-value">{morphBalance.toFixed(2)}</span>
          </div>
          <div className="balance-divider">|</div>
          <div className="balance-item">
            <span className="balance-label">Credits</span>
            <span className="balance-value">{creditsBalance.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Exchange Rate Display */}
      <div className="exchange-rate-card">
        <div className="rate-label">Current Rate</div>
        <div className="rate-value">
          1 MORPH = {exchangeRate.toFixed(2)} Credits
        </div>
        <div className="rate-indicator">
          <span className="pulse-dot"></span>
          Live
        </div>
      </div>

      {/* Swap Interface */}
      <div className="swap-panel">
        <div className="swap-section">
          <div className="section-header">
            <span className="section-label">From</span>
            <button className="max-btn" onClick={handleMaxInput}>MAX</button>
          </div>
          
          <div className="input-group">
            <input
              type="number"
              className="swap-input"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              min="0"
              step="0.1"
            />
            <div className="currency-badge">
              {swapDirection === 'morph_to_credits' ? '🔮 MORPH' : '💰 Credits'}
            </div>
          </div>
          
          <div className="balance-display">
            Balance: {swapDirection === 'morph_to_credits' 
              ? morphBalance.toFixed(2) 
              : creditsBalance.toFixed(0)}
          </div>
        </div>

        {/* Flip Button */}
        <button className="flip-btn" onClick={handleFlipDirection}>
          ⇅
        </button>

        <div className="swap-section">
          <div className="section-header">
            <span className="section-label">To</span>
          </div>
          
          <div className="input-group output-group">
            <div className="swap-output">
              {output > 0 ? output.toFixed(2) : '0.0'}
            </div>
            <div className="currency-badge">
              {swapDirection === 'morph_to_credits' ? '💰 Credits' : '🔮 MORPH'}
            </div>
          </div>
          
          {output > 0 && (
            <div className="min-received">
              Minimum received: {minReceived.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Swap Details */}
      {inputAmount && output > 0 && (
        <div className="swap-details">
          <div className="detail-row">
            <span>Exchange Rate</span>
            <span>1 MORPH = {exchangeRate.toFixed(2)} Credits</span>
          </div>
          <div className="detail-row">
            <span>Slippage Tolerance</span>
            <span className="slippage-value">{slippage}%</span>
          </div>
          <div className="detail-row">
            <span>Price Impact</span>
            <span className="impact-low">≈ 0.01%</span>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <button 
        className="swap-btn"
        onClick={handleSwap}
        disabled={!inputAmount || loading || output <= 0}
      >
        {loading ? 'Swapping...' : 'Swap'}
      </button>

      {/* Recent Swaps */}
      {recentSwaps.length > 0 && (
        <div className="recent-swaps">
          <h3 className="swaps-title">Recent Swaps</h3>
          <div className="swaps-list">
            {recentSwaps.map((swap) => (
              <div key={swap.id} className="swap-card">
                <div className="swap-info">
                  <div className="swap-direction">
                    {swap.direction === 'morph_to_credits' ? (
                      <span>🔮 MORPH → 💰 Credits</span>
                    ) : (
                      <span>💰 Credits → 🔮 MORPH</span>
                    )}
                  </div>
                  <div className="swap-amounts">
                    <span className="amount-from">
                      -{swap.inputAmount.toFixed(2)}
                    </span>
                    <span className="arrow">→</span>
                    <span className="amount-to">
                      +{swap.outputAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="swap-meta">
                  <span className="swap-rate">
                    Rate: {swap.exchangeRate.toFixed(2)}
                  </span>
                  <span className="swap-time">
                    {formatTimestamp(swap.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="dex-info">
        <div className="info-icon">ℹ️</div>
        <div className="info-text">
          Exchange rates update every 5 seconds. Swaps are instant and atomic.
        </div>
      </div>
    </div>
  );
}
