<script>
  import { onMount } from 'svelte';
  import AvatarDisplay from '../components/avatar/AvatarDisplay.svelte';
  import Card from '../components/common/Card.svelte';
  import Button from '../components/common/Button.svelte';
  import { avatarData, updateAvatar, getCosmeticsOfType } from '../lib/stores/avatar.js';
  import { currentLevel } from '../lib/stores/player.js';
  import { TITLES } from '../lib/db/schema.js';
  import { showSuccess } from '../lib/stores/notifications.js';

  let activeTab = 'gender';
  let cosmetics = {
    hairStyles: [],
    hairColors: [],
    skinTones: [],
    outfits: [],
    accessories: []
  };

  const genderOptions = [
    { key: 'male', label: 'Male', icon: '👨' },
    { key: 'female', label: 'Female', icon: '👩' },
    { key: 'neutral', label: 'Neutral', icon: '🧑' }
  ];

  const tabs = [
    { id: 'gender', label: 'Body', icon: '🧍' },
    { id: 'hair', label: 'Hair', icon: '💇' },
    { id: 'color', label: 'Color', icon: '🎨' },
    { id: 'skin', label: 'Skin', icon: '👤' },
    { id: 'outfit', label: 'Outfit', icon: '👕' },
    { id: 'accessory', label: 'Accessory', icon: '✨' },
    { id: 'title', label: 'Title', icon: '🏷️' }
  ];

  onMount(async () => {
    cosmetics.hairStyles = await getCosmeticsOfType('hairStyles');
    cosmetics.hairColors = await getCosmeticsOfType('hairColors');
    cosmetics.skinTones = await getCosmeticsOfType('skinTones');
    cosmetics.outfits = await getCosmeticsOfType('outfits');
    cosmetics.accessories = await getCosmeticsOfType('accessories');
  });

  async function selectGender(key) {
    await updateAvatar('gender', key);
    showSuccess('Body type updated!');
  }

  async function selectHairStyle(key) {
    await updateAvatar('hairStyle', key);
    showSuccess('Hair style updated!');
  }

  async function selectHairColor(key) {
    await updateAvatar('hairColor', key);
    showSuccess('Hair color updated!');
  }

  async function selectSkinTone(key) {
    await updateAvatar('skinTone', key);
    showSuccess('Skin tone updated!');
  }

  async function selectOutfit(key) {
    await updateAvatar('outfit', key);
    showSuccess('Outfit updated!');
  }

  async function selectAccessory(key) {
    await updateAvatar('accessory', key);
    showSuccess('Accessory updated!');
  }

  async function selectTitle(key) {
    await updateAvatar('equippedTitle', key);
    showSuccess('Title updated!');
  }

  function isUnlocked(item) {
    return item.unlocked || item.level <= $currentLevel;
  }

  function isSelected(type, key) {
    switch (type) {
      case 'gender': return ($avatarData?.gender || 'neutral') === key;
      case 'hairStyle': return $avatarData?.hairStyle === key;
      case 'hairColor': return $avatarData?.hairColor === key;
      case 'skinTone': return $avatarData?.skinTone === key;
      case 'outfit': return $avatarData?.outfit === key;
      case 'accessory': return $avatarData?.accessory === key;
      case 'title': return $avatarData?.equippedTitle === key;
      default: return false;
    }
  }

  $: availableTitles = TITLES.filter(t => {
    if (t.level) return $currentLevel >= t.level;
    // For achievement-based titles, we'd check achievement unlocks
    return true;
  });
</script>

