import { Router } from 'express';
import { query, queryOne } from '#config/db.js';
import { permit, permitAny } from '#middleware/auth.js';
import { createCrudRouter } from '#utils/crudFactory.js';
import { ApiError } from '#utils/ApiError.js';
import { today } from '#utils/dates.js';
import { audit } from '#services/audit.service.js';

const router = Router();

/* ---------------- metals & purities ---------------- */
router.use('/metals', createCrudRouter({
  table: 'metals', screen: 'm_metals', alias: 'm',
  fields: ['code', 'name', 'local_name', 'is_active'], booleans: ['is_active'], required: ['code', 'name'],
  searchable: ['m.name', 'm.code'], sortable: { name: 'm.name', code: 'm.code' }, defaultSort: 'name',
}));

router.use('/purities', createCrudRouter({
  table: 'purities', screen: 'm_metals', alias: 'p',
  select: 'SELECT p.*, m.name AS metal_name FROM purities p JOIN metals m ON m.id = p.metal_id',
  fields: ['metal_id', 'name', 'purity', 'is_active'], booleans: ['is_active'], required: ['metal_id', 'name', 'purity'],
  searchable: ['p.name', 'm.name'], sortable: { purity: 'p.purity', name: 'p.name' }, filters: { metal_id: 'p.metal_id' },
  defaultSort: 'purity', defaultOrder: 'desc',
}));

/* ---------------- metal rates ---------------- */
router.use('/rates', createCrudRouter({
  table: 'metal_rates', screen: 'm_rates', alias: 'r',
  select: 'SELECT r.*, m.name AS metal_name FROM metal_rates r JOIN metals m ON m.id = r.metal_id',
  fields: ['metal_id', 'rate_date', 'purity', 'market_rate', 'loan_rate'], required: ['metal_id', 'rate_date', 'market_rate', 'loan_rate'],
  sortable: { rate_date: 'r.rate_date' }, filters: { metal_id: 'r.metal_id' }, defaultSort: 'rate_date', defaultOrder: 'desc',
  beforeSave: async (d, req) => ({ ...d, created_by: req.user.id }),
  extend: (r) => {
    // latest rate per metal (used by new loan screen + top bar ticker)
    r.get('/latest/all', async (_req, res) => {
      const rows = await query(
        `SELECT r.*, m.name AS metal_name, m.code AS metal_code FROM metal_rates r JOIN metals m ON m.id = r.metal_id
          WHERE r.id IN (SELECT MAX(id) FROM metal_rates x WHERE x.rate_date = (SELECT MAX(rate_date) FROM metal_rates y WHERE y.metal_id = x.metal_id AND y.rate_date <= :d) GROUP BY x.metal_id)`,
        { d: today() },
      );
      res.json({ data: rows });
    });
  },
}));

/* ---------------- items ---------------- */
router.use('/item-categories', createCrudRouter({
  table: 'item_categories', screen: 'm_items', alias: 'c',
  select: 'SELECT c.*, m.name AS metal_name, (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id) AS item_count, (SELECT COUNT(*) FROM loan_items li JOIN items i ON i.id = li.item_id WHERE i.category_id = c.id) AS used FROM item_categories c LEFT JOIN metals m ON m.id = c.metal_id',
  fields: ['metal_id', 'name', 'description', 'is_active'], booleans: ['is_active'], required: ['name'],
  searchable: ['c.name'], sortable: { name: 'c.name' }, defaultSort: 'name',
}));

router.use('/items', createCrudRouter({
  table: 'items', screen: 'm_items', alias: 'i',
  select: 'SELECT i.*, c.name AS category_name, (SELECT COUNT(*) FROM loan_items li WHERE li.item_id = i.id) AS used_in_loans FROM items i LEFT JOIN item_categories c ON c.id = i.category_id',
  fields: ['category_id', 'name', 'local_name', 'description', 'is_active'], booleans: ['is_active'], required: ['name'],
  searchable: ['i.name', 'i.local_name'], sortable: { name: 'i.name' }, filters: { category_id: 'i.category_id', is_active: 'i.is_active' },
  defaultSort: 'name',
}));

/* ---------------- schemes ---------------- */
router.use('/schemes', createCrudRouter({
  table: 'schemes', screen: 'm_schemes', alias: 's', branchScoped: true, sharedBranch: true,
  select: 'SELECT s.*, m.name AS metal_name, b.name AS branch_name FROM schemes s LEFT JOIN metals m ON m.id = s.metal_id LEFT JOIN branches b ON b.id = s.branch_id',
  fields: ['code', 'name', 'metal_id', 'branch_id', 'ltv_percent', 'rate_type', 'calc_mode', 'slab_mode', 'slabs', 'min_days', 'tenure_months',
    'grace_days', 'penal_rate', 'doc_charge_percent', 'doc_charge_fixed', 'advance_interest_months', 'min_amount', 'max_amount', 'description', 'is_active'],
  booleans: ['is_active'], json: ['slabs'], required: ['code', 'name', 'slabs'],
  searchable: ['s.code', 's.name'], sortable: { code: 's.code', name: 's.name' }, filters: { is_active: 's.is_active', metal_id: 's.metal_id' },
  defaultSort: 'code',
  beforeSave: async (d, req) => {
    if (d.branch_id && !req.branchIds.includes(Number(d.branch_id))) throw ApiError.forbidden();
    if (d.slabs) {
      const slabs = JSON.parse(d.slabs);
      if (!Array.isArray(slabs) || !slabs.length) throw ApiError.badRequest('Add at least one interest slab');
    }
    return d;
  },
}));

