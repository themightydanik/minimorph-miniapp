import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./firebase"; // путь к твоему firebase.js
import { saveUserData, loadUserData } from "./firebaseUser";
import { processReferralRewards } from "./referralRewards";
import { increment } from "firebase/firestore";
import { X, Shirt, Check } from "lucide-react";
import "./SkinModal.css";


// Помощник для уровней
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
    case 3:
      return "Standard Car";
    case 5:
      return "Good Car";
    case 6:
      return "Comfort Car";
    case 7:
      return "Premium Car";
    case 8:
      return "Elite Car";
    default:
      return "Basic Car";
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
    default: return "/minimorph-icon.png"; // fallback
  }
};


// Список скинов
const SKINS = [
  {
    id: "default",
    name: "Starter",
    description: "Your first Minimorph skin.",
    levelRequired: 1,
    price: 0,
    image: "/minimorph-icon.png",
  },
  {
    id: "rookie",
    name: "Rookie",
    description: "Minimorph at the beginning of his journey. Required level: 2",
    levelRequired: 2,
    price: 0,
    image: "/minimorph-icon1-min.png",
  },
  {
    id: "racing",
    name: "Racer",
    description: "Formula 1 is coming, Minima chip already used in McLaren racing cars. Required level: 3",
    levelRequired: 3,
    price: 0,
    image: "/minimorph-icon3-min.png",
  },
  {
    id: "rebel",
    name: "Tech Rebel",
    description: "You are getting closer to the big leagues. Required level: 4",
    levelRequired: 4,
    price: 0,
    image: "/minimorph-icon4-min.png",
  },
      {
    id: "rockstar",
    name: "Rockstar",
    description: "Play by your own rules - take what's yours. Required level: 5",
    levelRequired: 5,
    price: 0,
    image: "/minimorph-icon5-min.png",
  },
      {
    id: "fighter",
    name: "Fighter",
    description: "Notorious Paw. You've come a long way, but it's not time to relax. Required level: 6",
    levelRequired: 6,
    price: 0,
    image: "/minimorph-icon6.png",
  },
          {
    id: "excelsior",
    name: "Excelsior",
    description: "Welcome to the big leagues. Required level: 7",
    levelRequired: 7,
    price: 0,
    image: "/minimorph-icon8-min.png",
  },
];



function Home() {
    
    
    //      leaderboard part1
      
    const [leaderboardVisible, setLeaderboardVisible] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [currentUserData, setCurrentUserData] = useState(null);  
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    
    const [level, setLevel] = useState(1); // максимальный достигнутый уровень
const [minimorphImage, setMinimorphImage] = useState("/minimorph-icon.png"); // изображение миниморфа



    
   useEffect(() => {
  const fetchAndRestoreUserData = async () => {
    const alreadyInitialized = localStorage.getItem("home_initialized");
    if (alreadyInitialized) return;

    try {
      const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (!telegramId) return;

      const userRef = doc(db, "users", telegramId.toString());
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) return;

      const data = docSnap.data();

      const setIfEmpty = (key, value) => {
        if (!localStorage.getItem(key) && value !== undefined) {
          localStorage.setItem(
            key,
            typeof value === "object" ? JSON.stringify(value) : value
          );
        }
      };

      // Локальное хранилище
      setIfEmpty("points", data.points);
      setIfEmpty("tps", data.tps);
      setIfEmpty("tickets", data.tickets);
      setIfEmpty("energy", data.energy);
      setIfEmpty("username", data.username);
      setIfEmpty("level", data.level);
      setIfEmpty("completedTasks", JSON.stringify(data.completedTasks || {}));
      setIfEmpty("referrals", data.referrals || []);

      // React state
      if (data.points !== undefined) setPoints(data.points);
      if (data.tps !== undefined) setTps(data.tps);
      if (data.tickets !== undefined) setTickets(data.tickets);
      if (data.energy !== undefined) setEnergy(data.energy);
      if (data.username) setUsername(data.username);
      if (data.cards && setCards) setCards(data.cards);
      if (data.completedTasks && Object.keys(data.completedTasks).length > 0) {
        setCompletedTasks(data.completedTasks);
      }
      if (data.referrals && setReferrals) setReferrals(data.referrals);

      // ==== Новый блок для уровня ====
      const { level: calculatedLevel } = getLevelInfo(data.points ?? 0);
      let finalLevel = calculatedLevel;

      // Если уровень в базе выше, берём его (не падает при тратах)
      if ((data.level ?? 1) > calculatedLevel) {
        finalLevel = data.level;
      }

      setLevel(finalLevel);
      setMinimorphImage(getMinimorphImageByLevel(finalLevel));

      // Если игрок повысил уровень — сохраняем в Firebase
      if (calculatedLevel > (data.level ?? 1)) {
        await updateDoc(userRef, { level: calculatedLevel });
      }
      // ==== Конец блока для уровня ====

      localStorage.setItem("home_initialized", "true");
    } catch (e) {
      console.error("🔥 Ошибка при восстановлении данных из Firebase:", e);
    }
  };

  fetchAndRestoreUserData();
}, []);


