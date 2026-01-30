<script>
  import { currentStreak, streakMultiplier, playerData } from '../../lib/stores/player.js';

  export let showMultiplier = true;
  export let size = 'md'; // sm, md, lg
</script>

<div class="streak-container size-{size}">
  <div class="streak-icon">🔥</div>
  <div class="streak-info">
    <span class="streak-count">{$currentStreak}</span>
    <span class="streak-label">day streak</span>
  </div>
  {#if showMultiplier && $streakMultiplier > 1}
    <div class="multiplier">
      {$streakMultiplier}x
    </div>
  {/if}
</div>

<style>
  .streak-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-tertiary);
    border-radius: var(--radius-lg);
  }

  .streak-icon {
    font-size: 1.25rem;
  }

  .size-sm .streak-icon { font-size: 1rem; }
  .size-lg .streak-icon { font-size: 1.5rem; }

  .streak-info {
    display: flex;
    flex-direction: column;
  }

  .streak-count {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--streak-color);
    line-height: 1;
  }

  .size-sm .streak-count { font-size: 0.875rem; }
  .size-lg .streak-count { font-size: 1.5rem; }

  .streak-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .size-sm .streak-label { font-size: 0.625rem; }

  .multiplier {
    padding: var(--spacing-xs) var(--spacing-sm);
    background-color: var(--streak-color);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: var(--radius-md);
  }

  .size-lg .multiplier {
    font-size: 0.875rem;
    padding: var(--spacing-sm) var(--spacing-md);
  }
</style>
