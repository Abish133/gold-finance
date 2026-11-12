// Builds a branch holding exactly the data entered in MyBook's @Test company, so reports can be compared side by side.
// node test/mybook-mirror.mjs  ->  prints the branch id and loan ids
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = ''; let branch = '';
export const call = async (method, url, body) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  return j;
};
const D = '2026-11-05';
await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
const tag = Date.now().toString().slice(-4);
branch = String((await call('POST', '/admin/branches', { code: 'X' + tag, name: `MyBook Mirror ${tag}`, licence_no: 'TEST-LIC', phone: '0987654321', loan_prefix: '', opening_cash: 0 })).data.id);
const lk = (await call('GET', '/masters/lookups')).data;
const scheme = lk.schemes.find((s) => s.calc_mode === 'MYBOOK');
const cust = (await call('POST', '/customers', { title: 'Mr', name: 'Test Customer', relation_type: 'S/o', relation_name: 'Test Father', street: 'Main Street', city: 'Town', phone: `98765${tag}0`.slice(0, 10), id_proof_type: 'Aadhaar Card' })).data;
const item = (gross, less = 0) => [{ item_name: 'Chain', pcs: 1, gross_wt: gross, stone_wt: less, purity: 91.6, rate_basis: 100 }];
// loan 1: new loan 05/11/2026, ₹50,000 @1.5% compound, advance ₹750, released the same day
const l1 = (await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, loan_date: D, principal: 50000, interest_rate: 1.5, interest_type: 'COMPOUND', advance_interest: 750,
  rate_per_gram: 7900, items: item(10, 0.5), payments: [{ mode: 'CASH', amount: 49250 }] })).data.loan;
const old = async (bill, gross, p, rate, type, adv) => (await call('POST', '/loans/old', { customer_id: cust.id, scheme_id: scheme.id, loan_date: '2025-01-05', manual_bill_no: bill,
  principal: p, interest_rate: rate, interest_type: type, advance_interest: adv, rate_per_gram: 7900, items: item(gross) })).data.loan;
const l2 = await old('T1', 10, 12345, 1.5, 'COMPOUND', 185);
const l3 = await old('T2', 9.99, 12345, 1.5, 'SIMPLE', 185);
const l4 = await old('T3', 10, 25000, 2, 'COMPOUND', 0);
await call('POST', `/loans/${l2.id}/interest`, { date: D, interest_amount: 555, months_paid: 3, interest_upto: '2025-05-05', payments: [{ mode: 'CASH', amount: 555 }] });
await call('POST', `/loans/${l4.id}/part-payment`, { date: D, principal_amount: 5000, interest_amount: 0, payments: [{ mode: 'CASH', amount: 5000 }] });
await call('POST', `/loans/${l2.id}/interest`, { date: D, interest_amount: 185, months_paid: 1, interest_upto: '2025-06-05', payments: [{ mode: 'CASH', amount: 185 }] });
await call('POST', `/loans/${l4.id}/part-payment`, { date: D, principal_amount: 1000, interest_amount: 0, payments: [{ mode: 'CASH', amount: 1000 }] });
const c1 = (await call('GET', `/loans/${l1.id}/calc?date=${D}`)).data;
await call('POST', `/loans/${l1.id}/release`, { date: D, payments: [{ mode: 'CASH', amount: c1.totalPayable }] });
// bank: loans 3 + 4 pledged with TEST BANK for ₹30,000 @12% / year, ₹100 charges, released the same day
const ba = (await call('POST', '/masters/bank-accounts', { bank_name: 'TEST BANK', bank_branch: 'MAIN', account_name: 'Test', account_no: `12345${tag}`, used_for: 'BOTH', opened_on: D })).data;
const bp = (await call('POST', '/bank/pledges', { bank_account_id: ba.id, pledge_no: '1', pledge_date: D, amount: 30000, interest_rate: 12, charges: 100, received_mode: 'CASH', loan_ids: [l3.id, l4.id] })).data.id;
await call('POST', `/bank/pledges/${bp}/release`, { date: D, mode: 'CASH' });
// auction: loan 2 marked as auctioned, then sold for ₹20,000
await call('POST', '/auction/mark-auctioned', { auction_date: D, loans: [{ loan_id: l2.id }] });
await call('PUT', `/auction/sales/${l2.id}`, { sale_amount: 20000, sale_date: D });
console.log(JSON.stringify({ branch: Number(branch), loans: { 1: l1.id, 2: l2.id, 3: l3.id, 4: l4.id }, release1: c1.totalPayable, bankPledge: bp }));
