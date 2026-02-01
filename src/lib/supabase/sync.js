import { supabase } from './client.js';
import { db } from '../db/index.js';
import { get } from 'svelte/store';
import { authUser } from '../stores/auth.js';

// Check if user is authenticated
function getUserId() {
  const user = get(authUser);
  return user?.id || null;
}

// Track last signed-in user to detect user changes
const LAST_USER_KEY = 'rpg_life_last_user_id';

function getLastUserId() {
  return localStorage.getItem(LAST_USER_KEY);
}

function setLastUserId(userId) {
  if (userId) {
    localStorage.setItem(LAST_USER_KEY, userId);
  } else {
    localStorage.removeItem(LAST_USER_KEY);
  }
}

// Clear all local data (for user switch or sign out)
export async function clearLocalData() {
  console.log('Clearing local data for user switch...');
  await db.player.clear();
  await db.avatar.clear();
  await db.settings.clear();
  await db.tasks.clear();
  await db.board.clear();
  await db.dungeon.clear();
  await db.achievements.clear();
  await db.unlockables.clear();
  await db.expeditions.clear();
  await db.dailyQuests.clear();
  console.log('Local data cleared');
}

// ============ Player Sync ============
export async function syncPlayer() {
  const userId = getUserId();
  console.log('syncPlayer called, userId:', userId);
  if (!userId) return null;

  try {
    // Get local player data
    const localPlayer = await db.player.get(1);
    console.log('LOCAL player:', JSON.stringify({ gold: localPlayer?.gold, healthPotions: localPlayer?.healthPotions, customSpells: localPlayer?.customSpells }));

    // Try to get remote player
    const { data: remotePlayer, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('REMOTE player:', JSON.stringify({ gold: remotePlayer?.gold, health_potions: remotePlayer?.health_potions, custom_spells: remotePlayer?.custom_spells }));
    console.log('REMOTE error:', error);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote player:', error);
      return null;
    }

    // If remote exists, merge (take higher values)
    if (remotePlayer) {
      // Check if local looks like fresh defaults (just reset)
      const localIsDefault = !localPlayer || (
        (localPlayer.gold || 0) === 0 &&
        (localPlayer.totalXP || 0) === 0 &&
        (!localPlayer.customSpells || localPlayer.customSpells.length === 0 || !localPlayer.customSpells[0])
      );

      // Check if remote has real character data
      const remoteHasCharData = (remotePlayer.gold || 0) > 0 ||
        (remotePlayer.custom_spells && remotePlayer.custom_spells.length > 0 && remotePlayer.custom_spells[0]);

      // For username: prefer remote if local is default, otherwise use local if set
      const localUsernameIsDefault = !localPlayer?.username || localPlayer.username === 'Adventurer';
      const remoteHasUsername = remotePlayer.username && remotePlayer.username !== 'Adventurer';

      const merged = {
        username: (localUsernameIsDefault && remoteHasUsername)
          ? remotePlayer.username
          : (localPlayer?.username || remotePlayer.username || 'Adventurer'),
        totalXP: Math.max(localPlayer?.totalXP || 0, remotePlayer.total_xp || 0),
        currentStreak: Math.max(localPlayer?.currentStreak || 0, remotePlayer.current_streak || 0),
        longestStreak: Math.max(localPlayer?.longestStreak || 0, remotePlayer.longest_streak || 0),
        totalTasksCompleted: Math.max(localPlayer?.totalTasksCompleted || 0, remotePlayer.total_tasks_completed || 0),
        totalExpeditionMinutes: Math.max(localPlayer?.totalExpeditionMinutes || 0, remotePlayer.total_expedition_minutes || 0),
        lastActiveDate: localPlayer?.lastActiveDate || remotePlayer.last_active_date,
        // Character inventory - restore from remote if local is default
        gold: (localIsDefault && remoteHasCharData)
          ? (remotePlayer.gold || 0)
          : Math.max(localPlayer?.gold || 0, remotePlayer.gold || 0),
        healthPotions: (localIsDefault && remoteHasCharData)
          ? (remotePlayer.health_potions || 3)
          : Math.max(localPlayer?.healthPotions || 0, remotePlayer.health_potions || 0),
        customSpells: (localIsDefault && remoteHasCharData)
          ? (remotePlayer.custom_spells || [])
          : ((remotePlayer.custom_spells?.[0]) ? remotePlayer.custom_spells : (localPlayer?.customSpells || [])),
        purchasedSpellSlot: remotePlayer.purchased_spell_slot || localPlayer?.purchasedSpellSlot || false,
        // Dungeon stats
        highestFloor: Math.max(localPlayer?.highestFloor || 0, remotePlayer.highest_floor || 0),
        totalKills: Math.max(localPlayer?.totalKills || 0, remotePlayer.total_kills || 0)
      };

      // Update local
      await db.player.update(1, merged);

      // Update remote (use upsert to create if not exists)
      const { error: updateError } = await supabase
        .from('players')
        .upsert({
          user_id: userId,
          username: merged.username,
          total_xp: merged.totalXP,
          current_streak: merged.currentStreak,
          longest_streak: merged.longestStreak,
          total_tasks_completed: merged.totalTasksCompleted,
          total_expedition_minutes: merged.totalExpeditionMinutes,
          last_active_date: merged.lastActiveDate,
          gold: merged.gold,
          health_potions: merged.healthPotions,
          custom_spells: merged.customSpells,
          purchased_spell_slot: merged.purchasedSpellSlot,
          highest_floor: merged.highestFloor,
          total_kills: merged.totalKills
        }, { onConflict: 'user_id' });

      if (updateError) {
        console.error('UPSERT ERROR:', updateError.message, updateError.details, updateError.hint);
      }
      console.log('MERGED result:', JSON.stringify({ gold: merged.gold, healthPotions: merged.healthPotions, customSpells: merged.customSpells }));
      console.log('Player synced:', merged.gold, 'gold,', merged.highestFloor, 'best floor');
      return merged;
    } else if (localPlayer) {
      // No remote player exists - create one!
      console.log('No remote player found, creating one with gold:', localPlayer.gold);
      const { error: insertError } = await supabase.from('players').insert({
        user_id: userId,
        username: localPlayer.username || 'Adventurer',
        total_xp: localPlayer.totalXP || 0,
        current_streak: localPlayer.currentStreak || 0,
        longest_streak: localPlayer.longestStreak || 0,
        total_tasks_completed: localPlayer.totalTasksCompleted || 0,
        total_expedition_minutes: localPlayer.totalExpeditionMinutes || 0,
        last_active_date: localPlayer.lastActiveDate,
        gold: localPlayer.gold || 0,
        health_potions: localPlayer.healthPotions || 0,
        custom_spells: localPlayer.customSpells || [],
        purchased_spell_slot: localPlayer.purchasedSpellSlot || false,
        highest_floor: localPlayer.highestFloor || 0,
        total_kills: localPlayer.totalKills || 0
      });

      if (insertError) {
        console.error('Failed to create remote player:', insertError);
      } else {
        console.log('Remote player created successfully');
      }
    }

    return localPlayer;
  } catch (error) {
    console.error('Sync player error:', error);
    return null;
  }
}