useEffect(() => {
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  const registerReferral = async () => {
    if (!user?.id) return;

    // ВАЖНО: Получаем ref через initDataUnsafe, а не через window.location.search
    const startParam = tg?.initDataUnsafe?.start_param;
    if (!startParam || !startParam.startsWith("ref_")) return;

    const invitedBy = startParam.replace("ref_", "");
    const telegramId = user.id.toString();

    if (telegramId === invitedBy) return; // нельзя пригласить самого себя
  
   // 👉 Firestore: сохранить invitedBy, если ещё не сохранён
const userRef = doc(db, "users", normalizeId(telegramId));

    const docSnap = await getDoc(userRef);

    if (!docSnap.exists() || !docSnap.data().invitedBy) {
      await setDoc(userRef, { invitedBy: invitedBy }, { merge: true });
      console.log("✅ Firestore: invitedBy set to", invitedBy);
    } else {
      console.log("ℹ️ Firestore: invitedBy already set");
    }

    try {
      await fetch("https://minimorph-tg.onrender.com/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, invitedBy }),
      });

      console.log("✅ Referral registered:", { telegramId, invitedBy });
    } catch (err) {
      console.error("❌ Referral registration failed", err);
    }
  };

  registerReferral();
}, []);




    
    const [telegramId, settelegramId] = useState("demo");
    
    const saveUserData = async (telegramId, data) => {
  try {
await setDoc(doc(db, "users", normalizeId(telegramId)), data, { merge: true });

    
      
//      await updateDoc(doc(db, "users", telegramId.toString()), data, { merge: true });

  } catch (error) {
    console.error("Error saving user data:", error);
  }
};

const loadUserData = async (telegramId) => {
  try {
const docSnap = await getDoc(doc(db, "users", normalizeId(telegramId)));

    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
};

    
    const [username, setUsername] = useState(() => {
    return localStorage.getItem("username") || "Player";
  });
    
    const [points, setPoints] = useState(() => {
    const saved = localStorage.getItem("points");
    return saved !== null ? Number(saved) : 0;
  });
    
    const [tps, setTps] = useState(0);
    
    const [energy, setEnergy] = useState(() => {
    const saved = localStorage.getItem("energy");
    return saved !== null ? Number(saved) : 60;
  });
    
    const [tickets, setTickets] = useState(() => {
    const saved = localStorage.getItem("tickets");
    return saved !== null ? Number(saved) : 5;
  });

 // добавляем новые стейты для скинов
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]); // skin для предпросмотра в левой части
  const [currentSkin, setCurrentSkin] = useState(SKINS[0]);   // skin игрока
       
  const [farmActive, setFarmActive] = useState(false);
  const [farmCountdown, setFarmCountdown] = useState(0); 
  const farmCountdownRef = useRef("");
  const [, forceUpdate] = useState(0); // чтобы вручную вызывать перерендер
  const [farmStartTime, setFarmStartTime] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [showActivateButton, setShowActivateButton] = useState(true);

