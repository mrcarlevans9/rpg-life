<script>
  import { onMount } from 'svelte';
  import { updateSnapshot, getMySnapshot, getPvpStats } from '../lib/services/pvpService.js';
  import OpponentSelect from '../components/multiplayer/OpponentSelect.svelte';
  import BattleScreen from '../components/multiplayer/BattleScreen.svelte';
  import FriendsBoard from '../components/multiplayer/FriendsBoard.svelte';
  import GuildPanel from '../components/multiplayer/GuildPanel.svelte';
  import Card from '../components/common/Card.svelte';

  let view = 'hub'; // hub, arena, battle, friends, guild
  let mySnapshot = null;
  let pvpStats = null;
  let selectedOpponent = null;
  let loading = true;

  onMount(async () => {
    await loadPlayerData();
  });

  async function loadPlayerData() {
    loading = true;
    try {
      // Update snapshot with latest stats
      const result = await updateSnapshot();
      if (result.success) {
        mySnapshot = result.snapshot;
      } else {
        mySnapshot = await getMySnapshot();
      }

      pvpStats = await getPvpStats();
    } catch (err) {
      console.error('Failed to load player data:', err);
    } finally {
      loading = false;
    }
  }

  function handleSelectOpponent(event) {
    selectedOpponent = event.detail.opponent;
    mySnapshot = event.detail.mySnapshot;
    view = 'battle';
  }

  function handleBattleBack() {
    selectedOpponent = null;
    view = 'arena';
    loadPlayerData(); // Refresh stats after battle
  }

  function handleRematch(event) {
    selectedOpponent = event.detail.opponent;
    // The BattleScreen will reinitialize with the same opponent
  }

  function handleChallengeFriend(event) {
    selectedOpponent = event.detail.opponent;
    view = 'battle';
  }
</script>

<div class="multiplayer-page">
  {#if view === 'hub'}
    <header class="page-header">
      <h1>Multiplayer</h1>
    </header>

    {#if loading}
      <div class="loading">Loading...</div>
    {:else}
      <!-- Player Stats Card -->
      {#if pvpStats}
        <Card>
          <div class="stats-card">
            <div class="stats-header">
              <span class="player-name">{mySnapshot?.username || 'Adventurer'}</span>
              <span class="player-level">Level {pvpStats.level}</span>
            </div>
            <div class="stats-row">
              <div class="stat-item">
                <span class="stat-value wins">{pvpStats.wins}</span>
                <span class="stat-label">Wins</span>
              </div>
              <div class="stat-item">
                <span class="stat-value losses">{pvpStats.losses}</span>
                <span class="stat-label">Losses</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{pvpStats.winRate}%</span>
                <span class="stat-label">Win Rate</span>
              </div>
            </div>
          </div>
        </Card>
      {/if}

      <!-- Menu Options -->
      <div class="menu-grid">
        <button class="menu-card arena" on:click={() => view = 'arena'}>
          <span class="menu-icon">Arena</span>
          <span class="menu-title">PvP Arena</span>
          <span class="menu-desc">Battle other players</span>
        </button>

        <button class="menu-card friends" on:click={() => view = 'friends'}>
          <span class="menu-icon">Friends</span>
          <span class="menu-title">Friends</span>
          <span class="menu-desc">Manage friendships</span>
        </button>

        <button class="menu-card guild" on:click={() => view = 'guild'}>
          <span class="menu-icon">Guild</span>
          <span class="menu-title">Guild</span>
          <span class="menu-desc">Join forces with allies</span>
        </button>

        <button class="menu-card leaderboard" on:click={() => alert('Coming soon!')}>
          <span class="menu-icon">Ranks</span>
          <span class="menu-title">Leaderboard</span>
          <span class="menu-desc">View top players</span>
        </button>
      </div>
    {/if}

  {:else if view === 'arena'}
    <OpponentSelect
      on:select={handleSelectOpponent}
      on:back={() => view = 'hub'}
    />

  {:else if view === 'battle' && selectedOpponent && mySnapshot}
    <BattleScreen
      {mySnapshot}
      opponent={selectedOpponent}
      on:back={handleBattleBack}
      on:rematch={handleRematch}
    />

  {:else if view === 'friends'}
    <FriendsBoard
      on:back={() => view = 'hub'}
      on:challenge={handleChallengeFriend}
    />

  {:else if view === 'guild'}
    <GuildPanel
      on:back={() => view = 'hub'}
    />
  {/if}
</div>

<style>
  .multiplayer-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 1.75rem;
    color: var(--text-primary);
  }

  .loading {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
  }

  /* Stats Card */
  .stats-card {
    padding: 8px;
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .player-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .player-level {
    background: var(--accent);
    color: white;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .stats-row {
    display: flex;
    justify-content: space-around;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-value.wins {
    color: var(--success);
  }

  .stat-value.losses {
    color: var(--error);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  /* Menu Grid */
  .menu-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 24px;
  }

  .menu-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .menu-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  .menu-card.arena {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .menu-card.arena:hover {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
  }

  .menu-card.friends {
    border-color: rgba(59, 130, 246, 0.3);
  }

  .menu-card.friends:hover {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }

  .menu-card.guild {
    border-color: rgba(234, 179, 8, 0.3);
  }

  .menu-card.guild:hover {
    border-color: #eab308;
    background: rgba(234, 179, 8, 0.05);
  }

  .menu-card.leaderboard {
    border-color: rgba(34, 197, 94, 0.3);
  }

  .menu-card.leaderboard:hover {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.05);
  }

  .menu-icon {
    font-size: 2rem;
  }

  .menu-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .menu-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  @media (max-width: 400px) {
    .menu-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
