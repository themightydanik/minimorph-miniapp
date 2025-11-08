import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs
} from "firebase/firestore";

const gettelegramId = () => {
  const tg = window.Telegram?.WebApp;
  return tg?.initDataUnsafe?.user?.id?.toString() ?? "demo";
};
  
//начало обработки claim rewards  
  
//const handleClaimRewards = async () => {
//  if (!user || claimablePoints <= 0) return;
//
//  const userRef = doc(db, "users", user.id.toString());
//  const snap = await getDoc(userRef);
//  
//  if (!snap.exists()) return;
//
//  const data = snap.data();
//  const newPoints = (data.points ?? 0) + claimablePoints;
//
//  await updateDoc(userRef, {
//    points: newPoints,
//    claimedSocialPoints: 0
//  });
//
//  setClaimablePoints(0);
//  alert("You claimed your rewards!");
//};

//конец обработки claim rewards

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [userTasks, setUserTasks] = useState({});
  const [claimablePoints, setClaimablePoints] = useState(0);

  const telegramId = gettelegramId();
  const userRef = doc(db, "users", telegramId);

  // Загрузка задач
  useEffect(() => {
    const loadTasks = async () => {
      const snapshot = await getDocs(collection(db, "tasks"));
      const loaded = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      setTasks(loaded);
    };

    loadTasks();
  }, []);

  // Загрузка статуса задач пользователя
  useEffect(() => {
    const loadUserData = async () => {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserTasks(data.completedTasks ?? {});
        setClaimablePoints(data.claimedSocialPoints ?? 0);
      }
    };

    loadUserData();
  }, []);

  // Обработка нажатия на задачу
  const handleStartTask = async (task) => {
    window.open(task.url, "_blank");

      const startedAt = Date.now();
      const newTasks = {
      ...userTasks,
      [task.id]: {
        status: "pending",
        startedAt,
      },
    };

    setUserTasks(newTasks);
    await updateDoc(userRef, {
      completedTasks: newTasks,
    });
      
          setTimeout(async () => {
      const updatedTasks = {
        ...newTasks,
        [task.id]: {
          status: "done",
          completedAt: Date.now(),
        },
      };

      setUserTasks(updatedTasks);
      await updateDoc(userRef, {
        completedTasks: updatedTasks,
        claimedSocialPoints: claimablePoints + task.points,
      });

      setClaimablePoints((prev) => prev + task.points);
    }, 0.1 * 60 * 1000); // 10 минут
  };



  // Обработка кнопки Claim
  const handleClaim = async () => {
    const snap = await getDoc(userRef);
    const user = snap.data();

    const newPoints = (user.points ?? 0) + claimablePoints;

    await updateDoc(userRef, {
      points: newPoints,
      claimedSocialPoints: 0,
    });

    alert("You claimed your points!");
    setClaimablePoints(0);
  };

  // Фильтрация задач
  const visibleTasks = tasks.filter((task) => {
    const status = userTasks[task.id]?.status;
    const completedAt = userTasks[task.id]?.completedAt;
    if (status === "done" && Date.now() - completedAt < 5 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  });
    
    
    useEffect(() => {
  const checkPendingTasks = async () => {
    const updatedTasks = { ...userTasks };
    let newClaimable = claimablePoints;
    let changed = false;

    for (const [taskId, taskInfo] of Object.entries(userTasks)) {
      if (taskInfo.status === "pending" && Date.now() - taskInfo.startedAt >= 10 * 60 * 1000) {
        updatedTasks[taskId] = {
          status: "done",
          completedAt: Date.now(),
        };

        const task = tasks.find(t => t.id === taskId);
        if (task) {
          newClaimable += task.points;
          changed = true;
        }
      }
    }

    if (changed) {
      setUserTasks(updatedTasks);
      setClaimablePoints(newClaimable);
      await updateDoc(userRef, {
        completedTasks: updatedTasks,
        claimedSocialPoints: newClaimable,
      });
    }
  };

  if (tasks.length > 0) {
    checkPendingTasks();
  }
}, [tasks, userTasks]);

    

  return (
    <div style={{
      padding: "0px 20px 0px 20px", paddingTop: "5%",
      backgroundImage: `url('/TG-miniapp_bg1.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      minHeight: '100vh',
    }}>
      <h2 style={{ color: "#fff", backdropFilter:"blur(2px)", border: "1px solid #f8d06b", borderRadius: "10px", textAlign: "center", paddingTop: "1%", paddingBottom: "1%", marginTop: "3%", }}>Social Tasks</h2>
      <p style={{ color: "#fff", textAlign: "center" }}>
        Complete tasks on X, YouTube, Discord, and Telegram to earn instant rewards!
      </p>

      <div style={{ color: "#fff", marginTop: "20px", textAlign: "center" }}>
        <h3>💸 Claimable: {claimablePoints} Points</h3>
        {claimablePoints > 0 && (
          <button
            onClick={handleClaim}
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              backgroundColor: "#ffa800",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            🎁 Claim Rewards
          </button>
        )}
      </div>

      <div style={{ marginTop: "30px" }}>
        {visibleTasks.length === 0 ? (
          <p style={{ color: "#fff", textAlign: "center", marginTop: "20%" }}>
            🥷 New tasks coming soon!
          </p>
        ) : (
          visibleTasks.map((task, idx) => {
            const status = userTasks[task.id]?.status;

            return (
              <div key={idx} style={{
                background: "#102030",
                padding: "15px",
                marginBottom: "10px",
                borderRadius: "10px",
                color: "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>📌 {task.platform}: {task.title}</div>
                  <div>+{task.points} pts</div>
                </div>
                <button
                  disabled={status === "done"}
                  onClick={() => handleStartTask(task)}
                  style={{
                    marginTop: "10px",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: status === "done" ? "#28a745" : "#00bcd4",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {status === "pending"
                    ? "Checking 🕘"
                    : status === "done"
                    ? "Completed ✅"
                    : task.action}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Tasks;
