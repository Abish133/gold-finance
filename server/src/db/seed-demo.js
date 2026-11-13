/**
 * Full demo data: 4 branches, a user for every role, and about 8 months of business that touches every screen.
 *
 *   Company       name, licence, address, logo-less letterhead
 *   Branches      HO Head Office, KTR Kottar, MTM Marthandam, CLC Colachel - each with its licence no and 1-3 contact numbers
 *   Users         owner (Super Admin), area manager (2 branches), and for every branch: manager, cashier, accountant, viewer
 *                 password for all demo users: Demo@123   (admin keeps ADMIN_PASSWORD from server/.env)
 *   Rates         gold and silver every day from the start of the accounting year to today
 *   Schemes       penal interest switched on for GL001 and SL001 (late loans show penal)
 *   Per branch    customers, opening (old) loans incl. over 12 months, new loans over the year - gold, silver, gold + silver,
 *                 advance interest (auto / by days), interest receipts (months / by days / typed rate, % a day, ₹ a day),
 *                 part payments with interest on one receipt, top-ups, releases (auto, by days below auto, release by
 *                 another person, typed penal), re-loans, UPI / bank payments, bank accounts, a bank pledge (one released),
 *                 auction notices + a sale, monthly expense vouchers, staff with attendance and salary, vault stock check,
 *                 today's cash denomination
 *
 * Goes through the running API (same rules, numbering and accounting as the counter), so the server must be up:
 *     npm run dev            (server)        then        npm run db:demo
 * Run it on a fresh database (npm run db:reset). Re-running adds nothing twice for branches / users / rates;
 * the loan history is only created for a branch that has no customers yet.
 */
import 'dotenv/config';

