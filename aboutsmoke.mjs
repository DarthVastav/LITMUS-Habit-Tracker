// Render the About screen's live math against a seeded local session and
// assert the arithmetic lines actually appear with numbers.
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
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const click=(el)=>el.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));
const type=(i,v)=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(i,v);i.dispatchEvent(new window.Event('input',{bubbles:true}));};

const asset = readdirSync('dist/assets').find((f)=>f.startsWith('index-')&&f.endsWith('.js'));
await import('./dist/assets/'+asset);
await sleep(1000);
const doc = window.document;
type([...doc.querySelectorAll('input')].find(i=>/email/i.test(i.placeholder||'')),'v@t.dev');
click([...doc.querySelectorAll('button')].find(b=>/continue/i.test(b.textContent)));
await sleep(500);
click([...doc.querySelectorAll('button')].find(b=>b.textContent.trim()==='Settings'));
await sleep(300);
click([...doc.querySelectorAll('*')].find(e=>e.textContent.trim()==='Know the App' && e.children.length===0)?.closest('button,[role],div[style*="cursor"]') || [...doc.querySelectorAll('button')].find(b=>/Know the App/.test(b.textContent)));
await sleep(400);
const text = doc.body.textContent;
const hasLive = text.includes('YOUR NUMBERS, LIVE');
const hasSnap = /Your score\s*\d+/.test(text) || /rescaled to 100/.test(text);
const hasFloor = /Last 30 days/.test(text);
console.log(hasLive ? 'PASS  live section renders' : 'FAIL  live section missing');
console.log(hasSnap ? 'PASS  snapshot arithmetic shown' : 'FAIL  no snapshot line — body: '+text.slice(0,150));
console.log(hasFloor ? 'PASS  30-day breakdown rendered' : 'FAIL  30-day section missing');
process.exit(hasLive&&hasSnap&&hasFloor?0:1);
