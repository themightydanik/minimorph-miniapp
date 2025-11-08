import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

export default function RaceGame({ onExit }) {
  const canvasRef = useRef(null);
  const [position, setPosition] = useState(1); // 0=левая, 1=средняя, 2=правая
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(5);
  const [obstacles, setObstacles] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  const trackLength = 1000; // дистанция в условных единицах
  const laneWidth = 60; // ширина полосы
  const carWidth = 30;
  const carHeight = 40;

  // Генерация препятствий и бонусов
  useEffect(() => {
    let obs = [];
    let bonusArr = [];
    for (let i = 100; i < trackLength; i += 100) {
      const lane = Math.floor(Math.random() * 3);
      if (Math.random() > 0.5) {
        obs.push({ lane, y: -i });
      } else {
        bonusArr.push({ lane, y: -i });
      }
    }
    setObstacles(obs);
    setBonuses(bonusArr);
  }, []);

  // Основной игровой цикл
  useEffect(() => {
      if (!canvasRef.current) return; // если canvas ещё не готов — выходим
    const ctx = canvasRef.current.getContext("2d");

    const gameLoop = setInterval(() => {
      if (gameOver) return;
      setDistance((d) => {
        const newDist = d + speed;
        if (newDist >= trackLength) {
          endRace();
        }
        return newDist;
      });

      // Перемещаем препятствия и бонусы
      setObstacles((obs) =>
        obs.map((o) => ({ ...o, y: o.y + speed }))
      );
      setBonuses((bon) =>
        bon.map((b) => ({ ...b, y: b.y + speed }))
      );

      draw(ctx);
      checkCollisions();
    }, 100);

    return () => clearInterval(gameLoop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, gameOver, position]);

  const draw = (ctx) => {
    ctx.clearRect(0, 0, 200, 400);

    // Дорога
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 0, 200, 400);

    // Линии между полосами
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(laneWidth, 0);
    ctx.lineTo(laneWidth, 400);
    ctx.moveTo(laneWidth * 2, 0);
    ctx.lineTo(laneWidth * 2, 400);
    ctx.stroke();
    ctx.setLineDash([]);

    // Машина игрока
    ctx.fillStyle = "red";
    ctx.fillRect(position * laneWidth + 15, 350, carWidth, carHeight);

    // Препятствия
    ctx.fillStyle = "black";
    obstacles.forEach((o) => {
      ctx.fillRect(o.lane * laneWidth + 15, o.y, carWidth, carHeight);
    });

    // Бонусы
    ctx.fillStyle = "gold";
    bonuses.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.lane * laneWidth + 30, b.y + 15, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // HUD
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(`Distance: ${distance}`, 10, 20);
    ctx.fillText(`Speed: ${speed}`, 10, 40);
  };

  const moveLeft = () => setPosition((p) => Math.max(0, p - 1));
  const moveRight = () => setPosition((p) => Math.min(2, p + 1));

  const checkCollisions = () => {
    const playerY = 350;
    const playerLane = position;

    // Проверка препятствий
    obstacles.forEach((o) => {
      if (
        o.lane === playerLane &&
        o.y + carHeight > playerY &&
        o.y < playerY + carHeight
      ) {
        setSpeed((s) => Math.max(2, s - 2)); // замедление
      }
    });

    // Проверка бонусов
    bonuses.forEach((b) => {
      if (
        b.lane === playerLane &&
        b.y + 20 > playerY &&
        b.y < playerY + carHeight
      ) {
        setSpeed((s) => s + 1); // ускорение
      }
    });
  };

const endRace = async () => {
  setGameOver(true);
  const telegramId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (!telegramId) {
    console.log("Race finished locally:", { distance, speed });
    return;
  }
  await setDoc(
    doc(db, "race_results", telegramId.toString()),
    { distance, speed, finishedAt: Date.now() },
    { merge: true }
  );
};

return (
  <div style={{ textAlign: "center", color: "#fff" }}>
    <h2>🏎 Minimorph Race</h2>
    <canvas
      ref={canvasRef}
      width={laneWidth * 3}
      height={400}
      style={{ border: "2px solid white", background: "#333" }}
    />
    <div style={{ marginTop: 10 }}>
      <button onClick={moveLeft}>⬅️</button>
      <button onClick={moveRight}>➡️</button>
    </div>
    {gameOver && (
      <div style={{ marginTop: 10 }}>
        <p>🏁 Finish! Distance: {distance}</p>
        <button onClick={onExit}>Back</button>
      </div>
    )}
  </div>
);
}
