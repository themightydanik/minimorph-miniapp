// components/SlotMachine.jsx
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import './SlotMachine.css';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '7️⃣'];

const SYMBOL_WEIGHTS = {
  '🍒': 30,
  '🍋': 25,
  '🍊': 20,
  '🍇': 15,
  '💎': 7,
  '⭐': 2,
  '7️⃣': 1
};

const PAYOUTS = {
  '7️⃣-7️⃣-7️⃣': { stars: 100, minima: 0, type: 'jackpot', multiplier: 100 },
  '⭐-⭐-⭐': { stars: 0, minima: 100, type: 'jackpot', multiplier: 100 },
  '💎-💎-💎': { stars: 50, minima: 0, type: 'big_win', multiplier: 50 },
  '🍇-🍇-🍇': { stars: 20, minima: 0, type: 'big_win', multiplier: 20 },
  '🍊-🍊-🍊': { stars: 10, minima: 0, type: 'win', multiplier: 10 },
  '🍋-🍋-🍋': { stars: 8, minima: 0, type: 'win', multiplier: 8 },
  '🍒-🍒-🍒': { stars: 5, minima: 0, type: 'win', multiplier: 5 },
  'pair': { stars: 3, minima: 0, type: 'small_win', multiplier: 3 }
};

const COST_PER_SPIN = 1; // 1 Star для тестирования
const SPINS_PER_PURCHASE = 3;

