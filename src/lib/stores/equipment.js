import { writable, derived, get } from 'svelte/store';
import { liveQuery } from 'dexie';
import {
  db,
  SLOT_TYPES,
  RARITIES,
  ATTRIBUTES,
  TAINTED_ITEMS,
  ITEM_NAMES,
  DROP_CHANCES,
  BASE_SELL_VALUES
} from '../db/index.js';
import {
  pushEquipmentCreate,
  pushEquipmentUpdate,
  pushEquipmentDelete,
  pushPlayerUpdate
} from '../supabase/sync.js';

// ============ STORES ============

// All equipment in inventory
function createLiveQueryStore(queryFn, defaultValue) {
  const { subscribe, set } = writable(defaultValue);
  let subscription;

  if (typeof window !== 'undefined') {
    const observable = liveQuery(queryFn);
    subscription = observable.subscribe({
      next: value => set(value ?? defaultValue),
      error: err => console.error('LiveQuery error:', err)
    });
  }

  return {
    subscribe,
    set,
    destroy: () => subscription?.unsubscribe?.()
  };
}

// All equipment in player's inventory
export const equipmentData = createLiveQueryStore(
  () => db.equipment.toArray(),
  []
);

// Pending loot (not yet extracted)
export const pendingLootData = createLiveQueryStore(
  () => db.pendingLoot.toArray(),
  []
);

// Derived: Currently equipped items by slot
export const equippedItems = derived(equipmentData, ($equipment) => {
  const equipped = { weapon: null, armor: null, accessory: null };
  for (const item of $equipment) {
    if (item.equipped && SLOT_TYPES.includes(item.slot)) {
      equipped[item.slot] = item;
    }
  }
  return equipped;
});

// Derived: Total stats from equipped items
export const equippedStats = derived(equippedItems, ($equipped) => {
  const stats = {
    // Offensive
    damage: 0,
    critChance: 0,
    critDamage: 0,
    armorPierce: 0,
    doubleStrike: 0,
    firstBlood: 0,
    executioner: 0,
    bossSlayer: 0,
    giantKiller: 0,
    // Defensive
    defense: 0,
    maxHp: 0,
    blockChance: 0,
    thorns: 0,
    resistFire: 0,
    resistStun: 0,
    secondWind: false,
    fortify: 0,
    // Resource
    goldPerKill: 0,
    maxMp: 0,
    manaRegen: 0,
    potionCapacity: 0,
    potionEfficiency: 0,
    scavenger: 0,
    // Guild/PvP
    guildBossDamage: 0,
    contributionBonus: 0,
    pvpDamage: 0,
    pvpDefense: 0,
    // Utility
    xpBonus: 0,
    treasureHunter: 0,
    quickFeet: 0,
    momentum: false,
    lucky: false,
    ambush: 0,
    // Tainted penalties (tracked separately)
    penalties: []
  };

  for (const slot of SLOT_TYPES) {
    const item = $equipped[slot];
    if (!item) continue;

    // Apply bonuses
    for (const bonus of item.bonuses || []) {
      if (stats[bonus.type] !== undefined) {
        if (typeof stats[bonus.type] === 'boolean') {
          stats[bonus.type] = true;
        } else {
          stats[bonus.type] += bonus.value;
        }
      }
    }

    // Track penalties for tainted items
    if (item.tainted && item.penalties) {
      stats.penalties.push(...item.penalties.map(p => ({ ...p, source: item.name })));
    }
  }

  return stats;
});

// Derived: Inventory count
export const inventoryCount = derived(equipmentData, ($equipment) => $equipment.length);

// ============ ITEM GENERATION ============

// Generate a random item name
function generateItemName(slot, rarity) {
  const names = ITEM_NAMES[slot];
  if (!names) return 'Unknown Item';

  const prefix = names.prefixes[Math.floor(Math.random() * names.prefixes.length)];
  const base = names.bases[Math.floor(Math.random() * names.bases.length)];

  // Higher rarity = more likely to have suffix
  const suffixChance = { common: 0, uncommon: 0.3, rare: 0.6, epic: 1, tainted: 0 };
  const hasSuffix = Math.random() < (suffixChance[rarity] || 0);
  const suffix = hasSuffix ? names.suffixes[Math.floor(Math.random() * names.suffixes.length)] : '';

  return `${prefix} ${base}${suffix ? ' ' + suffix : ''}`;
}

// Get valid attributes for a slot
function getValidAttributes(slot) {
  return Object.entries(ATTRIBUTES)
    .filter(([key, attr]) => attr.slots.includes(slot))
    .map(([key, attr]) => ({ key, ...attr }));
}

