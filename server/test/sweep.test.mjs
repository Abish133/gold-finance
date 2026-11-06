// Hit every GET endpoint (branch view and all-branches view) and report non-2xx / slow responses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
const mounts = { auth: '/auth', admin: '/admin', masters: '/masters', customers: '/customers', loans: '/loans', accounts: '/accounts', reports: '/reports',
  dashboard: '/dashboard', employees: '/employees', bank: '/bank', auction: '/auction', tools: '/tools', 'desk/deskReports': '/desk/rep', 'desk/desk': '/desk' };
let cookie = '';
const get = async (url, branch) => {
  const t = Date.now();
  const res = await fetch(B + url, { headers: { cookie, ...(branch ? { 'x-branch-id': branch } : {}) } });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const body = await res.text();
  let j = null; try { j = JSON.parse(body); } catch { /* file */ }
  return { status: res.status, ms: Date.now() - t, j };
};
const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@123' }) });
cookie = login.headers.get('set-cookie').split(';')[0];
const me = (await login.json()).data.user;
const ho = String(me.branches[0].id);

// sample ids for :params
const first = async (u) => (await get(u, ho)).j?.data?.[0];
const loan = await first('/loans?pageSize=1');
const cust = await first('/customers?pageSize=1');
const pledge = await first('/bank/pledges?status=');
const emp = await first('/employees');
const ids = { id: null, loanId: loan?.id, customerId: cust?.id };

const routes = [];
for (const [file, prefix] of Object.entries(mounts)) {
  const f = file.includes('/') ? `${SRC}/modules/${file}.routes.js` : `${SRC}/modules/${file}/${file}.routes.js`;
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/router\.get\('([^']+)'/g)) routes.push({ prefix, p: m[1], file });
}
const reps = (await get('/reports', ho)).j?.data || [];
const fail = [];
let n = 0;
for (const r of routes) {
  let p = r.p;
  if (p === '/:key' && r.prefix === '/reports') continue;
  if (p.includes(':')) {
    const pick = r.prefix === '/loans' ? loan?.id : r.prefix === '/customers' ? cust?.id : r.prefix === '/bank' ? pledge?.id : r.prefix === '/employees' ? emp?.id : null;
    if (!pick || (p.match(/:/g) || []).length > 1) { continue; }
    p = p.replace(/:[a-zA-Z]+/, pick);
  }
  for (const br of [ho, '']) {
    const url = r.prefix + p;
    const x = await get(url, br); n++;
    const bad = x.status >= 500 || (x.status >= 400 && ![400, 403, 404].includes(x.status));
    if (bad || x.ms > 2500) fail.push(`${x.status} ${x.ms}ms ${br ? 'HO ' : 'ALL'} ${url} ${x.j?.message || ''}`);
    else if (x.status >= 400) console.log(`  (${x.status}) ${br ? 'HO ' : 'ALL'} ${url} - ${x.j?.message || ''}`);
  }
}
for (const rep of reps) {
  for (const br of [ho, '']) {
    const x = await get(`/reports/${rep.key}`, br); n++;
    if (x.status >= 500 || x.ms > 2500) fail.push(`${x.status} ${x.ms}ms ${br ? 'HO ' : 'ALL'} /reports/${rep.key} ${x.j?.message || ''}`);
    else if (x.status >= 400) console.log(`  (${x.status}) ${br ? 'HO ' : 'ALL'} /reports/${rep.key} - ${x.j?.message || ''}`);
  }
}
console.log(`\n${n} requests, ${routes.length} GET routes, ${reps.length} reports`);
if (fail.length) process.exitCode = 1;
console.log(fail.length ? `FAILURES:\n${fail.join('\n')}` : 'NO SERVER ERRORS');
