import { writable, derived } from 'svelte/store';

// Queue of notifications to display
const notificationQueue = writable([]);

// Current notification being displayed
export const currentNotification = derived(notificationQueue, $queue => $queue[0] || null);

// Add a notification to the queue
export function addNotification(notification) {
  const id = Date.now();
  const fullNotification = {
    id,
    type: 'info', // info, success, warning, error, xp, levelup, achievement
    duration: 3000,
    ...notification
  };

  notificationQueue.update(queue => [...queue, fullNotification]);

  // Auto-remove after duration
  if (fullNotification.duration > 0) {
    setTimeout(() => {
      removeNotification(id);
    }, fullNotification.duration);
  }

  return id;
}

// Remove a notification by id
export function removeNotification(id) {
  notificationQueue.update(queue => queue.filter(n => n.id !== id));
}

// Clear all notifications
export function clearNotifications() {
  notificationQueue.set([]);
}

// Convenience functions for different notification types
export function showSuccess(message, title = 'Success') {
  return addNotification({ type: 'success', title, message });
}

export function showError(message, title = 'Error') {
  return addNotification({ type: 'error', title, message, duration: 5000 });
}

export function showWarning(message, title = 'Warning') {
  return addNotification({ type: 'warning', title, message });
}

export function showInfo(message, title = 'Info') {
  return addNotification({ type: 'info', title, message });
}

export function showXPGain(amount, source = 'action') {
  return addNotification({
    type: 'xp',
    message: `+${amount} XP`,
    source,
    duration: 2000
  });
}

export function showLevelUp(newLevel) {
  return addNotification({
    type: 'levelup',
    title: 'Level Up!',
    message: `You reached level ${newLevel}!`,
    level: newLevel,
    duration: 5000
  });
}

export function showAchievement(achievement) {
  return addNotification({
    type: 'achievement',
    title: 'Achievement Unlocked!',
    message: achievement.name,
    icon: achievement.icon,
    xpReward: achievement.xpReward,
    duration: 5000
  });
}

export function showUnlock(item) {
  return addNotification({
    type: 'unlock',
    title: 'New Cosmetic Unlocked!',
    message: item.name,
    itemType: item.type,
    duration: 4000
  });
}
