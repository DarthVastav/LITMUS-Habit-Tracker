// Store contract audit: every `useStore((s) => s.X)` selector used anywhere
// in the app must resolve to something the store actually defines. A patch
// that silently fails to insert an action produces `undefined` selectors
// that eslint cannot see — this catches them before they ship.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsx') || p.endsWith('.js') ? [p] : [];
  });

const store = readFileSync('src/store/useStore.js', 'utf8');
const defined = new Set();
for (const m of store.matchAll(/^\s{4}(?:async\s+)?([A-Za-z_]\w*)\s*[:(]/gm)) defined.add(m[1]);
for (const m of store.matchAll(/^\s{4}([A-Za-z_]\w*)\s*:/gm)) defined.add(m[1]);

let bad = 0;
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/useStore\(\(s\) => s\.([A-Za-z_]\w*)\)/g)) {
    if (!defined.has(m[1])) {
      console.log(`FAIL  ${file} selects s.${m[1]} — not defined in store`);
      bad++;
    }
  }
  // destructured state reads: const { a, b } = state — checked loosely via
  // direct s.X calls only; destructuring pulls plain state keys.
}
// Second boundary: every `db.X(...)` the store calls must be exported by
// the data layer. The prep feature shipped calling db.fetchPrep while the
// db-side patch had silently missed — this catches that class.
const dbSrc = readFileSync('src/lib/db.js', 'utf8');
const dbExports = new Set();
for (const m of dbSrc.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_]\w*)/g)) dbExports.add(m[1]);
for (const m of store.matchAll(/\bdb\.([A-Za-z_]\w*)\s*\(/g)) {
  if (!dbExports.has(m[1])) {
    console.log(`FAIL  store calls db.${m[1]} — not exported by src/lib/db.js`);
    bad++;
  }
}

console.log(bad ? `${bad} missing member(s)` : 'PASS  every selector and db call resolves');
process.exit(bad ? 1 : 0);
