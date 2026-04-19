import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { saveUserData } from "./components/firebaseUser";
import { processReferralRewards } from "./components/referralRewards";
import TabBar from "./components/TabBar";

// Компоненты
import Planet from "./components/Planet";
import Missions from "./components/Missions";
import Colony from "./components/Colony";
import Locations from "./components/Locations";
import Friends from "./components/Friends";

function App() {
  const [loading, setLoading] = useState(true);
  const [telegramId, setTelegramId] = useState(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        tg?.ready();
        tg?.expand();

        const user = tg?.initDataUnsafe?.user;
        const startParam = tg?.initDataUnsafe?.start_param;

        if (!user) {
          console.warn("No Telegram user detected, using demo mode");
          setTelegramId("demo");
          setLoading(false);
          return;
        }

        const uid = user.id.toString();
        setTelegramId(uid);

        // Извлекаем referrer ID из start_param
        let invitedBy = null;
        if (startParam && startParam.startsWith("ref_")) {
          invitedBy = startParam.replace("ref_", "");
        }

        // Сохраняем/обновляем данные пользователя
        await saveUserData(uid, {
          username: user.username || user.first_name || `User-${uid}`,
          first_name: user.first_name,
          last_name: user.last_name,
          invitedBy: invitedBy
        });

        // Обрабатываем реферальные награды
        if (invitedBy && invitedBy !== uid) {
          await processReferralRewards(uid);
        }

        setLoading(false);
      } catch (error) {
        console.error("App initialization error:", error);
        setLoading(false);
      }
    };

    initApp();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        color: '#fff',
        fontSize: '18px'
      }}>
        Loading Minimorph...
      </div>
    );
  }

  return (
    <Router>
      <div style={{ paddingBottom: "70px", minHeight: "100vh" }}>
        <Routes>
          <Route path="/" element={<Planet />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/colony" element={<Colony />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/friends" element={<Friends />} />
        </Routes>
        <TabBar />
      </div>
    </Router>
  );
}

export default App;
