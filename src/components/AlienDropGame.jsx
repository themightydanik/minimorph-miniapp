import { db } from "./firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { useRef, useEffect, useState, useCallback } from "react";
import "./AlienDropGame.css";

/** ---------- НАСТРОЙКИ ---------- */
const TOTAL_ELEMENTS = 200;
const GAME_DURATION = 60;
const BOMB_CHANCE = 0.1;
const CHIP_CHANCE = 0.02;
const ELEMENT_SIZE = 50;
const MIN_X_SPACING = 60;
const MAX_ON_SCREEN = 16;

/** ФОНЫ */
const BG_START_SRC = "/bg-min1.webp";
const BG_PLAYING_SRC = "/bg-min1.webp";
const BG_OVER_SRC = "/bg-min2_1.webp";

/** СПРАЙТЫ */
const ALIEN_IMG_SRCS = ["/minimorph-drop.png", "/minimorph-drop2.png"];
const BOMB_IMG_SRC = "/minimorph-bomb.png";
const BOMB_EXPLODE_SRC = "/minimorph-bomb-explode.png";
const CHIP_IMG_SRC = "/minima-chip.png";

/** ПРИЗЫ */
const PRIZE_LOW_SRC = "/prize-low.webp";
const PRIZE_HIGH_SRC = "/prize-high.webp";

/** ---------- Firebase функции ---------- */
async function fetchTickets(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().tickets ?? 0 : 0;
}

async function fetchPoints(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().points ?? 0 : 0;
}

async function decrementTicket(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return 0;
  const current = snap.data().tickets ?? 0;
  if (current <= 0) return 0;
  await updateDoc(userRef, { tickets: current - 1 });
  return current - 1;
}

async function addPoints(uid, delta) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { points: increment(delta) });
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().points ?? 0 : 0;
}
/** -------------------------------------- */

