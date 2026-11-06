/**
 * Endpoints behind the desktop-style screens: day report, rate board, interest due list,
 * current stock, ledger balances, register tiles.
 */
import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit, permitAny } from '#middleware/auth.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { getSettings } from '#services/settings.service.js';
import { calculateInterest } from '#services/interest.service.js';
import { ledgerId, LEDGER } from '#services/accounting.service.js';
import { calcOptions } from '#modules/loans/loans.service.js';
import { openingBalance } from '#modules/accounts/accounts.service.js';
import { lastClosedDate } from '#services/daycontrol.service.js';
import { upload, publicPath } from '#middleware/upload.js';
import { saveSettings } from '#services/settings.service.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';

const router = Router();

/* ------------------------------------------------ Day report (accounts summary + cash tally) */
router.get('/day-report', permitAny(['acc_cashbook', 'day_close']), async (req, res) => {
  const from = req.query.from || dayjs().format('YYYY-MM-DD');
  const to = req.query.to || from;
  const b = req.branchIds;
  const cashId = await ledgerId({ queryOne }, LEDGER.CASH);
  const accounts = await query(`SELECT l.id, l.code, l.name, l.system_key, COALESCE(SUM(e.credit),0) jama, COALESCE(SUM(e.debit),0) nave
      FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id JOIN vouchers v ON v.id = e.voucher_id
     WHERE e.branch_id IN (:b) AND e.entry_date BETWEEN :f AND :t AND e.ledger_id <> :cash
       AND EXISTS (SELECT 1 FROM voucher_entries c WHERE c.voucher_id = e.voucher_id AND c.ledger_id = :cash)
     GROUP BY l.id ORDER BY l.id`, { b, f: from, t: to, cash: cashId });
  const opening = await openingBalance(cashId, b, from);
  const jama = round2(accounts.reduce((s, a) => s + num(a.jama), 0));
  const nave = round2(accounts.reduce((s, a) => s + num(a.nave), 0));
  const modes = await query(`SELECT IF(t.txn_type IN ('DISBURSE','TOPUP'), 'PAID', 'RECEIVED') dir, p.mode, SUM(p.amount) amount
      FROM transaction_payments p JOIN loan_transactions t ON t.id = p.transaction_id
     WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t GROUP BY dir, p.mode`, { b, f: from, t: to });
  const count = req.branchId ? await queryOne('SELECT * FROM cash_denominations WHERE branch_id = :b AND count_date = :d', { b: req.branchId, d: to }) : null;
  const closed = req.branchId ? await lastClosedDate(req.branchId) : null;
  const online = (dir) => round2(modes.filter((m) => m.dir === dir && m.mode !== 'CASH').reduce((s, m) => s + num(m.amount), 0));
  res.json({ data: {
    from, to, accounts, opening, jama, nave, closing: round2(opening + jama - nave), modes,
    tally: { cashInDrawer: round2(opening + jama - nave), onlineReceived: online('RECEIVED'), onlinePaid: online('PAID'), counted: count ? num(count.total) : null, countDiff: count ? num(count.difference) : null },
    dayClosed: closed && !dayjs(to).isAfter(dayjs(closed)), lastClosed: closed,
  } });
});

/* ------------------------------------------------ Metal rate board (purity-wise today vs previous) */
router.get('/rate-board', permitAny(['m_rates', 'loan_new', 'dashboard']), async (req, res) => {
  const d = req.query.date || dayjs().format('YYYY-MM-DD');
  const purities = await query(`SELECT p.id purity_id, p.name, p.purity, m.id metal_id, m.code metal_code, m.name metal_name
      FROM purities p JOIN metals m ON m.id = p.metal_id WHERE p.is_active = 1 AND m.is_active = 1 ORDER BY m.id, p.purity DESC`);
  const today = await query('SELECT * FROM metal_rates WHERE rate_date = :d', { d });
  const prev = await query(`SELECT r.* FROM metal_rates r JOIN (SELECT metal_id, purity, MAX(rate_date) md FROM metal_rates WHERE rate_date < :d GROUP BY metal_id, purity) x
      ON x.metal_id = r.metal_id AND x.purity = r.purity AND x.md = r.rate_date`, { d });
  const key = (r) => `${r.metal_id}:${Number(r.purity).toFixed(2)}`;
  const tMap = Object.fromEntries(today.map((r) => [key(r), r]));
  const pMap = Object.fromEntries(prev.map((r) => [key(r), r]));
  const rows = purities.map((p) => {
    const k = key(p);
    return { ...p, today: tMap[k]?.market_rate ?? null, today_loan: tMap[k]?.loan_rate ?? null, previous: pMap[k]?.market_rate ?? null, previous_loan: pMap[k]?.loan_rate ?? null, previous_date: pMap[k]?.rate_date ?? null };
  });
  const history = await query(`SELECT rate_date, metal_id, MAX(market_rate) top_rate FROM metal_rates WHERE rate_date >= DATE_SUB(:d, INTERVAL 30 DAY) AND rate_date <= :d
      GROUP BY rate_date, metal_id ORDER BY rate_date DESC`, { d });
  res.json({ data: { date: d, rows, history, isSet: today.length > 0 } });
});

