import { Router } from 'express';
import dayjs from 'dayjs';
import { query } from '#config/db.js';
import { permitAny } from '#middleware/auth.js';
import { round2, num } from '#utils/money.js';

/**
 * Report screens of the desktop Reports menu: Loan, Release, Release in Details, Part Payment,
 * Loan & Release Summary and Loan & Release Comparison. All honour branch scope.
 */
const router = Router();
const range = (q) => ({ f: q.from || dayjs().format('YYYY-MM-DD'), t: q.to || dayjs().format('YYYY-MM-DD') });
const metalSql = (q, p, col = 'l.loan_on') => { if (!q.metal) return ''; p.metal = q.metal; return ` AND ${col} = :metal`; };
const searchSql = (q, p) => { if (!q.search) return ''; p.s = `%${q.search}%`; return ' AND (l.bill_no LIKE :s OR l.manual_bill_no LIKE :s OR c.name LIKE :s OR c.phone LIKE :s OR l.item_summary LIKE :s)'; };
const modes = `(SELECT GROUP_CONCAT(DISTINCT p.mode) FROM transaction_payments p WHERE p.transaction_id = t.id)`;
const cashPart = `(SELECT COALESCE(SUM(p.amount),0) FROM transaction_payments p WHERE p.transaction_id = t.id AND p.mode = 'CASH')`;
const rep = permitAny(['reports_loan', 'reports_release', 'reports_collection', 'reports_summary']);

/* Loan Report: loans given between dates with their status today */
router.get('/loans', rep, async (req, res) => {
  const q = req.query; const p = { b: req.branchIds, ...range(q) };
  let w = 'l.branch_id IN (:b) AND l.loan_date BETWEEN :f AND :t AND l.status <> \'CANCELLED\'' + metalSql(q, p) + searchSql(q, p);
  if (q.status === 'OPEN') w += " AND l.status = 'OPEN' AND l.bank_pledge_id IS NULL";
  if (q.status === 'RELEASED') w += " AND l.status IN ('CLOSED','RENEWED')";
  if (q.status === 'AUCTION') w += " AND l.status = 'AUCTIONED'";
  if (q.status === 'BANK') w += " AND l.status = 'OPEN' AND l.bank_pledge_id IS NOT NULL";
  const rows = await query(`SELECT l.id, l.bill_no, l.manual_bill_no, l.loan_date, l.loan_on, l.item_summary, l.gross_wt, l.stone_wt, l.net_wt, l.principal, l.advance_interest, l.doc_charges, l.other_charges,
      l.status, l.bank_pledge_id, l.entry_type, c.name customer_name, c.relation_type, c.relation_name, c.phone customer_phone
    FROM loans l JOIN customers c ON c.id = l.customer_id WHERE ${w} ORDER BY l.loan_date, l.loan_no`, p);
  res.json({ data: rows.map((r) => ({ ...r, status_today: r.status === 'OPEN' ? (r.bank_pledge_id ? 'BANK' : 'OPEN') : r.status === 'AUCTIONED' ? 'AUCTION' : r.status === 'CANCELLED' ? 'CANCELLED' : 'RELEASED' })) });
});

/* Release Report + Release Report in Details: releases between dates with the interest breakdown */
router.get('/releases', rep, async (req, res) => {
  const q = req.query; const p = { b: req.branchIds, ...range(q) };
  const w = "t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'RELEASE' AND t.txn_date BETWEEN :f AND :t" + metalSql(q, p) + searchSql(q, p);
  const rows = await query(`SELECT t.id txn_id, t.txn_date, t.principal_amount, t.interest_amount, t.penal_amount, t.charges, t.discount, t.total_amount, t.months_paid, ${modes} paid_by, ${cashPart} cash_amount,
      l.id, l.bill_no, l.manual_bill_no, l.release_no, l.loan_date, l.loan_on, l.item_summary, l.net_wt, l.principal, l.interest_rate, l.rate_type, l.advance_interest, l.status,
      c.name customer_name, c.relation_type, c.relation_name, c.phone customer_phone,
      (SELECT COALESCE(SUM(-x.principal_amount),0) FROM loan_transactions x WHERE x.loan_id = l.id AND x.is_void = 0 AND x.txn_type = 'PART_PAYMENT' AND x.id < t.id) part_paid,
      (SELECT COALESCE(SUM(x.interest_amount),0) FROM loan_transactions x WHERE x.loan_id = l.id AND x.is_void = 0 AND x.txn_type IN ('INTEREST','PART_PAYMENT') AND x.id < t.id) interest_earlier,
      (SELECT COALESCE(SUM(x.principal_amount),0) FROM loan_transactions x WHERE x.loan_id = l.id AND x.is_void = 0 AND x.txn_type IN ('DISBURSE','TOPUP')) loan_amount
    FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id WHERE ${w} ORDER BY t.txn_date, t.id`, p);
  let out = rows.map((r) => {
    const days = Math.max(1, dayjs(r.txn_date).diff(dayjs(r.loan_date), 'day'));
    const amt = num(r.loan_amount) || num(r.principal);
    const interestTotal = round2(num(r.interest_amount) + num(r.penal_amount) + num(r.advance_interest) + num(r.interest_earlier));
    const pm = amt ? round2((interestTotal / amt / days) * 30 * 100) : 0;
    const online = round2(num(r.total_amount) - num(r.cash_amount));
    return { ...r, days, loan_amt: amt, principal_back: round2(-num(r.principal_amount)), interest_received: round2(num(r.interest_amount) + num(r.penal_amount)), total_interest: interestTotal,
      due_at_release: round2(num(r.interest_amount) + num(r.penal_amount) + num(r.discount)), pct_month: pm, pct_year: round2(pm * 12), online_amount: online, paid_by: r.paid_by || 'CASH' };
  });
  if (q.paid === 'cash') out = out.filter((r) => num(r.online_amount) === 0);
  if (q.paid === 'online') out = out.filter((r) => num(r.online_amount) > 0);
  if (q.show === 'part') out = out.filter((r) => num(r.part_paid) > 0);
  if (q.show === 'discount') out = out.filter((r) => num(r.discount) > 0);
  res.json({ data: out });
});

