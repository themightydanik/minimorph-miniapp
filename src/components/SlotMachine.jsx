// components/SlotMachine.jsx
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import './SlotMachine.css';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '7️⃣'];

// Вероятности выпадения (чем меньше число, тем реже)
const SYMBOL_WEIGHTS = {
  '🍒': 30,
  '🍋': 25,
  '🍊': 20,
  '🍇': 15,
  '💎': 7,
  '⭐': 2,
  '7️⃣': 1
};

// Таблица выплат (в Telegram Stars)
const PAYOUTS = {
  '7️⃣-7️⃣-7️⃣': { stars: 100, minima: 0, type: 'jackpot' }, // Супер джекпот
  '⭐-⭐-⭐': { stars: 0, minima: 100, type: 'jackpot' }, // Minima джекпот
  '💎-💎-💎': { stars: 50, minima: 0, type: 'big_win' },
  '🍇-🍇-🍇': { stars: 20, minima: 0, type: 'big_win' },
  '🍊-🍊-🍊': { stars: 10, minima: 0, type: 'win' },
  '🍋-🍋-🍋': { stars: 8, minima: 0, type: 'win' },
  '🍒-🍒-🍒': { stars: 5, minima: 0, type: 'win' },
  // Две одинаковые (любые)
  'pair': { stars: 3, minima: 0, type: 'small_win' }
};

const COST_PER_SPIN = 20; // Telegram Stars
const SPINS_PER_PURCHASE = 3;

