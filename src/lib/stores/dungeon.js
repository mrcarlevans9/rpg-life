import { writable, derived, get } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES, MERCHANT, MERCHANT_ITEMS } from '../db/index.js';
import { playerData } from './player.js';

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

// Validate spell - returns { valid, error, suggestedManaCost }
export function validateSpell(damage, manaCost) {
  const requiredCost = calculateManaCost(damage);

  if (damage < 1) {
    return { valid: false, error: 'Damage must be at least 1', suggestedManaCost: 1 };
  }

  if (damage > 100) {
    return { valid: false, error: 'Maximum damage is 100', suggestedManaCost: calculateManaCost(100) };
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
  const dungeon = get(dungeonData);
  const level = player?.level || 1;
  const purchased = dungeon?.purchasedSpellSlot || false;
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

function generateBoss() {
  const baseBoss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  const [minGold, maxGold] = baseBoss.goldDrop;
  const goldReward = minGold + Math.floor(Math.random() * (maxGold - minGold));

  return {
    ...baseBoss,
    displayName: baseBoss.name,
    maxHp: baseBoss.baseHp,
    currentHp: baseBoss.baseHp,
    damage: baseBoss.baseDamage,
    goldReward,
    isBoss: true
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
  const isBossFloor = floorNumber === 10;

  if (isBossFloor) {
    return {
      floorNumber,
      rooms: [{ type: 'boss', monster: generateBoss(), completed: false }],
      currentRoom: 0,
      isBossFloor: true
    };
  }

  // Regular floors have 4-10 rooms
  const roomCount = 4 + Math.floor(Math.random() * 7); // 4 to 10
  const rooms = [];

  // Check if merchant appears on this floor (12% chance, max 1 per floor)
  // Merchant can only appear in rooms 3 through (roomCount - 1) - not first 2, not last
  const merchantSpawns = Math.random() < MERCHANT.spawnChance;
  let merchantRoomIndex = -1;

  if (merchantSpawns && roomCount >= 4) {
    // Valid merchant positions: index 2 to (roomCount - 2)
    // That's rooms 3 through second-to-last
    const minIndex = 2;
    const maxIndex = roomCount - 2;
    if (maxIndex >= minIndex) {
      merchantRoomIndex = minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
    }
  }

  for (let i = 0; i < roomCount; i++) {
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

    // Special room chances (not first room):
    // 12% treasure, 10% shrine, 8% loot chest
    const roll = Math.random();
    if (roll < 0.12 && i > 0) {
      // Treasure room (bonus gold)
      rooms.push({
        type: 'treasure',
        goldBonus: 5 + Math.floor(Math.random() * 10) + floorNumber * 2,
        completed: false
      });
    } else if (roll < 0.22 && i > 0) {
      // Rest shrine (heal some HP)
      rooms.push({
        type: 'shrine',
        healAmount: 10 + Math.floor(Math.random() * 10),
        completed: false
      });
    } else if (roll < 0.30 && i > 0) {
      // Loot chest (choose 1 of 3 items)
      rooms.push({
        type: 'loot_chest',
        items: generateLootChestItems(),
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
    isBossFloor: false,
    hasMidFloorMerchant: merchantRoomIndex !== -1 // Track if merchant appeared mid-floor
  };
}

// ============ Run Management ============

export async function startRun() {
  const dungeon = await db.dungeon.get(1);

  // Calculate max HP with upgrades
  const baseMaxHp = 100;
  const maxHp = baseMaxHp + (dungeon?.maxHpBonus || 0);

  // Calculate max MP with upgrades
  const maxMp = BASE_MAX_MP + (dungeon?.maxMpBonus || 0);

  const run = {
    currentFloor: 1,
    floor: generateFloor(1),
    playerHp: maxHp,
    maxHp,
    playerMp: maxMp,
    maxMp,
    goldCollected: 0,
    potionsUsed: 0,
    monstersKilled: 0,
    isDefending: false,
    // Store upgrade bonuses for this run
    bonusDamage: dungeon?.bonusDamage || 0,
    potionHeal: 25 + (dungeon?.potionBonus || 0),
    critBonus: dungeon?.critBonus || 0,
    defenseBonus: dungeon?.defenseBonus || 0,
    // Store custom spells for this run (array)
    customSpells: dungeon?.customSpells || [],
    // Temporary buffs from merchant (this run only)
    tempBuffs: {
      bonusDamage: 0,
      defenseBonus: 0,
      goldBonus: 0
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
  await db.dungeon.update(1, {
    totalRuns: (dungeon?.totalRuns || 0) + 1
  });

  return run;
}

export function endRun(victory = false) {
  const run = get(currentRun);
  if (!run) return;

  if (victory) {
    gamePhase.set('victory');
  } else {
    gamePhase.set('defeat');
  }
}

export async function collectRewards() {
  const run = get(currentRun);
  if (!run) return;

  const dungeon = await db.dungeon.get(1);

  // Add gold to persistent storage
  await db.dungeon.update(1, {
    gold: (dungeon?.gold || 0) + run.goldCollected,
    totalGoldEarned: (dungeon?.totalGoldEarned || 0) + run.goldCollected,
    highestFloor: Math.max(dungeon?.highestFloor || 0, run.currentFloor),
    totalKills: (dungeon?.totalKills || 0) + run.monstersKilled,
    bossesDefeated: run.currentFloor === 10 && get(gamePhase) === 'victory'
      ? (dungeon?.bossesDefeated || 0) + 1
      : dungeon?.bossesDefeated || 0
  });

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

export async function playerAttack() {
  const run = get(currentRun);
  if (!run) return;

  const state = get(combatState);
  if (state.isAnimating) return; // Prevent actions during animations

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'combat' && room.type !== 'boss') return;

  const monster = room.monster;

  // Clear "Your move!" message when player acts
  currentMessage.set('');

  // Start player attack animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'attack', turn: 'animating' }));

  // Roll 2D6 for damage
  const rolls = rollD6(2);
  const total = rolls.reduce((a, b) => a + b, 0);
  const isDoubles = rolls[0] === rolls[1];

  // Calculate damage with bonuses (permanent + temporary)
  let damage = total + run.bonusDamage + (run.tempBuffs?.bonusDamage || 0);

  // Critical hit on doubles
  if (isDoubles) {
    damage *= 2;
    addLog('crit', `CRITICAL HIT! Rolled ${rolls[0]}+${rolls[1]} (doubles)!`);
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

  // Clear "Your move!" message when player acts
  currentMessage.set('');

  // Start defend animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'defend', turn: 'animating' }));

  // Roll 1D6 for defense (permanent + temporary bonus)
  const rolls = rollD6(1);
  const defenseAmount = rolls[0] + run.defenseBonus + (run.tempBuffs?.defenseBonus || 0);

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

  // Monster rolls 2D6 (same as player)
  const rolls = rollD6(2);
  const total = rolls.reduce((a, b) => a + b, 0);
  const isDoubles = rolls[0] === rolls[1];

  // Calculate damage scaled by roll
  let damage = Math.floor(monster.damage * (total / 7)); // 7 is average of 2D6
  if (isDoubles) {
    damage = Math.floor(damage * 1.5); // Critical hit!
  }
  damage = Math.max(1, damage); // Minimum 1 damage

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
  // Clear dice display from combat
  lastRoll.set({ rolls: [], total: 0, type: 'none', critical: false });
  currentMessage.set('');

  // Calculate gold with temp bonus
  const goldBonus = run.tempBuffs?.goldBonus || 0;
  const totalGold = monster.goldReward + goldBonus;

  if (goldBonus > 0) {
    addLog('victory', `${monster.displayName} defeated! +${monster.goldReward} (+${goldBonus}) gold`);
  } else {
    addLog('victory', `${monster.displayName} defeated! +${monster.goldReward} gold`);
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

  // Check if boss defeated
  if (monster.isBoss) {
    addLog('boss', `BOSS DEFEATED! You've conquered the dungeon!`);
    endRun(true);
    return;
  }

  // Move to next room or floor
  advanceRoom(run);
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
    // Floor complete - advance to next floor
    if (run.currentFloor < 10) {
      // Only show end-of-floor merchant if no mid-floor merchant appeared
      if (!run.floor.hasMidFloorMerchant) {
        // Show end-of-floor merchant
        run.floorMerchant = {
          ...MERCHANT,
          items: generateMerchantItems(),
          greeting: "Floor cleared! Care to browse before you descend?"
        };
        addLog('info', `"Floor cleared! Care to browse before you descend?"`);
        gamePhase.set('floor_merchant');
      } else {
        // Skip merchant, go straight to next floor
        run.currentFloor++;
        run.floor = generateFloor(run.currentFloor);

        if (run.currentFloor === 10) {
          addLog('boss', `FLOOR 10 - BOSS CHAMBER`);
          addLog('boss', `${run.floor.rooms[0].monster.displayName} awaits!`);
        } else {
          addLog('floor', `Descending to Floor ${run.currentFloor}...`);
          const firstRoom = run.floor.rooms[0];
          if (firstRoom.type === 'combat') {
            addLog('info', `A ${firstRoom.monster.displayName} blocks your path!`);
          }
        }
        resetCombatState();
      }
    }
  }

  currentRun.set(run);
}

// ============ Potion Usage ============

export async function usePotion() {
  const run = get(currentRun);
  if (!run) return false;

  const dungeon = await db.dungeon.get(1);
  if (!dungeon || dungeon.healthPotions <= 0) {
    addLog('error', 'No health potions remaining!');
    return false;
  }

  // Use potion
  const healAmount = run.potionHeal;
  const oldHp = run.playerHp;
  run.playerHp = Math.min(run.maxHp, run.playerHp + healAmount);
  const actualHeal = run.playerHp - oldHp;

  run.potionsUsed++;

  // Update DB
  await db.dungeon.update(1, {
    healthPotions: dungeon.healthPotions - 1
  });

  addLog('heal', `Used health potion! +${actualHeal} HP (${dungeon.healthPotions - 1} potions remaining)`);

  currentRun.set(run);
  return true;
}

// ============ Potion Rewards ============

export async function awardPotions(count = 1) {
  const dungeon = await db.dungeon.get(1);
  if (!dungeon) return;

  await db.dungeon.update(1, {
    healthPotions: (dungeon.healthPotions || 0) + count
  });
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

  // Validate the spell
  const validation = validateSpell(damage, manaCost);
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

  const newSpell = {
    name: name.trim(),
    description: (description || '').trim().slice(0, 100),
    damage: Math.floor(damage),
    manaCost: Math.floor(manaCost)
  };

  const dungeon = await db.dungeon.get(1);
  const customSpells = [...(dungeon?.customSpells || [])];

  // Ensure array is large enough
  while (customSpells.length <= slotIndex) {
    customSpells.push(null);
  }

  customSpells[slotIndex] = newSpell;

  await db.dungeon.update(1, { customSpells });

  return { success: true, spell: newSpell };
}

// Delete custom spell at a specific slot index
export async function deleteCustomSpell(slotIndex = 0) {
  const dungeon = await db.dungeon.get(1);
  const customSpells = [...(dungeon?.customSpells || [])];

  if (slotIndex < customSpells.length) {
    customSpells[slotIndex] = null;
    await db.dungeon.update(1, { customSpells });
  }

  return { success: true };
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
    run.playerMp = Math.min(run.maxMp, run.playerMp + MP_REGEN_PER_TURN);
  }
}

// ============ Shop Functions ============

export async function purchaseUpgrade(upgradeKey) {
  const dungeon = await db.dungeon.get(1);
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

  // Check gold
  if (dungeon.gold < upgrade.cost) {
    return { success: false, error: 'Not enough gold' };
  }

  // Purchase
  const newUpgrades = [...(dungeon.upgrades || []), upgradeKey];
  const updates = {
    gold: dungeon.gold - upgrade.cost,
    upgrades: newUpgrades
  };

  // Apply effect
  if (upgrade.effect.maxHp) {
    updates.maxHpBonus = (dungeon.maxHpBonus || 0) + upgrade.effect.maxHp;
  }
  if (upgrade.effect.bonusDamage) {
    updates.bonusDamage = (dungeon.bonusDamage || 0) + upgrade.effect.bonusDamage;
  }
  if (upgrade.effect.potionBonus) {
    updates.potionBonus = (dungeon.potionBonus || 0) + upgrade.effect.potionBonus;
  }
  if (upgrade.effect.critBonus) {
    updates.critBonus = (dungeon.critBonus || 0) + upgrade.effect.critBonus;
  }
  if (upgrade.effect.defenseBonus) {
    updates.defenseBonus = (dungeon.defenseBonus || 0) + upgrade.effect.defenseBonus;
  }
  if (upgrade.effect.spellSlot) {
    updates.purchasedSpellSlot = true;
  }

  await db.dungeon.update(1, updates);

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

  // Check gold
  if (run.goldCollected < item.cost) {
    return { success: false, error: 'Not enough gold' };
  }

  // Deduct gold
  run.goldCollected -= item.cost;

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

  // Advance to next floor
  run.currentFloor++;
  run.floor = generateFloor(run.currentFloor);

  if (run.currentFloor === 10) {
    addLog('boss', `FLOOR 10 - BOSS CHAMBER`);
    addLog('boss', `${run.floor.rooms[0].monster.displayName} awaits!`);
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

  // Check gold
  if (run.goldCollected < item.cost) {
    return { success: false, error: 'Not enough gold' };
  }

  // Deduct gold
  run.goldCollected -= item.cost;

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

  // Remove item from merchant inventory (one-time purchase)
  run.floorMerchant.items.splice(itemIndex, 1);

  currentRun.set(run);

  return { success: true, item };
}

// ============ Loot Chest Functions ============

export function chooseLootChestItem(itemKey) {
  const run = get(currentRun);
  if (!run) return { success: false, error: 'No active run' };

  const room = run.floor.rooms[run.floor.currentRoom];
  if (room.type !== 'loot_chest') {
    return { success: false, error: 'Not at loot chest' };
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

  // Mark room as completed and advance
  room.completed = true;
  gamePhase.set('exploring');
  advanceRoom(run);

  return { success: true, item };
}

// ============ Derived Stores ============

export const playerStats = derived(
  [dungeonData, currentRun],
  ([$dungeon, $run]) => {
    if ($run) {
      return {
        hp: $run.playerHp,
        maxHp: $run.maxHp,
        gold: $run.goldCollected,
        floor: $run.currentFloor,
        potions: $dungeon?.healthPotions || 0
      };
    }
    return {
      hp: 100 + ($dungeon?.maxHpBonus || 0),
      maxHp: 100 + ($dungeon?.maxHpBonus || 0),
      gold: $dungeon?.gold || 0,
      floor: 0,
      potions: $dungeon?.healthPotions || 0
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
