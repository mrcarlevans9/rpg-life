import { writable, derived } from 'svelte/store';
import { supabase, signIn as supabaseSignIn, signUp as supabaseSignUp, signOut as supabaseSignOut, getSession, onAuthStateChange } from '../supabase/client.js';
import { clearLocalData } from '../supabase/sync.js';

// Auth state
export const authUser = writable(null);
export const authSession = writable(null);
export const authLoading = writable(true);
export const authError = writable(null);

// Derived store for checking if user is logged in
export const isAuthenticated = derived(authUser, $user => $user !== null);

// Initialize auth state
export async function initAuth() {
  authLoading.set(true);

  try {
    const session = await getSession();
    if (session) {
      authSession.set(session);
      authUser.set(session.user);
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
    authError.set(error.message);
  } finally {
    authLoading.set(false);
  }

  // Listen for auth changes
  onAuthStateChange((event, session) => {
    authSession.set(session);
    authUser.set(session?.user ?? null);

    if (event === 'SIGNED_OUT') {
      // Clear any local data if needed
    }
  });
}

// Sign up
export async function signUp(email, password) {
  authLoading.set(true);
  authError.set(null);

  try {
    const { data, error } = await supabaseSignUp(email, password);

    if (error) {
      authError.set(error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    authError.set(error.message);
    return { success: false, error: error.message };
  } finally {
    authLoading.set(false);
  }
}

// Sign in
export async function signIn(email, password) {
  authLoading.set(true);
  authError.set(null);

  try {
    const { data, error } = await supabaseSignIn(email, password);

    if (error) {
      authError.set(error.message);
      return { success: false, error: error.message };
    }

    authSession.set(data.session);
    authUser.set(data.user);

    return { success: true, data };
  } catch (error) {
    authError.set(error.message);
    return { success: false, error: error.message };
  } finally {
    authLoading.set(false);
  }
}

// Sign out
export async function signOut() {
  authLoading.set(true);
  authError.set(null);

  try {
    const { error } = await supabaseSignOut();

    if (error) {
      authError.set(error.message);
      return { success: false, error: error.message };
    }

    // Clear local data and stored user ID
    await clearLocalData();
    localStorage.removeItem('rpg_life_last_user_id');

    authSession.set(null);
    authUser.set(null);

    return { success: true };
  } catch (error) {
    authError.set(error.message);
    return { success: false, error: error.message };
  } finally {
    authLoading.set(false);
  }
}
