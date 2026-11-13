// Runs every API test against a running dev server (npm run dev) on the DEV database.
// The tests create their own test branches / customers / loans (never in the shop's Head Office); backup.test restores
// the data it changed, and cleanup.mjs removes the test branches and users at the end.
// Usage: npm test            (all)       npm test -- flows sweep   (only matching files)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const API = process.env.API_URL || 'http://localhost:5000';
try { await fetch(`${API}/api/health`); } catch { console.error(`API is not running on ${API} - start it with "npm run dev" first`); process.exit(1); }

const order = ['interest', 'interest-days', 'mybook', 'mybook-reports', 'smoke', 'parity', 'desk', 'flows', 'sweep', 'backup'];

// New loans need today's gold / silver rate. On the first run of a day it may not be entered yet:
// carry the latest rate of each metal forward to today (only when today's is missing).
{
  let cookie = '';
  const call = async (method, url, body) => {
    const r = await fetch(`${API}/api${url}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return r.json().catch(() => null);
  };
  await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const rates = (await call('GET', '/masters/rates?pageSize=100'))?.data || [];
  for (const metalId of [...new Set(rates.map((r) => r.metal_id))]) {
    const mine = rates.filter((r) => r.metal_id === metalId).sort((a, b) => String(b.rate_date).localeCompare(String(a.rate_date)));
    if (mine[0] && String(mine[0].rate_date).slice(0, 10) !== today) {
      const { purity, market_rate, loan_rate } = mine[0];
      await call('POST', '/masters/rates', { metal_id: metalId, rate_date: today, purity, market_rate, loan_rate });
      console.log(`today's rate missing for metal ${metalId} - carried forward ${market_rate}`);
    }
  }
}
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
// leave the dev database with only the shop's own data
if (!want.length) spawnSync(process.execPath, [dir + 'cleanup.mjs'], { stdio: 'inherit', env: process.env });
console.log('\n--- summary');
for (const [f, ok, s] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${s}s)`);
process.exit(results.every((r) => r[1]) ? 0 : 1);
