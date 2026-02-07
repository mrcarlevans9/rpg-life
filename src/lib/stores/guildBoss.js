import { writable, get } from 'svelte/store';
import { supabase } from '../supabase/client.js';
import { playerData, statBonuses } from './player.js';
import { db } from '../db/index.js';
import { pushPlayerUpdate } from '../supabase/sync.js';

// ============ Guild Boss Battle State ============

// Current boss fight data (from Supabase)
export const activeBossFight = writable(null);

// Battle phase: 'idle' | 'shop' | 'combat' | 'victory' | 'defeat'
export const battlePhase = writable('idle');

// Player's current combat state for this fight
export const playerCombat = writable({
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  isDefending: false,
  potions: 0,
  tempBuffs: {
    bonusDamage: 0,
    defenseBonus: 0
  }
});

// Combat UI state
export const combatState = writable({
  turn: 'player',
  isAnimating: false,
  playerAction: null,
  enemyAction: null,
  lastDamageToEnemy: null,
  lastDamageToPlayer: null,
  playerDefeated: false
});

// Current message for Pokemon-style display
export const currentMessage = writable('');

// Dice roll for animation
export const lastRoll = writable(null);

// Real-time subscription
let bossSubscription = null;

// ============ Guild Boss Shop Items ============
// More expensive but better items than dungeon shop

export const GUILD_BOSS_SHOP_ITEMS = [
  {
    id: 'mega_potion',
    name: 'Mega Health Potion',
    description: 'Restores 75 HP during battle',
    price: 80,
    effect: { type: 'potion', value: 75 }
  },
  {
    id: 'power_elixir',
    name: 'Power Elixir',
    description: '+15 bonus damage for this fight',
    price: 120,
    effect: { type: 'buff', stat: 'bonusDamage', value: 15 }
  },
  {
    id: 'iron_shield',
    name: 'Iron Shield Scroll',
    description: '+20 defense for this fight',
    price: 100,
    effect: { type: 'buff', stat: 'defenseBonus', value: 20 }
  },
  {
    id: 'mana_crystal',
    name: 'Mana Crystal',
    description: 'Restores 30 MP instantly',
    price: 60,
    effect: { type: 'mana', value: 30 }
  },
  {
    id: 'giants_strength',
    name: "Giant's Strength",
    description: '+25 bonus damage for this fight',
    price: 200,
    effect: { type: 'buff', stat: 'bonusDamage', value: 25 }
  },
  {
    id: 'full_restore',
    name: 'Full Restore',
    description: 'Fully restore HP and MP',
    price: 250,
    effect: { type: 'fullRestore' }
  }
];

// ============ Helper Functions ============

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rollDice(count = 2, sides = 6) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

// ============ Real-time Subscription ============

