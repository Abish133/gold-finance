/**
 * Branch isolation: every GET endpoint and every report, asked for one branch, must return only that branch's rows.
 * For each branch it walks the whole JSON answer and checks every row that names a branch (branch_id), a loan
 * (loan_id, or a row with bill_no) or a customer (customer_id) against the database.
 * Needs the dev server running and at least two branches with data (npm run db:demo).
 *   node test/branch-isolation.test.mjs
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query, pool } from '#config/db.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
const mounts = { admin: '/admin', masters: '/masters', customers: '/customers', loans: '/loans', accounts: '/accounts', reports: '/reports',
  dashboard: '/dashboard', employees: '/employees', bank: '/bank', auction: '/auction', tools: '/tools', 'desk/deskReports': '/desk/rep', 'desk/desk': '/desk' };
// company-wide by design: users, roles, branches, rates, items, metals, schemes list, settings, audit, backups
const SHARED = [/^\/admin\/(users|roles|branches|company|settings|backups|audit|message-templates|screens|health|appearance)/, /^\/masters\/(rates|items|metals|purities|categories|designations|lookups|rate)/, /^\/reports$/];

let cookie = '';
const get = async (url, branch) => {
  const res = await fetch(B + url, { headers: { cookie, 'x-branch-id': branch } });
  let j = null; try { j = await res.json(); } catch { /* a file */ }
  return { status: res.status, j };
};
const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'Admin@123' }) });
cookie = login.headers.get('set-cookie').split(';')[0];
const me = (await login.json()).data.user;

// what belongs where, straight from the database
const loanBranch = new Map((await query('SELECT id, bill_no, branch_id FROM loans')).map((r) => [r.id, r.branch_id]));
const billBranch = new Map((await query('SELECT bill_no, branch_id FROM loans')).map((r) => [String(r.bill_no), r.branch_id]));
const custBranch = new Map((await query('SELECT id, branch_id FROM customers')).map((r) => [r.id, r.branch_id]));
const branches = (await query('SELECT b.id, b.code FROM branches b WHERE EXISTS (SELECT 1 FROM loans l WHERE l.branch_id = b.id) ORDER BY b.id')).filter((b) => me.branches.some((x) => x.id === b.id));
if (branches.length < 2) { console.log('need two branches with loans - run npm run db:demo'); process.exit(0); }

const routes = [];
for (const [file, prefix] of Object.entries(mounts)) {
  const f = file.includes('/') ? `${SRC}/modules/${file}.routes.js` : `${SRC}/modules/${file}/${file}.routes.js`;
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/router\.get\('([^']+)'/g)) if (!m[1].includes(':')) routes.push(prefix + m[1]);
}
const reps = ((await get('/reports', String(branches[0].id))).j?.data || []).map((r) => `/reports/${r.key}`);
const urls = [...routes.filter((u) => !SHARED.some((re) => re.test(u)) && u !== '/reports/'), ...reps];

const leaks = [];
const walk = (v, want, url, code, path = '') => {
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, want, url, code, `${path}[${i}]`)); return; }
  if (!v || typeof v !== 'object') return;
  const flag = (what, got) => leaks.push(`${code} ${url} ${path || '.'} ${what} belongs to branch ${got}`);
  // branch_id 0 = a company-wide row (e.g. a global setting), shared by every branch
  if (v.branch_id != null && Number(v.branch_id) !== 0 && Number(v.branch_id) !== want) flag(`branch_id ${v.branch_id}`, v.branch_id);
  if (v.loan_id != null && loanBranch.has(Number(v.loan_id)) && loanBranch.get(Number(v.loan_id)) !== want) flag(`loan ${v.loan_id}`, loanBranch.get(Number(v.loan_id)));
  if (v.customer_id != null && custBranch.get(Number(v.customer_id)) != null && custBranch.get(Number(v.customer_id)) !== want) flag(`customer ${v.customer_id}`, custBranch.get(Number(v.customer_id)));
  if (v.bill_no != null && v.branch_id == null && v.loan_id == null && billBranch.has(String(v.bill_no)) && billBranch.get(String(v.bill_no)) !== want) flag(`loan no ${v.bill_no}`, billBranch.get(String(v.bill_no)));
  for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object') walk(x, want, url, code, `${path}.${k}`);
};

let n = 0;
const differs = { same: [], seen: 0 };
for (const url of urls) {
  const answers = [];
  for (const b of branches) {
    const x = await get(url.includes('?') ? url : `${url}${url.startsWith('/reports/') ? '?from=2000-01-01&to=2099-12-31' : ''}`, String(b.id)); n += 1;
    if (x.status >= 400 || !x.j) continue;
    walk(x.j.data ?? x.j, b.id, url, b.code);
    answers.push(JSON.stringify(x.j.data ?? x.j));
  }
  // an answer with branch data that is byte-for-byte the same for every branch is suspicious
  if (answers.length === branches.length && answers.length > 1 && new Set(answers).size === 1 && answers[0].length > 40 && /bill_no|customer|amount|principal|total/i.test(answers[0])) differs.same.push(url);
  differs.seen += 1;
}
await pool.end();
console.log(`${n} requests over ${urls.length} endpoints and reports, branches ${branches.map((b) => b.code).join(', ')}`);
if (differs.same.length) console.log(`same answer for every branch (check):\n  ${differs.same.join('\n  ')}`);
if (leaks.length) {
  const uniq = [...new Set(leaks.map((l) => l.split(' ').slice(0, 2).join(' ')))];
  console.log(`LEAKS (${leaks.length} rows) in:\n  ${uniq.join('\n  ')}\nfirst rows:\n  ${leaks.slice(0, 15).join('\n  ')}`);
  process.exitCode = 1;
} else console.log('BRANCH ISOLATION OK - no row of another branch in any answer');
