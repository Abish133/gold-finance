/**
 * Demo data for trying every screen: customers, old and new loans, interest, part payments, top-up,
 * releases (one by another person), 30 days of gold/silver rates, bank accounts + a bank pledge,
 * shop expense vouchers, staff with attendance and salary, auction notices + a sale, vault stock check,
 * cash denominations, a second branch and demo users (password Demo@123).
 *
 * Goes through the running API (same rules, accounting and numbering as the counter),
 * so the server must be up:  npm run dev:server   then   npm run db:demo
 *
 * Safe to run again: customers/loans are added once, every other part only fills what is missing.
 * Remove the entries later with Settings > Start Fresh (practice entries).
 */
import 'dotenv/config';

const B = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api`;
let cookie = '';
let branch = '';

const call = async (method, url, body) => {
  const res = await fetch(B + url, {
    method,
    headers: { 'content-type': 'application/json', cookie, ...(branch ? { 'x-branch-id': branch } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${j?.message || ''}`);
  return j;
};

const ok = []; const failed = [];
const step = async (name, fn) => {
  try { const r = await fn(); ok.push(name); return r; } catch (e) { failed.push(`${name}: ${e.message}`); return null; }
};

const ist = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const monthsAgo = (m, day = 5) => { const d = new Date(); d.setDate(day); d.setMonth(d.getMonth() - m); return ist(d); };

const CUSTOMERS = [
  ['Mr', 'Murugan', 'S/o', 'Selvaraj', '9443100001', '12', 'Main Road', 'Kottar', 'Nagercoil', 'Kanyakumari', '629002', 'Male', 'Farmer'],
  ['Mrs', 'Lakshmi', 'W/o', 'Ramesh', '9443100002', '4/21', 'Church Street', 'Vadasery', 'Nagercoil', 'Kanyakumari', '629001', 'Female', 'Teacher'],
  ['Mr', 'Arul Raj', 'S/o', 'Joseph', '9443100003', '7B', 'Beach Road', 'Colachel', 'Colachel', 'Kanyakumari', '629251', 'Male', 'Fisherman'],
  ['Mrs', 'Selvi', 'W/o', 'Kannan', '9443100004', '33', 'Temple Street', 'Suchindram', 'Nagercoil', 'Kanyakumari', '629704', 'Female', 'Tailor'],
  ['Mr', 'Prakash', 'S/o', 'Mani', '9443100005', '2/88', 'Bazaar Road', 'Thuckalay', 'Thuckalay', 'Kanyakumari', '629175', 'Male', 'Shop owner'],
  ['Miss', 'Divya', 'D/o', 'Subramani', '9443100006', '15', 'North Street', 'Kappiyarai', 'Nagercoil', 'Kanyakumari', '629156', 'Female', 'Nurse'],
  ['Mr', 'Senthil Kumar', 'S/o', 'Palani', '9443100007', '61', 'Market Road', 'Marthandam', 'Marthandam', 'Kanyakumari', '629165', 'Male', 'Driver'],
  ['Mrs', 'Vasanthi', 'W/o', 'Raja', '9443100008', '9', 'School Lane', 'Eraniel', 'Eraniel', 'Kanyakumari', '629802', 'Female', 'Home maker'],
  ['Mr', 'Anthony', 'S/o', 'Xavier', '9443100009', '18/2', 'Light House Road', 'Muttom', 'Muttom', 'Kanyakumari', '629202', 'Male', 'Boat owner'],
  ['Mrs', 'Kalaiselvi', 'W/o', 'Murali', '9443100010', '40', 'West Car Street', 'Kottar', 'Nagercoil', 'Kanyakumari', '629002', 'Female', 'Vendor'],
  ['Mr', 'Ganesan', 'S/o', 'Velu', '9443100011', '5', 'Canal Road', 'Parvathipuram', 'Nagercoil', 'Kanyakumari', '629003', 'Male', 'Mason'],
  ['Mrs', 'Jeya', 'W/o', 'Stephen', '9443100012', '27', 'Hospital Road', 'Kuzhithurai', 'Kuzhithurai', 'Kanyakumari', '629163', 'Female', 'Clerk'],
];

const ITEMS = [['Chain', 8], ['Ring', 4], ['Bangle', 12], ['Necklace', 18], ['Ear Stud', 3], ['Bracelet', 9], ['Haram', 24], ['Anklet', 30]];

