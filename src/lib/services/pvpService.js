import { supabase } from '../supabase/client.js';
import { db } from '../db/index.js';
import { calculateLevel } from './xpService.js';

// ============ SNAPSHOT MANAGEMENT ============

/**
 * Get current user's combat stats for snapshot
 */
async function getPlayerCombatStats() {
  const player = await db.player.get(1);
  const dungeon = await db.dungeon.get(1);
  const avatar = await db.avatar.get(1);

  if (!player) return null;

  const level = calculateLevel(player.totalXP || 0);

  // Base stats + upgrades
  const maxHp = 100 + (dungeon?.maxHpBonus || 0);
  const attack = 10 + (dungeon?.bonusDamage || 0);
  const defense = 5 + (dungeon?.defenseBonus || 0);
  const speed = 10 + Math.floor(level / 5); // Speed scales with level
  const critChance = 10 + (dungeon?.critBonus || 0);

  return {
    level,
    totalXp: player.totalXP || 0,
    maxHp,
    attack,
    defense,
    speed,
    critChance,
    customSpells: player.customSpells || [],
    upgrades: dungeon?.upgrades || [],
    equippedTitle: avatar?.equippedTitle || 'rookie'
  };
}

/**
 * Update or create the player's snapshot
 */
export async function updateSnapshot(username = 'Adventurer') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const stats = await getPlayerCombatStats();
  if (!stats) return { success: false, error: 'Could not get player stats' };

  const snapshotData = {
    user_id: user.id,
    username,
    equipped_title: stats.equippedTitle,
    level: stats.level,
    total_xp: stats.totalXp,
    max_hp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    crit_chance: stats.critChance,
    custom_spells: stats.customSpells,
    upgrades: stats.upgrades
  };

  const { data, error } = await supabase
    .from('player_snapshots')
    .upsert(snapshotData, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to update snapshot:', error);
    return { success: false, error: error.message };
  }

  return { success: true, snapshot: data };
}

/**
 * Get current user's snapshot
 */
export async function getMySnapshot() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('player_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get snapshot:', error);
    return null;
  }

  return data;
}

/**
 * Get available opponents for matchmaking
 * Excludes current user, returns players around similar level
 */
export async function getOpponents(limit = 20, levelRange = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const mySnapshot = await getMySnapshot();
  const myLevel = mySnapshot?.level || 1;

  const { data, error } = await supabase
    .from('player_snapshots')
    .select('*')
    .neq('user_id', user.id)
    .gte('level', Math.max(1, myLevel - levelRange))
    .lte('level', myLevel + levelRange)
    .order('level', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get opponents:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific player's snapshot by user ID
 */
export async function getSnapshotByUserId(userId) {
  const { data, error } = await supabase
    .from('player_snapshots')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Failed to get snapshot:', error);
    return null;
  }

  return data;
}

// ============ BATTLE MANAGEMENT ============

/**
 * Record a battle result
 */
export async function recordBattle(opponentId, battleResult) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('battles')
    .insert({
      challenger_id: user.id,
      opponent_id: opponentId,
      challenger_snapshot: battleResult.challengerSnapshot,
      opponent_snapshot: battleResult.opponentSnapshot,
      winner_id: battleResult.winnerId,
      is_draw: battleResult.isDraw || false,
      xp_reward: battleResult.xpReward || 0,
      gold_reward: battleResult.goldReward || 0,
      battle_log: battleResult.battleLog,
      total_turns: battleResult.totalTurns || 0
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record battle:', error);
    return { success: false, error: error.message };
  }

  // Update win/loss counts on snapshots
  if (battleResult.winnerId === user.id) {
    await supabase.rpc('increment_wins', { user_id_param: user.id });
    await supabase.rpc('increment_losses', { user_id_param: opponentId });
  } else if (battleResult.winnerId === opponentId) {
    await supabase.rpc('increment_losses', { user_id_param: user.id });
    // Don't increment opponent wins for async battles (they didn't actively participate)
  }

  return { success: true, battle: data };
}

/**
 * Get battle history for current user
 */
export async function getBattleHistory(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get battle history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific battle by ID
 */
export async function getBattle(battleId) {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (error) {
    console.error('Failed to get battle:', error);
    return null;
  }

  return data;
}

/**
 * Get PvP stats for current user
 */
export async function getPvpStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const snapshot = await getMySnapshot();
  if (!snapshot) return null;

  return {
    wins: snapshot.wins || 0,
    losses: snapshot.losses || 0,
    winRate: snapshot.wins + snapshot.losses > 0
      ? Math.round((snapshot.wins / (snapshot.wins + snapshot.losses)) * 100)
      : 0,
    level: snapshot.level,
    totalBattles: snapshot.wins + snapshot.losses
  };
}

// ============ LEADERBOARD ============

/**
 * Get top players by wins
 */
export async function getLeaderboard(limit = 50) {
  const { data, error } = await supabase
    .from('player_snapshots')
    .select('user_id, username, level, wins, losses, equipped_title')
    .order('wins', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get leaderboard:', error);
    return [];
  }

  return data || [];
}
