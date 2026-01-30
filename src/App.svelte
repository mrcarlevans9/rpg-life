<script>
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import Layout from './components/layout/Layout.svelte';
  import Auth from './routes/Auth.svelte';
  import { initializeDB } from './lib/db/index.js';
  import { settingsData, applyTheme } from './lib/stores/settings.js';
  import { checkAchievements } from './lib/stores/achievements.js';
  import { initAuth, isAuthenticated, authLoading } from './lib/stores/auth.js';
  import { fullSync } from './lib/supabase/sync.js';
  import './styles/global.css';

  // Route definitions
  const routes = {
    '/': wrap({
      asyncComponent: () => import('./routes/Dashboard.svelte')
    }),
    '/quests': wrap({
      asyncComponent: () => import('./routes/DailyQuests.svelte')
    }),
    '/projects': wrap({
      asyncComponent: () => import('./routes/Projects.svelte')
    }),
    '/projects/:id': wrap({
      asyncComponent: () => import('./routes/ProjectBoard.svelte')
    }),
    '/expedition': wrap({
      asyncComponent: () => import('./routes/ExpeditionTimer.svelte')
    }),
    '/analytics': wrap({
      asyncComponent: () => import('./routes/Analytics.svelte')
    }),
    '/achievements': wrap({
      asyncComponent: () => import('./routes/Achievements.svelte')
    }),
    '/avatar': wrap({
      asyncComponent: () => import('./routes/AvatarCustomization.svelte')
    }),
    '/settings': wrap({
      asyncComponent: () => import('./routes/Settings.svelte')
    }),
    '*': wrap({
      asyncComponent: () => import('./routes/NotFound.svelte')
    })
  };

  let dbLoading = true;

  onMount(async () => {
    try {
      // Initialize auth first
      await initAuth();

      // Initialize local DB (for offline support)
      await initializeDB();
      dbLoading = false;

      // Check achievements on app load
      await checkAchievements();
    } catch (error) {
      console.error('Failed to initialize:', error);
      dbLoading = false;
    }
  });

  // Apply theme when settings change
  $: if ($settingsData?.theme) {
    applyTheme($settingsData.theme);
  }

  // Sync data when user becomes authenticated
  $: if ($isAuthenticated && !dbLoading) {
    fullSync();
  }

  // Combined loading state
  $: loading = dbLoading || $authLoading;
</script>

{#if loading}
  <div class="loading-screen">
    <div class="loading-content">
      <span class="loading-icon">⚔️</span>
      <h1>RPG Life</h1>
      <p>Loading your adventure...</p>
    </div>
  </div>
{:else if !$isAuthenticated}
  <Auth />
{:else}
  <Layout>
    <Router {routes} />
  </Layout>
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-primary);
  }

  .loading-content {
    text-align: center;
  }

  .loading-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: var(--spacing-md);
    animation: bounce 1s ease infinite;
  }

  .loading-content h1 {
    font-size: 2rem;
    margin-bottom: var(--spacing-sm);
    color: var(--text-primary);
  }

  .loading-content p {
    color: var(--text-secondary);
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
</style>