//const showActivateButton = isInitialized && !farmActive;

  // Логика фарма
  useEffect(() => {
  const savedFarmActive = localStorage.getItem("farmActive") === "true";
  const savedFarmStartTime = localStorage.getItem("farmStartTime");

  if (savedFarmActive && savedFarmStartTime) {
    setFarmActive(true);
    setFarmStartTime(Number(savedFarmStartTime));
  }
      
  // Обязательно! После загрузки состояний
  setIsInitialized(true);
      
      if (!savedFarmActive) {
  setShowActivateButton(true); // показываем кнопку впервые
}
    }, []);

      
const pointsRef = useRef(points);
useEffect(() => {
  pointsRef.current = points;
}, [points]);

useEffect(() => {
  const processFarming = async () => {
    if (!farmActive || !farmStartTime) return;

    const now = Date.now();
    const elapsedMs = now - farmStartTime;
    const maxDurationMs = 8 * 60 * 60 * 1000;

    const effectiveElapsed = Math.min(elapsedMs, maxDurationMs);
    const intervalsPassed = Math.floor(effectiveElapsed / 30000); // 30 сек
    const coinsEarned = intervalsPassed * ((2 + tps) / 2);

    const lastAwarded = Number(localStorage.getItem("lastAwarded")) || 0;
    const newCoins = coinsEarned - lastAwarded;

    if (newCoins > 0) {
      const updatedPoints = pointsRef.current + newCoins;
      setPoints(updatedPoints);
      pointsRef.current = updatedPoints;
      localStorage.setItem("lastAwarded", coinsEarned.toString());

      const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (telegramId) {
        await saveUserData(normalizeId(telegramId), { points: updatedPoints });
      }

      console.log(`💰 Получено ${newCoins} поинтов за ${Math.floor(effectiveElapsed / 1000)} сек фарминга`);
    }

    if (elapsedMs >= maxDurationMs) {
      // завершился
      setFarmActive(false);
      setFarmStartTime(null);
      farmCountdownRef.current = "";
      forceUpdate((x) => x + 1);
      localStorage.removeItem("farmActive");
      localStorage.removeItem("farmStartTime");
      localStorage.removeItem("lastAwarded");
    }
  };

  const interval = setInterval(processFarming, 15000);
  processFarming(); // запуск сразу при монтировании

  return () => clearInterval(interval);
}, [farmActive, farmStartTime, tps]);

    
    
// Обновление обратного отсчета в кнопке    
    
useEffect(() => {
  // Не стартуем интервал, если фарминг не активен или нет стартового времени
  if (!farmActive || !farmStartTime) return;

  const endTime = farmStartTime + 8 * 60 * 60 * 1000;
  const now = Date.now();

  // Если фарм уже закончился — чистим всё и выходим
  if (now >= endTime) {
    setFarmActive(false);
    setFarmStartTime(null);
    setFarmCountdown(""); // очистить текст
    setShowActivateButton(true); // показать кнопку активации
    localStorage.removeItem("farmActive");
    localStorage.removeItem("farmStartTime");
    localStorage.removeItem("lastAwarded");
    return;
  }

  // Стартуем интервал только если всё валидно
  const interval = setInterval(() => {
    const timeLeft = endTime - Date.now();

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      const newVal = `${hours}h ${minutes}m ${seconds}s`;

      if (farmCountdownRef.current !== newVal) {
        farmCountdownRef.current = newVal;
        forceUpdate(prev => prev + 1); // заставить компонент перерендериться
      }
    } else {
//      setFarmActive(false);
//      setFarmStartTime(null);
//      farmCountdownRef.current = "";
//      forceUpdate(prev => prev + 1); 
//      setShowActivateButton(true);
//      clearInterval(interval);
        
setFarmActive(false);
setFarmStartTime(null);
farmCountdownRef.current = "";
forceUpdate((x) => x + 1);
localStorage.removeItem("farmActive");
localStorage.removeItem("farmStartTime");
localStorage.removeItem("lastAwarded");
    }
  }, 1000);

  return () => clearInterval(interval);
}, [farmActive, farmStartTime]);

    
    
    // useEffect для сохранения фарм
    useEffect(() => {
  localStorage.setItem("farmActive", farmActive);
  if (farmStartTime) {
    localStorage.setItem("farmStartTime", farmStartTime.toString());
  }
}, [farmActive, farmStartTime]);

    
const [purchasedCards, setPurchasedCards] = useState([]);    

