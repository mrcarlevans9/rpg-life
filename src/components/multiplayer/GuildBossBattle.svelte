<script>
  import { onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import {
    activeBossFight,
    battlePhase,
    playerCombat,
    combatState,
    currentMessage,
    lastRoll,
    GUILD_BOSS_SHOP_ITEMS,
    startBossBattle,
    purchaseShopItem,
    leaveShop,
    playerAttack,
    playerDefend,
    usePotion,
    castSpell,
    retreat,
    endBattle,
    unsubscribeFromBossFight
  } from '../../lib/stores/guildBoss.js';
  import { playerData } from '../../lib/stores/player.js';

  export let bossFight;

  const dispatch = createEventDispatcher();

  let showSpellMenu = false;
  let purchaseLoading = null;

  // Dice animation state
  let displayedRolls = [];
  let diceRevealed = [];
  let rollAnimationId = 0;

  // Start battle on mount
  $: if (bossFight && $battlePhase === 'idle') {
    startBossBattle(bossFight);
  }

  // Watch for dice rolls
  $: if ($lastRoll && $lastRoll.rolls.length > 0) {
    animateDiceRoll($lastRoll.rolls);
  } else if ($lastRoll && $lastRoll.rolls.length === 0) {
    displayedRolls = [];
    diceRevealed = [];
  }

  function animateDiceRoll(finalRolls) {
    const currentAnimId = ++rollAnimationId;
    const numDice = finalRolls.length;

    displayedRolls = finalRolls.map(() => Math.ceil(Math.random() * 6));
    diceRevealed = finalRolls.map(() => false);

    const rollInterval = setInterval(() => {
      if (rollAnimationId !== currentAnimId) {
        clearInterval(rollInterval);
        return;
      }
      displayedRolls = displayedRolls.map((_, i) =>
        diceRevealed[i] ? finalRolls[i] : Math.ceil(Math.random() * 6)
      );
    }, 50);

    finalRolls.forEach((finalValue, index) => {
      setTimeout(() => {
        if (rollAnimationId !== currentAnimId) return;
        diceRevealed[index] = true;
        displayedRolls[index] = finalValue;
        diceRevealed = [...diceRevealed];
        displayedRolls = [...displayedRolls];

        if (index === numDice - 1) {
          clearInterval(rollInterval);
        }
      }, 200 + index * 250);
    });
  }

  async function handlePurchase(item) {
    purchaseLoading = item.id;
    const result = await purchaseShopItem(item);
    if (!result.success) {
      alert(result.error);
    }
    purchaseLoading = null;
  }

  function handleCastSpell(spell) {
    showSpellMenu = false;
    castSpell(spell);
  }

  function handleExit() {
    endBattle();
    dispatch('exit');
  }

  function handleRetreat() {
    retreat();
    setTimeout(() => dispatch('exit'), 1500);
  }

  onDestroy(() => {
    unsubscribeFromBossFight();
  });

  // Derived values
  $: bossHpPercent = $activeBossFight
    ? ($activeBossFight.boss_current_hp / $activeBossFight.boss_max_hp) * 100
    : 0;

  $: playerHpPercent = ($playerCombat.hp / $playerCombat.maxHp) * 100;
  $: playerMpPercent = ($playerCombat.mp / $playerCombat.maxMp) * 100;

  $: canAct = !$combatState.isAnimating && $battlePhase === 'combat';

  function getHpBarColor(hp, maxHp) {
    const pct = hp / maxHp;
    if (pct > 0.6) return 'var(--success)';
    if (pct > 0.3) return 'var(--warning)';
    return 'var(--danger)';
  }
</script>

<div class="guild-boss-battle">
  {#if $battlePhase === 'shop'}
    <!-- SHOP PHASE -->
    <div class="shop-phase">
      <div class="shop-header">
        <span class="merchant-icon">🧌</span>
        <div class="merchant-text">
          <h2>Goblin Merchant</h2>
          <p>"Special wares for guild battles, adventurer!"</p>
        </div>
      </div>

      <div class="player-gold">
        <span class="gold-icon">🪙</span>
        <span class="gold-amount">{$playerData?.gold || 0}</span>
      </div>

      <div class="shop-items">
        {#each GUILD_BOSS_SHOP_ITEMS as item}
          <div class="shop-item">
            <div class="item-info">
              <span class="item-name">{item.name}</span>
              <span class="item-desc">{item.description}</span>
              <span class="item-price">🪙 {item.price}</span>
            </div>
            <button
              class="btn-buy"
              on:click={() => handlePurchase(item)}
              disabled={purchaseLoading === item.id || ($playerData?.gold || 0) < item.price}
            >
              {purchaseLoading === item.id ? '...' : 'Buy'}
            </button>
          </div>
        {/each}
      </div>

      <div class="shop-status">
        <div class="status-item">
          <span class="status-label">Potions:</span>
          <span class="status-value">{$playerCombat.potions}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Bonus Damage:</span>
          <span class="status-value">+{$playerCombat.tempBuffs?.bonusDamage || 0}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Bonus Defense:</span>
          <span class="status-value">+{$playerCombat.tempBuffs?.defenseBonus || 0}</span>
        </div>
      </div>

      <button class="btn-enter-battle" on:click={leaveShop}>
        Enter Battle
      </button>
    </div>

  {:else if $battlePhase === 'combat' || $battlePhase === 'victory' || $battlePhase === 'defeat'}
    <!-- COMBAT PHASE - Exact Dungeon Style -->
    <div class="battle-screen" class:screen-shake={$combatState.lastDamageToPlayer}>
      <!-- Top HUD: Boss indicator left, Enemy HP right -->
      <div class="battle-hud">
        <!-- Boss indicator -->
        <div class="floor-indicator">
          <span class="floor-number">GUILD</span>
          <span class="boss-badge">👑 BOSS</span>
        </div>

        <!-- Enemy HP -->
        <div class="hud-box enemy-hud boss-hud">
          <div class="hud-label">
            {$activeBossFight?.boss_name || 'Guild Boss'}
            <span class="boss-tag">BOSS</span>
          </div>
          <div class="hud-hp-bar" class:hp-flash={$combatState.lastDamageToEnemy}>
            <div
              class="hud-hp-fill boss-hp"
              style="width: {bossHpPercent}%"
            ></div>
          </div>
          <div class="hud-hp-text">
            <span>{$activeBossFight?.boss_current_hp || 0}/{$activeBossFight?.boss_max_hp || 0}</span>
          </div>
        </div>
      </div>

      <!-- Main Arena -->
      <div class="battle-arena">
        <!-- Dungeon decorations -->
        <div class="dungeon-decor left">🔥</div>
        <div class="dungeon-decor right">🔥</div>

        <div
          class="monster-display"
          class:is-boss={true}
          class:sprite-hit={$combatState.lastDamageToEnemy}
          class:sprite-attack={$combatState.enemyAction === 'attack'}
        >
          <span class="monster-emoji">{$activeBossFight?.boss_emoji || '👹'}</span>
          {#key $combatState.lastDamageToEnemy}
            {#if $combatState.lastDamageToEnemy}
              <div class="floating-damage">-{$combatState.lastDamageToEnemy}</div>
            {/if}
          {/key}
        </div>

        <!-- Visual Effects -->
        {#if $combatState.playerAction === 'attack'}
          <div class="battle-effect slash"></div>
        {/if}
        {#if $combatState.playerAction === 'defend'}
          <div class="battle-effect shield">🛡️</div>
        {/if}

        <!-- Combat Message Overlay (bottom of arena) -->
        {#if ($combatState.isAnimating || $combatState.turn === 'player') && $currentMessage}
          <div class="combat-message-overlay">
            <div class="combat-toast" class:crit={$lastRoll?.critical}>
              {#if displayedRolls.length > 0}
                <span class="toast-dice">
                  {#each displayedRolls as roll, i}
                    <span class="toast-die" class:rolling={!diceRevealed[i]} class:revealed={diceRevealed[i]}>{roll}</span>{#if i < displayedRolls.length - 1}<span class="toast-plus">+</span>{/if}
                  {/each}
                </span>
                <span class="toast-arrow">→</span>
              {/if}
              <span class="toast-message">{$currentMessage}</span>
              {#if $lastRoll?.critical}
                <span class="toast-crit">CRIT!</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Player Stats Bar (below arena) - Dungeon style -->
      <div class="player-bar" class:bar-flash={$combatState.lastDamageToPlayer}>
        <div class="player-bar-content">
          <!-- HP + MP stacked -->
          <div class="bars-stack">
            <div class="bar-row hp-row">
              <span class="bar-label">HP</span>
              <div class="bar-track">
                <div
                  class="bar-fill hp-fill"
                  style="width: {playerHpPercent}%; background: {getHpBarColor($playerCombat.hp, $playerCombat.maxHp)}"
                ></div>
              </div>
              <span class="bar-value">{$playerCombat.hp}/{$playerCombat.maxHp}</span>
              {#key $combatState.lastDamageToPlayer}
                {#if $combatState.lastDamageToPlayer}
                  <span class="bar-damage">-{$combatState.lastDamageToPlayer}</span>
                {/if}
              {/key}
            </div>
            <div class="bar-row mp-row">
              <span class="bar-label">MP</span>
              <div class="bar-track">
                <div
                  class="bar-fill mp-fill"
                  style="width: {playerMpPercent}%"
                ></div>
              </div>
              <span class="bar-value">{$playerCombat.mp}/{$playerCombat.maxMp}</span>
            </div>
          </div>
          <!-- Guild damage display -->
          {#if $activeBossFight?.participants && Object.keys($activeBossFight.participants).length > 0}
            <div class="guild-damage-display">
              {#each Object.entries($activeBossFight.participants).slice(0, 3) as [userId, data]}
                <span class="damage-badge">{data.username}: {data.damage}</span>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Panel -->
      <div class="action-panel">
        {#if $battlePhase === 'combat'}
          <div class="action-grid" class:has-spells={$playerCombat.customSpells?.filter(s => s).length > 0}>
            <button
              class="action-btn attack"
              on:click={playerAttack}
              disabled={!canAct}
            >
              ⚔️ FIGHT
            </button>
            <button
              class="action-btn defend"
              on:click={playerDefend}
              disabled={!canAct}
            >
              🛡️ DEFEND
            </button>
            {#if $playerCombat.customSpells?.filter(s => s).length > 0}
              <button
                class="action-btn spell"
                on:click={() => showSpellMenu = !showSpellMenu}
                disabled={!canAct}
              >
                ✨ CAST
                <span class="item-count">({$playerCombat.mp} MP)</span>
              </button>
            {/if}
            <button
              class="action-btn item"
              on:click={usePotion}
              disabled={!canAct || $playerCombat.potions <= 0}
            >
              🧪 POTION <span class="item-count">({$playerCombat.potions})</span>
            </button>
            <button
              class="action-btn run"
              on:click={handleRetreat}
              disabled={!canAct}
            >
              🏃 FLEE
            </button>
          </div>

          <!-- Spell Selection Menu -->
          {#if showSpellMenu && $playerCombat.customSpells?.length}
            <div class="spell-menu">
              <div class="spell-menu-header">
                <span>Select Spell</span>
                <button class="spell-menu-close" on:click={() => showSpellMenu = false}>×</button>
              </div>
              <div class="spell-menu-list">
                {#each $playerCombat.customSpells as spell, i}
                  {#if spell}
                    <button
                      class="spell-menu-item"
                      on:click={() => handleCastSpell(spell)}
                      disabled={$playerCombat.mp < spell.manaCost}
                    >
                      <span class="spell-menu-icon">✨</span>
                      <div class="spell-menu-info">
                        <span class="spell-menu-name">{spell.name}</span>
                        <span class="spell-menu-stats">{spell.damage} DMG</span>
                      </div>
                      <span class="spell-menu-cost" class:insufficient={$playerCombat.mp < spell.manaCost}>
                        {spell.manaCost} MP
                      </span>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

        {:else if $battlePhase === 'victory'}
          <div class="result-screen victory">
            <h2>🎉 Victory!</h2>
            <p>The guild boss has been defeated!</p>
            <p class="contribution">
              Your damage: {$activeBossFight?.participants?.[$playerData?.id]?.damage || 'N/A'}
            </p>
            <button class="btn-exit" on:click={handleExit}>
              Continue
            </button>
          </div>

        {:else if $battlePhase === 'defeat'}
          <div class="result-screen defeat">
            <h2>💀 Defeated</h2>
            <p>You have fallen, but the boss remains weakened!</p>
            <p class="boss-hp-remaining">
              Boss HP: {$activeBossFight?.boss_current_hp} / {$activeBossFight?.boss_max_hp}
            </p>
            <p class="encourage">Your guildmates can continue the fight!</p>
            <button class="btn-exit" on:click={handleExit}>
              Return to Guild
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .guild-boss-battle {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    z-index: 1000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Shop Phase */
  .shop-phase {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    overflow-y: auto;
    height: 100%;
  }

  .shop-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1));
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
  }

  .merchant-icon {
    font-size: 3rem;
  }

  .merchant-text h2 {
    color: #22c55e;
    margin-bottom: 4px;
  }

  .merchant-text p {
    color: var(--text-muted);
    font-style: italic;
  }

  .player-gold {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1));
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .gold-icon {
    font-size: 1.5rem;
  }

  .gold-amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fbbf24;
  }

  .shop-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .shop-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .item-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .item-price {
    font-size: 0.85rem;
    color: #fbbf24;
    font-weight: 500;
  }

  .btn-buy {
    padding: 8px 20px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-buy:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shop-status {
    display: flex;
    justify-content: space-around;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .status-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .status-value {
    font-weight: 700;
    color: var(--accent);
  }

  .btn-enter-battle {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
  }

  /* Battle Screen - Dungeon Style */
  .battle-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .battle-screen.screen-shake {
    animation: screenShake 0.3s ease-in-out;
  }

  @keyframes screenShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }

  /* Top HUD - Dungeon style */
  .battle-hud {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 10px 15px;
    gap: 10px;
  }

  .floor-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px 12px;
    border-radius: var(--radius-md);
  }

  .floor-number {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .boss-badge {
    font-size: 0.75rem;
    color: #fbbf24;
  }

  .hud-box {
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    min-width: 140px;
  }

  .enemy-hud {
    border: 1px solid var(--danger);
  }

  .boss-hud {
    border-color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .hud-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .boss-tag {
    font-size: 0.55rem;
    padding: 1px 4px;
    border-radius: 2px;
    background: #fbbf24;
    color: #1a1a1a;
    font-weight: 700;
  }

  .hud-hp-bar {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 2px;
  }

  .hud-hp-bar.hp-flash {
    animation: hpFlash 0.3s ease-out;
  }

  @keyframes hpFlash {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.5); }
  }

  .hud-hp-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .hud-hp-fill.boss-hp {
    background: linear-gradient(90deg, #ef4444, #f97316);
  }

  .hud-hp-text {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-align: center;
  }

  /* Battle Arena - Dungeon style */
  .battle-arena {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  }

  .dungeon-decor {
    position: absolute;
    font-size: 1.5rem;
    opacity: 0.6;
    animation: flicker 2s ease-in-out infinite alternate;
  }

  .dungeon-decor.left {
    left: 20px;
    top: 40%;
  }

  .dungeon-decor.right {
    right: 20px;
    top: 40%;
  }

  @keyframes flicker {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
  }

  .monster-display {
    position: relative;
    transition: transform 0.2s ease;
  }

  .monster-display.is-boss .monster-emoji {
    font-size: 14rem;
    filter: drop-shadow(0 0 50px rgba(251, 191, 36, 0.6));
    animation: bossPulse 2s ease-in-out infinite;
  }

  @keyframes bossPulse {
    0%, 100% {
      filter: drop-shadow(0 0 40px rgba(251, 191, 36, 0.5));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 60px rgba(251, 191, 36, 0.7));
      transform: scale(1.05);
    }
  }

  .monster-emoji {
    display: block;
  }

  .monster-display.sprite-hit {
    animation: spriteHit 0.3s ease-out;
  }

  .monster-display.sprite-attack {
    animation: spriteAttack 0.4s ease-out;
  }

  @keyframes spriteHit {
    0% { transform: translateX(0); filter: brightness(2); }
    25% { transform: translateX(-15px); }
    50% { transform: translateX(10px); }
    75% { transform: translateX(-5px); }
    100% { transform: translateX(0); filter: brightness(1); }
  }

  @keyframes spriteAttack {
    0% { transform: scale(1) translateY(0); }
    30% { transform: scale(1.1) translateY(-10px); }
    60% { transform: scale(1.2) translateY(20px); }
    100% { transform: scale(1) translateY(0); }
  }

  .floating-damage {
    position: absolute;
    top: -20px;
    right: -20px;
    font-size: 1.5rem;
    font-weight: 700;
    color: #ef4444;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    animation: floatUp 1s ease-out forwards;
    pointer-events: none;
  }

  @keyframes floatUp {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    50% { transform: translateY(-20px) scale(1.2); }
    100% { opacity: 0; transform: translateY(-40px) scale(0.8); }
  }

  /* Battle Effects */
  .battle-effect {
    position: absolute;
    pointer-events: none;
    z-index: 10;
  }

  .battle-effect.slash {
    width: 100px;
    height: 100px;
    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.8), transparent);
    animation: slashEffect 0.3s ease-out forwards;
  }

  @keyframes slashEffect {
    0% { opacity: 1; transform: translateX(-50px) rotate(-45deg); }
    100% { opacity: 0; transform: translateX(50px) rotate(-45deg); }
  }

  .battle-effect.shield {
    font-size: 4rem;
    animation: shieldEffect 0.5s ease-out forwards;
  }

  @keyframes shieldEffect {
    0% { opacity: 0; transform: scale(0.5); }
    50% { opacity: 1; transform: scale(1.2); }
    100% { opacity: 0; transform: scale(1); }
  }

  /* Combat Message Overlay - Dungeon style */
  .combat-message-overlay {
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
    z-index: 30;
    pointer-events: none;
  }

  .combat-toast {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.85);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    animation: toastSlide 0.2s ease-out;
  }

  .combat-toast.crit {
    border-left-color: #fbbf24;
    background: rgba(251, 191, 36, 0.15);
  }

  @keyframes toastSlide {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .toast-dice {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toast-die {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-primary);
    min-width: 20px;
    text-align: center;
  }

  .combat-toast.crit .toast-die {
    background: #fbbf24;
    border-color: #fbbf24;
    color: #1a1a1a;
  }

  .toast-die.rolling {
    animation: diceRoll 0.1s infinite;
    opacity: 0.7;
    color: var(--text-muted);
  }

  .toast-die.revealed {
    animation: diceReveal 0.3s ease-out;
    opacity: 1;
  }

  @keyframes diceRoll {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-2px) rotate(-3deg); }
    50% { transform: translateY(0) rotate(0deg); }
    75% { transform: translateY(2px) rotate(3deg); }
  }

  @keyframes diceReveal {
    0% { transform: scale(1.3) rotate(-10deg); opacity: 0.5; }
    50% { transform: scale(1.1) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  .toast-plus {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .toast-arrow {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .toast-message {
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    flex: 1;
  }

  .toast-crit {
    background: #fbbf24;
    color: #1a1a1a;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    animation: critPulse 0.3s ease-out;
  }

  @keyframes critPulse {
    0% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  /* Player Bar - Dungeon style */
  .player-bar {
    background: var(--bg-secondary);
    padding: 8px 15px;
    border-top: 1px solid var(--border);
  }

  .player-bar.bar-flash {
    animation: barFlash 0.3s ease-out;
  }

  @keyframes barFlash {
    0%, 100% { background: var(--bg-secondary); }
    50% { background: rgba(239, 68, 68, 0.3); }
  }

  .player-bar-content {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .bars-stack {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .bar-label {
    font-size: 0.7rem;
    font-weight: 600;
    width: 20px;
    color: var(--text-muted);
  }

  .bar-track {
    flex: 1;
    height: 10px;
    background: var(--bg-tertiary);
    border-radius: 5px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .hp-fill {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .mp-fill {
    background: linear-gradient(90deg, #3b82f6, #6366f1);
  }

  .bar-value {
    font-size: 0.65rem;
    color: var(--text-muted);
    min-width: 45px;
    text-align: right;
  }

  .bar-damage {
    position: absolute;
    right: 50px;
    top: -8px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #ef4444;
    animation: floatUp 1s ease-out forwards;
  }

  .guild-damage-display {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .damage-badge {
    font-size: 0.6rem;
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border-radius: 999px;
    color: var(--text-muted);
  }

  /* Action Panel - Dungeon style */
  .action-panel {
    padding: 10px 15px;
    padding-bottom: 20px;
    position: relative;
    background: var(--bg-primary);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .action-grid.has-spells {
    grid-template-columns: repeat(3, 1fr);
  }

  /* OUTLINED BUTTON STYLE - Matching Dungeon exactly */
  .action-btn {
    padding: 12px 16px;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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

  .action-btn.spell {
    border-color: #8b5cf6;
    color: #8b5cf6;
  }

  .action-btn.spell:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.1);
  }

  .action-btn.item {
    border-color: #22c55e;
    color: #22c55e;
  }

  .action-btn.item:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.1);
  }

  .action-btn.run {
    border-color: #f97316;
    color: #f97316;
  }

  .action-btn.run:hover:not(:disabled) {
    background: rgba(249, 115, 22, 0.1);
  }

  .item-count {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  /* Spell Menu */
  .spell-menu {
    position: absolute;
    bottom: 100%;
    left: 15px;
    right: 15px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: 8px;
    z-index: 50;
  }

  .spell-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .spell-menu-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 4px;
  }

  .spell-menu-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .spell-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .spell-menu-item:last-child {
    border-bottom: none;
  }

  .spell-menu-item:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }

  .spell-menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spell-menu-icon {
    font-size: 1.25rem;
  }

  .spell-menu-info {
    flex: 1;
  }

  .spell-menu-name {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .spell-menu-stats {
    font-size: 0.75rem;
    color: #ef4444;
  }

  .spell-menu-cost {
    font-size: 0.8rem;
    font-weight: 600;
    color: #3b82f6;
  }

  .spell-menu-cost.insufficient {
    color: var(--text-muted);
  }

  /* Result Screens */
  .result-screen {
    text-align: center;
    padding: 40px 20px;
  }

  .result-screen h2 {
    font-size: 2rem;
    margin-bottom: 12px;
  }

  .result-screen.victory h2 {
    color: #22c55e;
  }

  .result-screen.defeat h2 {
    color: #ef4444;
  }

  .result-screen p {
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .contribution, .boss-hp-remaining {
    font-weight: 600;
    color: var(--text-primary) !important;
  }

  .encourage {
    color: var(--accent) !important;
    font-style: italic;
  }

  .btn-exit {
    margin-top: 20px;
    padding: 14px 40px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