export default function AlienDropGameCanvas({ onExit }) {
  const canvasRef = useRef();
  const gameAreaRef = useRef();

  const [telegramId, setTelegramId] = useState("demo");
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(GAME_DURATION);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [tickets, setTickets] = useState(null);
  const [points, setPoints] = useState(null);
  const [uiMsg, setUiMsg] = useState("");

  const elementsRef = useRef([]);
  const animationRef = useRef();

  const alienImages = useRef([]);
  const bombImage = useRef(new Image());
  const bombExplodeImage = useRef(new Image());
  const chipImage = useRef(new Image());
  const imagesLoaded = useRef(false);
  const freezeRef = useRef(false);
  const hasAwardedRef = useRef(false);

  /** ---------- Telegram ID ---------- */
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    setTelegramId(user.id.toString());
  }, []);

  /** ---------- Загрузка спрайтов ---------- */
  useEffect(() => {
    let loadedCount = 0;
    const totalToLoad = ALIEN_IMG_SRCS.length + 3;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === totalToLoad) {
        imagesLoaded.current = true;
      }
    };

    alienImages.current = ALIEN_IMG_SRCS.map((src) => {
      const img = new Image();
      img.src = src;
      img.onload = checkLoaded;
      return img;
    });

    bombImage.current.src = BOMB_IMG_SRC;
    bombImage.current.onload = checkLoaded;
    bombExplodeImage.current.src = BOMB_EXPLODE_SRC;
    bombExplodeImage.current.onload = checkLoaded;
    chipImage.current.src = CHIP_IMG_SRC;
    chipImage.current.onload = checkLoaded;
  }, []);

  /** ---------- Tickets/Points при загрузке ---------- */
  useEffect(() => {
    if (!telegramId) return;
    (async () => {
      try {
        const [t, p] = await Promise.all([
          fetchTickets(telegramId),
          fetchPoints(telegramId),
        ]);
        setTickets(t);
        setPoints(p);
      } catch (e) {
        console.error(e);
        setUiMsg("Не удалось загрузить данные. Попробуйте обновить.");
        setTickets(0);
        setPoints(0);
      }
    })();
  }, [telegramId]);

  /** ---------- Размер Canvas ---------- */
  const fitCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }, []);
  useEffect(() => {
    fitCanvas();
    const onResize = () => fitCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitCanvas]);

  /** ---------- Таймер ---------- */
  useEffect(() => {
    if (!gameStarted) return;
    const interval = setInterval(() => {
      if (!freezeRef.current) {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameOver(true);
            cancelAnimationFrame(animationRef.current);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted]);

  /** ---------- Spawn элементов ---------- */
  useEffect(() => {
    if (!gameStarted) return;
    let created = 0;
    const spawnInterval = setInterval(() => {
      const onScreen = elementsRef.current.filter(
        (el) => !el.hit && el.y < window.innerHeight
      ).length;
      if (created >= TOTAL_ELEMENTS) {
        clearInterval(spawnInterval);
        return;
      }
      if (onScreen < MAX_ON_SCREEN) {
        const count = Math.min(
          Math.floor(Math.random() * 3) + 1,
          MAX_ON_SCREEN - onScreen
        );
        const newEls = [];
        for (let i = 0; i < count; i++) {
          let x,
            tries = 0;
          do {
            x = Math.random() * (window.innerWidth - ELEMENT_SIZE);
            tries++;
          } while (
            elementsRef.current.some(
              (el) => Math.abs(el.x - x) < MIN_X_SPACING && el.y < 100
            ) && tries < 10
          );

          let type = Math.random() < BOMB_CHANCE ? "bomb" : "alien";
          if (Math.random() < CHIP_CHANCE) type = "chip";

          let img = null;
          if (type === "alien") {
            img =
              alienImages.current[
                Math.floor(Math.random() * alienImages.current.length)
              ];
          }

          newEls.push({
            x,
            y: -ELEMENT_SIZE,
            type,
            img,
            hit: false,
            active: false,
            opacity: 1,
            scale: 1,
            rotation: 0,
            particles: [],
            exploding: false,
          });
        }
        elementsRef.current.push(...newEls);
        created += count;
      }
    }, 400);

    return () => clearInterval(spawnInterval);
  }, [gameStarted]);

  /** ---------- Частицы ---------- */
  const generateParticles = (x, y) => {
    const particles = [];
    const count = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 1.5) * 4,
        size: 4 + Math.random() * 4,
        opacity: 1,
      });
    }
    return particles;
  };

  /** ---------- Render/Анимация ---------- */
  useEffect(() => {
    if (!gameStarted || !imagesLoaded.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Эффект электрификации чипов
      elementsRef.current.forEach((el) => {
        if (el.active && el.type === "chip") {
          ctx.save();
          ctx.strokeStyle = `rgba(0,255,255,0.8)`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            const x1 = el.x + Math.random() * ELEMENT_SIZE;
            const y1 = el.y + Math.random() * ELEMENT_SIZE;
            const x2 = el.x + Math.random() * ELEMENT_SIZE;
            const y2 = el.y + Math.random() * ELEMENT_SIZE;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // Основная отрисовка
      elementsRef.current.forEach((el) => {
        if (!el.hit && !freezeRef.current) {
          el.y += 1 + Math.random();
        }

        if (el.hit) {
          if (el.type === "alien") {
            el.opacity -= 0.05;
            el.scale -= 0.05;
            el.rotation += 0.3;
            el.particles.forEach((p) => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.05;
              p.opacity -= 0.05;
              ctx.fillStyle = `rgba(0,255,255,${p.opacity})`;
              ctx.fillRect(p.x, p.y, p.size, p.size);
            });
          } else if (el.type === "bomb" && el.exploding) {
            el.opacity -= 0.05;
            if (gameAreaRef.current) {
              const shakeAmount = 5;
              const dx = (Math.random() - 0.5) * shakeAmount;
              const dy = (Math.random() - 0.5) * shakeAmount;
              gameAreaRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
              if (el.opacity <= 0) gameAreaRef.current.style.transform = "none";
            }
          }
        }

        let img = el.img;
        if (el.type === "bomb")
          img = el.exploding ? bombExplodeImage.current : bombImage.current;
        if (el.type === "chip") img = chipImage.current;

        if (img && img.complete && img.naturalWidth !== 0 && el.opacity > 0) {
          ctx.save();
          ctx.globalAlpha = el.opacity;
          const size = ELEMENT_SIZE * el.scale;
          ctx.translate(el.x + ELEMENT_SIZE / 2, el.y + ELEMENT_SIZE / 2);
          if (el.type === "alien") ctx.rotate(el.rotation);
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
      });

      elementsRef.current = elementsRef.current.filter((el) => el.opacity > 0);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameStarted]);

  /** ---------- Клик ---------- */
  const handleClick = (e) => {
    if (!gameStarted || gameOver) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    elementsRef.current.forEach((el) => {
      if (
        !el.hit &&
        clickX >= el.x &&
        clickX <= el.x + ELEMENT_SIZE &&
        clickY >= el.y &&
        clickY <= el.y + ELEMENT_SIZE
      ) {
        if (el.type === "alien") {
          el.hit = true;
          setScore((prev) => prev + 1);
          el.particles = generateParticles(
            el.x + ELEMENT_SIZE / 2,
            el.y + ELEMENT_SIZE / 2
          );
        } else if (el.type === "bomb") {
          el.hit = true;
          setScore((prev) => Math.max(prev - 50, 0));
          el.exploding = true;
        } else if (el.type === "chip") {
          el.active = true;
          freezeRef.current = true;
          setTimeout(() => {
            freezeRef.current = false;
            el.active = false;
            el.hit = true;
            el.opacity = 0;
          }, 4000);
        }
      }
    });
  };

  /** ---------- Start game ---------- */
  const startRun = useCallback(() => {
    elementsRef.current = [];
    hasAwardedRef.current = false;
    setScore(0);
    setTimer(GAME_DURATION);
    setGameOver(false);
    setGameStarted(true);
  }, []);

  const handleStart = async () => {
    setUiMsg("");
    if (!imagesLoaded.current) return;

    if (tickets === null) {
      setUiMsg("Данные ещё загружаются…");
      return;
    }
    if (tickets <= 0) {
      setUiMsg("Недостаточно билетиков. Попробуйте позже.");
      return;
    }

    try {
      const newTickets = await decrementTicket(telegramId);
      setTickets(newTickets);
      startRun();
    } catch (e) {
      console.error(e);
      setUiMsg("Не удалось списать билет. Попробуйте ещё раз.");
    }
  };

  /** ---------- Points после игры ---------- */
  useEffect(() => {
    if (!gameOver) return;
    if (hasAwardedRef.current) return;

    hasAwardedRef.current = true;
    (async () => {
      try {
        const newPoints = await addPoints(telegramId, score);
        setPoints(newPoints);
      } catch (e) {
        console.error(e);
        setUiMsg("Не удалось зачислить поинты. Перепроверьте баланс позже.");
      }
    })();
  }, [gameOver, score, telegramId]);

  /** ---------- Play Again ---------- */
  const handlePlayAgain = async () => {
    setUiMsg("");
    if (tickets === null) return;
    if (tickets <= 0) {
      setUiMsg("Недостаточно билетиков. Попробуйте позже.");
      return;
    }
    try {
      const newTickets = await decrementTicket(telegramId);
      setTickets(newTickets);
      startRun();
    } catch (e) {
      console.error(e);
      setUiMsg("Не удалось списать билет. Попробуйте ещё раз.");
    }
  };

  /** ---------- Приз и фон ---------- */
  const prizeImage = score >= 50 ? PRIZE_HIGH_SRC : PRIZE_LOW_SRC;
  const bgImage = !gameStarted && !gameOver
    ? BG_START_SRC
    : gameStarted && !gameOver
    ? BG_PLAYING_SRC
    : BG_OVER_SRC;

  return (
    <div
      className={`game-wrapper ${
        !gameStarted && !gameOver
          ? "state-start"
          : gameStarted && !gameOver
          ? "state-playing"
          : "state-over"
      }`}
      ref={gameAreaRef}
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Кнопка выхода */}
      {onExit && (
        <button
          onClick={onExit}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 1000,
            backgroundColor: "#fe9c10",
            border: "none",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ⬅ Exit
        </button>
      )}

      {/* START SCREEN */}
      {!gameStarted && !gameOver && (
        <>
          <h1 className="game-title">Minimorph Drop Game</h1>
          <p className="game-description">
            Play and earn points! ✨ Beware of bombs 💣 — each explosion 💥 takes away 50 points.
          </p>

          <div className="start-meta" style={{ color: "#fff", }}>
            <div className="tickets">
              🎟 Tickets: {tickets === null ? "…" : tickets}
            </div>
            <div className="points">
              🪙 Points: {points === null ? "…" : points}
            </div>
          </div>

          {uiMsg && <div className="ui-msg">{uiMsg}</div>}

          <button
            className="play-button"
            onClick={handleStart}
            disabled={tickets !== null && tickets <= 0}
            title={
              tickets !== null && tickets <= 0
                ? "Недостаточно билетиков"
                : "Play"
            }
          >
            Play
          </button>
        </>
      )}

      {/* HUD */}
      {gameStarted && !gameOver && (
        <div className="hud">
          <div>Score: {score}</div>
          <div>Time: {timer}s</div>
        </div>
      )}

      {/* GAME OVER */}
      {gameOver && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>Your score: {score}</p>

          <div className="summary">
            <div>Tickets left: {tickets ?? "…"}</div>
            <div>Your points: {points ?? "…"}</div>
          </div>

          {uiMsg && <div className="ui-msg">{uiMsg}</div>}

          <div className="prize-section">
            <img
              src={prizeImage}
              alt="Prize"
              style={{ maxWidth: "270px", marginTop: "10px" }}
            />

            <p className="note">Points have been added to your account</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: gameStarted ? "block" : "none" }}
      />
    </div>
  );
}
