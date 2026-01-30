<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import { settingsData, updateSetting, toggleTheme } from '../lib/stores/settings.js';
  import { db } from '../lib/db/index.js';
  import { showSuccess, showError } from '../lib/stores/notifications.js';

  let importInput;

  const accentColors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#3b82f6'  // Blue
  ];

  async function handleExpeditionGoalChange(e) {
    const value = parseInt(e.target.value);
    if (value > 0) {
      await updateSetting('dailyExpeditionGoal', value);
    }
  }

  async function handleAccentColorChange(color) {
    await updateSetting('accentColor', color);
    document.documentElement.style.setProperty('--accent', color);
    showSuccess('Accent color updated!');
  }

  async function exportData() {
    try {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        player: await db.player.get(1),
        avatar: await db.avatar.get(1),
        projects: await db.projects.toArray(),
        tasks: await db.tasks.toArray(),
        tags: await db.tags.toArray(),
        walks: await db.walks.toArray(),
        achievements: await db.achievements.toArray(),
        unlockables: await db.unlockables.toArray(),
        settings: await db.settings.get(1),
        xpHistory: await db.xpHistory.toArray(),
        dailyStats: await db.dailyStats.toArray()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rpg-life-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showSuccess('Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export data');
    }
  }

  async function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.player) {
        throw new Error('Invalid backup file');
      }

      if (!confirm('This will replace all your current data. Are you sure?')) {
        return;
      }

      // Clear existing data
      await db.player.clear();
      await db.avatar.clear();
      await db.projects.clear();
      await db.tasks.clear();
      await db.tags.clear();
      await db.walks.clear();
      await db.achievements.clear();
      await db.unlockables.clear();
      await db.settings.clear();
      await db.xpHistory.clear();
      await db.dailyStats.clear();

      // Import new data
      if (data.player) await db.player.add(data.player);
      if (data.avatar) await db.avatar.add(data.avatar);
      if (data.projects) await db.projects.bulkAdd(data.projects);
      if (data.tasks) await db.tasks.bulkAdd(data.tasks);
      if (data.tags) await db.tags.bulkAdd(data.tags);
      if (data.walks) await db.walks.bulkAdd(data.walks);
      if (data.achievements) await db.achievements.bulkAdd(data.achievements);
      if (data.unlockables) await db.unlockables.bulkAdd(data.unlockables);
      if (data.settings) await db.settings.add(data.settings);
      if (data.xpHistory) await db.xpHistory.bulkAdd(data.xpHistory);
      if (data.dailyStats) await db.dailyStats.bulkAdd(data.dailyStats);

      showSuccess('Data imported successfully! Refreshing...');

      // Reload to apply changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import error:', error);
      showError('Failed to import data. Invalid file format.');
    }

    // Reset input
    e.target.value = '';
  }

  async function resetAllData() {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone!')) {
      return;
    }

    if (!confirm('REALLY sure? All progress will be lost!')) {
      return;
    }

    try {
      await db.delete();
      showSuccess('Data reset! Refreshing...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Reset error:', error);
      showError('Failed to reset data');
    }
  }
</script>

<div class="settings-page">
  <header class="page-header">
    <h1>Settings</h1>
  </header>

  <section class="settings-section">
    <h2>Appearance</h2>

    <Card>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Theme</h3>
          <p>Toggle between light and dark mode</p>
        </div>
        <Button variant="secondary" on:click={toggleTheme}>
          {$settingsData?.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </div>
    </Card>

    <Card>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Accent Color</h3>
          <p>Customize the app's accent color</p>
        </div>
        <div class="color-picker">
          {#each accentColors as color}
            <button
              class="color-option"
              class:selected={$settingsData?.accentColor === color}
              style="background-color: {color}"
              on:click={() => handleAccentColorChange(color)}
            ></button>
          {/each}
        </div>
      </div>
    </Card>
  </section>

  <section class="settings-section">
    <h2>Expedition Settings</h2>

    <Card>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Daily Expedition Goal</h3>
          <p>Set your daily expedition goal in minutes</p>
        </div>
        <div class="goal-input">
          <input
            type="number"
            min="5"
            max="120"
            value={$settingsData?.dailyExpeditionGoal || 20}
            on:change={handleExpeditionGoalChange}
          />
          <span>minutes</span>
        </div>
      </div>
    </Card>
  </section>

  <section class="settings-section">
    <h2>Data Management</h2>

    <Card>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Export Data</h3>
          <p>Download a backup of all your data</p>
        </div>
        <Button variant="secondary" on:click={exportData}>
          Export JSON
        </Button>
      </div>
    </Card>

    <Card>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Import Data</h3>
          <p>Restore from a backup file</p>
        </div>
        <input
          type="file"
          accept=".json"
          bind:this={importInput}
          on:change={importData}
          style="display: none"
        />
        <Button variant="secondary" on:click={() => importInput.click()}>
          Import JSON
        </Button>
      </div>
    </Card>

    <Card>
      <div class="setting-item danger">
        <div class="setting-info">
          <h3>Reset All Data</h3>
          <p>Delete all data and start fresh. This cannot be undone!</p>
        </div>
        <Button variant="danger" on:click={resetAllData}>
          Reset Data
        </Button>
      </div>
    </Card>
  </section>

  <section class="settings-section">
    <h2>About</h2>

    <Card>
      <div class="about-card">
        <h3>RPG Life</h3>
        <p>Version 1.0.0</p>
        <p class="about-desc">
          A gamified productivity app that turns your tasks into quests
          and walks into XP. Level up, unlock cosmetics, and achieve your goals!
        </p>
      </div>
    </Card>
  </section>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: var(--spacing-xl);
  }

  .settings-section {
    margin-bottom: var(--spacing-xl);
  }

  .settings-section h2 {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: var(--spacing-md);
  }

  .settings-section > :global(.card) {
    margin-bottom: var(--spacing-sm);
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .setting-info {
    flex: 1;
  }

  .setting-info h3 {
    font-size: 1rem;
    margin-bottom: var(--spacing-xs);
  }

  .setting-info p {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .color-picker {
    display: flex;
    gap: var(--spacing-xs);
  }

  .color-option {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    transition: all var(--transition-fast);
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-secondary);
  }

  .goal-input {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .goal-input input {
    width: 80px;
    text-align: center;
  }

  .goal-input span {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .setting-item.danger {
    border-top: 1px solid var(--error);
    padding-top: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }

  .about-card {
    text-align: center;
    padding: var(--spacing-lg);
  }

  .about-card h3 {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-xs);
  }

  .about-card p {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .about-desc {
    margin-top: var(--spacing-md);
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }
</style>
