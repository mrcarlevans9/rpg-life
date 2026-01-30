<script>
  import Button from '../components/common/Button.svelte';
</script>

<div class="not-found">
  <span class="icon">🗺️</span>
  <h1>404</h1>
  <h2>Page Not Found</h2>
  <p>Looks like you've wandered off the map!</p>
  <a href="#/">
    <Button>Return to Dashboard</Button>
  </a>
</div>

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    padding: var(--spacing-xl);
  }

  .icon {
    font-size: 5rem;
    margin-bottom: var(--spacing-md);
  }

  h1 {
    font-size: 6rem;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-muted);
    margin-bottom: var(--spacing-xl);
  }
</style>
