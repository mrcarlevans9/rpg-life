import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, STAT_CONFIG, RESPEC_BASE_COST } from '../db/index.js';
import { calculateLevel, getXPProgress, getStreakMultiplier } from '../services/xpService.js';
import { pushPlayerUpdate } from '../supabase/sync.js';

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

// ============ STAT ALLOCATION SYSTEM ============

// Calculate the bonus from a stat with diminishing returns after soft cap
export function calculateStatBonus(statKey, points) {
  const config = STAT_CONFIG[statKey];
  if (!config || !points) return 0;

  // Hard cap check
  if (config.hardCap && points > config.hardCap) {
    points = config.hardCap;
  }

  let bonus;
  if (points <= config.softCap) {
    // Full value
    bonus = points * config.perPoint;
  } else {
    // Full value up to soft cap, diminished after
    const fullPoints = config.softCap;
    const diminishedPoints = points - config.softCap;
    bonus = (fullPoints * config.perPoint) + (diminishedPoints * config.diminishedPerPoint);
  }

  // Apply max effect cap if exists
  if (config.maxEffect !== undefined) {
    bonus = Math.min(bonus, config.maxEffect);
  }

  return bonus;
}

// Derived store for calculated stat bonuses
export const statBonuses = derived(playerData, ($player) => {
  const stats = $player?.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  return {
    maxHp: calculateStatBonus('vitality', stats.vitality),
    baseDamage: calculateStatBonus('power', stats.power),
    maxMp: calculateStatBonus('arcana', stats.arcana),
    dodgeChance: calculateStatBonus('agility', stats.agility),
    rarityBonus: calculateStatBonus('fortune', stats.fortune),
    // Raw stat values for display
    raw: stats
  };
});

// Derived store for unspent stat points
export const unspentStatPoints = derived(playerData, ($player) => {
  return $player?.unspentStatPoints || 0;
});

// Allocate a single stat point
export async function allocateStatPoint(statKey) {
  const player = await db.player.get(1);
  if (!player) return { success: false, error: 'No player data' };

  if ((player.unspentStatPoints || 0) <= 0) {
    return { success: false, error: 'No stat points available' };
  }

  if (!STAT_CONFIG[statKey]) {
    return { success: false, error: 'Invalid stat' };
  }

  const currentStats = player.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  // Check hard cap
  const config = STAT_CONFIG[statKey];
  if (config.hardCap && currentStats[statKey] >= config.hardCap) {
    return { success: false, error: `${config.label} is at maximum` };
  }

  const newStats = {
    ...currentStats,
    [statKey]: currentStats[statKey] + 1
  };

  const updates = {
    stats: newStats,
    unspentStatPoints: player.unspentStatPoints - 1
  };

  await db.player.update(1, updates);

  // Sync to cloud
  pushPlayerUpdate({
    stat_vitality: newStats.vitality,
    stat_power: newStats.power,
    stat_arcana: newStats.arcana,
    stat_agility: newStats.agility,
    stat_fortune: newStats.fortune,
    unspent_stat_points: updates.unspentStatPoints
  });

  return { success: true };
}

// Allocate multiple stat points at once
export async function allocateStatPoints(allocations) {
  const player = await db.player.get(1);
  if (!player) return { success: false, error: 'No player data' };

  const totalPointsNeeded = Object.values(allocations).reduce((sum, pts) => sum + pts, 0);
  if ((player.unspentStatPoints || 0) < totalPointsNeeded) {
    return { success: false, error: 'Not enough stat points' };
  }

  const currentStats = player.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  const newStats = { ...currentStats };

  // Validate and apply allocations
  for (const [statKey, points] of Object.entries(allocations)) {
    if (!STAT_CONFIG[statKey]) {
      return { success: false, error: `Invalid stat: ${statKey}` };
    }

    const config = STAT_CONFIG[statKey];
    const newValue = currentStats[statKey] + points;

    if (config.hardCap && newValue > config.hardCap) {
      return { success: false, error: `${config.label} would exceed maximum` };
    }

    newStats[statKey] = newValue;
  }

  const updates = {
    stats: newStats,
    unspentStatPoints: player.unspentStatPoints - totalPointsNeeded
  };

  await db.player.update(1, updates);

  // Sync to cloud
  pushPlayerUpdate({
    stat_vitality: newStats.vitality,
    stat_power: newStats.power,
    stat_arcana: newStats.arcana,
    stat_agility: newStats.agility,
    stat_fortune: newStats.fortune,
    unspent_stat_points: updates.unspentStatPoints
  });

  return { success: true };
}

// Respec all stat points (costs gold)
export async function respecStats() {
  const player = await db.player.get(1);
  if (!player) return { success: false, error: 'No player data' };

  const level = calculateLevel(player.totalXP);
  const respecCost = RESPEC_BASE_COST * level;

  if ((player.gold || 0) < respecCost) {
    return { success: false, error: `Not enough gold (need ${respecCost})` };
  }

  const currentStats = player.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  // Calculate total allocated points
  const allocatedPoints = Object.values(currentStats).reduce((sum, pts) => sum + pts, 0);

  if (allocatedPoints === 0) {
    return { success: false, error: 'No stats to reset' };
  }

  const newStats = {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  const updates = {
    stats: newStats,
    unspentStatPoints: (player.unspentStatPoints || 0) + allocatedPoints,
    gold: player.gold - respecCost
  };

  await db.player.update(1, updates);

  // Sync to cloud
  pushPlayerUpdate({
    stat_vitality: 0,
    stat_power: 0,
    stat_arcana: 0,
    stat_agility: 0,
    stat_fortune: 0,
    unspent_stat_points: updates.unspentStatPoints,
    gold: updates.gold
  });

  return { success: true, pointsRefunded: allocatedPoints, goldSpent: respecCost };
}

// Get respec cost for current level
export function getRespecCost(level) {
  return RESPEC_BASE_COST * level;
}

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
