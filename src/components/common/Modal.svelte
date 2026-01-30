<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let size = 'md'; // sm, md, lg, xl

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="modal-backdrop"
    transition:fade={{ duration: 150 }}
    on:click={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="modal modal-{size}" transition:scale={{ duration: 200, start: 0.95 }}>
      {#if title}
        <div class="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button class="close-btn" on:click={close} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
      {/if}

      <div class="modal-body">
        <slot />
      </div>

      {#if $$slots.footer}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
    z-index: 1000;
  }

  .modal {
    background-color: var(--bg-secondary);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    max-height: calc(100vh - 2rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-sm { width: 100%; max-width: 320px; }
  .modal-md { width: 100%; max-width: 480px; }
  .modal-lg { width: 100%; max-width: 640px; }
  .modal-xl { width: 100%; max-width: 800px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .close-btn {
    color: var(--text-muted);
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
  }

  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--border);
  }
</style>