// Push local player updates to remote
export async function pushPlayerUpdate(updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    const remoteUpdates = {};
    if (updates.username !== undefined) remoteUpdates.username = updates.username;
    if (updates.totalXP !== undefined) remoteUpdates.total_xp = updates.totalXP;
    if (updates.currentStreak !== undefined) remoteUpdates.current_streak = updates.currentStreak;
    if (updates.longestStreak !== undefined) remoteUpdates.longest_streak = updates.longestStreak;
    if (updates.totalTasksCompleted !== undefined) remoteUpdates.total_tasks_completed = updates.totalTasksCompleted;
    if (updates.totalExpeditionMinutes !== undefined) remoteUpdates.total_expedition_minutes = updates.totalExpeditionMinutes;
    if (updates.lastActiveDate !== undefined) remoteUpdates.last_active_date = updates.lastActiveDate;
    // Character inventory
    if (updates.gold !== undefined) remoteUpdates.gold = updates.gold;
    if (updates.healthPotions !== undefined) remoteUpdates.health_potions = updates.healthPotions;
    if (updates.customSpells !== undefined) remoteUpdates.custom_spells = updates.customSpells;
    if (updates.purchasedSpellSlot !== undefined) remoteUpdates.purchased_spell_slot = updates.purchasedSpellSlot;
    // Dungeon stats
    if (updates.highestFloor !== undefined) remoteUpdates.highest_floor = updates.highestFloor;
    if (updates.totalKills !== undefined) remoteUpdates.total_kills = updates.totalKills;

    if (Object.keys(remoteUpdates).length > 0) {
      // Use upsert to create row if it doesn't exist
      const { error } = await supabase
        .from('players')
        .upsert({
          user_id: userId,
          ...remoteUpdates
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Push player update failed:', error);
      }
    }
  } catch (error) {
    console.error('Push player update error:', error);
  }
}

