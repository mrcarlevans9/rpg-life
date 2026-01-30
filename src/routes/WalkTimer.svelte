<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import ProgressBar from '../components/common/ProgressBar.svelte';
  import {
    walkTimer,
    startWalk,
    pauseWalk,
    resumeWalk,
    endWalk,
    cancelWalk,
    formatDuration,
    walkGoalProgress,
    walksData
  } from '../lib/stores/walks.js';
  import { settingsData } from '../lib/stores/settings.js';
  import { showSuccess } from '../lib/stores/notifications.js';

  let lastWalkResult = null;

  async function handleEndWalk() {
    lastWalkResult = await endWalk();
    if (lastWalkResult) {
      showSuccess(`Earned ${lastWalkResult.xpEarned} XP from your walk!`, 'Walk Complete');
    }
  }

  function handleCancelWalk() {
    if (confirm('Cancel this walk? Progress will be lost.')) {
      cancelWalk();
    }
  }

  function getRecentWalks(walks) {
    if (!walks) return [];
    return walks.slice(0, 7);
  }
</script>

<div class="walk-page">
  <header class="page-header">
    <h1>Walk Timer</h1>
    <p class="subtitle">Go for a walk to earn XP!</p>
  </header>

  <section class="timer-section">
    <Card>
      <div class="timer-card">
        <div class="timer-display">
          <span class="timer-icon">{$walkTimer.isRunning ? '🚶' : '⏱️'}</span>
          <span class="timer-time">{formatDuration($walkTimer.elapsedSeconds)}</span>
          {#if $walkTimer.isPaused}
            <span class="timer-status">PAUSED</span>
          {/if}
        </div>

        <div class="timer-info">
          <p>1 XP per minute + {$settingsData?.dailyWalkGoal || 20} min goal bonus (50 XP)</p>
        </div>

        <div class="timer-controls">
          {#if !$walkTimer.isRunning}
            <Button size="lg" on:click={startWalk}>
              Start Walk
            </Button>
          {:else if $walkTimer.isPaused}
            <Button size="lg" on:click={resumeWalk}>
              Resume
            </Button>
            <Button size="lg" variant="secondary" on:click={handleEndWalk}>
              End Walk
            </Button>
          {:else}
            <Button size="lg" variant="secondary" on:click={pauseWalk}>
              Pause
            </Button>
            <Button size="lg" on:click={handleEndWalk}>
              End Walk
            </Button>
          {/if}
        </div>

        {#if $walkTimer.isRunning}
          <button class="cancel-link" on:click={handleCancelWalk}>
            Cancel walk
          </button>
        {/if}
      </div>
    </Card>
  </section>

  <section class="goal-section">
    <Card>
      <div class="goal-card">
        <div class="goal-header">
          <h3>Daily Goal Progress</h3>
          <span class="goal-status" class:completed={$walkGoalProgress?.completed}>
            {$walkGoalProgress?.completed ? '✓ Completed!' : `${$walkGoalProgress?.current || 0}/${$walkGoalProgress?.goal || 20} min`}
          </span>
        </div>

        <ProgressBar
          value={$walkGoalProgress?.current || 0}
          max={$walkGoalProgress?.goal || 20}
          size="lg"
          color={$walkGoalProgress?.completed ? 'success' : 'accent'}
          animated={$walkTimer.isRunning}
        />

        <p class="goal-bonus">
          {#if $walkGoalProgress?.completed}
            🎉 You've earned your daily walk bonus!
          {:else}
            Walk {($walkGoalProgress?.goal || 20) - ($walkGoalProgress?.current || 0)} more minutes to earn a 50 XP bonus!
          {/if}
        </p>
      </div>
    </Card>
  </section>

  {#if lastWalkResult}
    <section class="result-section">
      <Card>
        <div class="result-card">
          <h3>Last Walk</h3>
          <div class="result-stats">
            <div class="result-stat">
              <span class="stat-value">{lastWalkResult.duration}</span>
              <span class="stat-label">minutes</span>
            </div>
            <div class="result-stat">
              <span class="stat-value xp">+{lastWalkResult.xpEarned}</span>
              <span class="stat-label">XP earned</span>
            </div>
            {#if lastWalkResult.hitGoal}
              <div class="result-stat">
                <span class="stat-value bonus">+50</span>
                <span class="stat-label">goal bonus</span>
              </div>
            {/if}
          </div>
        </div>
      </Card>
    </section>
  {/if}

  <section class="history-section">
    <h2>Recent Walks</h2>

    {#if $walksData && $walksData.length > 0}
      <div class="history-list">
        {#each getRecentWalks($walksData) as walk}
          <Card>
            <div class="history-item">
              <div class="history-date">
                {new Date(walk.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div class="history-duration">{walk.duration} min</div>
              <div class="history-xp">+{walk.xpEarned} XP</div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="empty-history">
        <p>No walks recorded yet. Start your first walk!</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .walk-page {
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .subtitle {
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }

  .timer-section {
    margin-bottom: var(--spacing-xl);
  }

  .timer-card {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .timer-icon {
    font-size: 4rem;
  }

  .timer-time {
    font-size: 4rem;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .timer-status {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--warning);
    text-transform: uppercase;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .timer-info {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-lg);
  }

  .timer-controls {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .cancel-link {
    margin-top: var(--spacing-md);
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .cancel-link:hover {
    color: var(--error);
  }

  .goal-section {
    margin-bottom: var(--spacing-xl);
  }

  .goal-card {
    padding: var(--spacing-md);
  }

  .goal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .goal-header h3 {
    font-size: 1rem;
  }

  .goal-status {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .goal-status.completed {
    color: var(--success);
    font-weight: 600;
  }

  .goal-bonus {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: var(--spacing-md);
  }

  .result-section {
    margin-bottom: var(--spacing-xl);
  }

  .result-card {
    text-align: center;
    padding: var(--spacing-md);
  }

  .result-card h3 {
    margin-bottom: var(--spacing-md);
    color: var(--text-muted);
  }

  .result-stats {
    display: flex;
    justify-content: center;
    gap: var(--spacing-xl);
  }

  .result-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat-value.xp {
    color: var(--xp-color);
  }

  .stat-value.bonus {
    color: var(--success);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .history-section h2 {
    font-size: 1rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .history-date {
    flex: 1;
    color: var(--text-secondary);
  }

  .history-duration {
    font-weight: 500;
  }

  .history-xp {
    color: var(--xp-color);
    font-weight: 600;
  }

  .empty-history {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--text-muted);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
