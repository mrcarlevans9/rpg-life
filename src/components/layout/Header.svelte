<script>
  import AvatarDisplay from '../avatar/AvatarDisplay.svelte';
  import XPBar from '../player/XPBar.svelte';
  import StreakCounter from '../player/StreakCounter.svelte';
  import { settingsData, toggleTheme } from '../../lib/stores/settings.js';
  import { signOut, authUser } from '../../lib/stores/auth.js';
  import { playerData } from '../../lib/stores/player.js';

  export let showNav = true;

  let menuOpen = false;

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  async function handleSignOut() {
    closeMenu();
    await signOut();
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

    <a href="#/avatar" class="gold-display" title="View Profile">
      <span class="gold-icon">🪙</span>
      <span class="gold-amount">{$playerData?.gold || 0}</span>
    </a>

    <div class="avatar-menu">
      <button class="avatar-btn" on:click={toggleMenu}>
        <AvatarDisplay size="sm" />
      </button>

      {#if menuOpen}
        <div class="menu-overlay" on:click={closeMenu}></div>
        <div class="dropdown-menu">
          <div class="menu-gold">
            <span class="gold-icon">🪙</span>
            <span>{$playerData?.gold || 0} Gold</span>
          </div>
          <div class="menu-divider"></div>
          <a href="#/avatar" class="menu-item" on:click={closeMenu}>
            <span class="menu-icon">👤</span>
            Profile & Spells
          </a>
          <a href="#/settings" class="menu-item" on:click={closeMenu}>
            <span class="menu-icon">⚙️</span>
            Settings
          </a>
          <div class="menu-divider"></div>
          <div class="menu-email">{$authUser?.email}</div>
          <button class="menu-item danger" on:click={handleSignOut}>
            <span class="menu-icon">🚪</span>
            Sign Out
          </button>
        </div>
      {/if}
    </div>
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

  .gold-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: var(--radius-md);
    color: #fbbf24;
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .gold-display:hover {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.2));
    border-color: rgba(251, 191, 36, 0.5);
  }

  .gold-icon {
    font-size: 1rem;
  }

  .menu-gold {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    color: #fbbf24;
    font-weight: 600;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), transparent);
  }

  .avatar-menu {
    position: relative;
  }

  .avatar-btn {
    display: flex;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    border-radius: var(--radius-full);
    transition: transform var(--transition-fast);
  }

  .avatar-btn:hover {
    transform: scale(1.05);
  }

  .menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + var(--spacing-sm));
    right: 0;
    min-width: 200px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--text-primary);
    font-size: 0.875rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-fast);
    text-decoration: none;
  }

  .menu-item:hover {
    background-color: var(--bg-tertiary);
  }

  .menu-item.danger {
    color: var(--error);
  }

  .menu-icon {
    font-size: 1rem;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--border);
    margin: var(--spacing-xs) 0;
  }

  .menu-email {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: 0.75rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
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
