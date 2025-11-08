import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import RaceGame from "./RaceGame";
import AlienDropGame from "./AlienDropGame";

function Play() {
  const [showRace, setShowRace] = useState(false);
  const [showAlienDrop, setShowAlienDrop] = useState(false); // 👾 новый стейт
  const location = useLocation();
  const [tickets, setTickets] = useState(0);
  const [message, setMessage] = useState("");
  const [showIframeGame, setShowIframeGame] = useState(false);
  const [telegramId, settelegramId] = useState("demo");
  const gameWindowRef = useRef(null);

  // Инициализация пользователя и загрузка билетов
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = user.id.toString();
    settelegramId(uid);

    const fetchTickets = async () => {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setTickets(data.tickets ?? 0);
      }
    };
    fetchTickets();
  }, []);

  // Обновление билетов из state
  useEffect(() => {
    const incomingTickets = location.state?.tickets;
    if (incomingTickets !== undefined) {
      setTickets(incomingTickets);
    }
  }, [location.state]);

  // Обработка сообщений от iframe игры
  useEffect(() => {
    const listener = async (event) => {
      if (!event.data || typeof event.data !== "object") return;

      console.log("Message from game:", event.data);
      const { type, points = 200 } = event.data;

      if (type === "level_complete") {
        setMessage("Fantastic! You earned +200 points! 🔥");
        await updateDoc(doc(db, "users", telegramId), {
          points: increment(points),
        });
        setShowIframeGame(false);
        if (gameWindowRef.current && !gameWindowRef.current.closed) {
          gameWindowRef.current.close();
          gameWindowRef.current = null;
        }
      } else if (type === "level_failed") {
        setMessage("Oops! Try again later.");
        setShowIframeGame(false);
        if (gameWindowRef.current && !gameWindowRef.current.closed) {
          gameWindowRef.current.close();
          gameWindowRef.current = null;
        }
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [telegramId]);

  // Запуск iframe игры с проверкой билетов
  const startGame = async () => {
    if (tickets <= 0) {
      setMessage("Not enough tickets to play!");
      return;
    }

    const userRef = doc(db, "users", telegramId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const currentTickets = snap.data().tickets ?? 0;
      if (currentTickets > 0) {
        await updateDoc(userRef, { tickets: currentTickets - 1 });
        setTickets(currentTickets - 1);
        setMessage("");
        setShowIframeGame(true);
      } else {
        setMessage("Not enough tickets to play!");
      }
    } else {
      setMessage("User data not found!");
    }
  };

  return (
    <>
      {showRace ? (
        <RaceGame onExit={() => setShowRace(false)} />
      ) : showAlienDrop ? ( // 👾 новый блок
        <AlienDropGame onExit={() => setShowAlienDrop(false)} />
      ) : (
        <div
          style={{
            padding: "0px 20px",
            paddingTop: "5%",
            backgroundImage: `url('/play-screen_bg2-min.jpg')`,
            backgroundSize: "cover",
            width: "100vw",
            minHeight: "100vh",
            boxSizing: "border-box",
            color: "#fff",
          }}
        >
          <h2
            style={{
              color: "#fff",
              backdropFilter: "blur(5px)",
              border: "1px solid #f8d06b",
              borderRadius: "10px",
              textAlign: "center",
              paddingTop: "1%",
              paddingBottom: "1%",
              marginTop: "10%",
            }}
          >
            Minimorph Game 🎮
          </h2>

          <p style={{ textAlign: "center", maxWidth: "320px", margin: "0 auto", marginBottom: "3%" }}>
            Help Minimorph collect the Minima chip, overcome obstacles and bravely fight enemies.
          </p>

          <p
            style={{
              color: "#fff",
              background: "#052a47",
              borderLeft: "3px solid #f8d06b",
              borderRadius: "7px",
              textAlign: "left",
              paddingTop: "2%",
              paddingBottom: "2%",
              paddingLeft: "5%",
              paddingRight: "1%",
              maxWidth: "320px",
              margin: "auto",
            }}
          >
            Earn +200 points for each level you complete!
          </p>

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <h3
              style={{
                color: "#fff",
                backdropFilter: "blur(5px)",
                border: "1px solid #f8d06b",
                borderRadius: "10px",
                textAlign: "center",
                paddingTop: "1%",
                margin: "0 auto",
                paddingBottom: "1%",
                marginTop: "7%",
                marginBottom: "7%",
                maxWidth: "300px",
              }}
            >
              🎟 Tickets: {tickets}
            </h3>

            {/* 🚀 Minimorph */}
            <button
              onClick={startGame}
              style={{
                backgroundColor: "#ffa800",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "18px",
                cursor: "pointer",
                border: "none",
                marginRight: "10px",
                borderBottom: "4px solid #986b16",
              }}
            >
              Play Game 🛸
            </button>

            {/* 👾 Alien Drop */}
            <button
              onClick={() => setShowAlienDrop(true)}
              style={{
                backgroundColor: "#22a7ac",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "18px",
                cursor: "pointer",
                border: "none",
                borderBottom: "4px solid #067e99",
              }}
            >
              Drop Game 👾
            </button>

            <p
              style={{
                textAlign: "center",
                maxWidth: "300px",
                margin: "0 auto",
                marginTop: "8%",
                fontWeight: "500",
                textShadow: "0px 1px 10px #000",
              }}
            >
              ⚠️ For the best user experience, please rotate your mobile device horizontally.
              <img style={{ textAlign: "center", maxWidth: "70px", margin: "0 auto" }} src={`/rotate.png`} />
            </p>

            <button
              onClick={() => setShowRace(true)}
              style={{
                display: "none",
                padding: "10px 20px",
                backgroundColor: "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                marginTop: "20px",
              }}
            >
              🏎 Go to Race
            </button>
          </div>

          {message && (
            <div
              style={{
                background: "#083256",
                padding: "15px",
                borderRadius: "10px",
                margin: "20px auto",
                maxWidth: "320px",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          {showIframeGame && (
            <>
              <button
                style={{
                  position: "fixed",
                  top: "10px",
                  right: "10px",
                  zIndex: 10000,
                  padding: "8px 12px",
                  fontSize: "16px",
                  borderRadius: "6px",
                  backgroundColor: "#f8d06b",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => setShowIframeGame(false)}
              >
                Close Game
              </button>

              <iframe
                src="https://minimorph.netlify.app/"
                title="Minimorph Game"
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  border: "none",
                  zIndex: 9999,
                  backgroundColor: "#000",
                }}
                allowFullScreen
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

export default Play;
