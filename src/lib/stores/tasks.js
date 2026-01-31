import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';
import { addXP, calculateTaskXP, calculateSubtaskXP } from '../services/xpService.js';
import { xpGainNotification, updateStreak, playerData } from './player.js';
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

// All tasks from DB
export const tasksData = createLiveQueryStore(() => db.tasks.toArray(), []);

// Tags from DB
export const tagsData = createLiveQueryStore(() => db.tags.toArray(), []);

// Active task timer store (client-side only)
export const activeTaskTimer = writable({
  taskId: null,
  startTime: null,
  elapsed: 0
});

// Get all tasks for the bounty board
export function getAllTasks() {
  return createLiveQueryStore(
    () => db.tasks.orderBy('order').toArray(),
    []
  );
}

// Get tasks due today
export const todaysTasks = createLiveQueryStore(() => {
  const today = new Date().toISOString().split('T')[0];
  return db.tasks
    .where('dueDate')
    .equals(today)
    .and(task => !task.completed)
    .toArray();
}, []);

// Get overdue tasks
export const overdueTasks = createLiveQueryStore(() => {
  const today = new Date().toISOString().split('T')[0];
  return db.tasks
    .where('dueDate')
    .below(today)
    .and(task => !task.completed)
    .toArray();
}, []);

// Create a new task/bounty
export async function createTask(taskData) {
  const count = await db.tasks.count();

  const id = await db.tasks.add({
    status: taskData.status || 'todo',
    title: taskData.title,
    description: taskData.description || '',
    subtasks: taskData.subtasks || [],
    tags: taskData.tags || [],
    dueDate: taskData.dueDate || null,
    priority: taskData.priority || 'medium',
    recurring: taskData.recurring || null,
    completed: false,
    completedAt: null,
    timeSpent: 0, // Total time spent in minutes
    activeStartTime: null, // When the task was set to active
    order: count,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return id;
}

// Update a task
export async function updateTask(id, updates) {
  await db.tasks.update(id, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

// Change task status
export async function setTaskStatus(taskId, newStatus) {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const updates = {
    status: newStatus,
    updatedAt: new Date().toISOString()
  };

  // If setting to active, start the timer
  if (newStatus === 'active') {
    updates.activeStartTime = new Date().toISOString();

    // Update the client-side timer store
    activeTaskTimer.set({
      taskId,
      startTime: Date.now(),
      elapsed: task.timeSpent || 0
    });
  }

  // If leaving active status, calculate time spent
  if (task.status === 'active' && newStatus !== 'active' && task.activeStartTime) {
    const startTime = new Date(task.activeStartTime).getTime();
    const elapsed = Math.floor((Date.now() - startTime) / 60000); // minutes
    updates.timeSpent = (task.timeSpent || 0) + elapsed;
    updates.activeStartTime = null;

    // Clear the client-side timer
    activeTaskTimer.set({ taskId: null, startTime: null, elapsed: 0 });
  }

  await db.tasks.update(taskId, updates);
}

// Start working on a task (set to active)
export async function startTask(taskId) {
  // First, pause any currently active task
  const tasks = await db.tasks.where('status').equals('active').toArray();
  for (const activeTask of tasks) {
    if (activeTask.id !== taskId) {
      await setTaskStatus(activeTask.id, 'todo');
    }
  }

  // Now start the new task
  await setTaskStatus(taskId, 'active');
}

// Pause a task (set back to todo)
export async function pauseTask(taskId) {
  await setTaskStatus(taskId, 'todo');
}

// Complete a task and award XP
export async function completeTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task || task.completed) return null;

  // Calculate time spent if task was active
  let finalTimeSpent = task.timeSpent || 0;
  if (task.status === 'active' && task.activeStartTime) {
    const startTime = new Date(task.activeStartTime).getTime();
    const elapsed = Math.floor((Date.now() - startTime) / 60000);
    finalTimeSpent += elapsed;
  }

  const player = await db.player.get(1);
  const xpEarned = calculateTaskXP(task, player?.currentStreak || 0);

  // Mark task as completed
  await db.tasks.update(taskId, {
    completed: true,
    completedAt: new Date().toISOString(),
    status: 'done',
    timeSpent: finalTimeSpent,
    activeStartTime: null,
    updatedAt: new Date().toISOString()
  });

  // Clear the client-side timer if this was the active task
  const timer = get(activeTaskTimer);
  if (timer.taskId === taskId) {
    activeTaskTimer.set({ taskId: null, startTime: null, elapsed: 0 });
  }

  // Update player stats
  await db.player.update(1, {
    totalTasksCompleted: (player?.totalTasksCompleted || 0) + 1
  });

  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  const dailyStat = await db.dailyStats.where('date').equals(today).first();

  if (dailyStat) {
    await db.dailyStats.update(dailyStat.id, {
      tasksCompleted: (dailyStat.tasksCompleted || 0) + 1
    });
  } else {
    await db.dailyStats.add({
      date: today,
      tasksCompleted: 1,
      xpEarned: 0,
      walkMinutes: 0
    });
  }

  // Update streak
  await updateStreak();

  // Add XP
  const xpResult = await addXP(xpEarned, 'task');

  // Trigger notification
  xpGainNotification.set({
    amount: xpEarned,
    source: 'task',
    leveledUp: xpResult?.leveledUp
  });

  // Handle recurring tasks
  if (task.recurring?.enabled) {
    await createRecurringTask(task);
  }

  return { ...xpResult, timeSpent: finalTimeSpent };
}

// Complete a subtask
export async function completeSubtask(taskId, subtaskId) {
  const task = await db.tasks.get(taskId);
  if (!task) return null;

  const subtasks = task.subtasks.map(st =>
    st.id === subtaskId ? { ...st, completed: true } : st
  );

  await db.tasks.update(taskId, {
    subtasks,
    updatedAt: new Date().toISOString()
  });

  // Award subtask XP
  const player = await db.player.get(1);
  const xpEarned = calculateSubtaskXP(player?.currentStreak || 0);

  const xpResult = await addXP(xpEarned, 'subtask');

  xpGainNotification.set({
    amount: xpEarned,
    source: 'subtask',
    leveledUp: xpResult?.leveledUp
  });

  return xpResult;
}

// Uncomplete a subtask
export async function uncompleteSubtask(taskId, subtaskId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const subtasks = task.subtasks.map(st =>
    st.id === subtaskId ? { ...st, completed: false } : st
  );

  await db.tasks.update(taskId, { subtasks, updatedAt: new Date().toISOString() });
}

// Undo task completion (move back to todo)
export async function undoCompleteTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task || !task.completed) return;

  await db.tasks.update(taskId, {
    completed: false,
    completedAt: null,
    status: 'todo',
    updatedAt: new Date().toISOString()
  });
}

