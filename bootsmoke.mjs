// Boot the PRODUCTION bundle under jsdom and surface any mount-time crash —
// the class of failure "stuck on the splash" implies.
import { JSDOM } from 'jsdom';
setTimeout(() => { console.log('FAIL  harness watchdog: still hung after 20s'); process.exit(3); }, 20000);
import { readFileSync, readdirSync } from 'fs';

const dom = new JSDOM(`<!doctype html><html><body><div id="root"><div class="boot">Litmus</div></div></body></html>`, {
  url: 'https://litmus.test/',
  pretendToBeVisual: true,
});
const { window } = dom;
for (const k of ['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','HTMLElement','Node','CustomEvent','getComputedStyle']) {
  if (window[k] !== undefined) {
    try { globalThis[k] = window[k]; } catch { Object.defineProperty(globalThis, k, { get: () => window[k] }); }
  }
}
try { Object.defineProperty(globalThis, 'navigator', { get: () => window.navigator, configurable: true }); } catch {}
for (const k of ['MutationObserver','Event','KeyboardEvent','MouseEvent','SVGElement','history','location','performance']) {
  if (globalThis[k] === undefined && window[k] !== undefined) {
    try { globalThis[k] = window[k]; } catch { try { Object.defineProperty(globalThis, k, { get: () => window[k], configurable: true }); } catch {} }
  }
}
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe(){} unobserve(){} disconnect(){} };
globalThis.caches = { open: async () => ({ match: async () => null, delete: async () => {}, put: async () => {} }) };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener(){}, removeEventListener(){} }));
globalThis.matchMedia = window.matchMedia;

// Simulate this user: a stored (expired) session forcing a network refresh,
// on a network that fails.
window.localStorage.setItem('sb-dummyref-auth-token', JSON.stringify({
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer',
  expires_at: 1000, expires_in: -1, user: { id: 'u1', email: 'x@y.z' },
}));
globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
window.fetch = globalThis.fetch;

const asset = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
console.log('booting dist/assets/' + asset);
window.addEventListener('error', (e) => console.log('WINDOW ERROR:', e.message));
process.on('unhandledRejection', (e) => console.log('UNHANDLED REJECTION:', e?.message || e));

try {
  await import('./dist/assets/' + asset);
  await new Promise((r) => setTimeout(r, 9500));
  const root = window.document.getElementById('root');
  const stillSplash = root.innerHTML.includes('class="boot"');
  console.log(stillSplash ? 'FAIL  splash never replaced — React did not mount' : 'PASS  React mounted, splash replaced');
  console.log('root now contains:', root.innerHTML.slice(0, 160).replace(/\s+/g, ' '));
  process.exit(stillSplash ? 1 : 0);
} catch (e) {
  console.log('BOOT CRASH:', e.message); process.exitCode = 1;
  console.log((e.stack || '').split('\n').slice(0, 6).join('\n'));
}
