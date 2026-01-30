<script>
  import { xpProgress, currentLevel } from '../../lib/stores/player.js';
  import ProgressBar from '../common/ProgressBar.svelte';

  export let showDetails = true;
  export let size = 'md';
</script>

<div class="xp-bar-container">
  {#if showDetails}
    <div class="xp-header">
      <span class="level">
        <span class="level-icon">★</span>
        Level {$currentLevel}
      </span>
      <span class="xp-text">
        {$xpProgress.currentXP} / {$xpProgress.xpNeeded} XP
      </span>
    </div>
  {/if}

  <ProgressBar
    value={$xpProgress.currentXP}
    max={$xpProgress.xpNeeded}
    {size}
    color="xp"
    animated={$xpProgress.percentage > 0}
  />

  {#if showDetails}
    <div class="xp-footer">
      <span class="total-xp">{$xpProgress.totalXP.toLocaleString()} total XP</span>
    </div>
  {/if}
</div>

<style>
  .xp-bar-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .xp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .level {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-weight: 600;
    color: var(--level-color);
  }

  .level-icon {
    font-size: 0.875rem;
  }

  .xp-text {
    font-size: 0.875rem;
    color: var(--xp-color);
    font-weight: 500;
  }

  .xp-footer {
    display: flex;
    justify-content: flex-end;
  }

  .total-xp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
