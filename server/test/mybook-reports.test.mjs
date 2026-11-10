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
eq(row(1).jama, 62345, 'Girvi jama (incl. auctioned loan back)'); eq(row(1).nave, 50000, 'Girvi nave'); eq(row(2).jama, 750, 'Interest'); eq(row(4).jama, 0, 'Document charges');
eq(row(5).jama, 6000, 'Ashal Jama'); eq(row(6).jama, 740, 'Interest Jama'); eq(row(8).jama, 20000, 'Auction jama (sale)'); eq(row(8).nave, 12345, 'Auction nave (marked)'); eq(row(9).jama, 30000, 'Potali jama'); eq(row(9).nave, 30000, 'Potali nave');
eq(row(10).nave, 10, 'Potali interest'); eq(row(11).nave, 100, 'Bank loan charges'); if (row(11).name !== 'Bank Loan Charges (Potali)') fails.push(`row 11 name ${row(11).name}`);
eq(day.jama, 119835, 'Day total jama'); eq(day.nave, 92455, 'Day total nave');
eq(day.closing, 27380, 'Pote Baki'); eq(day.tally.cashInDrawer, 27380, 'Cash in drawer');
if (!day.accounts.some((a) => a.id === 9) || !day.accounts.some((a) => a.id === 10)) fails.push('Day report must list Potali rows 9 and 10');
// Billing date + home screen
eq(new Date((await get('/desk/billing-date')).billingDate).getTime(), new Date(D).getTime(), 'billing date');
const dash = await get(`/dashboard?date=${D}`);
eq(dash.today.loans.cnt, 1, 'loans today'); eq(dash.today.loans.principal, 50000, 'loans today amount'); eq(dash.today.cash.closing, 27380, 'cash in hand');
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
eq(sm.opening, 49690, 'summary opening'); eq(sm.closing, 37345, 'summary closing balance'); eq(sm.outstanding, 31345, 'summary outstanding');
const nov = sm.rows.find((r) => r.key === '2026-11');
eq(nov.given, 50000, 'Nov given'); eq(nov.released, 50000, 'Nov released'); eq(nov.auctioned, 12345, 'Nov auctioned'); eq(nov.part_paid, 6000, 'Nov part paid'); eq(nov.balance, 37345, 'Nov balance'); eq(nov.outstanding, 31345, 'Nov outstanding');
// Current Stock
const st = await get(`/desk/stock?as_on=${D}`);
eq(st.length, 2, 'stock loans'); eq(sum(st, 'principal'), 37345, 'stock amount'); eq(sum(st, 'part_paid'), 6000, 'stock part paid'); eq(sum(st, 'net_wt'), 19.99, 'stock weight');
st.forEach((x) => eq(x.age_months, 22, `stock age ${x.bill_no}`));
// Interest Calculation
const due = (await get(`/desk/interest-due?from=2025-01-01&to=${D}&upto=${D}`)).rows;
const byNo = Object.fromEntries(due.map((x) => [x.bill_no, x]));
eq(byNo['3'].interest_due, 3885, 'loan 3 interest due'); eq(byNo['4'].interest_due, 12200, 'loan 4 interest due'); if (byNo['2']) fails.push('auctioned loan 2 still in interest list'); due.forEach((x) => eq(x.months, 22, `months ${x.bill_no}`));

// Bank (MyBook Bank Release + Bank Reports)
const rel2 = (await get(`/bank/pledges?status=CLOSED&date_on=release&from=2026-04-01&to=${D}`)).find((x) => x.id === mirror.bankPledge);
eq(rel2.days, 1, 'bank days'); eq(rel2.interest_paid, 10, 'bank interest'); eq(rel2.total_paid, 30010, 'paid to bank'); eq(rel2.paid_pct_year, 12.17, 'bank % / year');
eq(rel2.our_interest, 23, 'our interest (estimate)'); eq(rel2.our_margin, 13, 'our margin'); eq(rel2.cash_received, 29900, 'bank cash received');
const mw = await get(`/bank/month-wise?from=2026-04-01&to=${D}`);
if (mw[0].month !== 'Opening' || mw.length !== 9) fails.push(`bank month-wise rows ${mw.length} (Opening + Apr..Nov)`);
const mn = mw.find((x) => x.month === '2026-11'); eq(mn.taken, 30000, 'month taken'); eq(mn.released, 30000, 'month released'); eq(mn.interest, 10, 'month interest'); eq(mw.at(-1).balance, 0, 'closing at bank');
// Auction (Auction Release: profit = sold for - loan amount)
const sale = (await get('/auction/sales')).find((x) => x.loan_id === mirror.loans[2]);
eq(sale.principal_due, 12345, 'auction loan amount'); eq(sale.sale_amount, 20000, 'sold for'); eq(sale.surplus, 7655, 'auction release profit'); eq(sale.interest_due, 3482, 'interest due at auction');
eq(20000 - (n(sale.principal_due) + n(sale.interest_due) + n(sale.charges)), 4173, 'auction report profit (vs total due)');

function sum(list, k) { return list.reduce((s, x) => s + Number(x[k] || 0), 0); }
function n(v) { return Number(v || 0); }
console.log(fails.length ? `FAILED ${fails.length}:\n${fails.join('\n')}` : 'ALL MYBOOK REPORT FIGURES MATCH');
if (fails.length) process.exitCode = 1;
