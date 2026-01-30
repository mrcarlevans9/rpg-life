import { writable } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from '../db/index.js';

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

// Settings data from DB
export const settingsData = createLiveQueryStore(() => db.settings.get(1), {
  theme: 'dark',
  accentColor: '#6366f1',
  navMode: 'sidebar',
  dailyWalkGoal: 20,
  soundEnabled: false
});

// Update a setting
export async function updateSetting(key, value) {
  await db.settings.update(1, { [key]: value });
}

// Update multiple settings
export async function updateSettings(updates) {
  await db.settings.update(1, updates);
}

// Toggle theme
export async function toggleTheme() {
  const settings = await db.settings.get(1);
  const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
  await db.settings.update(1, { theme: newTheme });
}

// Apply theme to document
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