router.post('/rate-board', permit('m_rates', 'add'), async (req, res) => {
  const d = req.body.date || dayjs().format('YYYY-MM-DD');
  const rows = (req.body.rows || []).filter((r) => num(r.today) > 0);
  if (!rows.length) throw ApiError.badRequest('Enter at least one rate');
  const settings = await getSettings(req.branchId || 0);
  const ltv = num(settings.LTV_SAFE_PERCENT, 75);
  await withTransaction(async (tx) => {
    for (const r of rows) {
      await tx.query(`INSERT INTO metal_rates (metal_id, rate_date, purity, market_rate, loan_rate, created_by) VALUES (:m, :d, :p, :mr, :lr, :u)
        ON DUPLICATE KEY UPDATE market_rate = :mr, loan_rate = :lr`,
      { m: r.metal_id, d, p: r.purity, mr: round2(r.today), lr: round2(r.today_loan || (num(r.today) * ltv) / 100), u: req.user.id });
    }
  });
  audit(req, 'RATE_UPDATE', 'metal_rates', d, { count: rows.length });
  res.json({ ok: true });
});

/* ------------------------------------------------ Interest calculation (all open loans up to a date) */
router.get('/interest-due', permitAny(['interest_calculator', 'reports_loan']), async (req, res) => {
  const upto = req.query.upto || dayjs().format('YYYY-MM-DD');
  const where = ["l.branch_id IN (:b)", "l.status = 'OPEN'"];
  const p = { b: req.branchIds };
  if (req.query.from) { where.push('l.loan_date >= :f'); p.f = req.query.from; }
  if (req.query.to) { where.push('l.loan_date <= :t'); p.t = req.query.to; }
  if (req.query.loan_on) { where.push('l.loan_on = :lo'); p.lo = req.query.loan_on; }
  if (req.query.where === 'hand') where.push('l.bank_pledge_id IS NULL');
  if (req.query.where === 'bank') where.push('l.bank_pledge_id IS NOT NULL');
  if (num(req.query.older)) { where.push('l.loan_date <= DATE_SUB(:u, INTERVAL :om MONTH)'); p.om = num(req.query.older); }
  if (req.query.search) { where.push('(l.bill_no LIKE :s OR c.name LIKE :s OR c.phone LIKE :s)'); p.s = `%${req.query.search}%`; }
  p.u = upto;
  const loans = await query(`SELECT l.*, c.name customer_name, c.phone customer_phone FROM loans l JOIN customers c ON c.id = l.customer_id WHERE ${where.join(' AND ')} ORDER BY l.loan_date LIMIT 3000`, p);
  const rows = await withCalc(loans, upto, req.branchId);
  const sum = (k) => round2(rows.reduce((s, r) => s + num(r[k]), 0));
  const avgAge = rows.length ? round2(rows.reduce((s, r) => s + r.months, 0) / rows.length) : 0;
  res.json({ data: { rows, summary: { open: rows.length, over12: rows.filter((r) => r.months > 12).length, loanDue: sum('loan_due'), partPaid: sum('part_paid'), interestDue: sum('interest_due'), totalDue: sum('total_due'), avgAge } } });
});

