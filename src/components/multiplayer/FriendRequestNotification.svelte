<script>
  import { onMount, onDestroy } from 'svelte';
  import { authUser } from '../../lib/stores/auth.js';
  import { getPendingRequests } from '../../lib/services/friendsService.js';

  let pendingCount = 0;
  let dismissed = false;
  let checkInterval;
  let lastDismissedCount = 0;

  async function checkPendingRequests() {
    if (!$authUser) {
      pendingCount = 0;
      return;
    }

    try {
      const pending = await getPendingRequests();
      const newCount = pending?.length || 0;

      // If count increased, show the banner again
      if (newCount > lastDismissedCount) {
        dismissed = false;
      }

      pendingCount = newCount;
      console.log('Pending friend requests:', pendingCount, 'dismissed:', dismissed);
    } catch (error) {
      console.error('Failed to check pending requests:', error);
    }
  }

  function handleClick() {
    // Navigate to multiplayer page (friends tab)
    window.location.hash = '#/multiplayer';
    lastDismissedCount = pendingCount;
    dismissed = true;
  }

  function dismiss(e) {
    e.stopPropagation();
    lastDismissedCount = pendingCount;
    dismissed = true;
  }

  onMount(() => {
    // Small delay to ensure auth is ready
    setTimeout(checkPendingRequests, 500);
    // Check every 30 seconds for new requests
    checkInterval = setInterval(checkPendingRequests, 30000);
  });

  onDestroy(() => {
    if (checkInterval) clearInterval(checkInterval);
  });

  // Re-check when auth state changes
  $: if ($authUser) {
    setTimeout(checkPendingRequests, 100);
  }
</script>

{#if pendingCount > 0 && !dismissed}
  <button class="notification-banner" on:click={handleClick}>
    <span class="notification-icon">👋</span>
    <span class="notification-text">
      You have {pendingCount} pending friend request{pendingCount > 1 ? 's' : ''}!
    </span>
    <span class="notification-action">View</span>
    <button class="dismiss-btn" on:click={dismiss} aria-label="Dismiss">
      ✕
    </button>
  </button>
{/if}

<style>
  .notification-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-left: none;
    border-right: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .notification-banner:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25));
  }

  .notification-icon {
    font-size: 1.25rem;
  }

  .notification-text {
    flex: 1;
  }

  .notification-action {
    color: var(--accent);
    font-weight: 600;
  }

  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.2);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .dismiss-btn:hover {
    background: rgba(0, 0, 0, 0.3);
    color: var(--text-primary);
  }

  @media (min-width: 1024px) {
    .notification-banner {
      margin-left: var(--sidebar-width);
    }
  }
</style>
