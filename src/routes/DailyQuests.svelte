<script>
  import { onMount } from 'svelte';
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import ProgressBar from '../components/common/ProgressBar.svelte';
  import { db } from '../lib/db/index.js';
  import { completeTask } from '../lib/stores/tasks.js';
  import { walkGoalProgress } from '../lib/stores/walks.js';
  import { playerData, xpProgress } from '../lib/stores/player.js';
  import { showXPGain } from '../lib/stores/notifications.js';

  let todaysTasks = [];
  let loading = true;

  const today = new Date().toISOString().split('T')[0];

  onMount(async () => {
    await loadTodaysTasks();
  });

  async function loadTodaysTasks() {
    loading = true;

    // Get tasks due today or overdue
    const allTasks = await db.tasks.toArray();
    todaysTasks = allTasks.filter(task => {
      if (task.completed) return false;
      if (task.dueDate && task.dueDate <= today) return true;
      return false;
    });

    // Also get tasks in progress
    const inProgressTasks = allTasks.filter(task =>
      !task.completed && task.columnId === 'in-progress'
    );

    // Combine and dedupe
    const combined = [...todaysTasks];
    for (const task of inProgressTasks) {
      if (!combined.find(t => t.id === task.id)) {
        combined.push(task);
      }
    }

    todaysTasks = combined.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    loading = false;
  }

  async function handleCompleteQuest(task) {
    const result = await completeTask(task.id);
    if (result) {
      showXPGain(result.amount, 'quest');
    }
    await loadTodaysTasks();
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    return dueDate < today;
  }

  function getXPValue(priority) {
    const base = { low: 10, medium: 25, high: 50 };
    return base[priority] || 25;
  }

  $: completedCount = $playerData?.totalTasksCompleted || 0;
  $: dailyProgress = Math.min(todaysTasks.length > 0 ? 0 : 100, 100);
</script>

