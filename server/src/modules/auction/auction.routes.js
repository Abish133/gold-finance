import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit } from '#middleware/auth.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { calculateInterest } from '#services/interest.service.js';
import { getSettings, getCurrentFy } from '#services/settings.service.js';
import { ensureDateOpen } from '#services/daycontrol.service.js';
import { postVoucher, paymentLines, normalisePayments, LEDGER } from '#services/accounting.service.js';
import { nextNumber } from '#services/sequence.service.js';
import { queueMessage } from '#services/message.service.js';

const router = Router();

const calcFor = async (loan, asOn, settings) => {
  const [scheme, txns] = await Promise.all([
    queryOne('SELECT * FROM schemes WHERE id = :id', { id: loan.scheme_id }),
    query('SELECT * FROM loan_transactions WHERE loan_id = :id AND is_void = 0 ORDER BY txn_date, id', { id: loan.id }),
  ]);
  return calculateInterest({ loan, scheme, txns, asOf: asOn, options: { monthRoundHalfDays: num(settings.MONTH_ROUND_HALF_DAYS, 15), roundInterestTo: num(settings.ROUND_INTEREST_TO, 1), compoundMonths: num(settings.COMPOUND_PERIOD_MONTHS, 12) } });
};

/** Overdue loans eligible for notice / auction */
router.get('/list', permit('auction', 'view'), async (req, res) => {
  const settings = await getSettings(req.branchId || 0);
  const asOn = req.query.asOn || dayjs().format('YYYY-MM-DD');
  const minOverdue = req.query.days != null ? num(req.query.days) : num(settings.AUCTION_AFTER_DAYS_OVERDUE, 30);
  const loans = await query(`SELECT l.*, TIMESTAMPDIFF(MONTH, l.loan_date, :d) age_months, c.name customer_name, c.phone customer_phone, c.title customer_title, c.relation_type, c.relation_name,
      CONCAT_WS(', ', c.door_no, c.street, c.area, c.city, c.pincode) address, DATEDIFF(:d, l.due_date) overdue_days,
      (SELECT COUNT(*) FROM auction_notices n WHERE n.loan_id = l.id) notices,
      (SELECT MAX(notice_date) FROM auction_notices n WHERE n.loan_id = l.id) last_notice,
      (SELECT COALESCE(SUM(postage),0) FROM auction_notices n WHERE n.loan_id = l.id) postage
    FROM loans l JOIN customers c ON c.id = l.customer_id
    WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${req.query.include === 'bank' ? '' : 'AND l.bank_pledge_id IS NULL'}
      AND ${req.query.older_than ? 'l.loan_date <= DATE_SUB(:d, INTERVAL :om MONTH)' : 'DATEDIFF(:d, l.due_date) >= :min'}
      ${req.query.from ? 'AND l.loan_date >= :from' : ''} ${req.query.to ? 'AND l.loan_date <= :to' : ''}
      ${req.query.loan_on ? 'AND l.loan_on = :lon' : ''}
      ${req.query.notice === 'sent' ? 'AND EXISTS (SELECT 1 FROM auction_notices n WHERE n.loan_id = l.id)' : ''}
      ${req.query.notice === 'not_sent' ? 'AND NOT EXISTS (SELECT 1 FROM auction_notices n WHERE n.loan_id = l.id)' : ''}
    ORDER BY l.loan_date`,
  { b: req.branchIds, d: asOn, min: minOverdue, om: num(req.query.older_than), from: req.query.from, to: req.query.to, lon: req.query.loan_on });
  const out = [];
  for (const l of loans) {
    const c = await calcFor(l, asOn, settings);
    out.push({ ...l, interest_due: round2(c.interestDue + c.penalDue), total_due: round2(c.totalPayable + num(l.postage)), market_value_now: l.market_value });
  }
  res.json({ data: out });
});

router.get('/notices', permit('auction', 'view'), async (req, res) => {
  const rows = await query(`SELECT n.*, l.bill_no, c.name customer_name, c.phone FROM auction_notices n JOIN loans l ON l.id = n.loan_id JOIN customers c ON c.id = l.customer_id
    WHERE n.branch_id IN (:b) AND n.notice_date BETWEEN :f AND :t ORDER BY n.notice_date DESC, n.id DESC`,
  { b: req.branchIds, f: req.query.from || dayjs().subtract(1, 'month').format('YYYY-MM-DD'), t: req.query.to || dayjs().format('YYYY-MM-DD') });
  res.json({ data: rows });
});

