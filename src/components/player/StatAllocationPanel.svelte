<script>
  import { createEventDispatcher } from 'svelte';
  import { STAT_CONFIG } from '../../lib/db/index.js';
  import {
    playerData,
    statBonuses,
    unspentStatPoints,
    allocateStatPoint,
    calculateStatBonus,
    currentLevel
  } from '../../lib/stores/player.js';
  import Card from '../common/Card.svelte';
  import Button from '../common/Button.svelte';

  const dispatch = createEventDispatcher();

  let allocating = null;

  // Preview allocations (before confirming)
  let pendingAllocations = {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  $: totalPending = Object.values(pendingAllocations).reduce((sum, v) => sum + v, 0);
  $: availablePoints = ($unspentStatPoints || 0) - totalPending;

  $: stats = $playerData?.stats || {
    vitality: 0,
    power: 0,
    arcana: 0,
    agility: 0,
    fortune: 0
  };

  function addPoint(statKey) {
    if (availablePoints <= 0) return;
    const config = STAT_CONFIG[statKey];
    const currentValue = stats[statKey] + pendingAllocations[statKey];
    if (config.hardCap && currentValue >= config.hardCap) return;
    pendingAllocations[statKey]++;
    pendingAllocations = pendingAllocations; // Trigger reactivity
  }

  function removePoint(statKey) {
    if (pendingAllocations[statKey] <= 0) return;
    pendingAllocations[statKey]--;
    pendingAllocations = pendingAllocations;
  }

  async function confirmAllocations() {
    if (totalPending === 0) return;

    allocating = true;
    try {
      for (const [statKey, points] of Object.entries(pendingAllocations)) {
        for (let i = 0; i < points; i++) {
          await allocateStatPoint(statKey);
        }
      }
      // Reset pending
      pendingAllocations = {
        vitality: 0,
        power: 0,
        arcana: 0,
        agility: 0,
        fortune: 0
      };
      dispatch('allocated');
    } finally {
      allocating = false;
    }
  }

  function resetPending() {
    pendingAllocations = {
      vitality: 0,
      power: 0,
      arcana: 0,
      agility: 0,
      fortune: 0
    };
  }

  function getEffectDisplay(statKey, currentValue, pendingValue) {
    const current = calculateStatBonus(statKey, currentValue);
    const preview = calculateStatBonus(statKey, currentValue + pendingValue);
    const config = STAT_CONFIG[statKey];

    if (statKey === 'vitality') {
      return pendingValue > 0
        ? `+${Math.floor(current)} HP → +${Math.floor(preview)} HP`
        : `+${Math.floor(current)} Max HP`;
    }
    if (statKey === 'power') {
      return pendingValue > 0
        ? `+${current.toFixed(1)} DMG → +${preview.toFixed(1)} DMG`
        : `+${current.toFixed(1)} Base Damage`;
    }
    if (statKey === 'arcana') {
      return pendingValue > 0
        ? `+${Math.floor(current)} MP → +${Math.floor(preview)} MP`
        : `+${Math.floor(current)} Max MP`;
    }
    if (statKey === 'agility') {
      return pendingValue > 0
        ? `${current.toFixed(1)}% → ${preview.toFixed(1)}% Dodge`
        : `${current.toFixed(1)}% Dodge`;
    }
    if (statKey === 'fortune') {
      return pendingValue > 0
        ? `+${Math.floor(current)}% → +${Math.floor(preview)}% Loot`
        : `+${Math.floor(current)}% Loot Rarity`;
    }
    return '';
  }

  function isAtCap(statKey) {
    const config = STAT_CONFIG[statKey];
    if (!config.hardCap) return false;
    return (stats[statKey] + pendingAllocations[statKey]) >= config.hardCap;
  }
</script>

<Card class="stat-panel">
  <div class="panel-header">
    <h3>Stat Allocation</h3>
    <div class="points-available" class:has-points={availablePoints > 0}>
      <span class="points-value">{availablePoints}</span>
      <span class="points-label">points</span>
    </div>
  </div>

  <div class="stats-list">
    {#each Object.entries(STAT_CONFIG) as [key, config]}
      {@const currentValue = stats[key] || 0}
      {@const pendingValue = pendingAllocations[key] || 0}
      {@const atCap = isAtCap(key)}
      <div class="stat-row" class:has-pending={pendingValue > 0}>
        <div class="stat-info">
          <span class="stat-icon">{config.icon}</span>
          <div class="stat-details">
            <span class="stat-name">{config.label}</span>
            <span class="stat-effect">{getEffectDisplay(key, currentValue, pendingValue)}</span>
          </div>
        </div>

        <div class="stat-controls">
          <button
            class="control-btn minus"
            on:click={() => removePoint(key)}
            disabled={pendingValue <= 0}
          >
            -
          </button>

          <span class="stat-value">
            {currentValue}
            {#if pendingValue > 0}
              <span class="pending-add">+{pendingValue}</span>
            {/if}
          </span>

          <button
            class="control-btn plus"
            on:click={() => addPoint(key)}
            disabled={availablePoints <= 0 || atCap}
          >
            +
          </button>
        </div>

        {#if config.hardCap}
          <div class="cap-indicator" class:at-cap={atCap}>
            {currentValue + pendingValue}/{config.hardCap}
          </div>
        {:else if config.softCap}
          <div class="cap-indicator" class:past-soft={(currentValue + pendingValue) > config.softCap}>
            {#if (currentValue + pendingValue) > config.softCap}
              DR active
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if totalPending > 0}
    <div class="action-buttons">
      <Button variant="secondary" size="sm" on:click={resetPending}>
        Reset
      </Button>
      <Button variant="primary" size="sm" on:click={confirmAllocations} disabled={allocating}>
        {allocating ? 'Allocating...' : `Confirm (${totalPending} points)`}
      </Button>
    </div>
  {/if}

  <div class="panel-footer">
    <span class="footer-text">Level {$currentLevel} • {$playerData?.totalStatPointsEarned || 0} total points earned</span>
    <button class="respec-link" on:click={() => dispatch('respec')}>
      Respec Stats
    </button>
  </div>
</Card>

<style>
  :global(.stat-panel) {
    padding: var(--spacing-md);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .panel-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .points-available {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .points-available.has-points {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.2));
    border: 1px solid rgba(99, 102, 241, 0.4);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  .points-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #6366f1;
  }

  .points-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .stat-row.has-pending {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.05);
  }

  .stat-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
  }

  .stat-icon {
    font-size: 1.25rem;
  }

  .stat-details {
    display: flex;
    flex-direction: column;
  }

  .stat-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .stat-effect {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .stat-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover:not(:disabled) {
    border-color: #6366f1;
    color: #6366f1;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn.plus:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.1);
  }

  .control-btn.minus:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .stat-value {
    min-width: 50px;
    text-align: center;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .pending-add {
    color: #22c55e;
    font-size: 0.85rem;
    margin-left: 2px;
  }

  .cap-indicator {
    font-size: 0.65rem;
    color: var(--text-muted);
    min-width: 50px;
    text-align: right;
  }

  .cap-indicator.at-cap {
    color: #f59e0b;
  }

  .cap-indicator.past-soft {
    color: #f59e0b;
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }

  .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border);
  }

  .footer-text {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .respec-link {
    background: none;
    border: none;
    color: #6366f1;
    font-size: 0.75rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .respec-link:hover {
    color: #8b5cf6;
  }
</style>
