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
  return calculateInterest({ loan, scheme, txns, asOf: asOn, options: { monthRoundHalfDays: num(settings.MONTH_ROUND_HALF_DAYS, 15), roundInterestTo: num(settings.ROUND_INTEREST_TO, 1) } });
};

/** Overdue loans eligible for notice / auction */
router.get('/list', permit('auction', 'view'), async (req, res) => {
  const settings = await getSettings(req.branchId || 0);
  const asOn = req.query.asOn || dayjs().format('YYYY-MM-DD');
  const minOverdue = req.query.days != null ? num(req.query.days) : num(settings.AUCTION_AFTER_DAYS_OVERDUE, 30);
  const loans = await query(`SELECT l.*, c.name customer_name, c.phone customer_phone, c.title customer_title, c.relation_type, c.relation_name,
      CONCAT_WS(', ', c.door_no, c.street, c.area, c.city, c.pincode) address, DATEDIFF(:d, l.due_date) overdue_days,
      (SELECT COUNT(*) FROM auction_notices n WHERE n.loan_id = l.id) notices,
      (SELECT MAX(notice_date) FROM auction_notices n WHERE n.loan_id = l.id) last_notice,
      (SELECT COALESCE(SUM(postage),0) FROM auction_notices n WHERE n.loan_id = l.id) postage
    FROM loans l JOIN customers c ON c.id = l.customer_id
    WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.bank_pledge_id IS NULL AND DATEDIFF(:d, l.due_date) >= :min ORDER BY l.due_date`,
  { b: req.branchIds, d: asOn, min: minOverdue });
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
  const rows = await query(`SELECT a.*, l.bill_no, l.loan_date, l.net_wt, c.name customer_name FROM auction_sales a JOIN loans l ON l.id = a.loan_id JOIN customers c ON c.id = l.customer_id
    WHERE a.branch_id IN (:b) ORDER BY a.auction_date DESC`, { b: req.branchIds });
  res.json({ data: rows });
});

router.post('/sales', permit('auction_sale', 'add'), requireBranch, async (req, res) => {
  const b = req.body;
  const date = await ensureDateOpen(req, b.auction_date);
  const settings = await getSettings(req.branchId);
  const saleAmount = round2(b.sale_amount);
  if (saleAmount <= 0) throw ApiError.badRequest('Enter sale amount');
  const result = await withTransaction(async (tx) => {
    const loan = await tx.queryOne('SELECT * FROM loans WHERE id = :id FOR UPDATE', { id: b.loan_id });
    if (!loan) throw ApiError.notFound();
    assertBranch(req, loan.branch_id);
    if (loan.status !== 'OPEN') throw ApiError.badRequest('Loan is not open');
    if (loan.bank_pledge_id) throw ApiError.badRequest('Jewels are pledged in bank');
    const c = await calcFor(loan, date, settings);
    const postage = num((await tx.queryOne('SELECT COALESCE(SUM(postage),0) p FROM auction_notices WHERE loan_id = :id', { id: loan.id })).p);
    const charges = round2(num(b.charges) + postage);
    const principal = c.principalOutstanding;
    const interestDue = round2(c.interestDue + c.penalDue);
    const recoverable = round2(principal + interestDue + charges);
    const surplus = round2(saleAmount - recoverable);
    const interestRecovered = round2(Math.max(0, Math.min(interestDue, saleAmount - principal - charges)));
    const chargesRecovered = round2(Math.max(0, Math.min(charges, saleAmount - principal)));
    const payments = normalisePayments(b.payments, saleAmount);
    const fy = await getCurrentFy(tx);
    const rno = await nextNumber(tx, { branchId: loan.branch_id, key: 'RECEIPT', fyId: fy.id });
    const t = await tx.query(`INSERT INTO loan_transactions (branch_id, loan_id, receipt_no, txn_date, txn_type, principal_amount, interest_amount, charges, total_amount, remarks, created_by)
      VALUES (:b, :l, :r, :d, 'AUCTION', :p, :i, :c, :t, :rem, :u)`,
    { b: loan.branch_id, l: loan.id, r: `${settings.RECEIPT_PREFIX || ''}${rno}`, d: date, p: -principal, i: interestRecovered, c: chargesRecovered, t: saleAmount, rem: `Auction to ${b.buyer_name || '-'}`, u: req.user.id });
    await tx.query("UPDATE loans SET status = 'AUCTIONED', current_principal = 0, close_date = :d, closed_by = :u WHERE id = :id", { d: date, u: req.user.id, id: loan.id });
    await tx.query(`INSERT INTO auction_sales (branch_id, loan_id, auction_date, buyer_name, sale_amount, principal_due, interest_due, charges, surplus, approved_by, remarks, created_by)
      VALUES (:b, :l, :d, :buyer, :s, :p, :i, :c, :sur, :ap, :rem, :u)`,
    { b: loan.branch_id, l: loan.id, d: date, buyer: b.buyer_name || null, s: saleAmount, p: principal, i: interestDue, c: charges, sur: surplus, ap: b.approved_by || null, rem: b.remarks || null, u: req.user.id });
    const narration = `Auction ${loan.bill_no}`;
    await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'RECEIPT', narration, sourceType: 'LOAN_TXN', sourceId: t.insertId, userId: req.user.id,
      lines: [
        ...(await paymentLines(tx, payments, 'debit', narration)),
        { ledger: LEDGER.AUCTION_LOSS, debit: surplus < 0 ? round2(principal - Math.min(principal, saleAmount)) : 0 },
        { ledger: LEDGER.LOAN_RECEIVABLE, credit: principal },
        { ledger: LEDGER.INTEREST_INCOME, credit: interestRecovered },
        { ledger: LEDGER.OTHER_CHARGES, credit: chargesRecovered },
        { ledger: LEDGER.AUCTION_SURPLUS, credit: Math.max(0, surplus) },
      ],
    });
    return { surplus, recoverable };
  });
  audit(req, 'AUCTION_SALE', 'loans', b.loan_id, { saleAmount, ...result });
  res.status(201).json({ data: result });
});

