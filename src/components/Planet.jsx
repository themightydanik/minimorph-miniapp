// src/components/Planet.jsx
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { processReferralRewards } from "./referralRewards";
import { X, Shirt, Check } from "lucide-react";
import DailyStreakModal from "./DailyStreakModal";
import "./Planet.css";
import "./SkinModal.css";

// ===== КОНСТАНТЫ =====
const getLevelInfo = (points) => {
  let level = 1;
  let nextLevelPoints = 1000;

  if (points >= 5000000) {
    level = 8;
    nextLevelPoints = 17000000;
  } else if (points >= 1000000) {
    level = 7;
    nextLevelPoints = 5000000;
  } else if (points >= 500000) {
    level = 6;
    nextLevelPoints = 1000000;
  } else if (points >= 100000) {
    level = 5;
    nextLevelPoints = 500000;
  } else if (points >= 50000) {
    level = 4;
    nextLevelPoints = 250000;
  } else if (points >= 5000) {
    level = 3;
    nextLevelPoints = 10000;
  } else if (points >= 1000) {
    level = 2;
    nextLevelPoints = 5000;
  }

  return { level, nextLevelPoints };
};

const getMinimorphImageByLevel = (level) => {
  switch(level) {
    case 1: return "/minimorph-icon.png";
    case 2: return "/minimorph-icon1-min.png";
    case 3: return "/minimorph-icon3-min.png";
    case 4: return "/minimorph-icon4-min.png";
    case 5: return "/minimorph-icon5-min.png";
    case 6: return "/minimorph-icon6.png";
    case 7: return "/minimorph-icon5-min.png";
    case 8: return "/minimorph-icon5-min.png";
    default: return "/minimorph-icon.png";
  }
};

const SKINS = [
  { id: "default", name: "Starter", description: "Your first Minimorph skin.", levelRequired: 1, price: 0, image: "/minimorph-icon.png" },
  { id: "rookie", name: "Rookie", description: "Minimorph at the beginning of his journey. Required level: 2", levelRequired: 2, price: 0, image: "/minimorph-icon1-min.png" },
  { id: "racing", name: "Racer", description: "Formula 1 is coming, Minima chip already used in McLaren racing cars. Required level: 3", levelRequired: 3, price: 0, image: "/minimorph-icon3-min.png" },
  { id: "rebel", name: "Tech Rebel", description: "You are getting closer to the big leagues. Required level: 4", levelRequired: 4, price: 0, image: "/minimorph-icon4-min.png" },
  { id: "rockstar", name: "Rockstar", description: "Play by your own rules - take what's yours. Required level: 5", levelRequired: 5, price: 0, image: "/minimorph-icon5-min.png" },
  { id: "fighter", name: "Fighter", description: "Notorious Paw. You've come a long way, but it's not time to relax. Required level: 6", levelRequired: 6, price: 0, image: "/minimorph-icon6.png" },
  { id: "excelsior", name: "Excelsior", description: "Welcome to the big leagues. Required level: 7", levelRequired: 7, price: 0, image: "/minimorph-icon8-min.png" },
];

const normalizeId = (id) => id?.toString().replace(/^_+/, "");