/* Part Payment Report: interest and part amount received before release */
router.get('/part-payments', rep, async (req, res) => {
  const q = req.query; const p = { b: req.branchIds, ...range(q) };
  let w = "t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type IN ('INTEREST','PART_PAYMENT') AND t.txn_date BETWEEN :f AND :t" + metalSql(q, p) + searchSql(q, p);
  if (q.type === 'principal') w += ' AND t.principal_amount < 0';
  if (q.type === 'interest') w += ' AND t.interest_amount > 0';
  const rows = await query(`SELECT t.id txn_id, t.txn_date, t.txn_type, t.principal_amount, t.interest_amount, t.penal_amount, t.total_amount, t.months_paid, ${modes} paid_by, ${cashPart} cash_amount,
      l.id, l.bill_no, l.loan_date, l.loan_on, l.item_summary, l.principal, l.current_principal, l.status, c.name customer_name, c.relation_type, c.relation_name
    FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id WHERE ${w} ORDER BY t.txn_date, t.id`, p);
  res.json({ data: rows.map((r) => ({ ...r, part_amount: round2(-num(r.principal_amount)), interest: round2(num(r.interest_amount) + num(r.penal_amount)),
    type: num(r.principal_amount) < 0 && num(r.interest_amount) > 0 ? 'Loan amount + interest' : num(r.principal_amount) < 0 ? 'Loan amount' : 'Interest', paid_by: r.paid_by || 'CASH', online_amount: round2(num(r.total_amount) - num(r.cash_amount)) })) });
});

/* all receipts of one loan (detail panel of the Part Payment report) */
router.get('/loan-payments/:id', rep, async (req, res) => {
  res.json({ data: await query(`SELECT t.txn_date, t.txn_type, t.principal_amount, t.interest_amount, t.total_amount, t.months_paid FROM loan_transactions t
    WHERE t.loan_id = :id AND t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type IN ('INTEREST','PART_PAYMENT') ORDER BY t.txn_date, t.id`, { id: req.params.id, b: req.branchIds }) });
});

/* principal movement per period (month-wise for a year, or day-wise for a month) */
const movement = async (b, f, t, unit) => {
  const fmt = unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const p = { b, f, t };
  const [given, closed, parts, opening] = await Promise.all([
    query(`SELECT DATE_FORMAT(l.loan_date, '${fmt}') k, l.loan_on, COUNT(*) c, SUM(l.principal) a FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.loan_date BETWEEN :f AND :t GROUP BY k, l.loan_on`, p),
    query(`SELECT DATE_FORMAT(t.txn_date, '${fmt}') k, t.txn_type, COUNT(*) c, SUM(-t.principal_amount) a FROM loan_transactions t WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type IN ('RELEASE','AUCTION') AND t.txn_date BETWEEN :f AND :t GROUP BY k, t.txn_type`, p),
    query(`SELECT DATE_FORMAT(t.txn_date, '${fmt}') k, SUM(-t.principal_amount) a, SUM(t.principal_amount) up FROM loan_transactions t WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type IN ('PART_PAYMENT','TOPUP') AND t.txn_date BETWEEN :f AND :t GROUP BY k, t.txn_type`, p),
    query(`SELECT COALESCE(SUM(x.principal_amount),0) a FROM loan_transactions x JOIN loans l ON l.id = x.loan_id WHERE x.branch_id IN (:b) AND x.is_void = 0 AND x.txn_date < :f AND l.status <> 'CANCELLED'`, p),
  ]);
  return { given, closed, parts, opening: round2(opening[0]?.a) };
};