router.post('/notices', permit('auction', 'add'), requireBranch, async (req, res) => {
  const b = req.body;
  const ids = (b.loan_ids || []).map(Number).filter(Boolean);
  if (!ids.length) throw ApiError.badRequest('Select loans');
  const settings = await getSettings(req.branchId);
  const loans = await query("SELECT l.id, l.bill_no, l.customer_id, c.phone, c.name FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.id IN (:ids) AND l.branch_id = :b AND l.status = 'OPEN'", { ids, b: req.branchId });
  const date = b.notice_date || dayjs().format('YYYY-MM-DD');
  const postage = b.postage != null ? num(b.postage) : num(settings.NOTICE_POSTAGE);
  if (loans.length) {
    const vals = loans.map((l) => [req.branchId, l.id, b.notice_type || 'FIRST', date, b.sent_via || 'REGISTERED', postage, b.reference || null, b.remarks || null, req.user.id]);
    await query('INSERT INTO auction_notices (branch_id, loan_id, notice_type, notice_date, sent_via, postage, reference, remarks, created_by) VALUES ?', [vals]);
    if (b.sms) for (const l of loans) queueMessage({ branchId: req.branchId, event: 'DUE_REMINDER', phone: l.phone, loanId: l.id, vars: { name: l.name, loan_no: l.bill_no, date } });
  }
  audit(req, 'NOTICE', 'auction_notices', null, { count: loans.length, type: b.notice_type });
  res.status(201).json({ data: { count: loans.length } });
});

router.get('/sales', permit('auction_sale', 'view'), async (req, res) => {
  const rows = await query(`SELECT a.*, l.bill_no, l.loan_date, l.net_wt, l.loan_on, l.item_summary, l.interest_rate, l.rate_type, c.name customer_name, c.relation_type, c.relation_name,
      u.full_name marked_by, TIMESTAMPDIFF(MONTH, l.loan_date, a.auction_date) months,
      (SELECT MIN(n.notice_date) FROM auction_notices n WHERE n.loan_id = l.id AND n.notice_type IN ('FIRST','REMINDER')) first_notice,
      (SELECT MIN(n.notice_date) FROM auction_notices n WHERE n.loan_id = l.id AND n.sent_via = 'REGISTERED') registered_notice
    FROM auction_sales a JOIN loans l ON l.id = a.loan_id JOIN customers c ON c.id = l.customer_id LEFT JOIN users u ON u.id = a.created_by
    WHERE a.branch_id IN (:b) ORDER BY a.auction_date DESC`, { b: req.branchIds });
  res.json({ data: rows });
});

/** Settle one loan by auction inside a transaction. sale_amount null -> recovered at full dues. */
/*
 * Desktop auction flow (Auction Release):
 *  1. Mark as auctioned  -> loan closed as AUCTIONED, no money (day report: Girvi in / Auction out)
 *  2. Save sale (later)  -> money received; profit / loss = sold for - loan amount
 *  Change sale = admin, Remove sale, Undo auction = admin and only while no sale is saved.
 */
