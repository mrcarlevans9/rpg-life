import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eijlztxevgoemjqxzoyp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpamx6dHhldmdvZW1qcXh6b3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDQ1ODQsImV4cCI6MjA4NTM4MDU4NH0.jbv1nbn1iOHmD4Ba-axZKpExh3AYr3i9-4JqKBnJvTk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Subscribe to auth changes
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
