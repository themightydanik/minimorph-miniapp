import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Убирает подчёркивания в начале
const normalizeId = (id) => id?.toString().replace(/^_+/, "") || null;

export const saveUserData = async (telegramId, data = {}) => {
  const cleanTelegramId = normalizeId(telegramId);
  const cleanInvitedBy = normalizeId(data.invitedBy);

  const ref = doc(db, "users", cleanTelegramId);
  const snap = await getDoc(ref);

  // Полная структура по умолчанию
  const defaultData = {
    completedTasks: {},
    earned: {},
    energy: 0,
    invitedBy: cleanInvitedBy || null,
    lastRecordedPoints: 0,
    masterRewards: 0,
    points: 0,
    purchasedCards: [],
    refEarnings: 0,
    tickets: 10,
    tps: 0,
    username: data.username || data.first_name || `User-${cleanTelegramId}`,
    level: 1, // теперь обычный level
  };

  if (!snap.exists()) {
    await setDoc(ref, { ...defaultData, ...data, invitedBy: cleanInvitedBy || null });
  } else {
    const existing = snap.data();
    const updates = { ...data };

    // Если у старого пользователя нет level — инициализируем
    if (existing.level === undefined || existing.level === null) {
      updates.level = 1;
    }  

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