const B = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api`;
const DEMO_PASSWORD = 'Demo@123';
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
const rowsOf = (r) => r?.data?.rows || r?.data?.items || r?.data || [];

const ok = []; const failed = [];
const step = async (name, fn) => {
  try { const r = await fn(); ok.push(name); return r; } catch (e) { failed.push(`${name}: ${e.message}`); return null; }
};

/* ---------- dates (India time) ---------- */
const ist = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const TODAY = ist();
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const FY_START = (() => { const [y, m] = TODAY.split('-').map(Number); return `${m >= 4 ? y : y - 1}-04-01`; })();
const minDate = (a, b) => (a < b ? a : b);

/* ---------- repeatable "random" ---------- */
let seed = 20261113;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const roundTo = (x, step) => Math.max(step, Math.floor(x / step) * step);

/* ---------- daily rates: fine (100%) rate per gram, gently rising over the year ---------- */
const GOLD_NOW = 7970; const SILVER_NOW = 104;
const fineRate = (metal, date) => {
  const back = Math.max(0, daysBetween(date, TODAY));
  const wiggle = Math.sin(back / 6) * (metal === 'GOLD' ? 45 : 1.2);
  return metal === 'GOLD' ? Math.round(GOLD_NOW - back * 3.1 + wiggle) : Math.round((SILVER_NOW - back * 0.045 + wiggle) * 100) / 100;
};

/* ---------- branches ---------- */
const BRANCHES = [
  { code: 'HO', name: 'Head Office', local_name: 'தலைமை அலுவலகம்', city: 'Nagercoil', pincode: '629001', address: '12, Main Road, Vadasery', manager_name: 'Raja Sekar',
    licence_no: 'TN-KK-PB-2021-0421', licence_valid_till: '2027-12-31', phones: ['9443012345', '04652 231122', '9787594818'], loan_prefix: '', opening_cash: 800000, email: 'ho@example.com' },
  { code: 'KTR', name: 'Kottar Branch', local_name: 'கோட்டார் கிளை', city: 'Nagercoil', pincode: '629002', address: '40, West Car Street, Kottar', manager_name: 'Murali Krishnan',
    licence_no: 'TN-KK-PB-2022-0518', licence_valid_till: '2027-03-31', phones: ['9443300001', '04652 245566'], loan_prefix: 'K', opening_cash: 500000 },
  { code: 'MTM', name: 'Marthandam Branch', local_name: 'மார்த்தாண்டம் கிளை', city: 'Marthandam', pincode: '629165', address: '7, Market Road, Marthandam', manager_name: 'Jeba Singh',
    licence_no: 'TN-KK-PB-2023-0644', licence_valid_till: '2028-06-30', phones: ['9443400001'], loan_prefix: 'M', opening_cash: 400000 },
  { code: 'CLC', name: 'Colachel Branch', local_name: 'குளச்சல் கிளை', city: 'Colachel', pincode: '629251', address: '3, Beach Road, Colachel', manager_name: 'Antony Raj',
    licence_no: 'TN-KK-PB-2024-0712', licence_valid_till: '2029-03-31', phones: ['9443500001', '9443500002'], loan_prefix: 'C', opening_cash: 350000 },
];

/* ---------- people ---------- */
const FIRST_M = ['Murugan', 'Arul Raj', 'Prakash', 'Senthil Kumar', 'Anthony', 'Ganesan', 'Ravi', 'Suresh', 'Joseph', 'Mani', 'Selvam', 'Vijay', 'Kannan', 'Babu', 'Stephen', 'Rajan'];
const FIRST_F = ['Lakshmi', 'Selvi', 'Divya', 'Vasanthi', 'Kalaiselvi', 'Jeya', 'Viji Mol', 'Mary', 'Sheela', 'Anitha', 'Revathi', 'Shanthi', 'Priya', 'Malar', 'Gowri', 'Beula'];
const FATHERS = ['Selvaraj', 'Ramesh', 'Joseph', 'Kannan', 'Mani', 'Subramani', 'Palani', 'Raja', 'Xavier', 'Murali', 'Velu', 'Stephen', 'Suresh Kumar', 'Chellappan'];
const STREETS = ['Main Road', 'Church Street', 'Temple Street', 'Bazaar Road', 'North Street', 'Market Road', 'School Lane', 'Canal Road', 'Hospital Road', 'Beach Road'];
const AREAS = { HO: ['Vadasery', 'Parvathipuram', 'Suchindram', 'Kappiyarai'], KTR: ['Kottar', 'Ozhuginasery', 'Vetturnimadam'], MTM: ['Marthandam', 'Kuzhithurai', 'Thuckalay'], CLC: ['Colachel', 'Muttom', 'Eraniel'] };
const JOBS = ['Farmer', 'Teacher', 'Fisherman', 'Tailor', 'Shop owner', 'Nurse', 'Driver', 'Home maker', 'Boat owner', 'Vendor', 'Mason', 'Clerk'];
const STAFF = [['Manager', 'Branch Manager', 26000], ['Cashier', 'Cashier', 16000], ['Appraiser', 'Appraiser', 17000], ['Assistant', 'Office Assistant', 12000]];

const GOLD_ITEMS = [['Chain', 1, 6, 14], ['Ring', 2, 3, 8], ['Bangle', 2, 10, 24], ['Necklace', 1, 14, 30], ['Earring', 2, 3, 7], ['Bracelet', 1, 6, 12], ['Haram', 1, 20, 40], ['Thali Chain', 1, 12, 24], ['Jimikki', 2, 5, 10], ['Coin', 1, 4, 8]];
const SILVER_ITEMS = [['Silver Anklet', 2, 120, 350], ['Silver Plate', 1, 150, 400], ['Silver Glass', 2, 80, 200], ['Silver Lamp', 1, 200, 500]];

const goldItem = () => { const [name, pcs, a, b] = pick(GOLD_ITEMS); const gross = Math.round((a + rnd() * (b - a)) * 1000) / 1000; return { item_name: name, pcs, gross_wt: gross, stone_wt: rnd() < 0.3 ? Math.round(gross * 0.03 * 1000) / 1000 : 0, purity: pick([91.6, 91.6, 91.6, 83.3, 75]), metal: 'GOLD', metal_code: 'GOLD', rate_basis: 100 }; };
const silverItem = () => { const [name, pcs, a, b] = pick(SILVER_ITEMS); return { item_name: name, pcs, gross_wt: Math.round((a + rnd() * (b - a)) * 100) / 100, stone_wt: 0, purity: 92.5, metal: 'SILVER', metal_code: 'SILVER', rate_basis: 100 }; };
const valueOf = (items, date) => items.reduce((s, i) => s + (i.gross_wt - i.stone_wt) * (i.purity / 100) * fineRate(i.metal, date), 0);

const main = async () => {
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';
  if (!password) throw new Error('ADMIN_PASSWORD is not set in server/.env');
  await call('POST', '/auth/login', { username, password });

  /* ---------- company ---------- */
  await step('company details', () => call('PUT', '/admin/company', {
    name: 'Sri Lakshmi Gold Finance', local_name: 'ஸ்ரீ லக்ஷ்மி கோல்டு பைனான்ஸ்', proprietor: 'S. Lakshmanan', licence_no: 'TN-KK-PB-2021-0421', licence_valid_till: '2027-12-31',
    address1: '12, Main Road, Vadasery', address2: 'Nagercoil - 629001', address3: 'Kanyakumari District, Tamil Nadu', phone: '04652 231122', mobile: '9443012345',
    email: 'info@example.com', gstin: '', website: '',
  }));

  /* ---------- branches ---------- */
  branch = '';
  let branches = rowsOf(await call('GET', '/admin/branches?pageSize=50'));
  for (const b of BRANCHES) {
    const have = branches.find((x) => x.code === b.code);
    if (have) await step(`branch ${b.code} details`, () => call('PUT', `/admin/branches/${have.id}`, { ...b, is_active: 1 }));
    else await step(`branch ${b.code}`, () => call('POST', '/admin/branches', { ...b, is_active: 1 }));
  }
  branches = rowsOf(await call('GET', '/admin/branches?pageSize=50'));
  const byCode = Object.fromEntries(branches.map((b) => [b.code, b]));
  // admin must be able to work in every branch (the session reloads branches on the next login)
  await call('POST', '/auth/login', { username, password });

  /* ---------- settings + schemes ---------- */
  await step('settings', () => call('PUT', '/admin/settings?scope=global', { DISCOUNT_APPROVAL_LIMIT: '500', CUSTOMER_LINK_ENABLED: '1' }));
  const lk = (await call('GET', '/masters/lookups')).data;
  const scheme = (code) => lk.schemes.find((s) => s.code === code);
  const goldMetal = lk.metals.find((m) => m.code === 'GOLD'); const silverMetal = lk.metals.find((m) => m.code === 'SILVER');
  for (const [code, penal] of [['GL001', 3], ['SL001', 6]]) {
    const s = scheme(code); if (s) await step(`penal rate ${code}`, () => call('PUT', `/masters/schemes/${s.id}`, { penal_rate: penal }));
  }
  const GL000 = scheme('GL000'); const GL001 = scheme('GL001'); const GL002 = scheme('GL002'); const SL001 = scheme('SL001');

  /* ---------- daily rates from the start of the accounting year ---------- */
  branch = String(byCode.HO.id);
  const haveRates = new Set(rowsOf(await call('GET', '/masters/rates?pageSize=2000&all=1')).map((r) => `${r.metal_id}:${String(r.rate_date).slice(0, 10)}`));
  const rateDays = daysBetween(FY_START, TODAY);
  for (let i = 0; i <= rateDays; i += 1) {
    const d = addDays(FY_START, i);
    if (!haveRates.has(`${goldMetal.id}:${d}`)) {
      const m = Math.round(fineRate('GOLD', d) * 0.916);
      await step(`gold rate ${d}`, () => call('POST', '/masters/rates', { metal_id: goldMetal.id, rate_date: d, purity: 91.6, market_rate: m, loan_rate: Math.round(m * 0.75) }));
    }
    if (!haveRates.has(`${silverMetal.id}:${d}`)) {
      const m = Math.round(fineRate('SILVER', d) * 0.925 * 100) / 100;
      await step(`silver rate ${d}`, () => call('POST', '/masters/rates', { metal_id: silverMetal.id, rate_date: d, purity: 92.5, market_rate: m, loan_rate: Math.round(m * 0.6 * 100) / 100 }));
    }
  }
  console.log(`rates ready from ${FY_START} to ${TODAY}`);

  /* ---------- users: every role ---------- */
  branch = '';
  const roles = rowsOf(await call('GET', '/admin/roles?all=1'));
  const role = (name) => roles.find((r) => r.name === name)?.id;
  const users = rowsOf(await call('GET', '/admin/users?pageSize=200'));
  const addUser = async (u, full_name, roleName, codes, phone) => {
    if (users.some((x) => x.username === u)) return;
    await step(`user ${u}`, () => call('POST', '/admin/users', { full_name, username: u, password: DEMO_PASSWORD, role_id: role(roleName), branch_ids: codes.map((c) => byCode[c].id), phone, is_active: 1 }));
  };
  await addUser('owner', 'S. Lakshmanan (Owner)', 'Super Admin', BRANCHES.map((b) => b.code), '9443012300');
  await addUser('area.manager', 'Area Manager (HO + Kottar)', 'Branch Manager', ['HO', 'KTR'], '9443012301');
  let ph = 9443600000;
  for (const b of BRANCHES) {
    const c = b.code.toLowerCase();
    await addUser(`${c}.manager`, `${b.manager_name} (${b.code} Manager)`, 'Branch Manager', [b.code], String(ph += 1));
    await addUser(`${c}.cashier`, `${b.code} Cashier`, 'Cashier', [b.code], String(ph += 1));
    await addUser(`${c}.accountant`, `${b.code} Accountant`, 'Accountant', [b.code], String(ph += 1));
    await addUser(`${c}.viewer`, `${b.code} Viewer`, 'Viewer', [b.code], String(ph += 1));
  }

  /* ---------- each branch: its whole year ---------- */
  let n = 0;
  for (const b of BRANCHES) {
    n += 1;
    branch = String(byCode[b.code].id);
    const have = rowsOf(await call('GET', '/customers?pageSize=5'));
    if (have.length) { console.log(`${b.name}: customers already there - loan history skipped`); continue; }
    await branchYear({ b, n, schemes: { GL000, GL001, GL002, SL001 } });
  }

  console.log(`\n✔ ${ok.length} demo entries`);
  if (failed.length) { console.log(`✖ ${failed.length} not added:`); failed.slice(0, 60).forEach((f) => console.log(`  - ${f}`)); }
  console.log(`\nLogins (password ${DEMO_PASSWORD}): owner, area.manager, and for each branch ho/ktr/mtm/clc + .manager / .cashier / .accountant / .viewer`);
};

/* ======================================================================== one branch */
async function branchYear({ b, n, schemes }) {
  const { GL000, GL001, GL002, SL001 } = schemes;
  const code = b.code;
  const areas = AREAS[code];

  /* bank accounts */
  const bankDefs = [
    { bank_name: 'State Bank of India', bank_branch: `${b.city} Main`, account_name: `Sri Lakshmi Gold Finance - ${b.code}`, account_no: `3021987${n}543`, ifsc: 'SBIN0000876', used_for: 'BOTH', opened_on: addDays(FY_START, -300) },
    { bank_name: 'Indian Bank', bank_branch: b.city, account_name: `Sri Lakshmi Gold Finance - ${b.code}`, account_no: `675432${n}098`, ifsc: 'IDIB000K042', used_for: 'BOTH', opened_on: addDays(FY_START, -200) },
  ];
  for (const bd of bankDefs) await step(`${code} bank ${bd.bank_name}`, () => call('POST', '/masters/bank-accounts', bd));
  const banks = rowsOf(await call('GET', '/masters/bank-accounts?pageSize=50'));
  const pay = (amount, date, i = 0) => {
    // most money moves in cash; some by UPI / bank transfer into the shop's account
    if (!banks[0] || amount <= 0) return [];
    const r = (i * 7 + amount) % 10;
    if (r < 7) return [{ mode: 'CASH', amount }];
    if (r < 9) return [{ mode: 'UPI', amount, bank_account_id: banks[0].id, reference: `UPI${String(date).replace(/-/g, '')}${i}` }];
    const cash = Math.round(amount * 0.6);
    return [{ mode: 'CASH', amount: cash }, { mode: 'BANK', amount: Math.round((amount - cash) * 100) / 100, bank_account_id: banks[1]?.id || banks[0].id, reference: `NEFT${i}` }];
  };

  /* customers */
  const cust = [];
  const count = code === 'HO' ? 18 : 12;
  for (let i = 0; i < count; i += 1) {
    const female = i % 2 === 1;
    const name = (female ? FIRST_F : FIRST_M)[(i + n * 3) % 16];
    const area = areas[i % areas.length];
    const phone = `94${n}${String(4000000 + i * 137 + n * 11).padStart(7, '0')}`;
    const c = await step(`${code} customer ${name}`, async () => (await call('POST', '/customers', {
      title: female ? (i % 4 === 1 ? 'Mrs' : 'Miss') : 'Mr', name, relation_type: female ? (i % 4 === 1 ? 'W/o' : 'D/o') : 'S/o', relation_name: FATHERS[(i + n) % FATHERS.length],
      phone, door_no: `${between(1, 99)}/${between(1, 40)}`, street: STREETS[i % STREETS.length], area, city: b.city, district: 'Kanyakumari', state: 'Tamil Nadu', pincode: b.pincode,
      gender: female ? 'Female' : 'Male', occupation: JOBS[(i + n) % JOBS.length], id_proof_type: i % 3 ? 'Aadhaar Card' : 'Voter ID', id_proof_no: `5${phone.slice(-7)}01${i}`,
      dob: `${between(1965, 2000)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
    })).data);
    if (c) cust.push(c);
  }
  if (!cust.length) return;

  /* opening (old) loans: entered on paper before the software - some over 12 months (auction list) */
  let book = 1000 + n * 1000;
  const oldLoans = [];
  const OLD = [[16, 'GOLD', GL000], [14, 'GOLD', GL001], [13, 'SILVER', SL001], [10, 'GOLD', GL000], [9, 'GOLD', GL002], [8, 'MIX', GL000]];
  for (let i = 0; i < OLD.length; i += 1) {
    const [ago, metal, sch] = OLD[i];
    const date = addMonths(TODAY, -ago);
    const items = metal === 'SILVER' ? [silverItem()] : metal === 'MIX' ? [goldItem(), silverItem()] : [goldItem(), ...(rnd() < 0.4 ? [goldItem()] : [])];
    const value = valueOf(items, date);
    const principal = roundTo(value * (metal === 'SILVER' ? 0.55 : 0.7), 500);
    const l = await step(`${code} old loan ${ago} months`, async () => (await call('POST', '/loans/old', {
      customer_id: cust[i % cust.length].id, scheme_id: sch.id, loan_date: date, manual_bill_no: String(book += 1), principal,
      interest_rate: sch.code === 'GL000' ? 1.5 : undefined, interest_type: i % 2 ? 'SIMPLE' : 'COMPOUND', loan_on: metal,
      rate_per_gram: fineRate('GOLD', date), silver_rate: fineRate('SILVER', date), advance_interest: 0, items,
    })).data.loan);
    if (l) oldLoans.push(l);
  }

  /* new loans through the year, oldest first (loan numbers follow the dates) */
  const plan = [];
  const months = Math.max(1, Math.ceil(daysBetween(FY_START, TODAY) / 30));
  const perMonth = code === 'HO' ? 4 : 3;
  for (let m = 0; m < months; m += 1) {
    for (let k = 0; k < perMonth; k += 1) {
      const date = minDate(addDays(FY_START, m * 30 + between(0, 27)), TODAY);
      const r = rnd();
      const metal = r < 0.72 ? 'GOLD' : r < 0.88 ? 'SILVER' : 'MIX';
      plan.push({ date, metal });
    }
  }
  plan.push({ date: TODAY, metal: 'GOLD' }, { date: TODAY, metal: 'GOLD' });
  plan.sort((a, x) => a.date.localeCompare(x.date));

  const loans = [];
  for (let i = 0; i < plan.length; i += 1) {
    const { date, metal } = plan[i];
    const sch = metal === 'SILVER' ? SL001 : metal === 'MIX' ? GL000 : pick([GL000, GL000, GL001, GL002]);
    const items = metal === 'SILVER' ? [silverItem()] : metal === 'MIX' ? [goldItem(), silverItem()] : [goldItem(), ...(rnd() < 0.35 ? [goldItem()] : [])];
    const value = valueOf(items, date);
    const ltv = sch.code === 'SL001' ? 0.55 : sch.code === 'GL002' ? 0.76 : sch.code === 'GL001' ? 0.72 : 0.74;
    const principal = roundTo(value * ltv, 500);
    const rate = sch.code === 'GL000' ? pick([1.5, 1.5, 1.25, 2]) : undefined;
    // advance: most MyBook loans take 1 month (Auto); some take 15 days; slab loans none
    let advance = 0;
    if (sch.code === 'GL000') { const monthly = Math.round(principal * (rate / 100)); advance = i % 5 === 0 ? 0 : i % 5 === 1 ? Math.round((monthly / 30) * 15) : monthly; }
    const net = principal - advance;
    const l = await step(`${code} loan ${date} ${metal}`, async () => (await call('POST', '/loans', {
      customer_id: cust[(i * 5 + 3) % cust.length].id, scheme_id: sch.id, loan_date: date, principal, interest_rate: rate, interest_type: i % 3 ? 'COMPOUND' : 'SIMPLE',
      loan_on: metal, rate_per_gram: fineRate('GOLD', date), silver_rate: fineRate('SILVER', date), items, advance_interest: advance, doc_charges: 0,
      payments: pay(net, date, i),
    })).data.loan);
    if (l) loans.push({ ...l, _date: date, _rate: rate || 1.5, _scheme: sch.code });
  }

  /* what happens to the loans: build every event with its date, then post them oldest first */
  const events = [];
  loans.forEach((l, i) => {
    const age = daysBetween(l._date, TODAY);
    const kind = i % 9;
    if (l._date === TODAY) return;
    if (kind === 0 && age >= 2 && l._scheme === 'GL000') events.push({ date: addDays(l._date, 1), type: 'TOPUP', l });
    if ((kind === 1 || kind === 6) && age > 40) events.push({ date: addDays(l._date, between(30, Math.min(age, 60))), type: 'INT_MONTHS', l });
    if (kind === 2 && age > 20) events.push({ date: addDays(l._date, between(10, Math.min(age, 25))), type: 'INT_DAYS', l });
    if (kind === 3 && age > 50) events.push({ date: addDays(l._date, between(45, Math.min(age, 70))), type: 'PART_WITH_INT', l });
    if (kind === 4 && age > 5) events.push({ date: addDays(l._date, Math.min(age, between(4, 9))), type: 'RELEASE_DAYS', l });
    if (kind === 5 && age > 60) events.push({ date: addDays(l._date, between(55, Math.min(age, 120))), type: 'RELEASE', l });
    if (kind === 7 && age > 90) events.push({ date: addDays(l._date, between(80, Math.min(age, 130))), type: 'RENEW', l });
    if (kind === 8 && age > 30) events.push({ date: addDays(l._date, between(25, Math.min(age, 45))), type: 'INT_RATE', l });
  });
  // the old loans: interest on two, release one by another person, part payment on one
  if (oldLoans[3]) events.push({ date: addDays(TODAY, -20), type: 'INT_MONTHS', l: oldLoans[3] });
  if (oldLoans[4]) events.push({ date: addDays(TODAY, -12), type: 'PART_WITH_INT', l: oldLoans[4] });
  if (oldLoans[5]) events.push({ date: addDays(TODAY, -3), type: 'RELEASE_OTHER', l: oldLoans[5] });
  events.sort((a, x) => a.date.localeCompare(x.date));

  const calc = async (l, date) => (await call('GET', `/loans/${l.id}/calc?date=${date}`)).data;
  let k = 0;
  for (const e of events) {
    k += 1;
    const { l, date } = e;
    const monthly = Math.round(Number(l.principal) * ((l._rate || Number(l.interest_rate) || 1.5) / 100));
    if (e.type === 'TOPUP') {
      const amount = roundTo(Number(l.principal) * 0.1, 500);
      await step(`${code} top-up #${l.bill_no}`, () => call('POST', `/loans/${l.id}/topup`, { date, amount, interest_amount: 0, payments: pay(amount, date, k) }));
    } else if (e.type === 'INT_MONTHS') {
      const c = await calc(l, date).catch(() => null);
      const mths = Math.max(1, Math.min(3, (c?.monthsDue || 1) - (c?.monthsPaid || 0)));
      const amt = Math.round((c?.monthlyInterest || monthly) * mths);
      await step(`${code} interest ${mths} months #${l.bill_no}`, () => call('POST', `/loans/${l.id}/interest`, { date, interest_amount: amt, months_paid: mths, interest_upto: addMonths(l._date || l.loan_date, (c?.monthsPaid || 0) + mths), payments: pay(amt, date, k) }));
    } else if (e.type === 'INT_DAYS') {
      const days = pick([7, 15, 21]);
      const amt = Math.round((monthly / 30) * days);
      await step(`${code} interest ${days} days #${l.bill_no}`, () => call('POST', `/loans/${l.id}/interest`, { date, interest_amount: amt, interest_days: days, interest_upto: addDays(l._date, days), payments: pay(amt, date, k) }));
    } else if (e.type === 'INT_RATE') {
      // a special rate for this receipt: % a day or ₹ a day
      if (k % 2) {
        const days = 30; const amt = Math.round(Number(l.principal) * 0.0004 * days);
        await step(`${code} interest 30 days at 0.04% a day #${l.bill_no}`, () => call('POST', `/loans/${l.id}/interest`, { date, interest_amount: amt, interest_days: days, interest_rate: 0.04, interest_rate_unit: 'PD', interest_upto: addDays(l._date, days), payments: pay(amt, date, k) }));
      } else {
        const perDay = Math.max(5, Math.round(monthly / 30 * 0.9)); const days = 25; const amt = perDay * days;
        await step(`${code} interest 25 days at ₹${perDay} a day #${l.bill_no}`, () => call('POST', `/loans/${l.id}/interest`, { date, interest_amount: amt, interest_days: days, interest_rate: perDay, interest_rate_unit: 'RD', interest_upto: addDays(l._date, days), payments: pay(amt, date, k) }));
      }
    } else if (e.type === 'PART_WITH_INT') {
      const part = roundTo(Number(l.current_principal || l.principal) * 0.25, 500);
      const c = await calc(l, date).catch(() => null);
      const interest = Math.max(0, Math.round(c?.interestDue || monthly));
      await step(`${code} part payment + interest #${l.bill_no}`, () => call('POST', `/loans/${l.id}/part-payment`, { date, principal_amount: part, interest_amount: interest, payments: pay(part + interest, date, k) }));
    } else if (e.type === 'RELEASE_DAYS') {
      // closed within days: charge the days, not the full month (below Auto - admin approves)
      const c = await calc(l, date).catch(() => null); if (!c) continue;
      const days = Math.max(7, daysBetween(l._date, date));
      const interest = Math.max(0, Math.round((c.monthlyInterest / 30) * days - c.interestPaid));
      const total = Math.round((c.principalOutstanding + interest + c.penalDue) * 100) / 100;
      await step(`${code} release by ${days} days #${l.bill_no}`, () => call('POST', `/loans/${l.id}/release`, { date, interest_amount: interest, interest_days: days, payments: pay(total, date, k), remarks: 'Closed early - charged by days' }));
    } else if (e.type === 'RELEASE') {
      const c = await calc(l, date).catch(() => null); if (!c) continue;
      const total = Math.round((c.principalOutstanding + c.interestDue + c.penalDue) * 100) / 100;
      await step(`${code} release #${l.bill_no}`, () => call('POST', `/loans/${l.id}/release`, { date, payments: pay(total, date, k) }));
    } else if (e.type === 'RELEASE_OTHER') {
      const c = await calc(l, date).catch(() => null); if (!c) continue;
      await step(`${code} release by another person #${l.bill_no}`, () => call('POST', `/loans/${l.id}/release`, {
        date, payments: pay(Math.round((c.principalOutstanding + c.interestDue + c.penalDue) * 100) / 100, date, k),
        released_by_other: { name: 'Mary', relation_type: 'W/o', relation_name: 'the customer', phone: '9443100099', address: b.city, id_proof: 'Aadhaar Card' },
      }));
    } else if (e.type === 'RENEW') {
      const c = await calc(l, date).catch(() => null); if (!c) continue;
      const np = roundTo(c.principalOutstanding * 1.05, 500);
      await step(`${code} re-loan #${l.bill_no}`, () => call('POST', `/loans/${l.id}/renew`, {
        date, new_principal: np, scheme_id: l.scheme_id, interest_rate: l._rate, interest_type: 'COMPOUND', advance_interest: 0, doc_charges: 0,
      }));
    }
  }

  /* bank pledge: 2 open loans re-pledged with the bank; at Head Office an earlier pledge is released */
  const open = rowsOf(await call('GET', '/loans?status=OPEN&pageSize=300')).filter((l) => !l.bank_pledge_id && l.loan_on === 'GOLD');
  if (banks[0] && open.length > 4) {
    const pl = await step(`${code} bank pledge`, async () => (await call('POST', '/bank/pledges', {
      bank_account_id: banks[0].id, pledge_no: `SBI-GL-${2040 + n}`, pledge_date: addDays(TODAY, -25), amount: roundTo((Number(open[0].current_principal) + Number(open[1].current_principal)) * 0.8, 1000),
      interest_rate: 9.5, charges: 250, received_mode: 'BANK', loan_ids: [open[0].id, open[1].id],
    })).data);
    if (code === 'HO' && open.length > 6) {
      const p2 = await step(`${code} second bank pledge`, async () => (await call('POST', '/bank/pledges', {
        bank_account_id: banks[1]?.id || banks[0].id, pledge_no: 'IB-GL-1188', pledge_date: addDays(TODAY, -60), amount: roundTo(Number(open[2].current_principal) * 0.8, 1000),
        interest_rate: 10, charges: 200, received_mode: 'BANK', loan_ids: [open[2].id],
      })).data);
      const id = p2?.id || p2?.pledge?.id;
      if (id) await step(`${code} release from bank`, () => call('POST', `/bank/pledges/${id}/release`, { date: addDays(TODAY, -5), mode: 'BANK', bank_account_id: banks[1]?.id || banks[0].id }));
    }
    void pl;
  }

  /* auction: notices on loans over 12 months, one sold */
  const overdue = rowsOf(await call('GET', '/loans?status=OPEN&pageSize=300')).filter((l) => daysBetween(String(l.loan_date).slice(0, 10), TODAY) > 365 && !l.bank_pledge_id);
  if (overdue.length) {
    await step(`${code} first notice`, () => call('POST', '/auction/notices', { loan_ids: overdue.map((l) => l.id), notice_type: 'FIRST', notice_date: addDays(TODAY, -30), sent_via: 'REGISTERED' }));
    await step(`${code} registered notice`, () => call('POST', '/auction/notices', { loan_ids: overdue.map((l) => l.id), notice_type: 'SECOND', notice_date: addDays(TODAY, -12), sent_via: 'REGISTERED' }));
    if (overdue.length > 1) await step(`${code} auction sale #${overdue[0].bill_no}`, () => call('POST', '/auction/sales', { loan_id: overdue[0].id, auction_date: addDays(TODAY, -2), sale_amount: roundTo(Number(overdue[0].current_principal) * 1.25, 500), buyer_name: 'Sri Murugan Jewellers' }));
  }

  /* monthly shop expenses */
  const ledgers = rowsOf(await call('GET', '/accounts/ledgers?pageSize=500'));
  const led = (re) => ledgers.find((x) => re.test(x.name));
  for (let m = 0; m < months; m += 1) {
    const d = minDate(addDays(FY_START, m * 30 + 4), TODAY);
    for (const [re, amt, text] of [[/^rent/i, 8000 + n * 1000, 'Shop rent'], [/electric/i, between(1200, 2400), 'EB bill'], [/tea/i, between(250, 600), 'Tea and snacks'], [/stationer/i, between(300, 900), 'Bill books and printing']]) {
      const l = led(re); if (!l) continue;
      await step(`${code} voucher ${text} ${d}`, () => call('POST', '/accounts/vouchers', { voucher_type: 'PAYMENT', date: d, ledger_id: l.id, amount: amt, mode: 'CASH', narration: `${text} - ${d.slice(0, 7)}` }));
    }
  }
  const misc = ledgers.find((x) => /other charges|misc/i.test(x.name));
  if (misc) await step(`${code} receipt voucher`, () => call('POST', '/accounts/vouchers', { voucher_type: 'RECEIPT', date: addDays(TODAY, -6), ledger_id: misc.id, amount: 750, mode: 'CASH', narration: 'Appraisal charges' }));

  /* staff, attendance (last 20 days), salary (last 3 months) */
  const des = rowsOf(await call('GET', '/masters/designations?pageSize=50'));
  for (let i = 0; i < STAFF.length; i += 1) {
    const [suffix, desig, salary] = STAFF[i];
    await step(`${code} employee ${suffix}`, () => call('POST', '/employees', {
      emp_code: `${code}${String(i + 1).padStart(2, '0')}`, title: i === 1 ? 'Miss' : 'Mr', name: i === 0 ? b.manager_name : `${b.code} ${suffix}`, gender: i === 1 ? 'Female' : 'Male',
      phone: `9447${n}${String(10000 + i).padStart(5, '0')}`, designation_id: des.find((x) => x.name === desig)?.id, doj: addDays(FY_START, -between(100, 900)), salary, address: b.city, status: 'ACTIVE',
    }));
  }
  const staff = rowsOf(await call('GET', '/employees?pageSize=50'));
  for (let i = 20; i >= 0; i -= 1) {
    const d = addDays(TODAY, -i);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) continue;
    await step(`${code} attendance ${d}`, () => call('POST', '/employees/attendance/sheet', { date: d, rows: staff.map((e, j) => ({ employee_id: e.id, status: (i + j) % 11 === 0 ? 'A' : (i + j) % 13 === 0 ? 'H' : 'P' })) }));
  }
  for (let m = 3; m >= 1; m -= 1) {
    const pm = addMonths(`${TODAY.slice(0, 7)}-01`, -m).slice(0, 7);
    for (const e of staff) await step(`${code} salary ${e.name} ${pm}`, () => call('POST', '/employees/salary', { employee_id: e.id, pay_month: pm, basic: Number(e.salary) || 12000, allowances: 500, deductions: m === 1 ? 200 : 0, payment_mode: 'CASH' }));
  }

  /* vault stock check today, cash count today */
  for (const l of rowsOf(await call('GET', '/loans?status=OPEN&pageSize=300')).slice(0, 8)) {
    await step(`${code} stock check #${l.bill_no}`, () => call('POST', '/auction/stock-check', { code: l.bill_no, date: TODAY }));
  }
  await step(`${code} cash denominations`, () => call('POST', '/accounts/denominations', { date: TODAY, notes: { 500: 100 + n * 20, 200: 40, 100: 60, 50: 25, 20: 20, 10: 30 } }));
  console.log(`${b.name}: ${cust.length} customers, ${oldLoans.length} old + ${loans.length} new loans, ${events.length} receipts / releases`);
}

main().catch((e) => { console.error('✖ Demo seed failed:', e.message); process.exit(1); });
