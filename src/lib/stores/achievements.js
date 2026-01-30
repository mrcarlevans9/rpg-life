import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, ACHIEVEMENTS } from '../db/index.js';
import { addXP } from '../services/xpService.js';
import { showAchievement } from './notifications.js';

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

// All achievements from DB
export const achievementsData = createLiveQueryStore(() => db.achievements.toArray(), []);

// Unlocked achievements
export const unlockedAchievements = derived(achievementsData, $achievements =>
  $achievements.filter(a => a.unlockedAt !== null)
);

// Locked achievements
export const lockedAchievements = derived(achievementsData, $achievements =>
  $achievements.filter(a => a.unlockedAt === null)
);

// Achievement count
export const achievementCount = derived(achievementsData, $achievements => ({
  unlocked: $achievements.filter(a => a.unlockedAt !== null).length,
  total: $achievements.length
}));

// Unlock an achievement
export async function unlockAchievement(key) {
  const achievement = await db.achievements.where('key').equals(key).first();

  if (!achievement || achievement.unlockedAt) return null;

  // Update achievement
  await db.achievements.update(achievement.id, {
    unlockedAt: new Date().toISOString()
  });

  // Award XP
  if (achievement.xpReward) {
    await addXP(achievement.xpReward, `achievement:${key}`);
  }

  // Show notification
  showAchievement(achievement);

  return achievement;
}

// Update achievement progress
export async function updateAchievementProgress(key, progress) {
  const achievement = await db.achievements.where('key').equals(key).first();

  if (!achievement || achievement.unlockedAt) return null;

  await db.achievements.update(achievement.id, { progress });

  // Check if completed
  if (achievement.target && progress >= achievement.target) {
    await unlockAchievement(key);
  }

  return achievement;
}

// Check all achievements based on current state
export async function checkAchievements() {
  const player = await db.player.get(1);
  const achievements = await db.achievements.toArray();

  for (const achievement of achievements) {
    if (achievement.unlockedAt) continue;

    let shouldUnlock = false;
    let progress = 0;

    switch (achievement.type) {
      case 'task':
        // First task - checked when completing a task
        if (achievement.key === 'getting_started' && player.totalTasksCompleted >= 1) {
          shouldUnlock = true;
        }
        break;

      case 'walk':
        // First walk - checked when completing a walk
        if (achievement.key === 'first_steps') {
          const walkCount = await db.walks.count();
          if (walkCount >= 1) shouldUnlock = true;
        }
        break;

      case 'streak':
        progress = player.currentStreak;
        if (progress >= achievement.target) shouldUnlock = true;
        break;

      case 'task_count':
        progress = player.totalTasksCompleted;
        if (progress >= achievement.target) shouldUnlock = true;
        break;

      case 'walk_streak':
        // Check consecutive walk days
        progress = await getWalkStreak();
        if (progress >= achievement.target) shouldUnlock = true;
        break;

      case 'walk_time':
        progress = player.totalWalkMinutes;
        if (progress >= achievement.target) shouldUnlock = true;
        break;

      case 'level':
        // Checked separately when leveling up
        break;

      case 'daily_tasks':
        // Checked separately when completing tasks
        break;

      case 'time':
        // Checked separately when completing tasks
        break;
    }

    // Update progress
    if (progress > (achievement.progress || 0)) {
      await db.achievements.update(achievement.id, { progress });
    }

    // Unlock if achieved
    if (shouldUnlock) {
      await unlockAchievement(achievement.key);
    }
  }
}

// Check time-based achievements
export async function checkTimeAchievements() {
  const hour = new Date().getHours();

  if (hour >= 0 && hour < 6) {
    // Night Owl: after midnight, before 6am
    const nightOwl = await db.achievements.where('key').equals('night_owl').first();
    if (nightOwl && !nightOwl.unlockedAt) {
      await unlockAchievement('night_owl');
    }
  }

  if (hour < 6) {
    // Early Bird: before 6am
    const earlyBird = await db.achievements.where('key').equals('early_bird').first();
    if (earlyBird && !earlyBird.unlockedAt) {
      await unlockAchievement('early_bird');
    }
  }
}

// Check daily task count achievement
export async function checkDailyTasksAchievement() {
  const today = new Date().toISOString().split('T')[0];
  const dailyStat = await db.dailyStats.where('date').equals(today).first();

  if (dailyStat && dailyStat.tasksCompleted >= 10) {
    await unlockAchievement('overachiever');
  }
}

// Check level achievements
export async function checkLevelAchievements(level) {
  if (level >= 10) await unlockAchievement('level_10');
  if (level >= 25) await unlockAchievement('level_25');
  if (level >= 50) await unlockAchievement('level_50');
}

// Helper: Get consecutive walk days
async function getWalkStreak() {
  const walks = await db.walks.orderBy('date').reverse().toArray();
  if (walks.length === 0) return 0;

  const dates = [...new Set(walks.map(w => w.date))];
  let streak = 1;

  for (let i = 0; i < dates.length - 1; i++) {
    const current = new Date(dates[i]);
    const prev = new Date(dates[i + 1]);
    const diff = (current - prev) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
