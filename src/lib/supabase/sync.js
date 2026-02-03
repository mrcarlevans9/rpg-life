import { supabase } from './client.js';
import { db } from '../db/index.js';
import { get } from 'svelte/store';
import { authUser } from '../stores/auth.js';

// Check if user is authenticated
function getUserId() {
  const user = get(authUser);
  return user?.id || null;
}

// ============ Player Sync ============
// On sync: Remote is source of truth. Pull from remote, update local.
// Changes are pushed via pushPlayerUpdate when they happen.
export async function syncPlayer() {
  const userId = getUserId();
  console.log('syncPlayer called, userId:', userId);
  if (!userId) return null;

  try {
    // Get local player data
    const localPlayer = await db.player.get(1);

    // Try to get remote player
    const { data: remotePlayer, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote player:', error);
      return localPlayer; // Return local on error
    }

    // If remote exists, use it as source of truth
    if (remotePlayer) {
      const playerData = {
        username: remotePlayer.username || 'Adventurer',
        totalXP: remotePlayer.total_xp || 0,
        currentStreak: remotePlayer.current_streak || 0,
        longestStreak: remotePlayer.longest_streak || 0,
        totalTasksCompleted: remotePlayer.total_tasks_completed || 0,
        totalExpeditionMinutes: remotePlayer.total_expedition_minutes || 0,
        lastActiveDate: remotePlayer.last_active_date,
        gold: remotePlayer.gold || 0,
        healthPotions: remotePlayer.health_potions || 0,
        customSpells: remotePlayer.custom_spells || [],
        purchasedSpellSlot: remotePlayer.purchased_spell_slot || false,
        highestFloor: remotePlayer.highest_floor || 0,
        totalKills: remotePlayer.total_kills || 0
      };

      // Update local with remote data
      await db.player.update(1, playerData);
      console.log('Player synced from remote:', playerData.username, playerData.gold, 'gold');
      return playerData;
    } else {
      // No remote player exists - this is a NEW user
      // Create with DEFAULTS, not local data (local data may belong to different user)
      console.log('No remote player found, creating new player with defaults');

      const defaultPlayer = {
        username: 'Adventurer',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTasksCompleted: 0,
        totalExpeditionMinutes: 0,
        lastActiveDate: null,
        gold: 0,
        healthPotions: 0,
        customSpells: [],
        purchasedSpellSlot: false,
        highestFloor: 0,
        totalKills: 0
      };

      // Update local with defaults (clears any previous user's data)
      await db.player.update(1, defaultPlayer);

      // Create remote player with defaults
      const { error: insertError } = await supabase.from('players').insert({
        user_id: userId,
        username: 'Adventurer',
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        total_tasks_completed: 0,
        total_expedition_minutes: 0,
        last_active_date: null,
        gold: 0,
        health_potions: 0,
        custom_spells: [],
        purchased_spell_slot: false,
        highest_floor: 0,
        total_kills: 0
      });

      if (insertError) {
        console.error('Failed to create remote player:', insertError);
      } else {
        console.log('New player created successfully');
      }
      return defaultPlayer;
    }
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
    } else {
      // No remote board - create with defaults for new user
      const defaultBoard = {
        columns: ['To Do', 'In Progress', 'Done'],
        updatedAt: new Date().toISOString()
      };

      await db.board.update(1, defaultBoard);

      await supabase.from('board').insert({
        user_id: userId,
        columns: defaultBoard.columns
      });

      return defaultBoard;
    }
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

    // Case 2: Remote is empty - this is a new user, clear local tasks (they belong to previous user)
    console.log('No remote tasks found - clearing local tasks for new user');
    await db.tasks.clear();
    return [];
  } catch (error) {
    console.error('Sync tasks error:', error);
    return [];
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
    } else {
      // No remote avatar - create with defaults for new user
      const defaultAvatar = {
        gender: 'neutral',
        skinTone: 'medium',
        hairStyle: 'default',
        hairColor: 'brown',
        outfit: 'casual',
        accessory: 'none',
        equippedTitle: 'rookie'
      };

      await db.avatar.update(1, defaultAvatar);

      await supabase.from('avatars').insert({
        user_id: userId,
        gender: 'neutral',
        skin_tone: 'medium',
        hair_style: 'default',
        hair_color: 'brown',
        outfit: 'casual',
        accessory: 'none',
        equipped_title: 'rookie'
      });

      return defaultAvatar;
    }
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
// On sync: Remote is source of truth. Pull from remote, update local.
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

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching remote dungeon:', error);
      return localDungeon;
    }

    // If remote exists, use it as source of truth
    if (remoteDungeon) {
      const dungeonData = {
        healthPotions: remoteDungeon.health_potions || 0,
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

      // Update local with remote data
      await db.dungeon.update(1, dungeonData);
      console.log('Dungeon synced from remote:', dungeonData.gold, 'gold');
      return dungeonData;
    } else {
      // No remote data - this is a NEW user
      // Create with DEFAULTS, not local data (local data may belong to different user)
      console.log('No remote dungeon found, creating new dungeon with defaults');

      const defaultDungeon = {
        healthPotions: 3,
        gold: 0,
        totalGoldEarned: 0,
        highestFloor: 0,
        totalRuns: 0,
        totalKills: 0,
        bossesDefeated: 0,
        upgrades: [],
        maxHpBonus: 0,
        bonusDamage: 0,
        potionBonus: 0,
        critBonus: 0,
        defenseBonus: 0,
        maxMpBonus: 0,
        customSpells: [],
        purchasedSpellSlot: false
      };

      // Update local with defaults (clears any previous user's data)
      await db.dungeon.update(1, defaultDungeon);

      // Create remote dungeon with defaults
      const { error: insertError } = await supabase.from('dungeon').upsert({
        user_id: userId,
        health_potions: 3,
        gold: 0,
        total_gold_earned: 0,
        highest_floor: 0,
        total_runs: 0,
        total_kills: 0,
        bosses_defeated: 0,
        upgrades: [],
        max_hp_bonus: 0,
        bonus_damage: 0,
        potion_bonus: 0,
        crit_bonus: 0,
        defense_bonus: 0,
        max_mp_bonus: 0,
        custom_spells: [],
        purchased_spell_slot: false
      }, { onConflict: 'user_id' });

      if (insertError) {
        console.error('Dungeon create FAILED:', insertError);
      } else {
        console.log('New dungeon created successfully');
      }
      return defaultDungeon;
    }
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
// Simple approach: remote is always source of truth
// On sync, pull from remote. Changes push via individual update functions.
export async function fullSync() {
  const userId = getUserId();
  if (!userId) {
    console.log('No user logged in, skipping sync');
    return;
  }

  console.log('Starting full sync for user:', userId);

  try {
    await syncPlayer();
    await syncAvatar();
    await syncSettings();
    await syncBoard();
    await syncTasks();
    await syncDungeon();
    await syncEquipment();
    console.log('Full sync complete');
  } catch (error) {
    console.error('Full sync error:', error);
  }
}

// ============ Equipment Sync ============
export async function syncEquipment() {
  const userId = getUserId();
  if (!userId) return null;

  try {
    // Get remote equipment
    const { data: remoteEquipment, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching remote equipment:', error);
      return null;
    }

    // Get local equipment
    const localEquipment = await db.equipment.toArray();

    if (remoteEquipment && remoteEquipment.length > 0) {
      // Remote exists - sync to local
      // Clear local and replace with remote
      await db.equipment.clear();

      for (const item of remoteEquipment) {
        await db.equipment.add({
          id: item.local_id,
          remoteId: item.id,
          slot: item.slot,
          rarity: item.rarity,
          name: item.name,
          emoji: item.emoji,
          equipped: item.equipped,
          bonuses: item.bonuses || [],
          tainted: item.tainted || false,
          penalties: item.penalties || []
        });
      }
      console.log(`Synced ${remoteEquipment.length} equipment items from cloud`);
      return remoteEquipment;
    } else if (localEquipment.length > 0) {
      // No remote but local exists - push local to remote
      for (const item of localEquipment) {
        await pushEquipmentCreate(item);
      }
      console.log(`Pushed ${localEquipment.length} local equipment items to cloud`);
      return localEquipment;
    }

    return [];
  } catch (error) {
    console.error('Sync equipment error:', error);
    return null;
  }
}

export async function pushEquipmentCreate(item) {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('equipment')
      .insert({
        user_id: userId,
        local_id: item.id,
        slot: item.slot,
        rarity: item.rarity,
        name: item.name,
        emoji: item.emoji || null,
        equipped: item.equipped || false,
        bonuses: item.bonuses || [],
        tainted: item.tainted || false,
        penalties: item.penalties || []
      })
      .select()
      .single();

    if (error) {
      console.error('Push equipment create failed:', error);
      return null;
    }

    // Update local item with remote ID
    if (data) {
      await db.equipment.update(item.id, { remoteId: data.id });
    }

    return data;
  } catch (error) {
    console.error('Push equipment create error:', error);
    return null;
  }
}