/* Loan & Release Summary: A/c year month-wise, or one month day-wise, with the running balance */
router.get('/summary', rep, async (req, res) => {
  const q = req.query;
  const f = q.from; const t = q.to;
  const unit = q.view === 'day' ? 'day' : 'month';
  const m = await movement(req.branchIds, f, t, unit);
  const keys = [];
  for (let d = dayjs(f); !d.isAfter(dayjs(t)); d = d.add(1, unit)) keys.push(d.format(unit === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'));
  let bal = m.opening;
  const sumBy = (list, k, filter = () => true) => list.filter((x) => x.k === k && filter(x));
  const rows = keys.map((k) => {
    const g = sumBy(m.given, k); const rel = sumBy(m.closed, k, (x) => x.txn_type === 'RELEASE'); const auc = sumBy(m.closed, k, (x) => x.txn_type === 'AUCTION');
    const pp = sumBy(m.parts, k);
    const givenAmt = round2(g.reduce((s, x) => s + num(x.a), 0));
    const partPaid = round2(pp.reduce((s, x) => s + Math.max(0, num(x.a)), 0));
    const topup = round2(pp.reduce((s, x) => s + Math.max(0, num(x.up)), 0));
    const relAmt = round2(rel.reduce((s, x) => s + num(x.a), 0)); const aucAmt = round2(auc.reduce((s, x) => s + num(x.a), 0));
    bal = round2(bal + givenAmt + topup - relAmt - aucAmt - partPaid);
    return { key: k, given: givenAmt, given_count: g.reduce((s, x) => s + num(x.c), 0), released: relAmt, released_count: rel.reduce((s, x) => s + num(x.c), 0),
      auctioned: aucAmt, auctioned_count: auc.reduce((s, x) => s + num(x.c), 0), part_paid: partPaid, topup, balance: bal,
      by_metal: Object.fromEntries(['GOLD', 'SILVER', 'MIX'].map((mt) => [mt, { c: g.filter((x) => x.loan_on === mt).reduce((s, x) => s + num(x.c), 0), a: round2(g.filter((x) => x.loan_on === mt).reduce((s, x) => s + num(x.a), 0)) }])) };
  });
  const [{ outstanding }] = await query("SELECT COALESCE(SUM(current_principal),0) outstanding FROM loans WHERE branch_id IN (:b) AND status = 'OPEN'", { b: req.branchIds });
  res.json({ data: { opening: m.opening, rows, closing: bal, outstanding: round2(outstanding) } });
});

/* Loan & Release Comparison: two periods side by side */
router.get('/compare', rep, async (req, res) => {
  const q = req.query;
  const kind = (side) => (q.mode === 'release' ? 'release' : q.mode === 'mixed' ? (side === 'A' ? 'loan' : 'release') : 'loan');
  const metal = q.metal || '';
  const load = async (k, f, t) => {
    const p = { b: req.branchIds, f, t, m: metal };
    if (k === 'loan') {
      return query(`SELECT l.loan_date d, l.loan_on, l.principal a, l.net_wt w, l.customer_id,
          (SELECT MIN(x.loan_date) FROM loans x WHERE x.customer_id = l.customer_id) first_loan
        FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.loan_date BETWEEN :f AND :t ${metal ? 'AND l.loan_on = :m' : ''}`, p);
    }
    return query(`SELECT t.txn_date d, l.loan_on, -t.principal_amount a, l.net_wt w, l.customer_id, NULL first_loan FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'RELEASE' AND t.txn_date BETWEEN :f AND :t ${metal ? 'AND l.loan_on = :m' : ''}`, p);
  };
  const side = async (name, f, t) => {
    const rows = await load(kind(name), f, t);
    const days = Math.max(1, dayjs(t).diff(dayjs(f), 'day') + 1);
    const amt = round2(rows.reduce((s, r) => s + num(r.a), 0));
    const byMonth = {};
    for (const r of rows) { const k = dayjs(r.d).format('MM'); (byMonth[k] ||= { c: 0, a: 0, w: 0 }); byMonth[k].c += 1; byMonth[k].a += num(r.a); byMonth[k].w += num(r.w); }
    const size = (lo, hi) => { const x = rows.filter((r) => num(r.a) >= lo && num(r.a) < hi); return { c: x.length, a: round2(x.reduce((s, r) => s + num(r.a), 0)) }; };
    return { from: f, to: t, kind: kind(name), count: rows.length, amount: amt, average: rows.length ? round2(amt / rows.length) : 0, weight: round2(rows.reduce((s, r) => s + num(r.w), 0)),
      new_customers: rows.filter((r) => r.first_loan && dayjs(r.first_loan).isSame(dayjs(r.d), 'day')).length, per_day: round2(rows.length / days), months: byMonth,
      metal: Object.fromEntries(['GOLD', 'SILVER', 'MIX'].map((m) => { const x = rows.filter((r) => r.loan_on === m); return [m, { c: x.length, a: round2(x.reduce((s, r) => s + num(r.a), 0)) }]; })),
      size: { '< 10K': size(0, 10000), '10K - 50K': size(10000, 50000), '50K - 1L': size(50000, 100000), '> 1L': size(100000, 1e12) } };
  };
  res.json({ data: { A: await side('A', q.a_from, q.a_to), B: await side('B', q.b_from, q.b_to) } });
});

export default router;
