import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit } from '#middleware/auth.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { round2, num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { postVoucher, voidSourceVouchers, ledgerId, LEDGER } from '#services/accounting.service.js';
import { getCurrentFy } from '#services/settings.service.js';
import { ensureDateOpen } from '#services/daycontrol.service.js';

const router = Router();

const bankInterest = (bp, asOn) => {
  const days = Math.max(dayjs(asOn).diff(dayjs(bp.pledge_date), 'day'), num(bp.min_days));
  return { days, interest: round2((num(bp.amount) * num(bp.interest_rate) * days) / 36500) };
};

const accountLedger = async (tx, mode, bankAccountId) => {
  if (mode !== 'BANK') return ledgerId(tx, LEDGER.CASH);
  const ba = await tx.queryOne('SELECT ledger_id FROM bank_accounts WHERE id = :id', { id: bankAccountId });
  if (!ba?.ledger_id) throw ApiError.badRequest('Select bank account');
  return ba.ledger_id;
};

router.get('/pledges', permit('bank_pledge', 'view'), async (req, res) => {
  const lq = parseListQuery(req.query, { sortable: { pledge_date: 'bp.pledge_date', amount: 'bp.amount' }, defaultSort: 'pledge_date' });
  const where = ['bp.branch_id IN (:b)'];
  const p = { b: req.branchIds };
  if (req.query.status) { where.push('bp.status = :st'); p.st = req.query.status; }
  if (lq.search) { where.push('(bp.pledge_no LIKE :s OR ba.bank_name LIKE :s)'); p.s = `%${lq.search}%`; }
  const w = where.join(' AND ');
  const rows = await query(`SELECT bp.*, ba.bank_name, ba.bank_branch, br.name branch_name,
      (SELECT COUNT(*) FROM bank_pledge_loans x WHERE x.bank_pledge_id = bp.id) loan_count
    FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id JOIN branches br ON br.id = bp.branch_id
    WHERE ${w} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query(`SELECT COUNT(*) total FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id WHERE ${w}`, p);
  res.json(paged(rows.map((r) => ({ ...r, ...(r.status === 'OPEN' ? bankInterest(r, dayjs()) : {}) })), total, lq));
});

router.get('/pledges/available-loans', permit('bank_pledge', 'view'), requireBranch, async (req, res) => {
  const rows = await query(`SELECT l.id, l.bill_no, l.loan_date, l.current_principal, l.net_wt, l.gross_wt, l.total_pcs, l.item_summary, c.name customer_name
    FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.branch_id = :b AND l.status = 'OPEN' AND l.bank_pledge_id IS NULL ORDER BY l.loan_date`, { b: req.branchId });
  res.json({ data: rows });
});

router.get('/pledges/:id', permit('bank_pledge', 'view'), async (req, res) => {
  const bp = await queryOne('SELECT bp.*, ba.bank_name, ba.bank_branch FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id WHERE bp.id = :id', { id: req.params.id });
  if (!bp) throw ApiError.notFound();
  assertBranch(req, bp.branch_id);
  const loans = await query(`SELECT l.id, l.bill_no, l.loan_date, l.principal, l.current_principal, l.net_wt, l.gross_wt, l.total_pcs, l.item_summary, l.status, c.name customer_name
    FROM bank_pledge_loans x JOIN loans l ON l.id = x.loan_id JOIN customers c ON c.id = l.customer_id WHERE x.bank_pledge_id = :id`, { id: bp.id });
  res.json({ data: { ...bp, loans, calc: bankInterest(bp, req.query.date || dayjs()) } });
});

router.post('/pledges', permit('bank_pledge', 'add'), requireBranch, async (req, res) => {
  const b = req.body;
  const date = await ensureDateOpen(req, b.pledge_date);
  const ids = (b.loan_ids || []).map(Number).filter(Boolean);
  if (!b.bank_account_id || !b.pledge_no || !num(b.amount)) throw ApiError.badRequest('Bank, pledge number and amount are required');
  if (!ids.length) throw ApiError.badRequest('Select loans to pledge');
  const id = await withTransaction(async (tx) => {
    const loans = await tx.query("SELECT id, net_wt, total_pcs FROM loans WHERE id IN (:ids) AND branch_id = :b AND status = 'OPEN' AND bank_pledge_id IS NULL FOR UPDATE", { ids, b: req.branchId });
    if (loans.length !== ids.length) throw ApiError.badRequest('Some selected loans are not available');
    const yearly = num(b.interest_rate) || num(b.rate_monthly) * 12;
    const r = await tx.query(`INSERT INTO bank_pledges (branch_id, bank_account_id, pledge_no, pledge_date, amount, interest_rate, rate_monthly, min_days, charges, cash_received, total_wt, total_pcs, remarks, created_by)
      VALUES (:b, :ba, :no, :d, :a, :r, :rm, :md, :c, :cr, :wt, :pcs, :rem, :u)`,
    { b: req.branchId, ba: b.bank_account_id, no: b.pledge_no, d: date, a: round2(b.amount), r: yearly, rm: round2(yearly / 12), md: num(b.min_days), c: round2(b.charges),
      cr: round2(num(b.amount) - num(b.charges)),
      wt: round2(loans.reduce((s, l) => s + num(l.net_wt), 0)), pcs: loans.reduce((s, l) => s + num(l.total_pcs), 0), rem: b.remarks || null, u: req.user.id });
    await tx.conn.query('INSERT INTO bank_pledge_loans (bank_pledge_id, loan_id) VALUES ?', [ids.map((l) => [r.insertId, l])]);
    await tx.query('UPDATE loans SET bank_pledge_id = :p WHERE id IN (:ids)', { p: r.insertId, ids });
    const fy = await getCurrentFy(tx);
    const into = await accountLedger(tx, b.received_mode, b.received_bank_account_id || b.bank_account_id);
    await postVoucher(tx, {
      branchId: req.branchId, fyId: fy.id, date, type: 'RECEIPT', narration: `Bank pledge ${b.pledge_no}`, sourceType: 'BANK_PLEDGE', sourceId: r.insertId, userId: req.user.id,
      lines: [{ ledger: into, debit: round2(num(b.amount) - num(b.charges)) }, { ledger: LEDGER.BANK_CHARGES, debit: round2(b.charges) }, { ledger: LEDGER.BANK_BORROWING, credit: round2(b.amount) }],
    });
    return r.insertId;
  });
  audit(req, 'BANK_PLEDGE', 'bank_pledges', id, { loans: ids.length, amount: b.amount });
  res.status(201).json({ data: { id } });
});

router.post('/pledges/:id/release', permit('bank_pledge', 'edit'), requireBranch, async (req, res) => {
  const b = req.body;
  const date = await ensureDateOpen(req, b.date);
  await withTransaction(async (tx) => {
    const bp = await tx.queryOne('SELECT * FROM bank_pledges WHERE id = :id FOR UPDATE', { id: req.params.id });
    if (!bp) throw ApiError.notFound();
    assertBranch(req, bp.branch_id);
    if (bp.status !== 'OPEN') throw ApiError.badRequest('Already released');
    const interest = b.interest != null && b.interest !== '' ? round2(b.interest) : bankInterest(bp, date).interest;
    const charges = round2(b.charges);
    const total = round2(num(bp.amount) + interest + charges);
    await tx.query("UPDATE bank_pledges SET status = 'CLOSED', release_date = :d, interest_paid = :i, total_paid = :t WHERE id = :id", { d: date, i: interest, t: total, id: bp.id });
    await tx.query('UPDATE loans SET bank_pledge_id = NULL WHERE bank_pledge_id = :id', { id: bp.id });
    const fy = await getCurrentFy(tx);
    const from = await accountLedger(tx, b.mode, b.bank_account_id || bp.bank_account_id);
    await postVoucher(tx, {
      branchId: bp.branch_id, fyId: fy.id, date, type: 'PAYMENT', narration: `Bank pledge release ${bp.pledge_no}`, sourceType: 'BANK_PLEDGE_REL', sourceId: bp.id, userId: req.user.id,
      lines: [{ ledger: LEDGER.BANK_BORROWING, debit: num(bp.amount) }, { ledger: LEDGER.BANK_INTEREST, debit: interest }, { ledger: LEDGER.BANK_CHARGES, debit: charges }, { ledger: from, credit: total }],
    });
  });
  audit(req, 'BANK_RELEASE', 'bank_pledges', req.params.id, b);
  res.json({ ok: true });
});

router.delete('/pledges/:id', permit('bank_pledge', 'delete'), async (req, res) => {
  await withTransaction(async (tx) => {
    const bp = await tx.queryOne('SELECT * FROM bank_pledges WHERE id = :id FOR UPDATE', { id: req.params.id });
    if (!bp) throw ApiError.notFound();
    assertBranch(req, bp.branch_id);
    if (bp.status !== 'OPEN') throw ApiError.badRequest('Released pledges cannot be deleted');
    await voidSourceVouchers(tx, 'BANK_PLEDGE', bp.id);
    await tx.query('UPDATE loans SET bank_pledge_id = NULL WHERE bank_pledge_id = :id', { id: bp.id });
    await tx.query('DELETE FROM bank_pledges WHERE id = :id', { id: bp.id });
  });
  audit(req, 'DELETE', 'bank_pledges', req.params.id);
  res.json({ ok: true });
});

export default router;