export function subscribeToBossFight(bossFightId) {
  // Unsubscribe from previous if exists
  if (bossSubscription) {
    bossSubscription.unsubscribe();
  }

  // Subscribe to real-time changes
  bossSubscription = supabase
    .channel(`boss_fight_${bossFightId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'guild_boss_fights',
      filter: `id=eq.${bossFightId}`
    }, (payload) => {
      console.log('Boss fight updated:', payload.new);
      activeBossFight.set(payload.new);

      // Check if boss was defeated
      if (payload.new.status === 'defeated') {
        battlePhase.set('victory');
        currentMessage.set('The guild boss has been defeated! Victory!');
      }
    })
    .subscribe();

  return bossSubscription;
}

export function unsubscribeFromBossFight() {
  if (bossSubscription) {
    bossSubscription.unsubscribe();
    bossSubscription = null;
  }
}

// ============ Shop Actions ============

export async function purchaseShopItem(item) {
  const player = get(playerData);
  const combat = get(playerCombat);

  if ((player?.gold || 0) < item.price) {
    return { success: false, error: 'Not enough gold' };
  }

  // Deduct gold
  const newGold = player.gold - item.price;
  await db.player.update(1, { gold: newGold });
  pushPlayerUpdate({ gold: newGold });

  // Apply effect
  if (item.effect.type === 'potion') {
    playerCombat.update(c => ({
      ...c,
      potions: c.potions + 1,
      potionHeal: item.effect.value
    }));
  } else if (item.effect.type === 'buff') {
    playerCombat.update(c => ({
      ...c,
      tempBuffs: {
        ...c.tempBuffs,
        [item.effect.stat]: c.tempBuffs[item.effect.stat] + item.effect.value
      }
    }));
  } else if (item.effect.type === 'mana') {
    playerCombat.update(c => ({
      ...c,
      mp: Math.min(c.maxMp, c.mp + item.effect.value)
    }));
  } else if (item.effect.type === 'fullRestore') {
    playerCombat.update(c => ({
      ...c,
      hp: c.maxHp,
      mp: c.maxMp
    }));
  }

  return { success: true };
}

export function leaveShop() {
  battlePhase.set('combat');
  currentMessage.set('You face the guild boss!');
}

// ============ Battle Initialization ============

export async function startBossBattle(bossFight) {
  const player = await db.player.get(1);
  const dungeon = await db.dungeon.get(1);

  // Calculate player stats with upgrades
  const baseMaxHp = 100;
  const maxHp = baseMaxHp + (dungeon?.maxHpBonus || 0);
  const maxMp = 50 + (dungeon?.maxMpBonus || 0);

  // Initialize player combat state
  playerCombat.set({
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    isDefending: false,
    potions: 0,
    potionHeal: 75, // Default for guild boss potions
    bonusDamage: dungeon?.bonusDamage || 0,
    critBonus: dungeon?.critBonus || 0,
    defenseBonus: dungeon?.defenseBonus || 0,
    customSpells: player?.customSpells || [],
    tempBuffs: {
      bonusDamage: 0,
      defenseBonus: 0
    }
  });

  // Set active boss fight
  activeBossFight.set(bossFight);

  // Subscribe to real-time updates
  subscribeToBossFight(bossFight.id);

  // Start at shop
  battlePhase.set('shop');
  currentMessage.set('The Goblin Merchant has special wares for guild battles...');

  // Reset combat state
  combatState.set({
    turn: 'player',
    isAnimating: false,
    playerAction: null,
    enemyAction: null,
    lastDamageToEnemy: null,
    lastDamageToPlayer: null,
    playerDefeated: false
  });

  lastRoll.set(null);
}

// ============ Combat Actions ============

export async function playerAttack() {
  const state = get(combatState);
  if (state.isAnimating) return;

  const combat = get(playerCombat);
  const boss = get(activeBossFight);
  if (!boss || boss.status !== 'active') return;

  // Start animation
  combatState.set({ ...state, isAnimating: true, playerAction: 'attack' });

  // Roll dice for damage
  const rolls = rollDice(2, 6);
  const rollTotal = rolls.reduce((a, b) => a + b, 0);

  // Check for crit (doubles on dice)
  const isCrit = rolls[0] === rolls[1];

  lastRoll.set({ rolls, total: rollTotal, critical: isCrit });

  await delay(500);

  // Calculate damage - include Power stat bonus
  const stats = get(statBonuses) || {};
  const powerBonus = Math.floor(stats.baseDamage || 0);
  const baseDamage = 5 + rollTotal;
  const bonusDamage = combat.bonusDamage + combat.tempBuffs.bonusDamage + powerBonus;
  const critMultiplier = isCrit ? 1.5 + (combat.critBonus / 100) : 1;

  const totalDamage = Math.floor((baseDamage + bonusDamage) * critMultiplier);

  currentMessage.set(isCrit
    ? `Critical hit! You deal ${totalDamage} damage!`
    : `You attack for ${totalDamage} damage!`
  );

  combatState.update(s => ({ ...s, lastDamageToEnemy: totalDamage }));

  await delay(1000);

  // Send damage to Supabase (this will sync to all players)
  await dealDamageToGuildBoss(boss.id, totalDamage);

  // Boss counter-attack
  await bossAttack();
}

export async function playerDefend() {
  const state = get(combatState);
  if (state.isAnimating) return;

  combatState.set({ ...state, isAnimating: true, playerAction: 'defend' });

  playerCombat.update(c => ({ ...c, isDefending: true }));

  currentMessage.set('You raise your defenses!');

  await delay(800);

  // Boss attack with reduced damage
  await bossAttack();
}

export async function usePotion() {
  const state = get(combatState);
  if (state.isAnimating) return;

  const combat = get(playerCombat);
  if (combat.potions <= 0) {
    currentMessage.set('No potions left!');
    return;
  }

  combatState.set({ ...state, isAnimating: true, playerAction: 'potion' });

  const healAmount = combat.potionHeal || 75;
  const newHp = Math.min(combat.maxHp, combat.hp + healAmount);
  const actualHeal = newHp - combat.hp;

  playerCombat.update(c => ({
    ...c,
    hp: newHp,
    potions: c.potions - 1
  }));

  currentMessage.set(`You drink a potion and restore ${actualHeal} HP!`);

  await delay(1000);

  // Boss still attacks
  await bossAttack();
}

export async function castSpell(spell) {
  const state = get(combatState);
  if (state.isAnimating) return;

  const combat = get(playerCombat);
  if (combat.mp < spell.manaCost) {
    currentMessage.set('Not enough MP!');
    return;
  }

  const boss = get(activeBossFight);
  if (!boss || boss.status !== 'active') return;

  combatState.set({ ...state, isAnimating: true, playerAction: 'spell' });

  // Deduct MP
  playerCombat.update(c => ({ ...c, mp: c.mp - spell.manaCost }));

  currentMessage.set(`You cast ${spell.name}!`);

  await delay(800);

  // Calculate spell damage with bonus (include Power stat)
  const stats = get(statBonuses) || {};
  const powerBonus = Math.floor(stats.baseDamage || 0);
  const bonusDamage = combat.tempBuffs.bonusDamage + powerBonus;
  const totalDamage = spell.damage + Math.floor(bonusDamage * 0.5);

  currentMessage.set(`${spell.name} deals ${totalDamage} damage!`);

  combatState.update(s => ({ ...s, lastDamageToEnemy: totalDamage }));

  await delay(1000);

  // Send damage to Supabase
  await dealDamageToGuildBoss(boss.id, totalDamage);

  // Boss counter-attack
  await bossAttack();
}

async function bossAttack() {
  const boss = get(activeBossFight);
  const combat = get(playerCombat);

  if (!boss || boss.status !== 'active') {
    // Boss was defeated, end combat
    combatState.update(s => ({ ...s, isAnimating: false }));
    return;
  }

  combatState.update(s => ({ ...s, enemyAction: 'attack' }));

  const bossStats = boss.boss_stats || { attack: 30, defense: 15 };

  // Boss rolls dice too
  const rolls = rollDice(2, 6);
  const rollTotal = rolls.reduce((a, b) => a + b, 0);

  await delay(500);

  // Calculate boss damage
  let baseDamage = bossStats.attack + Math.floor(rollTotal / 2);

  // Apply player defense
  const playerDefense = combat.defenseBonus + combat.tempBuffs.defenseBonus;
  const defenseReduction = Math.floor(playerDefense * 0.5);

  // Check if defending
  if (combat.isDefending) {
    baseDamage = Math.floor(baseDamage * 0.5);
    playerCombat.update(c => ({ ...c, isDefending: false }));
  }

  const finalDamage = Math.max(1, baseDamage - defenseReduction);

  currentMessage.set(`${boss.boss_name} attacks for ${finalDamage} damage!`);

  combatState.update(s => ({ ...s, lastDamageToPlayer: finalDamage }));

  // Apply damage to player
  const newHp = combat.hp - finalDamage;
  playerCombat.update(c => ({ ...c, hp: newHp, mp: Math.min(c.maxMp, c.mp + 5) })); // Regen 5 MP per turn

  await delay(1000);

  // Check if player died
  if (newHp <= 0) {
    combatState.update(s => ({ ...s, playerDefeated: true, isAnimating: false }));
    battlePhase.set('defeat');
    currentMessage.set('You have been defeated! But the boss remains weakened for your guildmates...');
  } else {
    // Reset for next turn
    combatState.update(s => ({
      ...s,
      turn: 'player',
      isAnimating: false,
      playerAction: null,
      enemyAction: null,
      lastDamageToEnemy: null,
      lastDamageToPlayer: null
    }));
    currentMessage.set('Your turn!');
  }
}

// ============ Supabase Sync ============

async function dealDamageToGuildBoss(bossFightId, damage) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get current boss state
  const { data: boss, error: fetchError } = await supabase
    .from('guild_boss_fights')
    .select('*')
    .eq('id', bossFightId)
    .single();

  if (fetchError || !boss) {
    console.error('Failed to fetch boss:', fetchError);
    return;
  }

  // Get player username - try Supabase profile first, then local db
  let username = 'Unknown';

  // Try to get username from Supabase profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  if (profile?.username) {
    username = profile.username;
  } else {
    // Fall back to local db
    const player = await db.player.get(1);
    if (player?.username) {
      username = player.username;
    }
  }

  // Calculate new HP
  const newHp = Math.max(0, boss.boss_current_hp - damage);

  // Update participants
  const participants = boss.participants || {};
  if (!participants[user.id]) {
    participants[user.id] = { damage: 0, hits: 0, username };
  } else {
    // Always update username in case it was previously "Unknown"
    participants[user.id].username = username;
  }
  participants[user.id].damage += damage;
  participants[user.id].hits += 1;

  // Prepare update
  const updates = {
    boss_current_hp: newHp,
    participants
  };

  // Check if defeated
  if (newHp <= 0) {
    updates.status = 'defeated';
    updates.completed_at = new Date().toISOString();
  }

  // Update in Supabase (will trigger real-time subscription)
  const { error } = await supabase
    .from('guild_boss_fights')
    .update(updates)
    .eq('id', bossFightId);

  if (error) {
    console.error('Failed to update boss:', error);
  }
}

// ============ End Battle ============

export function endBattle() {
  unsubscribeFromBossFight();
  battlePhase.set('idle');
  activeBossFight.set(null);
  currentMessage.set('');
  lastRoll.set(null);
}

export function retreat() {
  currentMessage.set('You retreat from the battle. The boss remains for your guildmates!');
  setTimeout(() => {
    endBattle();
  }, 1500);
}
