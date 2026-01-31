import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';
import { addXP, calculateExpeditionXP } from '../services/xpService.js';
import { xpGainNotification, updateStreak } from './player.js';
import { settingsData } from './settings.js';
import { get } from 'svelte/store';
import { awardPotions } from './dungeon.js';

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

// Expedition history from DB
export const expeditionsData = createLiveQueryStore(
  () => db.expeditions.orderBy('date').reverse().toArray(),
  []
);

// Current expedition timer state (not persisted)
export const expeditionTimer = writable({
  isRunning: false,
  isPaused: false,
  startTime: null,
  pausedTime: null,
  elapsedSeconds: 0
});

// Today's expedition minutes
export const todaysExpeditionMinutes = createLiveQueryStore(() => {
  const today = new Date().toISOString().split('T')[0];
  return db.expeditions
    .where('date')
    .equals(today)
    .toArray()
    .then(expeditions => expeditions.reduce((total, exp) => total + exp.duration, 0));
}, 0);

// Expedition goal progress
export const expeditionGoalProgress = derived(
  [todaysExpeditionMinutes, settingsData],
  ([$minutes, $settings]) => {
    const goal = $settings?.dailyExpeditionGoal || 20;
    const percentage = Math.min(100, Math.round(($minutes / goal) * 100));
    return {
      current: $minutes,
      goal,
      percentage,
      completed: $minutes >= goal
    };
  }
);

// Timer update interval
let timerInterval = null;

// Start the expedition timer
export function startExpedition() {
  const now = Date.now();

  expeditionTimer.update(state => ({
    isRunning: true,
    isPaused: false,
    startTime: now,
    pausedTime: null,
    elapsedSeconds: 0
  }));

  // Update elapsed time every second
  timerInterval = setInterval(() => {
    expeditionTimer.update(state => {
      if (!state.isRunning || state.isPaused) return state;
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      return { ...state, elapsedSeconds: elapsed };
    });
  }, 1000);
}

// Pause the expedition timer
export function pauseExpedition() {
  expeditionTimer.update(state => ({
    ...state,
    isPaused: true,
    pausedTime: Date.now()
  }));
}

// Resume the expedition timer
export function resumeExpedition() {
  expeditionTimer.update(state => {
    if (!state.pausedTime) return state;

    const pauseDuration = Date.now() - state.pausedTime;
    return {
      ...state,
      isPaused: false,
      startTime: state.startTime + pauseDuration,
      pausedTime: null
    };
  });
}

// End the expedition and log it
export async function endExpedition() {
  const state = get(expeditionTimer);

  if (!state.isRunning) return null;

  // Clear timer interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const durationSeconds = state.elapsedSeconds;
  const durationMinutes = Math.floor(durationSeconds / 60);

  // Reset timer state
  expeditionTimer.set({
    isRunning: false,
    isPaused: false,
    startTime: null,
    pausedTime: null,
    elapsedSeconds: 0
  });

  // Don't log expeditions shorter than 1 minute
  if (durationMinutes < 1) return null;

  const today = new Date().toISOString().split('T')[0];
  const settings = await db.settings.get(1);
  const goal = settings?.dailyExpeditionGoal || 20;

  // Get today's total expedition minutes before this one
  const todayExpeditions = await db.expeditions.where('date').equals(today).toArray();
  const previousMinutes = todayExpeditions.reduce((total, e) => total + e.duration, 0);

  // Check if this expedition completes the daily goal
  const hitGoal = previousMinutes < goal && (previousMinutes + durationMinutes) >= goal;

  // Calculate XP
  const xpEarned = calculateExpeditionXP(durationMinutes, hitGoal);

  // Log the expedition
  await db.expeditions.add({
    date: today,
    duration: durationMinutes,
    xpEarned,
    startTime: new Date(state.startTime).toISOString(),
    endTime: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  // Update player total expedition minutes
  const player = await db.player.get(1);
  await db.player.update(1, {
    totalExpeditionMinutes: (player?.totalExpeditionMinutes || 0) + durationMinutes
  });

  // Update daily stats
  const dailyStat = await db.dailyStats.where('date').equals(today).first();

  if (dailyStat) {
    await db.dailyStats.update(dailyStat.id, {
      expeditionMinutes: (dailyStat.expeditionMinutes || 0) + durationMinutes
    });
  } else {
    await db.dailyStats.add({
      date: today,
      tasksCompleted: 0,
      xpEarned: 0,
      expeditionMinutes: durationMinutes
    });
  }

  // Update streak
  await updateStreak();

  // Add XP
  const xpResult = await addXP(xpEarned, 'expedition');

  // Award dungeon health potions (2 base, +1 if hit daily goal)
  const potionsEarned = hitGoal ? 3 : 2;
  await awardPotions(potionsEarned);

  // Trigger notification
  xpGainNotification.set({
    amount: xpEarned,
    source: 'expedition',
    hitGoal,
    leveledUp: xpResult?.leveledUp
  });

  return {
    duration: durationMinutes,
    xpEarned,
    hitGoal,
    potionsEarned,
    ...xpResult
  };
}

// Cancel the expedition without logging
export function cancelExpedition() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  expeditionTimer.set({
    isRunning: false,
    isPaused: false,
    startTime: null,
    pausedTime: null,
    elapsedSeconds: 0
  });
}

// Format seconds to MM:SS or HH:MM:SS
export function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get expedition stats for a date range
export async function getExpeditionStats(startDate, endDate) {
  const expeditions = await db.expeditions
    .where('date')
    .between(startDate, endDate)
    .toArray();

  return expeditions.reduce((acc, exp) => {
    acc[exp.date] = (acc[exp.date] || 0) + exp.duration;
    return acc;
  }, {});
}
