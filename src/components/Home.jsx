// components/Home.jsx
import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { X, Shirt, Check } from "lucide-react";
import DailyStreakModal from "./DailyStreakModal";
import SlotMachine from "./SlotMachine";
import "./SkinModal.css";

// === Константы ===
const getLevelInfo = (points) => {
  const levels = [
    { level: 1, minPoints: 0, nextPoints: 1000 },
    { level: 2, minPoints: 1000, nextPoints: 5000 },
    { level: 3, minPoints: 5000, nextPoints: 10000 },
    { level: 4, minPoints: 10000, nextPoints: 50000 },
    { level: 5, minPoints: 50000, nextPoints: 100000 },
    { level: 6, minPoints: 100000, nextPoints: 500000 },
    { level: 7, minPoints: 500000, nextPoints: 1000000 },
    { level: 8, minPoints: 1000000, nextPoints: 5000000 },
    { level: 9, minPoints: 5000000, nextPoints: 17000000 }
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].minPoints) {
      return { level: levels[i].level, nextLevelPoints: levels[i].nextPoints };
    }
  }
  return { level: 1, nextLevelPoints: 1000 };
};

const getMinimorphImageByLevel = (level) => {
  const images = {
    1: "/minimorph-icon.png",
    2: "/minimorph-icon1-min.png",
    3: "/minimorph-icon3-min.png",
    4: "/minimorph-icon4-min.png",
    5: "/minimorph-icon5-min.png",
    6: "/minimorph-icon6.png",
    7: "/minimorph-icon8-min.png"
  };
  return images[level] || images[1];
};

const SKINS = [
  { id: "default", name: "Starter", description: "Your first Minimorph skin.", levelRequired: 1, image: "/minimorph-icon.png" },
  { id: "rookie", name: "Rookie", description: "Minimorph at the beginning.", levelRequired: 2, image: "/minimorph-icon1-min.png" },
  { id: "racing", name: "Racer", description: "Formula 1 ready!", levelRequired: 3, image: "/minimorph-icon3-min.png" },
  { id: "rebel", name: "Tech Rebel", description: "Getting closer to big leagues.", levelRequired: 4, image: "/minimorph-icon4-min.png" },
  { id: "rockstar", name: "Rockstar", description: "Play by your own rules.", levelRequired: 5, image: "/minimorph-icon5-min.png" },
  { id: "fighter", name: "Fighter", description: "You've come a long way.", levelRequired: 6, image: "/minimorph-icon6.png" },
  { id: "excelsior", name: "Excelsior", description: "Welcome to the big leagues.", levelRequired: 7, image: "/minimorph-icon8-min.png" }
];

const normalizeId = (id) => id?.toString().replace(/^_+/, "");

