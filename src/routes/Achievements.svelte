<script>
  import Card from '../components/common/Card.svelte';
  import ProgressBar from '../components/common/ProgressBar.svelte';
  import { achievementsData, achievementCount } from '../lib/stores/achievements.js';

  function isUnlocked(achievement) {
    return achievement.unlockedAt !== null;
  }

  function getProgress(achievement) {
    if (!achievement.target) return 100;
    return Math.min(100, ((achievement.progress || 0) / achievement.target) * 100);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<div class="achievements-page">
  <header class="page-header">
    <h1>Achievements</h1>
    <div class="achievement-summary">
      <span class="trophy">🏆</span>
      <span class="count">{$achievementCount?.unlocked || 0} / {$achievementCount?.total || 0}</span>
    </div>
  </header>

  <section class="achievements-grid">
    {#if $achievementsData}
      {#each $achievementsData.sort((a, b) => {
        // Unlocked first, then by type
        if (isUnlocked(a) && !isUnlocked(b)) return -1;
        if (!isUnlocked(a) && isUnlocked(b)) return 1;
        return 0;
      }) as achievement}
        <Card>
          <div class="achievement-card" class:unlocked={isUnlocked(achievement)}>
            <div class="achievement-icon">
              {isUnlocked(achievement) ? achievement.icon : '🔒'}
            </div>

            <div class="achievement-content">
              <h3 class="achievement-name">{achievement.name}</h3>
              <p class="achievement-description">{achievement.description}</p>

              {#if achievement.target && !isUnlocked(achievement)}
                <div class="achievement-progress">
                  <ProgressBar
                    value={achievement.progress || 0}
                    max={achievement.target}
                    size="sm"
                    color="accent"
                  />
                  <span class="progress-text">
                    {achievement.progress || 0} / {achievement.target}
                  </span>
                </div>
              {/if}

              {#if isUnlocked(achievement)}
                <div class="achievement-unlocked">
                  <span class="unlocked-date">Unlocked {formatDate(achievement.unlockedAt)}</span>
                </div>
              {/if}
            </div>

            <div class="achievement-reward">
              <span class="reward-value">+{achievement.xpReward}</span>
              <span class="reward-label">XP</span>
            </div>
          </div>
        </Card>
      {/each}
    {/if}
  </section>
</div>

<style>
  .achievements-page {
    max-width: 800px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
  }

  .achievement-summary {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-secondary);
    border-radius: var(--radius-lg);
  }

  .trophy {
    font-size: 1.5rem;
  }

  .count {
    font-weight: 700;
    color: var(--level-color);
  }

  .achievements-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .achievement-card {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .achievement-card.unlocked {
    opacity: 1;
  }

  .achievement-icon {
    font-size: 2rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-tertiary);
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .unlocked .achievement-icon {
    background-color: var(--accent-light);
  }

  .achievement-content {
    flex: 1;
  }

  .achievement-name {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
  }

  .achievement-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .achievement-progress {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .progress-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .achievement-unlocked {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .unlocked-date {
    font-size: 0.75rem;
    color: var(--success);
  }

  .achievement-reward {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-sm);
    background-color: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .reward-value {
    font-weight: 700;
    color: var(--xp-color);
  }

  .reward-label {
    font-size: 0.625rem;
    color: var(--text-muted);
  }
</style>
