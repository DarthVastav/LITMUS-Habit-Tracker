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

const navPrep = byText('button', 'Prep') || [...doc.querySelectorAll('button')].find((b) => /(^|\s)Prep(\s|$)/.test(b.textContent) && b.closest('[data-screen-label]') === null);
if (!navPrep) { console.log('FAIL nav Prep button not found'); process.exit(1); }
click(navPrep); await sleep(300);

const examTab = byText('button', 'Exam prep');
if (!examTab) { console.log('FAIL Exam prep tab not found'); process.exit(1); }
click(examTab); await sleep(300);

const input = doc.querySelector('input[placeholder="Add a topic to revise"]');
if (!input) { console.log('FAIL topic input not found'); process.exit(1); }
type(input, 'Porter five forces');
const addBtn = byText('button', 'Add topic');
click(addBtn); await sleep(400);

// Assert on RENDERED nodes — innerHTML includes the input's own value,
// which produced a false PASS while Add was actually broken.
const topicSpan = [...doc.querySelectorAll('span')].find((s) => s.textContent === 'Porter five forces');
const cardMeta = [...doc.querySelectorAll('span')].find((s) => /\/1 topics/.test(s.textContent));
console.log(topicSpan ? 'PASS  topic renders as a list row' : 'FAIL  topic not in rendered list');
console.log(cardMeta ? 'PASS  subject card shows 0/1 topics' : 'FAIL  no subject card');
const topicShown = !!(topicSpan && cardMeta);
// toggle it done
const rowCheckbox = [...doc.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label')||'').includes('Porter') && !(b.getAttribute('aria-label')||'').startsWith('Options'));
if (rowCheckbox) { click(rowCheckbox); await sleep(200); console.log('toggle done:', doc.body.innerHTML.includes('line-through') ? 'PASS strikethrough' : 'note: no strikethrough marker');
  console.log(rowCheckbox.getAttribute('aria-checked')==='true' ? 'PASS  box actually ticks' : 'FAIL  box did not tick'); }

// The ⋮ menu must portal ABOVE everything and offer Edit/Delete
const dots = [...doc.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label')||'') === 'Options for Porter five forces');
if (!dots) { console.log('FAIL  row menu button missing'); process.exit(1); }
click(dots); await sleep(150);
const menuEdit = [...doc.querySelectorAll('body > div button')].find((b) => b.textContent.trim() === 'Edit');
const menuDel = [...doc.querySelectorAll('body > div button')].find((b) => b.textContent.trim() === 'Delete');
console.log(menuEdit && menuDel ? 'PASS  portal menu shows Edit + Delete at body level' : 'FAIL  menu items not portaled');
if (menuEdit) {
  click(menuEdit); await sleep(200);
  const editInput = [...doc.querySelectorAll('input')].find((i) => i.value === 'Porter five forces');
  console.log(editInput ? 'PASS  Edit opens inline editor with the topic' : 'FAIL  inline editor missing');
  if (!editInput) process.exit(1);
}
if (!(menuEdit && menuDel)) process.exit(1);
process.exit(topicShown ? 0 : 1);
