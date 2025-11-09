// firebaseUser.js - UPDATED VERSION
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Убирает подчёркивания в начале
const normalizeId = (id) => id?.toString().replace(/^_+/, "") || null;

export const saveUserData = async (telegramId, data = {}) => {
  const cleanTelegramId = normalizeId(telegramId);
  const cleanInvitedBy = normalizeId(data.invitedBy);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  
  // Полная структура по умолчанию с НОВЫМИ полями
  const defaultData = {
    // Основные данные
    username: data.username || data.first_name || `User-${cleanTelegramId}`,
    points: 0,
    level: 1,
    tickets: 10,
    energy: 60,
    tps: 0,
    
    // 🆕 Новые валюты
    telegramStars: 0,        // Виртуальный баланс Stars
    minimaCoins: 0,          // Виртуальный баланс Minima
    
    // 🆕 Daily Streak System
    currentStreak: 0,        // Текущий стрик (0-7)
    lastStreakDate: null,    // Timestamp последнего захода
    maxStreak: 0,            // Максимальный стрик за все время
    
    // 🆕 Slot Machine данные
    slotSpins: 0,            // Оставшиеся спины
    slotTotalSpins: 0,       // Всего спинов сделано
    slotWins: 0,             // Количество выигрышей
    slotTotalEarned: 0,      // Всего Stars выиграно
    slotJackpots: 0,         // Количество джекпотов
    slotBigWins: 0,          // Количество больших выигрышей
    
    // Реферальная система
    completedTasks: {},
    earned: {},
    invitedBy: cleanInvitedBy || null,
    lastRecordedPoints: 0,
    masterRewards: 0,
    refEarnings: 0,
    
    // Прочее
    purchasedCards: [],
    skin: 'default',
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
  
  if (!snap.exists()) {
    // Создаём нового пользователя с полной структурой
    await setDoc(ref, { ...defaultData, ...data, invitedBy: cleanInvitedBy || null });
  } else {
    // Обновляем существующего пользователя
    const existing = snap.data();
    const updates = { 
      ...data,
      lastActive: new Date().toISOString() // Обновляем время последней активности
    };
    
    // 🔧 Миграция: добавляем новые поля если их нет
    if (existing.telegramStars === undefined) updates.telegramStars = 0;
    if (existing.minimaCoins === undefined) updates.minimaCoins = 0;
    if (existing.currentStreak === undefined) updates.currentStreak = 0;
    if (existing.lastStreakDate === undefined) updates.lastStreakDate = null;
    if (existing.maxStreak === undefined) updates.maxStreak = 0;
    if (existing.slotSpins === undefined) updates.slotSpins = 0;
    if (existing.slotTotalSpins === undefined) updates.slotTotalSpins = 0;
    if (existing.slotWins === undefined) updates.slotWins = 0;
    if (existing.slotTotalEarned === undefined) updates.slotTotalEarned = 0;
    if (existing.slotJackpots === undefined) updates.slotJackpots = 0;
    if (existing.slotBigWins === undefined) updates.slotBigWins = 0;
    if (existing.skin === undefined) updates.skin = 'default';
    
    // Если у старого пользователя нет level — инициализируем
    if (existing.level === undefined || existing.level === null) {
      updates.level = 1;
    }
    
    // Обновляем invitedBy только если его нет
    if (!existing.invitedBy && cleanInvitedBy && cleanInvitedBy !== cleanTelegramId) {
      updates.invitedBy = cleanInvitedBy;
    }
    
    await updateDoc(ref, updates);
  }
};

export const loadUserData = async (telegramId) => {
  const cleanTelegramId = normalizeId(telegramId);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

// 🆕 Дополнительная утилита для обновления баланса Stars
export const updateStarsBalance = async (telegramId, amount) => {
  const cleanTelegramId = normalizeId(telegramId);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const currentStars = snap.data().telegramStars || 0;
    await updateDoc(ref, {
      telegramStars: currentStars + amount
    });
    return currentStars + amount;
  }
  return 0;
};

// 🆕 Дополнительная утилита для обновления баланса Minima
export const updateMinimaBalance = async (telegramId, amount) => {
  const cleanTelegramId = normalizeId(telegramId);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const currentMinima = snap.data().minimaCoins || 0;
    await updateDoc(ref, {
      minimaCoins: currentMinima + amount
    });
    return currentMinima + amount;
  }
  return 0;
};