// ============ Board Sync ============
export async function syncBoard() {
  const userId = getUserId();
  if (!userId) return null;

  try {
    // Get remote board
    const { data: remoteBoard, error } = await supabase
      .from('board')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote board:', error);
      return null;
    }

    // Get local board
    const localBoard = await db.board.get(1);

    if (remoteBoard) {
      // Remote exists, update local
      await db.board.update(1, {
        columns: remoteBoard.columns,
        updatedAt: remoteBoard.updated_at
      });
      return remoteBoard;
    } else if (localBoard) {
      // Push local board to remote
      await supabase.from('board').insert({
        user_id: userId,
        columns: localBoard.columns
      });
    }

    return localBoard;
  } catch (error) {
    console.error('Sync board error:', error);
    return null;
  }
}

export async function pushBoardUpdate(columns) {
  const userId = getUserId();
  if (!userId) return;

  try {
    // Upsert the board (insert if not exists, update if exists)
    await supabase
      .from('board')
      .upsert({
        user_id: userId,
        columns: columns,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  } catch (error) {
    console.error('Push board update error:', error);
  }
}

// ============ Tasks Sync ============
export async function syncTasks() {
  const userId = getUserId();
  if (!userId) {
    console.log('No user ID for task sync');
    return [];
  }

  try {
    console.log('Syncing tasks for user:', userId);

    // Get local tasks first
    const localTasks = await db.tasks.toArray();
    console.log('Local tasks:', localTasks.length);

    // Try to fetch remote tasks
    const { data: remoteTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    if (error) {
      console.error('Error fetching remote tasks:', error);
      // Don't clear local data on error - just return local tasks
      return localTasks;
    }

    console.log('Remote tasks:', remoteTasks?.length || 0);

    // Case 1: Remote has tasks - import them (they're the source of truth after cache clear)
    if (remoteTasks && remoteTasks.length > 0) {
      console.log('Importing tasks from remote...');
      await db.tasks.clear();
      for (const rt of remoteTasks) {
        await db.tasks.add({
          remoteId: rt.id, // Store Supabase UUID for sync
          status: rt.status || 'todo',
          title: rt.title,
          description: rt.description || '',
          priority: rt.priority || 'medium',
          dueDate: rt.due_date,
          completed: rt.completed || false,
          completedAt: rt.completed_at,
          timeSpent: rt.time_spent || 0,
          activeStartTime: rt.active_start_time,
          order: rt.sort_order || 0,
          subtasks: rt.subtasks || [],
          tags: rt.tags || [],
          createdAt: rt.created_at,
          updatedAt: rt.updated_at
        });
      }
      console.log('Imported', remoteTasks.length, 'tasks from remote');
      return remoteTasks;
    }

    // Case 2: Remote is empty but local has tasks - push to remote
    if (localTasks.length > 0) {
      console.log('Pushing local tasks to remote...');
      for (const lt of localTasks) {
        const { error: insertError } = await supabase.from('tasks').insert({
          user_id: userId,
          status: lt.status || 'todo',
          title: lt.title,
          description: lt.description || '',
          priority: lt.priority || 'medium',
          due_date: lt.dueDate,
          completed: lt.completed || false,
          completed_at: lt.completedAt,
          time_spent: lt.timeSpent || 0,
          active_start_time: lt.activeStartTime,
          sort_order: lt.order || 0,
          subtasks: lt.subtasks || [],
          tags: lt.tags || []
        });
        if (insertError) {
          console.error('Error pushing task to remote:', insertError);
        }
      }
      console.log('Pushed', localTasks.length, 'tasks to remote');
    }

    return localTasks;
  } catch (error) {
    console.error('Sync tasks error:', error);
    // Return local tasks on any error - don't lose data
    const localTasks = await db.tasks.toArray();
    return localTasks;
  }
}

export async function pushTaskCreate(localTaskId, task) {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        status: task.status || 'todo',
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        due_date: task.dueDate,
        completed: task.completed || false,
        time_spent: task.timeSpent || 0,
        sort_order: task.order || 0,
        subtasks: task.subtasks || [],
        tags: task.tags || []
      })
      .select()
      .single();

    if (error) {
      console.error('Push task create error:', error);
      return null;
    }

    // Store the remote UUID in local task for future syncs
    if (data?.id) {
      await db.tasks.update(localTaskId, { remoteId: data.id });
      console.log('Stored remoteId', data.id, 'for local task', localTaskId);
    }

    return data;
  } catch (error) {
    console.error('Push task create error:', error);
    return null;
  }
}

