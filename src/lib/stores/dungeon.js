import { writable, derived, get } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, MONSTERS, BOSSES, MONSTER_MODIFIERS, DUNGEON_UPGRADES } from '../db/index.js';

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
  playerAction: null, // 'attack' | 'defend' | 'potion' | null
  enemyAction: null, // 'attack' | null
  lastDamageToEnemy: null,
  lastDamageToPlayer: null,
  monsterDefeated: false,
  playerDefeated: false
});

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

  // Scale stats with floor
  const floorMultiplier = 1 + (floor - 1) * 0.1;

  // Random chance for modifier (20%)
  let modifier = null;
  if (Math.random() < 0.2) {
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

  // Regular floors have 2-4 rooms
  const roomCount = 2 + Math.floor(Math.random() * 3);
  const rooms = [];

  for (let i = 0; i < roomCount; i++) {
    // 15% chance for treasure room, 10% chance for rest shrine
    const roll = Math.random();
    if (roll < 0.15 && i > 0) {
      // Treasure room (bonus gold)
      rooms.push({
        type: 'treasure',
        goldBonus: 5 + Math.floor(Math.random() * 10) + floorNumber * 2,
        completed: false
      });
    } else if (roll < 0.25 && i > 0) {
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
    isBossFloor: false
  };
}

// ============ Run Management ============

export async function startRun() {
  const dungeon = await db.dungeon.get(1);

  // Calculate max HP with upgrades
  const baseMaxHp = 100;
  const maxHp = baseMaxHp + (dungeon?.maxHpBonus || 0);

  const run = {
    currentFloor: 1,
    floor: generateFloor(1),
    playerHp: maxHp,
    maxHp,
    goldCollected: 0,
    potionsUsed: 0,
    monstersKilled: 0,
    isDefending: false,
    // Store upgrade bonuses for this run
    bonusDamage: dungeon?.bonusDamage || 0,
    potionHeal: 25 + (dungeon?.potionBonus || 0),
    critBonus: dungeon?.critBonus || 0,
    defenseBonus: dungeon?.defenseBonus || 0
  };

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

  // Reset run
  currentRun.set(null);
  gamePhase.set('idle');
  combatLog.set([]);
}

export async function retreat() {
  const run = get(currentRun);
  if (!run) return;

  // Can only retreat between floors (after completing current floor)
  gamePhase.set('retreat');
  addLog('info', `You retreat with ${run.goldCollected} gold!`);

  // Collect rewards on retreat
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

  // Start player attack animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'attack', turn: 'animating' }));

  // Roll 2D6 for damage
  const rolls = rollD6(2);
  const total = rolls.reduce((a, b) => a + b, 0);
  const isDoubles = rolls[0] === rolls[1];

  // Calculate damage with bonuses
  let damage = total + run.bonusDamage;

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
    await delay(400);
    await monsterAttack(run, monster);
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

  // Start defend animation
  combatState.update(s => ({ ...s, isAnimating: true, playerAction: 'defend', turn: 'animating' }));

  // Roll 1D6 for defense
  const rolls = rollD6(1);
  const defenseAmount = rolls[0] + run.defenseBonus;

  addLog('defend', `You brace yourself! Blocking ${defenseAmount} damage.`);

  run.isDefending = true;
  run.defenseAmount = defenseAmount;

  lastRoll.set({ rolls, total: defenseAmount, type: 'defend' });

  await delay(500);

  // Monster attacks
  combatState.update(s => ({ ...s, playerAction: null, turn: 'enemy' }));
  await delay(300);
  await monsterAttack(run, monster);

  combatState.update(s => ({ ...s, isAnimating: false, turn: 'player' }));
  currentRun.set(run);
}

async function monsterAttack(run, monster) {
  // Start enemy attack animation
  combatState.update(s => ({ ...s, enemyAction: 'attack' }));

  // Monster rolls 1D6 + base damage
  const roll = rollD6(1)[0];
  let damage = Math.floor(monster.damage * (roll / 3.5)); // Scale with roll
  damage = Math.max(1, damage); // Minimum 1 damage

  // Apply defense if player is defending
  if (run.isDefending && run.defenseAmount) {
    damage = Math.max(0, damage - run.defenseAmount);
    if (damage === 0) {
      addLog('block', `${monster.displayName}'s attack is completely blocked!`);
    } else {
      addLog('block', `You block some damage! ${monster.displayName} deals ${damage} damage.`);
    }
    run.isDefending = false;
    run.defenseAmount = 0;
  } else {
    addLog('enemy', `${monster.displayName} attacks for ${damage} damage!`);
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
  addLog('victory', `${monster.displayName} defeated! +${monster.goldReward} gold`);

  run.goldCollected += monster.goldReward;
  run.monstersKilled++;
  room.completed = true;

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
    } else {
      addLog('info', `A ${nextRoom.monster.displayName} appears!`);
      resetCombatState(); // Reset combat state for new monster
    }
  } else {
    // Floor complete - advance to next floor
    if (run.currentFloor < 10) {
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
      resetCombatState(); // Reset combat state for new floor
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

  await db.dungeon.update(1, updates);

  return { success: true, upgrade };
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