/* ---------------- stock check ---------------- */
router.get('/stock-check', permit('stock', 'view'), requireBranch, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const rows = await query(`SELECT l.id, l.bill_no, l.barcode, l.loan_date, l.net_wt, l.total_pcs, l.item_summary, l.current_principal, l.bank_pledge_id, c.name customer_name,
      s.checked_at, u.full_name checked_by_name
    FROM loans l JOIN customers c ON c.id = l.customer_id
    LEFT JOIN stock_checks s ON s.loan_id = l.id AND s.check_date = :d LEFT JOIN users u ON u.id = s.checked_by
    WHERE l.branch_id = :b AND l.status = 'OPEN' ORDER BY s.checked_at IS NULL DESC, l.loan_date`, { b: req.branchId, d: date });
  res.json({ data: rows });
});

router.post('/stock-check', permit('stock', 'add'), requireBranch, async (req, res) => {
  const date = req.body.date || dayjs().format('YYYY-MM-DD');
  const code = String(req.body.code || '').trim();
  const loan = await queryOne("SELECT id, bill_no, status FROM loans WHERE branch_id = :b AND (barcode = :c OR bill_no = :c OR id = :id) ORDER BY status = 'OPEN' DESC LIMIT 1",
    { b: req.branchId, c: code, id: Number(req.body.loan_id) || -1 });
  if (!loan) throw ApiError.notFound(`No loan found for "${code}"`);
  if (loan.status !== 'OPEN') throw ApiError.badRequest(`Loan ${loan.bill_no} is ${loan.status.toLowerCase()} - should not be in stock`);
  await query('INSERT IGNORE INTO stock_checks (branch_id, check_date, loan_id, checked_by) VALUES (:b, :d, :l, :u)', { b: req.branchId, d: date, l: loan.id, u: req.user.id });
  res.json({ data: loan });
});

router.delete('/stock-check/:loanId', permit('stock', 'delete'), requireBranch, async (req, res) => {
  await query('DELETE FROM stock_checks WHERE branch_id = :b AND loan_id = :l AND check_date = :d', { b: req.branchId, l: req.params.loanId, d: req.query.date || dayjs().format('YYYY-MM-DD') });
  res.json({ ok: true });
});

export default router;
