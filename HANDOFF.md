# RPG-Life Project Handoff Document

> **Last Updated:** 2026-02-07
> **Current Branch:** `claude/refactor-battle-ui-special-attack-bqtj1`

---

## 1. Project Overview

**RPG-Life** is a gamified productivity application that transforms daily tasks into an RPG adventure. Users complete real-world tasks and outdoor expeditions to level up their character, earn XP, unlock cosmetics, battle other players in PvP, join guilds, and explore procedurally generated dungeons with a full equipment system.

**Core Concept:** Productivity gamification with deep RPG mechanics - tasks become "bounties," walks become "expeditions," and progress unlocks combat abilities, stat points, and cosmetic rewards.

**Key Stats:**
- 35+ Svelte components
- 12 route pages
- 11 reactive stores
- 4 major service modules
- Hybrid offline-first architecture (Dexie + Supabase)

---

## 2. Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Svelte 5.43.8 |
| **Bundler** | Vite 7.2.4 |
| **Routing** | svelte-spa-router 4.0.1 |
| **Local DB** | Dexie 4.3.0 (IndexedDB wrapper) |
| **Cloud Backend** | Supabase 2.93.3 (PostgreSQL + Auth) |
| **Charts** | Chart.js 4.5.1 |
| **Drag & Drop** | svelte-dnd-action 0.9.69 |
| **PWA** | vite-plugin-pwa 1.2.0 |

**Architecture:** Offline-first with async cloud sync. All data stored locally in Dexie; Supabase is backup + multiplayer.

---

## 3. Project Structure

```
/src
├── /routes                    # 12 page components
│   ├── Dashboard.svelte       # Home - player stats, level, streaks
│   ├── DailyQuests.svelte     # Task management (bounties)
│   ├── Board.svelte           # Kanban board
│   ├── Dungeon.svelte         # Combat system (3500+ lines)
│   ├── Multiplayer.svelte     # PvP, friends, guilds
│   ├── Achievements.svelte    # 15 achievements
│   ├── Analytics.svelte       # Charts and stats
│   ├── AvatarCustomization.svelte
│   ├── ExpeditionTimer.svelte # Outdoor activity tracker
│   ├── Settings.svelte
│   ├── Auth.svelte
│   └── NotFound.svelte
│
├── /components
│   ├── /layout               # Layout, Header, Navigation, MobileNav
│   ├── /common               # Button, Card, Modal, ProgressBar, Toast
│   ├── /avatar               # AvatarDisplay
│   ├── /player               # XPBar, StreakCounter, StatAllocationPanel, RespecModal
│   ├── /game                 # EquipmentInventory
│   └── /multiplayer          # BattleScreen, OpponentSelect, GuildPanel, etc.
│
├── /lib
│   ├── /stores               # 11 Svelte stores (reactive state)
│   │   ├── player.js         # Player stats, level, stat allocation
│   │   ├── tasks.js          # Task CRUD, completion
│   │   ├── dungeon.js        # Combat, floors, upgrades, spells
│   │   ├── equipment.js      # Loot generation, equip/sell
│   │   ├── guildBoss.js      # Guild raid mechanics
│   │   └── ...
│   ├── /db
│   │   ├── index.js          # Dexie initialization
│   │   └── schema.js         # Game config, monsters, items, stats
│   ├── /services
│   │   ├── xpService.js      # XP/level calculations
│   │   ├── pvpService.js     # PvP snapshots, battles
│   │   ├── friendsService.js # Friend requests
│   │   └── guildService.js   # Guild management
│   ├── /game
│   │   └── battleEngine.js   # Turn-based PvP combat
│   └── /supabase
│       ├── client.js         # Supabase connection
│       └── sync.js           # Cloud sync functions
│
└── /supabase                  # SQL schema files
    ├── multiplayer_schema.sql
    └── stat_allocation_schema.sql
```

---

## 4. Features Implemented

### Task System (Daily Quests)
- Create/edit/delete tasks with priorities (low/medium/high = 10/25/50 XP)
- Subtasks with individual XP rewards
- Recurring tasks (daily/weekly/monthly)
- Time tracking with work timer
- Streak multipliers: 3+ days (1.25x), 7+ (1.5x), 14+ (1.75x), 30+ (2.0x)

### Kanban Board
- Drag-and-drop columns and tasks
- Custom column creation
- Cloud-synced board state

