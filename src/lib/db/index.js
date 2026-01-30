import { db, ACHIEVEMENTS, UNLOCKABLES, TITLES } from './schema.js';

// Initialize database with default data
export async function initializeDB() {
  const playerCount = await db.player.count();

  if (playerCount === 0) {
    // Create default player
    await db.player.add({
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      totalTasksCompleted: 0,
      totalExpeditionMinutes: 0,
      createdAt: new Date().toISOString()
    });

    // Create default avatar
    await db.avatar.add({
      skinTone: 'medium',
      hairStyle: 'default',
      hairColor: 'brown',
      outfit: 'casual',
      accessory: 'none',
      equippedTitle: 'rookie'
    });

    // Create default settings
    await db.settings.add({
      theme: 'dark',
      accentColor: '#6366f1',
      navMode: 'sidebar',
      dailyExpeditionGoal: 20,
      soundEnabled: false
    });

    // Initialize achievements as locked
    for (const achievement of ACHIEVEMENTS) {
      await db.achievements.add({
        key: achievement.key,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        type: achievement.type,
        target: achievement.target || null,
        progress: 0,
        unlockedAt: null
      });
    }

    // Initialize unlockables
    const unlockableTypes = ['hairStyles', 'hairColors', 'skinTones', 'outfits', 'accessories'];
    for (const type of unlockableTypes) {
      for (const item of UNLOCKABLES[type]) {
        await db.unlockables.add({
          type,
          key: item.key,
          name: item.name,
          level: item.level,
          color: item.color || null,
          unlocked: item.level === 1
        });
      }
    }

    // Create a default project
    await db.projects.add({
      name: 'My First Project',
      description: 'Welcome to RPG Life!',
      color: '#6366f1',
      order: 0,
      archived: false,
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in-progress', name: 'In Progress', order: 1 },
        { id: 'done', name: 'Done', order: 2 }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('Database initialized with default data');
  }
}

// Export db and constants
export { db, ACHIEVEMENTS, UNLOCKABLES, TITLES };
