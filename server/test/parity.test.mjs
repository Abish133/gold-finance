// Smoke test for desktop-parity features
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
const jar = {};
const mk = (who) => async (method, url, body, expect) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie: jar[who] || '', 'x-branch-id': jar[who + 'b'] || '' }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  const j = ct.includes('json') ? await res.json().catch(() => null) : await res.text();
  if (expect) { if (res.status !== expect) throw new Error(`${method} ${url} expected ${expect} got ${res.status} ${j?.message || ''}`); return j; }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  return j;
};
const A = mk('a');
const ok = (m) => console.log('✔', m);
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const me = (await A('POST', '/auth/login', { username: 'admin', password: 'Admin@123' })).data.user;
jar.ab = String(me.branches[0].id);
const lk = (await A('GET', '/masters/lookups')).data;
const gold = lk.metals.find((m) => m.code === 'GOLD'), silver = lk.metals.find((m) => m.code === 'SILVER');
const scheme = lk.schemes.find((s) => s.code === 'GL001');
const cust = (await A('GET', '/customers?pageSize=1')).data[0];

// today's rate rule
const hasRate = (await A('GET', '/masters/rates?pageSize=50')).data.some((r) => r.rate_date === today);
if (!hasRate) {
  await A('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 5400, principal: 1000, items: [{ item_name: 'Ring', gross_wt: 1, stone_wt: 0 }] }, 400);
  ok('new loan blocked without today rate');
  await A('POST', '/masters/rates', { metal_id: gold.id, rate_date: today, purity: 91.6, market_rate: 7300, loan_rate: 5500 });
  await A('POST', '/masters/rates', { metal_id: silver.id, rate_date: today, purity: 92.5, market_rate: 96, loan_rate: 60 });
  ok('rates entered');
}

// mix loan with compound interest
const mix = (await A('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, loan_on: 'MIX', interest_type: 'COMPOUND', rate_per_gram: 5500, silver_rate: 60, principal: 20000,
  items: [{ item_name: 'Chain', metal_id: gold.id, gross_wt: 5, stone_wt: 0.2, purity: 91.6 }, { item_name: 'Silver Anklet', metal_id: silver.id, gross_wt: 50, stone_wt: 0, purity: 92.5, rate_basis: 92.5 }] })).data;
ok(`mix loan #${mix.loan.bill_no} on=${mix.loan.loan_on} type=${mix.loan.interest_type} items=${mix.items.map((i) => `${i.item_name}:${i.metal_id}:fine ${i.fine_wt}`).join(', ')}`);

// numbers + photo + old
const nn = (await A('GET', '/loans/next-number')).data;
ok(`next loan ${nn.loan_no}, next release ${nn.release_no}`);
await A('GET', `/loans/last-photo/${cust.id}`);

// release with charges, release no
const calc = (await A('GET', `/loans/${mix.loan.id}/calc`)).data;
const rel = (await A('POST', `/loans/${mix.loan.id}/release`, { date: today, ticket_charge: 10, post_charge: 20, discount: 0, unable_to_release: true,
  payments: [{ mode: 'CASH', amount: calc.totalPayable + 30 }] })).data;
ok(`released with release no ${rel.loan.loan.release_no}, unable flag ${rel.loan.loan.released_unable}`);

// approval: cashier needs approval for discount > 500
const roles = (await A('GET', '/admin/roles?all=1')).data;
const cashier = roles.find((r) => r.name === 'Cashier');
const uname = 'cash' + Date.now().toString().slice(-5);
await A('POST', '/admin/users', { full_name: 'Cash Test', username: uname, password: 'cash123', role_id: cashier.id, branch_ids: [Number(jar.ab)] });
const C = mk('c'); jar.cb = jar.ab;
await C('POST', '/auth/login', { username: uname, password: 'cash123' });
const l2 = (await A('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 5500, principal: 15000, items: [{ item_name: 'Bangle', gross_wt: 5, stone_wt: 0 }] })).data;
const c2 = (await C('GET', `/loans/${l2.loan.id}/calc`)).data;
await C('POST', `/loans/${l2.loan.id}/release`, { date: today, discount: 600, payments: [{ mode: 'CASH', amount: c2.totalPayable - 600 }] }, 428);
ok('discount 600 by cashier -> 428 needs approval');
await C('POST', `/loans/${l2.loan.id}/release`, { date: today, discount: 600, approval: { username: 'admin', password: 'wrong' }, payments: [{ mode: 'CASH', amount: c2.totalPayable - 600 }] }, 403);
ok('wrong approver password rejected');
await C('POST', `/loans/${l2.loan.id}/release`, { date: today, discount: 600, approval: { username: 'admin', password: 'Admin@123' }, payments: [{ mode: 'CASH', amount: c2.totalPayable - 600 }] });
ok('approved by admin -> released');

// mark old
const l3 = (await A('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, rate_per_gram: 5500, principal: 5000, items: [{ item_name: 'Ring', gross_wt: 2, stone_wt: 0 }] })).data;
const mo = (await A('POST', '/loans/mark-old', { ids: [l3.loan.id] })).data;
ok(`mark old -> ${mo.marked.length} loan(s)`);

// pledge book tiles, customers tiles + ledger
const pb = await A('GET', '/loans?status=&pageSize=5');
ok(`pledge book tiles ${JSON.stringify(Object.fromEntries(Object.entries(pb.tiles).map(([k, v]) => [k, v.cnt])))}`);
const cl = await A('GET', '/customers?status=DUPLICATE');
ok(`customer tiles ${JSON.stringify(cl.tiles)} duplicates=${cl.meta.total}`);
const led = (await A('GET', `/customers/${cust.id}/ledger`)).data;
ok(`customer ledger entries ${led.entries.length}`);

// auction mark (old loans list empty probably) + reports
await A('GET', '/auction/list?older_than=0&days=-9999');
const tb = (await A('GET', '/accounts/trial-balance')).data;
ok(`trial balance Dr ${tb.totalDebit} Cr ${tb.totalCredit} ${tb.totalDebit === tb.totalCredit ? 'BALANCED' : 'MISMATCH'}`);
for (const k of ['bank_loans_taken', 'bank_loans_released', 'bank_monthwise', 'auction_report', 'daywise_releases']) await A('GET', `/reports/${k}`);
ok('new reports run');
const tally = (await A('GET', '/tools/tally/preview')).data;
ok(`tally preview vouchers ${tally.vouchers.length}`);
const xml = await A('GET', '/tools/tally/xml');
ok(`tally xml ${xml.length} bytes`);
const imp = (await A('POST', '/tools/import', { type: 'customers', rows: [{ name: 'IMPORT TEST', phone: '9000011111', area: 'X' }, { name: '', phone: '' }] })).data;
ok(`import customers imported=${imp.imported} skipped=${imp.skipped}`);
console.log('\nALL PARITY TESTS PASSED');
