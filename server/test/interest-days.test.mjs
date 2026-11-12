// Interest by days / typed amount, and interest + part amount on one receipt (Part Payment and Release)
import { testBranch } from './_testbranch.mjs';
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = '';
let branch = '';
const call = async (method, url, body, expectFail) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok && !expectFail) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  if (res.ok && expectFail) throw new Error(`${method} ${url} should have failed`);
  return j;
};
const ok = (m) => console.log('✔', m);
const eq = (a, b, m) => { if (Math.abs(Number(a) - Number(b)) > 0.009) throw new Error(`${m}: expected ${b}, got ${a}`); ok(`${m} = ${b}`); };

await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
branch = await testBranch(call);
const day = (await call('GET', '/desk/billing-date')).data.billingDate;
const lk = (await call('GET', '/masters/lookups')).data;
const scheme = lk.schemes.find((s) => s.calc_mode === 'MYBOOK') || lk.schemes[0];
const cust = (await call('POST', '/customers', { name: 'DAYS INTEREST CHECK', phone: '9000012345', area: 'TEST' })).data;
const newLoan = async () => (await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 7000, principal: 30000, interest_rate: 1.5, rate_type: 'MONTHLY', advance_interest: 0,
  items: [{ item_name: 'Chain', pcs: 1, gross_wt: 10, stone_wt: 0, purity: 91.6 }], payments: [{ mode: 'CASH', amount: 30000 }] })).data.loan;

// 1. interest by days on the Interest receipt
const L1 = await newLoan();
const full1 = (await call('GET', `/loans/${L1.id}`)).data;
const monthly = full1.calc.monthlyInterest;
const i15 = Math.round((monthly / 30) * 15);
await call('POST', `/loans/${L1.id}/interest`, { date: day, interest_amount: i15, interest_days: 15, interest_upto: day });
let t = (await call('GET', `/loans/${L1.id}`)).data.transactions.filter((x) => !x.is_void).at(-1);
eq(t.interest_days, 15, 'interest receipt stores days');
eq(t.interest_amount, i15, '15 days interest');
eq(t.months_paid, 0, 'months not counted for a days receipt');

// 2. interest + part amount = one receipt
await call('POST', `/loans/${L1.id}/part-payment`, { date: day, principal_amount: 5000, interest_amount: 300, interest_days: 7, payments: [{ mode: 'CASH', amount: 5300 }] });
const full2 = (await call('GET', `/loans/${L1.id}`)).data;
t = full2.transactions.filter((x) => !x.is_void).at(-1);
eq(t.total_amount, 5300, 'one receipt total');
eq(t.interest_amount, 300, 'interest on the part payment receipt');
eq(-t.principal_amount, 5000, 'part amount on the same receipt');
eq(t.interest_days, 7, 'days on the part payment receipt');
eq(full2.calc.principalOutstanding, 25000, 'outstanding after part amount');

// 2b. typed rate (1.25% instead of 1.5%) is stored on the receipt
await call('POST', `/loans/${L1.id}/interest`, { date: day, interest_amount: 375, months_paid: 1, interest_rate: 1.25 });
t = (await call('GET', `/loans/${L1.id}`)).data.transactions.filter((x) => !x.is_void).at(-1);
eq(t.interest_rate_used, 1.25, 'typed rate stored');
await call('POST', `/loans/${L1.id}/interest`, { date: day, interest_amount: 10, interest_rate: 99 }, true);
ok('rate above 20% refused');

// 3. release: interest by days (lower than the full month) - admin passes approval itself
const L2 = await newLoan();
const c2 = (await call('GET', `/loans/${L2.id}`)).data.calc;
const i7 = Math.round((c2.monthlyInterest / 30) * 7);
await call('POST', `/loans/${L2.id}/release`, { date: day, interest_amount: i7, interest_days: 7, payments: [{ mode: 'CASH', amount: 30000 + i7 }] });
const r = (await call('GET', `/loans/${L2.id}`)).data;
t = r.transactions.filter((x) => !x.is_void && x.txn_type === 'RELEASE').at(-1);
eq(t.interest_amount, i7, 'release charged 7 days');
eq(t.interest_days, 7, 'release stores days');
if (r.loan.status !== 'CLOSED') throw new Error('loan not closed');
ok('loan closed');

// 4. minimum days rule
const before = (await call('GET', '/admin/settings', undefined)).data.INTEREST_MIN_DAYS;
await call('PUT', '/admin/settings?scope=global', { INTEREST_MIN_DAYS: '10' });
try {
  await call('POST', `/loans/${L1.id}/interest`, { date: day, interest_amount: 100, interest_days: 5 }, true);
  ok('fewer than the minimum days is refused');
  await call('POST', `/loans/${L1.id}/interest`, { date: day, interest_amount: 100, interest_days: 0 }, true);
  ok('zero days is refused');
} finally {
  await call('PUT', '/admin/settings?scope=global', { INTEREST_MIN_DAYS: before ?? '0' });
}
console.log('interest-days: all good');
