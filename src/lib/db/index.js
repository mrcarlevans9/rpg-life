import { db, ACHIEVEMENTS, UNLOCKABLES, TITLES, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES, MERCHANT, MERCHANT_ITEMS } from './schema.js';

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
      createdAt: new Date().toISOString(),
      // Character inventory (syncs with cloud)
      gold: 0,
      healthPotions: 3,
      customSpells: [],
      purchasedSpellSlot: false,
      // Dungeon stats (syncs with cloud)
      highestFloor: 0,
      totalKills: 0
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
      defenseBonus: 0,
      // Mana system
      maxMpBonus: 0,
      // Multiple spells system
      customSpells: [], // Array of spell objects { name, description, damage, manaCost }
      purchasedSpellSlot: false // Extra slot from shop (max 1)
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
      defenseBonus: 0,
      maxMpBonus: 0,
      customSpells: [],
      purchasedSpellSlot: false
    });
    console.log('Dungeon initialized');
  }

  // Migrate existing dungeon to multi-spell system
  const dungeon = await db.dungeon.get(1);
  if (dungeon) {
    const updates = {};

    // Migrate old customSpell to customSpells array
    if (dungeon.customSpells === undefined) {
      if (dungeon.customSpell) {
        updates.customSpells = [dungeon.customSpell];
      } else {
        updates.customSpells = [];
      }
    }

    // Add purchasedSpellSlot if missing
    if (dungeon.purchasedSpellSlot === undefined) {
      updates.purchasedSpellSlot = false;
    }

    // Add maxMpBonus if missing (older migration)
    if (dungeon.maxMpBonus === undefined) {
      updates.maxMpBonus = 0;
    }

    if (Object.keys(updates).length > 0) {
      await db.dungeon.update(1, updates);
      console.log('Dungeon migrated to multi-spell system');
    }
  }

  // Migrate gold, potions, spells from dungeon to player (if not already migrated)
  const player = await db.player.get(1);
  const dungeonForMigration = await db.dungeon.get(1);
  if (player && dungeonForMigration) {
    const playerUpdates = {};

    // Migrate gold if player doesn't have it or dungeon has more
    if (player.gold === undefined || (dungeonForMigration.gold > 0 && (player.gold || 0) === 0)) {
      playerUpdates.gold = dungeonForMigration.gold || 0;
    }

    // Migrate potions if player doesn't have it
    if (player.healthPotions === undefined) {
      playerUpdates.healthPotions = dungeonForMigration.healthPotions || 3;
    }

    // Migrate spells if player doesn't have them or dungeon has them and player doesn't
    if (player.customSpells === undefined ||
        (dungeonForMigration.customSpells?.length > 0 && dungeonForMigration.customSpells[0] &&
         (!player.customSpells?.length || !player.customSpells[0]))) {
      playerUpdates.customSpells = dungeonForMigration.customSpells || [];
    }

    // Migrate purchasedSpellSlot
    if (player.purchasedSpellSlot === undefined) {
      playerUpdates.purchasedSpellSlot = dungeonForMigration.purchasedSpellSlot || false;
    }

    // Migrate highestFloor if player doesn't have it or dungeon has higher
    if (player.highestFloor === undefined || (dungeonForMigration.highestFloor || 0) > (player.highestFloor || 0)) {
      playerUpdates.highestFloor = dungeonForMigration.highestFloor || 0;
    }

    // Migrate totalKills if player doesn't have it or dungeon has more
    if (player.totalKills === undefined || (dungeonForMigration.totalKills || 0) > (player.totalKills || 0)) {
      playerUpdates.totalKills = dungeonForMigration.totalKills || 0;
    }

    if (Object.keys(playerUpdates).length > 0) {
      await db.player.update(1, playerUpdates);
      console.log('Migrated dungeon data to player:', playerUpdates);
    }
  }
}

// Export db and constants
export { db, ACHIEVEMENTS, UNLOCKABLES, TITLES, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES, MERCHANT, MERCHANT_ITEMS };
