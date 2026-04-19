// src/components/Colony.jsx
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import "./Colony.css";

// ===== КОНФИГУРАЦИЯ ЗДАНИЙ =====
const BUILDINGS = [
  {
    id: "mine",
    name: "Resource Mine",
    icon: "⛏️",
    description: "Extracts credits from planet resources",
    category: "production",
    levels: [
      { level: 1, cost: 500, income: 10, population: 2, buildTime: 0 },
      { level: 2, cost: 1500, income: 30, population: 5, buildTime: 0 },
      { level: 3, cost: 4000, income: 80, population: 10, buildTime: 0 },
      { level: 4, cost: 10000, income: 200, population: 20, buildTime: 0 },
      { level: 5, cost: 25000, income: 500, population: 40, buildTime: 0 },
    ],
  },
  {
    id: "lab",
    name: "Research Lab",
    icon: "🔬",
    description: "Boosts mission rewards and unlocks upgrades",
    category: "boost",
    levels: [
      { level: 1, cost: 1000, boost: 1.1, population: 3, buildTime: 0 },
      { level: 2, cost: 3000, boost: 1.25, population: 7, buildTime: 0 },
      { level: 3, cost: 8000, boost: 1.5, population: 15, buildTime: 0 },
      { level: 4, cost: 20000, boost: 2.0, population: 30, buildTime: 0 },
      { level: 5, cost: 50000, boost: 3.0, population: 50, buildTime: 0 },
    ],
  },
  {
    id: "habitat",
    name: "Minimorph Habitat",
    icon: "🏠",
    description: "Houses your population and increases energy cap",
    category: "support",
    levels: [
      { level: 1, cost: 800, energyCap: 80, population: 5, buildTime: 0 },
      { level: 2, cost: 2000, energyCap: 100, population: 12, buildTime: 0 },
      { level: 3, cost: 5000, energyCap: 130, population: 25, buildTime: 0 },
      { level: 4, cost: 12000, energyCap: 170, population: 45, buildTime: 0 },
      { level: 5, cost: 30000, energyCap: 220, population: 75, buildTime: 0 },
    ],
  },
  {
    id: "spaceport",
    name: "Spaceport",
    icon: "🚀",
    description: "Unlocks harder missions with better rewards",
    category: "unlock",
    levels: [
      { level: 1, cost: 5000, unlocks: "medium_missions", population: 8, buildTime: 0 },
      { level: 2, cost: 15000, unlocks: "hard_missions", population: 18, buildTime: 0 },
      { level: 3, cost: 40000, unlocks: "epic_missions", population: 35, buildTime: 0 },
      { level: 4, cost: 100000, unlocks: "legendary_missions", population: 60, buildTime: 0 },
    ],
  },
  {
    id: "core",
    name: "Colony Core",
    icon: "⚡",
    description: "The heart of your colony, generates base energy",
    category: "core",
    levels: [
      { level: 1, cost: 0, energy: 60, population: 0, buildTime: 0 }, // Стартовый уровень
      { level: 2, cost: 3000, energy: 80, population: 10, buildTime: 0 },
      { level: 3, cost: 10000, energy: 100, population: 25, buildTime: 0 },
      { level: 4, cost: 30000, energy: 130, population: 50, buildTime: 0 },
      { level: 5, cost: 80000, energy: 170, population: 100, buildTime: 0 },
    ],
  },
  {
    id: "trading_post",
    name: "Trading Post",
    icon: "💱",
    description: "Improves conversion rates and unlocks trading features",
    category: "economy",
    levels: [
      { level: 1, cost: 10000, conversionBonus: 0.05, population: 15, buildTime: 0 },
      { level: 2, cost: 25000, conversionBonus: 0.1, population: 30, buildTime: 0 },
      { level: 3, cost: 60000, conversionBonus: 0.15, population: 55, buildTime: 0 },
    ],
  },
];

