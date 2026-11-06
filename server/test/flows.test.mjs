// Flows not covered by the smoke tests, run inside a throwaway branch (ends with Start Fresh on that branch only).
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = ''; let branch = '';
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const fails = [];
const call = async (method, url, body, expectFail) => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok && !expectFail) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  if (res.ok && expectFail) throw new Error(`${method} ${url} should have failed`);
  return j;
};
const step = async (name, fn) => { try { const r = await fn(); console.log('✔', name, r ?? ''); } catch (e) { fails.push(`${name}: ${e.message}`); console.log('✘', name, e.message); } };
const eq = (a, b, m) => { if (Math.abs(Number(a) - Number(b)) > 0.01) throw new Error(`${m}: ${a} != ${b}`); };

const me = (await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' })).data.user;
const tag = Date.now().toString().slice(-5);
const br = (await call('POST', '/admin/branches', { code: 'T' + tag.slice(-4), name: `Flow Test ${tag}`, phone: '9000000000', loan_prefix: 'T', opening_cash: 1000000 })).data;
branch = String(br.id);
console.log('branch', br.name, br.id);
const lk = (await call('GET', '/masters/lookups')).data;
const scheme = lk.schemes.find((s) => s.code === 'GL001') || lk.schemes[0];
const cust = (await call('POST', '/customers', { name: 'Flow Customer', relation_type: 'S/o', relation_name: 'Flow Father', phone: '9' + tag + '1234', area: 'Town' })).data;
const mk = async (amt, item = 'Ring', wt = 10) => (await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, principal: amt, rate_per_gram: 7900,
  items: [{ item_name: item, pcs: 1, gross_wt: wt, stone_wt: 0, purity: 91.6 }], payments: [{ mode: 'CASH', amount: amt }] })).data.loan;
let L1, L2, L3, L4;
await step('create 4 loans', async () => { L1 = await mk(20000); L2 = await mk(25000, 'Chain', 12); L3 = await mk(10000, 'Bangle', 6); L4 = await mk(8000, 'Ring', 5); return [L1, L2, L3, L4].map((l) => l.bill_no).join(','); });

// customer edit + search + next-no
await step('customer edit / search / next-no', async () => {
  await call('PUT', `/customers/${cust.id}`, { ...cust, city: 'Nagercoil' });
  const s = (await call('GET', `/customers?search=Flow Customer`)).data;
  if (!s.find((c) => c.id === cust.id)) throw new Error('customer not found by search');
  const nn = (await call('GET', '/customers/next-no')).data.customer_no;
  return `next a/c ${nn}`;
});

// bank: account, pledge, available-loans excludes it, release
let bank, pledgeId;
await step('bank account create', async () => { bank = (await call('POST', '/masters/bank-accounts', { bank_name: 'FLOW BANK', bank_branch: 'Main', account_no: tag, used_for: 'BOTH', opened_on: today })).data; return bank.id; });
await step('bank pledge save', async () => {
  pledgeId = (await call('POST', '/bank/pledges', { bank_account_id: bank.id, pledge_no: 'BL' + tag, pledge_date: today, amount: 30000, interest_rate: 9, charges: 200, received_mode: 'BANK', loan_ids: [L1.id, L2.id] })).data.id;
  const av = (await call('GET', '/bank/pledges/available-loans')).data;
  if (av.some((l) => [L1.id, L2.id].includes(l.id))) throw new Error('pledged loans still offered');
  return `id ${pledgeId}`;
});
await step('bank pledge twice rejected', () => call('POST', '/bank/pledges', { bank_account_id: bank.id, pledge_no: 'BX' + tag, pledge_date: today, amount: 1000, loan_ids: [L1.id] }, true));
await step('pledge detail + interest', async () => { const d = (await call('GET', `/bank/pledges/${pledgeId}`, undefined)).data; return `loans ${d.loans.length} interest ${d.calc.interest}`; });
await step('bank pledge release', async () => {
  await call('POST', `/bank/pledges/${pledgeId}/release`, { date: today, interest: 50, mode: 'BANK' });
  const d = (await call('GET', `/bank/pledges/${pledgeId}`)).data;
  if (d.status !== 'CLOSED') throw new Error('status ' + d.status);
  const av = (await call('GET', '/bank/pledges/available-loans')).data;
  if (!av.some((l) => l.id === L1.id)) throw new Error('loan not back in hand');
  return 'closed';
});

// vouchers
let ledgers;
await step('voucher payment + receipt + delete', async () => {
  ledgers = (await call('GET', '/accounts/ledgers?pageSize=500')).data;
  const exp = ledgers.find((l) => l.nature === 'EXPENSE') || ledgers[0];
  const inc = ledgers.find((l) => l.nature === 'INCOME') || ledgers[0];
  const p = (await call('POST', '/accounts/vouchers', { voucher_type: 'PAYMENT', date: today, ledger_id: exp.id, amount: 500, mode: 'CASH', narration: 'Flow rent' })).data.id;
  await call('POST', '/accounts/vouchers', { voucher_type: 'RECEIPT', date: today, ledger_id: inc.id, amount: 300, mode: 'CASH', narration: 'Flow misc' });
  await call('POST', '/accounts/vouchers', { voucher_type: 'JOURNAL', date: today, lines: [{ ledger_id: exp.id, debit: 100 }, { ledger_id: inc.id, credit: 90 }] }, true);
  await call('DELETE', `/accounts/vouchers/${p}`);
  return `${exp.name} / ${inc.name}, unbalanced journal rejected`;
});
await step('trial balance balanced', async () => { const tb = (await call('GET', '/accounts/trial-balance')).data; eq(tb.totalDebit, tb.totalCredit, 'Dr/Cr'); return `${tb.totalDebit}`; });