useEffect(() => {
  const initUserData = async () => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user ?? { id: "demo", username: "DemoUser" };
    const startParam = tg?.initDataUnsafe?.start_param;
    const inviterIdRaw = startParam?.startsWith("ref") ? startParam.slice(3) : null;
    const inviterId = inviterIdRaw ? normalizeId(inviterIdRaw) : null;

    setUsername(user?.username || "MinimorphHero");
    if (!user?.id) return;

    const telegramId = normalizeId(user.id);
    const userRef = doc(db, "users", telegramId);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : null;

    if (!data) {
      // === Новый пользователь ===
      const startLevel = getLevelInfo(100).level;
      const defaultSkin = SKINS.find(s => s.levelRequired <= startLevel) || SKINS[0];

      const newUser = {
        username: user.username || user.first_name || `User-${user.id}`,
        points: 100,
        level: startLevel,
        tickets: 5,
        energy: 60,
        masterRewards: 0,
        earned: {},
        invitedBy: inviterId || null,
        refEarnings: 0,
        lastRecordedPoints: 0,
        completedTasks: {},
        purchasedCards: [],
        tps: 0,
        skin: defaultSkin.id,
      };

      await setDoc(userRef, newUser, { merge: true });

      if (inviterId) {
        const inviterRef = doc(db, "users", inviterId);
        const inviterSnap = await getDoc(inviterRef);
        if (inviterSnap.exists()) {
          const inviterData = inviterSnap.data();
          await updateDoc(inviterRef, { points: (inviterData.points || 0) + 1000 });
        }
      }

      await processReferralRewards(telegramId);

      setPoints(newUser.points);
      setEnergy(newUser.energy);
      setTickets(newUser.tickets);
      setTps(newUser.tps);
      setLevel(newUser.level);
      setMinimorphImage(getMinimorphImageByLevel(newUser.level));
      setCurrentSkin(defaultSkin);
      setSelectedSkin(defaultSkin);

    } else {
      // === Существующий пользователь ===
      const currentPoints = data.points ?? 0;
      const savedLevel = data.level ?? getLevelInfo(currentPoints).level;
      const calculatedLevel = getLevelInfo(currentPoints).level;
      const finalLevel = Math.max(savedLevel, calculatedLevel);

      // Обновляем уровень, если вырос
      if (finalLevel > (data.level ?? 0)) {
        await updateDoc(userRef, { level: finalLevel });
      }

      setPoints(currentPoints);
      setEnergy(data.energy ?? 60);
      setTickets(data.tickets ?? 5);
      setTps(typeof data.tps === "number" ? data.tps : 0);
      setLevel(finalLevel);
      setMinimorphImage(getMinimorphImageByLevel(finalLevel));

      // Обновляем скин, если его нет
      if (data.skin) {
        const foundSkin = SKINS.find(s => s.id === data.skin);
        if (foundSkin) {
          setCurrentSkin(foundSkin);
          setSelectedSkin(foundSkin);
        }
      } else {
        const defaultSkin = SKINS.find(s => s.levelRequired <= finalLevel) || SKINS[0];
        setCurrentSkin(defaultSkin);
        setSelectedSkin(defaultSkin);
        await updateDoc(userRef, { skin: defaultSkin.id });
      }

      if (Array.isArray(data.purchasedCards)) {
        setPurchasedCards(data.purchasedCards);
      }

      // Перевод masterRewards в points
      const rewards = data.masterRewards || 0;
      if (rewards >= 10000) {
        const updatedPoints = currentPoints + rewards;
        await updateDoc(userRef, {
          points: updatedPoints,
          masterRewards: 0,
        });
        setPoints(updatedPoints);
        console.log(`🎁 Transferred ${rewards} masterRewards to points`);
      }
    }
  };

  initUserData();
}, []);






//new tickets logic