<div class="avatar-page">
  <header class="page-header">
    <h1>Customize Avatar</h1>
  </header>

  <div class="avatar-preview">
    <Card>
      <div class="preview-card">
        <AvatarDisplay size="xl" />
        <div class="preview-info">
          <span class="preview-level">Level {$currentLevel}</span>
          {#if $avatarData?.equippedTitle}
            <span class="preview-title">
              {TITLES.find(t => t.key === $avatarData.equippedTitle)?.name || 'Rookie'}
            </span>
          {/if}
        </div>
      </div>
    </Card>
  </div>

  <div class="customization-tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        on:click={() => activeTab = tab.id}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="customization-content">
    {#if activeTab === 'gender'}
      <div class="gender-grid">
        {#each genderOptions as option}
          <button
            class="gender-option"
            class:selected={isSelected('gender', option.key)}
            on:click={() => selectGender(option.key)}
          >
            <span class="gender-icon">{option.icon}</span>
            <span class="gender-label">{option.label}</span>
          </button>
        {/each}
      </div>
    {:else if activeTab === 'hair'}
      <div class="options-grid">
        {#each cosmetics.hairStyles as item}
          <button
            class="option-card"
            class:selected={isSelected('hairStyle', item.key)}
            class:locked={!isUnlocked(item)}
            disabled={!isUnlocked(item)}
            on:click={() => selectHairStyle(item.key)}
          >
            <span class="option-preview">{isUnlocked(item) ? '💇' : '🔒'}</span>
            <span class="option-name">{item.name}</span>
            {#if !isUnlocked(item)}
              <span class="unlock-level">Lvl {item.level}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if activeTab === 'color'}
      <div class="color-grid">
        {#each cosmetics.hairColors as item}
          <button
            class="color-option"
            class:selected={isSelected('hairColor', item.key)}
            class:locked={!isUnlocked(item)}
            disabled={!isUnlocked(item)}
            style="background-color: {item.color}"
            on:click={() => selectHairColor(item.key)}
            title={item.name}
          >
            {#if !isUnlocked(item)}
              <span class="lock-icon">🔒</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if activeTab === 'skin'}
      <div class="color-grid">
        {#each cosmetics.skinTones as item}
          <button
            class="color-option skin"
            class:selected={isSelected('skinTone', item.key)}
            style="background-color: {item.color}"
            on:click={() => selectSkinTone(item.key)}
            title={item.name}
          ></button>
        {/each}
      </div>
    {:else if activeTab === 'outfit'}
      <div class="options-grid">
        {#each cosmetics.outfits as item}
          <button
            class="option-card"
            class:selected={isSelected('outfit', item.key)}
            class:locked={!isUnlocked(item)}
            disabled={!isUnlocked(item)}
            on:click={() => selectOutfit(item.key)}
          >
            <span class="option-preview">{isUnlocked(item) ? '👕' : '🔒'}</span>
            <span class="option-name">{item.name}</span>
            {#if !isUnlocked(item)}
              <span class="unlock-level">Lvl {item.level}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if activeTab === 'accessory'}
      <div class="options-grid">
        {#each cosmetics.accessories as item}
          <button
            class="option-card"
            class:selected={isSelected('accessory', item.key)}
            class:locked={!isUnlocked(item)}
            disabled={!isUnlocked(item)}
            on:click={() => selectAccessory(item.key)}
          >
            <span class="option-preview">{isUnlocked(item) ? '✨' : '🔒'}</span>
            <span class="option-name">{item.name}</span>
            {#if !isUnlocked(item)}
              <span class="unlock-level">Lvl {item.level}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if activeTab === 'title'}
      <div class="options-grid">
        {#each availableTitles as title}
          <button
            class="option-card"
            class:selected={isSelected('title', title.key)}
            on:click={() => selectTitle(title.key)}
          >
            <span class="option-preview">🏷️</span>
            <span class="option-name">{title.name}</span>
            <span class="option-desc">{title.requirement}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .avatar-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 var(--spacing-md);
  }

  .page-header {
    margin-bottom: var(--spacing-lg);
    text-align: center;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .avatar-preview {
    margin-bottom: var(--spacing-lg);
    display: flex;
    justify-content: center;
  }

  .preview-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl) var(--spacing-2xl);
    gap: var(--spacing-md);
    min-height: 280px;
  }

  .preview-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
  }

  .preview-level {
    font-weight: 600;
    color: var(--level-color);
    font-size: 1.1rem;
  }

  .preview-title {
    font-size: 0.875rem;
    color: var(--accent);
    padding: var(--spacing-xs) var(--spacing-md);
    background-color: var(--accent-light);
    border-radius: var(--radius-full);
  }

  .customization-tabs {
    display: flex;
    gap: var(--spacing-xs);
    overflow-x: auto;
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    justify-content: center;
  }

  .gender-grid {
    display: flex;
    justify-content: center;
    gap: var(--spacing-lg);
    flex-wrap: wrap;
  }

  .gender-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) var(--spacing-xl);
    background-color: var(--bg-secondary);
    border: 3px solid var(--border);
    border-radius: var(--radius-xl);
    transition: all var(--transition-fast);
    min-width: 100px;
  }

  .gender-option:hover {
    border-color: var(--border-light);
    transform: translateY(-2px);
  }

  .gender-option.selected {
    border-color: var(--accent);
    background-color: var(--accent-light);
  }

  .gender-icon {
    font-size: 3rem;
  }

  .gender-label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .tab:hover {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
  }

  .tab.active {
    color: var(--accent);
    background-color: var(--accent-light);
  }

  .tab-icon {
    font-size: 1.25rem;
  }

  .tab-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--spacing-md);
  }

  .option-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background-color: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  .option-card:hover:not(:disabled) {
    border-color: var(--border-light);
  }

  .option-card.selected {
    border-color: var(--accent);
    background-color: var(--accent-light);
  }

  .option-card.locked {
    opacity: 0.5;
  }

  .option-preview {
    font-size: 2rem;
  }

  .option-name {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .option-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  .unlock-level {
    font-size: 0.75rem;
    color: var(--text-muted);
    background-color: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }

  .color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  .color-option {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    border: 3px solid transparent;
    transition: all var(--transition-fast);
    position: relative;
  }

  .color-option:hover:not(:disabled) {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-primary);
  }

  .color-option.locked {
    opacity: 0.5;
  }

  .lock-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }
</style>
