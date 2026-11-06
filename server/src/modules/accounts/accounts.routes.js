import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit, permitAny } from '#middleware/auth.js';
import { requireBranch } from '#middleware/branch.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { round2, num } from '#utils/money.js';
import { createCrudRouter } from '#utils/crudFactory.js';
import { audit } from '#services/audit.service.js';
import { postVoucher, ledgerId, LEDGER } from '#services/accounting.service.js';
import { getCurrentFy } from '#services/settings.service.js';
import { ensureDateOpen, lastClosedDate } from '#services/daycontrol.service.js';
import * as acc from './accounts.service.js';

const router = Router();
const range = (q) => ({ from: q.from || dayjs().format('YYYY-MM-DD'), to: q.to || q.from || dayjs().format('YYYY-MM-DD') });

/* ---------------- ledger groups & ledgers ---------------- */
router.get('/groups', permitAny(['acc_ledgers', 'acc_voucher', 'acc_ledger_report']), async (_req, res) => {
  res.json({ data: await query('SELECT * FROM ledger_groups ORDER BY nature, name') });
});

router.use('/ledgers', createCrudRouter({
  table: 'ledgers', screen: 'acc_ledgers', alias: 'l', branchScoped: true, sharedBranch: true,
  select: `SELECT l.*, g.name AS group_name, g.nature FROM ledgers l JOIN ledger_groups g ON g.id = l.group_id`,
  fields: ['group_id', 'name', 'code', 'branch_id', 'is_active'], booleans: ['is_active'], required: ['group_id', 'name'],
  searchable: ['l.name', 'g.name', 'l.code'], sortable: { name: 'l.name', group_name: 'g.name' }, filters: { group_id: 'l.group_id', nature: 'g.nature' },
  defaultSort: 'name',
  beforeSave: async (d, req, existing) => {
    if (existing?.is_system && 'group_id' in d && Number(d.group_id) !== existing.group_id) throw ApiError.badRequest('System ledger group cannot be changed');
    if (d.branch_id && !req.branchIds.includes(Number(d.branch_id))) throw ApiError.forbidden();
    return d;
  },
  extend: (r) => {
    r.get('/:id/opening', permit('acc_ledgers', 'view'), async (req, res) => {
      res.json({ data: await query('SELECT * FROM ledger_openings WHERE ledger_id = :l AND branch_id IN (:b)', { l: req.params.id, b: req.branchIds }) });
    });
    r.put('/:id/opening', permit('acc_ledgers', 'edit'), requireBranch, async (req, res) => {
      const amt = round2(req.body.type === 'CR' ? -num(req.body.amount) : num(req.body.amount));
      await query('INSERT INTO ledger_openings (ledger_id, branch_id, amount) VALUES (:l, :b, :a) ON DUPLICATE KEY UPDATE amount = :a', { l: req.params.id, b: req.branchId, a: amt });
      audit(req, 'OPENING', 'ledgers', req.params.id, { amount: amt });
      res.json({ ok: true });
    });
  },
}));

