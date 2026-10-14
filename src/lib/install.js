/**
 * PWA install plumbing. Chrome-family browsers hand us a deferred
 * beforeinstallprompt we can fire from our own button; iOS Safari has no
 * API at all, so there we show manual steps instead. Once installed —
 * detected by display-mode, the appinstalled event, or the user telling
 * us so on iOS — every install CTA disappears for good.
 */
let deferred = null;
const listeners = new Set();

const FLAG = 'litmus:installed';

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS masquerades

export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

export const isInstalled = () => {
  try {
    return isStandalone() || localStorage.getItem(FLAG) === '1';
  } catch {
    return isStandalone();
  }
};

export const markInstalled = () => {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
};

export const canPrompt = () => !!deferred;

export const promptInstall = async () => {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  listeners.forEach((fn) => fn());
  ev.prompt();
  const choice = await ev.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
};

export const onInstallChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => markInstalled());
}