export async function pushTaskUpdate(localTaskId, updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    // Get the remote UUID from local task
    const localTask = await db.tasks.get(localTaskId);
    if (!localTask?.remoteId) {
      console.log('No remoteId for task', localTaskId, '- skipping remote update');
      return;
    }

    const remoteUpdates = {};
    if (updates.status !== undefined) remoteUpdates.status = updates.status;
    if (updates.title !== undefined) remoteUpdates.title = updates.title;
    if (updates.description !== undefined) remoteUpdates.description = updates.description;
    if (updates.priority !== undefined) remoteUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) remoteUpdates.due_date = updates.dueDate;
    if (updates.completed !== undefined) remoteUpdates.completed = updates.completed;
    if (updates.completedAt !== undefined) remoteUpdates.completed_at = updates.completedAt;
    if (updates.timeSpent !== undefined) remoteUpdates.time_spent = updates.timeSpent;
    if (updates.activeStartTime !== undefined) remoteUpdates.active_start_time = updates.activeStartTime;
    if (updates.order !== undefined) remoteUpdates.sort_order = updates.order;

    if (Object.keys(remoteUpdates).length > 0) {
      await supabase
        .from('tasks')
        .update(remoteUpdates)
        .eq('id', localTask.remoteId)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Push task update error:', error);
  }
}

export async function pushTaskDelete(remoteId) {
  const userId = getUserId();
  if (!userId || !remoteId) return;

  try {
    await supabase
      .from('tasks')
      .delete()
      .eq('id', remoteId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Push task delete error:', error);
  }
}

// ============ Expeditions Sync ============
export async function pushExpeditionCreate(expedition) {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('expeditions')
      .insert({
        user_id: userId,
        date: expedition.date,
        duration: expedition.duration,
        xp_earned: expedition.xpEarned,
        goal_completed: expedition.goalCompleted
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Push expedition create error:', error);
    return null;
  }
}

// ============ Avatar Sync ============
export async function syncAvatar() {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data: remoteAvatar, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote avatar:', error);
      return null;
    }

    const localAvatar = await db.avatar.get(1);

    if (remoteAvatar) {
      // Remote exists, update local
      const avatar = {
        gender: remoteAvatar.gender || 'neutral',
        skinTone: remoteAvatar.skin_tone || 'medium',
        hairStyle: remoteAvatar.hair_style || 'default',
        hairColor: remoteAvatar.hair_color || 'brown',
        outfit: remoteAvatar.outfit || 'casual',
        accessory: remoteAvatar.accessory || 'none',
        equippedTitle: remoteAvatar.equipped_title || 'rookie'
      };
      await db.avatar.update(1, avatar);
      return avatar;
    } else if (localAvatar) {
      // Push local avatar to remote
      await supabase.from('avatars').insert({
        user_id: userId,
        gender: localAvatar.gender || 'neutral',
        skin_tone: localAvatar.skinTone,
        hair_style: localAvatar.hairStyle,
        hair_color: localAvatar.hairColor,
        outfit: localAvatar.outfit,
        accessory: localAvatar.accessory,
        equipped_title: localAvatar.equippedTitle
      });
    }

    return localAvatar;
  } catch (error) {
    console.error('Sync avatar error:', error);
    return null;
  }
}

