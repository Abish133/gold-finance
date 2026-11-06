import { Router } from 'express';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit, permitAny } from '#middleware/auth.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';
import { upload, publicPath } from '#middleware/upload.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { audit } from '#services/audit.service.js';
import { nextNumber } from '#services/sequence.service.js';
import { withCalc } from '#services/loanCalc.service.js';

const router = Router();

const FIELDS = ['title', 'name', 'relation_type', 'relation_name', 'door_no', 'street', 'area', 'city', 'district', 'state', 'pincode',
  'phone', 'alt_phone', 'email', 'dob', 'gender', 'occupation', 'id_proof_type', 'id_proof_no', 'nominee_name', 'nominee_relation', 'notes'];

const SELECT = `SELECT c.*, b.name AS branch_name,
  (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN') AS open_loans,
  (SELECT COALESCE(SUM(l.current_principal),0) FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN') AS outstanding
  FROM customers c JOIN branches b ON b.id = c.branch_id`;

const clean = (body) => Object.fromEntries(FIELDS.filter((f) => f in body).map((f) => [f, body[f] === '' ? null : body[f]]));

const loadCustomer = async (req, id) => {
  const c = await queryOne(`${SELECT} WHERE c.id = :id`, { id });
  if (!c) throw ApiError.notFound('Customer not found');
  assertBranch(req, c.branch_id);
  return c;
};

const listPerm = permitAny(['customers', 'loan_new', 'loan_old', 'customer_blocked', 'customer_merge', 'reports_customer']);