const markLoan = async (tx, req, loanId, date, settings, remarks) => {
  const loan = await tx.queryOne('SELECT * FROM loans WHERE id = :id FOR UPDATE', { id: loanId });
  if (!loan) throw ApiError.notFound();
  assertBranch(req, loan.branch_id);
  if (loan.status !== 'OPEN') throw ApiError.badRequest(`Loan ${loan.bill_no} is not open`);
  if (loan.bank_pledge_id) throw ApiError.badRequest(`Loan ${loan.bill_no}: jewels are pledged in bank`);
  const c = await calcFor(loan, date, settings);
  const postage = num((await tx.queryOne('SELECT COALESCE(SUM(postage),0) p FROM auction_notices WHERE loan_id = :id', { id: loan.id })).p);
  const principal = c.principalOutstanding;
  const fy = await getCurrentFy(tx);
  const rno = await nextNumber(tx, { branchId: loan.branch_id, key: 'RECEIPT', fyId: fy.id });
  await tx.query(`INSERT INTO loan_transactions (branch_id, loan_id, receipt_no, txn_date, txn_type, principal_amount, interest_amount, charges, total_amount, remarks, created_by)
    VALUES (:b, :l, :r, :d, 'AUCTION', :p, 0, 0, 0, :rem, :u)`,
  { b: loan.branch_id, l: loan.id, r: `${settings.RECEIPT_PREFIX || ''}${rno}`, d: date, p: -principal, rem: remarks || 'Auctioned', u: req.user.id });
  await tx.query("UPDATE loans SET status = 'AUCTIONED', current_principal = 0, close_date = :d, closed_by = :u, auction_marked_at = NOW() WHERE id = :id", { d: date, u: req.user.id, id: loan.id });
  await tx.query(`INSERT INTO auction_sales (branch_id, loan_id, auction_date, sale_amount, principal_due, interest_due, charges, surplus, remarks, created_by)
    VALUES (:b, :l, :d, 0, :p, :i, :c, 0, :rem, :u)`,
  { b: loan.branch_id, l: loan.id, d: date, p: principal, i: round2(c.interestDue + c.penalDue), c: postage, rem: remarks || null, u: req.user.id });
  audit(req, 'AUCTION_MARK', 'loans', loan.id, { principal });
  return { loan_id: loan.id, bill_no: loan.bill_no, principal };
};

const removeSaleVoucher = async (tx, sale) => {
  if (!sale.sale_voucher_id) return;
  await tx.query('DELETE FROM voucher_entries WHERE voucher_id = :v', { v: sale.sale_voucher_id });
  await tx.query('DELETE FROM vouchers WHERE id = :v', { v: sale.sale_voucher_id });
};

const saveSale = async (tx, req, loanId, b) => {
  const sale = await tx.queryOne('SELECT * FROM auction_sales WHERE loan_id = :l FOR UPDATE', { l: loanId });
  if (!sale) throw ApiError.badRequest('Mark the loan as auctioned first');
  assertBranch(req, sale.branch_id);
  if (sale.sale_date && !req.user.is_super_admin) throw ApiError.forbidden('Only an Admin can change a saved sale');
  const amountSold = round2(b.sale_amount);
  if (amountSold <= 0) throw ApiError.badRequest('Enter what the items sold for');
  const date = await ensureDateOpen(req, b.sale_date);
  if (dayjs(date).isBefore(dayjs(sale.auction_date))) throw ApiError.badRequest('Sale date cannot be before the auction date');
  await removeSaleVoucher(tx, sale);
  const principal = num(sale.principal_due);
  const profit = round2(amountSold - principal);
  const loan = await tx.queryOne('SELECT bill_no FROM loans WHERE id = :id', { id: loanId });
  const fy = await getCurrentFy(tx);
  const narration = `Auction sale ${loan.bill_no}`;
  const payments = normalisePayments(b.payments, amountSold);
  const vId = await postVoucher(tx, {
    branchId: sale.branch_id, fyId: fy.id, date, type: 'RECEIPT', narration, sourceType: 'AUCTION_SALE', sourceId: sale.id, userId: req.user.id,
    lines: [
      ...(await paymentLines(tx, payments, 'debit', narration)),
      { ledger: LEDGER.AUCTION_LOSS, debit: profit < 0 ? -profit : 0 },
      { ledger: LEDGER.LOAN_RECEIVABLE, credit: principal },
      { ledger: LEDGER.AUCTION_SURPLUS, credit: profit > 0 ? profit : 0 },
    ],
  });
  await tx.query('UPDATE auction_sales SET sale_amount = :s, sale_date = :d, surplus = :p, buyer_name = COALESCE(:buyer, buyer_name), approved_by = COALESCE(:ap, approved_by), sale_voucher_id = :v WHERE id = :id',
    { s: amountSold, d: date, p: profit, buyer: b.buyer_name || null, ap: b.approved_by || null, v: vId, id: sale.id });
  audit(req, sale.sale_date ? 'AUCTION_SALE_CHANGE' : 'AUCTION_SALE', 'loans', loanId, { amountSold, profit });
  return { loan_id: Number(loanId), bill_no: loan.bill_no, saleAmount: amountSold, profit, surplus: profit };
};

