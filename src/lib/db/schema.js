import Dexie from 'dexie';

// Create the database instance
export const db = new Dexie('RPGLifeDB');

// Define the database schema
db.version(6).stores({
  // Player profile - single row (id: 1)
  player: '++id',

  // Avatar customization
  avatar: '++id',

  // Bounty board settings - single row (id: 1)
  board: '++id',

  // Tasks/Bounties - remoteId tracks Supabase UUID for sync
  tasks: '++id, remoteId, status, priority, dueDate, completed, order',

  // Tags
  tags: '++id, name',

  // Daily quests
  dailyQuests: '++id, &date',

  // Expedition sessions (renamed from walks)
  expeditions: '++id, date',

  // Achievements
  achievements: '++id, &key',

  // Unlockables
  unlockables: '++id, type, &key, unlocked',

  // Settings
  settings: '++id',

  // XP History
  xpHistory: '++id, timestamp, source',

  // Daily stats snapshots
  dailyStats: '++id, &date',

  // Dungeon data - single row (id: 1)
  dungeon: '++id'
});

// Achievement definitions
export const ACHIEVEMENTS = [
  { key: 'first_expedition', name: 'First Expedition', description: 'Complete your first expedition', icon: '🗺️', xpReward: 50, type: 'expedition' },
  { key: 'getting_started', name: 'Getting Started', description: 'Complete your first task', icon: '✅', xpReward: 50, type: 'task' },
  { key: 'week_warrior', name: 'Week Warrior', description: '7-day streak', icon: '🔥', xpReward: 200, type: 'streak', target: 7 },
  { key: 'fortnight_fighter', name: 'Fortnight Fighter', description: '14-day streak', icon: '⚔️', xpReward: 500, type: 'streak', target: 14 },
  { key: 'monthly_master', name: 'Monthly Master', description: '30-day streak', icon: '👑', xpReward: 1000, type: 'streak', target: 30 },
  { key: 'century_club', name: 'Century Club', description: 'Complete 100 tasks', icon: '💯', xpReward: 500, type: 'task_count', target: 100 },
  { key: 'thousand_tasks', name: 'Thousand Tasks', description: 'Complete 1000 tasks', icon: '🏆', xpReward: 2000, type: 'task_count', target: 1000 },
  { key: 'expedition_streak', name: 'Expedition Streak', description: 'Go on expeditions 30 days in a row', icon: '🏃', xpReward: 1000, type: 'expedition_streak', target: 30 },
  { key: 'early_bird', name: 'Early Bird', description: 'Complete a task before 6am', icon: '🌅', xpReward: 100, type: 'time' },
  { key: 'night_owl', name: 'Night Owl', description: 'Complete a task after midnight', icon: '🦉', xpReward: 100, type: 'time' },
  { key: 'overachiever', name: 'Overachiever', description: 'Complete 10 tasks in one day', icon: '⭐', xpReward: 200, type: 'daily_tasks', target: 10 },
  { key: 'seasoned_explorer', name: 'Seasoned Explorer', description: 'Accumulate 10 hours of expeditions', icon: '🌟', xpReward: 500, type: 'expedition_time', target: 600 },
  { key: 'level_10', name: 'Level 10', description: 'Reach level 10', icon: '🎖️', xpReward: 300, type: 'level', target: 10 },
  { key: 'level_25', name: 'Level 25', description: 'Reach level 25', icon: '🎗️', xpReward: 750, type: 'level', target: 25 },
  { key: 'level_50', name: 'Level 50', description: 'Reach level 50', icon: '🏅', xpReward: 1500, type: 'level', target: 50 }
];