// ===== ГЛАВНЫЙ КОМПОНЕНТ =====
function Planet() {
  // === User Data ===
  const [telegramId, setTelegramId] = useState("demo");
  const [username, setUsername] = useState("Player");
  
  // === Balances (новая структура) ===
  const [balances, setBalances] = useState({
    credits: 0,      // Заменяет points
    energy: 60,
    morph: 0         // Premium валюта
  });
  
  // === Colony Data ===
  const [colony, setColony] = useState({
    level: 1,
    population: 0,   // Заменяет TPS!
    income: 0,       // Credits/hour от buildings
    lastCollected: null
  });
  
  // === UI State ===
  const [level, setLevel] = useState(1);
  const [minimorphImage, setMinimorphImage] = useState("/minimorph-icon.png");
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]);
  const [currentSkin, setCurrentSkin] = useState(SKINS[0]);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [canCollect, setCanCollect] = useState(false);
  const [accumulatedIncome, setAccumulatedIncome] = useState(0);

  const balancesRef = useRef(balances);
  const colonyRef = useRef(colony);

  // ===== ИНИЦИАЛИЗАЦИЯ TELEGRAM =====
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = normalizeId(user.id);
    setTelegramId(uid);
    setUsername(user?.username || user?.first_name || "Player");
  }, []);

  // ===== СИНХРОНИЗАЦИЯ REFS =====
  useEffect(() => {
    balancesRef.current = balances;
  }, [balances]);

  useEffect(() => {
    colonyRef.current = colony;
  }, [colony]);

  // ===== ЗАГРУЗКА ДАННЫХ =====
  useEffect(() => {
    if (!telegramId || telegramId === "demo") return;

    const loadUserData = async () => {
      try {
        const userRef = doc(db, "users", telegramId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();

          // Миграция старой структуры → новую
          const migratedBalances = {
            credits: data.balances?.credits ?? data.points ?? 0,
            energy: data.balances?.energy ?? data.energy ?? 60,
            morph: data.balances?.morph ?? data.minimaCoins ?? 0
          };

          const migratedColony = {
            level: data.colony?.level ?? 1,
            population: data.colony?.population ?? (data.tps ?? 0),
            income: data.colony?.income ?? 0,
            lastCollected: data.colony?.lastCollected ?? null
          };

          setBalances(migratedBalances);
          setColony(migratedColony);

          // Level calculation
          const { level: calcLevel } = getLevelInfo(migratedBalances.credits);
          const finalLevel = Math.max(calcLevel, data.level || 1);
          setLevel(finalLevel);
          setMinimorphImage(getMinimorphImageByLevel(finalLevel));

          // Skin
          if (data.skin) {
            const foundSkin = SKINS.find((s) => s.id === data.skin);
            if (foundSkin) {
              setCurrentSkin(foundSkin);
              setSelectedSkin(foundSkin);
            }
          }

          // Проверка Daily Streak
          checkDailyStreak(data);

          // Рассчитать накопленный income
          calculateAccumulatedIncome(migratedColony);

        } else {
          await initializeNewUser();
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [telegramId]);

  // ===== ПРОВЕРКА DAILY STREAK =====
  const checkDailyStreak = (userData) => {
    const lastVisitDate = userData.lastStreakDate 
      ? new Date(userData.lastStreakDate.seconds * 1000) 
      : null;
    
    if (!lastVisitDate) {
      setShowStreakModal(true);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastVisit = new Date(lastVisitDate);
    lastVisit.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 1) {
      setShowStreakModal(true);
    }
  };

  // ===== РАСЧЕТ НАКОПЛЕННОГО ДОХОДА =====
  const calculateAccumulatedIncome = (colonyData) => {
    if (!colonyData.lastCollected || colonyData.income === 0) {
      setCanCollect(false);
      setAccumulatedIncome(0);
      return;
    }

    const now = Date.now();
    const lastCollected = typeof colonyData.lastCollected === 'number' 
      ? colonyData.lastCollected 
      : colonyData.lastCollected.seconds * 1000;
    
    const hoursPassed = (now - lastCollected) / (1000 * 60 * 60);
    const maxHours = 8; // Максимум 8 часов накопления
    const effectiveHours = Math.min(hoursPassed, maxHours);
    
    const accumulated = Math.floor(effectiveHours * colonyData.income);
    
    setAccumulatedIncome(accumulated);
    setCanCollect(accumulated > 0);
  };

  // ===== ОБНОВЛЕНИЕ НАКОПЛЕННОГО ДОХОДА КАЖДУЮ МИНУТУ =====
  useEffect(() => {
    const interval = setInterval(() => {
      if (colony.income > 0 && colony.lastCollected) {
        calculateAccumulatedIncome(colony);
      }
    }, 60000); // Каждую минуту

    return () => clearInterval(interval);
  }, [colony]);

  // ===== ВОССТАНОВЛЕНИЕ ЭНЕРГИИ =====
  useEffect(() => {
    const interval = setInterval(() => {
      setBalances((prev) => {
        if (prev.energy < 60) {
          const newEnergy = Math.min(60, prev.energy + 3);
          saveToFirebase({ 'balances.energy': newEnergy });
          return { ...prev, energy: newEnergy };
        }
        return prev;
      });
    }, 15000); // Каждые 15 секунд

    return () => clearInterval(interval);
  }, []);

  // ===== ИНИЦИАЛИЗАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ =====
  const initializeNewUser = async () => {
    const userRef = doc(db, "users", telegramId);
    const newUserData = {
      username,
      balances: {
        credits: 100,
        energy: 60,
        morph: 0
      },
      colony: {
        level: 1,
        population: 0,
        income: 0,
        buildings: {
          mine: { level: 0 },
          lab: { level: 0 },
          habitat: { level: 0 },
          core: { level: 1 }
        },
        lastCollected: null
      },
      level: 1,
      tickets: 7,
      skin: SKINS[0].id,
      telegramStars: 0,
      minimaCoins: 0,
      currentStreak: 0,
      lastStreakDate: null,
      maxStreak: 0,
      slotSpins: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(userRef, newUserData, { merge: true });
    setBalances(newUserData.balances);
    setColony(newUserData.colony);
  };

  // ===== СОХРАНЕНИЕ В FIREBASE =====
  const saveToFirebase = async (updates) => {
    if (!telegramId || telegramId === "demo") return;

    try {
      const userRef = doc(db, "users", telegramId);
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error saving to Firebase:", error);
    }
  };

  // ===== СБОР НАКОПЛЕННОГО ДОХОДА =====
  const collectIncome = async () => {
    if (!canCollect || accumulatedIncome === 0) return;

    const newCredits = balances.credits + accumulatedIncome;
    const now = Date.now();

    setBalances(prev => ({ ...prev, credits: newCredits }));
    setColony(prev => ({ ...prev, lastCollected: now }));
    setAccumulatedIncome(0);
    setCanCollect(false);

    await saveToFirebase({
      'balances.credits': newCredits,
      'colony.lastCollected': now
    });

    // Проверка level up
    const { level: calcLevel } = getLevelInfo(newCredits);
    if (calcLevel > level) {
      setLevel(calcLevel);
      setMinimorphImage(getMinimorphImageByLevel(calcLevel));
      await saveToFirebase({ level: calcLevel });
    }
  };

  // ===== ОБРАБОТЧИК REWARDS ОТ STREAK =====
  const handleStreakReward = (reward) => {
    setBalances(prev => ({
      ...prev,
      credits: prev.credits + reward.points,
      morph: prev.morph + (reward.minima || 0)
    }));
  };

  // ===== ВИЗУАЛ ПОПУЛЯЦИИ =====
  const getPopulationVisual = () => {
    const pop = colony.population;
    let count = 0;
    
    if (pop >= 100) count = 20;
    else if (pop >= 50) count = 15;
    else if (pop >= 20) count = 10;
    else if (pop >= 10) count = 5;
    else if (pop >= 5) count = 3;
    else if (pop >= 1) count = 1;

    return Array.from({ length: count }, (_, i) => (
      <div 
        key={i} 
        className="minimorph-citizen"
        style={{
          left: `${Math.random() * 80 + 10}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${3 + Math.random() * 2}s`
        }}
      >
        👤
      </div>
    ));
  };

  // ===== RENDER =====
  const { level: calculatedLevel, nextLevelPoints } = getLevelInfo(balances.credits);
  const progressToNextLevel = Math.min((balances.credits / nextLevelPoints) * 100, 100);

  return (
    <div className="planet-container">
      {/* === HEADER === */}
      <div className="planet-header">
        <div className="welcome-badge">
          Welcome, {username}!
        </div>
        <div className="level-badge">
          Level {level}
        </div>
      </div>

      {/* === PLANET VISUAL === */}
      <div className="planet-visual">
        <div className="planet-sphere">
          <img 
            src={currentSkin?.image || minimorphImage}
            alt={`Minimorph Level ${level}`}
            className="planet-minimorph"
          />
          
          {/* Population визуал */}
          <div className="population-overlay">
            {getPopulationVisual()}
          </div>
        </div>

        {/* Orbital Stats */}
        <div className="orbital-stats">
          <div className="stat-orb credits" title="Credits">
            <img src="/coin-icon.png" alt="Credits" />
            <span>{balances.credits.toLocaleString()}</span>
          </div>
          <div className="stat-orb energy" title="Energy">
            <img src="/energy-icon.png" alt="Energy" />
            <span>{balances.energy}/60</span>
          </div>
          <div className="stat-orb morph" title="MORPH Tokens">
            💎
            <span>{balances.morph}</span>
          </div>
        </div>

        {/* Skin Button */}
        <button onClick={() => setShowSkinModal(true)} className="skin-open-btn">
          <Shirt size={20} />
        </button>
      </div>

      {/* === POPULATION STATS === */}
      <div className="population-panel">
        <h3>🌍 Colony Population</h3>
        <div className="population-big">
          {colony.population.toLocaleString()}
        </div>
        <p className="population-hint">
          Increase population through Colony buildings
        </p>
      </div>

      {/* === PRODUCTION PANEL === */}
      <div className="production-panel">
        <h3>⚙️ Resource Production</h3>
        <div className="income-display">
          <div className="income-rate">
            +{colony.income} Credits/hour
          </div>
          {accumulatedIncome > 0 && (
            <div className="accumulated-badge">
              {accumulatedIncome} ready to collect
            </div>
          )}
        </div>
        <button 
          className="collect-btn"
          onClick={collectIncome}
          disabled={!canCollect}
        >
          {canCollect ? `Collect ${accumulatedIncome} 💰` : 'No resources yet'}
        </button>
      </div>

      {/* === PROGRESS BAR === */}
      <div className="level-progress">
        <div className="progress-label">
          Level {level} → {level + 1}
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressToNextLevel}%` }}
          />
        </div>
        <div className="progress-numbers">
          {balances.credits.toLocaleString()} / {nextLevelPoints.toLocaleString()}
        </div>
      </div>

      {/* === QUICK ACTIONS === */}
      <div className="quick-actions">
        <a href="/missions" className="action-card">
          <div className="action-icon">🚀</div>
          <div className="action-title">Explore</div>
          <div className="action-desc">Complete missions</div>
        </a>

        <a href="/colony" className="action-card">
          <div className="action-icon">🏗️</div>
          <div className="action-title">Build</div>
          <div className="action-desc">Upgrade buildings</div>
        </a>

        <a href="/locations" className="action-card">
          <div className="action-icon">💱</div>
          <div className="action-title">Trade</div>
          <div className="action-desc">Visit locations</div>
        </a>
      </div>

      {/* === MODALS === */}
      {showStreakModal && (
        <DailyStreakModal
          telegramId={telegramId}
          onClose={() => setShowStreakModal(false)}
          onRewardClaimed={handleStreakReward}
        />
      )}

      {showSkinModal && (
        <div className="skin-modal-backdrop">
          <div className="skin-modal">
            <button onClick={() => setShowSkinModal(false)} className="skin-modal-close">
              <X size={24} />
            </button>
            <div className="skin-modal-left">
              <img src={selectedSkin.image} alt={selectedSkin.name} />
              <h2>{selectedSkin.name}</h2>
              <p>{selectedSkin.description}</p>
              <button
                onClick={async () => {
                  if (selectedSkin.levelRequired > level) {
                    alert(`❌ This skin requires level ${selectedSkin.levelRequired}`);
                    return;
                  }
                  setCurrentSkin(selectedSkin);
                  await saveToFirebase({ skin: selectedSkin.id });
                  setShowSkinModal(false);
                }}
              >
                Choose
              </button>
            </div>
            <div className="skin-modal-right">
              {SKINS.map((skin) => (
                <div
                  key={skin.id}
                  onClick={() => setSelectedSkin(skin)}
                  className={`skin-card ${selectedSkin.id === skin.id ? 'skin-card-selected' : ''}`}
                >
                  <img src={skin.image} alt={skin.name} className="skin-card-image" />
                  <p className="skin-card-name">{skin.name}</p>
                  {currentSkin.id === skin.id && <Check className="skin-card-check" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Planet;