const withCalc = async (loans, asOn, branchId) => {
  if (!loans.length) return [];
  const ids = loans.map((l) => l.id);
  const [txns, schemes, settings] = await Promise.all([
    query('SELECT * FROM loan_transactions WHERE loan_id IN (:ids) AND is_void = 0 ORDER BY txn_date, id', { ids }),
    query('SELECT * FROM schemes'), getSettings(branchId || 0),
  ]);
  const sMap = Object.fromEntries(schemes.map((s) => [s.id, s]));
  const tMap = {};
  for (const t of txns) (tMap[t.loan_id] ||= []).push(t);
  const opts = calcOptions(settings);
  return loans.map((l) => {
    const t = tMap[l.id] || [];
    const c = calculateInterest({ loan: l, scheme: sMap[l.scheme_id], txns: t, asOf: asOn, options: opts });
    const partPaid = round2(t.filter((x) => x.txn_type === 'PART_PAYMENT').reduce((s, x) => s - num(x.principal_amount), 0));
    return {
      id: l.id, bill_no: l.bill_no, loan_date: l.loan_date, customer_name: l.customer_name, customer_phone: l.customer_phone, loan_on: l.loan_on, item_summary: l.item_summary,
      total_items: l.total_items, net_wt: l.net_wt, gross_wt: l.gross_wt, stone_wt: l.stone_wt, principal: l.principal, interest_rate: l.interest_rate, rate_type: l.rate_type,
      interest_type: l.interest_type, bank: !!l.bank_pledge_id, months: round2(c.elapsedDays / 30), days: c.elapsedDays, part_paid: partPaid, loan_due: c.principalOutstanding,
      total_interest: c.totalInterest, advance: num(l.advance_interest), paid_earlier: round2(c.interestPaid - num(l.advance_interest)), interest_due: round2(c.interestDue + c.penalDue), total_due: c.totalPayable,
      months_paid: c.monthsPaid, months_due: c.monthsDue,
    };
  });
};

/* ------------------------------------------------ Current stock (as on a date) */
router.get('/stock', permitAny(['stock', 'reports_loan']), async (req, res) => {
  const asOn = req.query.asOn || dayjs().format('YYYY-MM-DD');
  const where = ['l.branch_id IN (:b)', 'l.loan_date <= :d', "l.status <> 'CANCELLED'", "(l.status = 'OPEN' OR l.close_date > :d)"];
  const p = { b: req.branchIds, d: asOn };
  if (req.query.loan_on) { where.push('l.loan_on = :lo'); p.lo = req.query.loan_on; }
  if (req.query.where === 'hand') where.push('l.bank_pledge_id IS NULL');
  if (req.query.where === 'bank') where.push('l.bank_pledge_id IS NOT NULL');
  if (num(req.query.older)) { where.push('l.loan_date <= DATE_SUB(:d, INTERVAL :om MONTH)'); p.om = num(req.query.older); }
  if (req.query.amount_from) { where.push('l.principal >= :af'); p.af = num(req.query.amount_from); }
  if (req.query.amount_to) { where.push('l.principal <= :at'); p.at = num(req.query.amount_to); }
  if (req.query.search) { where.push('(l.bill_no LIKE :s OR c.name LIKE :s)'); p.s = `%${req.query.search}%`; }
  const rows = await query(`SELECT l.id, l.bill_no, l.loan_date, TIMESTAMPDIFF(MONTH, l.loan_date, :d) age_months, c.name customer_name, l.item_summary, l.total_items, l.loan_on,
      l.gross_wt, l.stone_wt, l.net_wt, l.avg_purity, l.principal, l.current_principal, l.bank_pledge_id
    FROM loans l JOIN customers c ON c.id = l.customer_id WHERE ${where.join(' AND ')} ORDER BY l.loan_date LIMIT 5000`, p);
  const settings = await getSettings(req.branchId || 0);
  const margin = num(settings.STOCK_RISK_MARGIN, 10);
  const rates = await query(`SELECT m.code, r.market_rate, r.purity FROM metal_rates r JOIN metals m ON m.id = r.metal_id
    WHERE r.rate_date = (SELECT MAX(rate_date) FROM metal_rates y WHERE y.metal_id = r.metal_id)`);
  const best = (code) => rates.filter((r) => r.code === code).sort((a2, b2) => Math.abs(b2.purity - 91.6) - Math.abs(a2.purity - 91.6)).pop();
  const gold = best('GOLD'); const silver = best('SILVER');
  const out = rows.map((r) => {
    const rate = r.loan_on === 'SILVER' ? silver : gold;
    const valueNow = rate ? round2(num(r.net_wt) * num(rate.market_rate) * ((num(r.avg_purity) || 91.6) / num(rate.purity || 91.6))) : 0;
    const marginPct = valueNow ? round2(((valueNow - num(r.current_principal)) / valueNow) * 100) : null;
    return { ...r, where: r.bank_pledge_id ? 'Bank' : 'Hand', part_paid: Math.max(0, round2(num(r.principal) - num(r.current_principal))), value_now: valueNow, margin_pct: marginPct, at_risk: marginPct != null && marginPct < margin };
  });
  res.json({ data: out });
});

