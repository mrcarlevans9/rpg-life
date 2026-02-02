<script>
  import { onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import Card from '../common/Card.svelte';
  import ProgressBar from '../common/ProgressBar.svelte';
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

  // Get dice face
  function getDiceFace(value) {
    const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return faces[value] || '⚀';
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
    <!-- COMBAT PHASE -->
    <div class="combat-phase">
      <!-- Boss Section -->
      <div class="boss-section">
        <div class="boss-display">
          <span class="boss-emoji" class:shake={$combatState.lastDamageToEnemy}>
            {$activeBossFight?.boss_emoji || '👹'}
          </span>
          {#if $combatState.lastDamageToEnemy}
            <span class="damage-number enemy-damage">-{$combatState.lastDamageToEnemy}</span>
          {/if}
        </div>

        <div class="boss-info">
          <span class="boss-name">{$activeBossFight?.boss_name || 'Guild Boss'}</span>
          <div class="boss-hp-bar">
            <div class="hp-bar-fill" style="width: {bossHpPercent}%"></div>
            <span class="hp-text">
              {$activeBossFight?.boss_current_hp || 0} / {$activeBossFight?.boss_max_hp || 0}
            </span>
          </div>
        </div>
      </div>

      <!-- Message Box -->
      <div class="message-box">
        <p>{$currentMessage || 'Your turn!'}</p>
      </div>

      <!-- Dice Display -->
      {#if displayedRolls.length > 0}
        <div class="dice-display">
          {#each displayedRolls as roll, i}
            <span class="die" class:revealed={diceRevealed[i]}>
              {getDiceFace(roll)}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Player Section -->
      <div class="player-section">
        <div class="player-stats">
          <div class="stat-bar">
            <span class="stat-label">HP</span>
            <div class="bar hp-bar">
              <div class="bar-fill hp-fill" style="width: {playerHpPercent}%"></div>
            </div>
            <span class="stat-value">{$playerCombat.hp}/{$playerCombat.maxHp}</span>
          </div>
          <div class="stat-bar">
            <span class="stat-label">MP</span>
            <div class="bar mp-bar">
              <div class="bar-fill mp-fill" style="width: {playerMpPercent}%"></div>
            </div>
            <span class="stat-value">{$playerCombat.mp}/{$playerCombat.maxMp}</span>
          </div>
        </div>

        {#if $combatState.lastDamageToPlayer}
          <span class="damage-number player-damage">-{$combatState.lastDamageToPlayer}</span>
        {/if}
      </div>

      <!-- Action Buttons -->
      {#if $battlePhase === 'combat'}
        <div class="action-buttons">
          <button
            class="action-btn attack"
            on:click={playerAttack}
            disabled={!canAct}
          >
            ⚔️ Attack
          </button>

          <button
            class="action-btn defend"
            on:click={playerDefend}
            disabled={!canAct}
          >
            🛡️ Defend
          </button>

          <button
            class="action-btn potion"
            on:click={usePotion}
            disabled={!canAct || $playerCombat.potions <= 0}
          >
            🧪 Potion ({$playerCombat.potions})
          </button>

          <button
            class="action-btn spell"
            on:click={() => showSpellMenu = !showSpellMenu}
            disabled={!canAct || !$playerCombat.customSpells?.length}
          >
            ✨ Spells
          </button>
        </div>

        <!-- Spell Menu -->
        {#if showSpellMenu && $playerCombat.customSpells?.length}
          <div class="spell-menu">
            {#each $playerCombat.customSpells as spell, i}
              {#if spell}
                <button
                  class="spell-btn"
                  on:click={() => handleCastSpell(spell)}
                  disabled={$playerCombat.mp < spell.manaCost}
                >
                  <span class="spell-name">{spell.name}</span>
                  <span class="spell-cost">{spell.manaCost} MP</span>
                  <span class="spell-damage">{spell.damage} dmg</span>
                </button>
              {/if}
            {/each}
          </div>
        {/if}

        <button class="btn-retreat" on:click={handleRetreat}>
          🏃 Retreat
        </button>

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

      <!-- Participants -->
      {#if $activeBossFight?.participants && Object.keys($activeBossFight.participants).length > 0}
        <div class="participants-bar">
          <span class="participants-label">Guild Damage:</span>
          {#each Object.entries($activeBossFight.participants).slice(0, 5) as [userId, data]}
            <span class="participant-badge">
              {data.username}: {data.damage}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .guild-boss-battle {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    z-index: 1000;
    overflow-y: auto;
    padding: 20px;
  }

  /* Shop Phase */
  .shop-phase {
    max-width: 500px;
    margin: 0 auto;
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

  /* Combat Phase */
  .combat-phase {
    max-width: 500px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .boss-section {
    text-align: center;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 16px;
    position: relative;
  }

  .boss-display {
    position: relative;
    display: inline-block;
  }

  .boss-emoji {
    font-size: 5rem;
    display: block;
    transition: transform 0.1s;
  }

  .boss-emoji.shake {
    animation: shake 0.3s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }

  .damage-number {
    position: absolute;
    font-size: 1.5rem;
    font-weight: 700;
    animation: floatUp 1s forwards;
  }

  .enemy-damage {
    top: 0;
    right: -20px;
    color: #ef4444;
  }

  .player-damage {
    color: #ef4444;
  }

  @keyframes floatUp {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-30px); }
  }

  .boss-info {
    margin-top: 12px;
  }

  .boss-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
    margin-bottom: 8px;
  }

  .boss-hp-bar {
    position: relative;
    height: 24px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    overflow: hidden;
  }

  .hp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ef4444, #f97316);
    transition: width 0.3s ease;
  }

  .hp-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .message-box {
    padding: 16px 20px;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: 12px;
    text-align: center;
  }

  .message-box p {
    color: var(--text-primary);
    font-size: 1rem;
    margin: 0;
  }

  .dice-display {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .die {
    font-size: 2.5rem;
    opacity: 0.5;
    transition: all 0.2s;
  }

  .die.revealed {
    opacity: 1;
    transform: scale(1.1);
  }

  .player-section {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 12px;
    position: relative;
  }

  .player-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-bar {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-label {
    width: 30px;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .bar {
    flex: 1;
    height: 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
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

  .stat-value {
    width: 70px;
    text-align: right;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .action-btn {
    padding: 14px;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.attack {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
  }

  .action-btn.defend {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
  }

  .action-btn.potion {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
  }

  .action-btn.spell {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
  }

  .spell-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 12px;
  }

  .spell-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
  }

  .spell-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spell-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .spell-cost {
    color: #3b82f6;
    font-size: 0.85rem;
  }

  .spell-damage {
    color: #ef4444;
    font-size: 0.85rem;
  }

  .btn-retreat {
    width: 100%;
    padding: 12px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
  }

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

  .participants-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 12px;
    font-size: 0.8rem;
  }

  .participants-label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .participant-badge {
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: 999px;
    color: var(--text-secondary);
  }
</style>
