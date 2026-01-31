<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import {
    dungeonData,
    currentRun,
    gamePhase,
    combatLog,
    lastRoll,
    playerStats,
    currentMonster,
    combatState,
    startRun,
    playerAttack,
    playerDefend,
    usePotion,
    collectRewards,
    retreat,
    purchaseUpgrade
  } from '../lib/stores/dungeon.js';
  import { DUNGEON_UPGRADES } from '../lib/db/index.js';

  let showShop = false;
  let logContainer;

  // Auto-scroll combat log
  $: if (logContainer && $combatLog.length) {
    setTimeout(() => {
      logContainer.scrollTop = logContainer.scrollHeight;
    }, 50);
  }

  function getLogClass(type) {
    switch (type) {
      case 'damage': return 'log-damage';
      case 'enemy': return 'log-enemy';
      case 'heal': return 'log-heal';
      case 'crit': return 'log-crit';
      case 'victory': return 'log-victory';
      case 'death': return 'log-death';
      case 'boss': return 'log-boss';
      case 'treasure': return 'log-treasure';
      case 'floor': return 'log-floor';
      case 'block': return 'log-block';
      default: return 'log-info';
    }
  }

  function canRetreat() {
    if (!$currentRun) return false;
    // Can retreat if current floor is complete (all rooms done)
    const floor = $currentRun.floor;
    return floor.rooms.every(r => r.completed);
  }

  function getUpgradeStatus(upgrade) {
    if (!$dungeonData) return { purchased: false, available: false, locked: false };
    const purchased = $dungeonData.upgrades?.includes(upgrade.key);
    const hasPrereq = !upgrade.requires || $dungeonData.upgrades?.includes(upgrade.requires);
    const canAfford = $dungeonData.gold >= upgrade.cost;
    return {
      purchased,
      available: !purchased && hasPrereq && canAfford,
      locked: !purchased && !hasPrereq
    };
  }

  async function handlePurchase(upgradeKey) {
    const result = await purchaseUpgrade(upgradeKey);
    if (!result.success) {
      console.log('Purchase failed:', result.error);
    }
  }

  function getHpBarColor(hp, maxHp) {
    const pct = hp / maxHp;
    if (pct > 0.6) return 'var(--success)';
    if (pct > 0.3) return 'var(--warning)';
    return 'var(--danger)';
  }
</script>