function SlotMachine({ telegramId, onClose }) {
  const [reels, setReels] = useState([
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[1], SYMBOLS[2], SYMBOLS[3]],
    [SYMBOLS[2], SYMBOLS[3], SYMBOLS[4]]
  ]);
  
  const [spinning, setSpinning] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [leverPulled, setLeverPulled] = useState(false);
  const [coins, setCoins] = useState([]);
  const [stats, setStats] = useState({
    totalSpins: 0,
    wins: 0,
    totalEarned: 0,
    jackpots: 0
  });

  const reelRefs = [useRef(), useRef(), useRef()];
  const leverRef = useRef();

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
          totalEarned: data.slotTotalEarned || 0,
          jackpots: data.slotJackpots || 0
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
    
    if (PAYOUTS[key]) return PAYOUTS[key];
    if (a === b || b === c || a === c) return PAYOUTS.pair;
    
    return null;
  };

  const createCoinExplosion = (count = 20) => {
    const newCoins = [];
    for (let i = 0; i < count; i++) {
      newCoins.push({
        id: Date.now() + i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5
      });
    }
    setCoins(newCoins);
    setTimeout(() => setCoins([]), 2000);
  };

  const spin = async () => {
    if (spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setLeverPulled(true);
    setResult(null);

    // Анимация рычага
    setTimeout(() => setLeverPulled(false), 500);

    // Генерируем результат для каждого барабана
    const finalSymbols = [
      getWeightedSymbol(),
      getWeightedSymbol(),
      getWeightedSymbol()
    ];

    // Останавливаем барабаны поочередно
    const stopDelays = [2000, 2500, 3000];
    
    stopDelays.forEach((delay, index) => {
      setTimeout(() => {
        setReels(prev => {
          const newReels = [...prev];
          newReels[index] = [finalSymbols[index], finalSymbols[index], finalSymbols[index]];
          return newReels;
        });
      }, delay);
    });

    // Обработка результата после остановки всех барабанов
    setTimeout(() => {
      processResult(finalSymbols);
    }, 3500);
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
        
        // Анимация монет
        if (win.type === 'jackpot') {
          createCoinExplosion(50);
          updates.slotJackpots = increment(1);
        } else if (win.type === 'big_win') {
          createCoinExplosion(30);
          updates.slotBigWins = increment(1);
        } else {
          createCoinExplosion(10);
        }
        
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
          totalEarned: prev.totalEarned + (win.stars || 0),
          jackpots: win.type === 'jackpot' ? prev.jackpots + 1 : prev.jackpots
        }));
      } else {
        setResult({ type: 'lose' });
      }

      setStats(prev => ({ ...prev, totalSpins: prev.totalSpins + 1 }));
      await updateDoc(userRef, updates);
      setSpinsLeft(prev => prev - 1);

    } catch (error) {
      console.error('Error processing result:', error);
    }

    setSpinning(false);
  };

  const buySpins = async () => {
    try {
      const tg = window.Telegram?.WebApp;
      
      if (!tg) {
        alert('Telegram WebApp not available');
        return;
      }

      // Создаём уникальный payload для отслеживания платежа
      const payload = `slot_purchase_${telegramId}_${Date.now()}`;

      // Создаём инвойс для Telegram Stars
      const invoice = {
        title: `Buy ${SPINS_PER_PURCHASE} Slot Spins`,
        description: `Get ${SPINS_PER_PURCHASE} spins for the slot machine`,
        payload: payload,
        provider_token: '', // Для Telegram Stars оставляем пустым
        currency: 'XTR',
        prices: [{
          label: `${SPINS_PER_PURCHASE} Spins`,
          amount: COST_PER_SPIN
        }]
      };

      // Отправляем инвойс (это должно открыть окно оплаты в Telegram)
      tg.openInvoice(invoice, async (status) => {
        if (status === 'paid') {
          // Платёж успешен - обновляем количество спинов
          const userRef = doc(db, 'users', telegramId.toString());
          await updateDoc(userRef, {
            slotSpins: increment(SPINS_PER_PURCHASE)
          });

          setSpinsLeft(prev => prev + SPINS_PER_PURCHASE);
          tg.showAlert(`✅ Successfully purchased ${SPINS_PER_PURCHASE} spins!`);
        } else if (status === 'cancelled') {
          tg.showAlert('❌ Purchase cancelled');
        } else if (status === 'failed') {
          tg.showAlert('❌ Purchase failed. Please try again.');
        }
      });

    } catch (error) {
      console.error('Error buying spins:', error);
      alert('❌ Purchase failed. Please try again.');
    }
  };

  return (
    <div className="slot-overlay">
      <div className="slot-machine-container">
        <button className="slot-close-btn" onClick={onClose}>✕</button>

        {/* Неоновая вывеска */}
        <div className="neon-sign">
          <span className="neon-text">JACKPOT</span>
          <span className="neon-glow"></span>
        </div>

        {/* Статистика */}
        <div className="slot-stats-panel">
          <div className="stat-box">
            <div className="stat-value">{spinsLeft}</div>
            <div className="stat-label">Spins</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">⭐ {stats.totalEarned}</div>
            <div className="stat-label">Won</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.jackpots}</div>
            <div className="stat-label">Jackpots</div>
          </div>
        </div>

        {/* Главный корпус автомата */}
        <div className="slot-body">
          {/* Декоративные лампочки */}
          <div className="lights-row top">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="light" style={{ animationDelay: `${i * 0.1}s` }}></div>
            ))}
          </div>

          {/* Экран с барабанами */}
          <div className="slot-screen">
            <div className="screen-glow"></div>
            
            {reels.map((reel, reelIndex) => (
              <div key={reelIndex} className="reel-container">
                <div className={`reel ${spinning ? 'spinning' : ''}`}>
                  {spinning ? (
                    // Во время вращения показываем много символов
                    SYMBOLS.concat(SYMBOLS).concat(SYMBOLS).map((symbol, idx) => (
                      <div key={idx} className="symbol spinning-symbol">
                        {symbol}
                      </div>
                    ))
                  ) : (
                    // После остановки показываем результат
                    <div className="symbol final-symbol">
                      {reel[0]}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Линия выигрыша */}
            <div className="payline"></div>
          </div>

          {/* Декоративные лампочки снизу */}
          <div className="lights-row bottom">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="light" style={{ animationDelay: `${i * 0.1}s` }}></div>
            ))}
          </div>

          {/* Панель результата */}
          {result && (
            <div className={`result-panel ${result.type}`}>
              {result.type === 'lose' && <span>Try Again! 🎰</span>}
              {result.type === 'small_win' && <span>Nice! +{result.stars} ⭐</span>}
              {result.type === 'win' && <span>WIN! +{result.stars} ⭐</span>}
              {result.type === 'big_win' && (
                <span className="big-win-text">BIG WIN! +{result.stars} ⭐</span>
              )}
              {result.type === 'jackpot' && (
                <span className="jackpot-text">
                  🎊 JACKPOT! 🎊
                  <br />
                  {result.stars > 0 && `+${result.stars} ⭐`}
                  {result.minima > 0 && `+${result.minima} 💎`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Рычаг */}
        <div 
          ref={leverRef}
          className={`lever ${leverPulled ? 'pulled' : ''}`}
          onClick={spin}
        >
          <div className="lever-handle">
            <div className="lever-ball"></div>
            <div className="lever-rod"></div>
          </div>
          {!spinning && spinsLeft > 0 && (
            <div className="lever-hint">PULL!</div>
          )}
        </div>

        {/* Кнопка покупки */}
        <button className="buy-spins-btn" onClick={buySpins}>
          <span className="btn-icon">💳</span>
          <span className="btn-text">
            Buy {SPINS_PER_PURCHASE} Spins
            <br />
            <small>({COST_PER_SPIN} ⭐)</small>
          </span>
        </button>

        {/* Таблица выплат */}
        <div className="paytable">
          <div className="paytable-title">💰 PAYTABLE</div>
          <div className="paytable-items">
            <div className="paytable-row">7️⃣ 7️⃣ 7️⃣ → 100x ⭐</div>
            <div className="paytable-row">⭐ ⭐ ⭐ → 100 💎</div>
            <div className="paytable-row">💎 💎 💎 → 50x ⭐</div>
            <div className="paytable-row">🍇 🍇 🍇 → 20x ⭐</div>
            <div className="paytable-row">🍊 🍊 🍊 → 10x ⭐</div>
            <div className="paytable-row">🍋 🍋 🍋 → 8x ⭐</div>
            <div className="paytable-row">🍒 🍒 🍒 → 5x ⭐</div>
            <div className="paytable-row">Any Pair → 3x ⭐</div>
          </div>
        </div>

        {/* Анимация падающих монет */}
        {coins.map(coin => (
          <div
            key={coin.id}
            className="coin-fall"
            style={{
              left: `${coin.x}%`,
              animationDelay: `${coin.delay}s`
            }}
          >
            ⭐
          </div>
        ))}
      </div>
    </div>
  );
}

export default SlotMachine;
