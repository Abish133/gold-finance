// Reports against MyBook's own screens: the @Test company data is rebuilt in a new branch (mybook-mirror.mjs)
// and every figure below was read off the desktop Day Report, Loan / Release / Part Payment reports,
// Loan & Release Summary, Current Stock and Interest Calculation for 05/11/2026.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
const out = execFileSync(process.execPath, [fileURLToPath(new URL('./mybook-mirror.mjs', import.meta.url))], { encoding: 'utf8' });
const mirror = JSON.parse(out.trim().split('\n').at(-1));
let cookie = '';
const fails = [];
const get = async (url) => {
  const res = await fetch(B + url, { headers: { cookie, 'x-branch-id': String(mirror.branch) } });
  const j = await res.json(); if (!res.ok) throw new Error(`${url} -> ${res.status} ${j?.message}`); return j.data;
};
const eq = (got, exp, what) => { if (Math.abs(Number(got) - exp) > 0.01) fails.push(`${what}: ours ${got}, MyBook ${exp}`); };
const login = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@123' }) });
cookie = login.headers.get('set-cookie').split(';')[0];
const D = '2026-11-05';

// Day Report
const day = await get(`/desk/day-report?from=${D}&to=${D}`);
const row = (id) => day.accounts.find((a) => a.id === id) || { jama: 0, nave: 0 };
eq(row(1).jama, 50000, 'Girvi jama'); eq(row(1).nave, 50000, 'Girvi nave'); eq(row(2).jama, 750, 'Interest'); eq(row(4).jama, 0, 'Document charges');
eq(row(5).jama, 6000, 'Ashal Jama'); eq(row(6).jama, 740, 'Interest Jama'); eq(day.jama, 57490, 'Day total jama'); eq(day.nave, 50000, 'Day total nave');
eq(day.closing, 7490, 'Pote Baki'); eq(day.tally.cashInDrawer, 7490, 'Cash in drawer');
if (!day.accounts.some((a) => a.id === 9) || !day.accounts.some((a) => a.id === 10)) fails.push('Day report must list Potali rows 9 and 10');
// Billing date + home screen
eq(new Date((await get('/desk/billing-date')).billingDate).getTime(), new Date(D).getTime(), 'billing date');
const dash = await get(`/dashboard?date=${D}`);
eq(dash.today.loans.cnt, 1, 'loans today'); eq(dash.today.loans.principal, 50000, 'loans today amount'); eq(dash.today.cash.closing, 7490, 'cash in hand');
eq(n(dash.today.loans.advance_interest) + n(dash.today.transactions.RELEASE?.interest) + n(dash.today.transactions.INTEREST?.interest) + n(dash.today.transactions.PART_PAYMENT?.interest), 1490, 'interest today');
// Loan Report
const loans = await get('/desk/rep/loans?from=2025-01-05&to=2026-11-05');
eq(loans.length, 4, 'loan report rows'); eq(sum(loans, 'principal'), 99690, 'loan report amount'); eq(sum(loans, 'advance_interest'), 1120, 'loan report advance');
eq(sum(loans, 'gross_wt'), 39.99, 'gross'); eq(sum(loans, 'stone_wt'), 0.5, 'less'); eq(sum(loans, 'net_wt'), 39.49, 'net');
// Release Report
const rel = await get(`/desk/rep/releases?from=${D}&to=${D}`);
eq(rel.length, 1, 'releases'); eq(rel[0].total_amount, 50000, 'release received'); eq(rel[0].days, 1, 'release days'); eq(rel[0].pct_month, 45.63, '% p.m.'); eq(rel[0].pct_year, 547.5, '% / year');
// Part Payment Report (grouped by loan like the desktop)
const pp = await get(`/desk/rep/part-payments?from=${D}&to=${D}`);
eq(pp.length, 4, 'part payments'); eq(sum(pp, 'part_amount'), 6000, 'part amount'); eq(sum(pp, 'interest'), 740, 'part interest'); eq(sum(pp, 'months_paid'), 4, 'months');
if (pp.map((x) => x.bill_no).join() !== '2,2,4,4') fails.push(`part payment order ${pp.map((x) => x.bill_no).join()} (MyBook 2,2,4,4)`);
// Loan & Release Summary (A/c year 2026-27)
const sm = await get('/desk/rep/summary?from=2026-04-01&to=2027-03-31&view=month');
eq(sm.opening, 49690, 'summary opening'); eq(sm.closing, 49690, 'summary closing balance'); eq(sm.outstanding, 43690, 'summary outstanding');
const nov = sm.rows.find((r) => r.key === '2026-11');
eq(nov.given, 50000, 'Nov given'); eq(nov.released, 50000, 'Nov released'); eq(nov.part_paid, 6000, 'Nov part paid'); eq(nov.balance, 49690, 'Nov balance'); eq(nov.outstanding, 43690, 'Nov outstanding');
// Current Stock
const st = await get(`/desk/stock?as_on=${D}`);
eq(st.length, 3, 'stock loans'); eq(sum(st, 'principal'), 49690, 'stock amount'); eq(sum(st, 'part_paid'), 6000, 'stock part paid'); eq(sum(st, 'net_wt'), 29.99, 'stock weight');
st.forEach((x) => eq(x.age_months, 22, `stock age ${x.bill_no}`));
// Interest Calculation
const due = (await get(`/desk/interest-due?from=2025-01-01&to=${D}&upto=${D}`)).rows;
const byNo = Object.fromEntries(due.map((x) => [x.bill_no, x]));
eq(byNo['2'].interest_due, 3482, 'loan 2 interest due'); eq(byNo['3'].interest_due, 3885, 'loan 3 interest due'); eq(byNo['4'].interest_due, 12200, 'loan 4 interest due');
eq(sum(due, 'interest_due'), 19567, 'interest due total (customer panel)'); due.forEach((x) => eq(x.months, 22, `months ${x.bill_no}`));

function sum(list, k) { return list.reduce((s, x) => s + Number(x[k] || 0), 0); }
function n(v) { return Number(v || 0); }
console.log(fails.length ? `FAILED ${fails.length}:\n${fails.join('\n')}` : 'ALL MYBOOK REPORT FIGURES MATCH');
if (fails.length) process.exitCode = 1;