export async function pushEquipmentUpdate(localId, updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    // Get the item to find its remote ID
    const item = await db.equipment.get(localId);
    if (!item) return;

    const remoteUpdates = {};
    if (updates.equipped !== undefined) remoteUpdates.equipped = updates.equipped;
    if (updates.slot !== undefined) remoteUpdates.slot = updates.slot;
    if (updates.name !== undefined) remoteUpdates.name = updates.name;

    if (Object.keys(remoteUpdates).length > 0) {
      remoteUpdates.updated_at = new Date().toISOString();

      if (item.remoteId) {
        // Update by remote ID
        const { error } = await supabase
          .from('equipment')
          .update(remoteUpdates)
          .eq('id', item.remoteId);

        if (error) {
          console.error('Push equipment update failed:', error);
        }
      } else {
        // No remote ID, update by user_id and local_id
        const { error } = await supabase
          .from('equipment')
          .update(remoteUpdates)
          .eq('user_id', userId)
          .eq('local_id', localId);

        if (error) {
          console.error('Push equipment update failed:', error);
        }
      }
    }
  } catch (error) {
    console.error('Push equipment update error:', error);
  }
}

export async function pushEquipmentDelete(localId) {
  const userId = getUserId();
  if (!userId) return;

  try {
    // Get the item to find its remote ID
    const item = await db.equipment.get(localId);

    if (item?.remoteId) {
      // Delete by remote ID
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', item.remoteId);

      if (error) {
        console.error('Push equipment delete failed:', error);
      }
    } else {
      // Delete by user_id and local_id
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('user_id', userId)
        .eq('local_id', localId);

      if (error) {
        console.error('Push equipment delete failed:', error);
      }
    }
  } catch (error) {
    console.error('Push equipment delete error:', error);
  }
}

