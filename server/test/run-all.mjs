// Runs every API test against a running dev server (npm run dev) on the DEV database.
// The tests create their own test branches / customers / loans; backup.test restores the data it changed.
// Usage: npm test            (all)       npm test -- flows sweep   (only matching files)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const API = process.env.API_URL || 'http://localhost:5000';
try { await fetch(`${API}/api/health`); } catch { console.error(`API is not running on ${API} - start it with "npm run dev" first`); process.exit(1); }

const order = ['interest', 'mybook', 'mybook-reports', 'smoke', 'parity', 'desk', 'flows', 'sweep', 'backup'];
const want = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs'))
  .sort((a, b) => order.indexOf(a.split('.')[0]) - order.indexOf(b.split('.')[0]))
  .filter((f) => !want.length || want.some((w) => f.includes(w)));

const results = [];
for (const f of files) {
  console.log(`\n=== ${f}`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [dir + f], { stdio: 'inherit', env: process.env });
  results.push([f, r.status === 0, Math.round((Date.now() - t) / 1000)]);
}
console.log('\n--- summary');
for (const [f, ok, s] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${s}s)`);
process.exit(results.every((r) => r[1]) ? 0 : 1);
