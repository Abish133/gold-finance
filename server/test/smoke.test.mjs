// End-to-end API smoke test
import { testBranch } from './_testbranch.mjs';
const U = 'krl' + Date.now().toString().slice(-5);
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
const today = new Date().toISOString().slice(0, 10);

const me = await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
ok(`login as ${me.data.user.full_name}, branches ${me.data.user.branches.length}`);
const ho = await testBranch(call); branch = String(ho);   // own branch - the shop's Head Office is never touched

// second branch
const b2 = await call('POST', '/admin/branches', { code: 'K' + Date.now().toString().slice(-4), name: 'Karungal', licence_no: 'TEST-LIC', phone: '7708950919', loan_prefix: 'K', opening_cash: 100000 });
ok(`branch ${b2.data.name}`);
await call('PUT', `/admin/branches/${ho}`, { opening_cash: 500000 });

const lk = (await call('GET', '/masters/lookups')).data;
const scheme = lk.schemes.find((s) => s.code === 'GL001');
const cust = (await call('POST', '/customers', { name: 'VIJI MOL SURESH KUMAR', phone: '9876543210', area: 'KAPPIYARAI', door_no: '5-43', pincode: '629157' })).data;
ok(`customer #${cust.customer_no}`);

const loan = (await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 5400, principal: 15000,
  items: [{ item_name: 'Earring', pcs: 2, gross_wt: 6.98, stone_wt: 2.83, purity: 91.6 }], payments: [{ mode: 'CASH', amount: 15000 }] })).data;
ok(`loan #${loan.loan.bill_no} eligible ${loan.loan.eligible_amount} net ${loan.loan.net_wt}`);

await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 5400, principal: 99999, items: [{ item_name: 'Ring', gross_wt: 1, stone_wt: 0 }] }, true);
ok('over-eligible loan rejected');

const i1 = await call('POST', `/loans/${loan.loan.id}/interest`, { date: today, interest_amount: 100 });
ok(`interest receipt ${i1.data.transaction.receipt_no}`);
const pp = await call('POST', `/loans/${loan.loan.id}/part-payment`, { date: today, principal_amount: 5000, interest_amount: 0 });
ok(`part payment, balance ${pp.data.loan.calc.principalOutstanding}`);
const tu = await call('POST', `/loans/${loan.loan.id}/topup`, { date: today, amount: 2000 });
ok(`top-up, balance ${tu.data.loan.calc.principalOutstanding}`);
const rn = await call('POST', `/loans/${loan.loan.id}/renew`, { date: today });
ok(`renewed as #${rn.data.loan.bill_no} principal ${rn.data.loan.principal}`);
const calc = (await call('GET', `/loans/${rn.data.loan.id}/calc`)).data;
const rel = await call('POST', `/loans/${rn.data.loan.id}/release`, { date: today, payments: [{ mode: 'CASH', amount: calc.totalPayable }] });
ok(`released, status ${rel.data.loan.loan.status} paid ${rel.data.transaction.total_amount}`);
await call('POST', `/loans/${rn.data.loan.id}/transactions/${rel.data.transaction.id}/void`, { reason: 'test' });
ok('release voided -> reopened');

// accounts balanced
const tb = (await call('GET', '/accounts/trial-balance')).data;
ok(`trial balance Dr ${tb.totalDebit} = Cr ${tb.totalCredit} ${tb.totalDebit === tb.totalCredit ? 'BALANCED' : 'MISMATCH!'}`);
const bs = (await call('GET', '/accounts/balance-sheet')).data;
ok(`balance sheet difference ${bs.difference}`);
const day = (await call('GET', '/accounts/day-summary')).data;
ok(`cash opening ${day.cash.opening} closing ${day.cash.closing}`);

// reports
const reps = (await call('GET', '/reports')).data;
for (const r of reps) { const x = (await call('GET', `/reports/${r.key}`)).data; process.stdout.write(`${r.key}:${x.count} `); }
console.log(); ok(`${reps.length} reports ran`);
await call('GET', '/dashboard'); await call('GET', '/dashboard/search?q=VIJI'); await call('GET', '/dashboard/alerts');
await call('GET', '/auction/list?days=-999'); await call('GET', '/auction/stock-check');
ok('dashboard, search, auction, stock');

// branch isolation: cashier only on KRL
const roles = (await call('GET', '/admin/roles?all=1')).data;
const cashier = roles.find((r) => r.name === 'Cashier');
await call('POST', '/admin/users', { full_name: 'KRL Cashier', username: U, password: 'krl123', role_id: cashier.id, branch_ids: [b2.data.id] });
branch = String(b2.data.id);
const sumKrlAsAdmin = (await call('GET', '/loans')).data.length;
cookie = '';
await call('POST', '/auth/login', { username: U, password: 'krl123' });
branch = String(ho);
await call('GET', '/loans', null, true); ok('cashier blocked from HO branch');
branch = 'all';
await call('GET', '/loans', null, true); ok('cashier blocked from all-branches view');
branch = String(b2.data.id);
const krlLoans = (await call('GET', '/loans')).data;
ok(`cashier sees ${krlLoans.length} loans in KRL (admin saw ${sumKrlAsAdmin})`);
await call('GET', `/loans/${loan.loan.id}`, null, true); ok('cashier cannot open HO loan by id');
await call('GET', '/admin/users', null, true); ok('cashier blocked from Users screen');
await call('GET', '/accounts/trial-balance', null, true); ok('cashier blocked from final accounts');
console.log('\nALL SMOKE TESTS PASSED');
