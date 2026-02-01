<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { BattleEngine } from '../../lib/game/battleEngine.js';
  import { recordBattle } from '../../lib/services/pvpService.js';
  import { addXP, addGold } from '../../lib/stores/player.js';
  import ProgressBar from '../common/ProgressBar.svelte';

  export let mySnapshot;
  export let opponent;

  const dispatch = createEventDispatcher();

  let engine = null;
  let battleState = null;
  let battleResult = null;
  let battleLog = [];
  let isAnimating = false;
  let currentLogIndex = 0;
  let autoPlay = false;
  let autoPlayInterval = null;

  onMount(() => {
    startBattle();
    return () => {
      if (autoPlayInterval) clearInterval(autoPlayInterval);
    };
  });

  function startBattle() {
    engine = new BattleEngine(mySnapshot, opponent);
    battleState = engine.getState();
    battleLog = [];
    battleResult = null;
    currentLogIndex = 0;
  }

  async function executeAction(action) {
    if (isAnimating || battleResult) return;

    isAnimating = true;

    const result = engine.executePlayerTurn(action);
    battleState = engine.getState();

    // Add new log entries with animation
    const newEntries = battleState.lastActions;
    for (const entry of newEntries) {
      if (!battleLog.find(e => e.message === entry.message)) {
        battleLog = [...battleLog, entry];
        await sleep(400);
      }
    }

    if (result) {
      battleResult = result;
      await handleBattleEnd(result);
    }

    isAnimating = false;
  }

  async function handleBattleEnd(result) {
    // Record battle and give rewards
    await recordBattle(opponent.user_id, result);

    if (result.won) {
      await addXP(result.xpReward);
      await addGold(result.goldReward);
    } else if (!result.isDraw) {
      // Still give consolation XP for losing
      await addXP(result.xpReward);
    }
  }

  function toggleAutoPlay() {
    autoPlay = !autoPlay;
    if (autoPlay) {
      autoPlayInterval = setInterval(() => {
        if (!battleResult && !isAnimating) {
          executeAction({ type: 'attack' });
        } else if (battleResult) {
          clearInterval(autoPlayInterval);
          autoPlay = false;
        }
      }, 800);
    } else {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getHpColor(current, max) {
    const percent = current / max;
    if (percent > 0.5) return 'success';
    if (percent > 0.25) return 'warning';
    return 'error';
  }

  function formatLogMessage(entry) {
    let msg = entry.message;
    if (entry.isCrit) {
      return `${msg}`;
    }
    return msg;
  }
</script>

<div class="battle-screen">
  <!-- Battle Header -->
  <div class="battle-header">
    <h2>PvP Battle</h2>
    {#if !battleResult}
      <span class="turn-indicator">Turn {battleState?.turn + 1 || 1}</span>
    {/if}
  </div>

  <!-- Fighters Display -->
  <div class="fighters">
    <!-- Player -->
    <div class="fighter player" class:defending={battleState?.challenger.isDefending}>
      <div class="fighter-name">{battleState?.challenger.name || 'You'}</div>
      <div class="fighter-hp">
        <ProgressBar
          value={battleState?.challenger.hp || 0}
          max={battleState?.challenger.maxHp || 100}
          size="lg"
          color={getHpColor(battleState?.challenger.hp || 0, battleState?.challenger.maxHp || 100)}
          showLabel
        />
      </div>
      {#if battleState?.challenger.isDefending}
        <span class="status-badge defending">Defending</span>
      {/if}
    </div>

    <div class="vs-divider">VS</div>

    <!-- Opponent -->
    <div class="fighter opponent" class:defending={battleState?.opponent.isDefending}>
      <div class="fighter-name">{battleState?.opponent.name || 'Enemy'}</div>
      <div class="fighter-hp">
        <ProgressBar
          value={battleState?.opponent.hp || 0}
          max={battleState?.opponent.maxHp || 100}
          size="lg"
          color={getHpColor(battleState?.opponent.hp || 0, battleState?.opponent.maxHp || 100)}
          showLabel
        />
      </div>
      {#if battleState?.opponent.isDefending}
        <span class="status-badge defending">Defending</span>
      {/if}
    </div>
  </div>

  <!-- Battle Log -->
  <div class="battle-log">
    {#each battleLog as entry, i}
      <div
        class="log-entry"
        class:crit={entry.isCrit}
        class:player-action={entry.attacker === battleState?.challenger.name}
      >
        <span class="log-message">{formatLogMessage(entry)}</span>
      </div>
    {/each}
    {#if battleLog.length === 0}
      <div class="log-placeholder">Battle begins!</div>
    {/if}
  </div>

  <!-- Battle Result -->
  {#if battleResult}
    <div class="battle-result" class:victory={battleResult.won} class:defeat={!battleResult.won && !battleResult.isDraw} class:draw={battleResult.isDraw}>
      <div class="result-banner">
        {#if battleResult.isDraw}
          <span class="result-text">Draw!</span>
        {:else if battleResult.won}
          <span class="result-text">Victory!</span>
        {:else}
          <span class="result-text">Defeat</span>
        {/if}
      </div>

      <div class="rewards">
        <div class="reward-item">
          <span class="reward-label">XP Earned</span>
          <span class="reward-value xp">+{battleResult.xpReward}</span>
        </div>
        {#if battleResult.goldReward > 0}
          <div class="reward-item">
            <span class="reward-label">Gold Earned</span>
            <span class="reward-value gold">+{battleResult.goldReward}</span>
          </div>
        {/if}
      </div>

      <div class="result-actions">
        <button class="btn-primary" on:click={() => dispatch('rematch', { opponent })}>
          Rematch
        </button>
        <button class="btn-secondary" on:click={() => dispatch('back')}>
          Back to Arena
        </button>
      </div>
    </div>
  {:else}
    <!-- Action Buttons -->
    <div class="actions">
      <button
        class="action-btn attack"
        on:click={() => executeAction({ type: 'attack' })}
        disabled={isAnimating}
      >
        Attack
      </button>

      <button
        class="action-btn power"
        on:click={() => executeAction({ type: 'power_attack' })}
        disabled={isAnimating}
      >
        Power Attack
      </button>

      <button
        class="action-btn defend"
        on:click={() => executeAction({ type: 'defend' })}
        disabled={isAnimating}
      >
        Defend
      </button>

      <button
        class="action-btn auto"
        class:active={autoPlay}
        on:click={toggleAutoPlay}
        disabled={isAnimating && !autoPlay}
      >
        {autoPlay ? 'Stop Auto' : 'Auto Battle'}
      </button>
    </div>
  {/if}

  <!-- Back Button (during battle) -->
  {#if !battleResult}
    <button class="flee-btn" on:click={() => dispatch('back')}>
      Flee (Forfeit)
    </button>
  {/if}
</div>

<style>
  .battle-screen {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .battle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .battle-header h2 {
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .turn-indicator {
    background: var(--bg-tertiary);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .fighters {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .fighter {
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    transition: all 0.3s ease;
  }

  .fighter.player {
    border-color: var(--accent);
  }

  .fighter.opponent {
    border-color: var(--error);
  }

  .fighter.defending {
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
  }

  .fighter-name {
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .fighter-hp {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vs-divider {
    text-align: center;
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--text-muted);
    padding: 4px 0;
  }

  .status-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .status-badge.defending {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .battle-log {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px;
    min-height: 150px;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 20px;
  }

  .log-entry {
    padding: 8px 10px;
    border-radius: 6px;
    margin-bottom: 6px;
    font-size: 0.9rem;
    animation: slideIn 0.3s ease;
  }

  .log-entry:last-child {
    margin-bottom: 0;
  }

  .log-entry.player-action {
    background: rgba(99, 102, 241, 0.1);
    border-left: 3px solid var(--accent);
  }

  .log-entry:not(.player-action) {
    background: rgba(239, 68, 68, 0.1);
    border-left: 3px solid var(--error);
  }

  .log-entry.crit {
    font-weight: 600;
  }

  .log-placeholder {
    text-align: center;
    color: var(--text-muted);
    padding: 40px;
    font-style: italic;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .action-btn {
    padding: 16px;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.attack {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .action-btn.power {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
  }

  .action-btn.defend {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
  }

  .action-btn.auto {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 2px solid var(--border);
  }

  .action-btn.auto.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .action-btn:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .flee-btn {
    display: block;
    width: 100%;
    padding: 12px;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .flee-btn:hover {
    color: var(--error);
    border-color: var(--error);
  }

  /* Battle Result */
  .battle-result {
    text-align: center;
    padding: 24px;
    border-radius: 16px;
    margin-bottom: 20px;
  }

  .battle-result.victory {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%);
    border: 2px solid #22c55e;
  }

  .battle-result.defeat {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%);
    border: 2px solid #ef4444;
  }

  .battle-result.draw {
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0.2) 100%);
    border: 2px solid #eab308;
  }

  .result-banner {
    margin-bottom: 20px;
  }

  .result-text {
    font-size: 2rem;
    font-weight: 700;
  }

  .victory .result-text {
    color: #22c55e;
  }

  .defeat .result-text {
    color: #ef4444;
  }

  .draw .result-text {
    color: #eab308;
  }

  .rewards {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 24px;
  }

  .reward-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .reward-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .reward-value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .reward-value.xp {
    color: var(--accent);
  }

  .reward-value.gold {
    color: #eab308;
  }

  .result-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .btn-primary {
    padding: 12px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .btn-secondary {
    padding: 12px 24px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>
