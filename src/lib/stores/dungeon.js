import { writable, derived, get } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES, MERCHANT, MERCHANT_ITEMS } from '../db/index.js';
import { playerData } from './player.js';
import { pushDungeonUpdate, pushPlayerUpdate } from '../supabase/sync.js';
import {
  rollLootDrop,
  addToPendingLoot,
  clearPendingLoot,
  extractPendingLoot,
  pendingLootData,
  equippedStats
} from './equipment.js';

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

// Persistent dungeon data from DB
export const dungeonData = createLiveQueryStore(() => db.dungeon.get(1), null);

// Current run state (not persisted - resets on page refresh)
export const currentRun = writable(null);

// Game phase: 'idle' | 'exploring' | 'combat' | 'victory' | 'defeat' | 'retreat'
export const gamePhase = writable('idle');

// Combat log for displaying messages (kept for history but not primary display)
export const combatLog = writable([]);

// Current combat message (Pokemon-style single message display)
export const currentMessage = writable('');

// Dice roll result for animation
export const lastRoll = writable(null);

// Combat state for turn-based flow and animations
export const combatState = writable({
  turn: 'player', // 'player' | 'enemy' | 'animating'
  isAnimating: false,
  playerAction: null, // 'attack' | 'defend' | 'potion' | 'spell' | null
  enemyAction: null, // 'attack' | null
  lastDamageToEnemy: null,
  lastDamageToPlayer: null,
  monsterDefeated: false,
  playerDefeated: false
});

// ============ Spell Balancing System ============
// The formula ensures spells are balanced based on mana cost
// Higher damage = higher mana cost, with diminishing returns

const BASE_MAX_MP = 50; // Starting mana pool
const MP_REGEN_PER_TURN = 5; // Mana regenerated each turn

// Calculate required mana cost for a given damage
// Formula: manaCost = (damage / 2) + (damage^1.5 / 10)
// This means high damage spells cost proportionally more mana
export function calculateManaCost(damage) {
  const baseCost = damage / 2;
  const scalingCost = Math.pow(damage, 1.5) / 10;
  return Math.ceil(baseCost + scalingCost);
}

