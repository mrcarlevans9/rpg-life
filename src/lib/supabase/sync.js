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
export async function syncPlayer() {
  const userId = getUserId();
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
      return null;
    }

    // If remote exists, merge (take higher values)
    if (remotePlayer) {
      const merged = {
        totalXP: Math.max(localPlayer?.totalXP || 0, remotePlayer.total_xp || 0),
        currentStreak: Math.max(localPlayer?.currentStreak || 0, remotePlayer.current_streak || 0),
        longestStreak: Math.max(localPlayer?.longestStreak || 0, remotePlayer.longest_streak || 0),
        totalTasksCompleted: Math.max(localPlayer?.totalTasksCompleted || 0, remotePlayer.total_tasks_completed || 0),
        totalExpeditionMinutes: Math.max(localPlayer?.totalExpeditionMinutes || 0, remotePlayer.total_expedition_minutes || 0),
        lastActiveDate: localPlayer?.lastActiveDate || remotePlayer.last_active_date
      };

      // Update local
      await db.player.update(1, merged);

      // Update remote
      await supabase
        .from('players')
        .update({
          total_xp: merged.totalXP,
          current_streak: merged.currentStreak,
          longest_streak: merged.longestStreak,
          total_tasks_completed: merged.totalTasksCompleted,
          total_expedition_minutes: merged.totalExpeditionMinutes,
          last_active_date: merged.lastActiveDate
        })
        .eq('user_id', userId);

      return merged;
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
    if (updates.totalXP !== undefined) remoteUpdates.total_xp = updates.totalXP;
    if (updates.currentStreak !== undefined) remoteUpdates.current_streak = updates.currentStreak;
    if (updates.longestStreak !== undefined) remoteUpdates.longest_streak = updates.longestStreak;
    if (updates.totalTasksCompleted !== undefined) remoteUpdates.total_tasks_completed = updates.totalTasksCompleted;
    if (updates.totalExpeditionMinutes !== undefined) remoteUpdates.total_expedition_minutes = updates.totalExpeditionMinutes;
    if (updates.lastActiveDate !== undefined) remoteUpdates.last_active_date = updates.lastActiveDate;

    if (Object.keys(remoteUpdates).length > 0) {
      await supabase
        .from('players')
        .update(remoteUpdates)
        .eq('user_id', userId);
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

export async function pushTaskCreate(task) {
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
    return data;
  } catch (error) {
    console.error('Push task create error:', error);
    return null;
  }
}

export async function pushTaskUpdate(taskId, updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
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
        .eq('id', taskId)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Push task update error:', error);
  }
}

export async function pushTaskDelete(taskId) {
  const userId = getUserId();
  if (!userId) return;

  try {
    await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
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

// ============ Full Sync ============
export async function fullSync() {
  const userId = getUserId();
  if (!userId) {
    console.log('No user logged in, skipping sync');
    return;
  }

  console.log('Starting full sync...');

  try {
    await syncPlayer();
    await syncSettings();
    await syncBoard();
    await syncTasks();
    console.log('Full sync complete');
  } catch (error) {
    console.error('Full sync error:', error);
  }
}
