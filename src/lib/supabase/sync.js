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

// ============ Projects Sync ============
export async function syncProjects() {
  const userId = getUserId();
  if (!userId) return [];

  try {
    // Get remote projects
    const { data: remoteProjects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    if (error) {
      console.error('Error fetching remote projects:', error);
      return [];
    }

    // Get local projects
    const localProjects = await db.projects.toArray();

    // Simple sync: if remote has projects, use them; otherwise push local
    if (remoteProjects && remoteProjects.length > 0) {
      // Clear local and replace with remote
      await db.projects.clear();
      for (const rp of remoteProjects) {
        await db.projects.add({
          id: rp.id,
          name: rp.name,
          description: rp.description,
          color: rp.color,
          order: rp.sort_order,
          archived: rp.archived,
          columns: rp.columns,
          createdAt: rp.created_at,
          updatedAt: rp.updated_at
        });
      }
      return remoteProjects;
    } else if (localProjects.length > 0) {
      // Push local projects to remote
      for (const lp of localProjects) {
        await supabase.from('projects').insert({
          user_id: userId,
          name: lp.name,
          description: lp.description,
          color: lp.color,
          sort_order: lp.order,
          archived: lp.archived,
          columns: lp.columns
        });
      }
    }

    return localProjects;
  } catch (error) {
    console.error('Sync projects error:', error);
    return [];
  }
}

export async function pushProjectCreate(project) {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: project.name,
        description: project.description,
        color: project.color,
        sort_order: project.order,
        archived: project.archived || false,
        columns: project.columns
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Push project create error:', error);
    return null;
  }
}

export async function pushProjectUpdate(projectId, updates) {
  const userId = getUserId();
  if (!userId) return;

  try {
    const remoteUpdates = {};
    if (updates.name !== undefined) remoteUpdates.name = updates.name;
    if (updates.description !== undefined) remoteUpdates.description = updates.description;
    if (updates.color !== undefined) remoteUpdates.color = updates.color;
    if (updates.order !== undefined) remoteUpdates.sort_order = updates.order;
    if (updates.archived !== undefined) remoteUpdates.archived = updates.archived;
    if (updates.columns !== undefined) remoteUpdates.columns = updates.columns;

    if (Object.keys(remoteUpdates).length > 0) {
      await supabase
        .from('projects')
        .update(remoteUpdates)
        .eq('id', projectId)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Push project update error:', error);
  }
}

export async function pushProjectDelete(projectId) {
  const userId = getUserId();
  if (!userId) return;

  try {
    await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Push project delete error:', error);
  }
}

// ============ Tasks Sync ============
export async function syncTasks() {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const { data: remoteTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    if (error) {
      console.error('Error fetching remote tasks:', error);
      return [];
    }

    const localTasks = await db.tasks.toArray();

    if (remoteTasks && remoteTasks.length > 0) {
      await db.tasks.clear();
      for (const rt of remoteTasks) {
        await db.tasks.add({
          id: rt.id,
          projectId: rt.project_id,
          columnId: rt.column_id,
          title: rt.title,
          description: rt.description,
          priority: rt.priority,
          dueDate: rt.due_date,
          completed: rt.completed,
          completedAt: rt.completed_at,
          order: rt.sort_order,
          tags: rt.tags,
          createdAt: rt.created_at,
          updatedAt: rt.updated_at
        });
      }
      return remoteTasks;
    } else if (localTasks.length > 0) {
      for (const lt of localTasks) {
        await supabase.from('tasks').insert({
          user_id: userId,
          project_id: lt.projectId,
          column_id: lt.columnId,
          title: lt.title,
          description: lt.description,
          priority: lt.priority,
          due_date: lt.dueDate,
          completed: lt.completed,
          completed_at: lt.completedAt,
          sort_order: lt.order,
          tags: lt.tags
        });
      }
    }

    return localTasks;
  } catch (error) {
    console.error('Sync tasks error:', error);
    return [];
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
        project_id: task.projectId,
        column_id: task.columnId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.dueDate,
        completed: task.completed || false,
        sort_order: task.order
      })
      .select()
      .single();

    if (error) throw error;
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
    if (updates.columnId !== undefined) remoteUpdates.column_id = updates.columnId;
    if (updates.title !== undefined) remoteUpdates.title = updates.title;
    if (updates.description !== undefined) remoteUpdates.description = updates.description;
    if (updates.priority !== undefined) remoteUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) remoteUpdates.due_date = updates.dueDate;
    if (updates.completed !== undefined) remoteUpdates.completed = updates.completed;
    if (updates.completedAt !== undefined) remoteUpdates.completed_at = updates.completedAt;
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
    await syncProjects();
    await syncTasks();
    console.log('Full sync complete');
  } catch (error) {
    console.error('Full sync error:', error);
  }
}
