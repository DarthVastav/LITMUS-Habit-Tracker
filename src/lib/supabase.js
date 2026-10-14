import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when env vars are missing — the app then runs local-only. */
export const configured = Boolean(url && anon);

if (!configured) {
  console.warn(
    '[Litmus] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. ' +
      'Running in local-only mode: data stays in this browser and no OTP is sent.'
  );
}

export const supabase = configured
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Send a real 6-digit email OTP. Creates the user if they're new. */
export async function sendOtp(email, name) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: name ? { name } : undefined },
  });
  if (error) throw error;
}

/** Verify the typed code. Throws on a wrong or expired code. */
export async function verifyOtp(email, token) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data;
}

/**
 * Google sign-in via the redirect flow: works in the browser AND in the
 * installed PWA — the OAuth page opens, Google redirects back into the
 * app's origin, and the client exchanges the code for a session, which
 * the auth listener then hydrates. Costs zero OTP emails.
 */
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
