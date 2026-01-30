<script>
  export let variant = 'primary'; // primary, secondary, ghost, danger
  export let size = 'md'; // sm, md, lg
  export let disabled = false;
  export let type = 'button';
  export let fullWidth = false;
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size}"
  class:full-width={fullWidth}
  on:click
>
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    cursor: pointer;
    border: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.875rem;
  }

  .btn-md {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 1rem;
  }

  .btn-lg {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.125rem;
  }

  /* Variants */
  .btn-primary {
    background-color: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .btn-secondary {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--border-light);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-danger {
    background-color: var(--error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .full-width {
    width: 100%;
  }
</style>