/* ------------------------------------------------ Ledger balances (account master) */
router.get('/ledger-balances', permitAny(['acc_ledgers', 'acc_ledger_report', 'acc_voucher']), async (req, res) => {
  const rows = await query(`SELECT l.id, l.code, l.name, l.system_key, l.is_system, l.is_active, l.branch_id, g.id group_id, g.name group_name, g.nature,
      COALESCE((SELECT SUM(o.amount) FROM ledger_openings o WHERE o.ledger_id = l.id AND o.branch_id IN (:b)), 0) opening,
      COALESCE((SELECT SUM(e.debit - e.credit) FROM voucher_entries e WHERE e.ledger_id = l.id AND e.branch_id IN (:b)), 0) movement
    FROM ledgers l JOIN ledger_groups g ON g.id = l.group_id WHERE l.branch_id IS NULL OR l.branch_id IN (:b) ORDER BY l.id`, { b: req.branchIds });
  const cash = await query('SELECT COALESCE(SUM(opening_cash),0) c FROM branches WHERE id IN (:b)', { b: req.branchIds });
  res.json({ data: rows.map((r) => {
    let bal = num(r.opening) + num(r.movement);
    if (r.system_key === 'CASH') bal += num(cash[0].c);
    if (r.system_key === 'CAPITAL') bal -= num(cash[0].c);
    return { ...r, balance: round2(bal) };
  }) });
});

/* ------------------------------------------------ Register tiles: audit, SMS, employees */
router.get('/audit-tiles', permit('s_audit', 'view'), async (req, res) => {
  const p = { b: req.branchIds, f: req.query.from || dayjs().format('YYYY-MM-DD'), t: req.query.to || dayjs().format('YYYY-MM-DD') };
  const row = await queryOne(`SELECT COUNT(*) entries, SUM(action = 'LOGIN') logins, COUNT(DISTINCT IF(action = 'LOGIN', user_id, NULL)) users,
      SUM(action IN ('UPDATE','EDIT','PERMISSIONS')) edits, SUM(action IN ('DELETE','CANCEL','VOID_RECEIPT','DISABLE','START_FRESH')) deletes,
      SUM(entity IN ('settings','metal_rates','roles') AND action <> 'LOGIN') settings_changed
    FROM audit_logs WHERE (branch_id IS NULL OR branch_id IN (:b)) AND created_at >= :f AND created_at < DATE_ADD(:t, INTERVAL 1 DAY)`, p);
  res.json({ data: row });
});

router.get('/sms-tiles', permit('s_messages', 'view'), async (req, res) => {
  const row = await queryOne(`SELECT SUM(status = 'PENDING') pending, SUM(status = 'SENT' AND DATE(sent_at) = CURDATE()) sent_today, SUM(status = 'FAILED') failed,
      SUM(status = 'SENT' AND DATE_FORMAT(sent_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) this_month FROM message_queue WHERE branch_id IN (:b)`, { b: req.branchIds });
  res.json({ data: row });
});

router.get('/employee-tiles', permit('employees', 'view'), async (req, res) => {
  const row = await queryOne(`SELECT COUNT(*) total, SUM(status = 'ACTIVE') working, SUM(status = 'LEFT') left_count,
      (SELECT COUNT(*) FROM users u WHERE u.employee_id IN (SELECT id FROM employees WHERE branch_id IN (:b))) with_login
    FROM employees WHERE branch_id IN (:b)`, { b: req.branchIds });
  res.json({ data: row });
});

