<script>
  export let value = 0;
  export let max = 100;
  export let size = 'md'; // sm, md, lg
  export let color = 'accent'; // accent, success, warning, xp, level
  export let showLabel = false;
  export let animated = false;

  $: percentage = Math.min(100, Math.max(0, (value / max) * 100));
</script>

<div class="progress-container size-{size}">
  <div class="progress-bar">
    <div
      class="progress-fill color-{color}"
      class:animated
      style="width: {percentage}%"
    />
  </div>
  {#if showLabel}
    <span class="progress-label">{value}/{max}</span>
  {/if}
</div>

<style>
  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
  }

  .progress-bar {
    flex: 1;
    background-color: var(--bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .size-sm .progress-bar { height: 4px; }
  .size-md .progress-bar { height: 8px; }
  .size-lg .progress-bar { height: 12px; }

  .progress-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width var(--transition-normal);
  }

  .animated {
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
    );
    background-size: 1rem 1rem;
    animation: stripes 1s linear infinite;
  }

  .color-accent { background-color: var(--accent); }
  .color-success { background-color: var(--success); }
  .color-warning { background-color: var(--warning); }
  .color-xp { background-color: var(--xp-color); }
  .color-level { background-color: var(--level-color); }

  .progress-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    min-width: 4rem;
    text-align: right;
  }

  @keyframes stripes {
    from { background-position: 1rem 0; }
    to { background-position: 0 0; }
  }
</style>