// [customer index, months ago, principal, items [[name idx, pcs, gross, less]]]
const OLD = [
  [0, 15, 45000, [[0, 1, 9.5, 0.2], [1, 2, 6, 0]]],   // over 12 months - shows in auction list
  [1, 13, 30000, [[2, 2, 11.8, 0.3]]],                // over 12 months
  [2, 10, 60000, [[3, 1, 16.2, 0.5]]],
  [3, 9, 22000, [[1, 3, 7.4, 0.1]]],
  [4, 7, 80000, [[6, 1, 22.5, 0.8], [4, 2, 2.6, 0]]],
  [5, 6, 18000, [[4, 2, 3.8, 0]]],
  [6, 5, 52000, [[0, 1, 11, 0.2], [5, 1, 4.2, 0]]],
  [7, 4, 27000, [[2, 2, 9.6, 0.2]]],
  [8, 3, 1500, [[7, 2, 28, 0.5]]],                    // silver anklets (silver is worth little)
  [9, 2, 36000, [[3, 1, 8.8, 0.3]]],
];
// today's new loans
const NEW = [
  [10, 40000, [[0, 1, 8.2, 0.1]]],
  [11, 25000, [[1, 2, 5.2, 0]]],
  [0, 15000, [[4, 2, 2.4, 0]]],
  [3, 55000, [[2, 2, 12.4, 0.4]]],
];

const items = (list, metal = 'GOLD') => list.map(([i, pcs, gross, less]) => ({
  item_name: ITEMS[i][0], pcs, gross_wt: gross, stone_wt: less, purity: metal === 'SILVER' ? 92.5 : 91.6, metal,
}));

