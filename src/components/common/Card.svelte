<script>
  export let padding = true;
  export let hoverable = false;
</script>

<div class="card" class:with-padding={padding} class:hoverable>
  <slot />
</div>

<style>
  .card {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  .with-padding {
    padding: var(--spacing-md);
  }

  .hoverable:hover {
    border-color: var(--border-light);
    box-shadow: var(--shadow-md);
  }
</style>
