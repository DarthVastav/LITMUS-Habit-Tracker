import { supabase } from './supabase.js';

/**
 * The app reports its own crashes: window errors and unhandled promise
 * rejections land in client_errors with a message, a stack, and the path —
 * never any task or habit content. Deduped and capped per session so a
 * render loop can't flood the table. Signed-out errors are skipped (the
 * table only accepts authenticated inserts).
 */
const APP_BUILD = '2026-08-31';
const seen = new Set();
let sent = 0;
let getUserId = () => null;

async function report(message, stack) {
  try {
    if (!supabase || sent >= 10) return;
    const uid = getUserId();
    if (!uid || uid === 'local') return;
    const key = String(message).slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    await supabase.from('client_errors').insert({
      user_id: uid,
      message: String(message).slice(0, 500),
      stack: String(stack || '').slice(0, 2000),
      path: location.pathname,
      build: APP_BUILD,
    });
  } catch {
    /* telemetry must never cause what it observes */
  }
}

export function initTelemetry(userIdGetter) {
  getUserId = userIdGetter;
  window.addEventListener('error', (e) => report(e.message, e.error?.stack));
  window.addEventListener('unhandledrejection', (e) =>
    report(e.reason?.message || String(e.reason), e.reason?.stack)
  );
}