/* ---------------- vouchers ---------------- */
router.get('/vouchers', permitAny(['acc_voucher', 'acc_cashbook']), async (req, res) => {
  const lq = parseListQuery(req.query, { sortable: { voucher_date: 'v.voucher_date' }, defaultSort: 'voucher_date' });
  const { from, to } = range(req.query);
  const where = ['v.branch_id IN (:b)', 'v.voucher_date BETWEEN :f AND :t', 'v.is_void = 0'];
  const p = { b: req.branchIds, f: from, t: to };
  if (req.query.type) { where.push('v.voucher_type = :ty'); p.ty = req.query.type; }
  if (req.query.manual === '1') where.push('v.source_type IS NULL');
  if (lq.search) { where.push('(v.narration LIKE :s OR v.voucher_no = :raw)'); p.s = `%${lq.search}%`; p.raw = lq.search; }
  const w = where.join(' AND ');
  const rows = await query(`SELECT v.*, b.name branch_name, u.full_name created_by_name,
      (SELECT SUM(debit) FROM voucher_entries e WHERE e.voucher_id = v.id) amount,
      (SELECT GROUP_CONCAT(CONCAT(l.name, IF(e.debit > 0, ' Dr ', ' Cr '), IF(e.debit > 0, e.debit, e.credit)) SEPARATOR ' | ')
         FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id WHERE e.voucher_id = v.id) lines_text
     FROM vouchers v JOIN branches b ON b.id = v.branch_id LEFT JOIN users u ON u.id = v.created_by
     WHERE ${w} ${lq.orderBy}, v.id DESC LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query(`SELECT COUNT(*) total FROM vouchers v WHERE ${w}`, p);
  res.json(paged(rows, total, lq));
});

router.get('/vouchers/:id', permitAny(['acc_voucher', 'acc_cashbook']), async (req, res) => {
  const v = await queryOne('SELECT * FROM vouchers WHERE id = :id AND branch_id IN (:b)', { id: req.params.id, b: req.branchIds });
  if (!v) throw ApiError.notFound();
  const lines = await query('SELECT e.*, l.name ledger_name FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id WHERE e.voucher_id = :id', { id: v.id });
  res.json({ data: { ...v, lines } });
});

/**
 * Manual voucher.
 * RECEIPT / PAYMENT: { voucher_type, date, ledger_id, amount, mode: CASH|BANK, bank_ledger_id, narration }
 * JOURNAL / CONTRA : { voucher_type, date, lines: [{ ledger_id, debit, credit }], narration }
 */
router.post('/vouchers', permit('acc_voucher', 'add'), requireBranch, async (req, res) => {
  const b = req.body;
  const date = await ensureDateOpen(req, b.date);
  const type = b.voucher_type;
  if (!['RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'].includes(type)) throw ApiError.badRequest('Invalid voucher type');
  const id = await withTransaction(async (tx) => {
    const fy = await getCurrentFy(tx);
    let lines;
    if (type === 'RECEIPT' || type === 'PAYMENT') {
      const amount = round2(b.amount);
      if (!b.ledger_id || amount <= 0) throw ApiError.badRequest('Select account and amount');
      const cashLedger = b.mode === 'BANK' ? Number(b.bank_ledger_id) : await ledgerId(tx, LEDGER.CASH);
      if (!cashLedger) throw ApiError.badRequest('Select bank');
      lines = type === 'RECEIPT'
        ? [{ ledger: cashLedger, debit: amount }, { ledger: Number(b.ledger_id), credit: amount }]
        : [{ ledger: Number(b.ledger_id), debit: amount }, { ledger: cashLedger, credit: amount }];
    } else {
      lines = (b.lines || []).map((l) => ({ ledger: Number(l.ledger_id), debit: num(l.debit), credit: num(l.credit), narration: l.narration }));
      if (lines.length < 2) throw ApiError.badRequest('Add at least two lines');
    }
    return postVoucher(tx, { branchId: req.branchId, fyId: fy.id, date, type, narration: b.narration, userId: req.user.id, lines });
  });
  audit(req, 'VOUCHER', 'vouchers', id, b);
  res.status(201).json({ data: { id } });
});

router.delete('/vouchers/:id', permit('acc_voucher', 'delete'), async (req, res) => {
  const v = await queryOne('SELECT * FROM vouchers WHERE id = :id AND branch_id IN (:b)', { id: req.params.id, b: req.branchIds });
  if (!v) throw ApiError.notFound();
  if (v.source_type) throw ApiError.badRequest('System vouchers are removed by voiding the related loan receipt');
  await ensureDateOpen(req, v.voucher_date);
  await withTransaction(async (tx) => {
    await tx.query('UPDATE vouchers SET is_void = 1 WHERE id = :id', { id: v.id });
    await tx.query('DELETE FROM voucher_entries WHERE voucher_id = :id', { id: v.id });
  });
  audit(req, 'VOID', 'vouchers', v.id);
  res.json({ ok: true });
});

/* ---------------- books ---------------- */
router.get('/cash-book', permit('acc_cashbook', 'view'), async (req, res) => {
  const { from, to } = range(req.query);
  const cashId = req.query.ledger_id ? Number(req.query.ledger_id) : await ledgerId({ queryOne }, LEDGER.CASH);
  res.json({ data: await acc.ledgerStatement(cashId, req.branchIds, from, to) });
});

router.get('/ledger-statement', permit('acc_ledger_report', 'view'), async (req, res) => {
  const { from, to } = range(req.query);
  if (!req.query.ledger_id) throw ApiError.badRequest('Select account');
  const ledger = await queryOne('SELECT l.*, g.name group_name FROM ledgers l JOIN ledger_groups g ON g.id = l.group_id WHERE l.id = :id', { id: req.query.ledger_id });
  res.json({ data: { ledger, ...(await acc.ledgerStatement(ledger.id, req.branchIds, from, to)) } });
});

router.get('/trial-balance', permit('acc_final', 'view'), async (req, res) => {
  const to = req.query.to || dayjs().format('YYYY-MM-DD');
  const rows = (await acc.ledgerBalances(req.branchIds, null, to)).filter((r) => r.balance || req.query.all === '1');
  const dr = round2(rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0));
  const cr = round2(rows.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0));
  res.json({ data: { rows, totalDebit: dr, totalCredit: cr } });
});

router.get('/profit-loss', permit('acc_final', 'view'), async (req, res) => {
  const fy = await getCurrentFy();
  res.json({ data: await acc.profitAndLoss(req.branchIds, req.query.from || fy.start_date, req.query.to || dayjs().format('YYYY-MM-DD')) });
});

router.get('/balance-sheet', permit('acc_final', 'view'), async (req, res) => {
  res.json({ data: await acc.balanceSheet(req.branchIds, req.query.to || dayjs().format('YYYY-MM-DD')) });
});

/* ---------------- day summary / day close ---------------- */
router.get('/day-summary', permitAny(['day_close', 'acc_cashbook', 'reports_summary', 'dashboard']), async (req, res) => {
  const { from, to } = range(req.query);
  res.json({ data: await acc.daySummary(req.branchIds, from, to) });
});

router.get('/day-close', permit('day_close', 'view'), requireBranch, async (req, res) => {
  const last = await lastClosedDate(req.branchId);
  const history = await query('SELECT d.*, u.full_name closed_by_name FROM day_closes d LEFT JOIN users u ON u.id = d.closed_by WHERE d.branch_id = :b ORDER BY close_date DESC LIMIT 30', { b: req.branchId });
  const next = last ? dayjs(last).add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  res.json({ data: { lastClosed: last, nextDate: next, summary: await acc.daySummary([req.branchId], next), history } });
});

router.post('/day-close', permit('day_close', 'add'), requireBranch, async (req, res) => {
  const date = dayjs(req.body.date).format('YYYY-MM-DD');
  if (dayjs(date).isAfter(dayjs(), 'day')) throw ApiError.badRequest('Cannot close a future date');
  const last = await lastClosedDate(req.branchId);
  if (last && !dayjs(date).isAfter(dayjs(last))) throw ApiError.badRequest('Day already closed');
  const summary = await acc.daySummary([req.branchId], date);
  await query('INSERT INTO day_closes (branch_id, close_date, opening_cash, closing_cash, summary, closed_by) VALUES (:b, :d, :o, :c, :s, :u)',
    { b: req.branchId, d: date, o: summary.cash.opening, c: summary.cash.closing, s: JSON.stringify(summary), u: req.user.id });
  audit(req, 'DAY_CLOSE', 'day_closes', date, { closing: summary.cash.closing });
  res.json({ data: summary });
});

router.delete('/day-close/:date', permit('day_close', 'delete'), requireBranch, async (req, res) => {
  const last = await lastClosedDate(req.branchId);
  if (!last || dayjs(last).format('YYYY-MM-DD') !== req.params.date) throw ApiError.badRequest('Only the latest closed day can be re-opened');
  await query('DELETE FROM day_closes WHERE branch_id = :b AND close_date = :d', { b: req.branchId, d: req.params.date });
  audit(req, 'DAY_REOPEN', 'day_closes', req.params.date);
  res.json({ ok: true });
});

/* ---------------- cash denomination ---------------- */
router.get('/denominations', permit('cash_denomination', 'view'), requireBranch, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const row = await queryOne('SELECT * FROM cash_denominations WHERE branch_id = :b AND count_date = :d', { b: req.branchId, d: date });
  const summary = await acc.daySummary([req.branchId], date);
  res.json({ data: { record: row, bookBalance: summary.cash.closing } });
});

router.post('/denominations', permit('cash_denomination', 'add'), requireBranch, async (req, res) => {
  const date = req.body.date || dayjs().format('YYYY-MM-DD');
  const notes = req.body.notes || {};
  const total = round2(Object.entries(notes).reduce((s, [d, c]) => s + Number(d) * num(c), 0) + num(req.body.coins));
  const summary = await acc.daySummary([req.branchId], date);
  const payload = { b: req.branchId, d: date, n: JSON.stringify({ ...notes, coins: num(req.body.coins) }), t: total, bb: summary.cash.closing, diff: round2(total - summary.cash.closing), r: req.body.remarks || null, u: req.user.id };
  await query(`INSERT INTO cash_denominations (branch_id, count_date, notes, total, book_balance, difference, remarks, created_by)
    VALUES (:b, :d, :n, :t, :bb, :diff, :r, :u) ON DUPLICATE KEY UPDATE notes = :n, total = :t, book_balance = :bb, difference = :diff, remarks = :r`, payload);
  audit(req, 'DENOMINATION', 'cash_denominations', date, { total });
  res.json({ data: { total, bookBalance: summary.cash.closing, difference: payload.diff } });
});

export default router;