function Home() {
  // === States ===
  const [telegramId, setTelegramId] = useState("demo");
  const [username, setUsername] = useState("Player");
  const [points, setPoints] = useState(0);
  const [tps, setTps] = useState(0);
  const [energy, setEnergy] = useState(60);
  const [tickets, setTickets] = useState(5);
  const [level, setLevel] = useState(1);
  const [minimorphImage, setMinimorphImage] = useState("/minimorph-icon.png");
  
  // Новые балансы
  const [telegramStars, setTelegramStars] = useState(0);
  const [minimaCoins, setMinimaCoins] = useState(0);
  
  // UI состояния
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]);
  const [currentSkin, setCurrentSkin] = useState(SKINS[0]);
  const [showDailyStreak, setShowDailyStreak] = useState(false);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  
  // Фарминг
  const [farmActive, setFarmActive] = useState(false);
  const [farmStartTime, setFarmStartTime] = useState(null);
  const farmCountdownRef = useRef("");
  
  const pointsRef = useRef(points);

  // === Инициализация Telegram ===
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = normalizeId(user.id);
    setTelegramId(uid);
    setUsername(user?.username || user?.first_name || "Player");
  }, []);

  // === Загрузка данных пользователя ===
  useEffect(() => {
    if (!telegramId || telegramId === "demo") return;
    
    const loadUserData = async () => {
      try {
        const userRef = doc(db, "users", telegramId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          
          setPoints(data.points || 0);
          setTps(data.tps || 0);
          setEnergy(data.energy || 60);
          setTickets(data.tickets || 5);
          setTelegramStars(data.telegramStars || 0);
          setMinimaCoins(data.minimaCoins || 0);
          
          const { level: calcLevel } = getLevelInfo(data.points || 0);
          const finalLevel = Math.max(calcLevel, data.level || 1);
          setLevel(finalLevel);
          setMinimorphImage(getMinimorphImageByLevel(finalLevel));

          // Загрузка скина
          if (data.skin) {
            const foundSkin = SKINS.find(s => s.id === data.skin);
            if (foundSkin) {
              setCurrentSkin(foundSkin);
              setSelectedSkin(foundSkin);
            }
          }

          // Проверка Daily Streak
          checkDailyStreak(data);
        } else {
          // Создание нового пользователя
          await initializeNewUser();
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [telegramId]);

  // === Инициализация нового пользователя ===
  const initializeNewUser = async () => {
    const userRef = doc(db, "users", telegramId);
    const newUserData = {
      username,
      points: 100,
      level: 1,
      tickets: 7,
      energy: 60,
      tps: 0,
      telegramStars: 0,
      minimaCoins: 0,
      slotSpins: 0,
      slotTotalSpins: 0,
      slotWins: 0,
      slotTotalEarned: 0,
      currentStreak: 0,
      lastStreakDate: null,
      skin: SKINS[0].id,
      createdAt: serverTimestamp()
    };

    await setDoc(userRef, newUserData, { merge: true });
    setPoints(newUserData.points);
    setTickets(newUserData.tickets);
    setShowDailyStreak(true); // Показываем приветственную награду
  };

  // === Проверка Daily Streak ===
  const checkDailyStreak = (userData) => {
    const lastVisitDate = userData.lastStreakDate 
      ? new Date(userData.lastStreakDate.seconds * 1000) 
      : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!lastVisitDate) {
      setShowDailyStreak(true);
      return;
    }

    const lastVisit = new Date(lastVisitDate);
    lastVisit.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 1) {
      setShowDailyStreak(true);
    }
  };

  // === Восстановление энергии ===
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => {
        if (prev < 60) {
          const newEnergy = Math.min(60, prev + 3);
          saveToFirebase({ energy: newEnergy });
          return newEnergy;
        }
        return prev;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // === Обработчик тапа ===
  const handleTap = async () => {
    if (energy <= 0) {
      alert("Energy depleted! Wait or recharge.");
      return;
    }

    const newPoints = points + 1;
    const newEnergy = energy - 1;
    setPoints(newPoints);
    setEnergy(newEnergy);

    const { level: calcLevel } = getLevelInfo(newPoints);
    if (calcLevel > level) {
      setLevel(calcLevel);
      setMinimorphImage(getMinimorphImageByLevel(calcLevel));
      await saveToFirebase({ points: newPoints, energy: newEnergy, level: calcLevel });
    } else {
      await saveToFirebase({ points: newPoints, energy: newEnergy });
    }
  };

  // === Сохранение в Firebase ===
  const saveToFirebase = async (updates) => {
    if (!telegramId || telegramId === "demo") return;
    
    try {
      const userRef = doc(db, "users", telegramId);
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error saving to Firebase:", error);
    }
  };

  // === Фарминг ===
  const activateFarming = async () => {
    if (farmActive) return;
    
    const now = Date.now();
    setFarmActive(true);
    setFarmStartTime(now);
    
    await saveToFirebase({ 
      farmActive: true, 
      farmStartTime: now 
    });
  };

  // === Рендер ===
  const { level: calculatedLevel, nextLevelPoints } = getLevelInfo(points);
  const progressToNextLevel = Math.min((points / nextLevelPoints) * 100, 100);

  return (
    <div style={{ 
      padding: "30px 20px 80px 20px",
      backgroundImage: `url('/TG-miniapp_bg.jpg')`,
      backgroundSize: 'cover',
      minHeight: "100vh",
      boxSizing: "border-box"
    }}>
      {/* Приветствие и баланс */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
        <h1 style={{ 
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(5px)',
          borderRadius: "10px",
          color: "#fff",
          padding: "8px 12px",
          fontSize: "15px",
          margin: 0,
          maxWidth: "165px"
        }}>
          Welcome, {username}!
        </h1>

        <button
          onClick={() => setShowSlotMachine(true)}
          style={{
            padding: "10px 14px",
            backgroundColor: "#9c27b0",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          🎰 Slots
        </button>
      </div>

      {/* Баланс и TPS */}
      <div style={{ marginBottom: "20px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          <img src="/coin-icon.png" alt="Coin" style={{ width: "30px", marginRight: "8px" }} />
          <h2 style={{ fontSize: "18px", margin: 0 }}>{points} Points</h2>
        </div>
        <div style={{ fontSize: "14px" }}>
          🔁 TPS: <strong>{tps}</strong> | 
          ⭐ Stars: <strong>{telegramStars}</strong> | 
          💎 Minima: <strong>{minimaCoins}</strong>
        </div>
      </div>

      {/* Тапалка */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          onClick={handleTap}
          style={{
            width: "250px",
            height: "250px",
            borderRadius: "50%",
            cursor: "pointer",
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <img
            src={currentSkin?.image || minimorphImage}
            alt="Minimorph"
            style={{ width: "170px", height: "210px" }}
          />
        </button>
      </div>

      {/* Кнопка выбора скина */}
      <button
        onClick={() => setShowSkinModal(true)}
        className="skin-open-btn"
      >
        <Shirt size={20} />
      </button>

      {/* Энергия и билеты */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ background: "#0f3f6f", color: "#fff", borderRadius: 12, padding: "10px", flex: 1, marginRight: "10px" }}>
          ⚡ Energy: {energy} / 60
        </div>
        <div style={{ background: "#0f3f6f", color: "#fff", borderRadius: 12, padding: "10px", flex: 1 }}>
          🎟 Tickets: {tickets}
        </div>
      </div>

      {/* Уровень */}
      <div style={{ marginBottom: "20px", color: "#fff" }}>
        <strong>Level {level}</strong>
        <div style={{ backgroundColor: "#eee", height: "10px", borderRadius: "5px", overflow: "hidden", marginTop: "5px" }}>
          <div style={{ backgroundColor: "#4caf50", width: `${progressToNextLevel}%`, height: "100%" }} />
        </div>
      </div>

      {/* Фарминг */}
      {!farmActive ? (
        <button
          onClick={activateFarming}
          style={{
            width: "100%",
            padding: "15px",
            backgroundColor: "#ffa800",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          🚀 Activate Auto-Farming
        </button>
      ) : (
        <div style={{
          padding: "15px",
          backgroundColor: "#6c757d",
          color: "#fff",
          borderRadius: "10px",
          textAlign: "center"
        }}>
          ⏳ Farming Active
        </div>
      )}

      {/* Модалки */}
      {showDailyStreak && (
        <DailyStreakModal
          telegramId={telegramId}
          onClose={() => setShowDailyStreak(false)}
          onRewardClaimed={(reward) => {
            setPoints(prev => prev + reward.points);
            if (reward.stars > 0) setTelegramStars(prev => prev + reward.stars);
            if (reward.minima > 0) setMinimaCoins(prev => prev + reward.minima);
          }}
        />
      )}

      {showSlotMachine && (
        <SlotMachine
          telegramId={telegramId}
          onClose={() => setShowSlotMachine(false)}
        />
      )}

      {/* Модалка скинов (упрощённая версия) */}
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
                    alert(`Requires level ${selectedSkin.levelRequired}`);
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
                  className={`skin-card ${selectedSkin.id === skin.id ? "skin-card-selected" : ""}`}
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

export default Home;