export async function pushAvatarUpdate(updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    const remoteUpdates = {};
    if (updates.gender !== undefined) remoteUpdates.gender = updates.gender;
    if (updates.skinTone !== undefined) remoteUpdates.skin_tone = updates.skinTone;
    if (updates.hairStyle !== undefined) remoteUpdates.hair_style = updates.hairStyle;
    if (updates.hairColor !== undefined) remoteUpdates.hair_color = updates.hairColor;
    if (updates.outfit !== undefined) remoteUpdates.outfit = updates.outfit;
    if (updates.accessory !== undefined) remoteUpdates.accessory = updates.accessory;
    if (updates.equippedTitle !== undefined) remoteUpdates.equipped_title = updates.equippedTitle;

    if (Object.keys(remoteUpdates).length > 0) {
      await supabase
        .from('avatars')
        .update(remoteUpdates)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Push avatar update error:', error);
  }
}

// ============ Settings Sync ============
export async function syncSettings() {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data: remoteSettings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote settings:', error);
      return null;
    }

    if (remoteSettings) {
      const settings = {
        theme: remoteSettings.theme,
        accentColor: remoteSettings.accent_color,
        navMode: remoteSettings.nav_mode,
        dailyExpeditionGoal: remoteSettings.daily_expedition_goal,
        soundEnabled: remoteSettings.sound_enabled
      };
      await db.settings.update(1, settings);
      return settings;
    }

    return null;
  } catch (error) {
    console.error('Sync settings error:', error);
    return null;
  }
}

export async function pushSettingsUpdate(updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    const remoteUpdates = {};
    if (updates.theme !== undefined) remoteUpdates.theme = updates.theme;
    if (updates.accentColor !== undefined) remoteUpdates.accent_color = updates.accentColor;
    if (updates.navMode !== undefined) remoteUpdates.nav_mode = updates.navMode;
    if (updates.dailyExpeditionGoal !== undefined) remoteUpdates.daily_expedition_goal = updates.dailyExpeditionGoal;
    if (updates.soundEnabled !== undefined) remoteUpdates.sound_enabled = updates.soundEnabled;

    if (Object.keys(remoteUpdates).length > 0) {
      await supabase
        .from('settings')
        .update(remoteUpdates)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Push settings update error:', error);
  }
}