<div class="quests-page">
  <header class="page-header">
    <div>
      <h1>Daily Quests</h1>
      <p class="date-display">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </div>
  </header>

  <section class="progress-section">
    <Card>
      <div class="progress-card">
        <div class="progress-item">
          <div class="progress-header">
            <span class="progress-icon">⚔️</span>
            <span class="progress-label">Quests</span>
          </div>
          <span class="progress-value">{todaysTasks.filter(t => t.completed).length}/{todaysTasks.length}</span>
        </div>

        <div class="progress-item">
          <div class="progress-header">
            <span class="progress-icon">🚶</span>
            <span class="progress-label">Walk Goal</span>
          </div>
          <ProgressBar
            value={$walkGoalProgress?.current || 0}
            max={$walkGoalProgress?.goal || 20}
            size="sm"
            color={$walkGoalProgress?.completed ? 'success' : 'accent'}
          />
          <span class="progress-value">{$walkGoalProgress?.current || 0}/{$walkGoalProgress?.goal || 20} min</span>
        </div>

        <div class="progress-item">
          <div class="progress-header">
            <span class="progress-icon">⭐</span>
            <span class="progress-label">XP Progress</span>
          </div>
          <ProgressBar
            value={$xpProgress?.currentXP || 0}
            max={$xpProgress?.xpNeeded || 100}
            size="sm"
            color="xp"
          />
          <span class="progress-value">Level {$xpProgress?.level || 1}</span>
        </div>
      </div>
    </Card>
  </section>

  <section class="quests-section">
    <h2>Today's Quests</h2>

    {#if loading}
      <div class="loading">Loading quests...</div>
    {:else if todaysTasks.length === 0}
      <div class="empty-quests">
        <span class="empty-icon">🎉</span>
        <h3>All Clear!</h3>
        <p>No quests due today. Add tasks with due dates or check your projects!</p>
        <a href="#/projects" class="link-btn">Go to Projects →</a>
      </div>
    {:else}
      <div class="quest-list">
        {#each todaysTasks as task}
          <Card>
            <div class="quest-card" class:overdue={isOverdue(task.dueDate)}>
              <div class="quest-left">
                <button
                  class="complete-btn"
                  on:click={() => handleCompleteQuest(task)}
                  aria-label="Complete quest"
                >
                  <span class="checkmark">✓</span>
                </button>
              </div>

              <div class="quest-content">
                <div class="quest-header">
                  <span class="quest-title">{task.title}</span>
                  <span class="quest-xp">+{getXPValue(task.priority)} XP</span>
                </div>

                {#if task.description}
                  <p class="quest-description">{task.description}</p>
                {/if}

                <div class="quest-meta">
                  <span class="priority priority-{task.priority}">{task.priority}</span>
                  {#if task.dueDate}
                    <span class="due-date" class:overdue={isOverdue(task.dueDate)}>
                      {isOverdue(task.dueDate) ? '⚠️ Overdue' : '📅 Due today'}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </section>

  <section class="bonus-section">
    <h2>Bonus Objectives</h2>
    <div class="bonus-grid">
      <Card>
        <div class="bonus-card" class:completed={$walkGoalProgress?.completed}>
          <span class="bonus-icon">{$walkGoalProgress?.completed ? '✅' : '🚶'}</span>
          <div class="bonus-info">
            <span class="bonus-name">Daily Walk</span>
            <span class="bonus-desc">Walk {$walkGoalProgress?.goal || 20} minutes</span>
          </div>
          <span class="bonus-reward">+50 XP</span>
        </div>
      </Card>

      <Card>
        <div class="bonus-card" class:completed={todaysTasks.length >= 3 && todaysTasks.filter(t => t.completed).length >= 3}>
          <span class="bonus-icon">⚔️</span>
          <div class="bonus-info">
            <span class="bonus-name">Quest Trio</span>
            <span class="bonus-desc">Complete 3 tasks today</span>
          </div>
          <span class="bonus-reward">+25 XP</span>
        </div>
      </Card>
    </div>
  </section>
</div>

<style>
  .quests-page {
    max-width: 800px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: var(--spacing-xl);
  }

  .date-display {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: var(--spacing-xs);
  }

  .progress-section {
    margin-bottom: var(--spacing-xl);
  }

  .progress-card {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .progress-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .progress-icon {
    font-size: 1.25rem;
  }

  .progress-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .progress-value {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: right;
  }

  .quests-section {
    margin-bottom: var(--spacing-xl);
  }

  .quests-section h2 {
    margin-bottom: var(--spacing-md);
  }

  .quest-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .quest-card {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .quest-card.overdue {
    border-left: 3px solid var(--error);
    margin-left: -1px;
  }

  .quest-left {
    display: flex;
    align-items: flex-start;
    padding-top: var(--spacing-xs);
  }

  .complete-btn {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-light);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .complete-btn:hover {
    border-color: var(--success);
    background-color: var(--success);
  }

  .complete-btn:hover .checkmark {
    opacity: 1;
    color: white;
  }

  .checkmark {
    opacity: 0;
    font-size: 0.875rem;
    font-weight: 700;
    transition: opacity var(--transition-fast);
  }

  .quest-content {
    flex: 1;
  }

  .quest-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .quest-title {
    font-weight: 600;
    color: var(--text-primary);
  }

  .quest-xp {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--xp-color);
    white-space: nowrap;
  }

  .quest-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
  }

  .quest-meta {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .priority {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .priority-low {
    background-color: rgba(34, 197, 94, 0.1);
    color: var(--priority-low);
  }

  .priority-medium {
    background-color: rgba(245, 158, 11, 0.1);
    color: var(--priority-medium);
  }

  .priority-high {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--priority-high);
  }

  .due-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .due-date.overdue {
    color: var(--error);
  }

  .empty-quests {
    text-align: center;
    padding: var(--spacing-2xl);
    background-color: var(--bg-secondary);
    border-radius: var(--radius-lg);
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--spacing-md);
  }

  .empty-quests h3 {
    margin-bottom: var(--spacing-sm);
  }

  .empty-quests p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .link-btn {
    color: var(--accent);
    font-weight: 500;
  }

  .bonus-section h2 {
    margin-bottom: var(--spacing-md);
    font-size: 1rem;
    color: var(--text-muted);
  }

  .bonus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-md);
  }

  .bonus-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .bonus-card.completed {
    opacity: 0.6;
  }

  .bonus-icon {
    font-size: 1.5rem;
  }

  .bonus-info {
    flex: 1;
  }

  .bonus-name {
    display: block;
    font-weight: 500;
  }

  .bonus-desc {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .bonus-reward {
    font-weight: 600;
    color: var(--xp-color);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-muted);
  }
</style>
