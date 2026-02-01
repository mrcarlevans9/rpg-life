<script>
  import Header from './Header.svelte';
  import Navigation from './Navigation.svelte';
  import MobileNav from './MobileNav.svelte';
  import Toast from '../common/Toast.svelte';
  import FriendRequestNotification from '../multiplayer/FriendRequestNotification.svelte';
</script>

<div class="app-layout">
  <Header />
  <Navigation />
  <FriendRequestNotification />

  <main class="main-content">
    <slot />
  </main>

  <MobileNav />
  <Toast />
</div>

<style>
  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    padding: var(--spacing-lg);
    margin-left: 0;
    margin-top: 0;
    padding-bottom: calc(var(--spacing-lg) + var(--mobile-nav-height));
  }

  @media (min-width: 1024px) {
    .main-content {
      margin-left: var(--sidebar-width);
      padding-bottom: var(--spacing-lg);
    }
  }
</style>
