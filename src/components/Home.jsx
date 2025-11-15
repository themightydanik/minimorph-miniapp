// components/Home.jsx - FIXED VERSION
import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { processReferralRewards } from "./referralRewards";
import { X, Shirt, Check } from "lucide-react";
import SlotMachinePremium from "./SlotMachinePremium";
import "./SkinModal.css";

// === Константы ===
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

const getCarByLevel = (level) => {
  switch (level) {
    case 3: return "Standard Car";
    case 5: return "Good Car";
    case 6: return "Comfort Car";
    case 7: return "Premium Car";
    case 8: return "Elite Car";
    default: return "Basic Car";
  }
};

const normalizeId = (id) => id?.toString().replace(/^_+/, "");

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

function Home() {
  // === Leaderboard ===
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [totalUsersCount, setTotalUsersCount] = useState(0);

  // === User Data ===
  const [telegramId, setTelegramId] = useState("demo");
  const [username, setUsername] = useState("Player");
  const [points, setPoints] = useState(0);
  const [tps, setTps] = useState(0);
  const [energy, setEnergy] = useState(60);
  const [tickets, setTickets] = useState(5);
  const [level, setLevel] = useState(1);
  const [minimorphImage, setMinimorphImage] = useState("/minimorph-icon.png");

  // === Skins ===
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]);
  const [currentSkin, setCurrentSkin] = useState(SKINS[0]);

  // === Slot Machine ===
  const [showSlotMachine, setShowSlotMachine] = useState(false);

  // === Farming ===
  const [farmActive, setFarmActive] = useState(false);
  const [farmStartTime, setFarmStartTime] = useState(null);
  const farmCountdownRef = useRef("");
  const [, forceUpdate] = useState(0);

  const pointsRef = useRef(points);
  const energyRef = useRef(energy);

  // === Инициализация Telegram ===
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = normalizeId(user.id);
    setTelegramId(uid);
    setUsername(user?.username || user?.first_name || "Player");
  }, []);

  // === Refs для актуальных значений ===
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

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

          const { level: calcLevel } = getLevelInfo(data.points || 0);
          const finalLevel = Math.max(calcLevel, data.level || 1);
          setLevel(finalLevel);
          setMinimorphImage(getMinimorphImageByLevel(finalLevel));

          if (data.skin) {
            const foundSkin = SKINS.find((s) => s.id === data.skin);
            if (foundSkin) {
              setCurrentSkin(foundSkin);
              setSelectedSkin(foundSkin);
            }
          }

          // Загрузка состояния фарминга
          if (data.farmActive && data.farmStartTime) {
            const savedTime = typeof data.farmStartTime === 'number' 
              ? data.farmStartTime 
              : data.farmStartTime.seconds * 1000;
            
            setFarmActive(true);
            setFarmStartTime(savedTime);
          }
        } else {
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
      skin: SKINS[0].id,
      createdAt: serverTimestamp(),
    };

    await setDoc(userRef, newUserData, { merge: true });
    setPoints(newUserData.points);
    setTickets(newUserData.tickets);
  };

  // === Восстановление энергии ===
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy((prev) => {
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

  // === Обработка фарминга ===
  useEffect(() => {
    if (!farmActive || !farmStartTime) return;

    const processFarming = async () => {
      const now = Date.now();
      const elapsedMs = now - farmStartTime;
      const maxDurationMs = 8 * 60 * 60 * 1000; // 8 часов

      const effectiveElapsed = Math.min(elapsedMs, maxDurationMs);
      const intervalsPassed = Math.floor(effectiveElapsed / 60000); // каждую минуту
      const coinsEarned = intervalsPassed * tps;

      const lastAwarded = Number(localStorage.getItem("lastAwarded")) || 0;
      const newCoins = coinsEarned - lastAwarded;

      if (newCoins > 0) {
        const updatedPoints = pointsRef.current + newCoins;
        setPoints(updatedPoints);
        pointsRef.current = updatedPoints;
        localStorage.setItem("lastAwarded", coinsEarned.toString());

        await saveToFirebase({ points: updatedPoints });
        console.log(`💰 Farming: +${newCoins} points`);
      }

      // Проверяем завершение
      if (elapsedMs >= maxDurationMs) {
        setFarmActive(false);
        setFarmStartTime(null);
        farmCountdownRef.current = "";
        localStorage.removeItem("farmActive");
        localStorage.removeItem("farmStartTime");
        localStorage.removeItem("lastAwarded");
        await saveToFirebase({ farmActive: false, farmStartTime: null });
        console.log("✅ Farming completed!");
      }
    };

    const interval = setInterval(processFarming, 30000);
    processFarming();

    return () => clearInterval(interval);
  }, [farmActive, farmStartTime, tps]);

  // === Обновление таймера фарминга ===
  useEffect(() => {
    if (!farmActive || !farmStartTime) return;

    const endTime = farmStartTime + 8 * 60 * 60 * 1000;

    const interval = setInterval(() => {
      const timeLeft = endTime - Date.now();

      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        const newVal = `${hours}h ${minutes}m ${seconds}s`;

        if (farmCountdownRef.current !== newVal) {
          farmCountdownRef.current = newVal;
          forceUpdate((x) => x + 1);
        }
      } else {
        setFarmActive(false);
        setFarmStartTime(null);
        farmCountdownRef.current = "";
        localStorage.removeItem("farmActive");
        localStorage.removeItem("farmStartTime");
        localStorage.removeItem("lastAwarded");
        saveToFirebase({ farmActive: false, farmStartTime: null });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [farmActive, farmStartTime]);

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

  // === Активация фарминга ===
  const activateFarming = async () => {
    if (farmActive) {
      alert("Farming is already active!");
      return;
    }

    const now = Date.now();
    setFarmActive(true);
    setFarmStartTime(now);

    localStorage.setItem("farmActive", "true");
    localStorage.setItem("farmStartTime", now.toString());
    localStorage.setItem("lastAwarded", "0");

    await saveToFirebase({
      farmActive: true,
      farmStartTime: now,
    });

    alert("Auto-farming activated for 8 hours! 🚀");
  };

  // === Рендер ===
  const { level: calculatedLevel, nextLevelPoints } = getLevelInfo(points);
  const car = getCarByLevel(level);
  const progressToNextLevel = Math.min((points / nextLevelPoints) * 100, 100);

  return (
    <div
      style={{
        padding: "30px 20px 80px 20px",
        backgroundImage: `url('/TG-miniapp_bg.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        width: "100vw",
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        overflow: "hidden",
      }}
    >
      {/* Приветствие и кнопки */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0",
          marginBottom: "15px",
          gap: "10px",
        }}
      >
        <h1
          style={{
            flexGrow: 1,
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.2)",
            boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            backdropFilter: "blur(5px)",
            color: "#fff",
            padding: "8px 12px",
            fontSize: "15px",
            lineHeight: 1.3,
            margin: 0,
            maxWidth: "165px",
          }}
        >
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
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🎰 Slots
        </button>
      </div>

      {/* Баланс монет и TPS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "10px",
          marginBottom: "15px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src="/coin-icon.png" alt="Coin" style={{ width: "30px", marginRight: "8px" }} />
          <h2 style={{ fontSize: "18px", margin: 0 }}>{points} Points</h2>
        </div>
        <div style={{ fontSize: "16px" }}>
          🔁 TPS: <strong>{tps}</strong>
        </div>
      </div>

      {/* Тапалка */}
      <div style={{ textAlign: "center", marginBottom: "13px" }}>
        <button
          onClick={handleTap}
          style={{
            width: "250px",
            height: "250px",
            borderRadius: "100%",
            fontSize: "24px",
            cursor: "pointer",
            position: "relative",
            background: "rgba(255, 255, 255, 0.2)",
            boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "#fff",
          }}
        >
          <img
            src={currentSkin?.image || minimorphImage}
            alt={`Minimorph Level ${level}`}
            style={{ width: "170px", height: "210px" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              width: "100%",
              fontSize: "14px",
              color: "#fff",
              left: "2%",
            }}
          >
            Tap!
          </div>
        </button>
      </div>

      {/* Кнопка выбора скинов */}
      <button onClick={() => setShowSkinModal(true)} className="skin-open-btn">
        <Shirt size={20} />
      </button>

      {/* Энергия и Билеты */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            height: "45px",
            display: "flex",
            alignItems: "center",
            background: "#0f3f6f",
            color: "#fff",
            borderRadius: 12,
            borderBottom: "4px solid #64b5fd",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <img src="/energy-icon.png" alt="Energy" style={{ width: "30px", marginRight: "10px" }} />
          <p>Energy: {energy} / 60</p>
        </div>

        <div
          style={{
            height: "45px",
            display: "flex",
            alignItems: "center",
            background: "#0f3f6f",
            color: "#fff",
            borderRadius: 12,
            borderBottom: "4px solid #64b5fd",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <img src="/ticket-icon.png" alt="Ticket" style={{ width: "30px", marginRight: "10px" }} />
          <p>Tickets: {tickets}</p>
        </div>
      </div>

      {/* Уровень и Машина */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          color: "#fff",
        }}
      >
        <div>
          <strong>Level {level}</strong>
          <div
            style={{
              backgroundColor: "#eee",
              width: "150px",
              height: "10px",
              borderRadius: "5px",
              overflow: "hidden",
              marginTop: "5px",
              color: "#fff",
            }}
          >
            <div
              style={{
                backgroundColor: "#4caf50",
                width: `${progressToNextLevel}%`,
                height: "100%",
              }}
            />
          </div>
        </div>
        <div>
          <strong>🏎 Car:</strong> {car}
        </div>
      </div>

      {/* Кнопка фарминга */}
      <div
        style={{
          textAlign: "center",
          margin: "0 auto",
          marginTop: "30px",
          justifyContent: "center",
          width: "250px",
        }}
      >
        {farmActive && farmCountdownRef.current ? (
          <button
            disabled
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
            }}
          >
            ⏳ Farming: {farmCountdownRef.current}
          </button>
        ) : (
          <button
            onClick={activateFarming}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ffa800",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
            }}
          >
            🚀 Activate Auto-Farming
          </button>
        )}
      </div>

      {/* Модалка слотов */}
      {showSlotMachine && (
        <SlotMachinePremium telegramId={telegramId} onClose={() => setShowSlotMachine(false)} />
      )}

      {/* Модалка скинов */}
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
