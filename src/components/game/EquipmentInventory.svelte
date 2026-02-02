<script>
  import { createEventDispatcher } from 'svelte';
  import {
    equipmentData,
    equippedItems,
    equippedStats,
    pendingLootData,
    equipItem,
    unequipItem,
    sellItem,
    getSellValue,
    getRarityColor,
    formatAttribute
  } from '../../lib/stores/equipment.js';
  import { playerData } from '../../lib/stores/player.js';
  import { SLOT_TYPES, RARITIES } from '../../lib/db/index.js';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  // View mode: 'inventory' | 'equipped' | 'stats'
  let viewMode = 'inventory';

  // Selected item for details view
  let selectedItem = null;

  // Confirm sell state
  let confirmSellId = null;

  $: inventory = $equipmentData || [];
  $: equipped = $equippedItems || { weapon: null, armor: null, accessory: null };
  $: stats = $equippedStats || {};
  $: pendingLoot = $pendingLootData || [];
  $: gold = $playerData?.gold || 0;
  $: inventorySlots = $playerData?.inventorySlots || 15;

  // Filter inventory by slot for display
  $: weapons = inventory.filter(i => i.slot === 'weapon' && !i.equipped);
  $: armors = inventory.filter(i => i.slot === 'armor' && !i.equipped);
  $: accessories = inventory.filter(i => i.slot === 'accessory' && !i.equipped);

  function close() {
    isOpen = false;
    selectedItem = null;
    confirmSellId = null;
    dispatch('close');
  }

  async function handleEquip(item) {
    const result = await equipItem(item.id);
    if (result.success) {
      selectedItem = null;
    }
  }

  async function handleUnequip(item) {
    const result = await unequipItem(item.id);
    if (result.success) {
      selectedItem = null;
    }
  }

  async function handleSell(item) {
    if (confirmSellId !== item.id) {
      confirmSellId = item.id;
      return;
    }
    const result = await sellItem(item.id);
    if (result.success) {
      selectedItem = null;
      confirmSellId = null;
    }
  }

  function cancelSell() {
    confirmSellId = null;
  }

  function selectItem(item) {
    selectedItem = item;
    confirmSellId = null;
  }

  function getSlotIcon(slot) {
    switch (slot) {
      case 'weapon': return '⚔️';
      case 'armor': return '🛡️';
      case 'accessory': return '💍';
      default: return '📦';
    }
  }

  function formatStatValue(key, value) {
    // Boolean stats
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    // Percentage stats
    if (['critChance', 'critDamage', 'blockChance', 'doubleStrike', 'xpBonus', 'potionEfficiency', 'guildBossDamage', 'contributionBonus', 'pvpDamage', 'pvpDefense', 'treasureHunter', 'ambush', 'scavenger', 'fortify'].includes(key)) {
      return `+${value}%`;
    }
    // Regular numeric stats
    return `+${value}`;
  }

  // Get non-zero stats for display
  $: displayStats = Object.entries(stats)
    .filter(([key, value]) => {
      if (key === 'penalties') return false;
      if (typeof value === 'boolean') return value === true;
      return value !== 0;
    })
    .map(([key, value]) => ({ key, value }));
</script>

