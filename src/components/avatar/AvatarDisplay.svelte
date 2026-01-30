<script>
  import { avatarData, getAvatarDisplayData } from '../../lib/stores/avatar.js';
  import { currentLevel } from '../../lib/stores/player.js';

  export let size = 'md'; // sm, md, lg, xl
  export let showLevel = false;

  const sizes = {
    sm: 48,
    md: 96,
    lg: 144,
    xl: 192
  };

  $: displayData = getAvatarDisplayData($avatarData);
  $: pixelSize = sizes[size] / 16; // 16x16 grid
</script>

<div class="avatar-container size-{size}" style="--pixel-size: {pixelSize}px">
  <!-- Base body -->
  <div class="avatar-layer body" style="--skin-color: {displayData.skinColor}">
    <!-- Head -->
    <div class="pixel" style="grid-area: 3/6/5/11; background: var(--skin-color)"></div>
    <!-- Body -->
    <div class="pixel" style="grid-area: 5/7/8/10; background: var(--skin-color)"></div>
    <!-- Arms -->
    <div class="pixel" style="grid-area: 5/5/7/7; background: var(--skin-color)"></div>
    <div class="pixel" style="grid-area: 5/10/7/12; background: var(--skin-color)"></div>
    <!-- Legs -->
    <div class="pixel" style="grid-area: 8/7/10/8; background: var(--skin-color)"></div>
    <div class="pixel" style="grid-area: 8/9/10/10; background: var(--skin-color)"></div>
  </div>

  <!-- Hair layer -->
  <div class="avatar-layer hair hair-{displayData.hairStyle}" style="--hair-color: {displayData.hairColor}">
    {#if displayData.hairStyle === 'default'}
      <div class="pixel" style="grid-area: 2/6/4/11; background: var(--hair-color)"></div>
    {:else if displayData.hairStyle === 'spiky'}
      <div class="pixel" style="grid-area: 1/6/3/8; background: var(--hair-color)"></div>
      <div class="pixel" style="grid-area: 1/9/3/11; background: var(--hair-color)"></div>
      <div class="pixel" style="grid-area: 2/6/4/11; background: var(--hair-color)"></div>
    {:else if displayData.hairStyle === 'long'}
      <div class="pixel" style="grid-area: 2/5/8/7; background: var(--hair-color)"></div>
      <div class="pixel" style="grid-area: 2/10/8/12; background: var(--hair-color)"></div>
      <div class="pixel" style="grid-area: 2/6/4/11; background: var(--hair-color)"></div>
    {:else if displayData.hairStyle === 'mohawk'}
      <div class="pixel" style="grid-area: 1/7/4/10; background: var(--hair-color)"></div>
    {:else if displayData.hairStyle === 'ponytail'}
      <div class="pixel" style="grid-area: 2/6/4/11; background: var(--hair-color)"></div>
      <div class="pixel" style="grid-area: 4/10/7/12; background: var(--hair-color)"></div>
    {:else if displayData.hairStyle === 'curly'}
      <div class="pixel" style="grid-area: 1/5/4/12; background: var(--hair-color); border-radius: 50%"></div>
    {:else}
      <div class="pixel" style="grid-area: 2/6/4/11; background: var(--hair-color)"></div>
    {/if}
  </div>

  <!-- Eyes -->
  <div class="avatar-layer eyes">
    <div class="pixel" style="grid-area: 3/7/4/8; background: #1a1a1a"></div>
    <div class="pixel" style="grid-area: 3/9/4/10; background: #1a1a1a"></div>
  </div>

  <!-- Outfit layer -->
  <div class="avatar-layer outfit outfit-{displayData.outfit}">
    {#if displayData.outfit === 'casual'}
      <div class="pixel" style="grid-area: 5/7/8/10; background: #3b82f6"></div>
      <div class="pixel" style="grid-area: 8/7/10/8; background: #1e40af"></div>
      <div class="pixel" style="grid-area: 8/9/10/10; background: #1e40af"></div>
    {:else if displayData.outfit === 'adventurer'}
      <div class="pixel" style="grid-area: 5/7/8/10; background: #78350f"></div>
      <div class="pixel" style="grid-area: 6/6/8/7; background: #78350f"></div>
      <div class="pixel" style="grid-area: 8/7/10/8; background: #451a03"></div>
      <div class="pixel" style="grid-area: 8/9/10/10; background: #451a03"></div>
    {:else if displayData.outfit === 'warrior'}
      <div class="pixel" style="grid-area: 5/7/8/10; background: #6b7280"></div>
      <div class="pixel" style="grid-area: 5/5/7/7; background: #6b7280"></div>
      <div class="pixel" style="grid-area: 5/10/7/12; background: #6b7280"></div>
      <div class="pixel" style="grid-area: 8/7/10/10; background: #4b5563"></div>
    {:else if displayData.outfit === 'mage'}
      <div class="pixel" style="grid-area: 5/6/10/11; background: #7c3aed"></div>
      <div class="pixel" style="grid-area: 5/5/6/12; background: #7c3aed"></div>
    {:else if displayData.outfit === 'knight'}
      <div class="pixel" style="grid-area: 5/5/10/12; background: #9ca3af"></div>
      <div class="pixel" style="grid-area: 5/7/6/10; background: #fbbf24"></div>
    {:else if displayData.outfit === 'royal'}
      <div class="pixel" style="grid-area: 5/6/10/11; background: #dc2626"></div>
      <div class="pixel" style="grid-area: 5/7/6/10; background: #fbbf24"></div>
      <div class="pixel" style="grid-area: 6/7/7/10; background: #fef3c7"></div>
    {:else}
      <div class="pixel" style="grid-area: 5/7/8/10; background: #3b82f6"></div>
    {/if}
  </div>

  <!-- Accessory layer -->
  <div class="avatar-layer accessory accessory-{displayData.accessory}">
    {#if displayData.accessory === 'glasses'}
      <div class="pixel" style="grid-area: 3/6/4/8; background: #1a1a1a; opacity: 0.8"></div>
      <div class="pixel" style="grid-area: 3/8/4/11; background: #1a1a1a; opacity: 0.8"></div>
    {:else if displayData.accessory === 'headband'}
      <div class="pixel" style="grid-area: 2/6/3/11; background: #ef4444"></div>
    {:else if displayData.accessory === 'earring'}
      <div class="pixel" style="grid-area: 4/5/5/6; background: #fbbf24"></div>
    {:else if displayData.accessory === 'crown'}
      <div class="pixel" style="grid-area: 1/6/2/11; background: #fbbf24"></div>
      <div class="pixel" style="grid-area: 1/7/1/8; background: #fbbf24"></div>
      <div class="pixel" style="grid-area: 1/9/1/10; background: #fbbf24"></div>
    {:else if displayData.accessory === 'halo'}
      <div class="pixel halo" style="grid-area: 1/6/2/11; background: rgba(251, 191, 36, 0.7); border-radius: 50%"></div>
    {/if}
  </div>

  {#if showLevel}
    <div class="level-badge">{$currentLevel}</div>
  {/if}
</div>

<style>
  .avatar-container {
    position: relative;
    display: inline-block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .avatar-container.size-sm { width: 48px; height: 48px; }
  .avatar-container.size-md { width: 96px; height: 96px; }
  .avatar-container.size-lg { width: 144px; height: 144px; }
  .avatar-container.size-xl { width: 192px; height: 192px; }

  .avatar-layer {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(16, var(--pixel-size));
    grid-template-rows: repeat(16, var(--pixel-size));
  }

  .pixel {
    transition: background-color var(--transition-fast);
  }

  .halo {
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes glow {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .level-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background-color: var(--level-color);
    color: white;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-full);
    border: 2px solid var(--bg-primary);
  }

  .size-lg .level-badge,
  .size-xl .level-badge {
    font-size: 0.75rem;
    padding: 4px 8px;
  }
</style>
