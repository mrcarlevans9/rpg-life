<script>
  import { onDestroy } from 'svelte';
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
    getSpellSlots,
    getMaxSpellDamage,
    getSpellEditCost,
    getSpellDeleteCost,
    purchaseMerchantItem,
    leaveMerchant,
    leaveFloorMerchant,
    purchaseFloorMerchantItem,
    openLootChest,
    chooseLootChestItem,
    skipLootChest,
    useExpeditionItem,
    getTotalPotions
  } from '../lib/stores/dungeon.js';
  import { DUNGEON_UPGRADES } from '../lib/db/index.js';
  import { playerData } from '../lib/stores/player.js';
  import EquipmentInventory from '../components/game/EquipmentInventory.svelte';
  import { pendingLootData, equippedItems, equipmentData } from '../lib/stores/equipment.js';
  import { SLOT_TYPES, RARITIES } from '../lib/db/index.js';

  let showShop = false;
  let showSpellEditor = false;
  let showSpellMenu = false;
  let showInventoryMenu = false;
  let showEquipment = false;

  // Nested menu state: 'main' | 'fight' | 'spells' | 'items' | 'expedition' | 'status'
  let activeMenu = 'main';

  // Reset menu when entering combat or combat ends
  $: if ($currentMonster || !$currentRun) {
    activeMenu = 'main';
  }

  // Helper to check if there are any active status effects to show
  function hasStatusEffects(run) {
    if (!run) return false;
    const buffs = run.tempBuffs || {};
    const status = run.statusEffects || {};
    const boss = run.bossState || {};
    return (
      buffs.bonusDamage > 0 ||
      buffs.defenseBonus > 0 ||
      buffs.goldBonus > 0 ||
      status.damageReductionTurns > 0 ||
      status.extraDamageTaken > 0 ||
      status.burnTurns > 0 ||
      status.stunned ||
      status.grabbed ||
      boss.isCharging ||
      boss.skeletonActive
    );
  }

  // Derived: expedition inventory items
  $: expeditionInventory = $dungeonData?.expeditionInventory || [];

  // Derived: total potions available in current run (0 outside dungeon)
  $: runPotions = $currentRun ? getTotalPotions($currentRun) : 0;

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

  // Lock body scroll during dungeon run (active phases + any current run)
  $: inCombat = ['exploring', 'merchant', 'floor_merchant', 'loot_chest', 'loot_chest_open'].includes($gamePhase) || $currentRun !== null;
  $: if (typeof document !== 'undefined') {
    if (inCombat) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
  }

  // Clean up on component destroy
  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('no-scroll');
    }
  });

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
  $: customSpells = $playerData?.customSpells || [];
  $: playerLevel = $playerData?.level || 1;
  $: maxSpellDamage = getMaxSpellDamage(playerLevel);

  // Track edit/delete costs - set when editor opens
  let currentSpellEditCost = 0;
  let currentSpellDeleteCost = 0;
  let isEditingExistingSpell = false;

  // Close spell menu when combat state changes
  $: if ($combatState.isAnimating || !$currentMonster) showSpellMenu = false;

  // Open spell editor for a specific slot
  function openSpellEditor(slotIndex = 0) {
    editingSlotIndex = slotIndex;
    const existing = customSpells[slotIndex];

    // Calculate if this is an existing spell and what the costs would be
    isEditingExistingSpell = existing !== null && existing !== undefined && typeof existing === 'object';
    currentSpellEditCost = getSpellEditCost(slotIndex, isEditingExistingSpell);
    currentSpellDeleteCost = isEditingExistingSpell ? getSpellDeleteCost(slotIndex) : 0;

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
    // Clamp damage to max allowed
    if (spellDamage > maxSpellDamage) {
      spellDamage = maxSpellDamage;
    }
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
    const result = await deleteCustomSpell(editingSlotIndex);
    if (result.success) {
      showSpellEditor = false;
      spellError = '';
    } else {
      spellError = result.error;
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
    const canAfford = $playerData?.gold || 0 >= upgrade.cost;
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

<div class="dungeon-page" class:in-combat={inCombat}>
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
            <span class="stat-value">{$dungeonData?.upgrades?.includes('auto_potion') ? 1 : 0}</span>
            <span class="stat-label">Start Potions</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🪙</span>
            <span class="stat-value">{$playerData?.gold || 0}</span>
            <span class="stat-label">Gold</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🏔️</span>
            <span class="stat-value">{$playerData?.highestFloor || 0}</span>
            <span class="stat-label">Best Floor</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💀</span>
            <span class="stat-value">{$playerData?.totalKills || 0}</span>
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
            <li>{#if $dungeonData?.upgrades?.includes('auto_potion')}Start with 1 potion <span class="upgrade-note">(Potion Satchel)</span>{:else}No starting potions - buy from merchants{/if}</li>
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
        <Button variant="secondary" on:click={() => showEquipment = true}>
          Equipment
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

      <!-- Equipment Loadout -->
      <Card class="equipment-card">
        <div class="equipment-header">
          <h3>⚔️ Equipment</h3>
          <button class="manage-btn" on:click={() => showEquipment = true}>Manage</button>
        </div>
        <div class="equipment-slots-grid">
          {#each SLOT_TYPES as slotType}
            {@const equipped = $equippedItems?.[slotType]}
            <button
              class="equipment-slot"
              class:empty={!equipped}
              style={equipped ? `--rarity-color: ${RARITIES[equipped.rarity]?.color || '#9ca3af'}` : ''}
              on:click={() => showEquipment = true}
            >
              <span class="slot-icon">
                {#if slotType === 'weapon'}⚔️{:else if slotType === 'armor'}🛡️{:else}💍{/if}
              </span>
              {#if equipped}
                <span class="slot-name" style="color: {RARITIES[equipped.rarity]?.color || '#fff'}">{equipped.name}</span>
                <span class="slot-rarity">{RARITIES[equipped.rarity]?.name || equipped.rarity}</span>
              {:else}
                <span class="slot-empty-text">{slotType}</span>
              {/if}
            </button>
          {/each}
        </div>
        <p class="equipment-hint">
          {($equipmentData || []).length} items in inventory
          {#if ($pendingLootData || []).length > 0}
            • <span class="pending-text">{$pendingLootData.length} pending extraction</span>
          {/if}
        </p>
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
          <div class="room-enemies">
            {#each $currentRun?.floor?.rooms || [] as room, i}
              {#if room.type === 'combat' || room.type === 'boss' || room.type === 'merchant' || room.type === 'loot_chest'}
                <span
                  class="enemy-marker"
                  class:active={i === $currentRun?.floor?.currentRoom}
                  class:defeated={room.completed}
                >
                  {#if room.completed}
                    <span class="defeated-x">🚫</span>
                  {/if}
                  <span class="enemy-icon" class:faded={room.completed}>
                    {#if room.type === 'boss' && room.monster?.isMajorBoss}👑{:else if room.type === 'boss'}☠️{:else if room.type === 'merchant'}💰{:else if room.type === 'loot_chest'}🎁{:else}💀{/if}
                  </span>
                </span>
              {/if}
            {/each}
          </div>
        </div>

        <!-- Enemy HP -->
        {#if $currentMonster}
          <div class="hud-box enemy-hud" class:boss-hud={$currentMonster.isBoss}>
            <div class="hud-label">
              {$currentMonster.displayName}
              {#if $currentMonster.isMajorBoss}
                <span class="boss-tag major">BOSS</span>
              {:else if $currentMonster.isBoss}
                <span class="boss-tag">ELITE</span>
              {/if}
            </div>
            {#if $currentMonster.isBoss && $currentMonster.specialDesc}
              <div class="boss-ability-hint">
                <span class="ability-icon">⚡</span> {$currentMonster.specialDesc}
              </div>
            {/if}
            <div class="hud-hp-bar" class:hp-flash={$combatState.lastDamageToEnemy}>
              <div
                class="hud-hp-fill enemy-hp"
                class:boss-hp={$currentMonster.isBoss}
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
        <!-- Dungeon decorations -->
        <div class="dungeon-decor left">🔥</div>
        <div class="dungeon-decor right">🔥</div>

        {#if $currentMonster}
          <div
            class="monster-display"
            class:is-boss={$currentMonster.isBoss}
            class:is-major-boss={$currentMonster.isMajorBoss}
            class:sprite-hit={$combatState.lastDamageToEnemy}
            class:sprite-attack={$combatState.enemyAction === 'attack'}
            class:sprite-defeated={$combatState.monsterDefeated}
          >
            <span class="monster-emoji">{$currentMonster.emoji}</span>
            {#if $currentMonster.isBoss && $currentMonster.special}
              <span class="boss-special-badge">{$currentMonster.special}</span>
            {/if}
            {#key $combatState.lastDamageToEnemy}
              {#if $combatState.lastDamageToEnemy}
                <div class="floating-damage">-{$combatState.lastDamageToEnemy}</div>
              {/if}
            {/key}
          </div>

          <!-- Necromancer's Skeleton Ally -->
          {#if $currentRun?.bossState?.skeletonActive}
            <div class="skeleton-ally">
              <span class="skeleton-emoji">💀</span>
              <div class="skeleton-hp-bar">
                <div class="skeleton-hp-fill" style="width: {($currentRun.bossState.skeletonHp / 20) * 100}%"></div>
              </div>
              <span class="skeleton-label">Skeleton</span>
            </div>
          {/if}
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
          <!-- Gold Display -->
          <div class="gold-section">
            <div class="gold-stash">
              <span class="gold-bank" title="Safe in bank">🏦 {$currentRun?.bankGold || 0}</span>
              <span class="gold-divider">|</span>
              <span class="gold-run" title="This run (at risk)">💰 +{$currentRun?.goldCollected || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Panel -->
      <div class="action-panel">
        <!-- Nested Menu Combat UI -->
        {#if activeMenu === 'main'}
          <div class="action-grid main-menu">
            {#if $currentMonster}
              <button
                class="action-btn attack"
                on:click={() => activeMenu = 'fight'}
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
              on:click={() => activeMenu = 'items'}
              disabled={$combatState.isAnimating}
            >
              🎒 ITEMS
              {#if runPotions > 0 || expeditionInventory.length > 0 || ($pendingLootData || []).length > 0}
                <span class="item-count">
                  ({runPotions + expeditionInventory.length}{#if ($pendingLootData || []).length > 0}+{$pendingLootData.length}{/if})
                </span>
              {/if}
            </button>
            {#if hasStatusEffects($currentRun)}
              <button
                class="action-btn status"
                on:click={() => activeMenu = 'status'}
                disabled={$combatState.isAnimating}
              >
                📊 STATUS
              </button>
            {/if}
            {#if canRetreat()}
              <button
                class="action-btn run safe"
                on:click={retreat}
                disabled={$combatState.isAnimating}
              >
                🚪 LEAVE <span class="item-count">(safe)</span>
              </button>
            {:else if $currentMonster}
              <button
                class="action-btn run danger"
                on:click={emergencyRetreat}
                disabled={$combatState.isAnimating}
              >
                🏃 FLEE <span class="item-count">(½ gold)</span>
              </button>
            {/if}
          </div>

        {:else if activeMenu === 'fight'}
          <div class="action-grid submenu">
            <button
              class="action-btn attack"
              on:click={() => { playerAttack(); activeMenu = 'main'; }}
              disabled={$combatState.isAnimating}
            >
              🎲 ATTACK
            </button>
            {#if ($currentRun?.customSpells || []).filter(s => s).length > 0}
              <button
                class="action-btn spell"
                on:click={() => activeMenu = 'spells'}
                disabled={$combatState.isAnimating}
              >
                ✨ SPELLS <span class="item-count">({$currentRun?.playerMp || 0} MP)</span>
              </button>
            {/if}
            <button
              class="action-btn back"
              on:click={() => activeMenu = 'main'}
              disabled={$combatState.isAnimating}
            >
              ← BACK
            </button>
          </div>

        {:else if activeMenu === 'spells'}
          <div class="action-grid submenu spell-list">
            {#each ($currentRun?.customSpells || []) as spell, i}
              {#if spell}
                <button
                  class="action-btn spell-item"
                  on:click={() => { castSpell(i); activeMenu = 'main'; }}
                  disabled={$combatState.isAnimating || $currentRun.playerMp < spell.manaCost}
                >
                  ✨ {spell.name}
                  <span class="spell-stats">{spell.damage} DMG / {spell.manaCost} MP</span>
                </button>
              {/if}
            {/each}
            <button
              class="action-btn back"
              on:click={() => activeMenu = 'fight'}
              disabled={$combatState.isAnimating}
            >
              ← BACK
            </button>
          </div>

        {:else if activeMenu === 'items'}
          <div class="action-grid submenu">
            <button
              class="action-btn item potion"
              on:click={() => { usePotion(); activeMenu = 'main'; }}
              disabled={runPotions <= 0 || $currentRun?.playerHp >= $currentRun?.maxHp || $combatState.isAnimating}
            >
              🧪 POTION <span class="item-count">({runPotions})</span>
            </button>
            {#if expeditionInventory.length > 0}
              <button
                class="action-btn item inventory"
                on:click={() => activeMenu = 'expedition'}
                disabled={$combatState.isAnimating}
              >
                🎒 EXPEDITION <span class="item-count">({expeditionInventory.length})</span>
              </button>
            {/if}
            <button
              class="action-btn item gear"
              on:click={() => { showEquipment = true; activeMenu = 'main'; }}
              disabled={$combatState.isAnimating}
            >
              ⚙️ EQUIPMENT
              {#if ($pendingLootData || []).length > 0}
                <span class="item-count pending">({$pendingLootData.length} pending)</span>
              {/if}
            </button>
            <button
              class="action-btn back"
              on:click={() => activeMenu = 'main'}
              disabled={$combatState.isAnimating}
            >
              ← BACK
            </button>
          </div>

        {:else if activeMenu === 'expedition'}
          <div class="action-grid submenu expedition-list">
            {#each expeditionInventory as item}
              <button
                class="action-btn item expedition-item"
                on:click={async () => { await useExpeditionItem(item.id); activeMenu = 'main'; }}
                disabled={$combatState.isAnimating}
              >
                {item.emoji} {item.name}
                <span class="item-desc">{item.description}</span>
              </button>
            {/each}
            <button
              class="action-btn back"
              on:click={() => activeMenu = 'items'}
              disabled={$combatState.isAnimating}
            >
              ← BACK
            </button>
          </div>

        {:else if activeMenu === 'status'}
          <div class="status-panel">
            <h4>Status Effects</h4>
            <div class="status-list">
              {#if $currentRun?.tempBuffs?.bonusDamage > 0}
                <div class="status-item buff">⚔️ +{$currentRun.tempBuffs.bonusDamage} Damage</div>
              {/if}
              {#if $currentRun?.tempBuffs?.defenseBonus > 0}
                <div class="status-item buff">🛡️ +{$currentRun.tempBuffs.defenseBonus} Defense</div>
              {/if}
              {#if $currentRun?.tempBuffs?.goldBonus > 0}
                <div class="status-item buff">💰 +{$currentRun.tempBuffs.goldBonus} Gold/kill</div>
              {/if}
              {#if $currentRun?.statusEffects?.damageReductionTurns > 0}
                <div class="status-item debuff">💔 -{$currentRun.statusEffects.damageReduction} Damage ({$currentRun.statusEffects.damageReductionTurns} turns)</div>
              {/if}
              {#if $currentRun?.statusEffects?.extraDamageTaken > 0}
                <div class="status-item debuff">🔮 +{$currentRun.statusEffects.extraDamageTaken} Damage Taken (Hex)</div>
              {/if}
              {#if $currentRun?.statusEffects?.burnTurns > 0}
                <div class="status-item debuff">🔥 {$currentRun.statusEffects.burnDamage} Burn/turn ({$currentRun.statusEffects.burnTurns} turns)</div>
              {/if}
              {#if $currentRun?.statusEffects?.stunned}
                <div class="status-item debuff">⚡ Stunned!</div>
              {/if}
              {#if $currentRun?.statusEffects?.grabbed}
                <div class="status-item debuff">🦑 Grabbed!</div>
              {/if}
              {#if $currentRun?.bossState?.isCharging}
                <div class="status-item warning">🐂 Boss is charging!</div>
              {/if}
              {#if $currentRun?.bossState?.skeletonActive}
                <div class="status-item enemy">💀 Skeleton Ally ({$currentRun.bossState.skeletonHp} HP)</div>
              {/if}
            </div>
            <button
              class="action-btn back"
              on:click={() => activeMenu = 'main'}
            >
              ← BACK
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Merchant Encounter -->
  {#if $gamePhase === 'merchant'}
    {@const room = $currentRun?.floor?.rooms[$currentRun?.floor?.currentRoom]}
    {@const merchant = room?.merchant}
    {@const totalGold = ($currentRun?.goldCollected || 0) + ($currentRun?.bankGold || 0)}
    <div class="merchant-screen">
      <div class="merchant-header">
        <span class="merchant-emoji">{merchant?.emoji || '🧌'}</span>
        <h2>Goblin Merchant</h2>
        <p class="merchant-greeting">"{merchant?.greeting}"</p>
      </div>

      <div class="merchant-gold">
        <span class="gold-available">🪙 {totalGold} total gold</span>
        <span class="gold-breakdown">(💰 {$currentRun?.goldCollected || 0} run + 🏦 {$currentRun?.bankGold || 0} bank)</span>
      </div>

      <div class="merchant-items">
        {#if merchant?.items?.length > 0}
          {#each merchant.items as item}
            <div class="merchant-item">
              <div class="item-icon">{item.emoji}</div>
              <div class="item-info">
                <span class="item-name">{item.name}</span>
                <span class="item-desc">{item.description}</span>
              </div>
              <button
                class="item-buy"
                disabled={totalGold < item.cost}
                on:click={() => purchaseMerchantItem(item.key)}
              >
                🪙 {item.cost}
              </button>
            </div>
          {/each}
        {:else}
          <p class="no-items">"Sold out! Come back next time!"</p>
        {/if}
      </div>

      <div class="merchant-actions">
        <Button variant="secondary" on:click={leaveMerchant}>
          Continue Journey
        </Button>
      </div>

      <!-- Show temp buffs if any -->
      {#if $currentRun?.tempBuffs && ($currentRun.tempBuffs.bonusDamage > 0 || $currentRun.tempBuffs.defenseBonus > 0 || $currentRun.tempBuffs.goldBonus > 0)}
        <div class="active-buffs">
          <span class="buffs-label">Active Buffs:</span>
          {#if $currentRun.tempBuffs.bonusDamage > 0}
            <span class="buff">💪 +{$currentRun.tempBuffs.bonusDamage} DMG</span>
          {/if}
          {#if $currentRun.tempBuffs.defenseBonus > 0}
            <span class="buff">🛡️ +{$currentRun.tempBuffs.defenseBonus} DEF</span>
          {/if}
          {#if $currentRun.tempBuffs.goldBonus > 0}
            <span class="buff">🍀 +{$currentRun.tempBuffs.goldBonus} Gold/kill</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Loot Chest Encounter - Unopened -->
  {#if $gamePhase === 'loot_chest'}
    {@const room = $currentRun?.floor?.rooms[$currentRun?.floor?.currentRoom]}
    <div class="loot-chest-screen">
      <div class="chest-header">
        <span class="chest-emoji chest-closed">📦</span>
        <h2>Mysterious Chest!</h2>
        <p class="chest-subtitle">Do you dare open it?</p>
        <p class="chest-warning">⚠️ Beware... some chests are not what they seem...</p>
      </div>

      <div class="chest-actions">
        <button class="chest-action-btn open" on:click={openLootChest}>
          🔓 Open Chest
        </button>
        <button class="chest-action-btn skip" on:click={skipLootChest}>
          🚶 Walk Past
        </button>
      </div>

      <!-- Show temp buffs if any -->
      {#if $currentRun?.tempBuffs && ($currentRun.tempBuffs.bonusDamage > 0 || $currentRun.tempBuffs.defenseBonus > 0 || $currentRun.tempBuffs.goldBonus > 0)}
        <div class="active-buffs">
          <span class="buffs-label">Active Buffs:</span>
          {#if $currentRun.tempBuffs.bonusDamage > 0}
            <span class="buff">💪 +{$currentRun.tempBuffs.bonusDamage} DMG</span>
          {/if}
          {#if $currentRun.tempBuffs.defenseBonus > 0}
            <span class="buff">🛡️ +{$currentRun.tempBuffs.defenseBonus} DEF</span>
          {/if}
          {#if $currentRun.tempBuffs.goldBonus > 0}
            <span class="buff">🍀 +{$currentRun.tempBuffs.goldBonus} Gold/kill</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Loot Chest Opened - Choose Item -->
  {#if $gamePhase === 'loot_chest_open'}
    {@const room = $currentRun?.floor?.rooms[$currentRun?.floor?.currentRoom]}
    <div class="loot-chest-screen chest-opened">
      <div class="chest-header">
        <span class="chest-emoji">🎁</span>
        <h2>Treasure!</h2>
        <p class="chest-subtitle">Choose one reward</p>
      </div>

      <div class="chest-items">
        {#each room?.items || [] as item}
          <button
            class="chest-item"
            on:click={() => chooseLootChestItem(item.key)}
          >
            <div class="chest-item-icon">{item.emoji}</div>
            <div class="chest-item-info">
              <span class="chest-item-name">{item.name}</span>
              <span class="chest-item-desc">{item.description}</span>
            </div>
            <span class="chest-item-free">FREE</span>
          </button>
        {/each}
      </div>

      <!-- Show temp buffs if any -->
      {#if $currentRun?.tempBuffs && ($currentRun.tempBuffs.bonusDamage > 0 || $currentRun.tempBuffs.defenseBonus > 0 || $currentRun.tempBuffs.goldBonus > 0)}
        <div class="active-buffs">
          <span class="buffs-label">Active Buffs:</span>
          {#if $currentRun.tempBuffs.bonusDamage > 0}
            <span class="buff">💪 +{$currentRun.tempBuffs.bonusDamage} DMG</span>
          {/if}
          {#if $currentRun.tempBuffs.defenseBonus > 0}
            <span class="buff">🛡️ +{$currentRun.tempBuffs.defenseBonus} DEF</span>
          {/if}
          {#if $currentRun.tempBuffs.goldBonus > 0}
            <span class="buff">🍀 +{$currentRun.tempBuffs.goldBonus} Gold/kill</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Floor Complete Merchant -->
  {#if $gamePhase === 'floor_merchant'}
    {@const merchant = $currentRun?.floorMerchant}
    {@const floorTotalGold = ($currentRun?.goldCollected || 0) + ($currentRun?.bankGold || 0)}
    <div class="merchant-screen floor-merchant">
      <div class="merchant-header">
        <span class="merchant-emoji">{merchant?.emoji || '🧌'}</span>
        <h2>Goblin Merchant</h2>
        <p class="merchant-greeting">"{merchant?.greeting}"</p>
        {#if merchant?.afterBoss}
          <span class="floor-complete-badge boss-cleared">🏆 Floor {$currentRun?.currentFloor} Complete!</span>
          <span class="gold-collected-notice">+{merchant.bossGoldEarned} gold added to your run!</span>
        {:else}
          <span class="floor-complete-badge">Floor {$currentRun?.currentFloor} Complete!</span>
        {/if}
      </div>

      <div class="merchant-gold">
        <span class="gold-available">🪙 {floorTotalGold} total gold</span>
        <span class="gold-breakdown">(💰 {$currentRun?.goldCollected || 0} run + 🏦 {$currentRun?.bankGold || 0} bank)</span>
      </div>

      <div class="merchant-items">
        {#if merchant?.items?.length > 0}
          {#each merchant.items as item}
            <div class="merchant-item">
              <div class="item-icon">{item.emoji}</div>
              <div class="item-info">
                <span class="item-name">{item.name}</span>
                <span class="item-desc">{item.description}</span>
              </div>
              <button
                class="item-buy"
                disabled={floorTotalGold < item.cost}
                on:click={() => purchaseFloorMerchantItem(item.key)}
              >
                🪙 {item.cost}
              </button>
            </div>
          {/each}
        {:else}
          <p class="no-items">"All sold out! Better luck next floor!"</p>
        {/if}
      </div>

      <div class="merchant-actions">
        <Button variant="primary" on:click={leaveFloorMerchant}>
          ⬇️ Descend to Floor {($currentRun?.currentFloor || 0) + 1}
        </Button>
        <Button variant="ghost" on:click={retreat}>
          🚪 Exit Dungeon (Keep {$currentRun?.goldCollected || 0} gold)
        </Button>
      </div>

      <!-- Show temp buffs if any -->
      {#if $currentRun?.tempBuffs && ($currentRun.tempBuffs.bonusDamage > 0 || $currentRun.tempBuffs.defenseBonus > 0 || $currentRun.tempBuffs.goldBonus > 0)}
        <div class="active-buffs">
          <span class="buffs-label">Active Buffs:</span>
          {#if $currentRun.tempBuffs.bonusDamage > 0}
            <span class="buff">💪 +{$currentRun.tempBuffs.bonusDamage} DMG</span>
          {/if}
          {#if $currentRun.tempBuffs.defenseBonus > 0}
            <span class="buff">🛡️ +{$currentRun.tempBuffs.defenseBonus} DEF</span>
          {/if}
          {#if $currentRun.tempBuffs.goldBonus > 0}
            <span class="buff">🍀 +{$currentRun.tempBuffs.goldBonus} Gold/kill</span>
          {/if}
        </div>
      {/if}
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
          <span class="shop-gold">🪙 {$playerData?.gold || 0}</span>
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
              <label for="spell-damage">Damage (Max: {maxSpellDamage})</label>
              <input
                id="spell-damage"
                type="number"
                bind:value={spellDamage}
                on:input={onDamageChange}
                min="1"
                max={maxSpellDamage}
              />
              <span class="damage-hint">
                {#if playerLevel < 10}
                  Level 10 unlocks max 50 DMG
                {:else if playerLevel < 25}
                  Level 25 unlocks max 75 DMG
                {:else if playerLevel < 50}
                  Level 50 unlocks max 100 DMG
                {:else}
                  Maximum power unlocked!
                {/if}
              </span>
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
            Higher damage requires more mana. You start each run with 50 MP and regenerate 5 MP after each fight.
          </p>

          {#if isEditingExistingSpell}
            <div class="spell-cost-box">
              <div class="cost-header">
                <span class="cost-icon">⚙️</span>
                <span>Spell Modification Costs</span>
                <span class="gold-amount">You have: <strong>{$playerData?.gold || 0}g</strong></span>
              </div>
              <div class="cost-items">
                <div class="cost-item" class:affordable={($playerData?.gold || 0) >= currentSpellEditCost}>
                  <span>Edit:</span>
                  <span class="cost-value">{currentSpellEditCost}g</span>
                </div>
                <div class="cost-item" class:affordable={($playerData?.gold || 0) >= currentSpellDeleteCost}>
                  <span>Delete:</span>
                  <span class="cost-value">{currentSpellDeleteCost}g</span>
                </div>
              </div>
            </div>
          {/if}

          {#if spellError}
            <p class="spell-error">{spellError}</p>
          {/if}

          <div class="spell-actions">
            <Button
              variant="primary"
              on:click={handleSaveSpell}
              disabled={currentSpellEditCost > 0 && ($playerData?.gold || 0) < currentSpellEditCost}
            >
              {#if currentSpellEditCost > 0}
                Save ({currentSpellEditCost}g)
              {:else}
                Create Spell
              {/if}
            </Button>
            {#if customSpells[editingSlotIndex]}
              <Button
                variant="danger"
                on:click={handleDeleteSpell}
                disabled={($playerData?.gold || 0) < currentSpellDeleteCost}
              >
                Delete ({currentSpellDeleteCost}g)
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Equipment Inventory Modal -->
<EquipmentInventory bind:isOpen={showEquipment} on:close={() => showEquipment = false} />

<style>
  .dungeon-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 var(--spacing-xs);
    display: flex;
    flex-direction: column;
  }

  /* Use fixed positioning during combat to avoid scroll issues */
  .dungeon-page.in-combat {
    position: fixed;
    top: var(--header-height);
    left: 0;
    right: 0;
    bottom: var(--mobile-nav-height);
    height: auto;
    max-height: none;
    overflow: hidden;
    padding: 0 var(--spacing-xs);
    z-index: 10;
  }

  @media (min-width: 1024px) {
    .dungeon-page.in-combat {
      left: var(--sidebar-width);
      bottom: 0;
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
    padding: 4px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
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
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    font-size: 0.5rem;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .boss-tag.major {
    background: linear-gradient(135deg, #dc2626, #991b1b);
    animation: bossPulse 1.5s ease-in-out infinite;
  }

  @keyframes bossPulse {
    0%, 100% { box-shadow: 0 0 4px rgba(220, 38, 38, 0.5); }
    50% { box-shadow: 0 0 12px rgba(220, 38, 38, 0.8); }
  }

  .boss-hud {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .boss-ability-hint {
    font-size: 0.6rem;
    color: #fbbf24;
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ability-icon {
    font-size: 0.7rem;
  }

  .hud-hp-fill.boss-hp {
    background: linear-gradient(90deg, #ef4444, #dc2626);
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

  .room-enemies {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .enemy-marker {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .enemy-icon {
    font-size: 1.1rem;
    transition: all 0.2s ease;
  }

  .enemy-icon.faded {
    opacity: 0.3;
    filter: grayscale(100%);
  }

  .enemy-marker.active .enemy-icon {
    font-size: 1.3rem;
    filter: drop-shadow(0 0 4px var(--accent));
    animation: enemyPulse 1.5s ease-in-out infinite;
  }

  .defeated-x {
    position: absolute;
    font-size: 1.3rem;
    z-index: 1;
    filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));
  }

  @keyframes enemyPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  /* ===== BATTLE ARENA (Compact Monster) ===== */
  .battle-arena {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  /* Dungeon background scene */
  .battle-arena::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      /* Stone floor pattern */
      linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%),
      /* Stone wall texture */
      repeating-linear-gradient(
        90deg,
        rgba(60, 60, 80, 0.3) 0px,
        rgba(40, 40, 60, 0.3) 2px,
        rgba(50, 50, 70, 0.2) 4px
      ),
      repeating-linear-gradient(
        0deg,
        rgba(60, 60, 80, 0.2) 0px,
        rgba(40, 40, 60, 0.2) 20px,
        rgba(50, 50, 70, 0.3) 40px
      );
    pointer-events: none;
    z-index: 0;
  }

  /* Dungeon decorations (torches) */
  .dungeon-decor {
    position: absolute;
    top: 20%;
    font-size: 1.8rem;
    z-index: 1;
    animation: torchFlicker 1s ease-in-out infinite alternate;
    text-shadow: 0 0 20px rgba(255, 150, 50, 0.8), 0 0 40px rgba(255, 100, 0, 0.4);
  }

  .dungeon-decor.left {
    left: 8px;
    animation-delay: 0s;
  }

  .dungeon-decor.right {
    right: 8px;
    animation-delay: 0.5s;
  }

  @keyframes torchFlicker {
    0% { opacity: 0.7; transform: scale(1) translateY(0); }
    50% { opacity: 0.9; transform: scale(1.05) translateY(-2px); }
    100% { opacity: 1; transform: scale(1.1) translateY(0); }
  }

  .monster-display {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .monster-emoji {
    font-size: 5rem;
    display: block;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
    animation: monsterIdle 2s ease-in-out infinite;
  }

  /* Boss styling - larger and more imposing */
  .monster-display.is-boss .monster-emoji {
    font-size: 7rem;
    filter: drop-shadow(0 8px 20px rgba(255, 100, 100, 0.5));
    animation: bossIdle 2s ease-in-out infinite;
  }

  .monster-display.is-major-boss .monster-emoji {
    font-size: 8rem;
    filter: drop-shadow(0 10px 30px rgba(255, 50, 50, 0.6));
    animation: majorBossIdle 1.5s ease-in-out infinite;
  }

  @keyframes bossIdle {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-10px) scale(1.05); }
  }

  @keyframes majorBossIdle {
    0%, 100% { transform: translateY(0) scale(1) rotate(-1deg); }
    25% { transform: translateY(-8px) scale(1.03) rotate(1deg); }
    50% { transform: translateY(-12px) scale(1.06) rotate(-1deg); }
    75% { transform: translateY(-8px) scale(1.03) rotate(1deg); }
  }

  .boss-special-badge {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 10px;
    background: linear-gradient(135deg, #ff4444, #cc0000);
    border: 2px solid #ff6666;
    border-radius: 12px;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(255, 0, 0, 0.4);
  }

  .monster-display.is-major-boss .boss-special-badge {
    background: linear-gradient(135deg, #9b59b6, #6c3483);
    border-color: #bb8fce;
    box-shadow: 0 2px 12px rgba(155, 89, 182, 0.5);
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

  /* Skeleton Ally (Necromancer summon) */
  .skeleton-ally {
    position: absolute;
    right: 15%;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    animation: skeletonFloat 2s ease-in-out infinite, skeletonAppear 0.5s ease-out;
  }

  @keyframes skeletonAppear {
    0% { opacity: 0; transform: translateY(-50%) scale(0); }
    50% { transform: translateY(-50%) scale(1.2); }
    100% { opacity: 1; transform: translateY(-50%) scale(1); }
  }

  @keyframes skeletonFloat {
    0%, 100% { transform: translateY(-50%) translateX(0); }
    50% { transform: translateY(-55%) translateX(3px); }
  }

  .skeleton-emoji {
    font-size: 3rem;
    filter: drop-shadow(0 0 10px rgba(200, 200, 200, 0.5));
    animation: skeletonPulse 1s ease-in-out infinite;
  }

  @keyframes skeletonPulse {
    0%, 100% { filter: drop-shadow(0 0 10px rgba(200, 200, 200, 0.5)); }
    50% { filter: drop-shadow(0 0 20px rgba(200, 200, 200, 0.8)); }
  }

  .skeleton-hp-bar {
    width: 50px;
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
  }

  .skeleton-hp-fill {
    height: 100%;
    background: linear-gradient(90deg, #888, #aaa);
    transition: width 0.3s ease;
  }

  .skeleton-label {
    font-size: 0.6rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    padding: 2px var(--spacing-sm);
    flex-shrink: 0;
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

  .gold-section {
    display: flex;
    justify-content: center;
  }

  .gold-stash {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .gold-bank {
    color: #94a3b8;
  }

  .gold-divider {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .gold-run {
    color: #fbbf24;
  }

  /* Action Panel */
  .action-panel {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 10px;
    position: relative;
    flex-shrink: 0;
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
    gap: 8px;
  }

  .action-grid.main-menu {
    grid-template-columns: repeat(2, 1fr);
  }

  .action-grid.submenu {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .action-grid.spell-list,
  .action-grid.expedition-list {
    grid-template-columns: 1fr;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .action-grid.has-spells {
    grid-template-columns: repeat(3, 1fr);
  }

  .action-btn {
    padding: 14px 16px;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.95rem;
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

  .action-btn.back {
    border-color: #6b7280;
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .action-btn.back:hover:not(:disabled) {
    background: rgba(107, 114, 128, 0.1);
    color: white;
  }

  .action-btn.status {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .action-btn.status:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.1);
  }

  .action-btn.spell-item {
    border-color: #8b5cf6;
    color: #a78bfa;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 10px 12px;
  }

  .action-btn.spell-item:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.15);
  }

  .action-btn.spell-item:disabled {
    opacity: 0.4;
    border-color: #4b5563;
    color: #6b7280;
  }

  .spell-stats {
    font-size: 0.7rem;
    color: #9ca3af;
    margin-top: 2px;
  }

  .action-btn.expedition-item {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 10px 12px;
  }

  .item-desc {
    font-size: 0.7rem;
    color: #9ca3af;
    margin-top: 2px;
  }

  /* Status Panel */
  .status-panel {
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .status-panel h4 {
    margin: 0;
    font-size: 0.85rem;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 150px;
    overflow-y: auto;
  }

  .status-item {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
  }

  .status-item.buff {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border-left: 2px solid #22c55e;
  }

  .status-item.debuff {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border-left: 2px solid #ef4444;
  }

  .status-item.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
    border-left: 2px solid #f59e0b;
  }

  .status-item.enemy {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border-left: 2px solid #8b5cf6;
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

  /* Inventory Menu */
  .inventory-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 2px solid #f59e0b;
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    box-shadow: 0 -4px 20px rgba(245, 158, 11, 0.3);
    z-index: 100;
    overflow: hidden;
  }

  .inventory-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 179, 8, 0.2));
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    font-weight: 600;
    font-size: 0.85rem;
    color: #f59e0b;
  }

  .inventory-menu-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .inventory-menu-close:hover {
    color: var(--text-primary);
  }

  .inventory-menu-list {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
  }

  .inventory-menu-item {
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

  .inventory-menu-item:last-child {
    border-bottom: none;
  }

  .inventory-menu-item:hover {
    background: rgba(245, 158, 11, 0.1);
  }

  .inventory-menu-icon {
    font-size: 1.5rem;
  }

  .inventory-menu-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .inventory-menu-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .inventory-menu-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .action-btn.item.inventory {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }

  .action-btn.item.inventory:hover:not(:disabled) {
    background: linear-gradient(135deg, #d97706, #b45309);
  }

  .item-count {
    font-size: 0.6rem;
    opacity: 0.8;
  }

  .item-count.pending {
    color: #fbbf24;
    opacity: 1;
    font-weight: 600;
  }

  .action-btn.gear {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
  }

  .action-btn.gear:hover:not(:disabled) {
    background: linear-gradient(135deg, #818cf8, #6366f1);
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

  .upgrade-note {
    font-size: 0.8em;
    color: var(--success);
    font-weight: 500;
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

  .damage-hint {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 2px;
    font-style: italic;
  }

  /* Spell Cost Box */
  .spell-cost-box {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05));
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: var(--spacing-md);
  }

  .spell-cost-box .cost-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(251, 191, 36, 0.15);
    font-size: 0.8rem;
    font-weight: 600;
    color: #fbbf24;
  }

  .spell-cost-box .cost-icon {
    font-size: 0.9rem;
  }

  .spell-cost-box .gold-amount {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .spell-cost-box .gold-amount strong {
    color: #fbbf24;
  }

  .spell-cost-box .cost-items {
    display: flex;
    gap: var(--spacing-lg);
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .spell-cost-box .cost-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .spell-cost-box .cost-item.affordable {
    color: var(--text-primary);
  }

  .spell-cost-box .cost-item .cost-value {
    font-weight: 600;
    color: #ef4444;
  }

  .spell-cost-box .cost-item.affordable .cost-value {
    color: #22c55e;
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

  /* ========== EQUIPMENT CARD ========== */
  :global(.equipment-card) {
    padding: var(--spacing-md);
  }

  .equipment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .equipment-header h3 {
    margin: 0;
    color: #6366f1;
  }

  .manage-btn {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid #6366f1;
    color: #6366f1;
    padding: 4px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .manage-btn:hover {
    background: rgba(99, 102, 241, 0.3);
  }

  .equipment-slots-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }

  .equipment-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--spacing-sm);
    background: var(--bg-secondary);
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 70px;
    text-align: center;
  }

  .equipment-slot:hover {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
  }

  .equipment-slot:not(.empty) {
    border-style: solid;
    border-color: var(--rarity-color, #6366f1);
    background: rgba(99, 102, 241, 0.05);
  }

  .equipment-slot .slot-icon {
    font-size: 1.2rem;
  }

  .equipment-slot .slot-name {
    font-size: 0.75rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .equipment-slot .slot-rarity {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .equipment-slot .slot-empty-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .equipment-hint {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--spacing-sm);
  }

  .equipment-hint .pending-text {
    color: #fbbf24;
  }

  /* ========== MERCHANT ENCOUNTER ========== */
  .merchant-screen {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: linear-gradient(180deg, #2d1b0e 0%, #1a1a2e 50%, #16213e 100%);
    border-radius: var(--radius-md);
    min-height: 400px;
  }

  .merchant-header {
    text-align: center;
    padding: var(--spacing-md);
  }

  .merchant-emoji {
    font-size: 4rem;
    display: block;
    animation: merchantBobble 2s ease-in-out infinite;
  }

  @keyframes merchantBobble {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  .merchant-header h2 {
    color: #fbbf24;
    margin: var(--spacing-sm) 0;
  }

  .merchant-greeting {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.9rem;
  }

  .merchant-gold {
    text-align: center;
    padding: var(--spacing-sm);
    background: rgba(251, 191, 36, 0.1);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .merchant-gold .gold-available {
    font-size: 1.1rem;
    font-weight: 600;
    color: #fbbf24;
  }

  .merchant-gold .gold-breakdown {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .merchant-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex: 1;
    overflow-y: auto;
  }

  .merchant-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
  }

  .merchant-item:hover {
    border-color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .item-icon {
    font-size: 1.75rem;
    min-width: 40px;
    text-align: center;
  }

  .item-info {
    flex: 1;
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

  .item-buy {
    padding: 8px 16px;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    border: none;
    border-radius: var(--radius-md);
    color: #1a1a1a;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .item-buy:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  }

  .item-buy:disabled {
    background: var(--bg-tertiary);
    color: var(--text-muted);
    cursor: not-allowed;
  }

  .no-items {
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
    padding: var(--spacing-lg);
  }

  .merchant-actions {
    display: flex;
    justify-content: center;
    padding-top: var(--spacing-md);
  }

  .active-buffs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: var(--radius-md);
  }

  .buffs-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .buff {
    font-size: 0.8rem;
    padding: 4px 8px;
    background: rgba(34, 197, 94, 0.2);
    border-radius: var(--radius-sm);
    color: #22c55e;
    font-weight: 600;
  }

  /* Floor complete merchant styling */
  .merchant-screen.floor-merchant {
    background: linear-gradient(180deg, #1a3d1a 0%, #1a1a2e 50%, #16213e 100%);
  }

  .floor-complete-badge {
    display: inline-block;
    margin-top: var(--spacing-sm);
    padding: 6px 16px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    border-radius: var(--radius-full);
    animation: badgePulse 2s ease-in-out infinite;
  }

  @keyframes badgePulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(34, 197, 94, 0); }
    50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(34, 197, 94, 0.5); }
  }

  .floor-complete-badge.boss-cleared {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    animation: bossVictoryPulse 1.5s ease-in-out infinite;
  }

  @keyframes bossVictoryPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
    50% { transform: scale(1.08); box-shadow: 0 0 25px rgba(245, 158, 11, 0.6); }
  }

  .gold-collected-notice {
    display: block;
    margin-top: var(--spacing-xs);
    color: #fcd34d;
    font-weight: 600;
    font-size: 0.9rem;
    animation: goldShine 2s ease-in-out infinite;
  }

  @keyframes goldShine {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; text-shadow: 0 0 10px rgba(252, 211, 77, 0.8); }
  }

  /* ========== LOOT CHEST ENCOUNTER ========== */
  .loot-chest-screen {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: linear-gradient(180deg, #3d2b1a 0%, #2d1b0e 50%, #1a1a2e 100%);
    border-radius: var(--radius-md);
    min-height: 400px;
  }

  .chest-header {
    text-align: center;
    padding: var(--spacing-md);
  }

  .chest-emoji {
    font-size: 5rem;
    display: block;
    animation: chestGlow 1.5s ease-in-out infinite alternate;
  }

  @keyframes chestGlow {
    0% { filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); transform: scale(1); }
    100% { filter: drop-shadow(0 0 25px rgba(251, 191, 36, 0.8)); transform: scale(1.05); }
  }

  .chest-header h2 {
    color: #fbbf24;
    margin: var(--spacing-sm) 0;
    font-size: 1.5rem;
  }

  .chest-subtitle {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .chest-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    flex: 1;
  }

  .chest-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05));
    border: 2px solid rgba(251, 191, 36, 0.3);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .chest-item:hover {
    border-color: #fbbf24;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1));
    transform: translateX(5px);
    box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);
  }

  .chest-item-icon {
    font-size: 2.5rem;
    min-width: 50px;
    text-align: center;
  }

  .chest-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chest-item-name {
    font-weight: 700;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .chest-item-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .chest-item-free {
    padding: 6px 12px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    font-weight: 700;
    font-size: 0.8rem;
    border-radius: var(--radius-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Closed chest styling */
  .chest-closed {
    animation: chestShake 2s ease-in-out infinite;
  }

  @keyframes chestShake {
    0%, 100% { transform: rotate(-2deg); }
    25% { transform: rotate(2deg); }
    50% { transform: rotate(-2deg); }
    75% { transform: rotate(1deg); }
  }

  .chest-warning {
    color: #f59e0b;
    font-size: 0.85rem;
    margin-top: var(--spacing-sm);
    animation: warningPulse 1.5s ease-in-out infinite;
  }

  @keyframes warningPulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .chest-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
  }

  .chest-action-btn {
    padding: var(--spacing-lg);
    border: 2px solid;
    border-radius: var(--radius-md);
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .chest-action-btn.open {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1));
    border-color: #fbbf24;
    color: #fbbf24;
  }

  .chest-action-btn.open:hover {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.2));
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
  }

  .chest-action-btn.skip {
    background: rgba(0, 0, 0, 0.3);
    border-color: var(--text-muted);
    color: var(--text-muted);
  }

  .chest-action-btn.skip:hover {
    background: rgba(0, 0, 0, 0.5);
    border-color: var(--text-secondary);
    color: var(--text-secondary);
  }

  /* Opened chest has green tint */
  .chest-opened {
    background: linear-gradient(180deg, #1a3d1a 0%, #2d1b0e 50%, #1a1a2e 100%);
  }
</style>