{#if isOpen}
  <div class="equipment-overlay" on:click={close} role="button" tabindex="0" on:keypress={(e) => e.key === 'Escape' && close()}>
    <div class="equipment-modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <h2>Equipment</h2>
        <div class="header-info">
          <span class="gold">💰 {gold}</span>
          <span class="slots">{inventory.length}/{inventorySlots}</span>
        </div>
        <button class="close-btn" on:click={close}>×</button>
      </div>

      <div class="view-tabs">
        <button
          class="tab"
          class:active={viewMode === 'inventory'}
          on:click={() => viewMode = 'inventory'}
        >
          Inventory
        </button>
        <button
          class="tab"
          class:active={viewMode === 'equipped'}
          on:click={() => viewMode = 'equipped'}
        >
          Equipped
        </button>
        <button
          class="tab"
          class:active={viewMode === 'stats'}
          on:click={() => viewMode = 'stats'}
        >
          Stats
        </button>
      </div>

      <div class="modal-content">
        {#if viewMode === 'inventory'}
          <div class="inventory-grid">
            {#if inventory.length === 0}
              <div class="empty-message">
                No equipment yet. Defeat monsters to find loot!
              </div>
            {:else}
              {#each SLOT_TYPES as slotType}
                {@const slotItems = inventory.filter(i => i.slot === slotType && !i.equipped)}
                {#if slotItems.length > 0}
                  <div class="slot-section">
                    <h3>{getSlotIcon(slotType)} {slotType.charAt(0).toUpperCase() + slotType.slice(1)}s</h3>
                    <div class="items-list">
                      {#each slotItems as item}
                        <button
                          class="item-card"
                          class:selected={selectedItem?.id === item.id}
                          style="--rarity-color: {getRarityColor(item.rarity)}"
                          on:click={() => selectItem(item)}
                        >
                          <span class="item-name">{item.emoji || ''} {item.name}</span>
                          <span class="item-rarity" style="color: {getRarityColor(item.rarity)}">
                            {RARITIES[item.rarity]?.name || item.rarity}
                          </span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>

        {:else if viewMode === 'equipped'}
          <div class="equipped-grid">
            {#each SLOT_TYPES as slotType}
              <div class="equipped-slot">
                <h3>{getSlotIcon(slotType)} {slotType.charAt(0).toUpperCase() + slotType.slice(1)}</h3>
                {#if equipped[slotType]}
                  <button
                    class="item-card equipped"
                    class:selected={selectedItem?.id === equipped[slotType].id}
                    style="--rarity-color: {getRarityColor(equipped[slotType].rarity)}"
                    on:click={() => selectItem(equipped[slotType])}
                  >
                    <span class="item-name">{equipped[slotType].emoji || ''} {equipped[slotType].name}</span>
                    <span class="item-rarity" style="color: {getRarityColor(equipped[slotType].rarity)}">
                      {RARITIES[equipped[slotType].rarity]?.name || equipped[slotType].rarity}
                    </span>
                  </button>
                {:else}
                  <div class="empty-slot">
                    Empty
                  </div>
                {/if}
              </div>
            {/each}
          </div>

        {:else if viewMode === 'stats'}
          <div class="stats-view">
            {#if displayStats.length === 0}
              <div class="empty-message">
                No stat bonuses. Equip items to gain bonuses!
              </div>
            {:else}
              <div class="stats-grid">
                {#each displayStats as { key, value }}
                  <div class="stat-row">
                    <span class="stat-name">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span class="stat-value">{formatStatValue(key, value)}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if stats.penalties && stats.penalties.length > 0}
              <div class="penalties-section">
                <h4>Penalties (Tainted Items)</h4>
                {#each stats.penalties as penalty}
                  <div class="penalty-row">
                    <span class="penalty-source">{penalty.source}</span>
                    <span class="penalty-effect">{penalty.description}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedItem}
          <div class="item-details">
            <div class="details-header">
              <h3 style="color: {getRarityColor(selectedItem.rarity)}">
                {selectedItem.emoji || ''} {selectedItem.name}
              </h3>
              <span class="details-slot">{getSlotIcon(selectedItem.slot)} {selectedItem.slot}</span>
            </div>

            <div class="details-rarity" style="color: {getRarityColor(selectedItem.rarity)}">
              {RARITIES[selectedItem.rarity]?.name || selectedItem.rarity}
            </div>

            {#if selectedItem.bonuses && selectedItem.bonuses.length > 0}
              <div class="details-bonuses">
                <h4>Bonuses</h4>
                {#each selectedItem.bonuses as bonus}
                  <div class="bonus-row">
                    {formatAttribute(bonus)}
                  </div>
                {/each}
              </div>
            {/if}

            {#if selectedItem.tainted && selectedItem.penalties && selectedItem.penalties.length > 0}
              <div class="details-penalties">
                <h4>Curses</h4>
                {#each selectedItem.penalties as penalty}
                  <div class="penalty-row">{penalty.description}</div>
                {/each}
              </div>
            {/if}

            <div class="details-actions">
              {#if selectedItem.equipped}
                <button class="action-btn unequip" on:click={() => handleUnequip(selectedItem)}>
                  Unequip
                </button>
              {:else}
                <button class="action-btn equip" on:click={() => handleEquip(selectedItem)}>
                  Equip
                </button>
                {#if confirmSellId === selectedItem.id}
                  <div class="sell-confirm">
                    <span>Sell for {getSellValue(selectedItem)}g?</span>
                    <button class="action-btn sell-yes" on:click={() => handleSell(selectedItem)}>Yes</button>
                    <button class="action-btn sell-no" on:click={cancelSell}>No</button>
                  </div>
                {:else}
                  <button class="action-btn sell" on:click={() => handleSell(selectedItem)}>
                    Sell ({getSellValue(selectedItem)}g)
                  </button>
                {/if}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      {#if pendingLoot.length > 0}
        <div class="pending-loot-notice">
          {pendingLoot.length} item{pendingLoot.length > 1 ? 's' : ''} pending extraction
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .equipment-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .equipment-modal {
    background: var(--card-bg, #1e1e2e);
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .header-info {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
  }

  .gold {
    color: #fbbf24;
  }

  .slots {
    color: #9ca3af;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: white;
  }

  .view-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab {
    flex: 1;
    padding: 0.75rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .tab:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab.active {
    color: var(--accent, #6366f1);
    border-bottom: 2px solid var(--accent, #6366f1);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .empty-message {
    text-align: center;
    color: #9ca3af;
    padding: 2rem;
    font-style: italic;
  }

  .slot-section {
    margin-bottom: 1.5rem;
  }

  .slot-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 3px solid var(--rarity-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
    color: white;
    font-family: inherit;
    font-size: inherit;
  }

  .item-card:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }

  .item-card.selected {
    background: rgba(99, 102, 241, 0.2);
    border-color: var(--accent, #6366f1);
  }

  .item-card.equipped {
    background: rgba(34, 197, 94, 0.1);
  }

  .item-name {
    font-weight: 500;
  }

  .item-rarity {
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .equipped-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .equipped-slot h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #9ca3af;
  }

  .empty-slot {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    text-align: center;
    color: #6b7280;
    font-style: italic;
  }

  .stats-view {
    padding: 0.5rem;
  }

  .stats-grid {
    display: grid;
    gap: 0.5rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stat-name {
    color: #9ca3af;
    text-transform: capitalize;
  }

  .stat-value {
    color: #22c55e;
    font-weight: 500;
  }

  .penalties-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(239, 68, 68, 0.3);
  }

  .penalties-section h4 {
    margin: 0 0 0.75rem 0;
    color: #ef4444;
    font-size: 0.9rem;
  }

  .penalty-row {
    padding: 0.5rem 0;
    color: #fca5a5;
    font-size: 0.9rem;
  }

  .penalty-source {
    font-weight: 500;
    color: #ef4444;
    margin-right: 0.5rem;
  }

  .item-details {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .details-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .details-slot {
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .details-rarity {
    font-size: 0.85rem;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }

  .details-bonuses,
  .details-penalties {
    margin-bottom: 1rem;
  }

  .details-bonuses h4,
  .details-penalties h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .details-penalties h4 {
    color: #ef4444;
  }

  .bonus-row {
    padding: 0.25rem 0;
    color: #22c55e;
    font-size: 0.9rem;
  }

  .details-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .action-btn.equip {
    background: #22c55e;
    color: white;
  }

  .action-btn.equip:hover {
    background: #16a34a;
  }

  .action-btn.unequip {
    background: #6366f1;
    color: white;
  }

  .action-btn.unequip:hover {
    background: #4f46e5;
  }

  .action-btn.sell {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .action-btn.sell:hover {
    background: rgba(251, 191, 36, 0.3);
  }

  .sell-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #fbbf24;
    font-size: 0.9rem;
  }

  .action-btn.sell-yes {
    background: #ef4444;
    color: white;
    padding: 0.25rem 0.75rem;
  }

  .action-btn.sell-no {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.25rem 0.75rem;
  }

  .pending-loot-notice {
    padding: 0.75rem;
    background: rgba(251, 191, 36, 0.1);
    border-top: 1px solid rgba(251, 191, 36, 0.3);
    text-align: center;
    color: #fbbf24;
    font-size: 0.85rem;
  }

  @media (max-width: 480px) {
    .equipment-modal {
      max-height: 90vh;
    }

    .header-info {
      gap: 0.5rem;
      font-size: 0.8rem;
    }

    .item-card {
      padding: 0.6rem 0.75rem;
    }
  }
</style>
