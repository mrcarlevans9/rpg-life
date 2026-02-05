import { db, POINTS_PER_LEVEL } from '../db/index.js';

// Base XP values by priority
const BASE_XP = {
  low: 10,
  medium: 25,
  high: 50
};

// Subtask completion XP
const SUBTASK_XP = 5;

// Expedition XP
const EXPEDITION_XP_PER_MINUTE = 1;
const EXPEDITION_GOAL_BONUS = 50;

// Get streak multiplier based on current streak
export function getStreakMultiplier(streak) {
  if (streak >= 30) return 2.0;
  if (streak >= 14) return 1.75;
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.25;
  return 1.0;
}

// Calculate XP for completing a task
export function calculateTaskXP(task, streak = 0) {
  const baseXP = BASE_XP[task.priority] || BASE_XP.medium;
  const multiplier = getStreakMultiplier(streak);
  return Math.round(baseXP * multiplier);
}

// Calculate XP for completing a subtask
export function calculateSubtaskXP(streak = 0) {
  const multiplier = getStreakMultiplier(streak);
  return Math.round(SUBTASK_XP * multiplier);
}

// Calculate XP for an expedition
export function calculateExpeditionXP(durationMinutes, hitDailyGoal = false) {
  let xp = Math.round(durationMinutes * EXPEDITION_XP_PER_MINUTE);
  if (hitDailyGoal) {
    xp += EXPEDITION_GOAL_BONUS;
  }
  return xp;
}

// XP required for a specific level (exponential curve)
export function getXPForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate level from total XP
export function calculateLevel(totalXP) {
  let level = 1;
  while (getXPForLevel(level + 1) <= totalXP) {
    level++;
  }
  return level;
}

// Get XP progress towards next level
export function getXPProgress(totalXP) {
  const currentLevel = calculateLevel(totalXP);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);

  const currentLevelXP = totalXP - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const percentage = Math.floor((currentLevelXP / xpNeeded) * 100);

  return {
    level: currentLevel,
    currentXP: currentLevelXP,
    xpNeeded,
    percentage,
    totalXP
  };
}

// Add XP to player and return level up info if applicable
export async function addXP(amount, source) {
  const player = await db.player.get(1);
  if (!player) return null;

  const oldLevel = calculateLevel(player.totalXP);
  const newTotalXP = player.totalXP + amount;
  const newLevel = calculateLevel(newTotalXP);

  // Update player XP
  await db.player.update(1, {
    totalXP: newTotalXP
  });

  // Log XP gain
  await db.xpHistory.add({
    amount,
    source,
    timestamp: new Date().toISOString()
  });

  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  const dailyStat = await db.dailyStats.where('date').equals(today).first();

  if (dailyStat) {
    await db.dailyStats.update(dailyStat.id, {
      xpEarned: (dailyStat.xpEarned || 0) + amount
    });
  } else {
    await db.dailyStats.add({
      date: today,
      xpEarned: amount,
      tasksCompleted: 0,
      expeditionMinutes: 0
    });
  }

  // Check for level up
  const leveledUp = newLevel > oldLevel;
  let statPointsAwarded = 0;

  // Award stat points on level up
  if (leveledUp) {
    const levelsGained = newLevel - oldLevel;
    statPointsAwarded = levelsGained * POINTS_PER_LEVEL;

    // Update player's unspent stat points and total earned
    const updatedPlayer = await db.player.get(1);
    await db.player.update(1, {
      unspentStatPoints: (updatedPlayer?.unspentStatPoints || 0) + statPointsAwarded,
      totalStatPointsEarned: (updatedPlayer?.totalStatPointsEarned || 0) + statPointsAwarded
    });
  }

  return {
    amount,
    newTotalXP,
    oldLevel,
    newLevel,
    leveledUp,
    statPointsAwarded,
    xpProgress: getXPProgress(newTotalXP)
  };
}

// Get XP stats for a date range
export async function getXPStats(startDate, endDate) {
  const stats = await db.xpHistory
    .where('timestamp')
    .between(startDate, endDate)
    .toArray();

  return stats.reduce((acc, entry) => {
    const date = entry.timestamp.split('T')[0];
    acc[date] = (acc[date] || 0) + entry.amount;
    return acc;
  }, {});
}
