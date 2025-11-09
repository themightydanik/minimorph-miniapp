// components/DailyStreakModal.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import './DailyStreakModal.css';

const STREAK_REWARDS = [
  { day: 1, points: 100, stars: 0, minima: 0 },
  { day: 2, points: 200, stars: 0, minima: 0 },
  { day: 3, points: 300, stars: 0, minima: 0 },
  { day: 4, points: 500, stars: 0, minima: 0 },
  { day: 5, points: 1000, stars: 0, minima: 0 },
  { day: 6, points: 5000, stars: 0, minima: 0 },
  { day: 7, points: 10000, stars: 10, minima: 10 }
];

function DailyStreakModal({ telegramId, onClose, onRewardClaimed }) {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [todayRewardClaimed, setTodayRewardClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    checkAndUpdateStreak();
  }, [telegramId]);

  const checkAndUpdateStreak = async () => {
    try {
      const userRef = doc(db, 'users', telegramId.toString());
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const lastVisitDate = userData.lastStreakDate 
        ? new Date(userData.lastStreakDate.seconds * 1000) 
        : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let newStreak = userData.currentStreak || 0;
      let canClaim = false;

      if (!lastVisitDate) {
        // Первый визит
        newStreak = 1;
        canClaim = true;
      } else {
        const lastVisit = new Date(lastVisitDate);
        lastVisit.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          // Уже заходил сегодня
          canClaim = false;
          setTodayRewardClaimed(true);
        } else if (daysDiff === 1) {
          // Следующий день подряд
          newStreak = (userData.currentStreak || 0) + 1;
          if (newStreak > 7) newStreak = 1; // Сброс после 7 дней
          canClaim = true;
        } else {
          // Пропустил дни - сброс
          newStreak = 1;
          canClaim = true;
        }
      }

      setCurrentStreak(newStreak);
      
      // Если можно забрать награду, но модалка не должна показываться если уже забрал
      if (!canClaim) {
        setTodayRewardClaimed(true);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking streak:', error);
      setLoading(false);
    }
  };

  const claimReward = async () => {
    if (claiming || todayRewardClaimed) return;

    setClaiming(true);
    try {
      const userRef = doc(db, 'users', telegramId.toString());
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      const reward = STREAK_REWARDS[currentStreak - 1];

      const updates = {
        points: (userData.points || 0) + reward.points,
        currentStreak,
        lastStreakDate: serverTimestamp(),
      };

      // Добавляем звезды и Minima если есть
      if (reward.stars > 0) {
        updates.telegramStars = (userData.telegramStars || 0) + reward.stars;
      }
      if (reward.minima > 0) {
        updates.minimaCoins = (userData.minimaCoins || 0) + reward.minima;
      }

      await updateDoc(userRef, updates);

      setTodayRewardClaimed(true);
      
      // Уведомляем родительский компонент
      if (onRewardClaimed) {
        onRewardClaimed(reward);
      }

      // Закрываем через 2 секунды чтобы показать анимацию
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Failed to claim reward. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="streak-modal-overlay">
        <div className="streak-modal">
          <div className="streak-loading">Loading...</div>
        </div>
      </div>
    );
  }

  // Не показываем модалку если уже забрал награду сегодня
  if (todayRewardClaimed) {
    return null;
  }

  return (
    <div className="streak-modal-overlay" onClick={onClose}>
      <div className="streak-modal" onClick={(e) => e.stopPropagation()}>
        <button className="streak-close" onClick={onClose}>✕</button>
        
        <h2 className="streak-title">🎁 Daily Login Bonus!</h2>
        <p className="streak-subtitle">Day {currentStreak} of 7</p>

        <div className="streak-path">
          {STREAK_REWARDS.map((reward, index) => {
            const dayNum = index + 1;
            const isActive = dayNum === currentStreak;
            const isPassed = dayNum < currentStreak;
            const isCurrent = dayNum === currentStreak;

            return (
              <div 
                key={dayNum} 
                className={`streak-day ${isPassed ? 'passed' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="streak-day-circle">
                  {isPassed ? '✓' : dayNum}
                </div>
                <div className="streak-day-rewards">
                  {reward.points > 0 && <span>🪙 {reward.points}</span>}
                  {reward.stars > 0 && <span>⭐ {reward.stars}</span>}
                  {reward.minima > 0 && <span>💎 {reward.minima}</span>}
                </div>
                {isCurrent && (
                  <div className="streak-current-marker">YOU ARE HERE</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="streak-current-reward">
          <h3>Today's Reward:</h3>
          <div className="reward-display">
            {STREAK_REWARDS[currentStreak - 1].points > 0 && (
              <div className="reward-item">
                <span className="reward-icon">🪙</span>
                <span className="reward-value">
                  {STREAK_REWARDS[currentStreak - 1].points} Points
                </span>
              </div>
            )}
            {STREAK_REWARDS[currentStreak - 1].stars > 0 && (
              <div className="reward-item">
                <span className="reward-icon">⭐</span>
                <span className="reward-value">
                  {STREAK_REWARDS[currentStreak - 1].stars} Stars
                </span>
              </div>
            )}
            {STREAK_REWARDS[currentStreak - 1].minima > 0 && (
              <div className="reward-item">
                <span className="reward-icon">💎</span>
                <span className="reward-value">
                  {STREAK_REWARDS[currentStreak - 1].minima} Minima
                </span>
              </div>
            )}
          </div>
        </div>

        <button 
          className="streak-claim-btn"
          onClick={claimReward}
          disabled={claiming || todayRewardClaimed}
        >
          {claiming ? 'Claiming...' : todayRewardClaimed ? 'Claimed! ✓' : 'Claim Reward 🎁'}
        </button>

        <p className="streak-hint">
          Come back tomorrow to continue your streak!
        </p>
      </div>
    </div>
  );
}

export default DailyStreakModal;