/* ---------------- designations ---------------- */
router.use('/designations', createCrudRouter({
  table: 'designations', screen: 'm_designations', alias: 'd',
  fields: ['name', 'description', 'is_active'], booleans: ['is_active'], required: ['name'],
  searchable: ['d.name'], sortable: { name: 'd.name' }, defaultSort: 'name',
}));

/* ---------------- bank accounts (auto-creates a ledger) ---------------- */
router.use('/bank-accounts', createCrudRouter({
  table: 'bank_accounts', screen: 'bank_accounts', alias: 'ba', branchScoped: true,
  select: 'SELECT ba.*, b.name AS branch_name FROM bank_accounts ba JOIN branches b ON b.id = ba.branch_id',
  fields: ['bank_name', 'bank_branch', 'account_name', 'account_no', 'ifsc', 'customer_id_at_bank', 'address', 'phone', 'opened_on', 'used_for', 'is_active'],
  booleans: ['is_active'], required: ['bank_name'], searchable: ['ba.bank_name', 'ba.account_no'],
  sortable: { bank_name: 'ba.bank_name' }, defaultSort: 'bank_name',
  afterSave: async (row, _req, existing) => {
    if (existing?.ledger_id) {
      await query('UPDATE ledgers SET name = :n WHERE id = :id', { n: `${row.bank_name} ${row.account_no || ''}`.trim(), id: existing.ledger_id });
      return;
    }
    const grp = await queryOne("SELECT id FROM ledger_groups WHERE name = 'Bank Accounts'");
    const l = await query('INSERT INTO ledgers (group_id, name, branch_id, is_system) VALUES (:g, :n, :b, 1)',
      { g: grp.id, n: `${row.bank_name} ${row.account_no || ''}`.trim(), b: row.branch_id });
    await query('UPDATE bank_accounts SET ledger_id = :l WHERE id = :id', { l: l.insertId, id: row.id });
  },
}));

/* ---------------- lookups for dropdowns (any logged-in user with loan access) ---------------- */
router.get('/lookups', permitAny(['loan_new', 'loan_old', 'loan_list', 'customers', 'interest_calculator', 'm_schemes', 'loan_release']), async (req, res) => {
  const [metals, purities, items, schemes, banks, rates] = await Promise.all([
    query('SELECT id, code, name, local_name FROM metals WHERE is_active = 1 ORDER BY id'),
    query('SELECT id, metal_id, name, purity FROM purities WHERE is_active = 1 ORDER BY purity DESC'),
    query('SELECT id, name, local_name, category_id FROM items WHERE is_active = 1 ORDER BY name'),
    query("SELECT * FROM schemes WHERE is_active = 1 AND (branch_id IS NULL OR branch_id IN (:b)) ORDER BY calc_mode = 'MYBOOK' DESC, code", { b: req.branchIds }),
    query('SELECT id, branch_id, bank_name, account_no, used_for FROM bank_accounts WHERE is_active = 1 AND branch_id IN (:b) ORDER BY bank_name', { b: req.branchIds }),
    query(`SELECT r.metal_id, r.purity, r.market_rate, r.loan_rate, r.rate_date FROM metal_rates r
            WHERE r.id IN (SELECT MAX(id) FROM metal_rates GROUP BY metal_id)`),
  ]);
  res.json({ data: { metals, purities, items, schemes, banks, rates } });
});

/* quick-add item from the new-loan screen */
router.post('/items/quick', permitAny(['loan_new', 'm_items'], 'add'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Item name required');
  const exists = await queryOne('SELECT id, name FROM items WHERE name = :n', { n: name });
  if (exists) return res.json({ data: exists });
  const r = await query('INSERT INTO items (name) VALUES (:n)', { n: name });
  audit(req, 'CREATE', 'items', r.insertId, { name });
  res.status(201).json({ data: { id: r.insertId, name } });
});

router.get('/next-scheme-code', permit('m_schemes', 'add'), async (_req, res) => {
  const row = await queryOne('SELECT COUNT(*) AS c FROM schemes');
  res.json({ data: `GL${String(row.c + 1).padStart(3, '0')}` });
});

export default router;
