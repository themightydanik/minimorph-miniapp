import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const cardsData = [
  { id: "wallet", title: "Wallet", description: "A lightweight wallet MiniDapp", tps: 10, price: 500, level: 0 },
  { id: "security", title: "Security", description: "Adds encryption module", tps: 15, price: 700, level: 0 },
  { id: "settings", title: "Settings", description: "MiniDapp settings manager", tps: 5, price: 300, level: 0 },
  { id: "terminal", title: "Terminal", description: "For direct CLI access", tps: 20, price: 1000, level: 0 }
];

function MinimaOS() {
  const [userId, setUserId] = useState("demo");
  const [points, setPoints] = useState(0);
  const [tps, setTps] = useState(0);
  const [purchased, setPurchased] = useState([]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = user.id.toString();
    setUserId(uid);

    const userRef = doc(db, "users", uid);
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPoints(data.points ?? 0);
        setTps(data.tps ?? 0);
        setPurchased(data.purchasedCards ?? []);
      }
    });
  }, []);

  const handleBuy = async (card) => {
    if (points < card.price) return alert("Not enough Points!");

    const newPoints = points - card.price;
    const newTps = tps + card.tps;
    const newPurchased = [...purchased, card.id];

    setPoints(newPoints);
    setTps(newTps);
    setPurchased(newPurchased);

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      points: newPoints,
      tps: newTps,
      purchasedCards: newPurchased,
    });
  };

  const availableCards = cardsData.filter((c) => !purchased.includes(c.id));
  const ownedCards = cardsData.filter((c) => purchased.includes(c.id));

  return (
    <div style={{ padding: 20 }}>
      <h2>Minima OS</h2>
      <p>Your TPS: {tps}</p>
      <h3>New Features</h3>
      {availableCards.map((card) => (
        <div key={card.id} style={{ marginBottom: 10, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}>
          <h4>{card.title}</h4>
          <p>{card.description}</p>
          <p>+{card.tps} TPS | 💵 {card.price} Points | lvl {card.level}</p>
          <button onClick={() => handleBuy(card)}>Buy</button>
        </div>
      ))}
      <h3>My Features</h3>
      {ownedCards.map((card) => (
        <div key={card.id} style={{ marginBottom: 10, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}>
          <h4>{card.title}</h4>
          <p>{card.description}</p>
          <p>+{card.tps} TPS</p>
        </div>
      ))}
    </div>
  );
}

export default MinimaOS;