// ============ Dungeon Sync ============
export async function syncDungeon() {
  const userId = getUserId();
  if (!userId) return null;

  try {
    // Get local dungeon data
    const localDungeon = await db.dungeon.get(1);

    // Try to get remote dungeon
    const { data: remoteDungeon, error } = await supabase
      .from('dungeon')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('syncDungeon - local:', localDungeon);
    console.log('syncDungeon - remote:', remoteDungeon);
    console.log('syncDungeon - error:', error);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote dungeon:', error);
      return localDungeon;
    }

    // Check if local looks like fresh defaults (just reset)
    const localIsDefault = !localDungeon || (
      (localDungeon.gold || 0) === 0 &&
      (localDungeon.totalGoldEarned || 0) === 0 &&
      (localDungeon.totalRuns || 0) <= 1 &&
      (!localDungeon.customSpells || localDungeon.customSpells.length === 0 || !localDungeon.customSpells[0])
    );

    // Check if remote has real data
    const remoteHasData = remoteDungeon && (
      (remoteDungeon.gold || 0) > 0 ||
      (remoteDungeon.total_gold_earned || 0) > 0 ||
      (remoteDungeon.total_runs || 0) > 0 ||
      (remoteDungeon.custom_spells && remoteDungeon.custom_spells.length > 0 && remoteDungeon.custom_spells[0])
    );

    // If local is default/fresh and remote has data, restore from remote
    if (remoteDungeon && localIsDefault && remoteHasData) {
      console.log('Local is fresh, restoring from cloud backup...');
      const restored = {
        healthPotions: remoteDungeon.health_potions || 3,
        gold: remoteDungeon.gold || 0,
        totalGoldEarned: remoteDungeon.total_gold_earned || 0,
        highestFloor: remoteDungeon.highest_floor || 0,
        totalRuns: remoteDungeon.total_runs || 0,
        totalKills: remoteDungeon.total_kills || 0,
        bossesDefeated: remoteDungeon.bosses_defeated || 0,
        upgrades: remoteDungeon.upgrades || [],
        maxHpBonus: remoteDungeon.max_hp_bonus || 0,
        bonusDamage: remoteDungeon.bonus_damage || 0,
        potionBonus: remoteDungeon.potion_bonus || 0,
        critBonus: remoteDungeon.crit_bonus || 0,
        defenseBonus: remoteDungeon.defense_bonus || 0,
        maxMpBonus: remoteDungeon.max_mp_bonus || 0,
        customSpells: remoteDungeon.custom_spells || [],
        purchasedSpellSlot: remoteDungeon.purchased_spell_slot || false
      };
      await db.dungeon.update(1, restored);
      console.log('Dungeon data restored from cloud!', restored);
      return restored;
    }

    // If remote exists, merge (take higher/better values)
    if (remoteDungeon) {
      const merged = {
        healthPotions: Math.max(localDungeon?.healthPotions || 0, remoteDungeon.health_potions || 0),
        gold: Math.max(localDungeon?.gold || 0, remoteDungeon.gold || 0),
        totalGoldEarned: Math.max(localDungeon?.totalGoldEarned || 0, remoteDungeon.total_gold_earned || 0),
        highestFloor: Math.max(localDungeon?.highestFloor || 0, remoteDungeon.highest_floor || 0),
        totalRuns: Math.max(localDungeon?.totalRuns || 0, remoteDungeon.total_runs || 0),
        totalKills: Math.max(localDungeon?.totalKills || 0, remoteDungeon.total_kills || 0),
        bossesDefeated: Math.max(localDungeon?.bossesDefeated || 0, remoteDungeon.bosses_defeated || 0),
        upgrades: (remoteDungeon.upgrades?.length > (localDungeon?.upgrades?.length || 0))
          ? remoteDungeon.upgrades
          : (localDungeon?.upgrades || []),
        maxHpBonus: Math.max(localDungeon?.maxHpBonus || 0, remoteDungeon.max_hp_bonus || 0),
        bonusDamage: Math.max(localDungeon?.bonusDamage || 0, remoteDungeon.bonus_damage || 0),
        potionBonus: Math.max(localDungeon?.potionBonus || 0, remoteDungeon.potion_bonus || 0),
        critBonus: Math.max(localDungeon?.critBonus || 0, remoteDungeon.crit_bonus || 0),
        defenseBonus: Math.max(localDungeon?.defenseBonus || 0, remoteDungeon.defense_bonus || 0),
        maxMpBonus: Math.max(localDungeon?.maxMpBonus || 0, remoteDungeon.max_mp_bonus || 0),
        customSpells: (remoteDungeon.custom_spells?.[0])
          ? remoteDungeon.custom_spells
          : (localDungeon?.customSpells || []),
        purchasedSpellSlot: remoteDungeon.purchased_spell_slot || localDungeon?.purchasedSpellSlot || false
      };

      // Update local
      await db.dungeon.update(1, merged);

      // Update remote with merged data
      await supabase
        .from('dungeon')
        .update({
          health_potions: merged.healthPotions,
          gold: merged.gold,
          total_gold_earned: merged.totalGoldEarned,
          highest_floor: merged.highestFloor,
          total_runs: merged.totalRuns,
          total_kills: merged.totalKills,
          bosses_defeated: merged.bossesDefeated,
          upgrades: merged.upgrades,
          max_hp_bonus: merged.maxHpBonus,
          bonus_damage: merged.bonusDamage,
          potion_bonus: merged.potionBonus,
          crit_bonus: merged.critBonus,
          defense_bonus: merged.defenseBonus,
          max_mp_bonus: merged.maxMpBonus,
          custom_spells: merged.customSpells,
          purchased_spell_slot: merged.purchasedSpellSlot
        })
        .eq('user_id', userId);

      console.log('Dungeon data synced and merged');
      return merged;
    } else if (localDungeon) {
      // No remote data, push local to remote
      const { data, error: insertError } = await supabase.from('dungeon').upsert({
        user_id: userId,
        health_potions: localDungeon.healthPotions || 0,
        gold: localDungeon.gold || 0,
        total_gold_earned: localDungeon.totalGoldEarned || 0,
        highest_floor: localDungeon.highestFloor || 0,
        total_runs: localDungeon.totalRuns || 0,
        total_kills: localDungeon.totalKills || 0,
        bosses_defeated: localDungeon.bossesDefeated || 0,
        upgrades: localDungeon.upgrades || [],
        max_hp_bonus: localDungeon.maxHpBonus || 0,
        bonus_damage: localDungeon.bonusDamage || 0,
        potion_bonus: localDungeon.potionBonus || 0,
        crit_bonus: localDungeon.critBonus || 0,
        defense_bonus: localDungeon.defenseBonus || 0,
        max_mp_bonus: localDungeon.maxMpBonus || 0,
        custom_spells: localDungeon.customSpells || [],
        purchased_spell_slot: localDungeon.purchasedSpellSlot || false
      }, { onConflict: 'user_id' }).select();

      if (insertError) {
        console.error('Dungeon push FAILED:', insertError);
      } else {
        console.log('Dungeon data pushed to remote:', data);
      }
    }

    return localDungeon;
  } catch (error) {
    console.error('Sync dungeon error:', error);
    return null;
  }
}