// ============ Reset Remote Data ============
// Force overwrites all user data in Supabase with defaults
// Used to fix corrupted accounts that have wrong data
export async function resetRemoteData() {
  const userId = getUserId();
  if (!userId) {
    throw new Error('No user logged in');
  }

  console.log('Resetting remote data for user:', userId);

  try {
    // Delete tasks first (they have unique IDs, can't upsert)
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId);
    if (tasksError) console.error('Error deleting tasks:', tasksError);

    // Delete all equipment
    const { error: equipmentError } = await supabase
      .from('equipment')
      .delete()
      .eq('user_id', userId);
    if (equipmentError) console.error('Error deleting equipment:', equipmentError);
    else console.log('Equipment cleared');

    // Delete player_snapshots
    const { error: snapshotError } = await supabase
      .from('player_snapshots')
      .delete()
      .eq('user_id', userId);
    if (snapshotError) console.error('Error deleting snapshots:', snapshotError);

    // Delete all friendships (where user is requester OR addressee)
    const { error: friendsError1 } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', userId);
    if (friendsError1) console.error('Error deleting friendships (requester):', friendsError1);

    const { error: friendsError2 } = await supabase
      .from('friendships')
      .delete()
      .eq('addressee_id', userId);
    if (friendsError2) console.error('Error deleting friendships (addressee):', friendsError2);
    else console.log('Friendships deleted');

    // Delete avatar first then insert fresh (upsert may not update all fields)
    const { error: avatarDeleteError } = await supabase
      .from('avatars')
      .delete()
      .eq('user_id', userId);
    if (avatarDeleteError) console.error('Error deleting avatar:', avatarDeleteError);

    // Force upsert default values for all other tables (overwrites corrupted data)
    const { error: playerError } = await supabase
      .from('players')
      .upsert({
        user_id: userId,
        username: 'Adventurer',
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        total_tasks_completed: 0,
        total_expedition_minutes: 0,
        last_active_date: null,
        gold: 0,
        health_potions: 0,
        custom_spells: [],
        purchased_spell_slot: false,
        highest_floor: 0,
        total_kills: 0
      }, { onConflict: 'user_id' });
    if (playerError) console.error('Error resetting players:', playerError);
    else console.log('Players table reset to defaults');

    const { error: dungeonError } = await supabase
      .from('dungeon')
      .upsert({
        user_id: userId,
        health_potions: 3,
        gold: 0,
        total_gold_earned: 0,
        highest_floor: 0,
        total_runs: 0,
        total_kills: 0,
        bosses_defeated: 0,
        upgrades: [],
        max_hp_bonus: 0,
        bonus_damage: 0,
        potion_bonus: 0,
        crit_bonus: 0,
        defense_bonus: 0,
        max_mp_bonus: 0,
        custom_spells: [],
        purchased_spell_slot: false
      }, { onConflict: 'user_id' });
    if (dungeonError) console.error('Error resetting dungeon:', dungeonError);
    else console.log('Dungeon table reset to defaults');

    // Insert fresh avatar (we deleted it above)
    const { error: avatarError } = await supabase
      .from('avatars')
      .insert({
        user_id: userId,
        gender: 'neutral',
        skin_tone: 'medium',
        hair_style: 'default',
        hair_color: 'brown',
        outfit: 'casual',
        accessory: 'none',
        equipped_title: 'rookie'
      });
    if (avatarError) console.error('Error resetting avatars:', avatarError);
    else console.log('Avatars table reset to defaults');

    const { error: boardError } = await supabase
      .from('board')
      .upsert({
        user_id: userId,
        columns: ['To Do', 'In Progress', 'Done']
      }, { onConflict: 'user_id' });
    if (boardError) console.error('Error resetting board:', boardError);
    else console.log('Board table reset to defaults');

    // Clear local data as well
    await db.player.update(1, {
      username: 'Adventurer',
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTasksCompleted: 0,
      totalExpeditionMinutes: 0,
      lastActiveDate: null,
      gold: 0,
      healthPotions: 0,
      customSpells: [],
      purchasedSpellSlot: false,
      highestFloor: 0,
      totalKills: 0
    });

    await db.dungeon.update(1, {
      healthPotions: 3,
      gold: 0,
      totalGoldEarned: 0,
      highestFloor: 0,
      totalRuns: 0,
      totalKills: 0,
      bossesDefeated: 0,
      upgrades: [],
      maxHpBonus: 0,
      bonusDamage: 0,
      potionBonus: 0,
      critBonus: 0,
      defenseBonus: 0,
      maxMpBonus: 0,
      customSpells: [],
      purchasedSpellSlot: false
    });

    await db.avatar.update(1, {
      gender: 'neutral',
      skinTone: 'medium',
      hairStyle: 'default',
      hairColor: 'brown',
      outfit: 'casual',
      accessory: 'none',
      equippedTitle: 'rookie'
    });

    await db.tasks.clear();
    await db.equipment.clear();
    await db.pendingLoot.clear();
    await db.board.update(1, {
      columns: ['To Do', 'In Progress', 'Done'],
      updatedAt: new Date().toISOString()
    });

    console.log('Reset complete - all data set to defaults');
    return true;
  } catch (error) {
    console.error('Reset remote data error:', error);
    throw error;
  }
}
