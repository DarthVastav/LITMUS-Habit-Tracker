// Drive the PRODUCTION bundle through the prep flow with real DOM events.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const type = (input, text) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, text);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const byText = (sel, text) => [...window.document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text);

const asset = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('./dist/assets/' + asset);
await sleep(1200); // local-only boot seeds sample data + logs straight in

const doc = window.document;

// Local-only login: email + continue drops straight into the seeded app.
const emailInput = doc.querySelector('input[type="email"]') || [...doc.querySelectorAll('input')].find((i) => /email/i.test(i.placeholder || ''));
if (!emailInput) { console.log('FAIL login email input not found; body:', doc.body.textContent.slice(0,120)); process.exit(1); }
type(emailInput, 'vastav@test.dev');
const cont = [...doc.querySelectorAll('button')].find((b) => /continue/i.test(b.textContent));
click(cont); await sleep(500);

const navTT = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Timetable');
if (!navTT) { console.log('FAIL nav Timetable not found'); process.exit(1); }
window.addEventListener('error', (e) => console.log('CRASH:', e.message));
click(navTT); await sleep(600);
const body = doc.body.textContent;
const hasContent = /Class timetable|Upload master timetable|Your courses|batch's timetable/i.test(body);
const blank = body.replace(/\s+/g, '').length < 40;
console.log(hasContent ? 'PASS  timetable renders content' : blank ? 'FAIL  BLANK SCREEN reproduced' : 'FAIL  unexpected: ' + body.slice(0, 140));
if (!hasContent) process.exit(1);

// Personal clear: two taps hide the class timetable for THIS user
const clearBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Clear');
if (!clearBtn) { console.log('FAIL  Clear button missing'); process.exit(1); }
click(clearBtn); await sleep(150);
const armedBtn = [...doc.querySelectorAll('button')].find((b) => /for you only/i.test(b.textContent));
console.log(armedBtn ? 'PASS  arming explains personal scope' : 'FAIL  armed copy wrong');
click(armedBtn || clearBtn); await sleep(400);
const after = doc.body.textContent;
const gone = /Upload master timetable/i.test(after) && !/Add week/.test(after);
console.log(gone ? 'PASS  cleared locally — back to onboarding' : 'FAIL  timetable still visible: ' + after.slice(0, 120));
const restoreOffered = /batch's shared one/i.test(after);
console.log(!restoreOffered ? 'PASS  cloud restore hidden in offline mode' : 'FAIL  restore offered with no cloud');
if (!(armedBtn && gone && !restoreOffered)) process.exit(1);

// Mess tab: shared data must not offer Clear to a non-uploader
const messSeg = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Mess timetable');
if (messSeg) {
  click(messSeg); await sleep(400);
  const mbody = doc.body.textContent;
  const hasReupload = /Re-upload|No .*menu|Upload/i.test(mbody);
  const offersClear = /\bClear\b/.test(mbody);
  console.log(hasReupload ? 'PASS  mess tab renders' : 'FAIL  mess tab blank');
  console.log(offersClear ? 'FAIL  Clear offered to non-uploader on mess' : 'PASS  Clear hidden from non-uploader');
  process.exit(hasReupload && !offersClear ? 0 : 1);
}
process.exit(0);
