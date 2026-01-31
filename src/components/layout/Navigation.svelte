<script>
  import { location } from 'svelte-spa-router';

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/quests', label: 'Daily Quests', icon: '⚔️' },
    { path: '/board', label: 'Board', icon: '📋' },
    { path: '/expedition', label: 'Expedition', icon: '🗺️' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/achievements', label: 'Achievements', icon: '🏆' },
    { path: '/avatar', label: 'Avatar', icon: '👤' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  function isActive(path, currentPath) {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  }
</script>

<nav class="navigation">
  <ul class="nav-list">
    {#each navItems as item}
      <li>
        <a
          href="#{item.path}"
          class="nav-item"
          class:active={isActive(item.path, $location)}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .navigation {
    width: var(--sidebar-width);
    height: calc(100vh - var(--header-height));
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: var(--spacing-md);
    position: fixed;
    left: 0;
    top: var(--header-height);
    overflow-y: auto;
  }

  .nav-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
  }

  .nav-item.active {
    color: var(--accent);
    background-color: var(--accent-light);
  }

  .nav-icon {
    font-size: 1.25rem;
    width: 24px;
    text-align: center;
  }

  .nav-label {
    font-weight: 500;
  }

  @media (max-width: 1023px) {
    .navigation {
      display: none;
    }
  }
</style>