export async function pushDungeonUpdate(updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    const remoteUpdates = {};
    if (updates.healthPotions !== undefined) remoteUpdates.health_potions = updates.healthPotions;
    if (updates.gold !== undefined) remoteUpdates.gold = updates.gold;
    if (updates.totalGoldEarned !== undefined) remoteUpdates.total_gold_earned = updates.totalGoldEarned;
    if (updates.highestFloor !== undefined) remoteUpdates.highest_floor = updates.highestFloor;
    if (updates.totalRuns !== undefined) remoteUpdates.total_runs = updates.totalRuns;
    if (updates.totalKills !== undefined) remoteUpdates.total_kills = updates.totalKills;
    if (updates.bossesDefeated !== undefined) remoteUpdates.bosses_defeated = updates.bossesDefeated;
    if (updates.upgrades !== undefined) remoteUpdates.upgrades = updates.upgrades;
    if (updates.maxHpBonus !== undefined) remoteUpdates.max_hp_bonus = updates.maxHpBonus;
    if (updates.bonusDamage !== undefined) remoteUpdates.bonus_damage = updates.bonusDamage;
    if (updates.potionBonus !== undefined) remoteUpdates.potion_bonus = updates.potionBonus;
    if (updates.critBonus !== undefined) remoteUpdates.crit_bonus = updates.critBonus;
    if (updates.defenseBonus !== undefined) remoteUpdates.defense_bonus = updates.defenseBonus;
    if (updates.maxMpBonus !== undefined) remoteUpdates.max_mp_bonus = updates.maxMpBonus;
    if (updates.customSpells !== undefined) remoteUpdates.custom_spells = updates.customSpells;
    if (updates.purchasedSpellSlot !== undefined) remoteUpdates.purchased_spell_slot = updates.purchasedSpellSlot;

    if (Object.keys(remoteUpdates).length > 0) {
      // Upsert to handle case where row doesn't exist yet
      const { data, error } = await supabase
        .from('dungeon')
        .upsert({
          user_id: userId,
          ...remoteUpdates
        }, { onConflict: 'user_id' })
        .select();

      if (error) {
        console.error('Push dungeon update FAILED:', error);
      } else {
        console.log('Push dungeon update SUCCESS:', data);
      }
    }
  } catch (error) {
    console.error('Push dungeon update error:', error);
  }
}

// ============ Full Sync ============
export async function fullSync() {
  const userId = getUserId();
  if (!userId) {
    console.log('No user logged in, skipping sync');
    return;
  }

  console.log('Starting full sync for user:', userId);

  // Check if this is a different user than last time
  const lastUserId = getLastUserId();
  if (lastUserId && lastUserId !== userId) {
    console.log('Different user detected! Previous:', lastUserId, 'Current:', userId);
    // Clear local data and reinitialize
    await clearLocalData();
    // Reinitialize DB with defaults
    const { initializeDB } = await import('../db/index.js');
    await initializeDB();
  }

  // Update the stored user ID
  setLastUserId(userId);

  try {
    await syncPlayer();
    await syncAvatar();
    await syncSettings();
    await syncBoard();
    await syncTasks();
    await syncDungeon();
    console.log('Full sync complete');
  } catch (error) {
    console.error('Full sync error:', error);
  }
}
