import { useEffect, useState, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import "./MinimaOS.css";

const cardsData = [
  { id: "wallet", title: "Wallet", description: "A lightweight wallet MiniDapp", tps: 5, price: 500, level: 2 },
  { id: "security", title: "Security", description: "Adds encryption module", tps: 6, price: 700, level: 3 },
  { id: "settings", title: "Settings", description: "MiniDapp settings manager", tps: 2, price: 300, level: 1 },
  { id: "terminal", title: "Terminal", description: "For direct CLI access", tps: 7, price: 1000, level: 3 },
  { id: "pending", title: "Pending", description: "Manage pending actions", tps: 4, price: 4000, level: 4 },
  { id: "health", title: "Health", description: "Shows the current status of the network", tps: 7, price: 20000, level: 5 },
  { id: "soko", title: "Soko", description: "NFT Marketplace inside Minima OS", tps: 5, price: 5000, level: 4 },
  { id: "block", title: "Block", description: "Minima Block Explorer", tps: 4, price: 8000, level: 4 },
];

function MinimaOS() {
  const telegramIdRef = useRef("demo");
//  const [telegramId, settelegramId] = useState("demo");
  const [points, setPoints] = useState(0);
  const [tps, setTps] = useState(0);
  const [purchased, setPurchased] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null); // For modal
  const [activeTab, setActiveTab] = useState("available");
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = user.id.toString();
telegramIdRef.current = uid;


    const userRef = doc(db, "users", uid);
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPoints(data.points ?? 0);
        setTps(typeof data.tps === "number" ? data.tps : tps);
        setPurchased(data.purchasedCards ?? []);
      }
    });
  }, []);

//useEffect(() => {
//  const interval = setInterval(async () => {
//    if (tps > 0) {
//      const income = tps / 60; // т.е. tps в час / 60 минут
//      const newPoints = points + income;
//      setPoints(newPoints);
//
//      const userRef = doc(db, "users", userIdRef.current);
//      await updateDoc(userRef, {
//        points: newPoints,
//      });
//    }
//  }, 60000); // 60 секунд
//
//  return () => clearInterval(interval);
//}, [tps, points]);


  const handleBuy = async (card) => {
    if (points < card.price) return alert("Not enough Points!");
    if (purchased.includes(card.id)) return;

    const newPoints = points - card.price;
    const newTps = tps + card.tps;
    const newPurchased = [...purchased, card.id];

    setPoints(newPoints);
    setTps(newTps);
    setPurchased(newPurchased);
    setSelectedCard(null); // Закрыть модалку

    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 10000);

    const userRef = doc(db, "users", telegramIdRef.current);
    await updateDoc(userRef, {
      points: newPoints,
      tps: newTps,
      purchasedCards: newPurchased,
    });
  };

  const availableCards = cardsData.filter((c) => !purchased.includes(c.id));
  const ownedCards = cardsData.filter((c) => purchased.includes(c.id));


  return (

      
    <div className="minima-os-container">
              
<div className="mo-header">
  <img src="/minima-logo.png" alt="Minima" className="mo-logo" />
  <h2 className="title">Minima OS</h2>
</div>

      <p className="description">Build your own blockchain OS by installing modules. Each one increases your TPS and boosts income.</p>

      <div className="tps-display">🔁 Your TPS: <strong>{tps}</strong></div>
          
      {tps > 0 && (
  <div className="tps-income">
    <p>💰 You earn approximately <strong>{tps * 60}</strong> points/hour</p>
  </div>
)}
      

      <div className="tabs">
        <button
          className={`tab ${activeTab === "available" ? "active" : ""}`}
          onClick={() => setActiveTab("available")}
        >
          Available
        </button>
        <button
          className={`tab ${activeTab === "installed" ? "active" : ""}`}
          onClick={() => setActiveTab("installed")}
        >
          Installed
        </button>
      </div>

{activeTab === "available" && (
  <div className="features-grid">
    {availableCards.length === 0 ? (
      <p className="mini-desc">🎉 All available modules have been installed.</p>
    ) : (
      availableCards.map((card) => (
        <div
          className="feature-card"
          key={card.id}
          onClick={() => setSelectedCard(card)}
        >
          <div className="icon-placeholder">
  <img
    src={`/${card.id}.png`}
    alt={`${card.title} icon`}
    className="minidapp-icon"
  />
</div>
          <h3>{card.title}</h3>
          <p className="mini-desc">{card.description}</p>
          <div className="bottom-row">
            <span>💠 +{card.tps} TPS</span>
            <div className="divider" />
            <span>💵 {card.price}</span>
          </div>
        </div>
      ))
    )}
  </div>
)}


      {activeTab === "installed" && (
        <div className="features-grid">
          {ownedCards.length === 0 ? (
            <p className="mini-desc">No modules installed yet.</p>
          ) : (
            ownedCards.map((card) => (
              <div className="feature-card owned" key={card.id}>
                <div className="icon-placeholder">
  <img
    src={`/${card.id}.png`}
    alt={`${card.title} icon`}
    className="minidapp-icon"
  />
</div>
                <h3>{card.title}</h3>
                <p className="mini-desc">{card.description}</p>
                <div className="bottom-row">
                  <span>💠 +{card.tps} TPS</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {selectedCard && (
        <div className="modal" onClick={() => setSelectedCard(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedCard.title}</h3>
            <p>{selectedCard.description}</p>
            <p>💠 TPS: {selectedCard.tps}</p>
            <p>💵 Price: {selectedCard.price} pts</p>
            <div className="modal-actions">
              <button onClick={() => handleBuy(selectedCard)}>Buy</button>
              <button className="cancel" onClick={() => setSelectedCard(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {showNotification && (
        <div className="toast">
          ✅ Module successfully purchased!
        </div>
      )}
    </div>
  );
}

export default MinimaOS;