// Unlockable cosmetics definitions
export const UNLOCKABLES = {
  hairStyles: [
    { key: 'default', name: 'Default', level: 1 },
    { key: 'spiky', name: 'Spiky', level: 3 },
    { key: 'long', name: 'Long', level: 5 },
    { key: 'mohawk', name: 'Mohawk', level: 10 },
    { key: 'ponytail', name: 'Ponytail', level: 15 },
    { key: 'curly', name: 'Curly', level: 20 }
  ],
  hairColors: [
    { key: 'brown', name: 'Brown', color: '#8B4513', level: 1 },
    { key: 'black', name: 'Black', color: '#1a1a1a', level: 1 },
    { key: 'blonde', name: 'Blonde', color: '#F4D03F', level: 2 },
    { key: 'red', name: 'Red', color: '#C0392B', level: 5 },
    { key: 'blue', name: 'Blue', color: '#3498DB', level: 10 },
    { key: 'purple', name: 'Purple', color: '#9B59B6', level: 15 },
    { key: 'pink', name: 'Pink', color: '#E91E8C', level: 20 },
    { key: 'green', name: 'Green', color: '#27AE60', level: 25 }
  ],
  skinTones: [
    { key: 'light', name: 'Light', color: '#FFDFC4', level: 1 },
    { key: 'medium_light', name: 'Medium Light', color: '#F0C8A0', level: 1 },
    { key: 'medium', name: 'Medium', color: '#D4A574', level: 1 },
    { key: 'medium_dark', name: 'Medium Dark', color: '#A67B5B', level: 1 },
    { key: 'dark', name: 'Dark', color: '#8D5524', level: 1 }
  ],
  outfits: [
    { key: 'casual', name: 'Casual', level: 1 },
    { key: 'adventurer', name: 'Adventurer', level: 5 },
    { key: 'warrior', name: 'Warrior', level: 10 },
    { key: 'mage', name: 'Mage', level: 15 },
    { key: 'knight', name: 'Knight', level: 25 },
    { key: 'royal', name: 'Royal', level: 40 }
  ],
  accessories: [
    { key: 'none', name: 'None', level: 1 },
    { key: 'glasses', name: 'Glasses', level: 3 },
    { key: 'headband', name: 'Headband', level: 7 },
    { key: 'earring', name: 'Earring', level: 12 },
    { key: 'crown', name: 'Crown', level: 30 },
    { key: 'halo', name: 'Halo', level: 50 }
  ]
};

// Title definitions
export const TITLES = [
  { key: 'rookie', name: 'Rookie', requirement: 'Start your journey', level: 1 },
  { key: 'apprentice', name: 'Apprentice', requirement: 'Reach level 5', level: 5 },
  { key: 'journeyman', name: 'Journeyman', requirement: 'Reach level 10', level: 10 },
  { key: 'expert', name: 'Expert', requirement: 'Reach level 20', level: 20 },
  { key: 'master', name: 'Master', requirement: 'Reach level 35', level: 35 },
  { key: 'grandmaster', name: 'Grandmaster', requirement: 'Reach level 50', level: 50 },
  { key: 'streak_master', name: 'Streak Master', requirement: '30-day streak', achievement: 'monthly_master' },
  { key: 'centurion', name: 'Centurion', requirement: 'Complete 100 tasks', achievement: 'century_club' },
  { key: 'night_owl', name: 'Night Owl', requirement: 'Complete task after midnight', achievement: 'night_owl' },
  { key: 'early_bird', name: 'Early Bird', requirement: 'Complete task before 6am', achievement: 'early_bird' },
  { key: 'explorer', name: 'Explorer', requirement: '10 hours of expeditions', achievement: 'seasoned_explorer' }
];

// Dungeon monster definitions
export const MONSTERS = {
  // Tier 1 (Floors 1-3) - Should take 2-3 hits to kill, deal meaningful damage
  common: [
    { key: 'slime', name: 'Slime', emoji: '🟢', baseHp: 15, baseDamage: 6, goldDrop: [2, 5] },
    { key: 'rat', name: 'Giant Rat', emoji: '🐀', baseHp: 12, baseDamage: 8, goldDrop: [2, 4] },
    { key: 'bat', name: 'Cave Bat', emoji: '🦇', baseHp: 10, baseDamage: 7, goldDrop: [1, 4] },
    { key: 'spider', name: 'Spider', emoji: '🕷️', baseHp: 14, baseDamage: 7, goldDrop: [2, 5] },
    { key: 'snake', name: 'Cave Snake', emoji: '🐍', baseHp: 11, baseDamage: 9, goldDrop: [2, 5] },
    { key: 'beetle', name: 'Giant Beetle', emoji: '🪲', baseHp: 16, baseDamage: 5, goldDrop: [2, 4] },
    { key: 'mushroom', name: 'Toxic Shroom', emoji: '🍄', baseHp: 13, baseDamage: 8, goldDrop: [3, 5] },
    { key: 'wolf', name: 'Dire Wolf', emoji: '🐺', baseHp: 14, baseDamage: 8, goldDrop: [2, 5] },
    { key: 'frog', name: 'Giant Frog', emoji: '🐸', baseHp: 13, baseDamage: 7, goldDrop: [2, 4] },
    { key: 'crab', name: 'Cave Crab', emoji: '🦀', baseHp: 17, baseDamage: 5, goldDrop: [2, 5] }
  ],
  // Tier 2 (Floors 4-6) - Tougher fights, need strategy
  uncommon: [
    { key: 'goblin', name: 'Goblin', emoji: '👺', baseHp: 28, baseDamage: 10, goldDrop: [5, 10] },
    { key: 'skeleton', name: 'Skeleton', emoji: '💀', baseHp: 24, baseDamage: 12, goldDrop: [4, 9] },
    { key: 'zombie', name: 'Zombie', emoji: '🧟', baseHp: 35, baseDamage: 8, goldDrop: [5, 8] },
    { key: 'ghost', name: 'Ghost', emoji: '👻', baseHp: 20, baseDamage: 14, goldDrop: [6, 11] },
    { key: 'scorpion', name: 'Giant Scorpion', emoji: '🦂', baseHp: 26, baseDamage: 13, goldDrop: [5, 10] },
    { key: 'imp', name: 'Fire Imp', emoji: '😈', baseHp: 18, baseDamage: 15, goldDrop: [5, 9] },
    { key: 'harpy', name: 'Harpy', emoji: '🦅', baseHp: 22, baseDamage: 13, goldDrop: [5, 10] },
    { key: 'mimic', name: 'Mimic', emoji: '📦', baseHp: 25, baseDamage: 11, goldDrop: [8, 15] },
    { key: 'lizard', name: 'Lizardman', emoji: '🦎', baseHp: 30, baseDamage: 10, goldDrop: [5, 10] },
    { key: 'shade', name: 'Shadow', emoji: '👤', baseHp: 19, baseDamage: 14, goldDrop: [6, 11] }
  ],
  // Tier 3 (Floors 7-9) - Dangerous, may need potions
  rare: [
    { key: 'orc', name: 'Orc Warrior', emoji: '👹', baseHp: 45, baseDamage: 14, goldDrop: [10, 18] },
    { key: 'wraith', name: 'Wraith', emoji: '🌑', baseHp: 38, baseDamage: 18, goldDrop: [12, 20] },
    { key: 'golem', name: 'Stone Golem', emoji: '🗿', baseHp: 60, baseDamage: 12, goldDrop: [15, 22] },
    { key: 'demon', name: 'Lesser Demon', emoji: '👿', baseHp: 42, baseDamage: 16, goldDrop: [11, 19] },
    { key: 'vampire', name: 'Vampire', emoji: '🧛', baseHp: 35, baseDamage: 19, goldDrop: [14, 22] },
    { key: 'ogre', name: 'Ogre', emoji: '👹', baseHp: 55, baseDamage: 15, goldDrop: [12, 20] },
    { key: 'banshee', name: 'Banshee', emoji: '👻', baseHp: 30, baseDamage: 20, goldDrop: [13, 21] },
    { key: 'elemental', name: 'Fire Elemental', emoji: '🔥', baseHp: 40, baseDamage: 17, goldDrop: [14, 22] },
    { key: 'gargoyle', name: 'Gargoyle', emoji: '🗿', baseHp: 50, baseDamage: 14, goldDrop: [11, 19] },
    { key: 'cyclops', name: 'Cyclops', emoji: '👁️', baseHp: 58, baseDamage: 16, goldDrop: [15, 23] }
  ]
};

// Dungeon boss definitions - Mini-bosses appear on floors with special rooms, Major bosses on floor 10+
export const BOSSES = {
  // Mini-bosses (appear when floor has chest/merchant, or every 3rd floor)
  mini: [
    { key: 'troll', name: 'Cave Troll', emoji: '🧌', baseHp: 65, baseDamage: 14, goldDrop: [25, 40], special: 'Regenerate', specialDesc: 'Heals 5 HP each turn' },
    { key: 'dark_knight', name: 'Dark Knight', emoji: '🖤', baseHp: 55, baseDamage: 16, goldDrop: [20, 35], special: 'Shield Bash', specialDesc: 'Reduces your damage by 2 for 2 turns' },
    { key: 'witch', name: 'Swamp Witch', emoji: '🧙‍♀️', baseHp: 45, baseDamage: 18, goldDrop: [22, 38], special: 'Hex', specialDesc: 'Curses you to take +3 damage' },
    { key: 'werewolf', name: 'Werewolf', emoji: '🐺', baseHp: 60, baseDamage: 15, goldDrop: [23, 37], special: 'Frenzy', specialDesc: 'Attacks twice when below 50% HP' },
    { key: 'necromancer', name: 'Necromancer', emoji: '💀', baseHp: 40, baseDamage: 14, goldDrop: [25, 40], special: 'Summon', specialDesc: 'Summons a skeleton ally' },
    { key: 'minotaur', name: 'Minotaur', emoji: '🐂', baseHp: 70, baseDamage: 13, goldDrop: [24, 38], special: 'Charge', specialDesc: 'Next attack deals double damage' },
    { key: 'medusa', name: 'Medusa', emoji: '🐍', baseHp: 50, baseDamage: 17, goldDrop: [26, 42], special: 'Petrify', specialDesc: 'Stuns you for 1 turn' },
    { key: 'giant', name: 'Hill Giant', emoji: '👤', baseHp: 80, baseDamage: 12, goldDrop: [22, 36], special: 'Stomp', specialDesc: 'Deals damage to your MP too' }
  ],
  // Major bosses (Floor 10, 20, etc.) - Epic fights
  major: [
    { key: 'dragon', name: 'Ancient Dragon', emoji: '🐉', baseHp: 150, baseDamage: 20, goldDrop: [60, 100], special: 'Fire Breath', specialDesc: 'Deals 25 damage, ignores defense' },
    { key: 'lich', name: 'Lich King', emoji: '☠️', baseHp: 120, baseDamage: 24, goldDrop: [55, 95], special: 'Soul Drain', specialDesc: 'Steals 15 HP from you' },
    { key: 'demon_lord', name: 'Demon Lord', emoji: '👿', baseHp: 140, baseDamage: 22, goldDrop: [65, 105], special: 'Hellfire', specialDesc: 'Burns for 8 damage over 3 turns' },
    { key: 'hydra', name: 'Hydra', emoji: '🐲', baseHp: 180, baseDamage: 16, goldDrop: [70, 110], special: 'Multi-Strike', specialDesc: 'Attacks 3 times for 8 damage each' },
    { key: 'titan', name: 'Fallen Titan', emoji: '🗿', baseHp: 200, baseDamage: 18, goldDrop: [75, 120], special: 'Ground Slam', specialDesc: 'Stuns and deals 20 damage' },
    { key: 'phoenix', name: 'Dark Phoenix', emoji: '🔥', baseHp: 130, baseDamage: 21, goldDrop: [60, 100], special: 'Rebirth', specialDesc: 'Revives once with 50% HP' },
    { key: 'kraken', name: 'Kraken', emoji: '🦑', baseHp: 170, baseDamage: 19, goldDrop: [65, 105], special: 'Tentacle Grab', specialDesc: 'Immobilizes and deals 12 damage per turn' },
    { key: 'beholder', name: 'Beholder', emoji: '👁️', baseHp: 110, baseDamage: 25, goldDrop: [70, 110], special: 'Death Ray', specialDesc: 'Chance to deal 40 damage' }
  ]
};

// Monster modifiers (randomly applied)
export const MONSTER_MODIFIERS = [
  { key: 'enraged', name: 'Enraged', damageMultiplier: 1.5, hpMultiplier: 1, goldMultiplier: 1.2 },
  { key: 'armored', name: 'Armored', damageMultiplier: 1, hpMultiplier: 1.5, goldMultiplier: 1.3 },
  { key: 'swift', name: 'Swift', damageMultiplier: 1.2, hpMultiplier: 0.9, goldMultiplier: 1.1 },
  { key: 'giant', name: 'Giant', damageMultiplier: 1.3, hpMultiplier: 1.4, goldMultiplier: 1.5 }
];

// Goblin Merchant - random encounter
export const MERCHANT = {
  name: 'Goblin Merchant',
  emoji: '🧌',
  greeting: "Psst! Want to buy something, adventurer?",
  spawnChance: 0.12 // 12% chance per floor
};

// Merchant items (temporary, current run only)
export const MERCHANT_ITEMS = [
  { key: 'health_potion', name: 'Health Potion', emoji: '🧪', description: 'Restore 30 HP', cost: 8, effect: { heal: 30 } },
  { key: 'mana_potion', name: 'Mana Potion', emoji: '💙', description: 'Restore 20 MP', cost: 6, effect: { mana: 20 } },
  { key: 'strength_elixir', name: 'Strength Elixir', emoji: '💪', description: '+3 damage this run', cost: 15, effect: { bonusDamage: 3 } },
  { key: 'iron_skin', name: 'Iron Skin Potion', emoji: '🛡️', description: '+2 defense this run', cost: 12, effect: { defenseBonus: 2 } },
  { key: 'lucky_charm', name: 'Lucky Charm', emoji: '🍀', description: '+5 gold per kill this run', cost: 10, effect: { goldBonus: 5 } },
  { key: 'warriors_rage', name: "Warrior's Rage", emoji: '🔥', description: '+5 damage this run', cost: 25, effect: { bonusDamage: 5 } },
  { key: 'healers_blessing', name: "Healer's Blessing", emoji: '✨', description: 'Restore 50 HP', cost: 15, effect: { heal: 50 } },
  { key: 'mystic_scroll', name: 'Mystic Scroll', emoji: '📜', description: 'Restore 40 MP', cost: 12, effect: { mana: 40 } }
];

// Dungeon shop upgrades
export const DUNGEON_UPGRADES = [
  { key: 'max_hp_1', name: 'Vitality I', description: '+10 Max HP', cost: 50, effect: { maxHp: 10 } },
  { key: 'max_hp_2', name: 'Vitality II', description: '+20 Max HP', cost: 150, effect: { maxHp: 20 }, requires: 'max_hp_1' },
  { key: 'max_hp_3', name: 'Vitality III', description: '+30 Max HP', cost: 400, effect: { maxHp: 30 }, requires: 'max_hp_2' },
  { key: 'damage_1', name: 'Strength I', description: '+1 Damage', cost: 75, effect: { bonusDamage: 1 } },
  { key: 'damage_2', name: 'Strength II', description: '+2 Damage', cost: 200, effect: { bonusDamage: 2 }, requires: 'damage_1' },
  { key: 'damage_3', name: 'Strength III', description: '+3 Damage', cost: 500, effect: { bonusDamage: 3 }, requires: 'damage_2' },
  { key: 'potion_power_1', name: 'Alchemy I', description: 'Potions heal +5 HP', cost: 100, effect: { potionBonus: 5 } },
  { key: 'potion_power_2', name: 'Alchemy II', description: 'Potions heal +10 HP', cost: 300, effect: { potionBonus: 10 }, requires: 'potion_power_1' },
  { key: 'crit_chance', name: 'Lucky Strike', description: '+10% Critical Chance', cost: 250, effect: { critBonus: 10 } },
  { key: 'defense_1', name: 'Fortitude I', description: 'Defend blocks +2 damage', cost: 100, effect: { defenseBonus: 2 } },
  { key: 'spell_slot', name: 'Arcane Tome', description: '+1 Spell Slot (permanent)', cost: 500, effect: { spellSlot: 1 } }
];

export default db;
