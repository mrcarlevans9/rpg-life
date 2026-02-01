<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { getOpponents, getMySnapshot, updateSnapshot } from '../../lib/services/pvpService.js';
  import Card from '../common/Card.svelte';
  import ProgressBar from '../common/ProgressBar.svelte';

  const dispatch = createEventDispatcher();

  let opponents = [];
  let mySnapshot = null;
  let loading = true;
  let error = null;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      // Ensure our snapshot is up to date
      mySnapshot = await getMySnapshot();
      if (!mySnapshot) {
        // Create snapshot if doesn't exist
        const result = await updateSnapshot();
        if (result.success) {
          mySnapshot = result.snapshot;
        }
      }

      // Get available opponents
      opponents = await getOpponents(20);
    } catch (err) {
      console.error('Failed to load opponents:', err);
      error = 'Failed to load opponents. Please try again.';
    } finally {
      loading = false;
    }
  }

  function selectOpponent(opponent) {
    dispatch('select', { opponent, mySnapshot });
  }

  function getWinRate(wins, losses) {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  function getLevelDiff(opponentLevel) {
    if (!mySnapshot) return 0;
    return opponentLevel - mySnapshot.level;
  }

  function getDifficultyLabel(levelDiff) {
    if (levelDiff <= -5) return { text: 'Easy', class: 'easy' };
    if (levelDiff <= -2) return { text: 'Normal', class: 'normal' };
    if (levelDiff <= 2) return { text: 'Fair', class: 'fair' };
    if (levelDiff <= 5) return { text: 'Hard', class: 'hard' };
    return { text: 'Dangerous', class: 'dangerous' };
  }
</script>

<div class="opponent-select">
  <header class="header">
    <h1>Arena</h1>
    <p class="subtitle">Choose your opponent</p>
  </header>

  {#if mySnapshot}
    <Card>
      <div class="my-stats">
        <div class="my-info">
          <span class="my-name">{mySnapshot.username}</span>
          <span class="my-level">Lv. {mySnapshot.level}</span>
        </div>
        <div class="my-record">
          <span class="wins">{mySnapshot.wins || 0}W</span>
          <span class="separator">-</span>
          <span class="losses">{mySnapshot.losses || 0}L</span>
        </div>
      </div>
    </Card>
  {/if}

  {#if loading}
    <div class="loading">
      <span class="loading-icon">Loading opponents...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <p>{error}</p>
      <button class="retry-btn" on:click={loadData}>Retry</button>
    </div>
  {:else if opponents.length === 0}
    <div class="empty-state">
      <span class="empty-icon">No opponents found</span>
      <p>No opponents available in your level range.</p>
      <button class="retry-btn" on:click={loadData}>Refresh</button>
    </div>
  {:else}
    <div class="opponent-list">
      {#each opponents as opponent}
        {@const levelDiff = getLevelDiff(opponent.level)}
        {@const difficulty = getDifficultyLabel(levelDiff)}
        {@const winRate = getWinRate(opponent.wins || 0, opponent.losses || 0)}
        <button
          class="opponent-card"
          on:click={() => selectOpponent(opponent)}
        >
          <div class="opponent-header">
            <div class="opponent-info">
              <span class="opponent-name">{opponent.username}</span>
              {#if opponent.equipped_title && opponent.equipped_title !== 'rookie'}
                <span class="opponent-title">{opponent.equipped_title}</span>
              {/if}
            </div>
            <span class="difficulty-badge {difficulty.class}">{difficulty.text}</span>
          </div>

          <div class="opponent-stats">
            <div class="stat">
              <span class="stat-label">Level</span>
              <span class="stat-value">{opponent.level}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Win Rate</span>
              <span class="stat-value">{winRate}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Record</span>
              <span class="stat-value">{opponent.wins || 0}W - {opponent.losses || 0}L</span>
            </div>
          </div>

          <div class="opponent-combat">
            <div class="combat-stat">
              <span class="combat-icon">HP</span>
              <ProgressBar value={opponent.max_hp} max={200} size="sm" color="success" />
              <span class="combat-value">{opponent.max_hp}</span>
            </div>
            <div class="combat-stat">
              <span class="combat-icon">ATK</span>
              <ProgressBar value={opponent.attack} max={50} size="sm" color="warning" />
              <span class="combat-value">{opponent.attack}</span>
            </div>
            <div class="combat-stat">
              <span class="combat-icon">DEF</span>
              <ProgressBar value={opponent.defense} max={30} size="sm" color="accent" />
              <span class="combat-value">{opponent.defense}</span>
            </div>
          </div>

          <div class="fight-prompt">
            <span>Challenge</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <button class="back-btn" on:click={() => dispatch('back')}>
    Back
  </button>
</div>

<style>
  .opponent-select {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .header {
    text-align: center;
    margin-bottom: 20px;
  }

  .header h1 {
    font-size: 1.75rem;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .my-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
  }

  .my-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .my-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .my-level {
    background: var(--accent);
    color: white;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .my-record {
    display: flex;
    gap: 6px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .wins {
    color: var(--success);
  }

  .losses {
    color: var(--error);
  }

  .separator {
    color: var(--text-muted);
  }

  .loading, .error-state, .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
  }

  .retry-btn {
    margin-top: 16px;
    padding: 10px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }

  .opponent-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
  }

  .opponent-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
  }

  .opponent-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .opponent-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .opponent-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .opponent-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .opponent-title {
    font-size: 0.75rem;
    color: var(--accent);
    text-transform: capitalize;
  }

  .difficulty-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .difficulty-badge.easy {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .difficulty-badge.normal {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .difficulty-badge.fair {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .difficulty-badge.hard {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }

  .difficulty-badge.dangerous {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .opponent-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .opponent-combat {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .combat-stat {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .combat-icon {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    width: 28px;
    text-transform: uppercase;
  }

  .combat-value {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 30px;
    text-align: right;
  }

  .fight-prompt {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    text-align: center;
  }

  .fight-prompt span {
    color: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .back-btn {
    display: block;
    width: 100%;
    margin-top: 20px;
    padding: 14px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--bg-secondary);
  }
</style>