/** one step (older API): mark + sale */
router.post('/sales', permit('auction_sale', 'add'), requireBranch, async (req, res) => {
  const date = await ensureDateOpen(req, req.body.auction_date);
  const settings = await getSettings(req.branchId);
  const result = await withTransaction(async (tx) => {
    await markLoan(tx, req, req.body.loan_id, date, settings, req.body.remarks);
    return req.body.sale_amount ? saveSale(tx, req, req.body.loan_id, { ...req.body, sale_date: date }) : { loan_id: req.body.loan_id, saleAmount: 0, profit: 0 };
  });
  res.status(201).json({ data: result });
});

/** Auction Release (desktop): tick overdue loans and close them as AUCTIONED in one go (sale entered later) */
router.post('/mark-auctioned', permit('auction_sale', 'add'), requireBranch, async (req, res) => {
  const date = await ensureDateOpen(req, req.body.auction_date);
  const settings = await getSettings(req.branchId);
  const list = (req.body.loans || []).filter((x) => x.loan_id);
  if (!list.length) throw ApiError.badRequest('Tick loans to mark as auctioned');
  const out = await withTransaction(async (tx) => {
    const r = [];
    for (const x of list) {
      const m = await markLoan(tx, req, x.loan_id, date, settings, req.body.remarks);
      r.push(num(x.sale_amount) > 0 ? { ...m, ...(await saveSale(tx, req, x.loan_id, { ...x, sale_date: date, buyer_name: req.body.buyer_name })) } : m);
    }
    return r;
  });
  res.status(201).json({ data: { count: out.length, total: round2(out.reduce((t, x) => t + num(x.principal), 0)), loans: out } });
});

/** Save / change (admin) the sale of an auctioned loan */
router.put('/sales/:loanId', permit('auction_sale', 'edit'), requireBranch, async (req, res) => {
  res.json({ data: await withTransaction((tx) => saveSale(tx, req, req.params.loanId, req.body)) });
});

/** Remove a saved sale (the loan stays auctioned) */
router.delete('/sales/:loanId/sale', permit('auction_sale', 'edit'), requireBranch, async (req, res) => {
  await withTransaction(async (tx) => {
    const sale = await tx.queryOne('SELECT * FROM auction_sales WHERE loan_id = :l FOR UPDATE', { l: req.params.loanId });
    if (!sale) throw ApiError.notFound();
    assertBranch(req, sale.branch_id);
    if (!sale.sale_date) throw ApiError.badRequest('No sale saved for this loan');
    await ensureDateOpen(req, dayjs(sale.sale_date).format('YYYY-MM-DD'));
    await removeSaleVoucher(tx, sale);
    await tx.query('UPDATE auction_sales SET sale_amount = 0, sale_date = NULL, surplus = 0, sale_voucher_id = NULL WHERE id = :id', { id: sale.id });
  });
  audit(req, 'AUCTION_SALE_REMOVE', 'loans', req.params.loanId);
  res.json({ ok: true });
});

/** Undo auction (admin) - only while no sale is saved; the loan is open again */
router.post('/sales/:loanId/undo', permit('auction_sale', 'delete'), requireBranch, async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only an Admin can undo an auction');
  await withTransaction(async (tx) => {
    const sale = await tx.queryOne('SELECT * FROM auction_sales WHERE loan_id = :l FOR UPDATE', { l: req.params.loanId });
    if (!sale) throw ApiError.notFound();
    assertBranch(req, sale.branch_id);
    if (sale.sale_date) throw ApiError.badRequest('Remove the sale first');
    await tx.query("UPDATE loan_transactions SET is_void = 1 WHERE loan_id = :l AND txn_type = 'AUCTION' AND is_void = 0", { l: sale.loan_id });
    await tx.query("UPDATE loans SET status = 'OPEN', current_principal = :p, close_date = NULL, closed_by = NULL, auction_marked_at = NULL WHERE id = :l", { p: sale.principal_due, l: sale.loan_id });
    await tx.query('DELETE FROM auction_sales WHERE id = :id', { id: sale.id });
  });
  audit(req, 'AUCTION_UNDO', 'loans', req.params.loanId);
  res.json({ ok: true });
});

