<script>
  import AvatarDisplay from '../avatar/AvatarDisplay.svelte';
  import XPBar from '../player/XPBar.svelte';
  import StreakCounter from '../player/StreakCounter.svelte';
  import { settingsData, toggleTheme } from '../../lib/stores/settings.js';

  export let showNav = true;

  let menuOpen = false;

  function toggleMenu() {
    menuOpen = !menuOpen;
  }
</script>

<header class="header">
  <div class="header-left">
    <a href="#/" class="logo">
      <span class="logo-icon">⚔️</span>
      <span class="logo-text">RPG Life</span>
    </a>
  </div>

  <div class="header-center desktop-only">
    <div class="xp-container">
      <XPBar showDetails={false} size="sm" />
    </div>
  </div>

  <div class="header-right">
    <StreakCounter size="sm" showMultiplier={false} />

    <button class="icon-btn" on:click={toggleTheme} title="Toggle theme">
      {#if $settingsData?.theme === 'dark'}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
        </svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
        </svg>
      {/if}
    </button>

    <a href="#/avatar" class="avatar-link">
      <AvatarDisplay size="sm" />
    </a>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height);
    padding: 0 var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--text-primary);
    font-weight: 700;
    font-size: 1.125rem;
  }

  .logo-icon {
    font-size: 1.5rem;
  }

  .header-center {
    flex: 1;
    max-width: 300px;
    margin: 0 var(--spacing-lg);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .icon-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
  }

  .avatar-link {
    display: flex;
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: block;
    }
  }
</style>
