import { db, ACHIEVEMENTS, UNLOCKABLES, TITLES, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES } from './schema.js';

// Initialize database with default data
export async function initializeDB() {
  console.log('=== initializeDB called ===');
  console.log('DB isOpen:', db.isOpen());

  // Ensure database is open
  if (!db.isOpen()) {
    await db.open();
    console.log('Database opened');
  }

  // Check existing data
  const playerCount = await db.player.count();
  const taskCount = await db.tasks.count();
  console.log('Player count:', playerCount, 'Task count:', taskCount);

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
      gender: 'neutral',
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

    // Create the global kanban board
    await db.board.add({
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in-progress', name: 'In Progress', order: 1 },
        { id: 'done', name: 'Done', order: 2 }
      ],
      updatedAt: new Date().toISOString()
    });

    // Initialize dungeon data
    await db.dungeon.add({
      healthPotions: 3, // Start with 3 potions
      gold: 0,
      totalGoldEarned: 0,
      highestFloor: 0,
      totalRuns: 0,
      totalKills: 0,
      bossesDefeated: 0,
      upgrades: [], // Array of purchased upgrade keys
      // Calculated stats from upgrades
      maxHpBonus: 0,
      bonusDamage: 0,
      potionBonus: 0,
      critBonus: 0,
      defenseBonus: 0
    });

    console.log('Database initialized with default data');
  }

  // Ensure board exists (for existing users upgrading)
  const boardCount = await db.board.count();
  if (boardCount === 0) {
    await db.board.add({
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in-progress', name: 'In Progress', order: 1 },
        { id: 'done', name: 'Done', order: 2 }
      ],
      updatedAt: new Date().toISOString()
    });
    console.log('Board initialized');
  }

  // Ensure dungeon exists (for existing users upgrading)
  const dungeonCount = await db.dungeon.count();
  if (dungeonCount === 0) {
    await db.dungeon.add({
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
      defenseBonus: 0
    });
    console.log('Dungeon initialized');
  }
}

// Export db and constants
export { db, ACHIEVEMENTS, UNLOCKABLES, TITLES, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES };
