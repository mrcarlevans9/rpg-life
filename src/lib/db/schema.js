import Dexie from 'dexie';

// Create the database instance
export const db = new Dexie('RPGLifeDB');

// Define the database schema
db.version(7).stores({
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
  dungeon: '++id',

  // Equipment inventory
  equipment: '++id, remoteId, slot, rarity, equipped',

  // Pending loot (not yet extracted from dungeon)
  pendingLoot: '++id, slot, rarity',

  // Guild quest progress tracking
  guildQuestProgress: '++id, visibleQuestId'
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
  { key: 'health_potion', name: 'Health Potion', emoji: '🧪', description: 'Restore 30 HP instantly', cost: 8, effect: { heal: 30 } },
  { key: 'bottled_potion', name: 'Bottled Potion', emoji: '🍶', description: 'Add 1 potion to inventory', cost: 12, effect: { addPotion: 1 } },
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
  { key: 'spell_slot', name: 'Arcane Tome', description: '+1 Spell Slot (permanent)', cost: 500, effect: { spellSlot: 1 } },
  { key: 'auto_potion', name: 'Potion Satchel', description: 'Start each run with 1 potion (permanent)', cost: 500, effect: { autoPotion: true } }
];

// ============ EQUIPMENT SYSTEM CONSTANTS ============

// Stat allocation configuration
export const STAT_CONFIG = {
  vitality: {
    label: 'Vitality',
    icon: '❤️',
    description: '+3 Max HP per point',
    perPoint: 3,
    diminishedPerPoint: 1.5,
    softCap: 20,
    hardCap: null,
    effectKey: 'maxHp'
  },
  power: {
    label: 'Power',
    icon: '⚔️',
    description: '+0.5 Base Damage per point',
    perPoint: 0.5,
    diminishedPerPoint: 0.25,
    softCap: 20,
    hardCap: null,
    effectKey: 'baseDamage'
  },
  arcana: {
    label: 'Arcana',
    icon: '🔮',
    description: '+2 Max MP per point',
    perPoint: 2,
    diminishedPerPoint: 1,
    softCap: 20,
    hardCap: null,
    effectKey: 'maxMp'
  },
  agility: {
    label: 'Agility',
    icon: '💨',
    description: '+0.5% Dodge per point',
    perPoint: 0.5,
    diminishedPerPoint: 0,
    softCap: 50,
    hardCap: 50,
    effectKey: 'dodgeChance',
    maxEffect: 25
  },
  fortune: {
    label: 'Fortune',
    icon: '🍀',
    description: '+1% Loot Rarity per point',
    perPoint: 1,
    diminishedPerPoint: 0,
    softCap: 30,
    hardCap: 30,
    effectKey: 'rarityBonus',
    maxEffect: 30
  }
};

export const POINTS_PER_LEVEL = 2;
export const RESPEC_BASE_COST = 100; // × player level

// Equipment slot types
export const SLOT_TYPES = ['weapon', 'armor', 'accessory'];

// Equipment rarities with drop weights and attribute counts
export const RARITIES = {
  common:   { name: 'Common',   color: '#9ca3af', weight: 50, minAttrs: 1, maxAttrs: 1, sellMultiplier: 0.1 },
  uncommon: { name: 'Uncommon', color: '#22c55e', weight: 30, minAttrs: 1, maxAttrs: 2, sellMultiplier: 0.15 },
  rare:     { name: 'Rare',     color: '#3b82f6', weight: 15, minAttrs: 2, maxAttrs: 2, sellMultiplier: 0.25 },
  epic:     { name: 'Epic',     color: '#a855f7', weight: 4,  minAttrs: 2, maxAttrs: 3, sellMultiplier: 0.4 },
  tainted:  { name: 'Tainted',  color: '#dc2626', weight: 1,  minAttrs: 1, maxAttrs: 1, sellMultiplier: 0.5 }
};

// Attribute definitions by category
export const ATTRIBUTES = {
  // === OFFENSIVE ===
  damage:       { name: 'Damage',       slots: ['weapon'], min: 1, max: 5, description: '+{value} damage' },
  critChance:   { name: 'Crit Chance',  slots: ['weapon', 'accessory'], min: 3, max: 15, description: '+{value}% crit chance' },
  critDamage:   { name: 'Crit Damage',  slots: ['weapon'], min: 10, max: 25, description: '+{value}% crit damage' },
  armorPierce:  { name: 'Armor Pierce', slots: ['weapon'], min: 1, max: 3, description: 'Ignore {value} defense' },
  doubleStrike: { name: 'Double Strike', slots: ['weapon'], min: 5, max: 15, description: '{value}% chance to hit twice' },
  firstBlood:   { name: 'First Blood', slots: ['weapon'], min: 3, max: 8, description: '+{value} damage on first hit' },
  executioner:  { name: 'Executioner', slots: ['weapon'], min: 5, max: 15, description: '+{value} damage vs enemies below 25% HP' },
  bossSlayer:   { name: 'Boss Slayer', slots: ['weapon', 'accessory'], min: 2, max: 6, description: '+{value} damage vs bosses' },
  giantKiller:  { name: 'Giant Killer', slots: ['weapon'], min: 3, max: 8, description: '+{value} damage vs Giant enemies' },

  // === DEFENSIVE ===
  defense:      { name: 'Defense',      slots: ['armor'], min: 1, max: 4, description: '+{value} defense' },
  maxHp:        { name: 'Max HP',       slots: ['armor', 'accessory'], min: 5, max: 20, description: '+{value} max HP' },
  blockChance:  { name: 'Block Chance', slots: ['armor'], min: 5, max: 15, description: '{value}% chance to block attack' },
  thorns:       { name: 'Thorns',       slots: ['armor'], min: 1, max: 5, description: 'Reflect {value} damage when hit' },
  resistFire:   { name: 'Fire Resist',  slots: ['armor'], min: 20, max: 50, description: '-{value}% fire/burn damage' },
  resistStun:   { name: 'Stun Resist',  slots: ['armor', 'accessory'], min: 15, max: 40, description: '{value}% chance to ignore stun' },
  secondWind:   { name: 'Second Wind',  slots: ['armor'], min: 1, max: 1, description: 'Once per run, survive lethal hit with 1 HP' },
  fortify:      { name: 'Fortify',      slots: ['armor'], min: 1, max: 3, description: '+{value} extra defense when Defending' },

  // === RESOURCE & ECONOMY ===
  goldPerKill:      { name: 'Gold per Kill',    slots: ['weapon', 'armor', 'accessory'], min: 1, max: 4, description: '+{value} gold per kill' },
  maxMp:            { name: 'Max MP',           slots: ['accessory'], min: 5, max: 20, description: '+{value} max MP' },
  manaRegen:        { name: 'Mana Regen',       slots: ['accessory'], min: 1, max: 3, description: '+{value} MP restored per turn' },
  potionCapacity:   { name: 'Potion Capacity',  slots: ['armor', 'accessory'], min: 1, max: 2, description: 'Carry +{value} potions' },
  potionEfficiency: { name: 'Potion Efficiency', slots: ['accessory'], min: 15, max: 30, description: 'Potions heal +{value}%' },
  scavenger:        { name: 'Scavenger',        slots: ['accessory'], min: 10, max: 25, description: '+{value}% gold from chests' },

  // === GUILD & PVP ===
  guildBossDamage:   { name: 'Guild Boss Damage', slots: ['weapon', 'accessory'], min: 2, max: 8, description: '+{value} damage vs guild bosses' },
  contributionBonus: { name: 'Contribution',      slots: ['accessory'], min: 5, max: 15, description: '+{value}% guild quest credit' },
  pvpDamage:         { name: 'PvP Damage',        slots: ['weapon'], min: 2, max: 5, description: '+{value} damage in PvP' },
  pvpDefense:        { name: 'PvP Defense',       slots: ['armor'], min: 1, max: 3, description: '+{value} defense in PvP' },

  // === UTILITY ===
  xpBonus:        { name: 'XP Bonus',       slots: ['accessory'], min: 5, max: 15, description: '+{value}% XP from dungeon' },
  treasureHunter: { name: 'Treasure Hunter', slots: ['accessory'], min: 5, max: 15, description: '+{value}% better loot rarity' },
  quickFeet:      { name: 'Quick Feet',     slots: ['armor'], min: 10, max: 20, description: '+{value}% chance to flee safely' },
  momentum:       { name: 'Momentum',       slots: ['weapon'], min: 1, max: 1, description: '+1 damage per floor (max 10), resets on hit' },
  lucky:          { name: 'Lucky',          slots: ['accessory'], min: 1, max: 1, description: 'Reroll one dice per combat' },
  ambush:         { name: 'Ambush',         slots: ['weapon'], min: 5, max: 10, description: '+{value} damage if you attack first' }
};

// Tainted (cursed) items - unique items with powerful bonuses and permanent drawbacks
export const TAINTED_ITEMS = {
  weapons: [
    {
      key: 'bloodthirst_blade',
      name: 'Bloodthirst Blade',
      emoji: '🗡️',
      slot: 'weapon',
      bonuses: [{ type: 'damage', value: 5 }],
      penalties: [{ type: 'selfDamageOnAttack', value: 2, description: 'Lose 2 HP per attack' }],
      floorMin: 20
    },
    {
      key: 'cursed_reaper',
      name: 'Cursed Reaper',
      emoji: '⚰️',
      slot: 'weapon',
      bonuses: [{ type: 'execute', value: 15, description: 'Instant kill enemies below 15% HP' }],
      penalties: [{ type: 'maxHp', value: -10, description: '-10 max HP' }],
      floorMin: 25
    },
    {
      key: 'glass_cannon',
      name: 'Glass Cannon',
      emoji: '💎',
      slot: 'weapon',
      bonuses: [{ type: 'damage', value: 6 }, { type: 'critChance', value: 10 }],
      penalties: [{ type: 'defense', value: -3, description: '-3 defense' }],
      floorMin: 20
    },
    {
      key: 'soul_eater',
      name: 'Soul Eater',
      emoji: '👁️',
      slot: 'weapon',
      bonuses: [{ type: 'damage', value: 3 }, { type: 'lifestealOnKill', value: 2, description: 'Heal 2 HP on kill' }],
      penalties: [{ type: 'noPotions', value: true, description: "Can't use potions" }],
      floorMin: 25
    },
    {
      key: 'gamblers_edge',
      name: "Gambler's Edge",
      emoji: '🎰',
      slot: 'weapon',
      bonuses: [{ type: 'critDamageMultiplier', value: 3, description: 'Crits deal 3× damage' }],
      penalties: [{ type: 'nonCritPenalty', value: -2, description: 'Non-crits deal -2 damage' }],
      floorMin: 20
    },
    {
      key: 'berserker_axe',
      name: 'Berserker Axe',
      emoji: '🪓',
      slot: 'weapon',
      bonuses: [{ type: 'damagePerHitTaken', value: 2, description: '+2 damage per hit taken this combat' }],
      penalties: [{ type: 'noDefend', value: true, description: "Can't use Defend" }],
      floorMin: 22
    },
    {
      key: 'hexblade',
      name: 'Hexblade',
      emoji: '🔮',
      slot: 'weapon',
      bonuses: [{ type: 'damage', value: 4 }, { type: 'critChance', value: 15 }],
      penalties: [{ type: 'goldPerKill', value: -3, description: '-3 gold per kill' }],
      floorMin: 20
    },
    {
      key: 'vampiric_fang',
      name: 'Vampiric Fang',
      emoji: '🧛',
      slot: 'weapon',
      bonuses: [{ type: 'lifesteal', value: 20, description: 'Lifesteal 20% of damage dealt' }],
      penalties: [{ type: 'bossDamageTaken', value: 5, description: '+5 damage taken from bosses' }],
      floorMin: 25
    }
  ],
  armor: [
    {
      key: 'martyrs_plate',
      name: "Martyr's Plate",
      emoji: '⛨',
      slot: 'armor',
      bonuses: [{ type: 'defense', value: 5 }, { type: 'maxHp', value: 20 }],
      penalties: [{ type: 'damage', value: -2, description: '-2 damage dealt' }],
      floorMin: 20
    },
    {
      key: 'specters_shroud',
      name: "Specter's Shroud",
      emoji: '👻',
      slot: 'armor',
      bonuses: [{ type: 'dodgeChance', value: 25, description: '25% dodge chance' }],
      penalties: [{ type: 'maxHp', value: -15, description: '-15 max HP' }],
      floorMin: 22
    },
    {
      key: 'greed_mail',
      name: 'Greed Mail',
      emoji: '💰',
      slot: 'armor',
      bonuses: [{ type: 'goldPerKill', value: 5 }],
      penalties: [{ type: 'defense', value: -2, description: '-2 defense' }],
      floorMin: 20
    },
    {
      key: 'thorned_carapace',
      name: 'Thorned Carapace',
      emoji: '🦔',
      slot: 'armor',
      bonuses: [{ type: 'thornsDamage', value: 50, description: 'Reflect 50% damage taken' }],
      penalties: [{ type: 'maxHealPercent', value: 70, description: "Can't heal above 70% HP" }],
      floorMin: 25
    },
    {
      key: 'featherweight_vest',
      name: 'Featherweight Vest',
      emoji: '🪶',
      slot: 'armor',
      bonuses: [{ type: 'alwaysFirst', value: true, description: 'Always act first' }, { type: 'fleeChance', value: 20 }],
      penalties: [{ type: 'defense', value: -3, description: '-3 defense' }],
      floorMin: 20
    },
    {
      key: 'pact_armor',
      name: 'Pact Armor',
      emoji: '📜',
      slot: 'armor',
      bonuses: [{ type: 'defense', value: 3 }, { type: 'maxMp', value: 10 }],
      penalties: [{ type: 'mpDrainPerTurn', value: 1, description: 'Lose 1 MP per turn' }],
      floorMin: 22
    }
  ],
  accessories: [
    {
      key: 'greedy_ring',
      name: 'Greedy Ring',
      emoji: '💍',
      slot: 'accessory',
      bonuses: [{ type: 'goldMultiplier', value: 2, description: 'Double gold drops' }],
      penalties: [{ type: 'merchantMarkup', value: 50, description: 'Merchants charge +50%' }],
      floorMin: 20
    },
    {
      key: 'adrenaline_charm',
      name: 'Adrenaline Charm',
      emoji: '💓',
      slot: 'accessory',
      bonuses: [{ type: 'lowHpDamage', value: 4, description: '+4 damage when below 25% HP' }],
      penalties: [{ type: 'potionEfficiency', value: -50, description: 'Potions heal 50% less' }],
      floorMin: 22
    },
    {
      key: 'chaos_pendant',
      name: 'Chaos Pendant',
      emoji: '🌀',
      slot: 'accessory',
      bonuses: [{ type: 'damage', value: 3 }],
      penalties: [{ type: 'randomStatLoss', value: 2, description: 'Random stat reduced by 2 each floor' }],
      floorMin: 25
    },
    {
      key: 'gamblers_coin',
      name: "Gambler's Coin",
      emoji: '🪙',
      slot: 'accessory',
      bonuses: [{ type: 'doubleRewardChance', value: 50, description: '50% chance for double rewards' }],
      penalties: [{ type: 'noRewardChance', value: 50, description: '50% chance for nothing' }],
      floorMin: 20
    },
    {
      key: 'temporal_loop',
      name: 'Temporal Loop',
      emoji: '⏰',
      slot: 'accessory',
      bonuses: [{ type: 'deathRetry', value: 1, description: 'Retry one death per run' }],
      penalties: [{ type: 'goldLossOnRetry', value: 25, description: 'Lose 25% gold on retry' }],
      floorMin: 25
    },
    {
      key: 'dark_pact_sigil',
      name: 'Dark Pact Sigil',
      emoji: '🔯',
      slot: 'accessory',
      bonuses: [{ type: 'xpBonus', value: 30, description: '+30% XP from dungeon' }],
      penalties: [{ type: 'guildContribution', value: -50, description: '-50% guild quest contribution' }],
      floorMin: 20
    }
  ]
};

// Item name generators by slot and rarity
export const ITEM_NAMES = {
  weapon: {
    prefixes: ['Iron', 'Steel', 'Silver', 'Golden', 'Ancient', 'Forged', 'Battle', 'War', 'Sharp', 'Keen'],
    bases: ['Sword', 'Blade', 'Dagger', 'Axe', 'Mace', 'Hammer', 'Spear', 'Staff', 'Scimitar', 'Claymore'],
    suffixes: ['of Might', 'of Power', 'of Fury', 'of the Hunt', 'of Slaying', 'of Valor', 'of Glory', 'of Ruin']
  },
  armor: {
    prefixes: ['Iron', 'Steel', 'Plated', 'Reinforced', 'Heavy', 'Light', 'Blessed', 'Enchanted', 'Guardian', 'Warded'],
    bases: ['Chestplate', 'Mail', 'Vest', 'Armor', 'Cuirass', 'Hauberk', 'Breastplate', 'Tunic', 'Robe', 'Plate'],
    suffixes: ['of Protection', 'of Fortitude', 'of the Sentinel', 'of Warding', 'of Resilience', 'of the Guardian']
  },
  accessory: {
    prefixes: ['Silver', 'Golden', 'Enchanted', 'Mystic', 'Ancient', 'Blessed', 'Charmed', 'Runic', 'Glowing', 'Radiant'],
    bases: ['Ring', 'Amulet', 'Pendant', 'Charm', 'Talisman', 'Brooch', 'Medallion', 'Necklace', 'Band', 'Sigil'],
    suffixes: ['of Wisdom', 'of Fortune', 'of the Mage', 'of Insight', 'of Luck', 'of Power', 'of the Sage']
  }
};

// Drop chances by source
export const DROP_CHANCES = {
  monster: { common: 0.08, uncommon: 0.04, rare: 0.02, epic: 0.005 },  // Regular monster
  miniBoss: { common: 0.25, uncommon: 0.15, rare: 0.08, epic: 0.02 },  // Mini-boss
  majorBoss: { common: 0.5, uncommon: 0.3, rare: 0.2, epic: 0.1 },     // Major boss (guaranteed at least uncommon)
  taintedChest: { tainted: 0.5 }  // Rare cursed chest encounter
};

// Base sell values by rarity (gold)
export const BASE_SELL_VALUES = {
  common: 5,
  uncommon: 15,
  rare: 40,
  epic: 100,
  tainted: 75
};

export default db;