/* ------------------------------------------------ Year end checks */
router.get('/year-end-checks', permit('s_year_end', 'view'), async (req, res) => {
  const fy = await queryOne('SELECT * FROM financial_years WHERE is_current = 1');
  const b = req.branchIds;
  const p = { b, s: fy.start_date, e: fy.end_date };
  const [given, released, pending, monthly, notClosed] = await Promise.all([
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(principal),0) a FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND loan_date BETWEEN :s AND :e", p),
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(ABS(principal_amount)),0) a FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_type = 'RELEASE' AND txn_date BETWEEN :s AND :e", p),
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) a, SUM(bank_pledge_id IS NOT NULL) bank FROM loans WHERE branch_id IN (:b) AND status = 'OPEN'", p),
    query(`SELECT DATE_FORMAT(loan_date, '%Y-%m') m, SUM(principal) given FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND loan_date BETWEEN :s AND :e GROUP BY m ORDER BY m`, p),
    query('SELECT b.name, (SELECT MAX(close_date) FROM day_closes d WHERE d.branch_id = b.id) last_close FROM branches b WHERE b.id IN (:b)', p),
  ]);
  const checks = [
    { ok: dayjs().isAfter(dayjs(fy.end_date)), text: 'Billing date is past the year end', detail: `Today ${dayjs().format('DD/MM/YYYY')} · year ends ${dayjs(fy.end_date).format('DD/MM/YYYY')}` },
    ...notClosed.map((x) => ({ ok: x.last_close && !dayjs(x.last_close).isBefore(dayjs(fy.end_date)), warn: true, text: `Day End up to year end · ${x.name}`, detail: x.last_close ? `Last day closed ${dayjs(x.last_close).format('DD/MM/YYYY')}` : 'No Day End record' })),
    { ok: true, text: 'Backup available', detail: 'Download a backup from Settings → Backup before closing' },
  ];
  res.json({ data: { fy, given, released, pending, monthly, checks } });
});

/* ------------------------------------------------ Billing date (desktop: working date moves on at Day End) */
router.get('/billing-date', async (req, res) => {
  const t = dayjs().format('YYYY-MM-DD');
  if (!req.branchId) return res.json({ data: { billingDate: t, behind: false } });
  const last = await lastClosedDate(req.branchId);
  const firstEntry = (await queryOne('SELECT MIN(txn_date) d FROM loan_transactions WHERE branch_id = :b AND is_void = 0', { b: req.branchId }))?.d;
  let billing = last ? dayjs(last).add(1, 'day').format('YYYY-MM-DD') : (firstEntry || t);
  if (dayjs(billing).isAfter(dayjs(t))) billing = t;
  res.json({ data: { billingDate: billing, lastClosed: last, behind: dayjs(billing).isBefore(dayjs(t), 'day') } });
});

/* ------------------------------------------------ Bill book check: gaps in loan numbers / bill book numbers */
router.get('/bill-book-check', permitAny(['loan_list', 's_system']), requireBranch, async (req, res) => {
  const fy = await queryOne('SELECT * FROM financial_years WHERE is_current = 1');
  const loans = await query('SELECT id, loan_no, bill_no, manual_bill_no, loan_date, status, entry_type FROM loans WHERE branch_id = :b AND fy_id = :f ORDER BY loan_no', { b: req.branchId, f: fy.id });
  const gaps = (nums) => { const out = []; for (let i = 1; i < nums.length; i++) for (let k = nums[i - 1] + 1; k < nums[i] && out.length < 500; k++) out.push(k); return out; };
  const loanNos = loans.map((l) => l.loan_no);
  const books = loans.map((l) => Number(l.manual_bill_no)).filter((x) => Number.isInteger(x) && x > 0).sort((a2, b2) => a2 - b2);
  const byBook = {};
  for (const l of loans) if (l.manual_bill_no) (byBook[l.manual_bill_no] ||= []).push(l.bill_no);
  const dupBook = Object.entries(byBook).filter(([, v]) => v.length > 1).map(([k, v]) => ({ bill_book_no: k, loans: v.join(', ') }));
  res.json({ data: {
    fy: fy.name, total: loans.length, first: loanNos[0] || null, last: loanNos.at(-1) || null,
    missingLoanNos: gaps(loanNos), missingBillBook: gaps(books), duplicateBillBook: dupBook,
    cancelled: loans.filter((l) => l.status === 'CANCELLED').map((l) => ({ bill_no: l.bill_no, loan_date: l.loan_date })),
  } });
});