### Player Progression
- Level system with exponential XP curve: `100 × 1.5^(level-1)`
- **5 allocatable stats** (2 points per level):
  - Vitality (+3 Max HP per point, soft cap 20)
  - Power (+0.5 Base Damage per point, soft cap 20)
  - Arcana (+2 Max MP per point, soft cap 20)
  - Agility (+0.5% Dodge, hard cap 50 = 25% max)
  - Fortune (+1% Loot Rarity, hard cap 30)
- Respec system (costs 100 gold × level)

### Dungeon System
- Turn-based combat with Attack/Defend/Spell/Potion actions
- 30 monsters across 3 tiers + 16 bosses (8 mini, 8 major)
- Monster modifiers (Enraged, Armored, Swift, Giant)
- Floor scaling: `1 + (floor - 1) × 0.18` per floor
- 12 purchasable permanent upgrades
- Custom spell creation with mana cost formula
- Merchant encounters (12% chance per floor)

### Equipment System
- 3 slots: Weapon, Armor, Accessory
- 5 rarities: Common, Uncommon, Rare, Epic, Tainted
- 29+ unique attributes across 4 categories
- Dynamic item generation with name prefixes/suffixes
- Loot extraction mechanic (100% on win, 50% on flee, 0% on death)
- **Special effects in combat:** Boss Slayer, Thorns, Second Wind, etc.

### Multiplayer
- Async PvP battles with leaderboard
- Friend system (requests, blocking)
- Guilds with leader/officer/member roles
- Guild boss raids (24-hour cooperative fights)

### Other Features
- Expeditions (outdoor activity timer with XP/item rewards)
- 15 achievements with XP rewards
- Avatar customization (hair, outfits, accessories, titles)
- Analytics dashboard with charts
- PWA with offline support

---

## 5. Data Models

### Dexie (Local - 15 Tables)

| Table | Keys | Purpose |
|-------|------|---------|
| `player` | `++id` | Single row (id:1) - stats, XP, gold, streaks |
| `dungeon` | `++id` | Single row - upgrades, spells, run stats |
| `equipment` | `++id, remoteId, slot, rarity, equipped` | Inventory items |
| `pendingLoot` | `++id, slot, rarity` | Loot during active run |
| `tasks` | `++id, remoteId, status, priority` | Bounties with cloud sync |
| `achievements` | `++id, &key` | Progress tracking |
| `unlockables` | `++id, type, &key` | Cosmetic unlocks |
| `expeditions` | `++id, date` | Walk session logs |
| `dailyStats` | `++id, &date` | Daily aggregates |
| `avatar`, `settings`, `board`, `tags`, `dailyQuests`, `xpHistory`, `guildQuestProgress` |

### Supabase (Cloud - 17 Tables)

**Core:** `players`, `avatars`, `settings`, `board`, `tasks`, `tags`, `equipment`, `expeditions`, `achievements`, `unlockables`, `xp_history`, `daily_stats`

**Multiplayer:** `player_snapshots`, `battles`, `friendships`, `guilds`, `guild_members`, `guild_boss_fights`

**Key Fields on `players`:**
```sql
user_id, total_xp, current_streak, longest_streak, last_active_date,
total_tasks_completed, total_expedition_minutes,
unspent_stat_points, stat_vitality, stat_power, stat_arcana,
stat_agility, stat_fortune, total_stat_points_earned
```

---

## 6. Recent Session Work

### This Session (2026-02-07)
1. **Fixed Power stat bonus not affecting combat damage**
   - Guild boss attacks weren't using Power stat
   - Guild boss spells weren't using Power stat
   - Dungeon UI wasn't displaying Power bonus
   - Files: `guildBoss.js`, `Dungeon.svelte`

### Recent Commits (chronological)
```
91984d4 Fix Power stat bonus not affecting combat damage
90bbd19 Add dungeon XP system with extraction mechanics
0ef47ba Implement equipment special effects in combat
e333c87 Fix XP not persisting after page refresh
2d3bf1a Fix hardcoded base damage display in combat toasts
4ee35da Lower base damage from 10 to 5 in combat
9ed1e71 Add standalone SQL schema for stat allocation system
7a0422c Add stat allocation system with 5 core stats
```

---

## 7. Database Schema Changes

### SQL to Run in Supabase

**Stat Allocation System** (`/supabase/stat_allocation_schema.sql`):
```sql
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS unspent_stat_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_vitality INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_power INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_arcana INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_agility INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_fortune INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stat_points_earned INTEGER DEFAULT 0;
```

**Multiplayer Schema** (`/supabase/multiplayer_schema.sql`):
- `player_snapshots` - PvP combat stats
- `battles` - Battle history with logs
- `friendships` - Friend relationships
- `guilds`, `guild_members`, `guild_boss_fights` - Guild system

---

