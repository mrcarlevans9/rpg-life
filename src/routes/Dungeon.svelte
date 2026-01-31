<script>
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import {
    dungeonData,
    currentRun,
    gamePhase,
    lastRoll,
    currentMonster,
    combatState,
    currentMessage,
    startRun,
    playerAttack,
    playerDefend,
    usePotion,
    collectRewards,
    retreat,
    emergencyRetreat,
    purchaseUpgrade,
    castSpell,
    saveCustomSpell,
    deleteCustomSpell,
    calculateManaCost,
    getSpellSlots
  } from '../lib/stores/dungeon.js';
  import { DUNGEON_UPGRADES } from '../lib/db/index.js';
  import { playerData } from '../lib/stores/player.js';

  let showShop = false;
  let showSpellEditor = false;
  let showSpellMenu = false;

  // Dice rolling animation state
  let displayedRolls = [];
  let diceRevealed = [];
  let rollAnimationId = 0;

  // Watch for new rolls and animate dice
  $: if ($lastRoll && $lastRoll.rolls.length > 0) {
    animateDiceRoll($lastRoll.rolls);
  } else if ($lastRoll && $lastRoll.rolls.length === 0) {
    // Clear dice display when rolls are empty
    displayedRolls = [];
    diceRevealed = [];
  }

  function animateDiceRoll(finalRolls) {
    const currentAnimId = ++rollAnimationId;
    const numDice = finalRolls.length;

    // Initialize with random values, all unrevealed
    displayedRolls = finalRolls.map(() => Math.ceil(Math.random() * 6));
    diceRevealed = finalRolls.map(() => false);

    // Rapidly cycle through random numbers
    const rollInterval = setInterval(() => {
      if (rollAnimationId !== currentAnimId) {
        clearInterval(rollInterval);
        return;
      }
      displayedRolls = displayedRolls.map((_, i) =>
        diceRevealed[i] ? finalRolls[i] : Math.ceil(Math.random() * 6)
      );
    }, 50);

    // Reveal each die sequentially
    finalRolls.forEach((finalValue, index) => {
      setTimeout(() => {
        if (rollAnimationId !== currentAnimId) return;
        diceRevealed[index] = true;
        displayedRolls[index] = finalValue;
        diceRevealed = [...diceRevealed];
        displayedRolls = [...displayedRolls];

        // Clear interval after last die is revealed
        if (index === numDice - 1) {
          clearInterval(rollInterval);
        }
      }, 200 + index * 250); // Stagger each die reveal by 250ms
    });
  }

  // Spell editor state
  let editingSlotIndex = 0;
  let spellName = '';
  let spellDescription = '';
  let spellDamage = 15;
  let spellManaCost = 10;
  let spellError = '';

  // Get spell slots info
  $: spellSlots = getSpellSlots();
  $: customSpells = $dungeonData?.customSpells || [];

  // Close spell menu when combat state changes
  $: if ($combatState.isAnimating || !$currentMonster) showSpellMenu = false;

  // Open spell editor for a specific slot
  function openSpellEditor(slotIndex = 0) {
    editingSlotIndex = slotIndex;
    const existing = customSpells[slotIndex];
    if (existing) {
      spellName = existing.name;
      spellDescription = existing.description || '';
      spellDamage = existing.damage;
      spellManaCost = existing.manaCost;
    } else {
      spellName = '';
      spellDescription = '';
      spellDamage = 15;
      spellManaCost = calculateManaCost(15);
    }
    spellError = '';
    showSpellEditor = true;
  }

  // Update mana cost when damage changes
  function onDamageChange() {
    spellManaCost = calculateManaCost(spellDamage);
    spellError = '';
  }

  // Save the spell to the current slot
  async function handleSaveSpell() {
    const result = await saveCustomSpell({
      name: spellName,
      description: spellDescription,
      damage: spellDamage,
      manaCost: spellManaCost
    }, editingSlotIndex);

    if (result.success) {
      showSpellEditor = false;
      spellError = '';
    } else {
      spellError = result.error;
    }
  }

  // Delete the spell from the current slot
  async function handleDeleteSpell() {
    await deleteCustomSpell(editingSlotIndex);
    showSpellEditor = false;
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

<div class="dungeon-page" class:in-combat={$gamePhase !== 'idle'}>
  {#if $gamePhase === 'idle'}
    <div class="page-header">
      <h1>Dungeon</h1>
      <p class="subtitle">Descend into the depths and test your might</p>
    </div>
  {/if}

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

      <!-- Spell Slots -->
      <Card class="spell-slots-card">
        <h3>✨ Spell Slots ({customSpells.filter(s => s).length}/{spellSlots})</h3>
        <div class="spell-slots-grid">
          {#each Array(spellSlots) as _, i}
            {@const spell = customSpells[i]}
            <button
              class="spell-slot"
              class:empty={!spell}
              on:click={() => openSpellEditor(i)}
            >
              {#if spell}
                <span class="slot-name">{spell.name}</span>
                <span class="slot-stats">{spell.damage} DMG | {spell.manaCost} MP</span>
              {:else}
                <span class="slot-empty">+ Add Spell</span>
              {/if}
            </button>
          {/each}
        </div>
        <p class="spell-hint">Unlock more slots at levels 10, 25, 50 or buy from shop</p>
      </Card>
    </div>
  {/if}

  <!-- Combat State - Knights of Pen and Paper style -->
  {#if $gamePhase === 'exploring'}
    <div class="battle-screen" class:screen-shake={$combatState.lastDamageToPlayer}>
      <!-- Top HUD: Floor left, Enemy HP right -->
      <div class="battle-hud">
        <!-- Floor indicator -->
        <div class="floor-indicator">
          <span class="floor-number">F{$currentRun?.currentFloor}</span>
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

        <!-- Enemy HP -->
        {#if $currentMonster}
          <div class="hud-box enemy-hud">
            <div class="hud-label">
              {$currentMonster.displayName}
              {#if $currentMonster.isBoss}
                <span class="boss-tag">BOSS</span>
              {/if}
            </div>
            <div class="hud-hp-bar" class:hp-flash={$combatState.lastDamageToEnemy}>
              <div
                class="hud-hp-fill enemy-hp"
                style="width: {($currentMonster.currentHp / $currentMonster.maxHp) * 100}%"
              ></div>
            </div>
            <div class="hud-hp-text">
              <span>{$currentMonster.currentHp}/{$currentMonster.maxHp}</span>
            </div>
          </div>
        {:else}
          <div class="hud-box enemy-hud empty"></div>
        {/if}
      </div>

      <!-- Main Arena: Big centered enemy -->
      <div class="battle-arena">
        {#if $currentMonster}
          <div
            class="monster-display"
            class:sprite-hit={$combatState.lastDamageToEnemy}
            class:sprite-attack={$combatState.enemyAction === 'attack'}
            class:sprite-defeated={$combatState.monsterDefeated}
          >
            <span class="monster-emoji">{$currentMonster.emoji}</span>
            {#key $combatState.lastDamageToEnemy}
              {#if $combatState.lastDamageToEnemy}
                <div class="floating-damage">-{$combatState.lastDamageToEnemy}</div>
              {/if}
            {/key}
          </div>
        {/if}

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

      <!-- Player Stats Bar (below arena) -->
      <div class="player-bar" class:bar-flash={$combatState.lastDamageToPlayer}>
        <div class="player-bar-content">
          <!-- HP + MP stacked -->
          <div class="bars-stack">
            <div class="bar-row hp-row">
              <span class="bar-label">HP</span>
              <div class="bar-track">
                <div
                  class="bar-fill hp-fill"
                  style="width: {($currentRun?.playerHp / $currentRun?.maxHp) * 100}%;
                         background: {getHpBarColor($currentRun?.playerHp, $currentRun?.maxHp)}"
                ></div>
              </div>
              <span class="bar-value">{$currentRun?.playerHp}/{$currentRun?.maxHp}</span>
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
                  style="width: {($currentRun?.playerMp / $currentRun?.maxMp) * 100}%"
                ></div>
              </div>
              <span class="bar-value">{$currentRun?.playerMp}/{$currentRun?.maxMp}</span>
            </div>
          </div>
          <!-- Gold -->
          <div class="gold-section">
            <span class="gold-display">🪙 {$currentRun?.goldCollected || 0}</span>
          </div>
        </div>
      </div>

      <!-- Action Panel -->
      <div class="action-panel">
        <!-- Action Buttons -->
          <div class="action-grid" class:has-spells={($currentRun?.customSpells || []).filter(s => s).length > 0}>
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
              {#if ($currentRun?.customSpells || []).filter(s => s).length > 0}
                <button
                  class="action-btn spell"
                  on:click={() => showSpellMenu = !showSpellMenu}
                  disabled={$combatState.isAnimating}
                >
                  ✨ CAST
                  <span class="item-count">({$currentRun?.playerMp || 0} MP)</span>
                </button>
              {/if}
            {/if}
            <button
              class="action-btn item"
              on:click={usePotion}
              disabled={!$dungeonData?.healthPotions || $currentRun?.playerHp >= $currentRun?.maxHp || $combatState.isAnimating}
            >
              🧪 POTION <span class="item-count">({$dungeonData?.healthPotions || 0})</span>
            </button>
            {#if canRetreat()}
              <!-- Safe retreat - floor complete, keep all gold -->
              <button
                class="action-btn run safe"
                on:click={retreat}
                disabled={$combatState.isAnimating}
              >
                🚪 LEAVE
                <span class="item-count">(safe)</span>
              </button>
            {:else if $currentMonster}
              <!-- Emergency retreat - in combat, lose half gold -->
              <button
                class="action-btn run danger"
                on:click={emergencyRetreat}
                disabled={$combatState.isAnimating}
              >
                🏃 FLEE
                <span class="item-count">(½ gold)</span>
              </button>
            {/if}
          </div>

          <!-- Spell Selection Menu -->
          {#if showSpellMenu && $currentMonster}
            <div class="spell-menu">
              <div class="spell-menu-header">
                <span>Select Spell</span>
                <button class="spell-menu-close" on:click={() => showSpellMenu = false}>×</button>
              </div>
              <div class="spell-menu-list">
                {#each ($currentRun?.customSpells || []) as spell, i}
                  {#if spell}
                    <button
                      class="spell-menu-item"
                      on:click={() => { castSpell(i); showSpellMenu = false; }}
                      disabled={$currentRun.playerMp < spell.manaCost}
                    >
                      <span class="spell-menu-icon">✨</span>
                      <div class="spell-menu-info">
                        <span class="spell-menu-name">{spell.name}</span>
                        <span class="spell-menu-stats">{spell.damage} DMG</span>
                      </div>
                      <span class="spell-menu-cost" class:insufficient={$currentRun.playerMp < spell.manaCost}>
                        {spell.manaCost} MP
                      </span>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
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

  <!-- Spell Editor Modal -->
  {#if showSpellEditor}
    <div class="modal-overlay" on:click={() => showSpellEditor = false} role="button" tabindex="0" on:keypress={(e) => e.key === 'Escape' && (showSpellEditor = false)}>
      <div class="spell-modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <div class="spell-header">
          <h2>✨ {customSpells[editingSlotIndex] ? 'Edit' : 'Create'} Spell (Slot {editingSlotIndex + 1})</h2>
          <button class="close-btn" on:click={() => showSpellEditor = false}>×</button>
        </div>
        <div class="spell-content">
          <div class="spell-field">
            <label for="spell-name">Spell Name</label>
            <input
              id="spell-name"
              type="text"
              bind:value={spellName}
              placeholder="Fireball, Ice Blast, etc."
              maxlength="20"
            />
          </div>

          <div class="spell-field">
            <label for="spell-desc">Description (optional)</label>
            <input
              id="spell-desc"
              type="text"
              bind:value={spellDescription}
              placeholder="A powerful blast of fire..."
              maxlength="100"
            />
          </div>

          <div class="spell-stats">
            <div class="spell-field">
              <label for="spell-damage">Damage</label>
              <input
                id="spell-damage"
                type="number"
                bind:value={spellDamage}
                on:input={onDamageChange}
                min="1"
                max="100"
              />
            </div>

            <div class="spell-field">
              <label for="spell-mana">Mana Cost</label>
              <input
                id="spell-mana"
                type="number"
                bind:value={spellManaCost}
                min="1"
                max="200"
              />
              <span class="mana-hint">Min: {calculateManaCost(spellDamage)} MP</span>
            </div>
          </div>

          <div class="spell-preview">
            <div class="preview-card">
              <span class="preview-icon">✨</span>
              <div class="preview-info">
                <strong>{spellName || 'Unnamed Spell'}</strong>
                <span class="preview-stats">{spellDamage} DMG | {spellManaCost} MP</span>
              </div>
            </div>
          </div>

          <p class="balance-note">
            Higher damage requires more mana. You start each dungeon run with 50 MP and regenerate 5 MP after each fight.
          </p>

          {#if spellError}
            <p class="spell-error">{spellError}</p>
          {/if}

          <div class="spell-actions">
            <Button variant="primary" on:click={handleSaveSpell}>
              Save Spell
            </Button>
            {#if customSpells[editingSlotIndex]}
              <Button variant="secondary" on:click={handleDeleteSpell}>
                Delete Spell
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dungeon-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 var(--spacing-xs);
    display: flex;
    flex-direction: column;
  }

  /* Only lock height/scroll during active combat */
  .dungeon-page.in-combat {
    height: calc(100vh - var(--header-height) - var(--mobile-nav-height) - var(--spacing-lg) * 2);
    max-height: calc(100vh - var(--header-height) - var(--mobile-nav-height) - var(--spacing-lg) * 2);
    overflow: hidden;
  }

  @media (min-width: 1024px) {
    .dungeon-page.in-combat {
      height: calc(100vh - var(--header-height) - var(--spacing-lg) * 2);
      max-height: calc(100vh - var(--header-height) - var(--spacing-lg) * 2);
    }
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
    gap: var(--spacing-md);
  }

  /* ========== KNIGHTS OF PEN AND PAPER STYLE ========== */
  .battle-screen {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; /* Allow shrinking */
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-radius: var(--radius-md);
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

  /* ===== TOP HUD (Floor + Enemy) ===== */
  .battle-hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .hud-box {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    min-width: 100px;
    max-width: 140px;
  }

  .hud-box.empty {
    opacity: 0;
  }

  .hud-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .boss-tag {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1a1a1a;
    font-size: 0.5rem;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    font-weight: 700;
  }

  .hud-hp-bar {
    height: 8px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-full);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .hud-hp-bar.hp-flash {
    animation: hpFlash 0.3s ease-out;
  }

  @keyframes hpFlash {
    0%, 100% { border-color: rgba(255, 255, 255, 0.2); }
    50% { border-color: #ef4444; box-shadow: 0 0 10px #ef4444; }
  }

  .hud-hp-fill {
    height: 100%;
    transition: width 0.4s ease-out;
  }

  .hud-hp-fill.enemy-hp {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .hud-hp-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    color: var(--text-muted);
    margin-top: 1px;
  }

  /* Floor Indicator (left side) */
  .floor-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .floor-number {
    font-size: 1rem;
    font-weight: 800;
    color: var(--accent);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .room-dots {
    display: flex;
    gap: 4px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: var(--accent);
    transform: scale(1.3);
    box-shadow: 0 0 6px var(--accent);
  }

  .dot.done {
    background: var(--success);
    opacity: 0.6;
  }

  /* ===== BATTLE ARENA (Compact Monster) ===== */
  .battle-arena {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-height: 100px;
  }

  .monster-display {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .monster-emoji {
    font-size: 5rem;
    display: block;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
    animation: monsterIdle 2s ease-in-out infinite;
  }

  @keyframes monsterIdle {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-8px) scale(1.02); }
  }

  .sprite-hit .monster-emoji {
    animation: monsterHit 0.3s ease-out !important;
    filter: brightness(2) saturate(0) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
  }

  @keyframes monsterHit {
    0%, 100% { transform: translateX(0); }
    25%, 75% { transform: translateX(-10px); }
    50% { transform: translateX(10px); }
  }

  .sprite-attack .monster-emoji {
    animation: monsterAttack 0.4s ease-out !important;
  }

  @keyframes monsterAttack {
    0% { transform: scale(1); }
    40% { transform: scale(1.2) translateY(15px); }
    100% { transform: scale(1); }
  }

  .sprite-defeated .monster-emoji {
    animation: monsterDefeat 0.8s ease-out forwards !important;
  }

  @keyframes monsterDefeat {
    0% { transform: scale(1); opacity: 1; }
    30% { transform: scale(1.3); filter: brightness(2); }
    100% { transform: scale(0) rotate(180deg); opacity: 0; }
  }

  /* Floating Damage */
  .floating-damage {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    font-size: 2rem;
    font-weight: 800;
    color: #fbbf24;
    text-shadow: 3px 3px 0 #000, -1px -1px 0 #000;
    animation: floatUp 0.6s ease-out forwards;
    z-index: 10;
  }

  @keyframes floatUp {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.5); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-50px) scale(1); }
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
    width: 150px;
    height: 150px;
    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.9) 50%, transparent 70%);
    animation: slashEffect 0.25s ease-out forwards;
  }

  @keyframes slashEffect {
    0% { transform: translate(-50%, -50%) rotate(-45deg) scale(0); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translate(-50%, -50%) rotate(-45deg) scale(2.5); opacity: 0; }
  }

  .battle-effect.shield {
    font-size: 4rem;
    animation: shieldEffect 0.4s ease-out forwards;
  }

  @keyframes shieldEffect {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; }
  }

  /* ===== PLAYER BAR (below arena) ===== */
  .player-bar {
    background: rgba(0, 0, 0, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 3px var(--spacing-sm);
  }

  .player-bar.bar-flash {
    animation: barFlash 0.3s ease-out;
  }

  @keyframes barFlash {
    0%, 100% { background: rgba(0, 0, 0, 0.5); }
    50% { background: rgba(239, 68, 68, 0.3); }
  }

  .player-bar-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .bars-stack {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .gold-section {
    flex: 0 0 auto;
  }

  .bar-label {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--text-muted);
    min-width: 16px;
  }

  .bar-track {
    flex: 1;
    height: 6px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-full);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .bar-fill {
    height: 100%;
    transition: width 0.3s ease-out;
  }

  .bar-fill.hp-fill {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .bar-fill.mp-fill {
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  }

  .bar-value {
    font-size: 0.6rem;
    color: var(--text-primary);
    min-width: 40px;
    text-align: right;
  }

  .bar-damage {
    font-size: 0.65rem;
    color: #ef4444;
    font-weight: 700;
    animation: barDamageFlash 0.5s ease-out;
  }

  @keyframes barDamageFlash {
    0% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .gold-display {
    font-size: 0.75rem;
    font-weight: 600;
    color: #fbbf24;
  }

  /* Action Panel */
  .action-panel {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 8px;
    position: relative;
  }

  /* Combat Message Toast (inside battle arena) */
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
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
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

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .action-grid.has-spells {
    grid-template-columns: repeat(3, 1fr);
  }

  .action-btn {
    padding: 10px 12px;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
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
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    font-size: 0.8rem;
  }

  .action-btn.run.safe {
    border-color: #22c55e;
    color: #22c55e;
  }

  .action-btn.run.safe:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.1);
  }

  .action-btn.run.danger {
    border-color: #ef4444;
    color: #ef4444;
  }

  .action-btn.run.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
  }

  .action-btn.spell {
    border-color: #8b5cf6;
    color: #8b5cf6;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    font-size: 0.75rem;
  }

  .action-btn.spell:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.1);
  }

  /* ===== SPELL SELECTION MENU ===== */
  .spell-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 2px solid #8b5cf6;
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    box-shadow: 0 -4px 20px rgba(139, 92, 246, 0.3);
    z-index: 100;
    overflow: hidden;
  }

  .spell-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
    border-bottom: 1px solid rgba(139, 92, 246, 0.3);
    font-weight: 600;
    font-size: 0.85rem;
    color: #8b5cf6;
  }

  .spell-menu-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .spell-menu-close:hover {
    color: var(--text-primary);
  }

  .spell-menu-list {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
  }

  .spell-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .spell-menu-item:last-child {
    border-bottom: none;
  }

  .spell-menu-item:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.1);
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
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spell-menu-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .spell-menu-stats {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .spell-menu-cost {
    font-size: 0.8rem;
    font-weight: 600;
    color: #8b5cf6;
    padding: 4px 8px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: var(--radius-sm);
  }

  .spell-menu-cost.insufficient {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .item-count {
    font-size: 0.6rem;
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

  /* ========== SPELL EDITOR MODAL ========== */
  .spell-modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .spell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
  }

  .spell-header h2 {
    font-size: 1.25rem;
    color: #8b5cf6;
  }

  .spell-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    overflow-y: auto;
  }

  .spell-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .spell-field label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .spell-field input {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  .spell-field input:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  .spell-field input[type="number"] {
    width: 100%;
  }

  .spell-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .mana-hint {
    font-size: 0.75rem;
    color: #8b5cf6;
    margin-top: 2px;
  }

  .spell-preview {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .preview-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .preview-icon {
    font-size: 2rem;
  }

  .preview-info {
    display: flex;
    flex-direction: column;
  }

  .preview-info strong {
    color: #8b5cf6;
  }

  .preview-stats {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .balance-note {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: var(--spacing-sm);
    background: rgba(139, 92, 246, 0.1);
    border-radius: var(--radius-md);
  }

  .spell-error {
    color: var(--danger);
    font-size: 0.875rem;
    text-align: center;
  }

  .spell-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
  }

  /* ========== SPELL SLOTS CARD ========== */
  :global(.spell-slots-card) {
    padding: var(--spacing-md);
  }

  :global(.spell-slots-card) h3 {
    text-align: center;
    margin-bottom: var(--spacing-md);
    color: #8b5cf6;
  }

  .spell-slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--spacing-sm);
  }

  .spell-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border: 2px dashed var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 70px;
  }

  .spell-slot:hover {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
  }

  .spell-slot:not(.empty) {
    border-style: solid;
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
  }

  .slot-name {
    font-weight: 600;
    color: #8b5cf6;
    font-size: 0.9rem;
  }

  .slot-stats {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .slot-empty {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .spell-hint {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--spacing-sm);
  }
</style>