const main = async () => {
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';
  if (!password) throw new Error('ADMIN_PASSWORD is not set in server/.env');
  await call('POST', '/auth/login', { username, password });

  const list = (await call('GET', '/admin/branches')).data;
  const rows = list.rows || list.items || list;
  const ho = rows.find((b) => /head/i.test(b.name)) || rows[0];
  if (!ho) throw new Error('No branch found');
  branch = String(ho.id);

  // customers + loans run once; every other part checks its own data, so a re-run only fills gaps
  const existing = (await call('GET', `/customers?search=${CUSTOMERS[0][4]}&by=mobile`)).data;
  const haveCore = (existing?.rows || existing || []).length > 0;
  if (haveCore) console.log(`Customers and loans already there in ${ho.name} - adding only what is missing.`);

  const lk = (await call('GET', '/masters/lookups')).data;
  const gold = lk.schemes.find((s) => /gold/i.test(s.name) && s.is_active !== 0) || lk.schemes[0];
  const silverMetal = lk.metals.find((m) => m.code === 'SILVER');
  const silver = lk.schemes.find((s) => silverMetal && s.metal_id === silverMetal.id) || gold;
  const rate = (code) => {
    const m = lk.metals.find((x) => x.code === code);
    const r = lk.rates.find((x) => x.metal_id === m?.id);
    return r ? Math.round((Number(r.market_rate) * 100) / (Number(r.purity) || 100)) : code === 'GOLD' ? 7860 : 102;
  };
  const today = ist();
  console.log(`Branch ${ho.name} · scheme ${gold.code} · gold ₹${rate('GOLD')}/g · silver ₹${rate('SILVER')}/g`);

  if (!haveCore) {
  // customers
  const cust = [];
  for (const [title, name, relation_type, relation_name, phone, door_no, street, area, city, district, pincode, gender, occupation] of CUSTOMERS) {
    cust.push(await step(`customer ${name}`, async () => (await call('POST', '/customers', {
      title, name, relation_type, relation_name, phone, door_no, street, area, city, district, pincode, gender, occupation,
      state: 'Tamil Nadu', id_proof_type: 'Aadhaar Card', id_proof_no: `5${phone.slice(-7)}0123`,
    })).data));
  }

  // old loans (opening entries, not in today's cash)
  const old = [];
  let book = 1000;
  for (const [ci, ago, principal, its] of OLD) {
    if (!cust[ci]) continue;
    const metal = its.some(([i]) => ITEMS[i][0] === 'Anklet') ? 'SILVER' : 'GOLD';
    old.push(await step(`old loan ${cust[ci].name} (${ago} months)`, async () => (await call('POST', '/loans/old', {
      customer_id: cust[ci].id, scheme_id: (metal === 'SILVER' ? silver : gold).id, loan_date: monthsAgo(ago), manual_bill_no: String(book += 1),
      principal, interest_rate: Number(gold.interest_rate) || 1.5, interest_type: 'COMPOUND', loan_on: metal,
      gold_rate: rate('GOLD'), silver_rate: rate('SILVER'), rate_per_gram: rate(metal), items: items(its, metal),
    })).data.loan));
  }

  // today's new loans (cash paid out)
  const fresh = [];
  for (const [ci, principal, its] of NEW) {
    if (!cust[ci]) continue;
    fresh.push(await step(`new loan ${cust[ci].name}`, async () => (await call('POST', '/loans', {
      customer_id: cust[ci].id, scheme_id: gold.id, principal, rate_per_gram: rate('GOLD'), loan_on: 'GOLD',
      items: items(its), payments: [{ mode: 'CASH', amount: principal }],
    })).data.loan));
  }

  const calc = async (l) => (await call('GET', `/loans/${l.id}/calc?date=${today}`)).data;

  // interest received on a few old loans
  for (const l of [old[2], old[4], old[6]].filter(Boolean)) {
    await step(`interest on #${l.bill_no}`, async () => {
      const c = await calc(l);
      const months = Math.min(3, Math.max(1, c.monthsDue || 1));
      const amt = Math.round((Number(l.principal) * (Number(l.interest_rate) || 1.5) / 100) * months);
      await call('POST', `/loans/${l.id}/interest`, { date: today, interest_amount: amt, months_paid: months, payments: [{ mode: 'CASH', amount: amt }] });
    });
  }
  // part amounts
  for (const [l, amt] of [[old[3], 5000], [old[7], 7000]].filter(([x]) => x)) {
    await step(`part payment on #${l.bill_no}`, () => call('POST', `/loans/${l.id}/part-payment`, { date: today, principal_amount: amt, interest_amount: 0, payments: [{ mode: 'CASH', amount: amt }] }));
  }
  // a top-up on today's loan
  if (fresh[0]) await step(`top-up on #${fresh[0].bill_no}`, () => call('POST', `/loans/${fresh[0].id}/topup`, { date: today, amount: 5000, payments: [{ mode: 'CASH', amount: 5000 }] }));
  // releases
  for (const l of [old[5], old[9]].filter(Boolean)) {
    await step(`release #${l.bill_no}`, async () => {
      const c = await calc(l);
      await call('POST', `/loans/${l.id}/release`, { date: today, payments: [{ mode: 'CASH', amount: c.totalPayable }] });
    });
  }

  }

  await extras({ lk, ho, today, rate });

  console.log(`\n✔ ${ok.length} demo entries added to ${ho.name}`);
  if (failed.length) { console.log(`✖ ${failed.length} skipped:`); failed.forEach((f) => console.log(`  - ${f}`)); }
};

/* ------------------------------------------------------------------ everything else */
const rowsOf = (r) => r?.data?.rows || r?.data?.items || r?.data || [];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ist(d); };