function SlotMachine({ telegramId, onClose }) {
  const [reels, setReels] = useState([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
  const [spinning, setSpinning] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({
    totalSpins: 0,
    wins: 0,
    totalEarned: 0
  });
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const reelRefs = [useRef(), useRef(), useRef()];

  useEffect(() => {
    loadUserStats();
  }, [telegramId]);

  const loadUserStats = async () => {
    try {
      const userRef = doc(db, 'users', telegramId.toString());
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setSpinsLeft(data.slotSpins || 0);
        setStats({
          totalSpins: data.slotTotalSpins || 0,
          wins: data.slotWins || 0,
          totalEarned: data.slotTotalEarned || 0
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getWeightedSymbol = () => {
    const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
      random -= weight;
      if (random <= 0) return symbol;
    }
    return SYMBOLS[0];
  };

  const checkWin = (symbols) => {
    const [a, b, c] = symbols;
    const key = `${a}-${b}-${c}`;
    
    // Проверка на полное совпадение
    if (PAYOUTS[key]) {
      return PAYOUTS[key];
    }

    // Проверка на пару (любые два одинаковых)
    if (a === b || b === c || a === c) {
      return PAYOUTS.pair;
    }

    return null;
  };

  const spin = async () => {
    if (spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);

    // Генерируем результат
    const newSymbols = [
      getWeightedSymbol(),
      getWeightedSymbol(),
      getWeightedSymbol()
    ];

    // Анимация вращения
    const spinDuration = 2000;
    const startTime = Date.now();

    const animateReels = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < spinDuration) {
        setReels([
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        ]);
        requestAnimationFrame(animateReels);
      } else {
        // Останавливаем барабаны по очереди
        setTimeout(() => {
          setReels([newSymbols[0], reels[1], reels[2]]);
        }, 100);
        setTimeout(() => {
          setReels([newSymbols[0], newSymbols[1], reels[2]]);
        }, 400);
        setTimeout(() => {
          setReels(newSymbols);
          processResult(newSymbols);
        }, 700);
      }
    };

    animateReels();
  };

  const processResult = async (symbols) => {
    const win = checkWin(symbols);
    
    try {
      const userRef = doc(db, 'users', telegramId.toString());
      const updates = {
        slotSpins: increment(-1),
        slotTotalSpins: increment(1)
      };

      if (win) {
        setResult({ type: 'win', ...win });
        updates.slotWins = increment(1);
        
        if (win.stars > 0) {
          updates.telegramStars = increment(win.stars);
          updates.slotTotalEarned = increment(win.stars);
        }
        if (win.minima > 0) {
          updates.minimaCoins = increment(win.minima);
        }

        setStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalEarned: prev.totalEarned + (win.stars || 0)
        }));
      } else {
        setResult({ type: 'lose' });
      }

      setStats(prev => ({
        ...prev,
        totalSpins: prev.totalSpins + 1
      }));

      await updateDoc(userRef, updates);
      setSpinsLeft(prev => prev - 1);

    } catch (error) {
      console.error('Error processing result:', error);
    }

    setSpinning(false);
  };

  const buySpins = async () => {
    if (purchasing) return;

    setPurchasing(true);
    
    try {
      // Здесь должна быть интеграция с Telegram Stars API
      // Для демо просто обновляем базу
      const tg = window.Telegram?.WebApp;
      
      // Создаём инвойс для оплаты
      const invoice = {
        title: `Buy ${SPINS_PER_PURCHASE} Slot Spins`,
        description: `Get ${SPINS_PER_PURCHASE} spins for the slot machine`,
        payload: `slot_purchase_${telegramId}_${Date.now()}`,
        provider_token: '', // Для Telegram Stars оставляем пустым
        currency: 'XTR',
        prices: [{
          label: `${SPINS_PER_PURCHASE} Spins`,
          amount: COST_PER_SPIN
        }]
      };

      // В реальном приложении здесь будет:
      // await tg.showPopup({ message: 'Opening payment...' });
      // const result = await tg.openInvoice(invoiceLink);
      
      // Для демо просто добавляем спины
      const userRef = doc(db, 'users', telegramId.toString());
      await updateDoc(userRef, {
        slotSpins: increment(SPINS_PER_PURCHASE)
      });

      setSpinsLeft(prev => prev + SPINS_PER_PURCHASE);
      setShowBuyModal(false);
      
      alert(`✅ Successfully purchased ${SPINS_PER_PURCHASE} spins!`);

    } catch (error) {
      console.error('Error buying spins:', error);
      alert('❌ Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="slot-machine-overlay" onClick={onClose}>
      <div className="slot-machine" onClick={(e) => e.stopPropagation()}>
        <button className="slot-close" onClick={onClose}>✕</button>

        <h2 className="slot-title">🎰 Slot Machine</h2>

        <div className="slot-stats">
          <div className="stat-item">
            <span className="stat-label">Spins Left:</span>
            <span className="stat-value">{spinsLeft}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Won:</span>
            <span className="stat-value">⭐ {stats.totalEarned}</span>
          </div>
        </div>

        <div className="slot-reels-container">
          <div className="slot-reels">
            {reels.map((symbol, index) => (
              <div 
                key={index}
                ref={reelRefs[index]}
                className={`slot-reel ${spinning ? 'spinning' : ''}`}
              >
                <div className="reel-symbol">{symbol}</div>
              </div>
            ))}
          </div>
        </div>

        {result && (
          <div className={`slot-result ${result.type}`}>
            {result.type === 'lose' && (
              <p>😔 Try again!</p>
            )}
            {result.type === 'small_win' && (
              <p>✨ Nice! +{result.stars} ⭐</p>
            )}
            {result.type === 'win' && (
              <p>🎉 You won {result.stars} ⭐!</p>
            )}
            {result.type === 'big_win' && (
              <p>💰 BIG WIN! +{result.stars} ⭐</p>
            )}
            {result.type === 'jackpot' && (
              <div className="jackpot-win">
                <p>🎊 JACKPOT! 🎊</p>
                {result.stars > 0 && <p>+{result.stars} ⭐</p>}
                {result.minima > 0 && <p>+{result.minima} 💎 Minima</p>}
              </div>
            )}
          </div>
        )}

        <button
          className="slot-spin-btn"
          onClick={spin}
          disabled={spinning || spinsLeft <= 0}
        >
          {spinning ? '🎰 Spinning...' : spinsLeft > 0 ? '🎰 SPIN' : '🔒 No Spins Left'}
        </button>

        <button
          className="slot-buy-btn"
          onClick={() => setShowBuyModal(true)}
        >
          💳 Buy {SPINS_PER_PURCHASE} Spins ({COST_PER_SPIN} ⭐)
        </button>

        <div className="slot-paytable">
          <h3>💰 Paytable</h3>
          <div className="paytable-grid">
            <div className="paytable-item">7️⃣7️⃣7️⃣ → 100 ⭐</div>
            <div className="paytable-item">⭐⭐⭐ → 100 💎</div>
            <div className="paytable-item">💎💎💎 → 50 ⭐</div>
            <div className="paytable-item">🍇🍇🍇 → 20 ⭐</div>
            <div className="paytable-item">🍊🍊🍊 → 10 ⭐</div>
            <div className="paytable-item">🍋🍋🍋 → 8 ⭐</div>
            <div className="paytable-item">🍒🍒🍒 → 5 ⭐</div>
            <div className="paytable-item">Any Pair → 3 ⭐</div>
          </div>
        </div>

        {showBuyModal && (
          <div className="buy-modal">
            <div className="buy-modal-content">
              <h3>Purchase Spins</h3>
              <p>Buy {SPINS_PER_PURCHASE} spins for {COST_PER_SPIN} Telegram Stars?</p>
              <div className="buy-modal-buttons">
                <button onClick={buySpins} disabled={purchasing}>
                  {purchasing ? 'Processing...' : 'Confirm'}
                </button>
                <button onClick={() => setShowBuyModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SlotMachine;
