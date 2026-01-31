<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import {
    dungeonData,
    currentRun,
    gamePhase,
    currentMessage,
    lastRoll,
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

  <!-- Combat State - Pokemon-style compact layout -->
  {#if $gamePhase === 'exploring'}
    <div class="battle-screen" class:screen-shake={$combatState.lastDamageToPlayer}>
      <!-- Battle Arena -->
      <div class="battle-arena">
        <!-- Enemy Side (top right) -->
        {#if $currentMonster}
          <div class="enemy-side">
            <div class="enemy-info-box">
              <div class="enemy-name-row">
                <span class="enemy-name">{$currentMonster.displayName}</span>
                {#if $currentMonster.isBoss}
                  <span class="boss-tag">BOSS</span>
                {/if}
              </div>
              <div class="enemy-hp-row">
                <span class="hp-label">HP</span>
                <div class="hp-bar-wrapper" class:hp-flash={$combatState.lastDamageToEnemy}>
                  <div
                    class="hp-bar-fill enemy-hp"
                    style="width: {($currentMonster.currentHp / $currentMonster.maxHp) * 100}%"
                  ></div>
                </div>
              </div>
              <span class="hp-numbers">{$currentMonster.currentHp}/{$currentMonster.maxHp}</span>
            </div>

            <!-- Enemy sprite -->
            <div
              class="enemy-sprite"
              class:sprite-hit={$combatState.lastDamageToEnemy}
              class:sprite-attack={$combatState.enemyAction === 'attack'}
              class:sprite-defeated={$combatState.monsterDefeated}
            >
              <span class="sprite-emoji">{$currentMonster.emoji}</span>
              {#key $combatState.lastDamageToEnemy}
                {#if $combatState.lastDamageToEnemy}
                  <div class="floating-damage">-{$combatState.lastDamageToEnemy}</div>
                {/if}
              {/key}
            </div>
          </div>
        {/if}

        <!-- Player Side (bottom) -->
        <div class="player-side">
          <div class="player-info-box">
            <div class="player-name-row">
              <span class="player-name">You</span>
              <span class="floor-tag">F{$currentRun?.currentFloor}</span>
            </div>
            <div class="player-hp-row">
              <span class="hp-label">HP</span>
              <div class="hp-bar-wrapper" class:hp-flash={$combatState.lastDamageToPlayer}>
                <div
                  class="hp-bar-fill player-hp"
                  style="width: {($currentRun?.playerHp / $currentRun?.maxHp) * 100}%;
                         background: {getHpBarColor($currentRun?.playerHp, $currentRun?.maxHp)}"
                ></div>
              </div>
            </div>
            <div class="hp-numbers-row">
              <span class="hp-numbers">{$currentRun?.playerHp}/{$currentRun?.maxHp}</span>
              {#key $combatState.lastDamageToPlayer}
                {#if $combatState.lastDamageToPlayer}
                  <span class="damage-taken">-{$combatState.lastDamageToPlayer}</span>
                {/if}
              {/key}
            </div>
          </div>
        </div>

        <!-- Visual Effects -->
        {#if $combatState.playerAction === 'attack'}
          <div class="battle-effect slash"></div>
        {/if}
        {#if $combatState.playerAction === 'defend'}
          <div class="battle-effect shield">🛡️</div>
        {/if}
      </div>

      <!-- Message Box (Pokemon-style) -->
      <div class="message-box">
        <p class="message-text">{$currentMessage || 'What will you do?'}</p>
      </div>

      <!-- Action Panel -->
      <div class="action-panel">
        <!-- Dice display (compact) -->
        {#if $lastRoll && $combatState.isAnimating}
          <div class="dice-row">
            {#each $lastRoll.rolls as roll}
              <span class="mini-die" class:crit={$lastRoll.critical}>{roll}</span>
            {/each}
            {#if $lastRoll.critical}
              <span class="crit-badge">CRIT!</span>
            {/if}
          </div>
        {:else}
          <!-- Action Buttons -->
          <div class="action-grid">
            {#if $currentMonster}
              <button
                class="action-btn attack"
                on:click={playerAttack}
                disabled={$combatState.isAnimating}
              >
                ⚔️ FIGHT
              </button>
              <button
                class="action-btn defend"
                on:click={playerDefend}
                disabled={$combatState.isAnimating}
              >
                🛡️ DEFEND
              </button>
            {/if}
            <button
              class="action-btn item"
              on:click={usePotion}
              disabled={!$dungeonData?.healthPotions || $currentRun?.playerHp >= $currentRun?.maxHp || $combatState.isAnimating}
            >
              🧪 POTION <span class="item-count">({$dungeonData?.healthPotions || 0})</span>
            </button>
            {#if canRetreat()}
              <button
                class="action-btn run"
                on:click={retreat}
                disabled={$combatState.isAnimating}
              >
                🏃 RUN
              </button>
            {:else}
              <div class="action-btn placeholder">
                <span class="gold-display">🪙 {$currentRun?.goldCollected || 0}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Room Progress (minimal) -->
      <div class="room-dots">
        {#each $currentRun?.floor?.rooms || [] as room, i}
          <span
            class="dot"
            class:active={i === $currentRun?.floor?.currentRoom}
            class:done={room.completed}
          ></span>
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

  /* ========== POKEMON-STYLE BATTLE SCREEN ========== */
  .battle-screen {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 180px);
    max-height: 500px;
    background: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
    border-radius: var(--radius-lg);
    overflow: hidden;
    position: relative;
  }

  .battle-screen.screen-shake {
    animation: screenShake 0.3s ease-out;
  }

  @keyframes screenShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }

  /* Battle Arena */
  .battle-arena {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--spacing-md);
    position: relative;
    min-height: 200px;
  }

  /* Enemy Side (top) */
  .enemy-side {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .enemy-info-box {
    background: var(--bg-primary);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    min-width: 140px;
  }

  .enemy-name-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-bottom: 4px;
  }

  .enemy-name {
    font-weight: 700;
    font-size: 0.875rem;
  }

  .boss-tag {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1a1a1a;
    font-size: 0.5rem;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-weight: 700;
  }

  .enemy-hp-row, .player-hp-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .hp-label {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .hp-bar-wrapper {
    flex: 1;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .hp-bar-wrapper.hp-flash {
    animation: hpFlash 0.3s ease-out;
  }

  @keyframes hpFlash {
    0%, 100% { border-color: var(--border); }
    50% { border-color: #ef4444; box-shadow: 0 0 8px #ef4444; }
  }

  .hp-bar-fill {
    height: 100%;
    transition: width 0.4s ease-out;
  }

  .hp-bar-fill.enemy-hp {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .hp-bar-fill.player-hp {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .hp-numbers {
    font-size: 0.625rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Sprites */
  .enemy-sprite {
    position: relative;
  }

  .sprite-emoji {
    font-size: 3rem;
    display: block;
    animation: spriteBounce 2s ease-in-out infinite;
  }

  @keyframes spriteBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .sprite-hit {
    animation: spriteHit 0.3s ease-out !important;
  }

  .sprite-hit .sprite-emoji {
    animation: none;
    filter: brightness(2) saturate(0);
  }

  @keyframes spriteHit {
    0%, 100% { transform: translateX(0); }
    25%, 75% { transform: translateX(-6px); }
    50% { transform: translateX(6px); }
  }

  .sprite-attack {
    animation: spriteAttack 0.4s ease-out !important;
  }

  @keyframes spriteAttack {
    0% { transform: translate(0, 0); }
    40% { transform: translate(-20px, 15px) scale(1.1); }
    100% { transform: translate(0, 0); }
  }

  .sprite-defeated {
    animation: spriteDefeat 0.8s ease-out forwards !important;
  }

  .sprite-defeated .sprite-emoji {
    animation: none;
  }

  @keyframes spriteDefeat {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); filter: brightness(2); }
    100% { transform: scale(0) rotate(180deg); opacity: 0; }
  }

  /* Floating Damage */
  .floating-damage {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 1.25rem;
    font-weight: 800;
    color: #fbbf24;
    text-shadow: 2px 2px 0 #000;
    animation: floatUp 0.6s ease-out forwards;
    z-index: 10;
  }

  @keyframes floatUp {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.3); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(1); }
  }

  /* Player Side (bottom) */
  .player-side {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }

  .player-info-box {
    background: var(--bg-primary);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    min-width: 160px;
  }

  .hp-numbers-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }

  .damage-taken {
    font-size: 0.875rem;
    font-weight: 700;
    color: #ef4444;
    animation: damageFlash 0.5s ease-out;
  }

  @keyframes damageFlash {
    0% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }

  .player-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .player-name {
    font-weight: 700;
    font-size: 0.875rem;
  }

  .floor-tag {
    background: var(--accent);
    color: white;
    font-size: 0.5rem;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-weight: 700;
  }

  /* Battle Effects */
  .battle-effect {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 20;
  }

  .battle-effect.slash {
    width: 100px;
    height: 100px;
    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.9) 50%, transparent 70%);
    animation: slashEffect 0.25s ease-out forwards;
  }

  @keyframes slashEffect {
    0% { transform: translate(-50%, -50%) rotate(-45deg) scale(0); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translate(-50%, -50%) rotate(-45deg) scale(2); opacity: 0; }
  }

  .battle-effect.shield {
    font-size: 3rem;
    animation: shieldEffect 0.4s ease-out forwards;
  }

  @keyframes shieldEffect {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  }

  /* Message Box (Pokemon-style) */
  .message-box {
    background: var(--bg-primary);
    border-top: 3px solid var(--border);
    padding: var(--spacing-md) var(--spacing-lg);
    min-height: 50px;
    display: flex;
    align-items: center;
  }

  .message-text {
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.4;
  }

  /* Action Panel */
  .action-panel {
    background: var(--bg-secondary);
    border-top: 2px solid var(--border);
    padding: var(--spacing-sm);
  }

  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xs);
  }

  .action-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--accent);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.attack {
    border-color: #ef4444;
    color: #ef4444;
  }

  .action-btn.attack:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
  }

  .action-btn.defend {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .action-btn.defend:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.1);
  }

  .action-btn.item {
    border-color: #22c55e;
    color: #22c55e;
  }

  .action-btn.item:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.1);
  }

  .action-btn.run {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .action-btn.run:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.1);
  }

  .action-btn.placeholder {
    border-color: transparent;
    background: transparent;
    cursor: default;
  }

  .item-count {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  .gold-display {
    font-size: 0.9rem;
    color: #fbbf24;
  }

  /* Dice Row (compact) */
  .dice-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs);
  }

  .mini-die {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 1.25rem;
    font-weight: 700;
    animation: diceRoll 0.3s ease-out;
  }

  .mini-die.crit {
    border-color: #fbbf24;
    background: #fbbf24;
    color: #1a1a1a;
  }

  @keyframes diceRoll {
    0% { transform: rotate(-15deg) scale(1.2); }
    100% { transform: rotate(0) scale(1); }
  }

  .crit-badge {
    background: #fbbf24;
    color: #1a1a1a;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 0.7rem;
    font-weight: 700;
    animation: critPop 0.3s ease-out;
  }

  @keyframes critPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  /* Room Progress Dots */
  .room-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: var(--spacing-xs);
    background: var(--bg-tertiary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: var(--accent);
    transform: scale(1.3);
  }

  .dot.done {
    background: var(--success);
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