// Calculate max damage allowed for a given mana cost
// Inverse of the above formula (approximate)
export function calculateMaxDamage(manaCost) {
  // Solve for damage: we need to find damage where calculateManaCost(damage) = manaCost
  // Using binary search for accuracy
  let low = 0;
  let high = manaCost * 3; // Upper bound estimate
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (calculateManaCost(mid) <= manaCost) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

// Calculate max spell damage based on player level
export function getMaxSpellDamage(level) {
  if (level >= 50) return 100;
  if (level >= 25) return 75;
  if (level >= 10) return 50;
  return 25;
}

// Get spell edit cost (0 for new, gold cost for editing existing)
export function getSpellEditCost(slotIndex, hasExistingSpell) {
  if (!hasExistingSpell) return 0; // Free to create new spell
  // Cost scales slightly with slot (higher slots = more powerful = more cost to change)
  return 15 + (slotIndex * 5); // Slot 1: 15g, Slot 2: 20g, Slot 3: 25g, etc.
}

// Get spell delete cost (costs more than editing to discourage delete+recreate exploit)
export function getSpellDeleteCost(slotIndex) {
  return 20 + (slotIndex * 5); // Slot 1: 20g, Slot 2: 25g, Slot 3: 30g, etc.
}

// Validate spell - returns { valid, error, suggestedManaCost }
export function validateSpell(damage, manaCost, level = 1) {
  const requiredCost = calculateManaCost(damage);
  const maxDamage = getMaxSpellDamage(level);

  if (damage < 1) {
    return { valid: false, error: 'Damage must be at least 1', suggestedManaCost: 1 };
  }

  if (damage > maxDamage) {
    return {
      valid: false,
      error: `Max damage at your level is ${maxDamage}. Reach level ${level < 10 ? 10 : level < 25 ? 25 : 50} for higher!`,
      suggestedManaCost: calculateManaCost(maxDamage)
    };
  }

  if (manaCost < requiredCost) {
    return {
      valid: false,
      error: `Mana cost too low! ${damage} damage requires at least ${requiredCost} MP`,
      suggestedManaCost: requiredCost
    };
  }

  return { valid: true, suggestedManaCost: requiredCost };
}

// ============ Spell Slot System ============
// Base: 1 slot
// Level bonuses: +1 at level 10, +1 at level 25, +1 at level 50
// Shop: +1 purchasable (permanent, max 1)

export function calculateSpellSlots(level, purchasedSpellSlot = false) {
  let slots = 1; // Base slot

  // Level milestones
  if (level >= 10) slots++;
  if (level >= 25) slots++;
  if (level >= 50) slots++;

  // Purchased slot from shop
  if (purchasedSpellSlot) slots++;

  return slots;
}

// Get current player's spell slots
export function getSpellSlots() {
  const player = get(playerData);
  const level = player?.level || 1;
  const purchased = player?.purchasedSpellSlot || false;
  return calculateSpellSlots(level, purchased);
}

// Helper to reset combat state for new encounter
function resetCombatState() {
  combatState.set({
    turn: 'player',
    isAnimating: false,
    playerAction: null,
    enemyAction: null,
    lastDamageToEnemy: null,
    lastDamageToPlayer: null,
    monsterDefeated: false,
    playerDefeated: false
  });
}

// Helper to delay for animations
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Dice Rolling ============

function rollDice(count = 2, sides = 6) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

function rollD6(count = 2) {
  return rollDice(count, 6);
}

// ============ Monster Generation ============

function getMonsterTier(floor) {
  if (floor <= 3) return 'common';
  if (floor <= 6) return 'uncommon';
  return 'rare';
}

function generateMonster(floor) {
  const tier = getMonsterTier(floor);
  const monsterPool = MONSTERS[tier];
  const baseMonster = monsterPool[Math.floor(Math.random() * monsterPool.length)];

  // Scale stats with floor (18% per floor for meaningful progression)
  const floorMultiplier = 1 + (floor - 1) * 0.18;

  // Random chance for modifier (35% - more elite encounters)
  let modifier = null;
  if (Math.random() < 0.35) {
    modifier = MONSTER_MODIFIERS[Math.floor(Math.random() * MONSTER_MODIFIERS.length)];
  }

  const hpMultiplier = modifier?.hpMultiplier || 1;
  const damageMultiplier = modifier?.damageMultiplier || 1;
  const goldMultiplier = modifier?.goldMultiplier || 1;

  const hp = Math.floor(baseMonster.baseHp * floorMultiplier * hpMultiplier);
  const damage = Math.floor(baseMonster.baseDamage * floorMultiplier * damageMultiplier);
  const [minGold, maxGold] = baseMonster.goldDrop;
  const goldReward = Math.floor((minGold + Math.random() * (maxGold - minGold)) * goldMultiplier);

  return {
    ...baseMonster,
    modifier,
    displayName: modifier ? `${modifier.name} ${baseMonster.name}` : baseMonster.name,
    maxHp: hp,
    currentHp: hp,
    damage,
    goldReward
  };
}

function generateBoss(floorNumber, isMajor = false) {
  // Pick from major bosses for floor 10, 20, etc. or mini-bosses otherwise
  const bossPool = isMajor ? BOSSES.major : BOSSES.mini;
  const baseBoss = bossPool[Math.floor(Math.random() * bossPool.length)];

  // Scale boss stats with floor number
  const floorScale = 1 + (floorNumber - 1) * 0.08; // 8% increase per floor
  const hp = Math.floor(baseBoss.baseHp * floorScale);
  const damage = Math.floor(baseBoss.baseDamage * floorScale);

  const [minGold, maxGold] = baseBoss.goldDrop;
  const goldReward = Math.floor((minGold + Math.random() * (maxGold - minGold)) * floorScale);

  return {
    ...baseBoss,
    displayName: baseBoss.name,
    maxHp: hp,
    currentHp: hp,
    damage,
    goldReward,
    isBoss: true,
    isMiniBoss: !isMajor,
    isMajorBoss: isMajor
  };
}

// ============ Floor Generation ============

function generateMerchantItems() {
  // Select 3-4 random items from the merchant pool
  const itemCount = 3 + Math.floor(Math.random() * 2);
  const shuffled = [...MERCHANT_ITEMS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, itemCount);
}

function generateLootChestItems() {
  // Select exactly 3 random items for the chest choice
  const shuffled = [...MERCHANT_ITEMS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function generateFloor(floorNumber) {
  // Major boss floors: every 10 floors (10, 20, 30, etc.)
  const isMajorBossFloor = floorNumber % 10 === 0;

  if (isMajorBossFloor) {
    return {
      floorNumber,
      rooms: [{ type: 'boss', monster: generateBoss(floorNumber, true), completed: false }],
      currentRoom: 0,
      isBossFloor: true,
      isMajorBossFloor: true
    };
  }

  // Regular floors have 4-10 rooms
  const roomCount = 4 + Math.floor(Math.random() * 7); // 4 to 10
  const rooms = [];

  // First, check if loot chest appears (8% chance)
  // Loot chest can appear in rooms 2 through (roomCount - 1) - not first, not last
  let lootChestRoomIndex = -1;
  if (Math.random() < 0.08 && roomCount >= 3) {
    const minIndex = 1;
    const maxIndex = roomCount - 2;
    if (maxIndex >= minIndex) {
      lootChestRoomIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
    }
  }

  // Merchant can only appear if NO loot chest on this floor
  // Merchant can only appear in rooms 3 through (roomCount - 1) - not first 2, not last
  const merchantSpawns = lootChestRoomIndex === -1 && Math.random() < MERCHANT.spawnChance;
  let merchantRoomIndex = -1;

  if (merchantSpawns && roomCount >= 4) {
    const minIndex = 2;
    const maxIndex = roomCount - 2;
    if (maxIndex >= minIndex) {
      merchantRoomIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
    }
  }

  // Determine if this floor has a mini-boss at the end
  // Mini-boss appears if: chest/merchant on floor, every 3rd floor, or 25% random chance
  const hasSpecialRoom = lootChestRoomIndex !== -1 || merchantRoomIndex !== -1;
  const isMiniBossFloor = hasSpecialRoom || (floorNumber % 3 === 0) || Math.random() < 0.25;

  for (let i = 0; i < roomCount; i++) {
    const isLastRoom = i === roomCount - 1;

    // Last room is mini-boss if this is a mini-boss floor
    if (isLastRoom && isMiniBossFloor) {
      rooms.push({
        type: 'boss',
        monster: generateBoss(floorNumber, false),
        completed: false
      });
      continue;
    }

    // Loot chest room
    if (i === lootChestRoomIndex) {
      // Determine if chest is a mimic (20% chance) or boss mimic (3% chance)
      const mimicRoll = Math.random();
      let isMimic = false;
      let isBossMimic = false;

      if (mimicRoll < 0.03) {
        isBossMimic = true;
        isMimic = true;
      } else if (mimicRoll < 0.20) {
        isMimic = true;
      }

      rooms.push({
        type: 'loot_chest',
        items: generateLootChestItems(),
        isMimic,
        isBossMimic,
        mimicMonster: isMimic ? (isBossMimic ? generateBoss(floorNumber, false) : generateMonster(floorNumber)) : null,
        opened: false,
        completed: false
      });
      continue;
    }

    // Merchant room
    if (i === merchantRoomIndex) {
      rooms.push({
        type: 'merchant',
        merchant: {
          ...MERCHANT,
          items: generateMerchantItems()
        },
        completed: false
      });
      continue;
    }

    // Special room chances (not first room, not last room):
    // 12% treasure, 10% shrine
    const roll = Math.random();
    if (roll < 0.12 && i > 0 && !isLastRoom) {
      // Treasure room (bonus gold)
      rooms.push({
        type: 'treasure',
        goldBonus: 5 + Math.floor(Math.random() * 10) + floorNumber * 2,
        completed: false
      });
    } else if (roll < 0.22 && i > 0 && !isLastRoom) {
      // Rest shrine (heal some HP)
      rooms.push({
        type: 'shrine',
        healAmount: 10 + Math.floor(Math.random() * 10),
        completed: false
      });
    } else {
      // Combat room
      rooms.push({
        type: 'combat',
        monster: generateMonster(floorNumber),
        completed: false
      });
    }
  }

  return {
    floorNumber,
    rooms,
    currentRoom: 0,
    isBossFloor: isMiniBossFloor,
    isMiniBossFloor,
    hasMidFloorMerchant: merchantRoomIndex !== -1
  };
}

// ============ Run Management ============

export async function startRun() {
  const dungeon = await db.dungeon.get(1);
  const player = await db.player.get(1);

  // Get equipment bonuses
  const equipStats = get(equippedStats) || {};

  // Calculate max HP with upgrades + equipment
  const baseMaxHp = 100;
  const maxHp = baseMaxHp + (dungeon?.maxHpBonus || 0) + (equipStats.maxHp || 0);

  // Calculate max MP with upgrades + equipment
  const maxMp = BASE_MAX_MP + (dungeon?.maxMpBonus || 0) + (equipStats.maxMp || 0);

  // Get gold, spells from PLAYER (syncs with cloud)
  const bankGold = player?.gold || 0;
  const customSpells = player?.customSpells || [];

  // Check for auto-potion upgrade - only way to start with a potion
  const hasAutoPotion = dungeon?.upgrades?.includes('auto_potion') || false;
  const startingPotions = hasAutoPotion ? 1 : 0;

  const run = {
    currentFloor: 1,
    floor: generateFloor(1),
    playerHp: maxHp,
    maxHp,
    playerMp: maxMp,
    maxMp,
    goldCollected: 0,
    bankGold, // From player - syncs with cloud
    potions: startingPotions, // All potions are temporary - gone when run ends
    potionsUsed: 0,
    monstersKilled: 0,
    isDefending: false,
    // Store upgrade bonuses for this run
    bonusDamage: dungeon?.bonusDamage || 0,
    potionHeal: 25 + (dungeon?.potionBonus || 0),
    critBonus: dungeon?.critBonus || 0,
    defenseBonus: dungeon?.defenseBonus || 0,
    // Store custom spells for this run (array) - from player
    customSpells,
    // Temporary buffs from merchant (this run only)
    tempBuffs: {
      bonusDamage: 0,
      defenseBonus: 0,
      goldBonus: 0
    },
    // Status effects from boss abilities
    statusEffects: {
      damageReduction: 0,      // Dark Knight Shield Bash
      damageReductionTurns: 0,
      extraDamageTaken: 0,     // Swamp Witch Hex
      burnDamage: 0,           // Demon Lord Hellfire
      burnTurns: 0,
      stunned: false,          // Medusa Petrify, Fallen Titan
      grabbed: false,          // Kraken Tentacle Grab
      grabDamage: 0
    },
    // Boss-specific state
    bossState: {
      isCharging: false,       // Minotaur Charge
      hasRevived: false,       // Dark Phoenix Rebirth
      skeletonActive: false,   // Necromancer Summon
      skeletonHp: 0
    }
  };

  // Lock scroll immediately when entering dungeon
  if (typeof document !== 'undefined') {
    document.body.classList.add('no-scroll');
    // Reset scroll position to top
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  currentRun.set(run);
  gamePhase.set('exploring');
  combatLog.set([{ type: 'info', message: 'You enter the dungeon...' }]);
  resetCombatState();

  // Update total runs
  const runUpdate = { totalRuns: (dungeon?.totalRuns || 0) + 1 };
  await db.dungeon.update(1, runUpdate);

  // Sync to cloud
  pushDungeonUpdate(runUpdate);

  return run;
}

export async function endRun(victory = false) {
  const run = get(currentRun);
  if (!run) return;

  if (victory) {
    gamePhase.set('victory');
  } else {
    // On death, clear all pending loot - extraction mechanic!
    await clearPendingLoot();
    gamePhase.set('defeat');
  }
}

export async function collectRewards() {
  const run = get(currentRun);
  if (!run) return;

  const dungeon = await db.dungeon.get(1);
  const player = await db.player.get(1);

  // Extract pending loot to inventory - the extraction mechanic!
  const { extracted, overflow } = await extractPendingLoot();
  if (extracted.length > 0) {
    console.log(`Extracted ${extracted.length} items from pending loot`);
  }
  if (overflow.length > 0) {
    console.log(`${overflow.length} items lost - inventory full!`);
  }

  // Calculate new stats
  const newGold = (player?.gold || 0) + run.goldCollected;
  const newHighestFloor = Math.max(player?.highestFloor || 0, run.currentFloor);
  const newTotalKills = (player?.totalKills || 0) + run.monstersKilled;

  // Update PLAYER with gold and stats (syncs with cloud)
  const playerUpdates = {
    gold: newGold,
    highestFloor: newHighestFloor,
    totalKills: newTotalKills
  };
  await db.player.update(1, playerUpdates);
  pushPlayerUpdate(playerUpdates);

  // Update dungeon analytics (local only - for detailed tracking)
  const dungeonUpdates = {
    totalGoldEarned: (dungeon?.totalGoldEarned || 0) + run.goldCollected,
    bossesDefeated: run.currentFloor === 10 && get(gamePhase) === 'victory'
      ? (dungeon?.bossesDefeated || 0) + 1
      : dungeon?.bossesDefeated || 0
  };
  await db.dungeon.update(1, dungeonUpdates);

  // Reset run and unlock scroll
  if (typeof document !== 'undefined') {
    document.body.classList.remove('no-scroll');
  }
  currentRun.set(null);
  gamePhase.set('idle');
  combatLog.set([]);
}

// Safe retreat - after completing a floor, keep all gold
export async function retreat() {
  const run = get(currentRun);
  if (!run) return;

  gamePhase.set('retreat');
  addLog('info', `You safely retreat with ${run.goldCollected} gold!`);

  // Collect full rewards on safe retreat
  await collectRewards();
}

// Emergency retreat - can use anytime, but lose half your gold
export async function emergencyRetreat() {
  const run = get(currentRun);
  if (!run) return;

  // Calculate gold penalty
  const goldLost = Math.floor(run.goldCollected / 2);
  const goldKept = run.goldCollected - goldLost;

  // Update run with reduced gold
  run.goldCollected = goldKept;
  currentRun.set(run);

  gamePhase.set('retreat');

  if (goldLost > 0) {
    addLog('warning', `Emergency retreat! You lost ${goldLost} gold in your haste!`);
    addLog('info', `You escape with ${goldKept} gold.`);
  } else {
    addLog('info', `You flee the dungeon!`);
  }

  // Collect reduced rewards
  await collectRewards();
}

// ============ Combat Actions ============

function addLog(type, message) {
  combatLog.update(logs => [...logs.slice(-20), { type, message }]);
  currentMessage.set(message);
}

// Process status effects at start of player's turn
async function processStatusEffects(run) {
  let canAct = true;

  // Check stunned
  if (run.statusEffects?.stunned) {
    addLog('warning', `You're STUNNED and cannot act!`);
    run.statusEffects.stunned = false; // Stun wears off after 1 turn
    canAct = false;
  }

  // Check grabbed (Kraken)
  if (run.statusEffects?.grabbed) {
    addLog('warning', `You're GRABBED by tentacles! Try to break free!`);
    canAct = false;
  }

  // Apply burn damage
  if (run.statusEffects?.burnTurns > 0) {
    const burnDmg = run.statusEffects.burnDamage;
    run.playerHp = Math.max(0, run.playerHp - burnDmg);
    run.statusEffects.burnTurns--;
    addLog('enemy', `🔥 You take ${burnDmg} burn damage! (${run.statusEffects.burnTurns} turns left)`);
    combatState.update(s => ({ ...s, lastDamageToPlayer: burnDmg }));
    await delay(400);
    combatState.update(s => ({ ...s, lastDamageToPlayer: null }));

    if (run.playerHp <= 0) {
      combatState.update(s => ({ ...s, playerDefeated: true }));
      addLog('death', 'You have been defeated...');
      await delay(800);
      endRun(false);
      return { canAct: false, playerDead: true };
    }
  }

  // Decrement damage reduction turns
  if (run.statusEffects?.damageReductionTurns > 0) {
    run.statusEffects.damageReductionTurns--;
    if (run.statusEffects.damageReductionTurns === 0) {
      run.statusEffects.damageReduction = 0;
      addLog('info', `Your strength returns to normal!`);
    }
  }

  currentRun.set(run);
  return { canAct, playerDead: false };
}

// Reset status effects for new monster encounter
function resetStatusEffects(run) {
  if (run.statusEffects) {
    run.statusEffects = {
      damageReduction: 0,
      damageReductionTurns: 0,
      extraDamageTaken: 0,
      burnDamage: 0,
      burnTurns: 0,
      stunned: false,
      grabbed: false,
      grabDamage: 0
    };
  }
  if (run.bossState) {
    run.bossState = {
      isCharging: false,
      hasRevived: false,
      skeletonActive: false,
      skeletonHp: 0
    };
  }
}

export async function playerAttack() {
  const run = get(currentRun);
  if (!run) return;

  const state = get(combatState);
  if (state.isAnimating) return; // Prevent actions during animations

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'combat' && room.type !== 'boss') return;

  const monster = room.monster;

  // Process status effects and check if player can act
  const { canAct, playerDead } = await processStatusEffects(run);
  if (playerDead) return;
  if (!canAct) {
    // Player is stunned/grabbed - skip to enemy turn
    combatState.update(s => ({ ...s, isAnimating: true, turn: 'enemy' }));
    await delay(600);
    await monsterAttack(run, monster);
    if (run.playerHp > 0) {
      currentMessage.set('Your move!');
      lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
      await delay(600);
    }
    combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
    currentRun.set(run);
    return;
  }

  // Clear "Your move!" message when player acts
  currentMessage.set('');

  // Start player attack animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'attack', turn: 'animating' }));

  // Roll 2D6 for damage
  const rolls = rollD6(2);
  const total = rolls.reduce((a, b) => a + b, 0);
  const isDoubles = rolls[0] === rolls[1];

  // Get equipment bonuses
  const equipStats = get(equippedStats) || {};

  // Calculate damage with bonuses (permanent + temporary + equipment)
  let damage = total + run.bonusDamage + (run.tempBuffs?.bonusDamage || 0) + (equipStats.damage || 0);

  // Apply boss slayer bonus if fighting a boss
  if (monster.isBoss && equipStats.bossSlayer > 0) {
    damage += equipStats.bossSlayer;
  }

  // Apply damage reduction from boss abilities (Dark Knight Shield Bash)
  if (run.statusEffects?.damageReduction > 0) {
    damage = Math.max(1, damage - run.statusEffects.damageReduction);
    addLog('warning', `Your damage is reduced by ${run.statusEffects.damageReduction}!`);
  }

  // Check for equipment-based crit bonus
  const critBonus = (equipStats.critChance || 0) / 100;
  const hasEquipCrit = !isDoubles && Math.random() < critBonus;

  // Critical hit on doubles or equipment crit
  if (isDoubles || hasEquipCrit) {
    const critMultiplier = 2 + ((equipStats.critDamage || 0) / 100);
    damage = Math.floor(damage * critMultiplier);
    if (isDoubles) {
      addLog('crit', `CRITICAL HIT! Rolled ${rolls[0]}+${rolls[1]} (doubles)!`);
    } else {
      addLog('crit', `CRITICAL HIT! (Equipment bonus)!`);
    }
  } else {
    addLog('roll', `You rolled ${rolls[0]}+${rolls[1]} = ${total}`);
  }

  lastRoll.set({ rolls, total, type: 'attack', critical: isDoubles });

  // Wait for dice animation
  await delay(400);

  // Apply damage and show damage number
  monster.currentHp = Math.max(0, monster.currentHp - damage);
  combatState.update(s => ({ ...s, lastDamageToEnemy: damage }));
  addLog('damage', `You deal ${damage} damage to ${monster.displayName}!`);

  // Also damage skeleton ally if active (splash damage)
  if (run.bossState?.skeletonActive && run.bossState.skeletonHp > 0) {
    const skeletonDamage = Math.floor(damage * 0.5); // 50% splash damage
    run.bossState.skeletonHp = Math.max(0, run.bossState.skeletonHp - skeletonDamage);
    addLog('damage', `💀 Skeleton takes ${skeletonDamage} splash damage!`);
    if (run.bossState.skeletonHp <= 0) {
      run.bossState.skeletonActive = false;
      addLog('victory', `💀 The skeleton crumbles to dust!`);
    }
  }

  currentRun.set(run);

  // Wait for damage animation
  await delay(600);

  // Clear player action
  combatState.update(s => ({ ...s, playerAction: null, lastDamageToEnemy: null }));

  // Clear defending status
  run.isDefending = false;

  // Check if monster is dead
  if (monster.currentHp <= 0) {
    combatState.update(s => ({ ...s, monsterDefeated: true }));
    await delay(800); // Wait for defeat animation
    await monsterDefeated(run, room, monster);
    combatState.update(s => ({ ...s, isAnimating: false, monsterDefeated: false }));
  } else {
    // Monster counter-attacks
    combatState.update(s => ({ ...s, turn: 'enemy' }));
    currentMessage.set(`${monster.displayName} strikes back!`);
    lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
    await delay(600);
    await monsterAttack(run, monster);

    // Check if player survived before showing "Your move"
    if (run.playerHp > 0) {
      currentMessage.set('Your move!');
      lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
      await delay(600);
    }
    combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
  }

  currentRun.set(run);
}

export async function playerDefend() {
  const run = get(currentRun);
  if (!run) return;

  const state = get(combatState);
  if (state.isAnimating) return; // Prevent actions during animations

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'combat' && room.type !== 'boss') return;

  const monster = room.monster;

  // Process status effects and check if player can act
  const { canAct, playerDead } = await processStatusEffects(run);
  if (playerDead) return;
  if (!canAct) {
    // Player is stunned/grabbed - skip to enemy turn
    combatState.update(s => ({ ...s, isAnimating: true, turn: 'enemy' }));
    await delay(600);
    await monsterAttack(run, monster);
    if (run.playerHp > 0) {
      currentMessage.set('Your move!');
      lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
      await delay(600);
    }
    combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
    currentRun.set(run);
    return;
  }

  // Clear "Your move!" message when player acts
  currentMessage.set('');

  // Start defend animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'defend', turn: 'animating' }));

  // Roll 1D6 for defense (permanent + temporary + equipment bonus)
  const rolls = rollD6(1);
  const equipStats = get(equippedStats) || {};
  const defenseAmount = rolls[0] + run.defenseBonus + (run.tempBuffs?.defenseBonus || 0) + (equipStats.defense || 0);

  addLog('defend', `You brace yourself! Blocking ${defenseAmount} damage.`);

  run.isDefending = true;
  run.defenseAmount = defenseAmount;

  lastRoll.set({ rolls, total: defenseAmount, type: 'defend' });

  await delay(500);

  // Monster attacks
  combatState.update(s => ({ ...s, playerAction: null, turn: 'enemy' }));
  currentMessage.set(`${monster.displayName} strikes back!`);
  lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
  await delay(600);
  await monsterAttack(run, monster);

  // Check if player survived before showing "Your move"
  if (run.playerHp > 0) {
    currentMessage.set('Your move!');
    lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
    await delay(600);
  }
  combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
  currentRun.set(run);
}

async function monsterAttack(run, monster) {
  // Start enemy attack animation
  combatState.update(s => ({ ...s, enemyAction: 'attack' }));

  // Check for boss special abilities
  if (monster.isBoss && monster.special) {
    const usedSpecial = await handleBossSpecial(run, monster);
    if (usedSpecial) return; // Special handled the attack
  }

  // Regular attack (or boss basic attack)
  await performBasicAttack(run, monster);
}

// Handle boss special abilities
async function handleBossSpecial(run, monster) {
  const special = monster.key;
  const hpPercent = monster.currentHp / monster.maxHp;

  switch (special) {
    // === MINI-BOSSES ===
    case 'troll': // Regenerate - Heals 5 HP each turn
      const healAmount = 5;
      monster.currentHp = Math.min(monster.maxHp, monster.currentHp + healAmount);
      addLog('boss', `🧌 ${monster.displayName} regenerates ${healAmount} HP!`);
      await delay(400);
      await performBasicAttack(run, monster);
      return true;

    case 'dark_knight': // Shield Bash - Reduces your damage by 2 for 2 turns
      if (Math.random() < 0.4) { // 40% chance to use special
        run.statusEffects.damageReduction = 2;
        run.statusEffects.damageReductionTurns = 2;
        addLog('boss', `🖤 ${monster.displayName} bashes you with their shield! Your damage is reduced!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        await performBasicAttack(run, monster);
        return true;
      }
      return false;

    case 'witch': // Hex - Curses you to take +3 damage
      if (run.statusEffects.extraDamageTaken === 0 && Math.random() < 0.5) {
        run.statusEffects.extraDamageTaken = 3;
        addLog('boss', `🧙‍♀️ ${monster.displayName} hexes you! You take +3 damage from all attacks!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        return true; // Hex instead of attacking
      }
      return false;

    case 'werewolf': // Frenzy - Attacks twice when below 50% HP
      if (hpPercent < 0.5) {
        addLog('boss', `🐺 ${monster.displayName} enters a FRENZY! Double attack!`);
        await delay(400);
        await performBasicAttack(run, monster);
        if (run.playerHp > 0) {
          await delay(300);
          addLog('boss', `🐺 ${monster.displayName} strikes again!`);
          await performBasicAttack(run, monster);
        }
        return true;
      }
      return false;

    case 'necromancer': // Summon - Summons a skeleton ally
      if (!run.bossState.skeletonActive && Math.random() < 0.3) {
        run.bossState.skeletonActive = true;
        run.bossState.skeletonHp = 20;
        addLog('boss', `💀 ${monster.displayName} summons a Skeleton Warrior!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        return true;
      }
      // Skeleton attacks if active
      if (run.bossState.skeletonActive) {
        const skeleDamage = 5;
        run.playerHp = Math.max(0, run.playerHp - skeleDamage);
        addLog('enemy', `💀 Skeleton attacks for ${skeleDamage} damage!`);
        combatState.update(s => ({ ...s, lastDamageToPlayer: skeleDamage }));
        await delay(400);
        combatState.update(s => ({ ...s, lastDamageToPlayer: null }));
      }
      return false; // Still do regular attack

    case 'minotaur': // Charge - Next attack deals double damage
      if (!run.bossState.isCharging && Math.random() < 0.35) {
        run.bossState.isCharging = true;
        addLog('boss', `🐂 ${monster.displayName} lowers their horns and CHARGES UP!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        return true; // Charging instead of attacking
      }
      if (run.bossState.isCharging) {
        addLog('boss', `🐂 ${monster.displayName} unleashes a DEVASTATING CHARGE!`);
        await delay(300);
        await performBasicAttack(run, monster, 2.0); // Double damage
        run.bossState.isCharging = false;
        return true;
      }
      return false;

    case 'medusa': // Petrify - Stuns you for 1 turn
      if (!run.statusEffects.stunned && Math.random() < 0.25) {
        run.statusEffects.stunned = true;
        addLog('boss', `🐍 ${monster.displayName}'s gaze turns you to STONE! You're stunned!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        await performBasicAttack(run, monster);
        return true;
      }
      return false;

    case 'giant': // Stomp - Deals damage to your MP too
      if (Math.random() < 0.4) {
        addLog('boss', `👤 ${monster.displayName} STOMPS the ground!`);
        await delay(300);
        await performBasicAttack(run, monster);
        if (run.playerHp > 0) {
          const mpDamage = 10;
          run.playerMp = Math.max(0, run.playerMp - mpDamage);
          addLog('boss', `The shockwave drains ${mpDamage} MP!`);
        }
        return true;
      }
      return false;

    // === MAJOR BOSSES ===
    case 'dragon': // Fire Breath - Deals 25 damage, ignores defense
      if (Math.random() < 0.35) {
        const fireBreathDamage = 25;
        run.isDefending = false; // Ignores defense
        run.defenseAmount = 0;
        addLog('boss', `🐉 ${monster.displayName} unleashes FIRE BREATH!`);
        lastRoll.set({ rolls: [fireBreathDamage], total: fireBreathDamage, type: 'special', critical: false });
        await delay(400);
        run.playerHp = Math.max(0, run.playerHp - fireBreathDamage);
        combatState.update(s => ({ ...s, lastDamageToPlayer: fireBreathDamage }));
        addLog('crit', `Fire engulfs you for ${fireBreathDamage} damage! (Ignores defense)`);
        currentRun.set(run);
        await delay(500);
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;

    case 'lich': // Soul Drain - Steals 15 HP from you
      if (Math.random() < 0.35) {
        const drainAmount = 15;
        addLog('boss', `☠️ ${monster.displayName} drains your SOUL!`);
        lastRoll.set({ rolls: [drainAmount], total: drainAmount, type: 'special', critical: false });
        await delay(400);
        run.playerHp = Math.max(0, run.playerHp - drainAmount);
        monster.currentHp = Math.min(monster.maxHp, monster.currentHp + drainAmount);
        combatState.update(s => ({ ...s, lastDamageToPlayer: drainAmount }));
        addLog('crit', `${drainAmount} HP stolen! The Lich heals!`);
        currentRun.set(run);
        await delay(500);
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;

    case 'demon_lord': // Hellfire - Burns for 8 damage over 3 turns
      if (run.statusEffects.burnTurns === 0 && Math.random() < 0.4) {
        run.statusEffects.burnDamage = 8;
        run.statusEffects.burnTurns = 3;
        addLog('boss', `👿 ${monster.displayName} engulfs you in HELLFIRE! You're burning!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        await performBasicAttack(run, monster);
        return true;
      }
      return false;

    case 'hydra': // Multi-Strike - Attacks 3 times for 8 damage each
      if (Math.random() < 0.4) {
        addLog('boss', `🐲 ${monster.displayName}'s heads strike in unison! MULTI-STRIKE!`);
        await delay(400);
        for (let i = 0; i < 3 && run.playerHp > 0; i++) {
          let strikeDamage = 8;
          if (run.isDefending && run.defenseAmount) {
            strikeDamage = Math.max(0, strikeDamage - Math.floor(run.defenseAmount / 3));
          }
          run.playerHp = Math.max(0, run.playerHp - strikeDamage);
          combatState.update(s => ({ ...s, lastDamageToPlayer: strikeDamage }));
          addLog('enemy', `Head ${i + 1} strikes for ${strikeDamage} damage!`);
          await delay(300);
        }
        run.isDefending = false;
        run.defenseAmount = 0;
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        currentRun.set(run);
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;

    case 'titan': // Ground Slam - Stuns and deals 20 damage
      if (!run.statusEffects.stunned && Math.random() < 0.3) {
        const slamDamage = 20;
        run.statusEffects.stunned = true;
        addLog('boss', `🗿 ${monster.displayName} slams the ground! GROUND SLAM!`);
        lastRoll.set({ rolls: [slamDamage], total: slamDamage, type: 'special', critical: false });
        await delay(400);
        let finalDamage = slamDamage;
        if (run.isDefending && run.defenseAmount) {
          finalDamage = Math.max(0, finalDamage - run.defenseAmount);
          run.isDefending = false;
          run.defenseAmount = 0;
        }
        run.playerHp = Math.max(0, run.playerHp - finalDamage);
        combatState.update(s => ({ ...s, lastDamageToPlayer: finalDamage }));
        addLog('crit', `The slam deals ${finalDamage} damage and stuns you!`);
        currentRun.set(run);
        await delay(500);
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;

    case 'phoenix': // Rebirth - Revives once with 50% HP (handled in monsterDefeated)
      return false; // No special attack, just regular attack

    case 'kraken': // Tentacle Grab - Immobilizes and deals 12 damage per turn
      if (!run.statusEffects.grabbed && Math.random() < 0.35) {
        run.statusEffects.grabbed = true;
        run.statusEffects.grabDamage = 12;
        addLog('boss', `🦑 ${monster.displayName}'s tentacles GRAB you! You're immobilized!`);
        lastRoll.set({ rolls: [], total: 0, type: 'special', critical: false });
        await delay(600);
        return true;
      }
      if (run.statusEffects.grabbed) {
        const grabDmg = run.statusEffects.grabDamage;
        run.playerHp = Math.max(0, run.playerHp - grabDmg);
        combatState.update(s => ({ ...s, lastDamageToPlayer: grabDmg }));
        addLog('enemy', `🦑 Tentacles crush you for ${grabDmg} damage!`);
        currentRun.set(run);
        await delay(500);
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        // 30% chance to break free each turn
        if (Math.random() < 0.3) {
          run.statusEffects.grabbed = false;
          addLog('info', 'You break free from the tentacles!');
        }
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;

    case 'beholder': // Death Ray - Chance to deal 40 damage
      if (Math.random() < 0.25) { // 25% chance for death ray
        const deathRayDamage = 40;
        addLog('boss', `👁️ ${monster.displayName}'s central eye glows... DEATH RAY!`);
        lastRoll.set({ rolls: [deathRayDamage], total: deathRayDamage, type: 'special', critical: true });
        await delay(400);
        let finalDamage = deathRayDamage;
        if (run.isDefending && run.defenseAmount) {
          finalDamage = Math.max(0, finalDamage - run.defenseAmount);
          run.isDefending = false;
          run.defenseAmount = 0;
        }
        run.playerHp = Math.max(0, run.playerHp - finalDamage);
        combatState.update(s => ({ ...s, lastDamageToPlayer: finalDamage }));
        addLog('crit', `DEATH RAY deals ${finalDamage} damage!`);
        currentRun.set(run);
        await delay(500);
        combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));
        if (run.playerHp <= 0) {
          combatState.update(s => ({ ...s, playerDefeated: true }));
          addLog('death', 'You have been defeated...');
          await delay(800);
          endRun(false);
        }
        return true;
      }
      return false;
  }

  return false;
}

// Basic attack logic
async function performBasicAttack(run, monster, damageMultiplier = 1.0) {
  // Monster rolls 2D6 (same as player)
  const rolls = rollD6(2);
  const total = rolls.reduce((a, b) => a + b, 0);
  const isDoubles = rolls[0] === rolls[1];

  // Calculate damage scaled by roll
  let damage = Math.floor(monster.damage * (total / 7) * damageMultiplier); // 7 is average of 2D6
  if (isDoubles) {
    damage = Math.floor(damage * 1.5); // Critical hit!
  }
  damage = Math.max(1, damage); // Minimum 1 damage

  // Apply hex effect (extra damage taken)
  if (run.statusEffects?.extraDamageTaken > 0) {
    damage += run.statusEffects.extraDamageTaken;
  }

  // Set lastRoll for enemy attack display
  lastRoll.set({ rolls, total, type: 'enemy', critical: isDoubles });

  // Apply defense if player is defending
  if (run.isDefending && run.defenseAmount) {
    damage = Math.max(0, damage - run.defenseAmount);
    if (damage === 0) {
      addLog('block', `${monster.displayName}'s attack is completely blocked!`);
    } else if (isDoubles) {
      addLog('block', `CRITICAL! You block some damage. ${monster.displayName} deals ${damage} damage!`);
    } else {
      addLog('block', `You block some damage! ${monster.displayName} deals ${damage} damage.`);
    }
    run.isDefending = false;
    run.defenseAmount = 0;
  } else {
    if (isDoubles) {
      addLog('crit', `CRITICAL HIT! ${monster.displayName} attacks for ${damage} damage!`);
    } else {
      addLog('enemy', `${monster.displayName} attacks for ${damage} damage!`);
    }
  }

  await delay(400);

  // Show damage to player
  if (damage > 0) {
    combatState.update(s => ({ ...s, lastDamageToPlayer: damage }));
  }

  run.playerHp = Math.max(0, run.playerHp - damage);
  currentRun.set(run);

  await delay(500);

  // Clear enemy action and damage number
  combatState.update(s => ({ ...s, enemyAction: null, lastDamageToPlayer: null }));

  // Check if player is dead
  if (run.playerHp <= 0) {
    combatState.update(s => ({ ...s, playerDefeated: true }));
    addLog('death', 'You have been defeated...');
    await delay(800);
    endRun(false);
  }
}

async function monsterDefeated(run, room, monster) {
  // Check for Phoenix Rebirth - revives once with 50% HP
  if (monster.isBoss && monster.key === 'phoenix' && !run.bossState?.hasRevived) {
    run.bossState.hasRevived = true;
    monster.currentHp = Math.floor(monster.maxHp * 0.5);
    addLog('boss', `🔥 The Dark Phoenix RISES FROM THE ASHES! It returns with ${monster.currentHp} HP!`);
    combatState.update(s => ({ ...s, monsterDefeated: false }));
    currentRun.set(run);
    return; // Don't complete the fight, Phoenix lives again
  }

  // Clear dice display from combat
  lastRoll.set({ rolls: [], total: 0, type: 'none', critical: false });
  currentMessage.set('');

  // Reset status effects for next encounter
  resetStatusEffects(run);

  // Calculate gold with temp bonus
  const goldBonus = run.tempBuffs?.goldBonus || 0;
  const equipGoldBonus = get(equippedStats)?.goldPerKill || 0;
  const totalGold = monster.goldReward + goldBonus + equipGoldBonus;

  if (goldBonus > 0 || equipGoldBonus > 0) {
    const bonusText = [goldBonus > 0 ? `+${goldBonus}` : '', equipGoldBonus > 0 ? `+${equipGoldBonus}` : ''].filter(Boolean).join(' ');
    addLog('victory', `${monster.displayName} defeated! +${monster.goldReward} (${bonusText}) gold`);
  } else {
    addLog('victory', `${monster.displayName} defeated! +${monster.goldReward} gold`);
  }

  // Roll for loot drop
  const player = await db.player.get(1);
  const taintedUnlocked = player?.taintedUnlocked || false;
  let dropSource = 'monster';
  if (monster.isBoss) {
    dropSource = monster.isMajorBoss ? 'majorBoss' : 'miniBoss';
  }

  const lootDrop = rollLootDrop(dropSource, run.currentFloor, taintedUnlocked);
  if (lootDrop) {
    await addToPendingLoot(lootDrop);
    const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', tainted: '🔴' };
    addLog('loot', `${rarityEmoji[lootDrop.rarity] || '📦'} Found: ${lootDrop.name} (${lootDrop.rarity})`);
    run.pendingLootCount = (run.pendingLootCount || 0) + 1;
  }

  run.goldCollected += totalGold;
  run.monstersKilled++;
  room.completed = true;

  // Regenerate some mana after each fight
  regenerateMana(run);

  // Update kills in DB
  const dungeon = await db.dungeon.get(1);
  await db.dungeon.update(1, {
    totalKills: (dungeon?.totalKills || 0) + 1
  });

  // Check if boss defeated - advance to next floor instead of ending
  if (monster.isBoss) {
    if (monster.isMajorBoss) {
      addLog('boss', `MAJOR BOSS DEFEATED! You've conquered Floor ${run.currentFloor}!`);
      run.lastBossDefeated = { type: 'major', goldEarned: totalGold, name: monster.displayName };
    } else {
      addLog('boss', `ELITE DEFEATED! Floor ${run.currentFloor} cleared!`);
      run.lastBossDefeated = { type: 'mini', goldEarned: totalGold, name: monster.displayName };
    }
    // Mark room complete and advance like normal floor completion
    run.floor.rooms[run.floor.currentRoom].completed = true;
    advanceRoom(run);
    return;
  }

  // Move to next room or floor
  advanceRoom(run);
}

// Helper to advance to the next floor
function goToNextFloor(run) {
  run.currentFloor++;
  run.floor = generateFloor(run.currentFloor);

  // Check if this is a major boss floor
  if (run.floor.isMajorBossFloor) {
    addLog('boss', `FLOOR ${run.currentFloor} - BOSS CHAMBER`);
    addLog('boss', `${run.floor.rooms[0].monster.displayName} awaits!`);
  } else if (run.floor.isMiniBossFloor) {
    addLog('floor', `Descending to Floor ${run.currentFloor}...`);
    addLog('warning', `You sense a powerful presence ahead...`);
    const firstRoom = run.floor.rooms[0];
    if (firstRoom.type === 'combat' || firstRoom.type === 'boss') {
      addLog('info', `A ${firstRoom.monster.displayName} blocks your path!`);
    }
  } else {
    addLog('floor', `Descending to Floor ${run.currentFloor}...`);
    const firstRoom = run.floor.rooms[0];
    if (firstRoom.type === 'combat') {
      addLog('info', `A ${firstRoom.monster.displayName} blocks your path!`);
    }
  }
  resetCombatState();
  gamePhase.set('exploring');
  currentRun.set(run);
}

function advanceRoom(run) {
  const floor = run.floor;

  if (floor.currentRoom < floor.rooms.length - 1) {
    // Move to next room
    floor.currentRoom++;
    const nextRoom = floor.rooms[floor.currentRoom];

    if (nextRoom.type === 'treasure') {
      addLog('treasure', `You found a treasure chest! +${nextRoom.goldBonus} gold`);
      run.goldCollected += nextRoom.goldBonus;
      nextRoom.completed = true;
      advanceRoom(run); // Auto-advance from treasure
    } else if (nextRoom.type === 'shrine') {
      addLog('heal', `You find a healing shrine! +${nextRoom.healAmount} HP`);
      run.playerHp = Math.min(run.maxHp, run.playerHp + nextRoom.healAmount);
      nextRoom.completed = true;
      advanceRoom(run); // Auto-advance from shrine
    } else if (nextRoom.type === 'merchant') {
      addLog('info', `${MERCHANT.greeting}`);
      gamePhase.set('merchant');
      // Don't auto-advance - player can browse and leave
    } else if (nextRoom.type === 'loot_chest') {
      addLog('treasure', `You found a mysterious chest! Choose your reward...`);
      gamePhase.set('loot_chest');
      // Don't auto-advance - player must choose an item
    } else {
      addLog('info', `A ${nextRoom.monster.displayName} appears!`);
      resetCombatState(); // Reset combat state for new monster
    }
  } else {
    // Floor complete - advance to next floor (no limit!)
    // Only show end-of-floor merchant if no mid-floor merchant appeared
    if (!run.floor.hasMidFloorMerchant) {
      // Customize greeting based on whether boss was just defeated
      let greeting = "Floor cleared! Care to browse before you descend?";
      if (run.lastBossDefeated) {
        const bossType = run.lastBossDefeated.type === 'major' ? 'Boss' : 'Elite';
        greeting = `${bossType} vanquished! Your gold is safe. Browse or continue?`;
      }

      // Show end-of-floor merchant
      run.floorMerchant = {
        ...MERCHANT,
        items: generateMerchantItems(),
        greeting,
        afterBoss: !!run.lastBossDefeated,
        bossGoldEarned: run.lastBossDefeated?.goldEarned || 0
      };
      addLog('info', `"${greeting}"`);
      gamePhase.set('floor_merchant');

      // Clear the boss defeated flag
      run.lastBossDefeated = null;
    } else {
      // Skip merchant, go straight to next floor
      run.lastBossDefeated = null;
      goToNextFloor(run);
    }
  }

  currentRun.set(run);
}

// ============ Potion Usage ============

// Get total potions available in current run
export function getTotalPotions(run) {
  if (!run) return 0;
  return run.potions || 0;
}

export async function usePotion() {
  const run = get(currentRun);
  if (!run) return false;

  if ((run.potions || 0) <= 0) {
    addLog('error', 'No health potions remaining!');
    return false;
  }

  // Use potion with equipment bonus
  const equipStats = get(equippedStats) || {};
  const efficiencyBonus = 1 + ((equipStats.potionEfficiency || 0) / 100);
  const healAmount = Math.floor(run.potionHeal * efficiencyBonus);
  const oldHp = run.playerHp;
  run.playerHp = Math.min(run.maxHp, run.playerHp + healAmount);
  const actualHeal = run.playerHp - oldHp;

  run.potionsUsed++;
  run.potions--;

  addLog('heal', `Used health potion! +${actualHeal} HP (${run.potions} potions remaining)`);

  currentRun.set(run);
  return true;
}

// ============ Potion Rewards ============

// Award potions during a dungeon run (all potions are temporary)
export async function awardPotions(count = 1) {
  const run = get(currentRun);
  if (!run) return; // Can only award potions during a run

  run.potions = (run.potions || 0) + count;
  currentRun.set(run);
  addLog('treasure', `Found ${count} health potion${count > 1 ? 's' : ''}!`);
}

// ============ Expedition Inventory System ============

// Use an item from expedition inventory during a dungeon run
export async function useExpeditionItem(itemId) {
  const run = get(currentRun);
  if (!run) {
    return { success: false, error: 'No active dungeon run' };
  }

  const dungeon = await db.dungeon.get(1);
  if (!dungeon) {
    return { success: false, error: 'Dungeon data not found' };
  }

  const inventory = dungeon.expeditionInventory || [];
  const itemIndex = inventory.findIndex(item => item.id === itemId);

  if (itemIndex === -1) {
    return { success: false, error: 'Item not found in inventory' };
  }

  const item = inventory[itemIndex];
  const effect = item.effect;

  // Apply item effects
  if (effect.heal) {
    const oldHp = run.playerHp;
    run.playerHp = Math.min(run.maxHp, run.playerHp + effect.heal);
    const actualHeal = run.playerHp - oldHp;
    addLog('heal', `Used ${item.name}! +${actualHeal} HP`);
  }

  if (effect.mana) {
    const oldMp = run.playerMp;
    run.playerMp = Math.min(run.maxMp, run.playerMp + effect.mana);
    const actualMana = run.playerMp - oldMp;
    addLog('spell', `Used ${item.name}! +${actualMana} MP`);
  }

  if (effect.bonusDamage) {
    run.tempBuffs.bonusDamage += effect.bonusDamage;
    addLog('info', `${item.name} grants +${effect.bonusDamage} damage for this run!`);
  }

  if (effect.defenseBonus) {
    run.tempBuffs.defenseBonus += effect.defenseBonus;
    addLog('info', `${item.name} grants +${effect.defenseBonus} defense for this run!`);
  }

  if (effect.goldBonus) {
    run.tempBuffs.goldBonus += effect.goldBonus;
    addLog('info', `${item.name} grants +${effect.goldBonus} gold per kill for this run!`);
  }

  // Remove item from inventory
  inventory.splice(itemIndex, 1);
  await db.dungeon.update(1, { expeditionInventory: inventory });

  currentRun.set(run);

  return { success: true, item };
}

// Get expedition inventory
export function getExpeditionInventory() {
  const dungeon = get(dungeonData);
  return dungeon?.expeditionInventory || [];
}

// ============ Custom Spell System ============

// Create or update custom spell at a specific slot index
export async function saveCustomSpell(spell, slotIndex = 0) {
  const { name, description, damage, manaCost } = spell;

  // Check if slot is available
  const maxSlots = getSpellSlots();
  if (slotIndex >= maxSlots) {
    return { success: false, error: 'Spell slot not unlocked' };
  }

  // Get player level for validation
  const player = await db.player.get(1);
  const level = player?.level || 1;

  // Validate the spell with level-based limits
  const validation = validateSpell(damage, manaCost, level);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Validate name
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Spell name is required' };
  }

  if (name.length > 20) {
    return { success: false, error: 'Spell name must be 20 characters or less' };
  }

  // player was already fetched above for level validation
  const customSpells = [...(player?.customSpells || [])];
  // Check if slot has an existing spell (robust check for null/undefined/object)
  const existingSpell = customSpells[slotIndex];
  const hasExistingSpell = existingSpell !== null && existingSpell !== undefined && typeof existingSpell === 'object';

  // Calculate gold cost for editing
  const editCost = getSpellEditCost(slotIndex, hasExistingSpell);

  // Check if player has enough gold
  if (editCost > 0 && (player?.gold || 0) < editCost) {
    return { success: false, error: `Not enough gold! Changing this spell costs ${editCost} gold.` };
  }

  const newSpell = {
    name: name.trim(),
    description: (description || '').trim().slice(0, 100),
    damage: Math.floor(damage),
    manaCost: Math.floor(manaCost)
  };

  // Ensure array is large enough
  while (customSpells.length <= slotIndex) {
    customSpells.push(null);
  }

  customSpells[slotIndex] = newSpell;

  // Update player with new spells and deduct gold if editing
  const updateData = { customSpells };
  if (editCost > 0) {
    updateData.gold = (player?.gold || 0) - editCost;
  }

  await db.player.update(1, updateData);

  // Sync to cloud
  pushPlayerUpdate(updateData);

  return { success: true, spell: newSpell, goldSpent: editCost };
}

// Delete custom spell at a specific slot index
export async function deleteCustomSpell(slotIndex = 0) {
  const player = await db.player.get(1);
  const customSpells = [...(player?.customSpells || [])];

  // Check if there's actually a spell to delete
  const existingSpell = customSpells[slotIndex];
  const hasSpell = existingSpell !== null && existingSpell !== undefined && typeof existingSpell === 'object';

  if (!hasSpell) {
    return { success: false, error: 'No spell to delete' };
  }

  // Calculate and check delete cost
  const deleteCost = getSpellDeleteCost(slotIndex);
  if ((player?.gold || 0) < deleteCost) {
    return { success: false, error: `Not enough gold! Deleting this spell costs ${deleteCost} gold.` };
  }

  // Delete the spell and charge gold
  customSpells[slotIndex] = null;
  const deleteUpdates = {
    customSpells,
    gold: (player?.gold || 0) - deleteCost
  };
  await db.player.update(1, deleteUpdates);

  // Sync to cloud
  pushPlayerUpdate(deleteUpdates);

  return { success: true, goldSpent: deleteCost };
}

// Cast custom spell in combat
export async function castSpell(spellIndex = 0) {
  const run = get(currentRun);
  if (!run) return false;

  const state = get(combatState);
  if (state.isAnimating) return false;

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'combat' && room.type !== 'boss') return false;

  const spell = run.customSpells?.[spellIndex];
  if (!spell) {
    addLog('error', 'No spell equipped!');
    return false;
  }

  // Check mana
  if (run.playerMp < spell.manaCost) {
    addLog('error', `Not enough mana! Need ${spell.manaCost} MP`);
    return false;
  }

  const monster = room.monster;

  // Clear "Your move!" message when player acts
  currentMessage.set('');

  // Start spell animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'spell', turn: 'animating' }));

  // Consume mana
  run.playerMp -= spell.manaCost;

  addLog('spell', `You cast ${spell.name}!`);

  // No dice roll for spells - fixed damage
  lastRoll.set({ rolls: [spell.damage], total: spell.damage, type: 'spell', critical: false });

  await delay(500);

  // Apply damage
  monster.currentHp = Math.max(0, monster.currentHp - spell.damage);
  combatState.update(s => ({ ...s, lastDamageToEnemy: spell.damage }));
  addLog('damage', `${spell.name} deals ${spell.damage} damage!`);

  currentRun.set(run);

  await delay(600);

  // Clear player action
  combatState.update(s => ({ ...s, playerAction: null, lastDamageToEnemy: null }));

  // Clear defending status
  run.isDefending = false;

  // Check if monster is dead
  if (monster.currentHp <= 0) {
    combatState.update(s => ({ ...s, monsterDefeated: true }));
    await delay(800);
    await monsterDefeated(run, room, monster);
    combatState.update(s => ({ ...s, isAnimating: false, monsterDefeated: false }));
  } else {
    // Monster counter-attacks
    combatState.update(s => ({ ...s, turn: 'enemy' }));
    currentMessage.set(`${monster.displayName} strikes back!`);
    lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
    await delay(600);
    await monsterAttack(run, monster);

    // Check if player survived before showing "Your move"
    if (run.playerHp > 0) {
      currentMessage.set('Your move!');
      lastRoll.set({ rolls: [], total: 0, type: 'transition', critical: false });
      await delay(600);
    }
    combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
  }

  currentRun.set(run);
  return true;
}

// Regenerate mana (called after combat ends)
function regenerateMana(run) {
  if (run.playerMp < run.maxMp) {
    const equipStats = get(equippedStats) || {};
    const manaRegen = MP_REGEN_PER_TURN + (equipStats.manaRegen || 0);
    run.playerMp = Math.min(run.maxMp, run.playerMp + manaRegen);
  }
}

// ============ Shop Functions ============

export async function purchaseUpgrade(upgradeKey) {
  const dungeon = await db.dungeon.get(1);
  const player = await db.player.get(1);
  if (!dungeon) return { success: false, error: 'No dungeon data' };

  const upgrade = DUNGEON_UPGRADES.find(u => u.key === upgradeKey);
  if (!upgrade) return { success: false, error: 'Invalid upgrade' };

  // Check if already purchased
  if (dungeon.upgrades?.includes(upgradeKey)) {
    return { success: false, error: 'Already purchased' };
  }

  // Check prerequisite
  if (upgrade.requires && !dungeon.upgrades?.includes(upgrade.requires)) {
    return { success: false, error: 'Prerequisite not met' };
  }

  // Check gold (from player)
  const playerGold = player?.gold || 0;
  if (playerGold < upgrade.cost) {
    return { success: false, error: 'Not enough gold' };
  }

  // Deduct gold from player
  const newGold = playerGold - upgrade.cost;
  await db.player.update(1, { gold: newGold });
  pushPlayerUpdate({ gold: newGold });

  // Purchase upgrade (stored in dungeon)
  const newUpgrades = [...(dungeon.upgrades || []), upgradeKey];
  const dungeonUpdates = {
    upgrades: newUpgrades
  };

  // Apply effect
  if (upgrade.effect.maxHp) {
    dungeonUpdates.maxHpBonus = (dungeon.maxHpBonus || 0) + upgrade.effect.maxHp;
  }
  if (upgrade.effect.bonusDamage) {
    dungeonUpdates.bonusDamage = (dungeon.bonusDamage || 0) + upgrade.effect.bonusDamage;
  }
  if (upgrade.effect.potionBonus) {
    dungeonUpdates.potionBonus = (dungeon.potionBonus || 0) + upgrade.effect.potionBonus;
  }
  if (upgrade.effect.critBonus) {
    dungeonUpdates.critBonus = (dungeon.critBonus || 0) + upgrade.effect.critBonus;
  }
  if (upgrade.effect.defenseBonus) {
    dungeonUpdates.defenseBonus = (dungeon.defenseBonus || 0) + upgrade.effect.defenseBonus;
  }
  if (upgrade.effect.spellSlot) {
    // Store spell slot in player (syncs with cloud)
    await db.player.update(1, { purchasedSpellSlot: true });
    pushPlayerUpdate({ purchasedSpellSlot: true });
  }

  await db.dungeon.update(1, dungeonUpdates);

  return { success: true, upgrade };
}

// ============ Merchant Functions ============

export async function purchaseMerchantItem(itemKey) {
  const run = get(currentRun);
  if (!run) return { success: false, error: 'No active run' };

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'merchant') {
    return { success: false, error: 'Not at merchant' };
  }

  // Find the item in the merchant's inventory
  const itemIndex = room.merchant.items.findIndex(i => i.key === itemKey);
  if (itemIndex === -1) {
    return { success: false, error: 'Item not available' };
  }

  const item = room.merchant.items[itemIndex];

  // Can spend both run gold and bank gold
  const runGold = run.goldCollected || 0;
  const bankGold = run.bankGold || 0;
  const totalGold = runGold + bankGold;

  if (totalGold < item.cost) {
    return { success: false, error: `Not enough gold! Need ${item.cost}, have ${totalGold}` };
  }

  // Deduct from run gold first, then bank gold if needed
  let remaining = item.cost;
  if (runGold >= remaining) {
    run.goldCollected = runGold - remaining;
  } else {
    // Use all run gold, then dip into bank
    run.goldCollected = 0;
    remaining -= runGold;
    run.bankGold = bankGold - remaining;
  }

  // Apply effect
  const effect = item.effect;

  if (effect.heal) {
    const oldHp = run.playerHp;
    run.playerHp = Math.min(run.maxHp, run.playerHp + effect.heal);
    const actualHeal = run.playerHp - oldHp;
    addLog('heal', `${item.name} restored ${actualHeal} HP!`);
  }

  if (effect.mana) {
    const oldMp = run.playerMp;
    run.playerMp = Math.min(run.maxMp, run.playerMp + effect.mana);
    const actualMana = run.playerMp - oldMp;
    addLog('spell', `${item.name} restored ${actualMana} MP!`);
  }

  if (effect.bonusDamage) {
    run.tempBuffs.bonusDamage += effect.bonusDamage;
    addLog('info', `${item.name} grants +${effect.bonusDamage} damage for this run!`);
  }

  if (effect.defenseBonus) {
    run.tempBuffs.defenseBonus += effect.defenseBonus;
    addLog('info', `${item.name} grants +${effect.defenseBonus} defense for this run!`);
  }

  if (effect.goldBonus) {
    run.tempBuffs.goldBonus += effect.goldBonus;
    addLog('info', `${item.name} grants +${effect.goldBonus} gold per kill!`);
  }

  if (effect.addPotion) {
    run.potions = (run.potions || 0) + effect.addPotion;
    const totalPotions = getTotalPotions(run);
    addLog('treasure', `Added ${effect.addPotion} potion${effect.addPotion > 1 ? 's' : ''} to inventory! (${totalPotions} total)`);
  }

  // Remove item from merchant inventory (one-time purchase)
  room.merchant.items.splice(itemIndex, 1);

  currentRun.set(run);

  return { success: true, item };
}

export function leaveMerchant() {
  const run = get(currentRun);
  if (!run) return;

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'merchant') return;

  room.completed = true;
  addLog('info', `"Safe travels, adventurer!" says the Goblin Merchant.`);

  gamePhase.set('exploring');
  advanceRoom(run);
}

// Leave the end-of-floor merchant and advance to next floor
export function leaveFloorMerchant() {
  const run = get(currentRun);
  if (!run) return;

  // Clear the floor merchant
  run.floorMerchant = null;

  // Advance to next floor using helper
  goToNextFloor(run);
}

// Purchase from the floor merchant (end of floor)
export async function purchaseFloorMerchantItem(itemKey) {
  const run = get(currentRun);
  if (!run || !run.floorMerchant) return { success: false, error: 'No active merchant' };

  // Find the item in the merchant's inventory
  const itemIndex = run.floorMerchant.items.findIndex(i => i.key === itemKey);
  if (itemIndex === -1) {
    return { success: false, error: 'Item not available' };
  }

  const item = run.floorMerchant.items[itemIndex];

  // Can spend both run gold and bank gold
  const runGold = run.goldCollected || 0;
  const bankGold = run.bankGold || 0;
  const totalGold = runGold + bankGold;

  if (totalGold < item.cost) {
    return { success: false, error: `Not enough gold! Need ${item.cost}, have ${totalGold}` };
  }

  // Deduct from run gold first, then bank gold if needed
  let remaining = item.cost;
  if (runGold >= remaining) {
    run.goldCollected = runGold - remaining;
  } else {
    // Use all run gold, then dip into bank
    run.goldCollected = 0;
    remaining -= runGold;
    run.bankGold = bankGold - remaining;
  }

  // Apply effect
  const effect = item.effect;

  if (effect.heal) {
    const oldHp = run.playerHp;
    run.playerHp = Math.min(run.maxHp, run.playerHp + effect.heal);
    const actualHeal = run.playerHp - oldHp;
    addLog('heal', `${item.name} restored ${actualHeal} HP!`);
  }

  if (effect.mana) {
    const oldMp = run.playerMp;
    run.playerMp = Math.min(run.maxMp, run.playerMp + effect.mana);
    const actualMana = run.playerMp - oldMp;
    addLog('spell', `${item.name} restored ${actualMana} MP!`);
  }

  if (effect.bonusDamage) {
    run.tempBuffs.bonusDamage += effect.bonusDamage;
    addLog('info', `${item.name} grants +${effect.bonusDamage} damage for this run!`);
  }

  if (effect.defenseBonus) {
    run.tempBuffs.defenseBonus += effect.defenseBonus;
    addLog('info', `${item.name} grants +${effect.defenseBonus} defense for this run!`);
  }

  if (effect.goldBonus) {
    run.tempBuffs.goldBonus += effect.goldBonus;
    addLog('info', `${item.name} grants +${effect.goldBonus} gold per kill!`);
  }

  if (effect.addPotion) {
    run.potions = (run.potions || 0) + effect.addPotion;
    const totalPotions = getTotalPotions(run);
    addLog('treasure', `Added ${effect.addPotion} potion${effect.addPotion > 1 ? 's' : ''} to inventory! (${totalPotions} total)`);
  }

  // Remove item from merchant inventory (one-time purchase)
  run.floorMerchant.items.splice(itemIndex, 1);

  currentRun.set(run);

  return { success: true, item };
}

// ============ Loot Chest Functions ============

// Open the chest - might be a mimic!
export function openLootChest() {
  const run = get(currentRun);
  if (!run) return { success: false, error: 'No active run' };

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'loot_chest') {
    return { success: false, error: 'Not at loot chest' };
  }

  room.opened = true;

  // Check if it's a mimic!
  if (room.isMimic) {
    if (room.isBossMimic) {
      addLog('danger', `IT'S A MIMIC! A powerful ${room.mimicMonster.displayName} attacks!`);
    } else {
      addLog('danger', `IT'S A MIMIC! A ${room.mimicMonster.displayName} attacks!`);
    }
    // Convert room to combat with the mimic
    room.type = 'combat';
    room.monster = room.mimicMonster;
    gamePhase.set('exploring');
    resetCombatState();
    currentRun.set(run);
    return { success: true, isMimic: true, monster: room.mimicMonster };
  }

  // Safe chest - show items
  addLog('treasure', `The chest opens safely! Choose your reward...`);
  gamePhase.set('loot_chest_open');
  currentRun.set(run);
  return { success: true, isMimic: false };
}

// Choose an item from an opened chest
export function chooseLootChestItem(itemKey) {
  const run = get(currentRun);
  if (!run) return { success: false, error: 'No active run' };

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'loot_chest' || !room.opened) {
    return { success: false, error: 'Chest not open' };
  }

  // Find the item
  const item = room.items.find(i => i.key === itemKey);
  if (!item) {
    return { success: false, error: 'Item not available' };
  }

  // Apply effect (free - no gold cost!)
  const effect = item.effect;

  if (effect.heal) {
    const oldHp = run.playerHp;
    run.playerHp = Math.min(run.maxHp, run.playerHp + effect.heal);
    const actualHeal = run.playerHp - oldHp;
    addLog('heal', `${item.name} restored ${actualHeal} HP!`);
  }

  if (effect.mana) {
    const oldMp = run.playerMp;
    run.playerMp = Math.min(run.maxMp, run.playerMp + effect.mana);
    const actualMana = run.playerMp - oldMp;
    addLog('spell', `${item.name} restored ${actualMana} MP!`);
  }

  if (effect.bonusDamage) {
    run.tempBuffs.bonusDamage += effect.bonusDamage;
    addLog('info', `${item.name} grants +${effect.bonusDamage} damage for this run!`);
  }

  if (effect.defenseBonus) {
    run.tempBuffs.defenseBonus += effect.defenseBonus;
    addLog('info', `${item.name} grants +${effect.defenseBonus} defense for this run!`);
  }

  if (effect.goldBonus) {
    run.tempBuffs.goldBonus += effect.goldBonus;
    addLog('info', `${item.name} grants +${effect.goldBonus} gold per kill!`);
  }

  if (effect.addPotion) {
    run.potions = (run.potions || 0) + effect.addPotion;
    const totalPotions = getTotalPotions(run);
    addLog('treasure', `Found ${effect.addPotion} potion${effect.addPotion > 1 ? 's' : ''}! (${totalPotions} total)`);
  }

  // Mark room as completed and advance
  room.completed = true;
  gamePhase.set('exploring');
  advanceRoom(run);

  return { success: true, item };
}

// Skip the chest without opening
export function skipLootChest() {
  const run = get(currentRun);
  if (!run) return;

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'loot_chest') return;

  room.completed = true;
  addLog('info', `You carefully walk past the chest...`);
  gamePhase.set('exploring');
  advanceRoom(run);
}

// ============ Derived Stores ============

export const playerStats = derived(
  [dungeonData, currentRun, playerData],
  ([$dungeon, $run, $player]) => {
    if ($run) {
      return {
        hp: $run.playerHp,
        maxHp: $run.maxHp,
        gold: $run.goldCollected,
        floor: $run.currentFloor,
        potions: $player?.healthPotions || 0
      };
    }
    return {
      hp: 100 + ($dungeon?.maxHpBonus || 0),
      maxHp: 100 + ($dungeon?.maxHpBonus || 0),
      gold: $player?.gold || 0,
      floor: 0,
      potions: $player?.healthPotions || 0
    };
  }
);

export const currentMonster = derived(currentRun, ($run) => {
  if (!$run) return null;
  const room = $run.floor?.rooms[$run.floor.currentRoom];
  if (room?.type === 'combat' || room?.type === 'boss') {
    return room.monster;
  }
  return null;
});
