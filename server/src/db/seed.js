/**
 * Seeds master data required to run the application. Idempotent (safe to re-run).
 *   - company + one branch + current financial year
 *   - Super admin user (ADMIN_USERNAME / ADMIN_PASSWORD from .env)
 *   - default roles (Branch Manager, Cashier, Accountant, Viewer) with screen permissions
 *   - metals, purities, items, a scheme matching the printed receipt slabs
 *   - ledger groups + system ledgers for automatic double-entry posting
 *   - SMS templates
 */
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { pool, query, queryOne } from '#config/db.js';
import { SCREENS } from '#config/screens.js';

const upsertOne = async (sqlFind, params, sqlInsert) => {
  const row = await queryOne(sqlFind, params);
  if (row) return row.id;
  return (await query(sqlInsert, params)).insertId;
};

const run = async () => {
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
      'SARAD', 'STONE KAMAL', 'STONE KAMAL WITH STONE JIMIKHI', 'STONE KAMAL WITH STONE THONGLE', 'STONE NECKLACE', 'STONE RING', 'TALI', 'TANGOTAM', 'THAYAT'];
    const SILVER_ITEMS = ['ARNA', 'ARNAKAYAR', 'ARTICLE', 'BRACELET', 'CAP', 'CHAIN', 'CHAIN PATTI', 'COINS', 'DEEPAK', 'DOLLAR', 'GULAS', 'KEY CHAIN', 'KINAM', 'KUNGAM BOX', 'MITTI', 'PLATE', 'RING',
      'TAMLAR', 'TANDAI', 'THAT', 'VALAG'];
    if (g) await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [GOLD_ITEMS.map((x) => [g.id, tc(x)])]);
    if (sv) await pool.query('INSERT IGNORE INTO items (category_id, name) VALUES ?', [SILVER_ITEMS.map((x) => [sv.id, GOLD_ITEMS.includes(x) || x === 'PLATE' ? `Silver ${tc(x)}` : tc(x)])]);
  }

  /* schemes (slabs identical to the printed receipt) */
  if (!(await queryOne('SELECT id FROM schemes LIMIT 1'))) {
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

  console.log('✔ Seed complete');
  console.log(`  Login with username "${username}" and the ADMIN_PASSWORD from server/.env`);
  await pool.end();
};

run().catch(async (err) => {
  console.error('✖ Seed failed:', err.message);
  await pool.end();
  process.exit(1);
});