/* ------------------------------------------------ Stock correction: note against a packet after stock check */
router.put('/stock-note/:loanId', permit('stock', 'edit'), requireBranch, async (req, res) => {
  const d = req.body.date || dayjs().format('YYYY-MM-DD');
  const loan = await queryOne('SELECT id, branch_id, bill_no FROM loans WHERE id = :id', { id: req.params.loanId });
  if (!loan) throw ApiError.notFound();
  assertBranch(req, loan.branch_id);
  await query(`INSERT INTO stock_checks (branch_id, check_date, loan_id, remarks, checked_by) VALUES (:b, :d, :l, :r, :u)
    ON DUPLICATE KEY UPDATE remarks = :r`, { b: req.branchId, d, l: loan.id, r: String(req.body.remarks || '').slice(0, 150), u: req.user.id });
  audit(req, 'STOCK_CORRECTION', 'loans', loan.id, { remarks: req.body.remarks });
  res.json({ ok: true });
});

router.get('/stock-notes', permit('stock', 'view'), async (req, res) => {
  res.json({ data: await query(`SELECT s.*, l.bill_no, l.status, c.name customer_name, u.full_name checked_by_name FROM stock_checks s JOIN loans l ON l.id = s.loan_id
    JOIN customers c ON c.id = l.customer_id LEFT JOIN users u ON u.id = s.checked_by WHERE s.branch_id IN (:b) AND s.remarks IS NOT NULL AND s.remarks <> '' ORDER BY s.check_date DESC LIMIT 300`, { b: req.branchIds }) });
});

/* ------------------------------------------------ Documents (customers / employees / loans) */
const OWNER = { customer: 'CUSTOMER', employee: 'EMPLOYEE', loan: 'LOAN' };
router.get('/documents/:owner/:id', async (req, res) => {
  const t = OWNER[req.params.owner];
  if (!t) throw ApiError.badRequest('Bad owner');
  res.json({ data: await query(`SELECT d.*, u.full_name by_name FROM documents d LEFT JOIN users u ON u.id = d.created_by
    WHERE d.owner_type = :t AND d.owner_id = :id AND d.branch_id IN (:b) ORDER BY d.id DESC`, { t, id: req.params.id, b: req.branchIds }) });
});
router.post('/documents/:owner/:id', requireBranch, upload.single('file'), async (req, res) => {
  const t = OWNER[req.params.owner];
  if (!t || !req.file) throw ApiError.badRequest('Choose a file');
  const r = await query('INSERT INTO documents (branch_id, owner_type, owner_id, doc_type, file_path, remarks, created_by) VALUES (:b, :t, :o, :dt, :p, :r, :u)',
    { b: req.branchId, t, o: req.params.id, dt: req.body.doc_type || 'Document', p: publicPath(req.file), r: req.body.remarks || null, u: req.user.id });
  audit(req, 'UPLOAD', 'documents', r.insertId, { owner: t, id: req.params.id });
  res.status(201).json({ ok: true });
});
router.delete('/documents/:docId', async (req, res) => {
  const d = await queryOne('SELECT * FROM documents WHERE id = :id', { id: req.params.docId });
  if (!d) throw ApiError.notFound();
  assertBranch(req, d.branch_id);
  await query('DELETE FROM documents WHERE id = :id', { id: d.id });
  audit(req, 'DELETE', 'documents', d.id);
  res.json({ ok: true });
});

/* ------------------------------------------------ Background image */
router.post('/background', permit('s_company', 'edit'), upload.single('file'), async (req, res) => {
  const path = req.file ? publicPath(req.file) : '';
  await saveSettings({ BACKGROUND_IMAGE: path }, 0);
  audit(req, 'UPDATE', 'settings', 0, { BACKGROUND_IMAGE: path });
  res.json({ data: { path } });
});

