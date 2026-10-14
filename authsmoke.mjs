// Authed boot: VALID stored session + every network call failing. Hydrate
// must survive its rejections and still set the user — the greeting shows
// a real name, never "there". This is the path all other smokes missed.
import { JSDOM } from 'jsdom';
import { readdirSync } from 'fs';
setTimeout(() => { console.log('FAIL watchdog'); process.exit(3); }, 25000);
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: 'https://litmus.test/', pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window','document','localStorage','requestAnimationFrame','cancelAnimationFrame','HTMLElement','Node','CustomEvent','getComputedStyle','MutationObserver','Event','KeyboardEvent','MouseEvent','SVGElement']) {
  try { globalThis[k] = window[k]; } catch { try { Object.defineProperty(globalThis, k, { get: () => window[k], configurable: true }); } catch {} }
}
try { Object.defineProperty(globalThis, 'navigator', { get: () => window.navigator, configurable: true }); } catch {}
globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.caches = { open: async () => ({ match: async () => null, delete: async () => {}, put: async () => {} }) };
window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
globalThis.matchMedia = window.matchMedia;

// A session that is still VALID (no refresh needed) for user vas@test.dev
window.localStorage.setItem('sb-dummyref-auth-token', JSON.stringify({
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer',
  expires_at: Math.floor(Date.now()/1000) + 3600, expires_in: 3600,
  user: { id: 'u1', aud: 'authenticated', email: 'vas@test.dev', user_metadata: { name: 'Vastav Reddy' } },
}));
globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
window.fetch = globalThis.fetch;

const asset = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('./dist/assets/' + asset);
await new Promise((r) => setTimeout(r, 10500));
const text = window.document.body.textContent;
const greetsName = /Good (morning|afternoon|evening), (?!there)/.test(text);
const saysThere = /Good (morning|afternoon|evening), there/.test(text);
console.log(greetsName ? 'PASS  greeting carries a real name' : saysThere ? 'FAIL  greeted "there" — hydrate died before setting the user' : 'FAIL  no greeting found: ' + text.slice(0, 120));
process.exit(greetsName ? 0 : 1);