/* ---------------- stock check ---------------- */
router.get('/stock-check', permit('stock', 'view'), requireBranch, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const rows = await query(`SELECT l.id, l.bill_no, l.manual_bill_no, l.barcode, l.loan_date, l.loan_on, l.net_wt, l.total_pcs, l.item_summary, l.current_principal, l.bank_pledge_id,
      l.principal + COALESCE((SELECT SUM(tt.principal_amount) FROM loan_transactions tt WHERE tt.loan_id = l.id AND tt.txn_type = 'TOPUP' AND tt.is_void = 0), 0) loan_amount,
      (SELECT GROUP_CONCAT(CONCAT(li.item_name, ' ', li.pcs) ORDER BY li.id SEPARATOR ', ') FROM loan_items li WHERE li.loan_id = l.id) items_text,
      c.name customer_name, c.relation_type, c.relation_name, c.phone customer_phone, IF(s.checked_by IS NULL AND s.missing = 0, NULL, s.checked_at) checked_at, s.missing, s.remarks, u.full_name checked_by_name
    FROM loans l JOIN customers c ON c.id = l.customer_id
    LEFT JOIN stock_checks s ON s.loan_id = l.id AND s.check_date = :d LEFT JOIN users u ON u.id = s.checked_by
    WHERE l.branch_id = :b AND l.status = 'OPEN' ORDER BY l.loan_no`, { b: req.branchId, d: date });
  res.json({ data: rows });
});

/* mark / unmark a packet as missing for this check */
router.post('/stock-check/missing', permit('stock', 'edit'), requireBranch, async (req, res) => {
  const date = req.body.date || dayjs().format('YYYY-MM-DD');
  const loan = await queryOne("SELECT id, bill_no FROM loans WHERE id = :id AND branch_id = :b AND status = 'OPEN'", { id: req.body.loan_id, b: req.branchId });
  if (!loan) throw ApiError.notFound('Loan not found');
  if (req.body.missing === false) await query('DELETE FROM stock_checks WHERE branch_id = :b AND loan_id = :l AND check_date = :d AND missing = 1', { b: req.branchId, l: loan.id, d: date });
  else await query(`INSERT INTO stock_checks (branch_id, check_date, loan_id, checked_by, missing, remarks) VALUES (:b, :d, :l, :u, 1, :r)
    ON DUPLICATE KEY UPDATE missing = 1, remarks = COALESCE(:r, remarks)`, { b: req.branchId, d: date, l: loan.id, u: req.user.id, r: req.body.remarks || null });
  audit(req, 'STOCK_MISSING', 'loans', loan.id, { date, missing: req.body.missing !== false });
  res.json({ ok: true });
});

/* new check: clear all scans of the day */
router.delete('/stock-check', permit('stock', 'delete'), requireBranch, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const r = await query('DELETE FROM stock_checks WHERE branch_id = :b AND check_date = :d', { b: req.branchId, d: date });
  audit(req, 'STOCK_CHECK_RESET', 'stock_checks', 0, { date, removed: r.affectedRows });
  res.json({ ok: true });
});

router.post('/stock-check', permit('stock', 'add'), requireBranch, async (req, res) => {
  const date = req.body.date || dayjs().format('YYYY-MM-DD');
  const code = String(req.body.code || '').trim();
  const loan = await queryOne("SELECT id, bill_no, status FROM loans WHERE branch_id = :b AND (barcode = :c OR bill_no = :c OR id = :id) ORDER BY status = 'OPEN' DESC LIMIT 1",
    { b: req.branchId, c: code, id: Number(req.body.loan_id) || -1 });
  if (!loan) throw ApiError.notFound(`No loan found for "${code}"`);
  if (loan.status !== 'OPEN') throw ApiError.badRequest(`Loan ${loan.bill_no} is ${loan.status.toLowerCase()} - should not be in stock`);
  await query('INSERT INTO stock_checks (branch_id, check_date, loan_id, checked_by) VALUES (:b, :d, :l, :u) ON DUPLICATE KEY UPDATE checked_at = IF(missing = 1 OR checked_by IS NULL, NOW(), checked_at), missing = 0, checked_by = :u', { b: req.branchId, d: date, l: loan.id, u: req.user.id });
  res.json({ data: loan });
});

router.delete('/stock-check/:loanId', permit('stock', 'delete'), requireBranch, async (req, res) => {
  await query('DELETE FROM stock_checks WHERE branch_id = :b AND loan_id = :l AND check_date = :d', { b: req.branchId, l: req.params.loanId, d: req.query.date || dayjs().format('YYYY-MM-DD') });
  res.json({ ok: true });
});

export default router;
