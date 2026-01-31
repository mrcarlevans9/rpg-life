<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import ProgressBar from '../components/common/ProgressBar.svelte';
  import {
    expeditionTimer,
    startExpedition,
    pauseExpedition,
    resumeExpedition,
    endExpedition,
    cancelExpedition,
    formatDuration,
    expeditionGoalProgress,
    expeditionsData
  } from '../lib/stores/expeditions.js';
  import { settingsData } from '../lib/stores/settings.js';
  import { showSuccess } from '../lib/stores/notifications.js';

  let lastExpeditionResult = null;

  async function handleEndExpedition() {
    lastExpeditionResult = await endExpedition();
    if (lastExpeditionResult) {
      let message = `Earned ${lastExpeditionResult.xpEarned} XP`;
      if (lastExpeditionResult.bonusRewards) {
        const { goldEarned, itemsToAward } = lastExpeditionResult.bonusRewards;
        if (goldEarned > 0) {
          message += `, +${goldEarned} gold`;
        }
        if (itemsToAward && itemsToAward.length > 0) {
          message += `, +${itemsToAward.length} item${itemsToAward.length > 1 ? 's' : ''}`;
        }
      }
      message += '!';
      showSuccess(message, 'Expedition Complete');
    }
  }

  function handleCancelExpedition() {
    if (confirm('Cancel this expedition? Progress will be lost.')) {
      cancelExpedition();
    }
  }

  function getRecentExpeditions(expeditions) {
    if (!expeditions) return [];
    return expeditions.slice(0, 7);
  }
</script>

<div class="expedition-page">
  <header class="page-header">
    <h1>Expedition</h1>
    <p class="subtitle">Embark on an adventure to earn XP!</p>
  </header>

  <section class="timer-section">
    <Card>
      <div class="timer-card">
        <div class="timer-display">
          <span class="timer-icon">{$expeditionTimer.isRunning ? '🗺️' : '⏱️'}</span>
          <span class="timer-time">{formatDuration($expeditionTimer.elapsedSeconds)}</span>
          {#if $expeditionTimer.isPaused}
            <span class="timer-status">PAUSED</span>
          {/if}
        </div>

        <div class="timer-info">
          <p>1 XP per minute + {$settingsData?.dailyExpeditionGoal || 20} min goal bonus (50 XP)</p>
        </div>

        <div class="timer-controls">
          {#if !$expeditionTimer.isRunning}
            <Button size="lg" on:click={startExpedition}>
              Begin Expedition
            </Button>
          {:else if $expeditionTimer.isPaused}
            <Button size="lg" on:click={resumeExpedition}>
              Resume
            </Button>
            <Button size="lg" variant="secondary" on:click={handleEndExpedition}>
              End Expedition
            </Button>
          {:else}
            <Button size="lg" variant="secondary" on:click={pauseExpedition}>
              Pause
            </Button>
            <Button size="lg" on:click={handleEndExpedition}>
              End Expedition
            </Button>
          {/if}
        </div>

        {#if $expeditionTimer.isRunning}
          <button class="cancel-link" on:click={handleCancelExpedition}>
            Abandon expedition
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
          <span class="goal-status" class:completed={$expeditionGoalProgress?.completed}>
            {$expeditionGoalProgress?.completed ? '✓ Completed!' : `${$expeditionGoalProgress?.current || 0}/${$expeditionGoalProgress?.goal || 20} min`}
          </span>
        </div>

        <ProgressBar
          value={$expeditionGoalProgress?.current || 0}
          max={$expeditionGoalProgress?.goal || 20}
          size="lg"
          color={$expeditionGoalProgress?.completed ? 'success' : 'accent'}
          animated={$expeditionTimer.isRunning}
        />

        <p class="goal-bonus">
          {#if $expeditionGoalProgress?.completed}
            🎉 You've earned your daily expedition bonus!
          {:else}
            Explore for {($expeditionGoalProgress?.goal || 20) - ($expeditionGoalProgress?.current || 0)} more minutes to earn a 50 XP bonus!
          {/if}
        </p>
      </div>
    </Card>
  </section>

  {#if lastExpeditionResult}
    <section class="result-section">
      <Card>
        <div class="result-card">
          <h3>Last Expedition</h3>
          <div class="result-stats">
            <div class="result-stat">
              <span class="stat-value">{lastExpeditionResult.duration}</span>
              <span class="stat-label">minutes</span>
            </div>
            <div class="result-stat">
              <span class="stat-value xp">+{lastExpeditionResult.xpEarned}</span>
              <span class="stat-label">XP earned</span>
            </div>
            {#if lastExpeditionResult.hitGoal}
              <div class="result-stat">
                <span class="stat-value bonus">+50</span>
                <span class="stat-label">goal bonus</span>
              </div>
            {/if}
          </div>

          {#if lastExpeditionResult.bonusRewards}
            <div class="bonus-rewards">
              <h4>Bonus Loot (Beyond Goal)</h4>
              <div class="bonus-stats">
                {#if lastExpeditionResult.bonusRewards.goldEarned > 0}
                  <div class="bonus-item">
                    <span class="bonus-icon">💰</span>
                    <span class="bonus-value">+{lastExpeditionResult.bonusRewards.goldEarned} gold</span>
                  </div>
                {/if}
                {#if lastExpeditionResult.bonusRewards.itemsToAward && lastExpeditionResult.bonusRewards.itemsToAward.length > 0}
                  {#each lastExpeditionResult.bonusRewards.itemsToAward as item}
                    <div class="bonus-item">
                      <span class="bonus-icon">{item.emoji}</span>
                      <span class="bonus-value">{item.name}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </Card>
    </section>
  {/if}

  <section class="history-section">
    <h2>Recent Expeditions</h2>

    {#if $expeditionsData && $expeditionsData.length > 0}
      <div class="history-list">
        {#each getRecentExpeditions($expeditionsData) as expedition}
          <Card>
            <div class="history-item">
              <div class="history-date">
                {new Date(expedition.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div class="history-duration">{expedition.duration} min</div>
              <div class="history-xp">+{expedition.xpEarned} XP</div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="empty-history">
        <p>No expeditions recorded yet. Begin your first adventure!</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .expedition-page {
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

  .bonus-rewards {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }

  .bonus-rewards h4 {
    font-size: 0.875rem;
    color: var(--warning);
    margin-bottom: var(--spacing-sm);
    text-align: center;
  }

  .bonus-stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-md);
  }

  .bonus-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    background: var(--bg-secondary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
  }

  .bonus-icon {
    font-size: 1rem;
  }

  .bonus-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }
</style>
