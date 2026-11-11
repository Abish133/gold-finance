/**
 * The one seed file. Fills the database the app needs, then (on an empty shop) a full demo history.
 *
 *   npm run db:setup        create / update tables (migrate.js) + this seed
 *   npm run db:seed         this seed only
 *   SEED_DEMO=0 npm run db:seed    master data only (a real new shop - no demo history)
 *
 * 1. MASTER DATA (always; idempotent, safe to re-run on a live shop)
 *    company + Head Office branch + current financial year, Super admin (ADMIN_USERNAME / ADMIN_PASSWORD from .env),
 *    default roles with screen permissions, metals / purities / rates, item master, loan schemes, designations,
 *    ledger groups + system ledgers for automatic double entry, SMS templates.
 *
 * 2. DEMO HISTORY (only when the database has no loans yet; DEMO_FORCE=1 to add anyway)
 *    Starts the API in-process and plays several months of business DAY BY DAY through the real endpoints
 *    (the ones the screens call), so every loan / receipt / release / bill book number, voucher, cash and bank
 *    balance, interest figure and day close comes from the app's own logic and everything ties up:
 *    company details, 2 branches (Head Office + Kottar) with opening cash, gold / silver rate board for every
 *    working day, employees + login users per role, bank accounts with opening balances, customers (one blocked),
 *    old paper loans (some 13-20 months old -> due for auction), gold / silver / mixed loans every working day,
 *    top-ups, interest receipts, part payments, releases (cash / UPI / split / released by another person),
 *    re-loans, a cancelled loan, first + registered notices, auction sales (profit and loss), bank re-pledges
 *    (one released, one still at the bank), expense / capital / bank deposit vouchers, attendance, monthly salary,
 *    print logs, stickers, the last week's cash count + Day End and today's stock check.
 *    Dates follow today: the history always ends on the current day.
 *    Demo logins: manager, cashier, accounts, kottar, kcashier, viewer - password DEMO_PASSWORD (default Demo@123).
 */
import os from 'node:os';
import path from 'node:path';

// day ends write a backup each; keep those out of the project folder. Quiet request logging.
process.env.BACKUP_DIR ||= path.join(os.tmpdir(), 'gold-finance-demo-backups');
process.env.LOG_LEVEL ||= 'warn';

const bcrypt = (await import('bcryptjs')).default;
const dayjs = (await import('dayjs')).default;
const { pool, query, queryOne } = await import('#config/db.js');
const { SCREENS } = await import('#config/screens.js');
const { createApp } = await import('../app.js');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123';

/* ================================================================== 1. MASTER DATA */
const upsertOne = async (sqlFind, params, sqlInsert) => {
  const row = await queryOne(sqlFind, params);
  if (row) return row.id;
  return (await query(sqlInsert, params)).insertId;
};