/* ------------------------------------------------ Advisory: things to act on today */
router.get('/advisory', async (req, res) => {
  const b = req.branchIds;
  const settings = await getSettings(req.branchId || 0);
  const t = dayjs().format('YYYY-MM-DD');
  const months = num(settings.AUCTION_OVERDUE_MONTHS, 12);
  const [overdue, old, dueSoon, rate, counted, closedUpTo, topCustomers, idleBank, stock, g] = await Promise.all([
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) a FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date < :t", { b, t }),
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) a FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND loan_date < DATE_SUB(:t, INTERVAL :m MONTH)", { b, t, m: months }),
    queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date BETWEEN :t AND DATE_ADD(:t, INTERVAL 7 DAY)", { b, t }),
    queryOne('SELECT COUNT(*) c FROM metal_rates WHERE rate_date = :t', { t }),
    req.branchId ? queryOne('SELECT COUNT(*) c FROM cash_denominations WHERE branch_id = :b AND count_date = DATE_SUB(:t, INTERVAL 1 DAY)', { b: req.branchId, t }) : Promise.resolve({ c: 1 }),
    req.branchId ? lastClosedDate(req.branchId) : Promise.resolve(null),
    query(`SELECT c.name, COUNT(*) loans, SUM(l.current_principal) amount FROM loans l JOIN customers c ON c.id = l.customer_id
      WHERE l.branch_id IN (:b) AND l.status = 'OPEN' GROUP BY c.id ORDER BY amount DESC LIMIT 5`, { b }),
    queryOne("SELECT COUNT(*) c FROM bank_pledges WHERE branch_id IN (:b) AND status = 'OPEN' AND pledge_date < DATE_SUB(:t, INTERVAL 6 MONTH)", { b, t }),
    query("SELECT net_wt, current_principal, avg_purity FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND loan_on <> 'SILVER'", { b }),
    queryOne("SELECT r.market_rate, r.purity FROM metal_rates r JOIN metals m ON m.id = r.metal_id WHERE m.code = 'GOLD' ORDER BY r.rate_date DESC, ABS(r.purity - 91.6) LIMIT 1"),
  ]);
  const margin = num(settings.STOCK_RISK_MARGIN, 10);
  const atRisk = g ? stock.filter((l) => {
    const v = num(l.net_wt) * num(g.market_rate) * ((num(l.avg_purity) || 91.6) / num(g.purity || 91.6));
    return v && ((v - num(l.current_principal)) / v) * 100 < margin;
  }).length : 0;
  const items = [];
  if (!rate.c) items.push({ level: 'high', title: "Enter today's gold / silver rate", text: 'New loans are blocked until the rate is entered.', link: '/masters/rates' });
  if (closedUpTo && dayjs(t).diff(dayjs(closedUpTo), 'day') > 1) items.push({ level: 'high', title: 'Day End pending', text: `Books are closed only up to ${dayjs(closedUpTo).format('DD/MM/YYYY')}.`, link: '/accounts/day-report' });
  if (!counted.c) items.push({ level: 'medium', title: "Yesterday's cash was not counted", text: 'Count the drawer before closing the day.', link: '/accounts/denomination' });
  if (overdue.c) items.push({ level: 'high', title: `${overdue.c} loans are past due date`, text: `Rs ${round2(overdue.a)} outstanding. Send notices or call customers.`, link: '/auction' });
  if (old.c) items.push({ level: 'medium', title: `${old.c} loans older than ${months} months`, text: `Rs ${round2(old.a)} - candidates for auction release.`, link: '/auction?tab=release' });
  if (atRisk) items.push({ level: 'high', title: `${atRisk} loans have less than ${margin}% margin`, text: 'Gold value is close to the loan amount. Ask for part payment.', link: '/stock/current' });
  if (dueSoon.c) items.push({ level: 'low', title: `${dueSoon.c} loans mature in the next 7 days`, text: 'Remind customers to pay interest or renew.', link: '/reports?key=maturity' });
  if (idleBank.c) items.push({ level: 'low', title: `${idleBank.c} bank pledges older than 6 months`, text: 'Check bank interest and release where possible.', link: '/bank/pledges' });
  res.json({ data: { items, topCustomers } });
});

/* ------------------------------------------------ Employee salary history */
router.get('/employee/:id/history', permitAny(['salary', 'employees']), async (req, res) => {
  const emp = await queryOne('SELECT id, branch_id FROM employees WHERE id = :id', { id: req.params.id });
  if (!emp) throw ApiError.notFound();
  assertBranch(req, emp.branch_id);
  const salary = await query('SELECT pay_month, working_days, present_days, basic, allowances, deductions, advance_recovery, net_pay, paid_date, payment_mode, remarks FROM salary_payments WHERE employee_id = :e ORDER BY pay_month DESC LIMIT 60', { e: emp.id });
  res.json({ data: { salary, totalPaid: round2(salary.reduce((t, r) => t + num(r.net_pay), 0)) } });
});

export default router;