## 8. Current Branch

```
claude/refactor-battle-ui-special-attack-bqtj1
```

Status: Clean (all changes committed and pushed)

---

## 9. Pending/Incomplete Work

Currently no incomplete work on this branch. All recent fixes have been committed.

---

## 10. Known Issues or Bugs

1. **None currently tracked** - Recent session addressed stat allocation bugs

---

## 11. Next Up (Ready to Implement)

1. **Battle UI Overhaul** - The branch name suggests special attack UI improvements were planned
2. **Guild Quests** - `guildQuestProgress` table exists but feature not fully implemented
3. **Leaderboards** - PvP leaderboard exists, could add more (XP, dungeons, etc.)
4. **Dungeon XP Display** - Show XP earned during runs more prominently
5. **More Tainted Items** - Expand cursed item pool
6. **Boss Rush Mode** - Consecutive boss fights
7. **Daily Login Rewards**
8. **Trading System**

---

## 12. Key Formulas

### XP & Leveling
```javascript
// XP required for level
getXPForLevel(level) = Math.floor(100 × 1.5^(level-1))

// Task XP with streak multiplier
taskXP = BASE_XP[priority] × streakMultiplier
// BASE_XP: low=10, medium=25, high=50
// Streak: 3+=1.25x, 7+=1.5x, 14+=1.75x, 30+=2.0x

// Stat points per level
POINTS_PER_LEVEL = 2
```

### Combat Damage
```javascript
// Player attack
baseDamage = 5
diceRoll = 2D6 (sum of two dice)
powerBonus = calculateStatBonus('power', stats.power)
totalDamage = baseDamage + diceRoll + upgrades + tempBuffs + equipment + powerBonus

// Critical hit (on doubles OR equipment crit chance)
critDamage = Math.floor(totalDamage × (2 + critDamageBonus/100))

// Monster damage
monsterDamage = monster.damage × (diceRoll/7) × modifierMultiplier
```

### Stat Scaling
```javascript
calculateStatBonus(stat, points) {
  const config = STAT_CONFIG[stat];
  if (points <= config.softCap) {
    return points × config.perPoint;
  }
  const softCapBonus = config.softCap × config.perPoint;
  const overCap = points - config.softCap;
  return softCapBonus + (overCap × config.diminishedPerPoint);
}

// STAT_CONFIG:
// vitality: +3 HP/pt (soft 20, then +1.5)
// power: +0.5 dmg/pt (soft 20, then +0.25)
// arcana: +2 MP/pt (soft 20, then +1)
// agility: +0.5% dodge/pt (hard cap 50, max 25%)
// fortune: +1% loot/pt (hard cap 30)
```

### Monster Scaling
```javascript
floorMultiplier = 1 + (floor - 1) × 0.18
monsterHP = baseHP × floorMultiplier × modifierMultiplier
monsterDamage = baseDamage × floorMultiplier × modifierMultiplier
```

### Loot Rarity
```javascript
// Fortune increases all rarity chances
adjustedChance = baseChance × (1 + fortuneBonus/100)

// Drop chances (monster): common 65%, uncommon 20%, rare 10%, epic 5%
// Drop chances (major boss): tainted 10%, epic 10%, rare 20%, uncommon 35%, common 25%
```

### Extraction Rates
```javascript
EXTRACTION_RATES = {
  death: 0,      // Lose all loot
  flee: 0.5,     // Keep 50% of loot
  victory: 1.0   // Keep 100% of loot
}
```

### Respec Cost
```javascript
respecCost = 100 × playerLevel
```

### Spell Mana Cost
```javascript
calculateManaCost(damage) {
  return Math.ceil((damage/2) + (damage^1.5 / 10))
}
// Examples: 10 dmg = 9 MP, 20 dmg = 19 MP, 50 dmg = 60 MP
```

---

## Quick Reference: Key File Locations

| What | Where |
|------|-------|
| Game config (monsters, items, stats) | `src/lib/db/schema.js` |
| Combat logic | `src/lib/stores/dungeon.js` |
| Equipment generation | `src/lib/stores/equipment.js` |
| XP/level calculations | `src/lib/services/xpService.js` |
| Stat allocation | `src/lib/stores/player.js` |
| PvP battle engine | `src/lib/game/battleEngine.js` |
| Guild boss combat | `src/lib/stores/guildBoss.js` |
| Cloud sync | `src/lib/supabase/sync.js` |

---

## Development Commands

```bash
npm install    # Install dependencies
npm run dev    # Start dev server (Vite)
npm run build  # Production build
npm run preview # Preview production build
```

---

*End of handoff document*
