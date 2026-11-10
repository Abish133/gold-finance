// The MyBook test loans entered through our API (old loan entry, MyBook scheme), checked against the desktop figures.
import { MYBOOK_LOANS, MYBOOK_CASES, PLEDGED, MYBOOK_AFTER_PAYMENTS } from './mybook-interest.cases.mjs';

const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = ''; let branch = '';
const fails = [];
const call = async (method, url, body) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  return j;
};
const eq = (got, exp, what) => { if (Math.abs(Number(got) - exp) > 0.5) fails.push(`${what}: ours ${got}, MyBook ${exp}`); };

await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
const tag = Date.now().toString().slice(-5);
branch = String((await call('POST', '/admin/branches', { code: 'M' + tag.slice(-4), name: `MyBook Check ${tag}`, phone: '9000000001', loan_prefix: 'M', opening_cash: 500000 })).data.id);
const lk = (await call('GET', '/masters/lookups')).data;
const scheme = lk.schemes.find((s) => s.calc_mode === 'MYBOOK');
if (!scheme) throw new Error('MyBook scheme missing - run npm run db:migrate');
if (lk.schemes[0].id !== scheme.id) fails.push('MyBook scheme is not the first (default) scheme');
const cust = (await call('POST', '/customers', { name: 'Mybook Check', relation_name: 'Father', phone: `7${tag}12345`.slice(0, 10) })).data;

const ids = {};
for (const [k, l] of Object.entries(MYBOOK_LOANS)) {
  const r = (await call('POST', '/loans/old', { customer_id: cust.id, scheme_id: scheme.id, loan_date: PLEDGED, manual_bill_no: `${k}-${tag}`, principal: l.principal,
    interest_rate: l.interest_rate, interest_type: l.interest_type, advance_interest: l.advance_interest, rate_per_gram: 7900, rate_basis: 100,
    items: [{ item_name: 'Chain', pcs: 1, gross_wt: 10, stone_wt: 0, purity: 91.6, rate_basis: 100 }] })).data;
  ids[k] = r.loan.id;
  eq(r.loan.market_value, 72400, `${k} item value`);
}
for (const [d, m, ...exp] of MYBOOK_CASES) {
  for (const [i, k] of Object.keys(MYBOOK_LOANS).entries()) {
    const c = (await call('GET', `/loans/${ids[k]}/calc?date=${d}`)).data;
    eq(c.interestDue, exp[i], `${k} due ${d}`); eq(c.months, m, `${k} months ${d}`);
    eq(c.totalPayable, MYBOOK_LOANS[k].principal + exp[i], `${k} total ${d}`);
  }
}
// MyBook: L2 pays 3 months interest (₹555), L4 pays ₹5,000 part amount; later dates compared
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
await call('POST', `/loans/${ids.L2}/interest`, { date: today, interest_amount: 555 });
await call('POST', `/loans/${ids.L4}/part-payment`, { date: today, principal_amount: 5000, interest_amount: 0 });
for (const [d, l2, l4i, l4t] of MYBOOK_AFTER_PAYMENTS.filter(([d]) => d >= today)) {
  eq((await call('GET', `/loans/${ids.L2}/calc?date=${d}`)).data.interestDue, l2, `L2 after interest ${d}`);
  const c4 = (await call('GET', `/loans/${ids.L4}/calc?date=${d}`)).data;
  eq(c4.interestDue, l4i, `L4 interest after part payment ${d}`); eq(c4.totalPayable, l4t, `L4 total after part payment ${d}`);
}
// MyBook: Top-up is not allowed on an Old Loan Entry
{ const res = await fetch(`${B}/loans/${ids.L3}/topup`, { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: JSON.stringify({ date: today, amount: 1000 }) });
  const j = await res.json(); if (res.ok || !/Old Loan Entry/.test(j.message)) fails.push(`top-up on old loan should be refused (got ${res.status} ${j.message})`); }
// MyBook Re-loan: receive = old total - new amount + new advance (same amount, rate and type)
{ const c = (await call('GET', `/loans/${ids.L3}/calc?date=${today}`)).data;
  const months = c.months; const due = 185 * months - 185;
  eq(c.interestDue, due, `L3 due on re-loan day (${months} m)`);
  const nl = (await call('POST', `/loans/${ids.L3}/renew`, { date: today, new_principal: 12345, advance_interest: 185, interest_type: 'SIMPLE', payments: [{ mode: 'CASH', amount: due + 185 }] })).data;
  eq(nl.loan.principal, 12345, 're-loan new amount'); if (nl.loan.interest_type !== 'SIMPLE') fails.push('re-loan keeps flat type');
  const rel = (await call('GET', `/loans/${ids.L3}`)).data.transactions.find((t) => t.txn_type === 'RELEASE');
  eq(rel.interest_amount, due, 're-loan interest collected'); eq(rel.total_amount, 12345 + due, 're-loan old loan total');
  eq(nl.calc.monthlyInterest, 185, 're-loan new interest / month'); }
console.log(fails.length ? `FAILED ${fails.length}:\n${fails.join('\n')}` : 'ALL MYBOOK LOAN FIGURES MATCH THROUGH THE API');
if (fails.length) process.exitCode = 1;
