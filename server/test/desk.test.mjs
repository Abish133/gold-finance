import { testBranch } from './_testbranch.mjs';
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = '', branch = '';
const A = async (method, url, body) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  return j;
};
const me = (await A('POST', '/auth/login', { username: 'admin', password: 'Admin@123' })).data.user;
branch = await testBranch(A);   // own branch - the shop's Head Office is never touched
console.log('billing', JSON.stringify((await A('GET', '/desk/billing-date')).data));
const bb = (await A('GET', '/desk/bill-book-check')).data;
console.log('billbook', bb.total, bb.first, bb.last, bb.missingLoanNos.length, bb.duplicateBillBook.length);
const st = (await A('GET', '/desk/stock')).data;
const rows = st.rows || st;
console.log('stock', Array.isArray(rows) ? rows.length : Object.keys(st), JSON.stringify((Array.isArray(rows) ? rows[0] : null) || {}).slice(0, 300));
let loan = (await A('GET', '/loans?status=OPEN&pageSize=1')).data[0];
if (!loan) {
  const lk = (await A('GET', '/masters/lookups')).data;
  const c = (await A('GET', '/customers?pageSize=1')).data[0] || (await A('POST', '/customers', { name: 'Desk Customer', relation_name: 'Father', phone: '9000000097', area: 'Town' })).data;
  loan = (await A('POST', '/loans', { customer_id: c.id, scheme_id: (lk.schemes.find((s) => s.code === 'GL001') || lk.schemes[0]).id, principal: 5000, rate_per_gram: 7900,
    items: [{ item_name: 'Ring', pcs: 1, gross_wt: 2, stone_wt: 0, purity: 91.6 }], payments: [{ mode: 'CASH', amount: 5000 }] })).data.loan;
}
await A('PUT', `/desk/stock-note/${loan.id}`, { remarks: 'Seal broken, repacked' });
console.log('notes', (await A('GET', '/desk/stock-notes')).data.length);
console.log('docs', (await A('GET', `/desk/documents/customer/${loan.customer_id}`)).data.length);
const adv = (await A('GET', '/desk/advisory')).data;
console.log('advisory', adv.items.map((i) => i.title).join(' | '), adv.topCustomers.length);
console.log('ALL OK');
