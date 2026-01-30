<script>
  import { location } from 'svelte-spa-router';

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/quests', label: 'Quests', icon: '⚔️' },
    { path: '/projects', label: 'Projects', icon: '📋' },
    { path: '/walk', label: 'Walk', icon: '🚶' },
    { path: '/analytics', label: 'Stats', icon: '📊' }
  ];

  function isActive(path, currentPath) {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  }
</script>

<nav class="mobile-nav">
  {#each navItems as item}
    <a
      href="#{item.path}"
      class="mobile-nav-item"
      class:active={isActive(item.path, $location)}
    >
      <span class="mobile-nav-icon">{item.icon}</span>
      <span class="mobile-nav-label">{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  .mobile-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--mobile-nav-height);
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: var(--spacing-xs) var(--spacing-sm);
    z-index: 100;
  }

  @media (max-width: 1023px) {
    .mobile-nav {
      display: flex;
      justify-content: space-around;
      align-items: center;
    }
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--spacing-xs) var(--spacing-sm);
    color: var(--text-muted);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    min-width: 56px;
  }

  .mobile-nav-item:hover {
    color: var(--text-secondary);
  }

  .mobile-nav-item.active {
    color: var(--accent);
  }

  .mobile-nav-icon {
    font-size: 1.25rem;
  }

  .mobile-nav-label {
    font-size: 0.625rem;
    font-weight: 500;
  }
</style>