router.get('/', listPerm, async (req, res) => {
  const lq = parseListQuery(req.query, {
    sortable: { name: 'c.name', customer_no: 'c.customer_no', created_at: 'c.created_at', area: 'c.area' },
    defaultSort: 'customer_no',
  });
  const where = ['c.branch_id IN (:b)', req.query.status === 'MERGED' ? 'c.merged_into IS NOT NULL' : 'c.merged_into IS NULL'];
  const p = { b: req.branchIds };
  if (lq.search) {
    const by = { name: '(c.name LIKE :s OR c.relation_name LIKE :s)', mobile: '(c.phone LIKE :s OR c.alt_phone LIKE :s)', acno: 'c.customer_no = :raw', area: '(c.area LIKE :s OR c.city LIKE :s OR c.street LIKE :s)' }[req.query.by];
    where.push(by || '(c.name LIKE :s OR c.phone LIKE :s OR c.alt_phone LIKE :s OR c.area LIKE :s OR c.id_proof_no LIKE :s OR c.customer_no = :raw)');
    p.s = req.query.by === 'name' ? `${lq.search}%` : `%${lq.search}%`; p.raw = Number(lq.search) || -1;
  }
  if (req.query.status && !['MERGED', 'DUPLICATE'].includes(req.query.status)) { where.push('c.status = :st'); p.st = req.query.status; }
  if (req.query.status === 'DUPLICATE') where.push('EXISTS (SELECT 1 FROM customers d WHERE d.branch_id = c.branch_id AND d.id <> c.id AND d.merged_into IS NULL AND (d.phone = c.phone OR (d.name = c.name AND d.relation_name <=> c.relation_name)))');
  if (req.query.loans === 'open') where.push("EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN')");
  if (req.query.loans === 'none') where.push("NOT EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN')");
  if (req.query.area) { where.push('c.area = :area'); p.area = req.query.area; }
  const w = where.join(' AND ');
  const [rows, [{ total }], [tiles]] = await Promise.all([
    query(`${SELECT.replace('FROM customers c', ", (SELECT MAX(l.loan_date) FROM loans l WHERE l.customer_id = c.id) AS last_loan, (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN') AS open_loans FROM customers c")} WHERE ${w} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p),
    query(`SELECT COUNT(*) total FROM customers c WHERE ${w}`, p),
    query(`SELECT COUNT(*) total, SUM(c.status = 'ACTIVE') active, SUM(c.status = 'BLOCKED') blocked,
             SUM(EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN')) with_open
           FROM customers c WHERE c.branch_id IN (:b) AND c.merged_into IS NULL`, { b: req.branchIds }),
  ]);
  res.json({ ...paged(rows, total, lq), tiles });
});

router.get('/areas', listPerm, async (req, res) => {
  res.json({ data: (await query('SELECT DISTINCT area FROM customers WHERE branch_id IN (:b) AND area IS NOT NULL ORDER BY area', { b: req.branchIds })).map((r) => r.area) });
});

router.get('/check-phone', listPerm, async (req, res) => {
  const rows = await query('SELECT id, customer_no, name, phone FROM customers WHERE branch_id IN (:b) AND (phone = :p OR alt_phone = :p) AND id <> :id LIMIT 5',
    { b: req.branchIds, p: req.query.phone || '', id: Number(req.query.excludeId) || 0 });
  res.json({ data: rows });
});

router.get('/:id', listPerm, async (req, res) => res.json({ data: await loadCustomer(req, req.params.id) }));

/** Customer 360: profile + all loans + totals */
router.get('/:id/summary', listPerm, async (req, res) => {
  const customer = await loadCustomer(req, req.params.id);
  const loans = await query(
    `SELECT l.id, l.bill_no, l.loan_date, l.due_date, l.principal, l.current_principal, l.net_wt, l.item_summary, l.status, l.close_date, m.name AS metal_name
       FROM loans l JOIN metals m ON m.id = l.metal_id WHERE l.customer_id = :id ORDER BY l.loan_date DESC, l.id DESC`, { id: customer.id });
  const totals = await queryOne(
    `SELECT COUNT(*) AS total_loans, SUM(l.status = 'OPEN') AS open_loans, COALESCE(SUM(l.principal),0) AS total_lent,
            COALESCE(SUM(IF(l.status='OPEN', l.current_principal, 0)),0) AS outstanding,
            COALESCE(SUM(IF(l.status='OPEN', l.net_wt, 0)),0) AS gold_in_custody,
            (SELECT COALESCE(SUM(t.interest_amount),0) FROM loan_transactions t JOIN loans x ON x.id = t.loan_id WHERE x.customer_id = :id AND t.is_void = 0) AS interest_paid
       FROM loans l WHERE l.customer_id = :id`, { id: customer.id });
  const open = await query("SELECT l.*, c.name customer_name FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.customer_id = :id AND l.status = 'OPEN'", { id: customer.id });
  const calc = await withCalc(open, new Date(), customer.branch_id);
  totals.interest_due = Math.round(calc.reduce((s, r) => s + Number(r.interest_due), 0) * 100) / 100;
  res.json({ data: { customer, loans, totals } });
});

/** Customer ledger (desktop F5): every loan and every receipt in date order */
router.get('/:id/ledger', listPerm, async (req, res) => {
  const customer = await loadCustomer(req, req.params.id);
  const rows = await query(`SELECT t.id, t.txn_date, t.txn_type, t.receipt_no, t.principal_amount, t.interest_amount, t.penal_amount, t.charges, t.discount,
      t.total_amount, t.months_paid, t.remarks, l.id loan_id, l.bill_no, l.status
    FROM loan_transactions t JOIN loans l ON l.id = t.loan_id WHERE l.customer_id = :c AND t.is_void = 0 ORDER BY t.txn_date, t.id`, { c: customer.id });
  let bal = 0;
  const entries = rows.map((r) => { bal += Number(r.principal_amount); return { ...r, balance: Math.round(bal * 100) / 100 }; });
  const loanRows = await query(`SELECT l.*, c.name customer_name FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.customer_id = :c ORDER BY l.loan_date DESC, l.id DESC`, { c: customer.id });
  const calc = await withCalc(loanRows, new Date(), customer.branch_id);
  const loans = loanRows.map((l, i) => ({ ...calc[i], loan_on: l.loan_on, status: l.status, close_date: l.close_date }));
  const docs = await queryOne("SELECT COUNT(*) c FROM documents WHERE owner_type = 'CUSTOMER' AND owner_id = :c", { c: customer.id });
  res.json({ data: { customer, entries, loans, documents: docs.c } });
});

router.post('/', permitAny(['customers', 'loan_new', 'loan_old'], 'add'), requireBranch, async (req, res) => {
  const data = clean(req.body);
  if (!data.name || !data.phone) throw ApiError.badRequest('Name and phone are required');
  const id = await withTransaction(async (tx) => {
    const no = await nextNumber(tx, { branchId: req.branchId, key: 'CUSTOMER' });
    const r = await tx.query(
      `INSERT INTO customers (${Object.keys(data).join(',')}, branch_id, customer_no, created_by)
       VALUES (${Object.keys(data).map((k) => `:${k}`).join(',')}, :zz_b, :zz_no, :zz_u)`,
      { ...data, zz_b: req.branchId, zz_no: no, zz_u: req.user.id },
    );
    return r.insertId;
  });
  audit(req, 'CREATE', 'customers', id, { name: data.name });
  res.status(201).json({ data: await loadCustomer(req, id) });
});

router.put('/:id', permit('customers', 'edit'), async (req, res) => {
  const c = await loadCustomer(req, req.params.id);
  const data = clean(req.body);
  if (Object.keys(data).length) await query(`UPDATE customers SET ${Object.keys(data).map((k) => `${k} = :${k}`).join(', ')} WHERE id = :zz_id`, { ...data, zz_id: c.id });
  audit(req, 'UPDATE', 'customers', c.id, data);
  res.json({ data: await loadCustomer(req, c.id) });
});

/** Upload photo / signature / id proof images. field = photo|signature|doc_front|doc_back */
router.post('/:id/files/:field', permitAny(['customers', 'loan_new'], 'edit'), upload.single('file'), async (req, res) => {
  const c = await loadCustomer(req, req.params.id);
  const field = req.params.field;
  if (!['photo', 'signature', 'doc_front', 'doc_back'].includes(field)) throw ApiError.badRequest('Invalid file field');
  if (!req.file) throw ApiError.badRequest('No file received');
  const path = publicPath(req.file);
  await query(`UPDATE customers SET ${field} = :p WHERE id = :id`, { p: path, id: c.id });
  audit(req, 'UPLOAD', 'customers', c.id, { field });
  res.json({ data: { [field]: path } });
});

router.post('/:id/block', permit('customer_blocked', 'edit'), async (req, res) => {
  const c = await loadCustomer(req, req.params.id);
  const block = req.body.block !== false;
  if (block && !req.body.reason) throw ApiError.badRequest('Reason is required to block');
  await query('UPDATE customers SET status = :s, block_reason = :r WHERE id = :id', { s: block ? 'BLOCKED' : 'ACTIVE', r: block ? req.body.reason : null, id: c.id });
  audit(req, block ? 'BLOCK' : 'UNBLOCK', 'customers', c.id, { reason: req.body.reason });
  res.json({ data: await loadCustomer(req, c.id) });
});

/** Merge duplicate customers: move all loans from `fromId` into `toId`. */
router.post('/merge', permit('customer_merge', 'edit'), async (req, res) => {
  const from = await loadCustomer(req, req.body.fromId);
  const to = await loadCustomer(req, req.body.toId);
  if (from.id === to.id) throw ApiError.badRequest('Select two different customers');
  if (from.branch_id !== to.branch_id) throw ApiError.badRequest('Customers must be in the same branch');
  await withTransaction(async (tx) => {
    await tx.query('UPDATE loans SET customer_id = :to WHERE customer_id = :from', { to: to.id, from: from.id });
    await tx.query("UPDATE documents SET owner_id = :to WHERE owner_type = 'CUSTOMER' AND owner_id = :from", { to: to.id, from: from.id });
    await tx.query('UPDATE customers SET merged_into = :to WHERE id = :from', { to: to.id, from: from.id });
  });
  audit(req, 'MERGE', 'customers', to.id, { from: from.id });
  res.json({ data: await loadCustomer(req, to.id) });
});

export default router;