const seedMasters = async () => {
  /* company + branch */
  if (!(await queryOne('SELECT id FROM company LIMIT 1'))) {
    await query(`INSERT INTO company (name, local_name, licence_no, address1, address2, address3, mobile)
      VALUES ('My Gold Finance', NULL, 'TN-0000000000', 'Door No 1, Main Road', 'Town - PIN 000000', 'District, State', '9000000000')`);
  }
  const branchId = await upsertOne('SELECT id FROM branches WHERE code = :code', { code: 'HO' },
    "INSERT INTO branches (code, name, address, phone, loan_prefix) VALUES (:code, 'Head Office', 'Main Road', '9000000000', '')");

  /* financial year (Apr - Mar) */
  const now = dayjs();
  const y = now.month() >= 3 ? now.year() : now.year() - 1;
  const fyName = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  if (!(await queryOne('SELECT id FROM financial_years WHERE is_current = 1'))) {
    await query('INSERT IGNORE INTO financial_years (name, start_date, end_date, is_current) VALUES (:n, :s, :e, 1)', { n: fyName, s: `${y}-04-01`, e: `${y + 1}-03-31` });
  }

  /* roles */
  const superRole = await upsertOne('SELECT id FROM roles WHERE name = :n', { n: 'Super Admin' },
    "INSERT INTO roles (name, description, all_branches, is_system) VALUES (:n, 'Full access to everything', 1, 1)");
  const roleDefs = {
    'Branch Manager': { all: 0, screens: SCREENS.filter((s) => !['s_roles', 's_backup', 's_year_end', 's_branches'].includes(s.key)).map((s) => s.key), actions: 'all' },
    Cashier: {
      all: 0, actions: ['view', 'add', 'print'],
      screens: ['dashboard', 'customers', 'loan_new', 'loan_list', 'loan_interest', 'loan_part_payment', 'loan_topup', 'loan_renewal', 'loan_release', 'loan_print', 'loan_sticker',
        'interest_calculator', 'cash_denomination', 'acc_cashbook', 'stock', 'reports_loan', 'reports_release', 'reports_collection'],
    },
    Accountant: { all: 0, actions: 'all', screens: ['dashboard', 'acc_ledgers', 'acc_voucher', 'acc_cashbook', 'acc_ledger_report', 'acc_final', 'cash_denomination', 'day_close', 'bank_accounts', 'bank_pledge', 'salary', 'reports_summary', 'reports_collection'] },
    Viewer: { all: 0, actions: ['view'], screens: ['dashboard', 'customers', 'loan_list', 'interest_calculator', 'reports_loan', 'reports_release', 'reports_collection', 'reports_customer'] },
  };
  for (const [name, def] of Object.entries(roleDefs)) {
    const existing = await queryOne('SELECT id FROM roles WHERE name = :n', { n: name });
    if (existing) continue;
    const id = (await query('INSERT INTO roles (name, description, all_branches, is_system) VALUES (:n, :d, :a, 0)', { n: name, d: `${name} (default)`, a: def.all })).insertId;
    const all = def.actions === 'all';
    const has = (a) => all || def.actions.includes(a);
    const vals = def.screens.map((k) => [id, k, 1, +has('add'), +has('edit'), +has('delete'), +has('print'), +(all || has('export'))]);
    await pool.query('INSERT INTO role_permissions (role_id, screen_key, can_view, can_add, can_edit, can_delete, can_print, can_export) VALUES ?', [vals]);
  }

  /* super admin */
  const username = process.env.ADMIN_USERNAME || 'admin';
  if (!(await queryOne('SELECT id FROM users WHERE username = :u', { u: username }))) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
    const uid = (await query(`INSERT INTO users (username, password_hash, full_name, role_id, is_super_admin, default_branch_id)
      VALUES (:u, :h, 'Administrator', :r, 1, :b)`, { u: username, h: hash, r: superRole, b: branchId })).insertId;
    await query('INSERT IGNORE INTO user_branches (user_id, branch_id) VALUES (:u, :b)', { u: uid, b: branchId });
  }

  /* metals & purities */
  const gold = await upsertOne('SELECT id FROM metals WHERE code = :c', { c: 'GOLD' }, "INSERT INTO metals (code, name, local_name) VALUES (:c, 'Gold', 'தங்கம்')");
  const silver = await upsertOne('SELECT id FROM metals WHERE code = :c', { c: 'SILVER' }, "INSERT INTO metals (code, name, local_name) VALUES (:c, 'Silver', 'வெள்ளி')");
  if (!(await queryOne('SELECT id FROM purities LIMIT 1'))) {
    await pool.query('INSERT INTO purities (metal_id, name, purity) VALUES ?', [[
      [gold, '24K (99.9)', 99.9], [gold, '22K (91.6)', 91.6], [gold, '20K (83.3)', 83.3], [gold, '18K (75.0)', 75.0], [silver, 'Silver 92.5', 92.5], [silver, 'Silver 80', 80],
    ]]);
  }
  // board rows like the desktop Rate Master: fine (100%) and ornament (92%) for each metal; older rows are kept but hidden
  if (!(await queryOne('SELECT id FROM purities WHERE purity = 100 LIMIT 1'))) {
    await query('UPDATE purities SET is_active = 0');
    await pool.query('INSERT INTO purities (metal_id, name, purity) VALUES ?', [[[gold, 'Fine Gold', 100], [gold, 'Gold Ornament', 92], [silver, 'Fine Silver', 100], [silver, 'Silver Ornament', 92]]]);
  }
  if (!(await queryOne('SELECT id FROM metal_rates LIMIT 1'))) {
    await query('INSERT INTO metal_rates (metal_id, rate_date, purity, market_rate, loan_rate) VALUES (:g, CURDATE(), 91.6, 7200, 5400), (:s, CURDATE(), 92.5, 95, 60)', { g: gold, s: silver });
  }

  /* items */
  if (!(await queryOne('SELECT id FROM item_categories LIMIT 1'))) {
    const cat = (await query("INSERT INTO item_categories (metal_id, name) VALUES (:g, 'Gold Ornaments')", { g: gold })).insertId;
    const cat2 = (await query("INSERT INTO item_categories (metal_id, name) VALUES (:s, 'Silver Articles')", { s: silver })).insertId;
    const goldItems = ['Chain', 'Necklace', 'Haram', 'Bangle', 'Bracelet', 'Ring', 'Earring', 'Stud', 'Jimikki', 'Thali Chain', 'Thali', 'Pendant', 'Anklet', 'Coin', 'Kada', 'Nose Pin', 'Mattal', 'Oddiyanam'];
    await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [goldItems.map((n) => [cat, n])]);
    await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [['Silver Anklet', 'Silver Plate', 'Silver Glass', 'Silver Lamp'].map((n) => [cat2, n])]);
  }

  /* pawn-shop item names in common use (same list as the desktop item master); added once, never duplicated */
  {
    const tc = (x) => x.toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
    const g = await queryOne("SELECT c.id FROM item_categories c JOIN metals m ON m.id = c.metal_id WHERE m.code = 'GOLD' ORDER BY c.id LIMIT 1");
    const sv = await queryOne("SELECT c.id FROM item_categories c JOIN metals m ON m.id = c.metal_id WHERE m.code = 'SILVER' ORDER BY c.id LIMIT 1");
    const GOLD_ITEMS = ['ARANAKAYAR', 'ARTICLE', 'BABY BANGLE', 'BABY KAMAL', 'BABY RING', 'BANGLE', 'BARSS', 'BESAR', 'BLACK MANI CHAIN', 'BRACELET', 'CAP', 'CASS', 'CHAIN', 'CHAIN WITH DOLLAR',
      'COINS', 'COVERING CHAIN', 'DILLI CHAIN', 'DILLI MATTAL', 'DISKO KAMAL', 'DISKO MATTAL', 'DOLLAR', 'FAIR RING', 'GULESH', 'GUNDU', 'HARAM', 'JIMIKHI', 'KAMAL', 'KAMAL WITH JIMIKHI',
      'KAMAL WITH THONGLE', 'KINI BOTHU', 'KOLAS', 'LADIES RING', 'LAXSHMI BOTTU', 'MANGA BOTTHU', 'MATTAL', 'MOGATHI', 'MOP', 'NANCOLLA', 'NECKLACE', 'NITHI CHITY', 'RATTAI PATTAI CHAIN', 'RING',
      'SARAD', 'STONE KAMAL', 'STONE KAMAL WITH STONE JIMIKHI', 'STONE KAMAL WITH STONE THONGLE', 'STONE NECKLACE', 'STONE RING', 'TALI', 'TANGOTAM', 'THAYAT', 'VENKY RING', 'WAL SHIP'];
    const SILVER_ITEMS = ['ARNA', 'ARNAKAYAR', 'ARTICLE', 'BRACELET', 'CAP', 'CHAIN', 'CHAIN PATTI', 'COINS', 'DEEPAK', 'DOLLAR', 'GULAS', 'KEY CHAIN', 'KINAM', 'KUNGAM BOX', 'MITTI', 'PLATE', 'RING',
      'TAMLAR', 'TANDAI', 'THAT', 'VALAG'];
    if (g) await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [GOLD_ITEMS.map((x) => [g.id, tc(x)])]);
    if (sv) await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [SILVER_ITEMS.map((x) => [sv.id, GOLD_ITEMS.includes(x) || x === 'PLATE' ? `Silver ${tc(x)}` : tc(x)])]);
  }

  /* schemes (slabs identical to the printed receipt) */
  // the slab schemes of the printed bill (the MyBook scheme GL000 may already exist from the migration)
  if (!(await queryOne("SELECT id FROM schemes WHERE code IN ('GL001','GL002','SL001') LIMIT 1"))) {
    const s75 = JSON.stringify([{ upto_months: 3, rate: 15 }, { upto_months: 6, rate: 18 }, { upto_months: 12, rate: 20 }, { upto_months: null, rate: 24 }]);
    const s80 = JSON.stringify([{ upto_months: 3, rate: 18 }, { upto_months: 6, rate: 20 }, { upto_months: 12, rate: 22 }, { upto_months: null, rate: 24 }]);
    await query(`INSERT INTO schemes (code, name, metal_id, ltv_percent, rate_type, calc_mode, slab_mode, slabs, min_days, tenure_months, description) VALUES
      ('GL001', 'Gold Loan 75% LTV', :g, 75, 'YEARLY', 'DAYS', 'FROM_LOAN_DATE', :s75, 7, 12, 'Up to 75% of daily rate'),
      ('GL002', 'Gold Loan 80% LTV', :g, 80, 'YEARLY', 'DAYS', 'FROM_LOAN_DATE', :s80, 7, 12, 'Up to 80% of daily rate'),
      ('SL001', 'Silver Loan', :s, 60, 'MONTHLY', 'MONTHS', 'FROM_LOAN_DATE', :sl, 15, 12, 'Silver articles')`,
    { g: gold, s: silver, s75, s80, sl: JSON.stringify([{ upto_months: null, rate: 2 }]) });
  }

  if (!(await queryOne('SELECT id FROM designations LIMIT 1'))) {
    await pool.query('INSERT INTO designations (name) VALUES ?', [[['Branch Manager'], ['Accountant'], ['Cashier'], ['Appraiser'], ['Field Officer'], ['Office Assistant']]]);
  }

  /* ledger groups + system ledgers */
  const groups = [
    ['Cash-in-Hand', 'ASSET'], ['Bank Accounts', 'ASSET'], ['Loans & Advances (Asset)', 'ASSET'], ['Current Assets', 'ASSET'], ['Fixed Assets', 'ASSET'],
    ['Capital Account', 'EQUITY'], ['Loans (Liability)', 'LIABILITY'], ['Current Liabilities', 'LIABILITY'],
    ['Direct Income', 'INCOME'], ['Indirect Income', 'INCOME'], ['Direct Expenses', 'EXPENSE'], ['Indirect Expenses', 'EXPENSE'],
  ];
  for (const [name, nature] of groups) await query('INSERT IGNORE INTO ledger_groups (name, nature, is_system) VALUES (:n, :t, 1)', { n: name, t: nature });
  const gid = async (n) => (await queryOne('SELECT id FROM ledger_groups WHERE name = :n', { n })).id;
  const ledgers = [
    ['CASH', 'Cash', 'Cash-in-Hand'],
    ['LOAN_RECEIVABLE', 'Gold Loans to Customers', 'Loans & Advances (Asset)'],
    ['INTEREST_INCOME', 'Interest Received', 'Direct Income'],
    ['PENAL_INCOME', 'Penal Interest Received', 'Direct Income'],
    ['DOC_CHARGES', 'Document / Processing Charges', 'Direct Income'],
    ['OTHER_CHARGES', 'Other Charges Received (Postage etc.)', 'Indirect Income'],
    ['DISCOUNT', 'Discount Allowed', 'Direct Expenses'],
    ['AUCTION_SURPLUS', 'Auction Surplus Payable', 'Current Liabilities'],
    ['AUCTION_LOSS', 'Auction Loss', 'Indirect Expenses'],
    ['BANK_BORROWING', 'Bank Gold Loan (Re-pledge)', 'Loans (Liability)'],
    ['BANK_INTEREST', 'Bank Interest Paid', 'Direct Expenses'],
    ['BANK_CHARGES', 'Bank Charges', 'Indirect Expenses'],
    ['SALARY', 'Salary', 'Indirect Expenses'],
    ['CAPITAL', 'Capital / Opening Balance', 'Capital Account'],
  ];
  for (const [key, name, grp] of ledgers) {
    await query('INSERT IGNORE INTO ledgers (group_id, name, system_key, is_system) VALUES (:g, :n, :k, 1)', { g: await gid(grp), n: name, k: key });
  }
  for (const name of ['Rent', 'Electricity', 'Telephone & Internet', 'Printing & Stationery', 'Travelling', 'Tea & Refreshments', 'Repairs & Maintenance', 'Miscellaneous Expenses']) {
    if (!(await queryOne('SELECT id FROM ledgers WHERE name = :n', { n: name }))) await query('INSERT INTO ledgers (group_id, name) VALUES (:g, :n)', { g: await gid('Indirect Expenses'), n: name });
  }

  /* SMS templates */
  const tpls = [
    ['NEW_LOAN', 'New loan', 'Dear {name}, your gold loan {loan_no} of Rs.{amount} dated {date} is sanctioned. Net wt {weight} g. Thank you.'],
    ['INTEREST', 'Interest received', 'Dear {name}, received Rs.{amount} towards loan {loan_no} on {date}. Thank you.'],
    ['RELEASE', 'Loan closed', 'Dear {name}, your loan {loan_no} is closed on {date}. Amount received Rs.{amount}. Thank you.'],
    ['DUE_REMINDER', 'Due reminder', 'Dear {name}, your loan {loan_no} is overdue. Please pay the interest / renew at the earliest to avoid auction.'],
  ];
  for (const [k, n, b] of tpls) await query('INSERT IGNORE INTO message_templates (event_key, name, body) VALUES (:k, :n, :b)', { k, n, b });

};