async function extras({ lk, ho, today, rate }) {
  const gold = lk.metals.find((m) => m.code === 'GOLD');
  const silver = lk.metals.find((m) => m.code === 'SILVER');
  const open = rowsOf(await call('GET', '/loans?status=OPEN&pageSize=200'));
  const loanOf = (name) => open.find((l) => l.customer_name === name);

  // 1. gold / silver rate history - last 30 days (charts, rate board)
  const haveRates = new Set(rowsOf(await call('GET', '/masters/rates?pageSize=500')).map((r) => `${r.metal_id}:${String(r.rate_date).slice(0, 10)}`));
  const g0 = rate('GOLD'); const s0 = rate('SILVER');
  for (let i = 30; i >= 1; i -= 1) {
    const d = daysAgo(i);
    const wiggle = Math.round(Math.sin(i / 3) * 40 - i * 4);
    if (gold && !haveRates.has(`${gold.id}:${d}`)) {
      const m = Math.round(((g0 + wiggle) * 91.6) / 100);
      await step(`gold rate ${d}`, () => call('POST', '/masters/rates', { metal_id: gold.id, rate_date: d, purity: 91.6, market_rate: m, loan_rate: Math.round(m * 0.75) }));
    }
    if (silver && !haveRates.has(`${silver.id}:${d}`)) {
      const m = Math.round(((s0 + Math.round(wiggle / 40)) * 92.5) / 100);
      await step(`silver rate ${d}`, () => call('POST', '/masters/rates', { metal_id: silver.id, rate_date: d, purity: 92.5, market_rate: m, loan_rate: Math.round(m * 0.6) }));
    }
  }

  // 2. bank accounts
  let banks = rowsOf(await call('GET', '/masters/bank-accounts?pageSize=50'));
  if (!banks.length) {
    for (const b of [
      { bank_name: 'State Bank of India', bank_branch: 'Nagercoil Main', account_name: 'My Gold Finance', account_no: '30219876543', ifsc: 'SBIN0000876', used_for: 'BOTH', opened_on: daysAgo(400) },
      { bank_name: 'Indian Bank', bank_branch: 'Kottar', account_name: 'My Gold Finance', account_no: '6754321098', ifsc: 'IDIB000K042', used_for: 'BOTH', opened_on: daysAgo(300) },
    ]) await step(`bank account ${b.bank_name}`, () => call('POST', '/masters/bank-accounts', b));
    banks = rowsOf(await call('GET', '/masters/bank-accounts?pageSize=50'));
  }

  // 3. bank pledge: two loans re-pledged with SBI
  const pledges = rowsOf(await call('GET', '/bank/pledges?pageSize=50'));
  const toPledge = [loanOf('Senthil Kumar'), loanOf('Vasanthi')].filter(Boolean);
  if (!pledges.length && banks[0] && toPledge.length) {
    await step('bank pledge with SBI', () => call('POST', '/bank/pledges', {
      bank_account_id: banks[0].id, pledge_no: 'SBI-GL-2041', pledge_date: daysAgo(20), amount: 60000, interest_rate: 9.5, charges: 250,
      received_mode: 'BANK', loan_ids: toPledge.map((l) => l.id),
    }));
  }

  // 4. shop expenses / income vouchers
  const vouchers = rowsOf(await call('GET', '/accounts/vouchers?pageSize=200'));
  if (!vouchers.some((v) => /demo/i.test(v.narration || ''))) {
    const ledgers = rowsOf(await call('GET', '/accounts/ledgers?pageSize=500'));
    const find = (re, nature) => ledgers.find((l) => re.test(l.name)) || ledgers.find((l) => l.nature === nature);
    for (const [type, re, nature, amount, narration] of [
      ['PAYMENT', /rent/i, 'EXPENSE', 8000, 'Shop rent - demo'],
      ['PAYMENT', /electric|eb|power/i, 'EXPENSE', 1450, 'EB bill - demo'],
      ['PAYMENT', /tea|refresh|misc|general/i, 'EXPENSE', 320, 'Tea and snacks - demo'],
      ['PAYMENT', /stationer|print/i, 'EXPENSE', 650, 'Bill books printing - demo'],
      ['RECEIPT', /commission|misc|other/i, 'INCOME', 500, 'Appraisal charges - demo'],
    ]) {
      const led = find(re, nature);
      if (led) await step(`voucher ${narration}`, () => call('POST', '/accounts/vouchers', { voucher_type: type, date: today, ledger_id: led.id, amount, mode: 'CASH', narration }));
    }
  }

  // 5. staff, attendance, salary
  let staff = rowsOf(await call('GET', '/employees?pageSize=50'));
  if (!staff.length) {
    const des = rowsOf(await call('GET', '/masters/designations?pageSize=50'));
    const d = (re) => des.find((x) => re.test(x.name))?.id;
    for (const e of [
      { emp_code: 'E001', title: 'Mr', name: 'Raja Sekar', gender: 'Male', phone: '9443200001', designation_id: d(/manager/i), doj: daysAgo(900), salary: 22000, address: 'Kottar, Nagercoil' },
      { emp_code: 'E002', title: 'Miss', name: 'Priya', gender: 'Female', phone: '9443200002', designation_id: d(/cash/i), doj: daysAgo(500), salary: 15000, address: 'Vadasery, Nagercoil' },
      { emp_code: 'E003', title: 'Mr', name: 'Karthik', gender: 'Male', phone: '9443200003', designation_id: d(/apprais|valuer/i), doj: daysAgo(300), salary: 16000, address: 'Parvathipuram' },
    ]) await step(`employee ${e.name}`, () => call('POST', '/employees', { ...e, status: 'ACTIVE' }));
    staff = rowsOf(await call('GET', '/employees?pageSize=50'));
  }
  if (staff.length) {
    await step('attendance today', () => call('POST', '/employees/attendance/sheet', { date: today, rows: staff.map((e, i) => ({ employee_id: e.id, status: i === 2 ? 'A' : 'P' })) }));
    const lastMonth = (() => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - 1); return ist(x).slice(0, 7); })();
    for (const e of staff) {
      await step(`salary ${e.name} ${lastMonth}`, () => call('POST', '/employees/salary', { employee_id: e.id, pay_month: lastMonth, basic: Number(e.salary) || 12000, allowances: 500, deductions: 0, payment_mode: 'CASH' }));
    }
  }

  // 6. auction: notices for loans over 12 months, one sold
  const notices = rowsOf(await call('GET', '/auction/notices?pageSize=50'));
  const overdue = [loanOf('Murugan'), loanOf('Lakshmi')].filter(Boolean);
  if (!notices.length && overdue.length) {
    await step('first notice', () => call('POST', '/auction/notices', { loan_ids: overdue.map((l) => l.id), notice_type: 'FIRST', notice_date: daysAgo(25), sent_via: 'REGISTERED' }));
    await step('second notice', () => call('POST', '/auction/notices', { loan_ids: overdue.map((l) => l.id), notice_type: 'SECOND', notice_date: daysAgo(10), sent_via: 'REGISTERED' }));
    if (overdue[1]) await step(`auction sale #${overdue[1].bill_no}`, () => call('POST', '/auction/sales', { loan_id: overdue[1].id, auction_date: today, sale_amount: 41000, buyer_name: 'Sri Lakshmi Jewellers' }));
  }

  // 7. release by another person (customer could not come)
  const anthony = loanOf('Anthony');
  if (anthony) {
    await step(`release #${anthony.bill_no} by other person`, async () => {
      const c = (await call('GET', `/loans/${anthony.id}/calc?date=${today}`)).data;
      await call('POST', `/loans/${anthony.id}/release`, {
        date: today, payments: [{ mode: 'CASH', amount: c.totalPayable }],
        released_by_other: { name: 'Mary', relation_type: 'W/o', relation_name: 'Anthony', phone: '9443100099', address: 'Muttom', id_proof: 'Aadhaar Card' },
      });
    });
  }

  // 8. vault stock check - scan today's open loans
  for (const l of rowsOf(await call('GET', '/loans?status=OPEN&pageSize=200')).slice(0, 6)) {
    await step(`stock check #${l.bill_no}`, () => call('POST', '/auction/stock-check', { code: l.bill_no, date: today }));
  }

  // 9. cash denominations for today
  await step('cash denominations', () => call('POST', '/accounts/denominations', { date: today, notes: { 500: 120, 200: 40, 100: 55, 50: 20, 20: 15, 10: 30 } }));

  // 10. a second branch with its own cashier, and a cashier at Head Office
  const branches = rowsOf(await call('GET', '/admin/branches'));
  let kottar = branches.find((b) => b.code === 'KTR');
  if (!kottar) {
    kottar = await step('branch Kottar', async () => (await call('POST', '/admin/branches', { code: 'KTR', name: 'Kottar Branch', city: 'Nagercoil', pincode: '629002', phone: '9443300001', manager_name: 'Raja Sekar', loan_prefix: 'K', opening_cash: 300000 })).data);
  }
  const users = rowsOf(await call('GET', '/admin/users?pageSize=100'));
  const roles = rowsOf(await call('GET', '/admin/roles'));
  const role = (re) => roles.find((r) => re.test(r.name)) || roles.find((r) => !r.is_super_admin);
  for (const [username, full_name, re, branchIds] of [['cashier', 'Priya (Cashier)', /cash/i, [ho.id]], ['ktr.cashier', 'Kottar Cashier', /cash/i, kottar ? [kottar.id] : []], ['manager', 'Raja Sekar (Manager)', /manager/i, [ho.id, ...(kottar ? [kottar.id] : [])]]]) {
    if (!users.some((u) => u.username === username) && branchIds.length) {
      await step(`user ${username}`, () => call('POST', '/admin/users', { full_name, username, password: 'Demo@123', role_id: role(re)?.id, branch_ids: branchIds }));
    }
  }
}

main().catch((e) => { console.error('✖ Demo seed failed:', e.message); process.exit(1); });
