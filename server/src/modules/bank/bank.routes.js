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

/* desktop: % per year on the days (at least 1 day), per-day shown, total rounded to the rupee */
const bankInterest = (bp, asOn) => {
  const days = Math.max(1, dayjs(asOn).diff(dayjs(bp.pledge_date), 'day'), num(bp.min_days));
  const perDay = (num(bp.amount) * num(bp.interest_rate)) / 36500;
  return { days, perDay: round2(perDay), interest: Math.round(perDay * days) };
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
  if (req.query.bank_account_id) { where.push('bp.bank_account_id = :ba'); p.ba = req.query.bank_account_id; }
  const dcol = req.query.date_on === 'release' ? 'bp.release_date' : 'bp.pledge_date';
  if (req.query.from) { where.push(`${dcol} >= :f`); p.f = req.query.from; }
  if (req.query.to) { where.push(`${dcol} <= :t`); p.t = req.query.to; }
  const w = where.join(' AND ');
  const rows = await query(`SELECT bp.*, ba.bank_name, ba.bank_branch, br.name branch_name,
      (SELECT COUNT(*) FROM bank_pledge_loans x WHERE x.bank_pledge_id = bp.id) loan_count
    FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id JOIN branches br ON br.id = bp.branch_id
    WHERE ${w} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query(`SELECT COUNT(*) total FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id WHERE ${w}`, p);
  const asOn = req.query.as_on || dayjs().format('YYYY-MM-DD');
  // released: interest worked out vs paid, and what our own loans earned meanwhile (desktop "Our Interest / Our Margin")
  const ids = rows.filter((r) => r.status !== 'OPEN').map((r) => r.id);
  const inside = ids.length ? await query(`SELECT x.bank_pledge_id, l.principal, l.interest_rate, l.rate_type FROM bank_pledge_loans x JOIN loans l ON l.id = x.loan_id WHERE x.bank_pledge_id IN (:ids)`, { ids }) : [];
  const out = rows.map((r) => {
    if (r.status === 'OPEN') return { ...r, ...bankInterest(r, asOn) };
    const calc = bankInterest(r, r.release_date);
    const ours = Math.round(inside.filter((x) => x.bank_pledge_id === r.id)
      .reduce((t, x) => t + (num(x.principal) * (x.rate_type === 'MONTHLY' ? num(x.interest_rate) / 100 / 30 : num(x.interest_rate) / 100 / 365)) * calc.days, 0));
    const paid = num(r.interest_paid);
    return { ...r, days: calc.days, interest: paid, interest_calc: calc.interest, paid_pct_year: num(r.amount) ? round2((paid / num(r.amount)) * (365 / calc.days) * 100) : 0, our_interest: ours, our_margin: round2(ours - paid) };
  });
  // tiles over the whole filter (not just this page)
  const wNoStatus = where.filter((x) => !x.startsWith('bp.status')).join(' AND ');
  const all = await query(`SELECT bp.* FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id WHERE ${wNoStatus}`, p);
  const open = all.filter((r) => r.status === 'OPEN');
  const closed = all.filter((r) => r.status !== 'OPEN');
  const sum = (list, k) => round2(list.reduce((t, r) => t + num(r[k]), 0));
  const tiles = { all: all.length, allAmt: sum(all, 'amount'), open: open.length, openAmt: sum(open, 'amount'), interestDue: round2(open.reduce((t, r) => t + bankInterest(r, asOn).interest, 0)),
    released: closed.length, releasedAmt: sum(closed, 'amount'), interestPaid: sum(closed, 'interest_paid'), charges: sum(all, 'charges'), cashReceived: sum(all, 'cash_received') };
  res.json({ ...paged(out, total, lq), tiles });
});

router.get('/pledges/available-loans', permit('bank_pledge', 'view'), requireBranch, async (req, res) => {
  const rows = await query(`SELECT l.id, l.bill_no, l.manual_bill_no, l.loan_date, l.loan_on, l.principal, l.current_principal, l.net_wt, l.gross_wt, l.total_pcs, l.item_summary, l.item_photo, l.avg_purity, l.market_value,
      c.name customer_name, c.relation_type, c.relation_name, c.phone customer_phone
    FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.branch_id = :b AND l.status = 'OPEN' AND l.bank_pledge_id IS NULL ORDER BY l.loan_no`, { b: req.branchId });
  res.json({ data: rows });
});

/* bank accounts with open bank loans (desktop Bank Accounts screen) */
router.get('/accounts-summary', permit('bank_accounts', 'view'), async (req, res) => {
  const rows = await query(`SELECT ba.*, br.name branch_name, (SELECT COUNT(*) FROM bank_pledges bp WHERE bp.bank_account_id = ba.id AND bp.status = 'OPEN') open_count,
      (SELECT COALESCE(SUM(amount),0) FROM bank_pledges bp WHERE bp.bank_account_id = ba.id AND bp.status = 'OPEN') outstanding
    FROM bank_accounts ba JOIN branches br ON br.id = ba.branch_id WHERE ba.branch_id IN (:b) ORDER BY ba.id`, { b: req.branchIds });
  res.json({ data: rows });
});

/* month-wise taken / released / balance (Bank Reports) */
router.get('/month-wise', permit('bank_pledge', 'view'), async (req, res) => {
  const p = { b: req.branchIds, f: req.query.from || '2000-01-01', t: req.query.to || dayjs().format('YYYY-MM-DD') };
  const ba = req.query.bank_account_id ? 'AND bank_account_id = :ba' : '';
  if (ba) p.ba = req.query.bank_account_id;
  const taken = await query(`SELECT DATE_FORMAT(pledge_date, '%Y-%m') m, COUNT(*) c, SUM(amount) a, SUM(charges) ch FROM bank_pledges WHERE branch_id IN (:b) ${ba} AND pledge_date BETWEEN :f AND :t GROUP BY m`, p);
  const rel = await query(`SELECT DATE_FORMAT(release_date, '%Y-%m') m, COUNT(*) c, SUM(amount) a, SUM(interest_paid) i FROM bank_pledges WHERE branch_id IN (:b) ${ba} AND release_date BETWEEN :f AND :t GROUP BY m`, p);
  // desktop: every month of the period, opening row first, loans and amount at bank after each month
  const used = [...new Set([...taken.map((x) => x.m), ...rel.map((x) => x.m)])].sort();
  const start = req.query.from ? dayjs(req.query.from).startOf('month') : (used[0] ? dayjs(`${used[0]}-01`) : dayjs().startOf('month'));
  const months = [];
  for (let d = start; !d.isAfter(dayjs(p.t), 'month'); d = d.add(1, 'month')) months.push(d.format('YYYY-MM'));
  const open = await queryOne(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) a FROM bank_pledges WHERE branch_id IN (:b) ${ba} AND pledge_date < :f AND (release_date IS NULL OR release_date >= :f)`, p);
  let bal = num(open?.a); let cnt = num(open?.c);
  const data = [{ month: 'Opening', opening: true, taken_count: 0, taken: 0, charges: 0, released_count: 0, released: 0, interest: 0, at_bank_count: cnt, balance: bal }];
  for (const m of months) {
    const t = taken.find((x) => x.m === m) || {}; const r = rel.find((x) => x.m === m) || {};
    bal = round2(bal + num(t.a) - num(r.a)); cnt += num(t.c) - num(r.c);
    data.push({ month: m, taken_count: num(t.c), taken: num(t.a), charges: num(t.ch), released_count: num(r.c), released: num(r.a), interest: num(r.i), at_bank_count: cnt, balance: bal });
  }
  res.json({ data });
});

router.get('/pledges/:id', permit('bank_pledge', 'view'), async (req, res) => {
  const bp = await queryOne('SELECT bp.*, ba.bank_name, ba.bank_branch FROM bank_pledges bp JOIN bank_accounts ba ON ba.id = bp.bank_account_id WHERE bp.id = :id', { id: req.params.id });
  if (!bp) throw ApiError.notFound();
  assertBranch(req, bp.branch_id);
  const loans = await query(`SELECT l.id, l.bill_no, l.loan_date, l.loan_on, l.principal, l.current_principal, l.net_wt, l.gross_wt, l.total_pcs, l.item_summary, l.status, l.bank_pledge_id, c.name customer_name
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