/* ================================================================== 2. DEMO HISTORY */
/* ------------------------------------------------------------------ deterministic random */
let seed = 20261111;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const wt = (a, b) => Math.round((a + rnd() * (b - a)) * 1000) / 1000;
const r500 = (v) => Math.max(500, Math.floor(v / 500) * 500);
const D = (d) => dayjs(d).format('YYYY-MM-DD');

/* ------------------------------------------------------------------ in-process API client */
const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}/api`;
let cookie = '';
const api = async (method, url, body, branch) => {
  const res = await fetch(BASE + url, {
    method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch ? String(branch) : '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error(`${method} ${url} -> ${res.status} ${j?.message || ''}`); e.status = res.status; throw e; }
  return j?.data ?? j;
};
const rows = (d) => (Array.isArray(d) ? d : d?.rows || d?.items || []);
const stats = {};
const count = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };
const warn = (what, e) => { count('skipped'); if (process.env.DEMO_VERBOSE) console.warn('  ~', what, e.message); };

const finish = async (code) => { server.close(); await pool.end(); process.exit(code); };

try {
  await seedMasters();
  console.log('✔ Master data ready');
  if (process.env.SEED_DEMO === '0') {
    console.log(`  Login with username "${process.env.ADMIN_USERNAME || 'admin'}" and the ADMIN_PASSWORD from server/.env`);
    await finish(0);
  }
  /* ---------------------------------------------------------------- demo only on an empty shop */
  const existing = await queryOne('SELECT COUNT(*) c FROM loans');
  if (existing.c > 0 && process.env.DEMO_FORCE !== '1') {
    console.log(`  This database already has ${existing.c} loans - demo history not added (DEMO_FORCE=1 to add anyway).`);
    await finish(0);
  }

  await api('POST', '/auth/login', { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'Admin@123' });

  /* ---------------------------------------------------------------- timeline */
  const today = dayjs().startOf('day');
  const fyStart = dayjs(`${today.month() >= 3 ? today.year() : today.year() - 1}-04-01`);
  // business history inside the current books year; at least 6 months even early in the year
  const start = today.diff(fyStart, 'day') >= 150 ? fyStart : today.subtract(180, 'day');
  const days = [];
  for (let d = start; !d.isAfter(today); d = d.add(1, 'day')) if (d.day() !== 0) days.push(D(d));   // Sundays closed
  const TODAY = D(today);
  const closeFrom = days.length > 8 ? days[days.length - 8] : null;   // the last 7 working days before today get a Day End
  console.log(`Demo history ${D(start)} .. ${TODAY} (${days.length} working days)`);

  /* ---------------------------------------------------------------- company + branches */
  await api('PUT', '/admin/company', {
    name: 'Sri Lakshmi Gold Finance', local_name: 'ஸ்ரீ லட்சுமி கோல்டு பைனான்ஸ்', proprietor: 'S. Lakshmanan',
    licence_no: 'PBL/KK/2019/0458', licence_valid_till: D(today.add(2, 'year').endOf('year')),
    address1: '128, Court Road, Vadasery', address2: 'Nagercoil - 629001', address3: 'Kanyakumari District, Tamil Nadu',
    phone: '04652-231456', mobile: '9443012345', email: 'info@srilakshmigold.example', website: 'www.srilakshmigold.example',
  });
  const branchList = rows(await api('GET', '/admin/branches?pageSize=100'));
  const hoRow = branchList.find((b) => b.code === 'HO') || branchList[0];
  await api('PUT', `/admin/branches/${hoRow.id}`, { ...hoRow, name: 'Head Office', address: '128, Court Road, Vadasery', city: 'Nagercoil', pincode: '629001', phone: '04652-231456', manager_name: 'R. Ramesh Babu', opening_cash: 500000 });
  const ktrRow = branchList.find((b) => b.code === 'KTR') || await api('POST', '/admin/branches', { code: 'KTR', name: 'Kottar Branch', address: '42, Main Road, Kottar', city: 'Nagercoil', pincode: '629002', phone: '04652-245789', manager_name: 'P. Jeya Kumar', loan_prefix: 'K', opening_cash: 250000 });
  const HO = hoRow.id; const KTR = ktrRow.id;
  const BRANCHES = [HO, KTR];

  /* ---------------------------------------------------------------- masters */
  const lk = await api('GET', '/masters/lookups', undefined, HO);
  const metal = Object.fromEntries(lk.metals.map((m) => [m.code, m.id]));
  const scheme = Object.fromEntries(lk.schemes.map((s) => [s.code, s]));
  const SCH_GOLD = scheme.GL000 || lk.schemes.find((s) => s.calc_mode === 'MYBOOK') || lk.schemes[0];
  const itemId = Object.fromEntries(lk.items.map((i) => [i.name.toLowerCase(), i.id]));
  const boardRows = lk.purities;   // Fine Gold 100, Gold Ornament 92, Fine Silver 100, Silver Ornament 92

  const designations = rows(await api('GET', '/masters/designations?pageSize=100'));
  const desig = (n) => designations.find((d) => d.name === n)?.id || null;

  /* ---------------------------------------------------------------- bank accounts (+ opening balances) */
  const banks = {};
  const mkBank = async (branch, key, body, opening) => {
    const list = rows(await api('GET', '/masters/bank-accounts?pageSize=100', undefined, branch));
    let ba = list.find((x) => x.account_no === body.account_no);
    if (!ba) ba = await api('POST', '/masters/bank-accounts', { ...body, opened_on: D(start.subtract(3, 'year')) }, branch);
    ba = rows(await api('GET', '/masters/bank-accounts?pageSize=100', undefined, branch)).find((x) => x.id === ba.id) || ba;
    if (opening && ba.ledger_id) await api('PUT', `/accounts/ledgers/${ba.ledger_id}/opening`, { amount: opening, type: 'DR' }, branch);
    banks[key] = { ...ba, branch };
  };
  await mkBank(HO, 'HO_IB', { bank_name: 'Indian Bank', bank_branch: 'Vadasery', account_name: 'Sri Lakshmi Gold Finance', account_no: '6123456789', ifsc: 'IDIB000V012', used_for: 'OPERATING' }, 800000);
  await mkBank(HO, 'HO_SBI', { bank_name: 'State Bank of India', bank_branch: 'Nagercoil Main', account_name: 'Sri Lakshmi Gold Finance', account_no: '30987654321', ifsc: 'SBIN0000862', customer_id_at_bank: 'CIF88213456', used_for: 'PLEDGE' }, 150000);
  await mkBank(KTR, 'KTR_CB', { bank_name: 'Canara Bank', bank_branch: 'Kottar', account_name: 'Sri Lakshmi Gold Finance - Kottar', account_no: '1234101005678', ifsc: 'CNRB0001234', used_for: 'BOTH' }, 300000);
  const opBank = { [HO]: banks.HO_IB, [KTR]: banks.KTR_CB };

  /* ---------------------------------------------------------------- employees + users */
  const EMP = [
    [HO, 'EMP001', 'Mr', 'R. Ramesh Babu', 'Branch Manager', 32000, 'M', '9443100001', 6],
    [HO, 'EMP002', 'Miss', 'K. Priya Dharshini', 'Cashier', 18000, 'F', '9443100002', 3],
    [HO, 'EMP003', 'Mr', 'S. Muthu Kumar', 'Appraiser', 21000, 'M', '9443100003', 5],
    [HO, 'EMP004', 'Mr', 'A. Sundar', 'Office Assistant', 12000, 'M', '9443100004', 2],
    [HO, 'EMP005', 'Mrs', 'V. Malathi', 'Accountant', 22000, 'F', '9443100005', 4],
    [KTR, 'EMP006', 'Mr', 'P. Jeya Kumar', 'Branch Manager', 26000, 'M', '9443100006', 4],
    [KTR, 'EMP007', 'Miss', 'S. Kavya', 'Cashier', 15000, 'F', '9443100007', 1],
  ];
  const employees = [];
  for (const [branch, code, title, name, dsg, salary, gender, phone, yrs] of EMP) {
    let e = rows(await api('GET', `/employees?search=${code}`, undefined, branch)).find((x) => x.emp_code === code);
    if (!e) {
      e = await api('POST', '/employees', {
        emp_code: code, title, name, gender, phone, designation_id: desig(dsg), department: dsg === 'Accountant' ? 'Accounts' : 'Operations',
        doj: D(today.subtract(yrs, 'year').subtract(int(1, 200), 'day')), salary, qualification: pick(['B.Com', 'B.Sc', 'BBA', 'HSC', 'M.Com']),
        address: `${int(1, 90)}, ${pick(['North Street', 'South Street', 'Church Road', 'Temple Road'])}, Nagercoil`, marital_status: pick(['Married', 'Single']),
        aadhaar: `${int(2000, 9999)} ${int(1000, 9999)} ${int(1000, 9999)}`, bank_account: String(int(100000000, 999999999)), ifsc: 'IDIB000V012',
        emergency_name: 'Family', emergency_phone: `94431${int(10000, 99999)}`, status: 'ACTIVE',
      }, branch);
    }
    employees.push({ ...e, branch, salary, dsg });
  }
  const roles = rows(await api('GET', '/admin/roles?pageSize=100'));
  const roleId = (n) => roles.find((r) => r.name === n)?.id;
  const USERS = [
    ['manager', 'EMP001', 'Branch Manager', [HO, KTR]], ['cashier', 'EMP002', 'Cashier', [HO]], ['accounts', 'EMP005', 'Accountant', [HO, KTR]],
    ['kottar', 'EMP006', 'Branch Manager', [KTR]], ['kcashier', 'EMP007', 'Cashier', [KTR]], ['viewer', null, 'Viewer', [HO, KTR]],
  ];
  const existingUsers = rows(await api('GET', '/admin/users?pageSize=200'));
  for (const [username, code, role, branchIds] of USERS) {
    if (existingUsers.some((u) => u.username === username)) continue;
    const emp = employees.find((e) => e.emp_code === code);
    await api('POST', '/admin/users', { username, password: DEMO_PASSWORD, full_name: emp?.name || 'Auditor (view only)', phone: emp?.phone, role_id: roleId(role), branch_ids: branchIds, employee_id: emp?.id || null });
    count('users');
  }

  /* ---------------------------------------------------------------- ledgers used by vouchers */
  const ledgers = rows(await api('GET', '/accounts/ledgers?pageSize=500', undefined, HO));
  const L = (name) => ledgers.find((l) => l.name === name)?.id;
  const Lkey = (k) => ledgers.find((l) => l.system_key === k)?.id;

  /* ---------------------------------------------------------------- rate board (every working day) */
  const rateOn = {};
  const setRates = async (date, i) => {
    const t = i / Math.max(1, days.length - 1);
    const goldOrn = Math.round((7050 + 850 * t + 70 * Math.sin(i / 4) + int(-15, 15)) / 5) * 5;
    const silverOrn = Math.round((88 + 12 * t + 1.5 * Math.sin(i / 6)) * 2) / 2;
    rateOn[date] = { gold: goldOrn, silver: silverOrn };
    const val = (p) => {
      const code = lk.metals.find((m) => m.id === p.metal_id)?.code;
      const orn = code === 'SILVER' ? silverOrn : goldOrn;
      return Number(p.purity) >= 99 ? Math.round(orn / 0.92) : orn;
    };
    await api('POST', '/desk/rate-board', { date, rows: boardRows.map((p) => ({ metal_id: p.metal_id, purity: p.purity, today: val(p) })) });
  };

  /* ---------------------------------------------------------------- customers */
  const MALE = ['Murugan', 'Senthil Kumar', 'Ravi Kumar', 'Arun Prakash', 'Karthikeyan', 'Manikandan', 'Suresh', 'Ramesh', 'Vignesh', 'Balaji', 'Prakash', 'Selvam',
    'Ganesan', 'Kannan', 'Rajesh', 'Sathish Kumar', 'Dinesh', 'Saravanan', 'Mohan Raj', 'Velmurugan', 'Ayyappan', 'Subramanian', 'Jebaraj', 'Anto Raj', 'Nagarajan', 'Siva'];
  const FEMALE = ['Lakshmi', 'Selvi', 'Meena', 'Kavitha', 'Revathi', 'Priya', 'Malathi', 'Jayanthi', 'Sumathi', 'Vasanthi', 'Anitha', 'Deepa', 'Bharathi', 'Gomathi',
    'Chitra', 'Rani', 'Jeya Rani', 'Sheela', 'Mary', 'Pushpa', 'Valli', 'Saraswathi', 'Kala', 'Uma'];
  const FATHERS = ['Muthiah', 'Perumal', 'Arumugam', 'Chellappa', 'Kandasamy', 'Ponnusamy', 'Thangaraj', 'Rajendran', 'Sankaran', 'Pandian', 'Selvaraj', 'Durai'];
  const AREAS = { [HO]: ['Vadasery', 'Parvathipuram', 'Ramanputhur', 'Chettikulam', 'Meenakshipuram', 'Vettoornimadam', 'Asaripallam', 'Thalakulam'], [KTR]: ['Kottar', 'Edalakudy', 'Vadiveeswaram', 'Kalluvilai', 'Thengamputhur'] };
  const STREETS = ['North Car Street', 'South Street', 'Middle Street', 'Church Street', 'Pillaiyar Kovil Street', 'Main Road', 'New Colony', 'Nehru Street', 'Gandhi Nagar'];
  const PROOFS = [['Aadhaar Card', () => `${int(2000, 9999)} ${int(1000, 9999)} ${int(1000, 9999)}`], ['Voter ID', () => `TN/${int(10, 99)}/${int(100, 999)}/${int(100000, 999999)}`],
    ['PAN Card', () => `${'ABCDEFGHJK'[int(0, 9)]}${'LMNPQRST'[int(0, 7)]}${'ABCDEFGHJ'[int(0, 8)]}P${'ABCDEFGHJK'[int(0, 9)]}${int(1000, 9999)}${'ABCDEFG'[int(0, 6)]}`],
    ['Driving Licence', () => `TN74 ${today.year() - int(3, 15)}${int(1000000, 9999999)}`], ['Ration Card', () => `${int(100000000000, 999999999999)}`]];
  const usedPhones = new Set();
  const customers = { [HO]: [], [KTR]: [] };
  const newCustomer = async (branch) => {
    const female = chance(0.55);
    const name = pick(female ? FEMALE : MALE);
    const married = female && chance(0.75);
    const relation_type = female ? (married ? 'W/o' : 'D/o') : 'S/o';
    const relation_name = married ? pick(MALE) : pick(FATHERS);
    let phone; do { phone = `${pick(['94', '98', '97', '90', '63', '70', '88'])}${int(10000000, 99999999)}`; } while (usedPhones.has(phone));
    usedPhones.add(phone);
    const [ptype, pno] = pick(PROOFS);
    const c = await api('POST', '/customers', {
      title: female ? (married ? 'Smt' : 'Miss') : 'Mr', name, relation_type, relation_name,
      door_no: `${int(1, 250)}${chance(0.2) ? '/' + int(1, 9) : ''}`, street: pick(STREETS), area: pick(AREAS[branch]), city: 'Nagercoil', district: 'Kanyakumari', state: 'Tamil Nadu',
      pincode: branch === HO ? pick(['629001', '629003', '629004']) : pick(['629002', '629002', '629005']), phone, alt_phone: chance(0.3) ? `9${int(100000000, 999999999)}` : undefined,
      dob: D(today.subtract(int(22, 68), 'year').subtract(int(0, 364), 'day')), gender: female ? 'Female' : 'Male',
      occupation: pick(female ? ['House Wife', 'Teacher', 'Tailor', 'Nurse', 'Business', 'Coolie'] : ['Business', 'Driver', 'Farmer', 'Fisherman', 'Mason', 'Shop Keeper', 'Electrician', 'Govt. Employee']),
      id_proof_type: ptype, id_proof_no: pno(), nominee_name: pick(female ? MALE : FEMALE), nominee_relation: female ? 'Husband' : pick(['Wife', 'Mother', 'Son']),
    }, branch);
    customers[branch].push(c);
    count('customers');
    return c;
  };
  // repeat customers: 60% of loans go to someone who already has one
  const customerFor = async (branch) => (customers[branch].length > 5 && chance(0.6) ? pick(customers[branch].filter((c) => c.status !== 'BLOCKED')) : newCustomer(branch));

  /* ---------------------------------------------------------------- jewels */
  const GOLD_ITEMS = [['Chain', 8, 24], ['Necklace', 15, 40], ['Haram', 30, 60], ['Bangle', 8, 32, 4], ['Ring', 2, 8], ['Earring', 2, 6, 2], ['Stud', 1.5, 4, 2],
    ['Thali Chain', 12, 30], ['Pendant', 2, 6], ['Coin', 4, 8, 2], ['Bracelet', 6, 16], ['Jimikki', 4, 10, 2], ['Mattal', 3, 8, 2], ['Kada', 10, 25]];
  const SILVER_ITEMS = [['Silver Anklet', 40, 150, 2], ['Silver Plate', 100, 300], ['Silver Glass', 50, 150, 2], ['Silver Lamp', 100, 400, 2]];
  const jewel = ([name, a, b, maxPcs = 1], metalCode) => {
    const pcs = int(1, maxPcs);
    const gross = wt(a, b) * (maxPcs > 1 ? Math.min(pcs, 2) / 1.5 : 1);
    const stone = metalCode === 'GOLD' && chance(0.25) ? wt(0.2, Math.min(2, gross / 6)) : 0;
    const purity = metalCode === 'GOLD' ? pick([91.6, 91.6, 91.6, 91.6, 83.3, 75]) : pick([92.5, 92, 80]);
    return { item_id: itemId[name.toLowerCase()] || null, item_name: name, pcs, gross_wt: Math.round(gross * 1000) / 1000, stone_wt: stone, purity, metal_code: metalCode };
  };
  // value the way the app does: net x purity / basis x rate (rate given at 91.6 for gold, 92.5 for silver)
  const valueOf = (items, rate) => items.reduce((s, i) => s + (i.gross_wt - i.stone_wt) * i.purity / (i.metal_code === 'SILVER' ? 92.5 : 91.6) * (i.metal_code === 'SILVER' ? rate.silver : rate.gold), 0);

  /* ---------------------------------------------------------------- cash management */
  const ledgerBal = async (ledger, branch, upto) => (await queryOne(`SELECT COALESCE(SUM(e.debit - e.credit), 0) b FROM voucher_entries e JOIN vouchers v ON v.id = e.voucher_id
      WHERE e.ledger_id = :l AND e.branch_id = :b AND v.is_void = 0 AND e.entry_date <= :d`, { l: ledger, b: branch, d: upto })).b
    + Number((await queryOne('SELECT COALESCE(SUM(amount),0) a FROM ledger_openings WHERE ledger_id = :l AND branch_id = :b', { l: ledger, b: branch })).a);
  const cashIn = async (branch, date) => Number(await ledgerBal(Lkey('CASH'), branch, date)) + Number((await queryOne('SELECT opening_cash c FROM branches WHERE id = :b', { b: branch })).c);
  const voucher = (branch, body) => api('POST', '/accounts/vouchers', body, branch).then(() => count('vouchers')).catch((e) => warn('voucher', e));
  const ensureCash = async (branch, date, need) => {
    const cash = await cashIn(branch, date);
    if (cash >= need + 40000) return;
    const bank = opBank[branch];
    const bankBal = Number(await ledgerBal(bank.ledger_id, branch, date));
    const amt = Math.ceil((need + 150000 - cash) / 50000) * 50000;
    if (bankBal > amt + 100000) {
      await voucher(branch, { voucher_type: 'CONTRA', date, narration: `Cash withdrawn from ${bank.bank_name}`, lines: [{ ledger_id: Lkey('CASH'), debit: amt }, { ledger_id: bank.ledger_id, credit: amt }] });
    } else {
      await voucher(branch, { voucher_type: 'RECEIPT', date, ledger_id: Lkey('CAPITAL'), amount: amt, mode: 'CASH', narration: 'Capital introduced by proprietor' });
    }
  };
  const bankSurplus = async (branch, date) => {
    const cash = await cashIn(branch, date);
    const keep = branch === HO ? 400000 : 200000;
    if (cash > keep * 2) {
      const amt = Math.floor((cash - keep) / 50000) * 50000;
      const bank = opBank[branch];
      await voucher(branch, { voucher_type: 'CONTRA', date, narration: `Cash deposited in ${bank.bank_name}`, lines: [{ ledger_id: bank.ledger_id, debit: amt }, { ledger_id: Lkey('CASH'), credit: amt }] });
    }
  };

  /* ---------------------------------------------------------------- payment splits */
  const upi = (branch, amount) => ({ mode: 'UPI', amount, bank_account_id: opBank[branch].id, reference: `UPI${int(100000000, 999999999)}` });
  const splitPay = (branch, total, cashShare) => {
    const c = Math.round(total * cashShare / 100) * 100;
    return c > 0 && c < total ? [{ mode: 'CASH', amount: Math.round(c * 100) / 100 }, upi(branch, Math.round((total - c) * 100) / 100)] : [{ mode: 'CASH', amount: total }];
  };

  /* ---------------------------------------------------------------- event scheduler */
  const events = {};                       // date -> [fn]
  const pending = {};                      // loan id -> pending event count
  const loanInfo = {};                     // loan id -> { id, branch, scheme, old, bill_no, customer }
  const at = (date, loanId, fn) => {
    if (dayjs(date).isAfter(today)) return;
    const d = days.find((x) => !dayjs(x).isBefore(dayjs(date))) || null;   // next working day
    if (!d) return;
    (events[d] ||= []).push({ loanId, fn });
    if (loanId) pending[loanId] = (pending[loanId] || 0) + 1;
  };
  const calcOn = async (id, branch, date) => (await api('GET', `/loans/${id}?as_of=${date}`, undefined, branch));
  const isOpen = async (id) => (await queryOne('SELECT status, bank_pledge_id FROM loans WHERE id = :id', { id }));

  const payInterest = async (l, date) => {
    const full = await calcOn(l.id, l.branch, date);
    const c = full.calc;
    if (full.loan.status !== 'OPEN' || !(c.interestDue > 0)) return;
    const months = Math.max(1, c.monthsDue - c.monthsPaid);
    const amount = Math.round(c.interestDue);
    if (amount <= 0) return;
    await api('POST', `/loans/${l.id}/interest`, {
      date, interest_amount: amount, months_paid: months, interest_upto: D(dayjs(full.loan.loan_date).add(c.monthsDue, 'month')),
      payments: chance(0.25) ? [upi(l.branch, amount)] : undefined,
    }, l.branch);
    count('interest receipts');
  };
  const partPay = async (l, date) => {
    const full = await calcOn(l.id, l.branch, date);
    if (full.loan.status !== 'OPEN') return;
    const out = full.calc.principalOutstanding;
    const part = Math.floor((out * (0.2 + rnd() * 0.3)) / 1000) * 1000;
    if (part < 1000 || part >= out) return;
    const interest = Math.round(full.calc.interestDue);
    await api('POST', `/loans/${l.id}/part-payment`, {
      date, principal_amount: part, interest_amount: interest, months_paid: Math.max(0, full.calc.monthsDue - full.calc.monthsPaid),
      payments: chance(0.3) ? splitPay(l.branch, part + interest, 50) : undefined,
    }, l.branch);
    count('part payments');
  };
  const release = async (l, date) => {
    const full = await calcOn(l.id, l.branch, date);
    if (full.loan.status !== 'OPEN' || full.loan.bank_pledge_id) return;
    const c = full.calc;
    const total = Math.round((c.principalOutstanding + c.interestDue + c.penalDue) * 100) / 100;
    const body = { date };
    const r = rnd();
    if (r < 0.2) body.payments = [upi(l.branch, total)];
    else if (r < 0.32) body.payments = splitPay(l.branch, total, 60);
    if (chance(0.08)) {
      body.released_by_other = { name: pick(MALE), relation_type: 'S/o', relation_name: pick(FATHERS), phone: `9${int(100000000, 999999999)}`, address: `${pick(STREETS)}, Nagercoil`, id_proof: 'Aadhaar Card' };
    }
    try { await api('POST', `/loans/${l.id}/release`, body, l.branch); } catch (e) {
      if (!body.payments) throw e;
      delete body.payments; await api('POST', `/loans/${l.id}/release`, body, l.branch);   // rounding differs: take it in cash
    }
    count('releases');
  };
  const renew = async (l, date) => {
    const full = await calcOn(l.id, l.branch, date);
    if (full.loan.status !== 'OPEN' || full.loan.bank_pledge_id) return;
    const rate = rateOn[date] || rateOn[days[0]];
    const extra = chance(0.5) ? r500(full.calc.principalOutstanding * (0.05 + rnd() * 0.15)) : 0;
    const newId = await api('POST', `/loans/${l.id}/renew`, { date, new_principal: full.calc.principalOutstanding + extra, rate_per_gram: rate.gold, silver_rate: rate.silver }, l.branch);
    count('re-loans');
    const nid = typeof newId === 'object' ? (newId.loan?.id || newId.id) : newId;
    if (nid) {
      loanInfo[nid] = { ...l, id: nid };
      if (chance(0.4)) at(D(dayjs(date).add(int(30, 70), 'day')), nid, () => payInterest(loanInfo[nid], dateOf()));
    }
  };
  let currentDate = days[0];
  const dateOf = () => currentDate;

  // the plan for one new loan, from its loan date on
  const plan = (l, date, mybook) => {
    const d0 = dayjs(date);
    const later = (a, b) => D(d0.add(int(a, b), 'day'));
    // top-up is allowed only within 3 days of the loan: the next working day (Saturday's loan -> Monday)
    if (mybook && chance(0.06)) at(later(1, 1), l.id, () => api('POST', `/loans/${l.id}/topup`, { date: dateOf(), amount: r500(int(2000, 10000)) }, l.branch).then(() => count('top-ups')));
    const r = rnd();
    if (r < 0.38) {
      const rel = int(20, 200);
      if (rel > 70 && chance(0.6)) at(later(30, Math.min(60, rel - 10)), l.id, () => payInterest(l, dateOf()));
      at(D(d0.add(rel, 'day')), l.id, () => release(l, dateOf()));
    } else if (r < 0.48) {
      at(later(30, 110), l.id, () => partPay(l, dateOf()));
      if (chance(0.5)) at(later(130, 220), l.id, () => release(l, dateOf()));
    } else if (r < 0.56 && mybook) {
      at(later(95, 200), l.id, () => renew(l, dateOf()));
    } else if (r < 0.82) {
      let d = int(30, 45);
      const n = int(1, 4);
      for (let k = 0; k < n; k += 1) { at(D(d0.add(d, 'day')), l.id, () => payInterest(l, dateOf())); d += int(28, 65); }
    }
  };

  /* ---------------------------------------------------------------- loan creation */
  let billBookOld = 5000;
  const makeLoan = async (branch, date, { old = false, kind } = {}) => {
    const cust = await customerFor(branch);
    const rate = rateOn[date] || rateOn[days[0]];
    const k = kind || (chance(0.82) ? 'GOLD' : chance(0.7) ? 'SILVER' : 'MIX');
    let items; let sch; let pct;
    if (k === 'SILVER') { items = Array.from({ length: int(1, 3) }, () => jewel(pick(SILVER_ITEMS), 'SILVER')); sch = scheme.SL001 || SCH_GOLD; pct = 0.5; }
    else if (k === 'MIX') { items = [jewel(pick(GOLD_ITEMS), 'GOLD'), jewel(pick(SILVER_ITEMS), 'SILVER')]; sch = SCH_GOLD; pct = 0.6; }
    else { items = Array.from({ length: pick([1, 1, 1, 2, 2, 3]) }, () => jewel(pick(GOLD_ITEMS), 'GOLD')); sch = chance(0.8) ? SCH_GOLD : chance(0.5) ? (scheme.GL001 || SCH_GOLD) : (scheme.GL002 || SCH_GOLD); pct = 0.55 + rnd() * 0.12; }
    const value = valueOf(items, rate);
    const principal = Math.min(r500(value * pct), 500000);
    const body = {
      customer_id: cust.id, scheme_id: sch.id, loan_date: date, loan_on: k, principal, rate_per_gram: rate.gold, silver_rate: rate.silver,
      items: items.map((i) => ({ ...i, metal_id: metal[i.metal_code] })),
      interest_rate: sch.calc_mode === 'MYBOOK' ? (principal < 20000 ? 2 : pick([1.5, 1.5, 1.25])) : undefined,
      interest_type: sch.calc_mode === 'MYBOOK' && chance(0.1) ? 'COMPOUND' : undefined,
      remarks: chance(0.05) ? 'Customer will renew after harvest' : undefined,
    };
    if (old) {
      billBookOld += int(1, 4);
      body.manual_bill_no = String(billBookOld);
      body.loan_date = date;
    } else if (chance(0.3)) {
      body.payments = splitPay(branch, principal, int(3, 7) * 10);
    }
    if (!old) await ensureCash(branch, date, principal);
    const full = await api('POST', old ? '/loans/old' : '/loans', body, branch);
    const loan = full.loan || full;
    count(old ? 'old (opening) loans' : `${k.toLowerCase()} loans`);
    const l = { id: loan.id, branch, old, mybook: sch.calc_mode === 'MYBOOK', bill_no: loan.bill_no, customer: cust };
    loanInfo[l.id] = l;
    if (!old && chance(0.9)) await api('POST', `/loans/${l.id}/print-log`, { doc_type: 'LOAN_RECEIPT' }, branch).catch(() => {});
    return l;
  };

  /* ---------------------------------------------------------------- day 0: rates + opening (paper) loans */
  await setRates(days[0], 0);
  const auctionCandidates = [];
  for (const [branch, n] of [[HO, 12], [KTR, 4]]) {
    for (let i = 0; i < n; i += 1) {   // 13-20 months old: notices, auction, some pay up after the notice
      const l = await makeLoan(branch, D(today.subtract(int(13, 20), 'month').subtract(int(0, 25), 'day')), { old: true, kind: chance(0.85) ? 'GOLD' : 'SILVER' });
      auctionCandidates.push(l);
    }
    for (let i = 0; i < (branch === HO ? 14 : 6); i += 1) {   // still-running paper loans 2-10 months old (before the software)
      const ld = dayjs(start).subtract(int(15, 240), 'day');
      const l = await makeLoan(branch, D(ld), { old: true });
      plan(l, D(dayjs(start).add(int(0, 20), 'day')), false);
    }
  }

  /* ---------------------------------------------------------------- one-off business events */
  const nth = (n) => days[Math.max(0, Math.min(days.length - 1, n < 0 ? days.length + n : n))];
  const firstNotice = nth(-62); const finalNotice = nth(-38); const auctionDay = nth(-14);
  const noticeDone = new Set();
  at(firstNotice, null, async () => {
    for (const branch of BRANCHES) {
      const ids = auctionCandidates.filter((l) => l.branch === branch).map((l) => l.id);
      await api('POST', '/auction/notices', { loan_ids: ids, notice_type: 'FIRST', sent_via: 'POST', notice_date: dateOf(), postage: 10 }, branch);
      count('notices', ids.length);
    }
    // after the first notice some customers come and pay interest or close the loan
    auctionCandidates.slice(0, 3).forEach((l) => at(D(dayjs(dateOf()).add(int(3, 12), 'day')), l.id, () => payInterest(l, dateOf())));
    auctionCandidates.slice(3, 5).forEach((l) => at(D(dayjs(dateOf()).add(int(5, 20), 'day')), l.id, () => release(l, dateOf())));
  });
  at(finalNotice, null, async () => {
    for (const branch of BRANCHES) {
      const ids = [];
      for (const l of auctionCandidates.filter((x) => x.branch === branch)) if ((await isOpen(l.id)).status === 'OPEN') ids.push(l.id);
      if (ids.length) { await api('POST', '/auction/notices', { loan_ids: ids, notice_type: 'FINAL', sent_via: 'REGISTERED', notice_date: dateOf(), postage: 50, reference: `RL${int(100000, 999999)}IN` }, branch); count('notices', ids.length); }
      ids.forEach((id) => noticeDone.add(id));
    }
  });
  at(auctionDay, null, async () => {
    const sold = auctionCandidates.filter((l) => l.branch === HO).slice(5, 8);
    let k = 0;
    for (const l of sold) {
      if ((await isOpen(l.id)).status !== 'OPEN') continue;
      const full = await calcOn(l.id, l.branch, dateOf());
      const due = full.calc.principalOutstanding + full.calc.interestDue;
      const sale = Math.round(due * [1.18, 0.93, 1.05][k++ % 3] / 100) * 100;   // two with profit, one sold at a loss
      await api('POST', '/auction/sales', { loan_id: l.id, auction_date: dateOf(), sale_amount: sale, buyer_name: pick(['Sri Murugan Jewellery', 'Kumaran Thanga Maaligai', 'Lakshmi Jewellers']), approved_by: 'S. Lakshmanan', remarks: 'Public auction after registered notice' }, l.branch);
      count('auction sales');
    }
  });
  // bank re-pledge: one taken and repaid, one still at the bank
  const pledges = [];
  const pledgeLoans = async (branch, date, n) => {
    const open = await query(`SELECT id, current_principal FROM loans WHERE branch_id = :b AND status = 'OPEN' AND bank_pledge_id IS NULL AND entry_type <> 'OLD'
      AND loan_date <= :d ORDER BY current_principal DESC LIMIT 80`, { b: branch, d: date });
    return open.filter((x) => !pending[x.id]).slice(0, n);
  };
  const pledgeOn = async (date, no, mode) => {
    const list = await pledgeLoans(HO, date, 6);
    if (list.length < 2) return;
    const amount = Math.floor(list.reduce((s, x) => s + Number(x.current_principal), 0) * 0.75 / 1000) * 1000;
    const p = await api('POST', '/bank/pledges', { bank_account_id: banks.HO_SBI.id, pledge_no: no, pledge_date: date, amount, interest_rate: 9.25, min_days: 30, charges: 590, received_mode: mode, received_bank_account_id: banks.HO_IB.id, loan_ids: list.map((x) => x.id), remarks: 'Working capital' }, HO);
    pledges.push(p.id);
    count('bank pledges');
    return p.id;
  };
  at(nth(-95), null, async () => { const id = await pledgeOn(dateOf(), `SBI/AGL/${today.year()}/0${int(100, 999)}`, 'BANK'); if (id) at(nth(-40), null, () => api('POST', `/bank/pledges/${id}/release`, { date: dateOf(), mode: 'BANK', bank_account_id: banks.HO_IB.id }, HO).then(() => count('bank pledge releases'))); });
  at(nth(-22), null, () => pledgeOn(dateOf(), `SBI/AGL/${today.year()}/0${int(100, 999)}`, 'CASH'));
  // one customer blocked (fake document), one loan cancelled the same day
  at(nth(40), null, async () => { const c = customers[HO][3]; if (c) { await api('POST', `/customers/${c.id}/block`, { block: true, reason: 'Gave a wrong address; jewel purity doubtful' }, HO); c.status = 'BLOCKED'; count('blocked customers'); } });

  /* ---------------------------------------------------------------- monthly / weekly office routine */
  const EXP = [['Rent', { [HO]: 18000, [KTR]: 9000 }, 5], ['Electricity', { [HO]: [2400, 4200], [KTR]: [1200, 2200] }, 12], ['Telephone & Internet', { [HO]: 1199, [KTR]: 799 }, 8],
    ['Printing & Stationery', { [HO]: [600, 2500], [KTR]: [300, 1200] }, 18]];
  const office = async (date) => {
    const d = dayjs(date);
    for (const branch of BRANCHES) {
      for (const [name, amt, dom] of EXP) {
        if (d.date() !== dom && !(d.date() === dom + 1 && d.subtract(1, 'day').day() === 0)) continue;
        const a = Array.isArray(amt[branch]) ? int(amt[branch][0], amt[branch][1]) : amt[branch];
        if (L(name)) await voucher(branch, { voucher_type: 'PAYMENT', date, ledger_id: L(name), amount: a, mode: name === 'Rent' ? 'BANK' : 'CASH', bank_ledger_id: opBank[branch].ledger_id, narration: `${name} - ${d.format('MMM YYYY')}` });
      }
      if (d.day() === 6 && L('Tea & Refreshments')) await voucher(branch, { voucher_type: 'PAYMENT', date, ledger_id: L('Tea & Refreshments'), amount: int(250, 650), mode: 'CASH', narration: 'Tea & snacks for the week' });
      if (chance(0.03) && L('Repairs & Maintenance')) await voucher(branch, { voucher_type: 'PAYMENT', date, ledger_id: L('Repairs & Maintenance'), amount: int(400, 3500), mode: 'CASH', narration: pick(['AC service', 'Locker key repair', 'CCTV camera repair', 'Electrical work']) });
      if (chance(0.04) && L('Travelling')) await voucher(branch, { voucher_type: 'PAYMENT', date, ledger_id: L('Travelling'), amount: int(150, 900), mode: 'CASH', narration: 'Bank / notice delivery travel' });
      // salary for last month on the 3rd working day
      const firstWorking = days.filter((x) => dayjs(x).isSame(d, 'month'));
      if (firstWorking[2] === date && dayjs(firstWorking[2]).subtract(1, 'month').isAfter(dayjs(start).subtract(1, 'month'), 'month')) {
        const month = d.subtract(1, 'month').format('YYYY-MM');
        for (const e of employees.filter((x) => x.branch === branch)) {
          const att = await queryOne(`SELECT SUM(status = 'A') a, SUM(status = 'H') h, SUM(status = 'L') l, COUNT(*) n FROM employee_attendance WHERE employee_id = :e AND DATE_FORMAT(att_date, '%Y-%m') = :m`, { e: e.id, m: month });
          const wd = 26; const absent = Number(att?.a || 0) + Number(att?.h || 0) * 0.5;
          const deductions = Math.round((e.salary / wd) * Math.max(0, absent - 1));   // one paid leave a month
          await api('POST', '/employees/salary', {
            employee_id: e.id, pay_month: month, working_days: wd, present_days: att?.n ? wd - absent : wd, basic: e.salary, allowances: e.dsg === 'Branch Manager' ? 2000 : 500,
            deductions, advance_recovery: 0, paid_date: date, payment_mode: e.salary >= 20000 ? 'BANK' : 'CASH', bank_account_id: opBank[branch].id, remarks: 'Monthly salary',
          }, branch).then(() => count('salary payments')).catch((er) => warn('salary', er));
        }
      }
    }
  };
  const attendance = async (date) => {
    if (dayjs(date).isBefore(today.subtract(75, 'day'))) return;
    for (const branch of BRANCHES) {
      const list = employees.filter((e) => e.branch === branch);
      await api('POST', '/employees/attendance/sheet', {
        date, rows: list.map((e) => { const s = chance(0.92) ? 'P' : pick(['A', 'L', 'H']); return { employee_id: e.id, status: s, in_time: s === 'P' || s === 'H' ? `09:${String(int(20, 59)).padStart(2, '0')}` : null, out_time: s === 'P' ? `18:${String(int(0, 40)).padStart(2, '0')}` : s === 'H' ? '13:30' : null }; }),
      }, branch).then(() => count('attendance days')).catch((er) => warn('attendance', er));
    }
  };
  // cash count matching the book balance, then Day End
  const dayEnd = async (date) => {
    for (const branch of BRANCHES) {
      const { bookBalance } = await api('GET', `/accounts/denominations?date=${date}`, undefined, branch);
      let left = Math.round(Number(bookBalance) * 100) / 100;
      const notes = {};
      for (const dn of [500, 200, 100, 50, 20, 10]) { const c = Math.floor(left / dn); if (c > 0) { notes[dn] = c; left = Math.round((left - c * dn) * 100) / 100; } }
      await api('POST', '/accounts/denominations', { date, notes, coins: left, remarks: 'Counted at day end' }, branch);
      await api('POST', '/accounts/day-close', { date }, branch);
      count('day ends');
    }
  };

  /* ---------------------------------------------------------------- play the days */
  const t0 = Date.now();
  for (let i = 0; i < days.length; i += 1) {
    const date = days[i]; currentDate = date;
    if (i > 0) await setRates(date, i);
    // scheduled customer visits first (interest, releases ...), then today's new loans
    for (const ev of events[date] || []) {
      try {
        if (ev.loanId) { const s = await isOpen(ev.loanId); if (s?.status !== 'OPEN' || s.bank_pledge_id) { pending[ev.loanId] -= 1; continue; } }
        await ev.fn();
      } catch (e) { warn(`event ${date}`, e); }
      if (ev.loanId) pending[ev.loanId] -= 1;
    }
    const d = dayjs(date);
    const busy = d.day() === 1 || d.date() <= 7 ? 1 : 0;   // Mondays and the first week of the month are busier
    for (const [branch, lo, hi] of [[HO, 0, 3 + busy], [KTR, 0, 1 + busy]]) {
      const n = int(lo, hi);
      for (let k = 0; k < n; k += 1) {
        try {
          const l = await makeLoan(branch, date);
          if (stats.cancelled == null && i > 20 && branch === HO && chance(0.5)) {
            await api('POST', `/loans/${l.id}/cancel`, { reason: 'Customer changed mind - amount returned' }, branch); count('cancelled'); continue;
          }
          plan(l, date, l.mybook);
        } catch (e) { warn(`loan ${date}`, e); }
      }
    }
    await office(date);
    await attendance(date);
    for (const branch of BRANCHES) await bankSurplus(branch, date);
    if (closeFrom && date >= closeFrom && date < TODAY) await dayEnd(date);
    if (i % 20 === 0) process.stdout.write(`  ${date}  loans so far ${Object.keys(loanInfo).length}\r`);
  }
  console.log(`\n  played ${days.length} days in ${Math.round((Date.now() - t0) / 1000)}s`);

  /* ---------------------------------------------------------------- today: stickers + stock check */
  const openHo = await query("SELECT id, barcode FROM loans WHERE branch_id = :b AND status = 'OPEN' ORDER BY id", { b: HO });
  await api('POST', '/loans/stickers/printed', { ids: openHo.slice(0, -3).map((x) => x.id) }, HO);
  for (const [i, l] of openHo.entries()) {
    if (i === 4) { await api('POST', '/auction/stock-check/missing', { date: TODAY, loan_id: l.id, remarks: 'Packet not found in locker 2 - check with appraiser' }, HO).catch((e) => warn('stock', e)); continue; }
    if (i % 9 === 8) continue;   // a few still to be scanned
    await api('POST', '/auction/stock-check', { date: TODAY, code: l.barcode }, HO).then(() => count('stock scans')).catch((e) => warn('stock', e));
  }

  /* ---------------------------------------------------------------- summary */
  const sum = await query(`SELECT b.code, l.status, COUNT(*) n, SUM(l.current_principal) outstanding FROM loans l JOIN branches b ON b.id = l.branch_id GROUP BY b.code, l.status ORDER BY b.code, l.status`);
  console.log('\n✔ Demo data ready');
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log('  loans by branch / status:');
  for (const r of sum) console.log(`    ${r.code.padEnd(4)} ${r.status.padEnd(10)} ${String(r.n).padStart(4)}   outstanding ₹${Number(r.outstanding || 0).toLocaleString('en-IN')}`);
  console.log(`\n  Demo logins (password "${DEMO_PASSWORD}"): ${USERS.map((u) => u[0]).join(', ')}  - plus the admin user from server/.env`);
  await finish(0);
} catch (err) {
  console.error('\n✖ Demo seed failed:', err.message);
  if (process.env.DEMO_VERBOSE) console.error(err.stack);
  await finish(1);
}
