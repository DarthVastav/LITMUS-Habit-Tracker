// Web Push registration. The subscription row lives in Supabase; the
// Netlify scheduled function reads it and dispatches the reminders.
import { supabase } from './supabase.js';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[Litmus] service worker registration failed', err);
    return null;
  }
}

/**
 * Ask for permission, subscribe, and persist the subscription.
 * Returns { ok, reason } — the caller shows `reason` in a toast.
 */
export async function enablePush() {
  if (!pushSupported()) {
    return { ok: false, reason: 'This browser cannot show push reminders' };
  }
  if (!VAPID_PUBLIC) {
    return { ok: false, reason: 'Push is not configured on this deployment' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Notifications are blocked in your browser settings' };
  }

  const reg =
    (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return { ok: false, reason: 'Could not start the background worker' };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const json = sub.toJSON();
  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: auth.user.id,
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent.slice(0, 300),
        },
        { onConflict: 'endpoint' }
      );
      if (error) return { ok: false, reason: 'Could not save your reminder settings' };
    }
  }
  return { ok: true };
}

/** Drop the subscription when every reminder toggle is switched off. */
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
