import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';
import { calculateLevel, getXPProgress, getStreakMultiplier } from '../services/xpService.js';

// Create a store from a Dexie liveQuery
function createLiveQueryStore(queryFn, defaultValue = null) {
  const { subscribe, set } = writable(defaultValue);

  let subscription;

  const store = {
    subscribe(run, invalidate) {
      if (!subscription) {
        const observable = liveQuery(queryFn);
        subscription = observable.subscribe({
          next: value => set(value),
          error: err => console.error('LiveQuery error:', err)
        });
      }
      return subscribe(run, invalidate);
    }
  };

  return store;
}

// Player data from DB
export const playerData = createLiveQueryStore(() => db.player.get(1), null);

// Derived stores for computed values
export const currentLevel = derived(playerData, ($player) => {
  if (!$player) return 1;
  return calculateLevel($player.totalXP);
});

export const xpProgress = derived(playerData, ($player) => {
  if (!$player) return { level: 1, currentXP: 0, xpNeeded: 100, percentage: 0, totalXP: 0 };
  return getXPProgress($player.totalXP);
});

export const currentStreak = derived(playerData, ($player) => {
  return $player?.currentStreak || 0;
});

export const streakMultiplier = derived(currentStreak, ($streak) => {
  return getStreakMultiplier($streak);
});

// Level up notification store
export const levelUpNotification = writable(null);

// XP gain notification store (for floating +XP popups)
export const xpGainNotification = writable(null);

// Update streak based on activity
export async function updateStreak() {
  const player = await db.player.get(1);
  if (!player) return;

  const today = new Date().toISOString().split('T')[0];
  const lastActive = player.lastActiveDate;

  if (lastActive === today) {
    // Already active today, no change
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak;
  if (lastActive === yesterdayStr) {
    // Consecutive day
    newStreak = player.currentStreak + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const longestStreak = Math.max(player.longestStreak, newStreak);

  await db.player.update(1, {
    currentStreak: newStreak,
    longestStreak,
    lastActiveDate: today
  });
}

// Reset streak (for testing or manual reset)
export async function resetStreak() {
  await db.player.update(1, {
    currentStreak: 0,
    lastActiveDate: null
  });
}
