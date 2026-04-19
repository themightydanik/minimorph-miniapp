// firebaseUser.js - FINAL VERSION
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const normalizeId = (id) => id?.toString().replace(/^_+/, "") || null;

export const saveUserData = async (telegramId, data = {}) => {
  const cleanTelegramId = normalizeId(telegramId);
  const cleanInvitedBy = normalizeId(data.invitedBy);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  
  // 🆕 НОВАЯ СТРУКТУРА ДАННЫХ
  const defaultData = {
    // Основные данные
    username: data.username || data.first_name || `User-${cleanTelegramId}`,
    level: 1,
    skin: 'default',
    
    // 💰 BALANCES (новая структура)
    balances: {
      credits: 100,      // Заменяет points
      energy: 60,
      morph: 0          // Premium валюта (заменяет minimaCoins)
    },
    
    // 🏗️ COLONY (новая структура)
    colony: {
      level: 1,
      population: 0,     // Заменяет TPS
      income: 0,         // Credits/hour
      buildings: {
        core: { level: 1 },
        mine: { level: 0 },
        lab: { level: 0 },
        habitat: { level: 0 },
        spaceport: { level: 0 },
        trading_post: { level: 0 }
      },
      lastCollected: null
    },
    
    // 🎯 MISSIONS
    missions: {
      stats: {
        totalRuns: 0,
        bestScore: 0,
        totalMorphEarned: 0
      }
    },
    
    // 🎰 SLOT MACHINE
    slots: {
      spins: 5,           // Бесплатные спины
      totalSpins: 0,
      wins: 0,
      totalEarned: 0,
      jackpots: 0,
      bigWins: 0
    },
    
    // 🔥 DAILY STREAK
    streak: {
      current: 0,
      lastDate: null,
      maxStreak: 0
    },
    
    // 🎟️ TICKETS (для старых игр)
    tickets: 7,
    
    // 👥 REFERRAL SYSTEM
    referral: {
      invitedBy: cleanInvitedBy || null,
      earned: {},
      totalEarnings: 0
    },
    
    // 📋 TASKS
    completedTasks: {},
    
    // 🕐 TIMESTAMPS
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  };
  
  if (!snap.exists()) {
    // Новый пользователь
    await setDoc(ref, { ...defaultData, ...data });
  } else {
    // 🔄 МИГРАЦИЯ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ
    const existing = snap.data();
    const updates = { lastActive: serverTimestamp() };
    
    // Миграция balances
    if (!existing.balances) {
      updates.balances = {
        credits: existing.points || 0,
        energy: existing.energy || 60,
        morph: existing.minimaCoins || 0
      };
    }
    
    // Миграция colony
    if (!existing.colony) {
      updates.colony = {
        level: 1,
        population: existing.tps || 0,
        income: 0,
        buildings: {
          core: { level: 1 },
          mine: { level: 0 },
          lab: { level: 0 },
          habitat: { level: 0 },
          spaceport: { level: 0 },
          trading_post: { level: 0 }
        },
        lastCollected: null
      };
    }
    
    // Миграция missions
    if (!existing.missions) {
      updates.missions = {
        stats: {
          totalRuns: 0,
          bestScore: 0,
          totalMorphEarned: 0
        }
      };
    }
    
    // Миграция slots
    if (!existing.slots) {
      updates.slots = {
        spins: existing.slotSpins || 5,
        totalSpins: existing.slotTotalSpins || 0,
        wins: existing.slotWins || 0,
        totalEarned: existing.slotTotalEarned || 0,
        jackpots: existing.slotJackpots || 0,
        bigWins: existing.slotBigWins || 0
      };
    }
    
    // Миграция streak
    if (!existing.streak) {
      updates.streak = {
        current: existing.currentStreak || 0,
        lastDate: existing.lastStreakDate || null,
        maxStreak: existing.maxStreak || 0
      };
    }
    
    // Миграция referral
    if (!existing.referral) {
      updates.referral = {
        invitedBy: existing.invitedBy || null,
        earned: existing.earned || {},
        totalEarnings: existing.masterRewards || 0
      };
    }
    
    // Обновляем только если есть изменения
    if (Object.keys(updates).length > 1) {
      await updateDoc(ref, updates);
    }
  }
};

export const loadUserData = async (telegramId) => {
  const cleanTelegramId = normalizeId(telegramId);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

// 🆕 Утилиты для работы с балансами
export const updateBalance = async (telegramId, currency, amount) => {
  const cleanTelegramId = normalizeId(telegramId);
  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const current = snap.data().balances?.[currency] || 0;
    await updateDoc(ref, {
      [`balances.${currency}`]: current + amount
    });
    return current + amount;
  }
  return 0;
};
