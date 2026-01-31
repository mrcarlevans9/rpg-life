import { writable, derived } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db, UNLOCKABLES } from '../db/index.js';
import { currentLevel } from './player.js';
import { pushAvatarUpdate } from '../supabase/sync.js';

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

// Avatar data from DB
export const avatarData = createLiveQueryStore(() => db.avatar.get(1), null);

// Unlockables from DB
export const unlockedItems = createLiveQueryStore(
  () => db.unlockables.where('unlocked').equals(1).toArray(),
  []
);

// Get all cosmetics of a type with unlock status
export async function getCosmeticsOfType(type) {
  const items = await db.unlockables.where('type').equals(type).toArray();
  return items.sort((a, b) => a.level - b.level);
}

// Check and unlock new cosmetics based on level
export async function checkUnlocks(level) {
  const allItems = await db.unlockables.toArray();
  const newUnlocks = [];

  for (const item of allItems) {
    if (!item.unlocked && item.level <= level) {
      await db.unlockables.update(item.id, { unlocked: true });
      newUnlocks.push(item);
    }
  }

  return newUnlocks;
}

// Update avatar cosmetic
export async function updateAvatar(field, value) {
  await db.avatar.update(1, { [field]: value });

  // Sync to cloud
  pushAvatarUpdate({ [field]: value }).catch(err => console.error('Failed to sync avatar:', err));
}

// Update equipped title
export async function updateTitle(titleKey) {
  await db.avatar.update(1, { equippedTitle: titleKey });

  // Sync to cloud
  pushAvatarUpdate({ equippedTitle: titleKey }).catch(err => console.error('Failed to sync title:', err));
}

// Get avatar display data with resolved colors
export function getAvatarDisplayData(avatar) {
  if (!avatar) {
    return {
      gender: 'neutral',
      skinColor: '#D4A574',
      hairColor: '#8B4513',
      hairStyle: 'default',
      outfit: 'casual',
      accessory: 'none'
    };
  }

  const skinTone = UNLOCKABLES.skinTones.find(s => s.key === avatar.skinTone);
  const hairColor = UNLOCKABLES.hairColors.find(h => h.key === avatar.hairColor);

  return {
    gender: avatar.gender || 'neutral',
    skinColor: skinTone?.color || '#D4A574',
    hairColor: hairColor?.color || '#8B4513',
    hairStyle: avatar.hairStyle || 'default',
    outfit: avatar.outfit || 'casual',
    accessory: avatar.accessory || 'none'
  };
}