// Generate random attributes for an item
function generateAttributes(slot, rarity) {
  const rarityData = RARITIES[rarity];
  if (!rarityData) return [];

  const validAttrs = getValidAttributes(slot);
  if (validAttrs.length === 0) return [];

  const numAttrs = rarityData.minAttrs + Math.floor(Math.random() * (rarityData.maxAttrs - rarityData.minAttrs + 1));
  const selectedAttrs = [];
  const usedKeys = new Set();

  for (let i = 0; i < numAttrs && validAttrs.length > usedKeys.size; i++) {
    // Pick a random unused attribute
    let attr;
    do {
      attr = validAttrs[Math.floor(Math.random() * validAttrs.length)];
    } while (usedKeys.has(attr.key));

    usedKeys.add(attr.key);

    // Roll value within range (higher rarity = higher average)
    const rarityBonus = { common: 0, uncommon: 0.1, rare: 0.2, epic: 0.3 }[rarity] || 0;
    const range = attr.max - attr.min;
    const baseRoll = Math.random();
    const boostedRoll = Math.min(1, baseRoll + rarityBonus);
    const value = Math.round(attr.min + boostedRoll * range);

    selectedAttrs.push({
      type: attr.key,
      value,
      description: attr.description.replace('{value}', value)
    });
  }

  return selectedAttrs;
}

// Generate a random equipment item
export function generateItem(slot, rarity, source = 'dungeon_drop', floor = null) {
  const name = generateItemName(slot, rarity);
  const bonuses = generateAttributes(slot, rarity);

  return {
    slot,
    name,
    rarity,
    tainted: false,
    baseStats: {},
    bonuses,
    penalties: [],
    equipped: false,
    obtainedFrom: source,
    obtainedAt: new Date().toISOString(),
    floor
  };
}

// Generate a tainted item
export function generateTaintedItem(slot, floor) {
  const pool = TAINTED_ITEMS[slot + 's']; // weapons, armor, accessories
  if (!pool || pool.length === 0) return null;

  // Filter by floor requirement
  const available = pool.filter(item => floor >= item.floorMin);
  if (available.length === 0) return null;

  const template = available[Math.floor(Math.random() * available.length)];

  return {
    slot,
    name: template.name,
    rarity: 'tainted',
    tainted: true,
    baseStats: {},
    bonuses: template.bonuses.map(b => ({ ...b })),
    penalties: template.penalties.map(p => ({ ...p })),
    equipped: false,
    obtainedFrom: 'dungeon_drop',
    obtainedAt: new Date().toISOString(),
    floor,
    templateKey: template.key,
    emoji: template.emoji
  };
}

// Roll for loot drop
export function rollLootDrop(source = 'monster', floor = 1, taintedUnlocked = false, fortuneBonus = 0) {
  const chances = DROP_CHANCES[source];
  if (!chances) return null;

  const roll = Math.random();
  let cumulative = 0;

  // Check tainted first if unlocked and deep enough
  if (taintedUnlocked && floor >= 20 && source === 'majorBoss') {
    if (roll < 0.1) { // 10% tainted from major boss on floor 20+
      const slot = SLOT_TYPES[Math.floor(Math.random() * SLOT_TYPES.length)];
      return generateTaintedItem(slot, floor);
    }
  }

  // Apply fortune bonus: increases chances of higher rarities
  // Fortune bonus shifts the roll down, making it easier to hit higher rarity thresholds
  const fortuneMultiplier = 1 + (fortuneBonus / 100);

  // Roll for regular rarities (in reverse order: epic -> rare -> uncommon -> common)
  const rarityOrder = ['epic', 'rare', 'uncommon', 'common'];
  for (const rarity of rarityOrder) {
    if (chances[rarity]) {
      // Fortune bonus increases all rarity chances
      const adjustedChance = chances[rarity] * fortuneMultiplier;
      cumulative += adjustedChance;
      if (roll < cumulative) {
        const slot = SLOT_TYPES[Math.floor(Math.random() * SLOT_TYPES.length)];
        return generateItem(slot, rarity, source === 'monster' ? 'dungeon_drop' : 'boss_drop', floor);
      }
    }
  }

  return null; // No drop
}

// ============ INVENTORY MANAGEMENT ============

// Add item to pending loot (during dungeon run)
export async function addToPendingLoot(item) {
  return await db.pendingLoot.add(item);
}

// Clear all pending loot (on death)
export async function clearPendingLoot() {
  return await db.pendingLoot.clear();
}