// Delete a task
export async function deleteTask(taskId) {
  // Clear timer if deleting active task
  const timer = get(activeTaskTimer);
  if (timer.taskId === taskId) {
    activeTaskTimer.set({ taskId: null, startTime: null, elapsed: 0 });
  }

  await db.tasks.delete(taskId);
}

// Create recurring task instance
async function createRecurringTask(originalTask) {
  const { interval, unit } = originalTask.recurring;

  let nextDate = new Date(originalTask.dueDate || new Date());

  switch (unit) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
  }

  await createTask({
    status: 'todo',
    title: originalTask.title,
    description: originalTask.description,
    priority: originalTask.priority,
    dueDate: nextDate.toISOString().split('T')[0],
    recurring: originalTask.recurring,
    subtasks: originalTask.subtasks.map(st => ({ ...st, completed: false }))
  });
}

// Reorder tasks
export async function reorderTasks(taskIds) {
  for (let i = 0; i < taskIds.length; i++) {
    await db.tasks.update(taskIds[i], { order: i });
  }
}

// Create a tag
export async function createTag(name, color) {
  return db.tags.add({ name, color });
}

// Update a tag
export async function updateTag(id, updates) {
  await db.tags.update(id, updates);
}

// Delete a tag
export async function deleteTag(id) {
  await db.tags.delete(id);
}

// Format time spent as string
export function formatTimeSpent(minutes) {
  if (!minutes || minutes < 1) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}
