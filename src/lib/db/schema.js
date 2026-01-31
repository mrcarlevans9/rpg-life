import Dexie from 'dexie';

// Create the database instance
export const db = new Dexie('RPGLifeDB');

// Define the database schema
db.version(5).stores({
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
  dailyStats: '++id, &date'
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

export default db;
