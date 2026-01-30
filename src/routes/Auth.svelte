<script>
  import { signIn, signUp, authLoading, authError } from '../lib/stores/auth.js';
  import Button from '../components/common/Button.svelte';
  import Card from '../components/common/Card.svelte';

  let mode = 'login'; // 'login' or 'signup'
  let email = '';
  let password = '';
  let confirmPassword = '';
  let localError = '';

  async function handleSubmit() {
    localError = '';

    if (!email || !password) {
      localError = 'Please fill in all fields';
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        localError = 'Passwords do not match';
        return;
      }
      if (password.length < 6) {
        localError = 'Password must be at least 6 characters';
        return;
      }

      const result = await signUp(email, password);
      if (result.success) {
        localError = '';
        mode = 'login';
        // Show success message for email confirmation
        localError = 'Check your email to confirm your account!';
      }
    } else {
      const result = await signIn(email, password);
      if (result.success) {
        // Auth state change will redirect automatically
      }
    }
  }

  function toggleMode() {
    mode = mode === 'login' ? 'signup' : 'login';
    localError = '';
    email = '';
    password = '';
    confirmPassword = '';
  }
</script>

<div class="auth-page">
  <div class="auth-container">
    <div class="auth-header">
      <span class="auth-icon">⚔️</span>
      <h1>RPG Life</h1>
      <p class="auth-subtitle">
        {mode === 'login' ? 'Welcome back, adventurer!' : 'Begin your adventure'}
      </p>
    </div>

    <Card>
      <form class="auth-form" on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="hero@example.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            placeholder="Enter your password"
            required
          />
        </div>

        {#if mode === 'signup'}
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              bind:value={confirmPassword}
              placeholder="Confirm your password"
              required
            />
          </div>
        {/if}

        {#if localError || $authError}
          <div class="error-message">
            {localError || $authError}
          </div>
        {/if}

        <Button type="submit" fullWidth disabled={$authLoading}>
          {#if $authLoading}
            Loading...
          {:else}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          {/if}
        </Button>
      </form>
    </Card>

    <div class="auth-footer">
      <button class="toggle-mode" on:click={toggleMode}>
        {mode === 'login'
          ? "Don't have an account? Sign up"
          : 'Already have an account? Sign in'}
      </button>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
    background-color: var(--bg-primary);
  }

  .auth-container {
    width: 100%;
    max-width: 400px;
  }

  .auth-header {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .auth-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: var(--spacing-md);
  }

  .auth-header h1 {
    font-size: 2rem;
    margin-bottom: var(--spacing-sm);
    color: var(--text-primary);
  }

  .auth-subtitle {
    color: var(--text-muted);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color var(--transition-fast);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-group input::placeholder {
    color: var(--text-muted);
  }

  .error-message {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--error);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    text-align: center;
  }

  .auth-footer {
    text-align: center;
    margin-top: var(--spacing-lg);
  }

  .toggle-mode {
    color: var(--accent);
    font-size: 0.875rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  .toggle-mode:hover {
    opacity: 0.8;
  }
</style>