// Extract pending loot to inventory (on successful extraction)
export async function extractPendingLoot() {
  const pending = await db.pendingLoot.toArray();
  const player = await db.player.get(1);
  const currentCount = await db.equipment.count();
  const maxSlots = player?.inventorySlots || 15;

  const extracted = [];
  const overflow = [];

  for (const item of pending) {
    if (currentCount + extracted.length < maxSlots) {
      // Remove pendingLoot-specific id before adding to equipment
      const { id, ...itemData } = item;
      const newId = await db.equipment.add(itemData);
      const newItem = { ...itemData, id: newId };
      extracted.push(newItem);

      // Sync to cloud
      pushEquipmentCreate(newItem);
    } else {
      overflow.push(item);
    }
  }

  await db.pendingLoot.clear();

  return { extracted, overflow };
}

// Equip an item (swap if slot occupied)
export async function equipItem(itemId) {
  const item = await db.equipment.get(itemId);
  if (!item) return { success: false, error: 'Item not found' };

  // Unequip current item in that slot
  const currentEquipped = await db.equipment
    .where('slot').equals(item.slot)
    .and(i => i.equipped === true)
    .first();

  if (currentEquipped) {
    await db.equipment.update(currentEquipped.id, { equipped: false });
    // Sync unequip to cloud
    pushEquipmentUpdate(currentEquipped.id, { equipped: false });
  }

  // Equip new item
  await db.equipment.update(itemId, { equipped: true });
  // Sync equip to cloud
  pushEquipmentUpdate(itemId, { equipped: true });

  return { success: true, unequipped: currentEquipped };
}

// Unequip an item
export async function unequipItem(itemId) {
  const item = await db.equipment.get(itemId);
  if (!item) return { success: false, error: 'Item not found' };

  await db.equipment.update(itemId, { equipped: false });
  // Sync to cloud
  pushEquipmentUpdate(itemId, { equipped: false });

  return { success: true };
}

// Sell an item for gold
export async function sellItem(itemId) {
  const item = await db.equipment.get(itemId);
  if (!item) return { success: false, error: 'Item not found' };
  if (item.equipped) return { success: false, error: 'Cannot sell equipped item' };

  const baseValue = BASE_SELL_VALUES[item.rarity] || 5;
  const rarityData = RARITIES[item.rarity];
  const sellValue = Math.floor(baseValue * (rarityData?.sellMultiplier || 0.1) * (1 + (item.bonuses?.length || 0) * 0.1));
  const finalValue = Math.max(1, sellValue);

  // Add gold to player
  const player = await db.player.get(1);
  const newGold = (player?.gold || 0) + finalValue;
  await db.player.update(1, { gold: newGold });
  // Sync gold to cloud
  pushPlayerUpdate({ gold: newGold });

  // Sync delete to cloud before removing locally
  pushEquipmentDelete(itemId);

  // Remove item locally
  await db.equipment.delete(itemId);

  return { success: true, goldEarned: finalValue };
}

// Get sell value preview
export function getSellValue(item) {
  if (!item) return 0;
  const baseValue = BASE_SELL_VALUES[item.rarity] || 5;
  const rarityData = RARITIES[item.rarity];
  const sellValue = Math.floor(baseValue * (rarityData?.sellMultiplier || 0.1) * (1 + (item.bonuses?.length || 0) * 0.1));
  return Math.max(1, sellValue);
}

// ============ UTILITY ============

// Get rarity color
export function getRarityColor(rarity) {
  return RARITIES[rarity]?.color || '#9ca3af';
}

// Get rarity name
export function getRarityName(rarity) {
  return RARITIES[rarity]?.name || 'Unknown';
}

// Format attribute description
export function formatAttribute(bonus) {
  const attr = ATTRIBUTES[bonus.type];
  if (!attr) return bonus.description || `+${bonus.value} ${bonus.type}`;
  return attr.description.replace('{value}', bonus.value);
}

// Check if player can see tainted items
export async function checkTaintedAccess() {
  const player = await db.player.get(1);
  // Would need to check level here - for now just return the flag
  return {
    unlocked: player?.taintedUnlocked || false,
    teased: player?.taintedTeased || false
  };
}

// Unlock tainted items (called when player reaches level 15)
export async function unlockTaintedItems() {
  await db.player.update(1, { taintedUnlocked: true });
}

// Show tainted teaser (called when player reaches level 10)
export async function showTaintedTeaser() {
  await db.player.update(1, { taintedTeased: true });
}
