import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';
import { addXP, calculateWalkXP } from '../services/xpService.js';
import { xpGainNotification, updateStreak } from './player.js';
import { settingsData } from './settings.js';
import { get } from 'svelte/store';

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

// Walk history from DB
export const walksData = createLiveQueryStore(
  () => db.walks.orderBy('date').reverse().toArray(),
  []
);

// Current walk timer state (not persisted)
export const walkTimer = writable({
  isRunning: false,
  isPaused: false,
  startTime: null,
  pausedTime: null,
  elapsedSeconds: 0
});

// Today's walk minutes
export const todaysWalkMinutes = createLiveQueryStore(() => {
  const today = new Date().toISOString().split('T')[0];
  return db.walks
    .where('date')
    .equals(today)
    .toArray()
    .then(walks => walks.reduce((total, walk) => total + walk.duration, 0));
}, 0);

// Walk goal progress
export const walkGoalProgress = derived(
  [todaysWalkMinutes, settingsData],
  ([$minutes, $settings]) => {
    const goal = $settings?.dailyWalkGoal || 20;
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

// Start the walk timer
export function startWalk() {
  const now = Date.now();

  walkTimer.update(state => ({
    isRunning: true,
    isPaused: false,
    startTime: now,
    pausedTime: null,
    elapsedSeconds: 0
  }));

  // Update elapsed time every second
  timerInterval = setInterval(() => {
    walkTimer.update(state => {
      if (!state.isRunning || state.isPaused) return state;
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      return { ...state, elapsedSeconds: elapsed };
    });
  }, 1000);
}

// Pause the walk timer
export function pauseWalk() {
  walkTimer.update(state => ({
    ...state,
    isPaused: true,
    pausedTime: Date.now()
  }));
}

// Resume the walk timer
export function resumeWalk() {
  walkTimer.update(state => {
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

// End the walk and log it
export async function endWalk() {
  const state = get(walkTimer);

  if (!state.isRunning) return null;

  // Clear timer interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const durationSeconds = state.elapsedSeconds;
  const durationMinutes = Math.floor(durationSeconds / 60);

  // Reset timer state
  walkTimer.set({
    isRunning: false,
    isPaused: false,
    startTime: null,
    pausedTime: null,
    elapsedSeconds: 0
  });

  // Don't log walks shorter than 1 minute
  if (durationMinutes < 1) return null;

  const today = new Date().toISOString().split('T')[0];
  const settings = await db.settings.get(1);
  const goal = settings?.dailyWalkGoal || 20;

  // Get today's total walk minutes before this walk
  const todayWalks = await db.walks.where('date').equals(today).toArray();
  const previousMinutes = todayWalks.reduce((total, w) => total + w.duration, 0);

  // Check if this walk completes the daily goal
  const hitGoal = previousMinutes < goal && (previousMinutes + durationMinutes) >= goal;

  // Calculate XP
  const xpEarned = calculateWalkXP(durationMinutes, hitGoal);

  // Log the walk
  await db.walks.add({
    date: today,
    duration: durationMinutes,
    xpEarned,
    startTime: new Date(state.startTime).toISOString(),
    endTime: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  // Update player total walk minutes
  const player = await db.player.get(1);
  await db.player.update(1, {
    totalWalkMinutes: (player?.totalWalkMinutes || 0) + durationMinutes
  });

  // Update daily stats
  const dailyStat = await db.dailyStats.where('date').equals(today).first();

  if (dailyStat) {
    await db.dailyStats.update(dailyStat.id, {
      walkMinutes: (dailyStat.walkMinutes || 0) + durationMinutes
    });
  } else {
    await db.dailyStats.add({
      date: today,
      tasksCompleted: 0,
      xpEarned: 0,
      walkMinutes: durationMinutes
    });
  }

  // Update streak
  await updateStreak();

  // Add XP
  const xpResult = await addXP(xpEarned, 'walk');

  // Trigger notification
  xpGainNotification.set({
    amount: xpEarned,
    source: 'walk',
    hitGoal,
    leveledUp: xpResult?.leveledUp
  });

  return {
    duration: durationMinutes,
    xpEarned,
    hitGoal,
    ...xpResult
  };
}

// Cancel the walk without logging
export function cancelWalk() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  walkTimer.set({
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

// Get walk stats for a date range
export async function getWalkStats(startDate, endDate) {
  const walks = await db.walks
    .where('date')
    .between(startDate, endDate)
    .toArray();

  return walks.reduce((acc, walk) => {
    acc[walk.date] = (acc[walk.date] || 0) + walk.duration;
    return acc;
  }, {});
}
