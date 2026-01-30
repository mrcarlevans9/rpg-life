<script>
  import AvatarDisplay from '../components/avatar/AvatarDisplay.svelte';
  import XPBar from '../components/player/XPBar.svelte';
  import StreakCounter from '../components/player/StreakCounter.svelte';
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import { playerData, xpProgress, currentLevel } from '../lib/stores/player.js';
  import { todaysTasks } from '../lib/stores/tasks.js';
  import { expeditionGoalProgress } from '../lib/stores/expeditions.js';
  import { avatarData } from '../lib/stores/avatar.js';
  import { TITLES } from '../lib/db/schema.js';

  $: equippedTitle = TITLES.find(t => t.key === $avatarData?.equippedTitle);
</script>

<div class="dashboard">
  <section class="hero">
    <div class="avatar-section">
      <AvatarDisplay size="xl" showLevel />
      {#if equippedTitle}
        <span class="title-badge">{equippedTitle.name}</span>
      {/if}
    </div>

    <div class="stats-section">
      <XPBar showDetails />

      <div class="stats-row">
        <StreakCounter />
      </div>
    </div>
  </section>

  <section class="quick-stats">
    <Card>
      <div class="stat-card">
        <span class="stat-icon">✅</span>
        <div class="stat-info">
          <span class="stat-value">{$todaysTasks?.length || 0}</span>
          <span class="stat-label">Tasks Due Today</span>
        </div>
      </div>
    </Card>

    <Card>
      <div class="stat-card">
        <span class="stat-icon">🗺️</span>
        <div class="stat-info">
          <span class="stat-value">{$expeditionGoalProgress?.current || 0}/{$expeditionGoalProgress?.goal || 20}</span>
          <span class="stat-label">Expedition Minutes</span>
        </div>
      </div>
    </Card>

    <Card>
      <div class="stat-card">
        <span class="stat-icon">⭐</span>
        <div class="stat-info">
          <span class="stat-value">{$playerData?.totalTasksCompleted || 0}</span>
          <span class="stat-label">Tasks Completed</span>
        </div>
      </div>
    </Card>
  </section>

  <section class="quick-actions">
    <h2>Quick Actions</h2>
    <div class="actions-grid">
      <a href="#/quests" class="action-card">
        <span class="action-icon">⚔️</span>
        <span class="action-label">View Today's Quests</span>
      </a>

      <a href="#/expedition" class="action-card">
        <span class="action-icon">🗺️</span>
        <span class="action-label">Start Expedition</span>
      </a>

      <a href="#/projects" class="action-card">
        <span class="action-icon">📋</span>
        <span class="action-label">Manage Projects</span>
      </a>

      <a href="#/achievements" class="action-card">
        <span class="action-icon">🏆</span>
        <span class="action-label">View Achievements</span>
      </a>
    </div>
  </section>

  {#if $todaysTasks && $todaysTasks.length > 0}
    <section class="todays-tasks">
      <h2>Due Today</h2>
      <div class="task-preview-list">
        {#each $todaysTasks.slice(0, 5) as task}
          <Card hoverable>
            <div class="task-preview">
              <span class="task-priority priority-{task.priority}"></span>
              <span class="task-title">{task.title}</span>
            </div>
          </Card>
        {/each}
        {#if $todaysTasks.length > 5}
          <a href="#/quests" class="view-all">
            View all {$todaysTasks.length} tasks →
          </a>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1000px;
    margin: 0 auto;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
    background-color: var(--bg-secondary);
    border-radius: var(--radius-xl);
    margin-bottom: var(--spacing-xl);
  }

  @media (min-width: 768px) {
    .hero {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
  }

  .title-badge {
    padding: var(--spacing-xs) var(--spacing-md);
    background-color: var(--accent);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stats-section {
    flex: 1;
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .stats-row {
    display: flex;
    justify-content: center;
  }

  .quick-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .quick-actions {
    margin-bottom: var(--spacing-xl);
  }

  .quick-actions h2 {
    margin-bottom: var(--spacing-md);
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text-primary);
    transition: all var(--transition-fast);
  }

  .action-card:hover {
    border-color: var(--accent);
    background-color: var(--accent-light);
  }

  .action-icon {
    font-size: 2rem;
  }

  .action-label {
    font-size: 0.875rem;
    font-weight: 500;
    text-align: center;
  }

  .todays-tasks h2 {
    margin-bottom: var(--spacing-md);
  }

  .task-preview-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .task-preview {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .task-priority {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
  }

  .priority-low { background-color: var(--priority-low); }
  .priority-medium { background-color: var(--priority-medium); }
  .priority-high { background-color: var(--priority-high); }

  .task-title {
    color: var(--text-primary);
  }

  .view-all {
    display: block;
    text-align: center;
    padding: var(--spacing-sm);
    color: var(--accent);
    font-weight: 500;
  }
</style>
