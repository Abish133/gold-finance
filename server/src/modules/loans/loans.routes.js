import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne } from '#config/db.js';
import { permit, permitAny } from '#middleware/auth.js';
import { requireBranch } from '#middleware/branch.js';
import { upload, publicPath } from '#middleware/upload.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { calculateInterest } from '#services/interest.service.js';
import { getSettings, getCurrentFy } from '#services/settings.service.js';
import { peekNumber } from '#services/sequence.service.js';
import * as svc from './loans.service.js';

const router = Router();
const anyLoan = permitAny(['loan_list', 'loan_new', 'loan_interest', 'loan_release', 'loan_part_payment', 'loan_topup', 'loan_renewal', 'loan_print', 'loan_edit', 'stock', 'auction']);

/* ---------------- pledge book ---------------- */
router.get('/', anyLoan, async (req, res) => {
  const lq = parseListQuery(req.query, {
    sortable: { loan_date: 'l.loan_date', loan_no: 'l.loan_no', principal: 'l.principal', due_date: 'l.due_date', customer_name: 'c.name', net_wt: 'l.net_wt' },
    defaultSort: 'loan_date',
  });
  const where = ['l.branch_id IN (:b)'];
  const p = { b: req.branchIds };
  if (lq.search) {
    where.push('(l.bill_no LIKE :s OR l.manual_bill_no LIKE :s OR l.barcode = :raw OR c.name LIKE :s OR c.phone LIKE :s OR l.item_summary LIKE :s)');
    p.s = `%${lq.search}%`; p.raw = lq.search;
  }
  const f = req.query;
  if (f.status) { where.push('l.status IN (:st)'); p.st = String(f.status).split(','); }
  if (f.from) { where.push('l.loan_date >= :from'); p.from = f.from; }
  if (f.to) { where.push('l.loan_date <= :to'); p.to = f.to; }
  if (f.metal_id) { where.push('l.metal_id = :metal'); p.metal = f.metal_id; }
  if (f.scheme_id) { where.push('l.scheme_id = :scheme'); p.scheme = f.scheme_id; }
  if (f.customer_id) { where.push('l.customer_id = :cust'); p.cust = f.customer_id; }
  if (f.overdue === '1') where.push("l.status = 'OPEN' AND l.due_date < CURDATE()");
  if (f.bank === '1') where.push('l.bank_pledge_id IS NOT NULL');
  if (f.bank === '0') where.push('l.bank_pledge_id IS NULL');
  if (f.entry_type) { where.push('l.entry_type = :et'); p.et = f.entry_type; }
  const w = where.join(' AND ');
  const base = `FROM loans l JOIN customers c ON c.id = l.customer_id JOIN metals m ON m.id = l.metal_id JOIN schemes s ON s.id = l.scheme_id JOIN branches b ON b.id = l.branch_id WHERE ${w}`;
  const [rows, [agg]] = await Promise.all([
    query(`SELECT l.id, l.branch_id, l.bill_no, l.loan_no, l.manual_bill_no, l.barcode, l.loan_date, l.due_date, l.principal, l.current_principal,
             l.interest_rate, l.net_wt, l.gross_wt, l.total_pcs, l.item_summary, l.status, l.close_date, l.entry_type, l.bank_pledge_id, l.sticker_printed_at,
             c.id AS customer_id, c.customer_no, c.name AS customer_name, c.phone AS customer_phone, c.area, m.name AS metal_name, s.code AS scheme_code,
             b.name AS branch_name, DATEDIFF(CURDATE(), l.loan_date) AS age_days
           ${base} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p),
    query(`SELECT COUNT(*) total, COALESCE(SUM(l.principal),0) principal, COALESCE(SUM(l.current_principal),0) outstanding, COALESCE(SUM(l.net_wt),0) net_wt ${base}`, p),
  ]);
  res.json({ ...paged(rows, agg.total, lq), summary: agg });
});

/* quick find by bill no / barcode / manual bill no -> id */
router.get('/find', anyLoan, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) throw ApiError.badRequest('Enter loan number');
  const rows = await query(
    `SELECT l.id, l.bill_no, l.status, l.loan_date, l.principal, c.name AS customer_name FROM loans l JOIN customers c ON c.id = l.customer_id
      WHERE l.branch_id IN (:b) AND (l.bill_no = :q OR l.barcode = :q OR l.manual_bill_no = :q OR l.loan_no = :n)
      ORDER BY (l.status = 'OPEN') DESC, l.id DESC LIMIT 10`,
    { b: req.branchIds, q, n: Number(q) || -1 },
  );
  res.json({ data: rows });
});

router.get('/next-number', permitAny(['loan_new', 'loan_old']), requireBranch, async (req, res) => {
  const s = await getSettings(req.branchId);
  const fy = await getCurrentFy();
  const no = await peekNumber({ queryOne }, { branchId: req.branchId, key: 'LOAN', fyId: s.LOAN_NO_RESET_YEARLY === '1' ? fy.id : 0 });
  const branch = await queryOne('SELECT loan_prefix FROM branches WHERE id = :id', { id: req.branchId });
  res.json({ data: { loan_no: no, bill_no: `${branch.loan_prefix || ''}${no}` } });
});

/* ---------------- calculator (no loan) ---------------- */
router.post('/calculate', permitAny(['interest_calculator', 'loan_new', 'loan_release']), async (req, res) => {
  const b = req.body;
  const schemes = b.scheme_ids?.length
    ? await query('SELECT * FROM schemes WHERE id IN (:ids)', { ids: b.scheme_ids })
    : b.scheme_id ? await query('SELECT * FROM schemes WHERE id = :id', { id: b.scheme_id }) : [];
  const settings = await getSettings(req.branchId || 0);
  const opts = { monthRoundHalfDays: num(settings.MONTH_ROUND_HALF_DAYS, 15), roundInterestTo: num(settings.ROUND_INTEREST_TO, 1) };
  const list = schemes.length ? schemes : [{ name: 'Custom', code: 'CUSTOM', rate_type: b.rate_type || 'YEARLY', calc_mode: b.calc_mode || 'DAYS', slabs: [{ upto_months: null, rate: num(b.rate) }], min_days: num(b.min_days) }];
  const out = list.map((scheme) => {
    const loan = { loan_date: b.loan_date, principal: num(b.principal), interest_rate: num(b.rate), rate_type: scheme.rate_type, advance_interest: 0,
      due_date: dayjs(b.loan_date).add(num(scheme.tenure_months, 12), 'month').format('YYYY-MM-DD') };
    return { scheme: { id: scheme.id, code: scheme.code, name: scheme.name }, ...calculateInterest({ loan, scheme, txns: [], asOf: b.as_of, options: opts }) };
  });
  res.json({ data: out });
});

/* ---------------- stickers ---------------- */
router.post('/stickers/printed', permit('loan_sticker', 'print'), async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  if (ids.length) await query('UPDATE loans SET sticker_printed_at = NOW() WHERE id IN (:ids) AND branch_id IN (:b)', { ids, b: req.branchIds });
  res.json({ ok: true });
});

/* ---------------- create ---------------- */
router.post('/', permit('loan_new', 'add'), requireBranch, async (req, res) => {
  const id = await svc.createLoan(req, req.body, 'NEW');
  res.status(201).json({ data: await svc.getLoanFull(req, id) });
});

router.post('/old', permit('loan_old', 'add'), requireBranch, async (req, res) => {
  const id = await svc.createLoan(req, req.body, 'OLD');
  res.status(201).json({ data: await svc.getLoanFull(req, id) });
});

/* ---------------- single loan ---------------- */
router.get('/:id', anyLoan, async (req, res) => {
  res.json({ data: await svc.getLoanFull(req, req.params.id, req.query.as_of) });
});

router.get('/:id/calc', anyLoan, async (req, res) => {
  const full = await svc.getLoanFull(req, req.params.id, req.query.date || dayjs().format('YYYY-MM-DD'));
  res.json({ data: full.calc });
});

router.put('/:id', permit('loan_edit', 'edit'), async (req, res) => {
  await svc.editLoan(req, req.params.id, req.body);
  res.json({ data: await svc.getLoanFull(req, req.params.id) });
});

router.post('/:id/photo', permitAny(['loan_new', 'loan_edit'], 'add'), upload.single('file'), async (req, res) => {
  const loan = await svc.getLoan(req, req.params.id);
  if (!req.file) throw ApiError.badRequest('No file');
  const field = req.query.field === 'customer_photo' ? 'customer_photo' : 'item_photo';
  const path = publicPath(req.file);
  await query(`UPDATE loans SET ${field} = :p WHERE id = :id`, { p: path, id: loan.id });
  res.json({ data: { [field]: path } });
});

/* generic upload used before a loan exists (new loan screen) */
router.post('/upload/temp', permitAny(['loan_new', 'loan_old', 'loan_release', 'customers'], 'add'), upload.single('file'), (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file');
  res.json({ data: { path: publicPath(req.file) } });
});

router.post('/:id/interest', permit('loan_interest', 'add'), requireBranch, async (req, res) => {
  const t = await svc.payInterest(req, req.params.id, req.body);
  res.status(201).json({ data: { transaction: t, loan: await svc.getLoanFull(req, req.params.id) } });
});

router.post('/:id/part-payment', permit('loan_part_payment', 'add'), requireBranch, async (req, res) => {
  const t = await svc.partPayment(req, req.params.id, req.body);
  res.status(201).json({ data: { transaction: t, loan: await svc.getLoanFull(req, req.params.id) } });
});

router.post('/:id/topup', permit('loan_topup', 'add'), requireBranch, async (req, res) => {
  const t = await svc.topUp(req, req.params.id, req.body);
  res.status(201).json({ data: { transaction: t, loan: await svc.getLoanFull(req, req.params.id) } });
});

router.post('/:id/release', permit('loan_release', 'add'), requireBranch, async (req, res) => {
  const t = await svc.releaseLoan(req, req.params.id, req.body);
  res.status(201).json({ data: { transaction: t, loan: await svc.getLoanFull(req, req.params.id) } });
});

router.post('/:id/renew', permit('loan_renewal', 'add'), requireBranch, async (req, res) => {
  const newId = await svc.renewLoan(req, req.params.id, req.body);
  res.status(201).json({ data: await svc.getLoanFull(req, newId) });
});

router.post('/:id/cancel', permit('loan_cancel', 'delete'), requireBranch, async (req, res) => {
  await svc.cancelLoan(req, req.params.id, req.body.reason);
  res.json({ data: await svc.getLoanFull(req, req.params.id) });
});

router.post('/:id/transactions/:txnId/void', permit('loan_cancel', 'delete'), requireBranch, async (req, res) => {
  await svc.voidTransaction(req, req.params.id, req.params.txnId, req.body.reason);
  res.json({ data: await svc.getLoanFull(req, req.params.id) });
});

router.post('/:id/print-log', permitAny(['loan_print', 'loan_new'], 'print'), async (req, res) => {
  const loan = await svc.getLoan(req, req.params.id);
  const prev = await queryOne('SELECT COUNT(*) c FROM print_logs WHERE loan_id = :id AND doc_type = :d', { id: loan.id, d: req.body.doc_type || 'LOAN_RECEIPT' });
  await query('INSERT INTO print_logs (branch_id, loan_id, doc_type, copy_type, printed_by) VALUES (:b, :l, :d, :c, :u)',
    { b: loan.branch_id, l: loan.id, d: req.body.doc_type || 'LOAN_RECEIPT', c: prev.c ? 'DUPLICATE' : 'ORIGINAL', u: req.user.id });
  if (prev.c) audit(req, 'DUPLICATE_PRINT', 'loans', loan.id, { doc: req.body.doc_type });
  res.json({ data: { copy: prev.c ? 'DUPLICATE' : 'ORIGINAL', count: prev.c + 1 } });
});

router.get('/:id/print-logs', anyLoan, async (req, res) => {
  const loan = await svc.getLoan(req, req.params.id);
  res.json({ data: await query('SELECT p.*, u.full_name FROM print_logs p LEFT JOIN users u ON u.id = p.printed_by WHERE loan_id = :id ORDER BY id DESC', { id: loan.id }) });
});

export default router;