useEffect(() => {
  const checkDailyTicketBonus = async () => {
    const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    try {
const userRef = doc(db, "users", normalizeId(telegramId));

      const snap = await getDoc(userRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const lastVisit = localStorage.getItem("lastVisit");
      const today = new Date().toDateString();

      if (lastVisit !== today) {
        const updatedTickets = (data.tickets ?? 5) + 5;
        setTickets(updatedTickets);
        localStorage.setItem("lastVisit", today);
        await saveUserData(telegramId, { tickets: updatedTickets, username: user?.username ? `@${user.username}` : null, first_name: user?.first_name || null });
        console.log("🎟 Daily ticket bonus added!");
      } else {
        console.log("📆 Daily ticket bonus already claimed.");
      }
    } catch (e) {
      console.error("❌ Failed to give daily tickets:", e);
    }
  };

  checkDailyTicketBonus();
}, []);



    
//    useEffect(() => {
//  const tg = window.Telegram?.WebApp;
//  const user = tg?.initDataUnsafe?.user;
//
//    if (user) {
//    loadUserData(user.id).then((data) => {
//      if (data) {
//        setPoints(data.points ?? 0);
//        setEnergy(data.energy ?? 60);
//        setTickets(data.tickets ?? 5);
//        setTps(typeof data.tps === "number" ? data.tps : tps);
//        
//        
//        if (Array.isArray(data.purchasedCards)) {
//  setPurchasedCards(data.purchasedCards);
//}
//        
//      }
//    });
//  }
//}, []);
  
  useEffect(() => {
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  if (user) {
    const saveAndReward = async () => {
await saveUserData(user.id, {
  points,
  energy,
  tickets,
  tps,
  purchasedCards: purchasedCards.length > 0 ? purchasedCards : undefined,
  lastReferralCheck: Date.now(),
  username: user?.username ? `@${user.username}` : null,
  first_name: user?.first_name || null
});
  
   // После сохранения начисляем реферальные бонусы
      await processReferralRewards(user.id.toString());
  };
            
    saveAndReward();            
  
  }
}, [points, energy, tickets, tps, purchasedCards]);


    
const energyRef = useRef(energy);
useEffect(() => {
  energyRef.current = energy;
}, [energy]);

useEffect(() => {
  const interval = setInterval(() => {
    if (energyRef.current < 60) {
      const newEnergy = Math.min(60, energyRef.current + 3);
      setEnergy(newEnergy);
      energyRef.current = newEnergy;
      localStorage.setItem("energy", newEnergy.toString());

      // Обновляем Firebase
      const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (telegramId) {
        saveUserData(telegramId, { energy: newEnergy });
      }
    }
  }, 15000); // каждые 15 секунд

  return () => clearInterval(interval);
}, []);


  // Сохраняем изменения
  useEffect(() => {
    localStorage.setItem("points", points);
    localStorage.setItem("tickets", tickets);
    localStorage.setItem("energy", energy);
  }, [points, tickets, energy]);

            
//referrals useEffect start
            


      
//referrals useEffect end 
    
//start of Task rewards update    
    


useEffect(() => {
  const interval = setInterval(async () => {
    const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    try {
const userRef = doc(db, "users", normalizeId(telegramId));

      const snap = await getDoc(userRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const tasks = data.completedTasks || {};
      let updated = false;
      let claimable = data.claimedSocialPoints || 0;

      for (const [id, task] of Object.entries(tasks)) {
        if (task.status === "pending" && Date.now() - task.startedAt >= 10 * 60 * 1000) {
          const taskMetaSnap = await getDoc(doc(db, "tasks", id));
          if (taskMetaSnap.exists()) {
            const taskMeta = taskMetaSnap.data();
            tasks[id] = {
              status: "done",
              completedAt: Date.now(),
            };
            claimable += taskMeta.points || 0;
            updated = true;
          }
        }
      }

      if (updated) {
        await updateDoc(userRef, {
          completedTasks: tasks,
          claimedSocialPoints: claimable,
        });

        const newUserData = {
          ...data,
          completedTasks: tasks,
          claimedSocialPoints: claimable,
        };

        localStorage.setItem("user_data", JSON.stringify(newUserData));
        setUserData(newUserData);
      }
    } catch (error) {
      console.error("🔥 Ошибка при авто-завершении задач:", error);
    }
  }, 60000); //

  return () => clearInterval(interval); // очистка интервала
}, []);



//end of Task rewards update



            

const { level: calculatedLevel, nextLevelPoints } = getLevelInfo(points);

  const car = getCarByLevel(level);

  const progressToNextLevel = Math.min(
    (points / nextLevelPoints) * 100,
    100
  );

const handleTap = async () => {
  if (energy <= 0) {
    alert("Energy depleted! Wait or recharge.");
    return;
  }

  const newPoints = points + 1;
  const newEnergy = energy - 1;
  setPoints(newPoints);
  setEnergy(newEnergy);

  const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (!telegramId) return;

  // Считаем новый уровень по очкам
  const { level: calculatedLevel } = getLevelInfo(newPoints);

  let updatedLevel = level;

  // Если уровень вырос — обновляем и в стейте, и в интерфейсе
  if (calculatedLevel > level) {
    updatedLevel = calculatedLevel;
    setLevel(calculatedLevel);
    setMinimorphImage(getMinimorphImageByLevel(calculatedLevel));

    // Пишем новый уровень в базу
    const userRef = doc(db, "users", telegramId.toString());
    await updateDoc(userRef, { level: calculatedLevel });
  }

  // Всегда сохраняем очки, энергию и актуальный уровень
  saveUserData(telegramId, {
    points: newPoints,
    energy: newEnergy,
    level: updatedLevel, // всегда реальный уровень, не ниже текущего
    username: user?.username ? `@${user.username}` : null,
    first_name: user?.first_name || null,
  });
};





const activateFarming = () => {
  if (!farmActive) {
    const now = Date.now();
    setFarmActive(true);
    setFarmStartTime(now);

    localStorage.setItem("lastAwarded", "0");
    localStorage.setItem("farmActive", "true");
    localStorage.setItem("farmStartTime", now.toString());

    alert("Auto-farming activated for 8 hours!");
  } else {
    alert("Farming is already active!");
  }
};


//useEffect(() => {
//  if (!userId || userId === "demo") return;
//
//  const interval = setInterval(() => {
//    if (tps > 0) {
//      const userRef = doc(db, "users", userId);
//      updateDoc(userRef, {
//        points: increment(tps),
////        points: increment(tps / 10),
//      });
//      setPoints((prev) => prev + tps); // локально тоже обновляем
//    }
//  }, 60000); // 1 раз в минуту
//
//  return () => clearInterval(interval);
//}, [tps, userId]);


useEffect(() => {
  const restoreTasksFromFirestore = async () => {
    const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    const userRef = doc(db, "users", telegramId.toString());
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const tasks = data.completedTasks || {};

    // Восстановим локально
    setCompletedTasks(tasks);
    localStorage.setItem("completedTasks", JSON.stringify(tasks));
  };

  restoreTasksFromFirestore();
}, []);
    
useEffect(() => {
  const restoreTasksFromFirestore = async () => {
    const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    const userRef = doc(db, "users", telegramId.toString());
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const tasks = data.completedTasks || {};

    // Если есть хотя бы одно задание — обновим
    if (Object.keys(tasks).length > 0) {
      setCompletedTasks(tasks);
      localStorage.setItem("completedTasks", JSON.stringify(tasks));
    }
  };

  restoreTasksFromFirestore();
}, []);
    

//leaderboard part2    
    
    
const fetchLeaderboard = async () => {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const totalUsersCount = usersSnap.size;
    const users = [];

    const currentTelegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.points !== undefined) {
        users.push({
          telegramId: docSnap.id,
          username: data.username || `User-${docSnap.id}`,
          points: data.points,
        });
      }
    });

    // Сортировка по очкам
    users.sort((a, b) => b.points - a.points);

    // Ищем текущего пользователя ДО фильтрации
    const currentUser = users.find(u => u.telegramId === currentTelegramId) || null;

    // Исключаем нежелательные аккаунты из общего списка
    const filteredUsers = users.filter(
      (u) => u.username !== "Deviola_programmer" && u.username !== "DemoUser"
    );

    // Формируем топ-100
    const top100 = filteredUsers.slice(0, 100).map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

    setLeaderboard(top100);
    setCurrentUserData(currentUser);
    setTotalUsersCount(totalUsersCount);
  } catch (e) {
    console.error("❌ Ошибка загрузки лидерборда:", e);
  }
};

    
    



    

  return (
    <div style={{ 
  padding: "30px 20px 0px 20px",
  backgroundImage: `url('/TG-miniapp_bg.jpg')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  width: "100vw",
  minHeight: "100vh", 
  boxSizing: "border-box",  
  }}>
          
      {/* Приветствие */}
        
{/* Приветствие и кнопка Leaderboard в один ряд */}
<div style={{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "0",
  marginBottom: "15px",
  gap: "10px",
}}>
  <h1 style={{
    flexGrow: 1,
    borderRadius: "10px",
    background: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(5px)',
    color: "#fff",
    padding: "8px 12px",
    fontSize: "15px",
    lineHeight: 1.3,
    margin: 0,
    maxWidth: "165px",
    
  }}>
    Welcome, {username}!
  </h1>

  <button
    onClick={() => {
      fetchLeaderboard();
      setLeaderboardVisible(true);
    }}
    style={{
      padding: "10px 14px",
      backgroundColor: "#ffa800",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
  >
    🏆 Leaderboard
  </button>
</div>


{/* Баланс монет и TPS в одной строке */}
<div style={{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "10px",
  marginBottom: "15px",
  color: "#fff",
}}>
  {/* Баланс */}
  <div style={{ display: "flex", alignItems: "center" }}>
    <img src="/coin-icon.png" alt="Coin" style={{ width: "30px", marginRight: "8px" }} />
    <h2 style={{ fontSize: "18px", margin: 0 }}>{points} Points</h2>
  </div>

  {/* TPS */}
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
            background: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: "#fff",
          }}
        >
    <img
      src={currentSkin?.image || minimorphImage}
      alt={`Minimorph Level ${level}`}
      style={{ width: "170px", height: "210px" }}
    />
          <div style={{
            position: "absolute",
            bottom: "10px",
            width: "100%",
            fontSize: "14px",
            color: "#fff",
            left: "2%",
          }}>Tap!</div>
        </button>
      </div>

{/* Кнопка для выбора скинов */}
<button
  onClick={() => setShowSkinModal(true)}
  className="skin-open-btn"
>
  <Shirt size={20} />
</button>



{/* Энергия и Билеты в одном ряду */}
<div style={{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
}}>
  {/* Энергия */}
  <div style={{ height: "45px", display: "flex", alignItems: "center", background: "#0f3f6f", color: "#fff", borderRadius: 12, borderBottom: "4px solid #64b5fd", paddingLeft: "8px", paddingRight: "8px", }}>
    <img src="/energy-icon.png" alt="Energy" style={{ width: "30px", marginRight: "10px" }} />
    <p>Energy: {energy} / 60</p>
  </div>

  {/* Билеты */}
  <div style={{ height: "45px", display: "flex", alignItems: "center", background: "#0f3f6f", color: "#fff", borderRadius: 12, borderBottom: "4px solid #64b5fd", paddingLeft: "8px", paddingRight: "8px", }}>
    <img src="/ticket-icon.png" alt="Ticket" style={{ width: "30px", marginRight: "10px" }} />
    <p>Tickets: {tickets}</p>
  </div>
</div>


      {/* Уровень и Машина */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        color: "#fff",
      }}>
        <div>
          <strong>Level {level}</strong>
          <div style={{
            backgroundColor: "#eee",
            width: "150px",
            height: "10px",
            borderRadius: "5px",
            overflow: "hidden",
            marginTop: "5px",
            color: "#fff",
          }}>
            <div style={{
              backgroundColor: "#4caf50",
              width: `${progressToNextLevel}%`,
              height: "100%",
            }} />
          </div>
        </div>
        <div>
          <strong>🏎 Car:</strong> {car}
        </div>
      </div>

{isInitialized && (
  <div
    style={{
      textAlign: "center",
      margin: "0 auto",
      marginTop: "30px",
      justifyContent: "center",
      width: "250px"
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
          width: "100%"
        }}
      >
        ⏳ Farming: {farmCountdownRef.current}
      </button>
    ) : showActivateButton ? (
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
          width: "100%"
        }}
      >
        🚀 Activate Auto-Farming
      </button>
    ) : null}
  </div>
)}
          

          
{leaderboardVisible && (
  <div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px"
  }}>
    <div style={{
      backgroundColor: "#0e466fd1",
      color: "#fff",
      borderRadius: "12px",
      maxHeight: "90vh",
      width: "95%",
      maxWidth: "400px",
      overflowY: "auto",
      padding: "20px",
      position: "relative",
    }}>
      <button
        onClick={() => setLeaderboardVisible(false)}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "transparent",
          border: "none",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        ❌
      </button>

      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>🏆 Minimorph Hall of Fame</h2>

      {/* Текущий пользователь */}
      {currentUserData && (
        <div style={{
          backgroundColor: "#ffa800",
          padding: "10px",
          borderRadius: "8px",
          marginBottom: "15px",
          fontWeight: "bold",
          color: "#fff",
        }}>
          You: {currentUserData.username} — {currentUserData.points} pts
        </div>
      )}

      {/* Список топа */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ccc" }}>
            <th style={{ textAlign: "left" }}>🏅</th>
            <th style={{ textAlign: "left" }}>User</th>
            <th style={{ textAlign: "right" }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((user, i) => (
<tr
  key={user.telegramId}
  style={{
    backgroundColor:
      user.telegramId === currentUserData?.telegramId ? "#fffbe6" : "transparent",
    color: user.telegramId === currentUserData?.telegramId ? "#333" : "#fff",
    fontWeight: user.telegramId === currentUserData?.telegramId ? "bold" : "normal",
  }}
>

              <td>
                {user.rank === 1 ? "🥇" :
                 user.rank === 2 ? "🥈" :
                 user.rank === 3 ? "🥉" :
                 user.rank}
              </td>
              <td>{user.username}</td>
              <td style={{ textAlign: "right" }}>{user.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
        <p style={{
  marginTop: "15px",
  textAlign: "center",
  color: "#fff",
  fontSize: "14px"
}}>
  Showing Top 100 of {totalUsersCount} players
</p>
    </div>
  </div>
)}



{/* Модалка */}
{showSkinModal && (
  <div className="skin-modal-backdrop">
    <div className="skin-modal">
      {/* Кнопка закрыть */}
      <button
        onClick={() => setShowSkinModal(false)}
        className="skin-modal-close"
      >
        <X size={24} />
      </button>

      {/* Левая часть */}
      <div className="skin-modal-left">
        <img
          src={selectedSkin.image}
          alt={selectedSkin.name}
          className="skin-modal-image"
        />
        <h2 className="skin-modal-title">{selectedSkin.name}</h2>
        <p className="skin-modal-description">{selectedSkin.description}</p>

<button
  onClick={async () => {

if (selectedSkin.levelRequired > level) {
      alert(`❌ This skin requires a level  ${selectedSkin.levelRequired}`);
      return;
    }

    // Обновляем локально
    setCurrentSkin(selectedSkin);
    setShowSkinModal(false);

    // Обновляем в Firebase
    try {
      const tg = window.Telegram?.WebApp;
      const telegramId = normalizeId(tg?.initDataUnsafe?.user?.id || "demo");
      const userRef = doc(db, "users", telegramId);

      await updateDoc(userRef, { skin: selectedSkin.id });
      console.log(`✅ Skin updated in Firebase: ${selectedSkin.id}`);
    } catch (err) {
      console.error("Failed to update skin in Firebase:", err);
    }
  }}
  className="skin-modal-action"
>
  {selectedSkin.price > 0 ? `Buy for ${selectedSkin.price}` : "Choose"}
</button>

      </div>

      {/* Правая часть */}
      <div className="skin-modal-right">
        {SKINS.map((skin) => (
          <div
            key={skin.id}
            onClick={() => setSelectedSkin(skin)}
            className={`skin-card ${
              selectedSkin.id === skin.id ? "skin-card-selected" : ""
            }`}
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