const normalizeId = (id) => id?.toString().replace(/^_+/, "");

// ===== ГЛАВНЫЙ КОМПОНЕНТ =====
function Colony() {
  const [telegramId, setTelegramId] = useState("demo");
  const [balances, setBalances] = useState({
    credits: 0,
    energy: 60,
    morph: 0,
  });
  const [colony, setColony] = useState({
    level: 1,
    population: 0,
    income: 0,
    buildings: {},
  });
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    const user = tg?.initDataUnsafe?.user ?? { id: "demo" };
    const uid = normalizeId(user.id);
    setTelegramId(uid);
  }, []);

  // ===== ЗАГРУЗКА ДАННЫХ =====
  useEffect(() => {
    if (!telegramId || telegramId === "demo") return;

    const loadColonyData = async () => {
      try {
        const userRef = doc(db, "users", telegramId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();

          // Миграция
          const migratedBalances = {
            credits: data.balances?.credits ?? data.points ?? 0,
            energy: data.balances?.energy ?? data.energy ?? 60,
            morph: data.balances?.morph ?? data.minimaCoins ?? 0,
          };

          const migratedColony = {
            level: data.colony?.level ?? 1,
            population: data.colony?.population ?? (data.tps ?? 0),
            income: data.colony?.income ?? 0,
            buildings: data.colony?.buildings ?? {
              core: { level: 1 },
            },
          };

          setBalances(migratedBalances);
          setColony(migratedColony);
        }
      } catch (error) {
        console.error("Error loading colony data:", error);
      }
    };

    loadColonyData();
  }, [telegramId]);

  // ===== SAVE TO FIREBASE =====
  const saveToFirebase = async (updates) => {
    if (!telegramId || telegramId === "demo") return;

    try {
      const userRef = doc(db, "users", telegramId);
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  // ===== ПОКАЗАТЬ УВЕДОМЛЕНИЕ =====
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ===== UPGRADE BUILDING =====
  const upgradeBuilding = async (buildingId) => {
    const building = BUILDINGS.find((b) => b.id === buildingId);
    const currentLevel = colony.buildings[buildingId]?.level || 0;

    if (currentLevel >= building.levels.length) {
      showNotification("⚠️ Building is already at max level!", "warning");
      return;
    }

    const nextLevelData = building.levels[currentLevel];
    const cost = nextLevelData.cost;

    if (balances.credits < cost) {
      showNotification("❌ Not enough credits!", "error");
      return;
    }

    // Обновляем балансы
    const newCredits = balances.credits - cost;
    setBalances((prev) => ({ ...prev, credits: newCredits }));

    // Обновляем здание
    const newLevel = currentLevel + 1;
    const updatedBuildings = {
      ...colony.buildings,
      [buildingId]: { level: newLevel },
    };

    // Пересчитываем Population и Income
    const { totalPopulation, totalIncome } = calculateColonyStats(updatedBuildings);

    setColony((prev) => ({
      ...prev,
      buildings: updatedBuildings,
      population: totalPopulation,
      income: totalIncome,
    }));

    // Сохраняем в Firebase
    await saveToFirebase({
      "balances.credits": newCredits,
      "colony.buildings": updatedBuildings,
      "colony.population": totalPopulation,
      "colony.income": totalIncome,
    });

    showNotification(`✅ ${building.name} upgraded to level ${newLevel}!`, "success");
    setShowUpgradeModal(false);
  };

  // ===== РАСЧЕТ СТАТИСТИКИ КОЛОНИИ =====
  const calculateColonyStats = (buildings) => {
    let totalPopulation = 0;
    let totalIncome = 0;

    BUILDINGS.forEach((building) => {
      const currentLevel = buildings[building.id]?.level || 0;
      if (currentLevel > 0) {
        const levelData = building.levels[currentLevel - 1];
        totalPopulation += levelData.population || 0;
        totalIncome += levelData.income || 0;
      }
    });

    return { totalPopulation, totalIncome };
  };

  // ===== ОТКРЫТЬ МОДАЛКУ АПГРЕЙДА =====
  const openUpgradeModal = (building) => {
    setSelectedBuilding(building);
    setShowUpgradeModal(true);
  };

  // ===== GET BUILDING STATUS =====
  const getBuildingStatus = (buildingId) => {
    const building = BUILDINGS.find((b) => b.id === buildingId);
    const currentLevel = colony.buildings[buildingId]?.level || 0;

    if (currentLevel === 0) {
      return {
        status: "locked",
        currentLevel: 0,
        maxLevel: building.levels.length,
        nextCost: building.levels[0].cost,
      };
    }

    if (currentLevel >= building.levels.length) {
      return {
        status: "max",
        currentLevel,
        maxLevel: building.levels.length,
        nextCost: null,
      };
    }

    return {
      status: "upgradeable",
      currentLevel,
      maxLevel: building.levels.length,
      nextCost: building.levels[currentLevel].cost,
    };
  };

  // ===== RENDER =====
  return (
    <div className="colony-container">
      {/* === HEADER === */}
      <div className="colony-header">
        <div className="colony-title">
          <h2>🏗️ Colony Builder</h2>
          <p>Upgrade buildings to grow your population</p>
        </div>

        <div className="colony-stats">
          <div className="stat-box">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-label">Credits</span>
              <span className="stat-value">{balances.credits.toLocaleString()}</span>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <span className="stat-label">Population</span>
              <span className="stat-value">{colony.population}</span>
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">⚙️</div>
            <div className="stat-info">
              <span className="stat-label">Income/hour</span>
              <span className="stat-value">{colony.income}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === BUILDINGS GRID === */}
      <div className="buildings-grid">
        {BUILDINGS.map((building) => {
          const status = getBuildingStatus(building.id);
          const currentLevelData =
            status.currentLevel > 0 ? building.levels[status.currentLevel - 1] : null;
          const nextLevelData =
            status.currentLevel < building.levels.length
              ? building.levels[status.currentLevel]
              : null;

          return (
            <div
              key={building.id}
              className={`building-card ${status.status}`}
              onClick={() => openUpgradeModal(building)}
            >
              <div className="building-icon">{building.icon}</div>

              <div className="building-info">
                <h3 className="building-name">{building.name}</h3>
                <p className="building-desc">{building.description}</p>

                <div className="building-level">
                  Level {status.currentLevel} / {status.maxLevel}
                </div>

                {status.currentLevel > 0 && currentLevelData && (
                  <div className="building-stats">
                    {currentLevelData.income && (
                      <div className="stat-item">
                        ⚙️ +{currentLevelData.income}/h
                      </div>
                    )}
                    {currentLevelData.population && (
                      <div className="stat-item">
                        👥 +{currentLevelData.population}
                      </div>
                    )}
                    {currentLevelData.boost && (
                      <div className="stat-item">
                        📈 {currentLevelData.boost}x boost
                      </div>
                    )}
                    {currentLevelData.energyCap && (
                      <div className="stat-item">
                        ⚡ {currentLevelData.energyCap} cap
                      </div>
                    )}
                  </div>
                )}

                {status.status === "upgradeable" && nextLevelData && (
                  <div className="upgrade-cost">
                    💰 {nextLevelData.cost.toLocaleString()}
                  </div>
                )}

                {status.status === "locked" && (
                  <div className="upgrade-cost">
                    💰 {building.levels[0].cost.toLocaleString()}
                  </div>
                )}

                {status.status === "max" && (
                  <div className="max-badge">MAX LEVEL</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* === UPGRADE MODAL === */}
      {showUpgradeModal && selectedBuilding && (
        <div className="modal-backdrop" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowUpgradeModal(false)}
            >
              ✕
            </button>

            <div className="modal-icon">{selectedBuilding.icon}</div>
            <h2 className="modal-title">{selectedBuilding.name}</h2>
            <p className="modal-description">{selectedBuilding.description}</p>

            {(() => {
              const status = getBuildingStatus(selectedBuilding.id);
              const currentLevel = status.currentLevel;
              const nextLevel = currentLevel + 1;
              const currentLevelData =
                currentLevel > 0 ? selectedBuilding.levels[currentLevel - 1] : null;
              const nextLevelData =
                currentLevel < selectedBuilding.levels.length
                  ? selectedBuilding.levels[currentLevel]
                  : null;

              if (status.status === "max") {
                return (
                  <div className="modal-content">
                    <div className="max-level-message">
                      🎉 Building is at maximum level!
                    </div>
                    {currentLevelData && (
                      <div className="current-stats">
                        <h4>Current Stats:</h4>
                        {currentLevelData.income && (
                          <div>⚙️ Income: +{currentLevelData.income}/hour</div>
                        )}
                        {currentLevelData.population && (
                          <div>👥 Population: +{currentLevelData.population}</div>
                        )}
                        {currentLevelData.boost && (
                          <div>📈 Mission Boost: {currentLevelData.boost}x</div>
                        )}
                        {currentLevelData.energyCap && (
                          <div>⚡ Energy Cap: {currentLevelData.energyCap}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="modal-content">
                  <div className="upgrade-comparison">
                    {currentLevel > 0 && currentLevelData && (
                      <div className="level-box current">
                        <h4>Level {currentLevel}</h4>
                        {currentLevelData.income && (
                          <div>⚙️ {currentLevelData.income}/h</div>
                        )}
                        {currentLevelData.population && (
                          <div>👥 {currentLevelData.population}</div>
                        )}
                        {currentLevelData.boost && (
                          <div>📈 {currentLevelData.boost}x</div>
                        )}
                        {currentLevelData.energyCap && (
                          <div>⚡ {currentLevelData.energyCap}</div>
                        )}
                      </div>
                    )}

                    {currentLevel > 0 && <div className="arrow">→</div>}

                    {nextLevelData && (
                      <div className="level-box next">
                        <h4>Level {nextLevel}</h4>
                        {nextLevelData.income && (
                          <div className="upgrade-stat">
                            ⚙️ {nextLevelData.income}/h
                            {currentLevelData && currentLevelData.income && (
                              <span className="stat-diff">
                                (+{nextLevelData.income - currentLevelData.income})
                              </span>
                            )}
                          </div>
                        )}
                        {nextLevelData.population && (
                          <div className="upgrade-stat">
                            👥 {nextLevelData.population}
                            {currentLevelData && currentLevelData.population && (
                              <span className="stat-diff">
                                (+{nextLevelData.population - currentLevelData.population})
                              </span>
                            )}
                          </div>
                        )}
                        {nextLevelData.boost && (
                          <div className="upgrade-stat">
                            📈 {nextLevelData.boost}x
                          </div>
                        )}
                        {nextLevelData.energyCap && (
                          <div className="upgrade-stat">
                            ⚡ {nextLevelData.energyCap}
                            {currentLevelData && currentLevelData.energyCap && (
                              <span className="stat-diff">
                                (+{nextLevelData.energyCap - currentLevelData.energyCap})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {nextLevelData && (
                    <>
                      <div className="upgrade-cost-display">
                        Cost: 💰 {nextLevelData.cost.toLocaleString()}
                      </div>

                      <button
                        className="upgrade-btn"
                        onClick={() => upgradeBuilding(selectedBuilding.id)}
                        disabled={balances.credits < nextLevelData.cost}
                      >
                        {balances.credits < nextLevelData.cost
                          ? "Not Enough Credits"
                          : currentLevel === 0
                          ? "Build"
                          : "Upgrade"}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* === NOTIFICATION === */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default Colony;
