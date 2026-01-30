<script>
  import { fly, fade } from 'svelte/transition';
  import { currentNotification, removeNotification } from '../../lib/stores/notifications.js';

  const icons = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i',
    xp: '★',
    levelup: '⬆',
    achievement: '🏆',
    unlock: '🔓'
  };
</script>

{#if $currentNotification}
  <div
    class="toast toast-{$currentNotification.type}"
    in:fly={{ y: -20, duration: 200 }}
    out:fade={{ duration: 150 }}
    role="alert"
  >
    <span class="toast-icon">{icons[$currentNotification.type] || 'i'}</span>

    <div class="toast-content">
      {#if $currentNotification.title}
        <strong class="toast-title">{$currentNotification.title}</strong>
      {/if}
      <span class="toast-message">{$currentNotification.message}</span>
    </div>

    <button
      class="toast-close"
      on:click={() => removeNotification($currentNotification.id)}
      aria-label="Dismiss"
    >
      ✕
    </button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 2000;
    max-width: 400px;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .toast-success .toast-icon {
    background-color: var(--success);
    color: white;
  }

  .toast-error .toast-icon {
    background-color: var(--error);
    color: white;
  }

  .toast-warning .toast-icon {
    background-color: var(--warning);
    color: white;
  }

  .toast-info .toast-icon {
    background-color: var(--info);
    color: white;
  }

  .toast-xp .toast-icon {
    background-color: var(--xp-color);
    color: white;
  }

  .toast-levelup .toast-icon {
    background-color: var(--level-color);
    color: white;
    animation: bounce 0.5s ease infinite;
  }

  .toast-achievement .toast-icon,
  .toast-unlock .toast-icon {
    background-color: transparent;
    font-size: 1.5rem;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toast-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .toast-message {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .toast-xp .toast-message {
    color: var(--xp-color);
    font-weight: 600;
  }

  .toast-close {
    color: var(--text-muted);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    font-size: 0.75rem;
  }

  .toast-close:hover {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @media (max-width: 640px) {
    .toast {
      left: var(--spacing-md);
      right: var(--spacing-md);
      max-width: none;
    }
  }
</style>