<div class="dungeon-page">
  <div class="page-header">
    <h1>Dungeon</h1>
    {#if $gamePhase === 'idle'}
      <p class="subtitle">Descend into the depths and test your might</p>
    {/if}
  </div>

  <!-- Idle / Lobby State -->
  {#if $gamePhase === 'idle'}
    <div class="lobby">
      <Card class="stats-card">
        <div class="player-stats-grid">
          <div class="stat-item">
            <span class="stat-icon">🧪</span>
            <span class="stat-value">{$dungeonData?.healthPotions || 0}</span>
            <span class="stat-label">Potions</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🪙</span>
            <span class="stat-value">{$dungeonData?.gold || 0}</span>
            <span class="stat-label">Gold</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🏔️</span>
            <span class="stat-value">{$dungeonData?.highestFloor || 0}</span>
            <span class="stat-label">Best Floor</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💀</span>
            <span class="stat-value">{$dungeonData?.totalKills || 0}</span>
            <span class="stat-label">Monsters Slain</span>
          </div>
        </div>
      </Card>

      <Card class="dungeon-entrance">
        <div class="entrance-content">
          <div class="dungeon-icon">🏰</div>
          <h2>The Dark Dungeon</h2>
          <p>10 floors of danger await. Defeat the boss to claim glory!</p>
          <ul class="dungeon-info">
            <li>Start with {100 + ($dungeonData?.maxHpBonus || 0)} HP</li>
            <li>{$dungeonData?.healthPotions || 0} health potions available</li>
            <li>Retreat between floors to keep your gold</li>
            <li>Death means losing all gold from this run</li>
          </ul>
          <Button variant="primary" size="lg" on:click={startRun}>
            Enter Dungeon
          </Button>
        </div>
      </Card>

      <div class="lobby-actions">
        <Button variant="secondary" on:click={() => showShop = true}>
          Shop
        </Button>
      </div>
    </div>
  {/if}

  <!-- Combat State -->
  {#if $gamePhase === 'exploring'}
    <div class="combat-view">
      <!-- Player HUD -->
      <div class="hud" class:player-hit={$combatState.lastDamageToPlayer} class:player-defeated={$combatState.playerDefeated}>
        <div class="hud-left">
          <div class="hp-display">
            <span class="hp-label">HP</span>
            <div class="hp-bar-container" class:hp-flash={$combatState.lastDamageToPlayer}>
              <div
                class="hp-bar player-hp-bar"
                style="width: {($currentRun?.playerHp / $currentRun?.maxHp) * 100}%;
                       background: {getHpBarColor($currentRun?.playerHp, $currentRun?.maxHp)}"
              ></div>
              <div class="hp-bar-shine"></div>
            </div>
            <span class="hp-text">{$currentRun?.playerHp} / {$currentRun?.maxHp}</span>
            <!-- Player damage number -->
            {#if $combatState.lastDamageToPlayer}
              <div class="damage-number player-damage">
                -{$combatState.lastDamageToPlayer}
              </div>
            {/if}
          </div>
        </div>
        <div class="hud-center">
          <span class="floor-display">Floor {$currentRun?.currentFloor}</span>
        </div>
        <div class="hud-right">
          <div class="gold-display">
            <span class="gold-icon">🪙</span>
            <span class="gold-amount">{$currentRun?.goldCollected || 0}</span>
          </div>
          <div class="potion-display">
            <span class="potion-icon">🧪</span>
            <span class="potion-count">{$dungeonData?.healthPotions || 0}</span>
          </div>
        </div>
      </div>

      <!-- Monster Display -->
      {#if $currentMonster}
        <Card class="monster-card">
          <div
            class="monster-display"
            class:monster-hit={$combatState.lastDamageToEnemy}
            class:monster-defeated={$combatState.monsterDefeated}
            class:monster-attacking={$combatState.enemyAction === 'attack'}
          >
            <!-- Damage number floating above monster -->
            {#key $combatState.lastDamageToEnemy}
              {#if $combatState.lastDamageToEnemy}
                <div class="damage-number enemy-damage">
                  -{$combatState.lastDamageToEnemy}
                </div>
              {/if}
            {/key}

            <span class="monster-emoji">{$currentMonster.emoji}</span>
            <h3 class="monster-name">{$currentMonster.displayName}</h3>
            {#if $currentMonster.isBoss}
              <span class="boss-badge">BOSS</span>
            {/if}

            <!-- Enhanced HP Bar -->
            <div class="monster-hp-bar-container" class:hp-flash={$combatState.lastDamageToEnemy}>
              <div
                class="monster-hp-bar"
                style="width: {($currentMonster.currentHp / $currentMonster.maxHp) * 100}%"
              ></div>
              <div class="hp-bar-shine"></div>
            </div>
            <span class="monster-hp-text">{$currentMonster.currentHp} / {$currentMonster.maxHp}</span>

            <!-- Turn indicator -->
            <div class="turn-indicator" class:enemy-turn={$combatState.turn === 'enemy'}>
              {#if $combatState.turn === 'enemy'}
                <span class="turn-text">Enemy Turn</span>
              {:else if $combatState.turn === 'player' && !$combatState.isAnimating}
                <span class="turn-text your-turn">Your Turn</span>
              {/if}
            </div>
          </div>
        </Card>
      {/if}

      <!-- Player attack effect overlay -->
      {#if $combatState.playerAction === 'attack'}
        <div class="attack-effect">
          <div class="slash-effect"></div>
        </div>
      {/if}

      {#if $combatState.playerAction === 'defend'}
        <div class="defend-effect">
          <div class="shield-effect">🛡️</div>
        </div>
      {/if}

      <!-- Dice Display -->
      {#if $lastRoll}
        <div class="dice-display">
          {#each $lastRoll.rolls as roll}
            <div class="die" class:critical={$lastRoll.critical}>{roll}</div>
          {/each}
          {#if $lastRoll.critical}
            <span class="crit-text">CRITICAL!</span>
          {/if}
        </div>
      {/if}

      <!-- Combat Log -->
      <div class="combat-log" bind:this={logContainer}>
        {#each $combatLog as log}
          <p class="log-entry {getLogClass(log.type)}">{log.message}</p>
        {/each}
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        {#if $currentMonster}
          <Button
            variant="danger"
            size="lg"
            on:click={playerAttack}
            disabled={$combatState.isAnimating}
          >
            <span class="btn-icon">⚔️</span> Attack
          </Button>
          <Button
            variant="secondary"
            size="lg"
            on:click={playerDefend}
            disabled={$combatState.isAnimating}
          >
            <span class="btn-icon">🛡️</span> Defend
          </Button>
        {/if}
        <Button
          variant="outline"
          on:click={usePotion}
          disabled={!$dungeonData?.healthPotions || $currentRun?.playerHp >= $currentRun?.maxHp || $combatState.isAnimating}
        >
          <span class="btn-icon">🧪</span> Potion ({$dungeonData?.healthPotions || 0})
        </Button>
        {#if canRetreat()}
          <Button variant="warning" on:click={retreat} disabled={$combatState.isAnimating}>
            <span class="btn-icon">🏃</span> Retreat
          </Button>
        {/if}
      </div>

      <!-- Room Progress -->
      <div class="room-progress">
        {#each $currentRun?.floor?.rooms || [] as room, i}
          <div
            class="room-dot"
            class:current={i === $currentRun?.floor?.currentRoom}
            class:completed={room.completed}
            class:combat={room.type === 'combat' || room.type === 'boss'}
            class:treasure={room.type === 'treasure'}
            class:shrine={room.type === 'shrine'}
          >
            {#if room.type === 'boss'}👑
            {:else if room.type === 'treasure'}💎
            {:else if room.type === 'shrine'}✨
            {:else}⚔️{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Victory State -->
  {#if $gamePhase === 'victory'}
    <Card class="result-card victory">
      <div class="result-content">
        <span class="result-icon">🏆</span>
        <h2>Victory!</h2>
        <p>You conquered the dungeon!</p>
        <div class="result-stats">
          <div class="result-stat">
            <span class="stat-label">Gold Earned</span>
            <span class="stat-value">🪙 {$currentRun?.goldCollected || 0}</span>
          </div>
          <div class="result-stat">
            <span class="stat-label">Monsters Slain</span>
            <span class="stat-value">💀 {$currentRun?.monstersKilled || 0}</span>
          </div>
          <div class="result-stat">
            <span class="stat-label">Potions Used</span>
            <span class="stat-value">🧪 {$currentRun?.potionsUsed || 0}</span>
          </div>
        </div>
        <Button variant="primary" size="lg" on:click={collectRewards}>
          Collect Rewards
        </Button>
      </div>
    </Card>
  {/if}

  <!-- Defeat State -->
  {#if $gamePhase === 'defeat'}
    <Card class="result-card defeat">
      <div class="result-content">
        <span class="result-icon">💀</span>
        <h2>Defeated</h2>
        <p>You fell on Floor {$currentRun?.currentFloor}...</p>
        <div class="result-stats">
          <div class="result-stat lost">
            <span class="stat-label">Gold Lost</span>
            <span class="stat-value">🪙 {$currentRun?.goldCollected || 0}</span>
          </div>
          <div class="result-stat">
            <span class="stat-label">Monsters Slain</span>
            <span class="stat-value">💀 {$currentRun?.monstersKilled || 0}</span>
          </div>
        </div>
        <Button variant="secondary" size="lg" on:click={() => { currentRun.set(null); gamePhase.set('idle'); }}>
          Return to Entrance
        </Button>
      </div>
    </Card>
  {/if}

  <!-- Shop Modal -->
  {#if showShop}
    <div class="modal-overlay" on:click={() => showShop = false}>
      <div class="shop-modal" on:click|stopPropagation>
        <div class="shop-header">
          <h2>Dungeon Shop</h2>
          <span class="shop-gold">🪙 {$dungeonData?.gold || 0}</span>
          <button class="close-btn" on:click={() => showShop = false}>×</button>
        </div>
        <div class="shop-content">
          {#each DUNGEON_UPGRADES as upgrade}
            {@const status = getUpgradeStatus(upgrade)}
            <div class="upgrade-item" class:purchased={status.purchased} class:locked={status.locked}>
              <div class="upgrade-info">
                <h4>{upgrade.name}</h4>
                <p>{upgrade.description}</p>
                {#if upgrade.requires}
                  <span class="requires">Requires: {DUNGEON_UPGRADES.find(u => u.key === upgrade.requires)?.name}</span>
                {/if}
              </div>
              <div class="upgrade-action">
                {#if status.purchased}
                  <span class="purchased-badge">Owned</span>
                {:else if status.locked}
                  <span class="locked-badge">🔒</span>
                {:else}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!status.available}
                    on:click={() => handlePurchase(upgrade.key)}
                  >
                    🪙 {upgrade.cost}
                  </Button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dungeon-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 var(--spacing-md);
  }

  .page-header {
    text-align: center;
    margin-bottom: var(--spacing-lg);
  }

  .page-header h1 {
    font-size: 1.75rem;
    margin-bottom: var(--spacing-xs);
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  /* Lobby Styles */
  .lobby {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .player-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-md);
    text-align: center;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .entrance-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  .dungeon-icon {
    font-size: 4rem;
  }

  .dungeon-info {
    text-align: left;
    color: var(--text-muted);
    font-size: 0.875rem;
    padding-left: var(--spacing-lg);
  }

  .dungeon-info li {
    margin-bottom: var(--spacing-xs);
  }

  .lobby-actions {
    display: flex;
    justify-content: center;
  }

  /* Combat View Styles */
  .combat-view {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .hp-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .hp-label {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .hp-bar-container {
    width: 100px;
    height: 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .hp-bar {
    height: 100%;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .hp-text {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .floor-display {
    font-weight: 700;
    font-size: 1rem;
    color: var(--accent);
  }

  .hud-right {
    display: flex;
    gap: var(--spacing-md);
  }

  .gold-display, .potion-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .gold-amount, .potion-count {
    font-weight: 600;
  }

  /* Monster Display */
  .monster-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-lg);
    gap: var(--spacing-sm);
    position: relative;
    transition: transform 0.1s ease;
  }

  .monster-display.monster-hit {
    animation: monsterHit 0.4s ease-out;
  }

  .monster-display.monster-defeated {
    animation: monsterDefeat 0.8s ease-out forwards;
  }

  .monster-display.monster-attacking {
    animation: monsterAttackAnim 0.5s ease-out;
  }

  @keyframes monsterHit {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
    20%, 40%, 60%, 80% { transform: translateX(8px); }
  }

  @keyframes monsterDefeat {
    0% { transform: scale(1); opacity: 1; filter: brightness(1); }
    30% { transform: scale(1.1); filter: brightness(2); }
    100% { transform: scale(0) rotate(180deg); opacity: 0; filter: brightness(0); }
  }

  @keyframes monsterAttackAnim {
    0% { transform: translateY(0) scale(1); }
    30% { transform: translateY(-20px) scale(1.1); }
    60% { transform: translateY(10px) scale(0.95); }
    100% { transform: translateY(0) scale(1); }
  }

  .monster-emoji {
    font-size: 4rem;
    animation: monsterBounce 1s ease-in-out infinite;
    transition: filter 0.2s ease;
  }

  .monster-hit .monster-emoji {
    filter: brightness(2) saturate(0);
    animation: none;
  }

  @keyframes monsterBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  .monster-name {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .boss-badge {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1a1a1a;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 700;
    animation: bossPulse 2s ease-in-out infinite;
  }

  @keyframes bossPulse {
    0%, 100% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.5); }
    50% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.8); }
  }

  .monster-hp-bar-container {
    width: 200px;
    height: 16px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
    position: relative;
    border: 2px solid var(--border);
  }

  .monster-hp-bar-container.hp-flash {
    animation: hpFlash 0.3s ease-out;
  }

  @keyframes hpFlash {
    0%, 100% { border-color: var(--border); }
    50% { border-color: var(--danger); box-shadow: 0 0 10px var(--danger); }
  }

  .monster-hp-bar {
    height: 100%;
    background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
    transition: width 0.4s ease-out;
    position: relative;
  }

  .hp-bar-shine {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%);
    pointer-events: none;
  }

  .monster-hp-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  /* Turn Indicator */
  .turn-indicator {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .turn-text {
    color: var(--text-muted);
  }

  .turn-text.your-turn {
    color: var(--success);
    animation: turnPulse 1s ease-in-out infinite;
  }

  .turn-indicator.enemy-turn .turn-text {
    color: var(--danger);
    animation: turnPulse 0.5s ease-in-out infinite;
  }

  @keyframes turnPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Damage Numbers */
  .damage-number {
    position: absolute;
    font-size: 1.5rem;
    font-weight: 800;
    text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
    pointer-events: none;
    z-index: 10;
  }

  .enemy-damage {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    color: #fbbf24;
    animation: damageFloat 0.6s ease-out forwards;
  }

  .player-damage {
    color: var(--danger);
    animation: damageFloat 0.6s ease-out forwards;
    margin-left: var(--spacing-sm);
  }

  @keyframes damageFloat {
    0% {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1.5);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-40px) scale(1);
    }
  }

  /* Attack Effect Overlay */
  .attack-effect {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slash-effect {
    width: 200px;
    height: 200px;
    background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%);
    animation: slashAnim 0.3s ease-out forwards;
  }

  @keyframes slashAnim {
    0% {
      transform: rotate(-45deg) scale(0) translateX(-100px);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(-45deg) scale(2) translateX(100px);
      opacity: 0;
    }
  }

  /* Defend Effect */
  .defend-effect {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 200px;
  }

  .shield-effect {
    font-size: 4rem;
    animation: shieldAnim 0.5s ease-out forwards;
  }

  @keyframes shieldAnim {
    0% {
      transform: scale(0) rotate(-20deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.2) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 0.7;
    }
  }

  /* Player HUD animations */
  .hud.player-hit {
    animation: hudShake 0.4s ease-out;
  }

  .hud.player-defeated {
    animation: hudDefeat 0.8s ease-out;
  }

  @keyframes hudShake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }

  @keyframes hudDefeat {
    0% { filter: brightness(1); }
    50% { filter: brightness(0.5) saturate(0); }
    100% { filter: brightness(0.3) saturate(0); }
  }

  .player-hp-bar {
    transition: width 0.4s ease-out;
  }

  /* Button icons */
  .btn-icon {
    margin-right: var(--spacing-xs);
  }

  /* Dice Display */
  .dice-display {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .die {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 1.5rem;
    font-weight: 700;
    animation: diceRoll 0.3s ease-out;
  }

  .die.critical {
    border-color: var(--warning);
    background: var(--warning);
    color: #1a1a1a;
    animation: diceCrit 0.5s ease-out;
  }

  @keyframes diceRoll {
    0% { transform: rotate(-10deg) scale(1.2); }
    100% { transform: rotate(0) scale(1); }
  }

  @keyframes diceCrit {
    0% { transform: rotate(-20deg) scale(1.5); }
    50% { transform: rotate(10deg) scale(1.3); }
    100% { transform: rotate(0) scale(1); }
  }

  .crit-text {
    color: var(--warning);
    font-weight: 700;
    animation: critPulse 0.5s ease-out;
  }

  @keyframes critPulse {
    0% { transform: scale(1.5); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Combat Log */
  .combat-log {
    height: 150px;
    overflow-y: auto;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .log-entry {
    margin-bottom: var(--spacing-xs);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .log-damage { color: var(--success); }
  .log-enemy { color: var(--danger); }
  .log-heal { color: #22c55e; }
  .log-crit { color: var(--warning); font-weight: 700; }
  .log-victory { color: var(--success); font-weight: 700; }
  .log-death { color: var(--danger); font-weight: 700; }
  .log-boss { color: #f59e0b; font-weight: 700; }
  .log-treasure { color: #fbbf24; }
  .log-floor { color: var(--accent); font-weight: 600; }
  .log-block { color: #60a5fa; }
  .log-info { color: var(--text-muted); }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  /* Room Progress */
  .room-progress {
    display: flex;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .room-dot {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    background: var(--bg-tertiary);
    font-size: 0.875rem;
    transition: all 0.3s ease;
  }

  .room-dot.current {
    border: 2px solid var(--accent);
    transform: scale(1.2);
  }

  .room-dot.completed {
    opacity: 0.5;
  }

  /* Result Cards */
  :global(.result-card) {
    padding: var(--spacing-xl);
  }

  .result-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-md);
  }

  .result-icon {
    font-size: 4rem;
  }

  :global(.result-card.victory) {
    border: 2px solid var(--success);
  }

  :global(.result-card.defeat) {
    border: 2px solid var(--danger);
  }

  .result-stats {
    display: flex;
    gap: var(--spacing-xl);
  }

  .result-stat {
    text-align: center;
  }

  .result-stat .stat-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-xs);
  }

  .result-stat .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .result-stat.lost .stat-value {
    color: var(--danger);
    text-decoration: line-through;
  }

  /* Shop Modal */
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

  .shop-modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .shop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border);
  }

  .shop-header h2 {
    font-size: 1.25rem;
  }

  .shop-gold {
    font-weight: 700;
    color: #fbbf24;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .shop-content {
    padding: var(--spacing-md);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .upgrade-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .upgrade-item.purchased {
    opacity: 0.6;
  }

  .upgrade-item.locked {
    opacity: 0.4;
  }

  .upgrade-info h4 {
    margin-bottom: var(--spacing-xs);
  }

  .upgrade-info p {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .upgrade-info .requires {
    font-size: 0.75rem;
    color: var(--warning);
  }

  .purchased-badge {
    color: var(--success);
    font-size: 0.875rem;
  }

  .locked-badge {
    font-size: 1.25rem;
  }
</style>
