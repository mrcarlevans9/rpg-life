<script>
  import { createEventDispatcher } from 'svelte';
  import { STAT_CONFIG } from '../../lib/db/index.js';
  import {
    playerData,
    currentLevel,
    respecStats,
    getRespecCost
  } from '../../lib/stores/player.js';
  import Button from '../common/Button.svelte';

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = '';

  $: respecCost = getRespecCost($currentLevel || 1);
  $: playerGold = $playerData?.gold || 0;
  $: canAfford = playerGold >= respecCost;

  $: stats = $playerData?.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  $: totalAllocated = Object.values(stats).reduce((sum, v) => sum + v, 0);

  async function handleRespec() {
    if (!canAfford || totalAllocated === 0) return;

    loading = true;
    error = '';

    try {
      const result = await respecStats();
      if (result.success) {
        dispatch('respecced', {
          pointsRefunded: result.pointsRefunded,
          goldSpent: result.goldSpent
        });
        dispatch('close');
      } else {
        error = result.error || 'Failed to respec';
      }
    } catch (err) {
      error = err.message || 'An error occurred';
    } finally {
      loading = false;
    }
  }

  function close() {
    dispatch('close');
  }
</script>

<div class="modal-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Reset Stats</h2>
      <button class="close-btn" on:click={close}>&times;</button>
    </div>

    <div class="modal-body">
      {#if totalAllocated === 0}
        <p class="no-stats">You haven't allocated any stat points yet.</p>
      {:else}
        <p class="description">
          Reset all your stat points and get them back to reallocate.
          This costs gold based on your level.
        </p>

        <div class="current-stats">
          <h4>Current Stats</h4>
          <div class="stats-grid">
            {#each Object.entries(STAT_CONFIG) as [key, config]}
              {#if stats[key] > 0}
                <div class="stat-item">
                  <span class="stat-icon">{config.icon}</span>
                  <span class="stat-label">{config.label}</span>
                  <span class="stat-value">{stats[key]}</span>
                </div>
              {/if}
            {/each}
          </div>
          <p class="total-points">Total: {totalAllocated} points will be refunded</p>
        </div>

        <div class="cost-section">
          <div class="cost-row">
            <span class="cost-label">Respec Cost:</span>
            <span class="cost-value">
              <span class="gold-icon">🪙</span>
              {respecCost}
            </span>
          </div>
          <div class="cost-row">
            <span class="cost-label">Your Gold:</span>
            <span class="cost-value" class:insufficient={!canAfford}>
              <span class="gold-icon">🪙</span>
              {playerGold}
            </span>
          </div>
          {#if !canAfford}
            <p class="insufficient-warning">
              You need {respecCost - playerGold} more gold to respec.
            </p>
          {/if}
        </div>

        {#if error}
          <p class="error-message">{error}</p>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <Button variant="secondary" on:click={close}>Cancel</Button>
      {#if totalAllocated > 0}
        <Button
          variant="danger"
          on:click={handleRespec}
          disabled={!canAfford || loading}
        >
          {loading ? 'Resetting...' : `Reset Stats (${respecCost} Gold)`}
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-md);
  }

  .modal-content {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    max-width: 400px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: var(--spacing-md);
  }

  .description {
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
    font-size: 0.9rem;
  }

  .no-stats {
    text-align: center;
    color: var(--text-muted);
    padding: var(--spacing-lg);
  }

  .current-stats {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .current-stats h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-xs);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .stat-icon {
    font-size: 1rem;
  }

  .stat-label {
    flex: 1;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat-value {
    font-weight: 700;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .total-points {
    margin: var(--spacing-sm) 0 0 0;
    font-size: 0.8rem;
    color: #22c55e;
    text-align: center;
  }

  .cost-section {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xs);
  }

  .cost-row:last-of-type {
    margin-bottom: 0;
  }

  .cost-label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .cost-value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    color: #fbbf24;
  }

  .cost-value.insufficient {
    color: #ef4444;
  }

  .gold-icon {
    font-size: 1rem;
  }

  .insufficient-warning {
    margin: var(--spacing-sm) 0 0 0;
    font-size: 0.8rem;
    color: #ef4444;
    text-align: center;
  }

  .error-message {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-sm);
    color: #ef4444;
    font-size: 0.85rem;
    text-align: center;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border-top: 1px solid var(--border);
  }
</style>