// stock check
await step('stock check scan / missing / reset', async () => {
  await call('POST', '/auction/stock-check', { code: L3.bill_no, date: today });
  await call('POST', '/auction/stock-check/missing', { loan_id: L4.id, date: today });
  const rows = (await call('GET', `/auction/stock-check?date=${today}`)).data;
  const a = rows.find((r) => r.id === L3.id); const b = rows.find((r) => r.id === L4.id);
  if (!a?.checked_at || !b?.missing) throw new Error('scan/missing not saved');
  await call('DELETE', `/auction/stock-check?date=${today}`);
  return `${rows.length} packets`;
});

// auction
await step('auction notice + sale', async () => {
  await call('POST', '/auction/notices', { loan_ids: [L3.id], notice_type: 'FIRST', notice_date: today, sent_via: 'REGISTERED' });
  const s = (await call('POST', '/auction/sales', { loan_id: L3.id, auction_date: today, sale_amount: 15000, buyer_name: 'Flow Buyer' })).data;
  const l = (await call('GET', `/loans/${L3.id}`)).data.loan;
  if (l.status !== 'AUCTIONED') throw new Error('status ' + l.status);
  const sales = (await call('GET', '/auction/sales')).data.find((x) => x.loan_id === L3.id);
  if (!sales?.first_notice) throw new Error('report missing notice date');
  return `sold ${s.saleAmount ?? ''}`;
});
await step('mark auctioned (bulk)', async () => { const r = (await call('POST', '/auction/mark-auctioned', { auction_date: today, loans: [{ loan_id: L4.id, sale_amount: 9000 }], buyer_name: 'Flow' })).data; return `count ${r.count}`; });

// employees, attendance, salary
await step('employee + attendance + salary', async () => {
  const e = (await call('POST', '/employees', { emp_code: 'E' + tag, name: 'Flow Staff', phone: '9000011111', basic_salary: 12000 })).data;
  await call('POST', '/employees/attendance/sheet', { date: today, rows: [{ employee_id: e.id, status: 'P' }] });
  await call('POST', '/employees/attendance/sheet', { date: today, rows: [{ employee_id: e.id, status: 'PRESENT' }] }, true);
  await call('POST', '/employees/salary', { employee_id: e.id, pay_month: today.slice(0, 7), basic: 12000, allowances: 0, deductions: 0, payment_mode: 'CASH' });
  return e.emp_code;
});

// cash denomination + day report + day close + reopen
await step('denomination + day close + undo', async () => {
  const day = (await call('GET', `/accounts/day-book?date=${today}`).catch(() => null))?.data;
  await call('POST', '/accounts/denominations', { date: today, notes: { 500: 10 } }).catch((e) => { throw new Error('denominations: ' + e.message); });
  const c = (await call('POST', '/accounts/day-close', { date: today })).data;
  await call('POST', '/loans', { customer_id: cust.id, scheme_id: scheme.id, principal: 1000, rate_per_gram: 7900, loan_date: today, items: [{ item_name: 'Ring', pcs: 1, gross_wt: 1, stone_wt: 0, purity: 91.6 }], payments: [{ mode: 'CASH', amount: 1000 }] }, true);
  await call('DELETE', `/accounts/day-close/${today}`);
  return `closing ${c.cash?.closing} · entry on closed day blocked · reopened${day ? '' : ''}`;
});

// reports in this branch
await step('all reports run in branch', async () => { const reps = (await call('GET', '/reports')).data; for (const r of reps) await call('GET', `/reports/${r.key}`); return reps.length; });

// backup history
await step('backup + history', async () => {
  const res = await fetch(B + '/admin/backup?type=Flow', { headers: { cookie, 'x-branch-id': branch } });
  if (!res.ok) throw new Error('backup ' + res.status);
  const j = await res.json();
  const h = (await call('GET', '/admin/backup-history')).data;
  return `${Object.keys(j.tables).length} tables, history ${h.rows.length}`;
});

// start fresh on the throwaway branch
await step('start fresh preview + run', async () => {
  const before = (await call('GET', '/tools/start-fresh-preview')).data.rows;
  const loans = before.find((r) => r.label.startsWith('Loans')).count;
  await call('POST', '/tools/start-fresh', { confirm: 'START FRESH', password: 'wrong', customers: true }, true);
  const y = new Date(Date.now() + 5.5 * 3600e3 - 2 * 864e5).toISOString().slice(0, 10);
  await call('POST', '/tools/start-fresh', { confirm: 'START FRESH', password: 'Admin@123', customers: true, next_loan_no: 101, start_date: y });
  const after = (await call('GET', '/tools/start-fresh-preview')).data.rows;
  const left = after.filter((r) => r.count && r.label !== 'Day End records');
  if (left.length) throw new Error('left: ' + JSON.stringify(left));
  const nn = (await call('GET', '/loans/next-number').catch(() => call('GET', '/admin/next-numbers'))).data;
  const bd = (await call('GET', '/desk/billing-date')).data;
  if (bd.billingDate !== y) throw new Error(`billing date ${bd.billingDate} != ${y}`);
  const c = (await call('GET', `/customers/${cust.id}`, undefined, true));
  return `removed ${loans} loans · next ${JSON.stringify(nn).slice(0, 60)} · billing ${bd.billingDate} · practice customer gone`;
});

console.log(fails.length ? `\nFAILED ${fails.length}:\n${fails.join('\n')}` : '\nALL FLOW TESTS PASSED');
if (fails.length) process.exitCode = 1;
