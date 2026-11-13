import { Router } from 'express';
import dayjs from 'dayjs';
import { workDate } from '#services/daycontrol.service.js';
import { getSettings } from '#services/settings.service.js';
import { listBackupFiles } from '#services/backup.service.js';
import { query, queryOne } from '#config/db.js';
import { permit, permitAny, can } from '#middleware/auth.js';
import { daySummary } from '#modules/accounts/accounts.service.js';

const router = Router();

router.get('/', permit('dashboard', 'view'), async (req, res) => {
  const b = req.branchIds;
  // desktop home works on the billing date (moves on at Day End, at most to tomorrow)
  const asked = req.query.date && dayjs(req.query.date).isValid() && !dayjs(req.query.date).isAfter(dayjs().add(1, 'day'), 'day') ? dayjs(req.query.date) : dayjs();
  const today = asked.format('YYYY-MM-DD');
  const monthStart = asked.startOf('month').format('YYYY-MM-DD');
  const sixMonths = dayjs().subtract(5, 'month').startOf('month').format('YYYY-MM-DD');

  const [portfolio, todaySum, monthSum, overdue, trend, metalMix, recent, dueSoon, branchWise, rates] = await Promise.all([
    queryOne(`SELECT COUNT(*) open_loans, COALESCE(SUM(current_principal),0) outstanding, COALESCE(SUM(net_wt),0) net_wt,
               COALESCE(SUM(market_value),0) market_value, COUNT(DISTINCT customer_id) active_customers
              FROM loans WHERE branch_id IN (:b) AND status = 'OPEN'`, { b }),
    daySummary(b, today),
    daySummary(b, monthStart, today),
    queryOne(`SELECT COUNT(*) cnt, COALESCE(SUM(current_principal),0) amount FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date < :t`, { b, t: today }),
    query(`SELECT m, SUM(lent) lent, SUM(collected) collected, SUM(released) released FROM (
             SELECT DATE_FORMAT(loan_date, '%Y-%m') m, SUM(principal) lent, 0 collected, 0 released FROM loans
               WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date >= :s GROUP BY 1
             UNION ALL
             SELECT DATE_FORMAT(txn_date, '%Y-%m'), 0, SUM(interest_amount + penal_amount), SUM(IF(txn_type IN ('RELEASE','PART_PAYMENT'), ABS(principal_amount), 0))
               FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_date >= :s GROUP BY 1) x GROUP BY m ORDER BY m`, { b, s: sixMonths }),
    query(`SELECT m.name metal, COUNT(*) loans, SUM(l.net_wt) net_wt, SUM(l.current_principal) amount FROM loans l JOIN metals m ON m.id = l.metal_id
             WHERE l.branch_id IN (:b) AND l.status = 'OPEN' GROUP BY m.id`, { b }),
    query(`SELECT t.id, t.txn_type, t.txn_date, t.total_amount, t.principal_amount, t.receipt_no, l.id loan_id, l.bill_no, l.manual_bill_no, c.name customer_name, t.created_at
             FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 ORDER BY t.id DESC LIMIT 10`, { b }),
    query(`SELECT l.id, l.bill_no, l.due_date, l.current_principal, c.name customer_name, c.phone FROM loans l JOIN customers c ON c.id = l.customer_id
            WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.due_date BETWEEN :t AND DATE_ADD(:t, INTERVAL 15 DAY) ORDER BY l.due_date LIMIT 10`, { b, t: today }),
    b.length > 1
      ? query(`SELECT br.id, br.name, COUNT(l.id) loans, COALESCE(SUM(l.current_principal),0) outstanding, COALESCE(SUM(l.net_wt),0) net_wt
                 FROM branches br LEFT JOIN loans l ON l.branch_id = br.id AND l.status = 'OPEN' WHERE br.id IN (:b) GROUP BY br.id ORDER BY outstanding DESC`, { b })
      : Promise.resolve([]),
    query(`SELECT r.market_rate, r.loan_rate, r.rate_date, m.name metal_name FROM metal_rates r JOIN metals m ON m.id = r.metal_id
            WHERE r.id IN (SELECT MAX(id) FROM metal_rates GROUP BY metal_id)`),
  ]);

  const ltv = portfolio.market_value ? Math.round((portfolio.outstanding / portfolio.market_value) * 10000) / 100 : 0;
  res.json({
    data: {
      portfolio: { ...portfolio, ltv }, today: todaySum, month: monthSum, overdue, trend, metalMix, recent, dueSoon, branchWise, rates,
      canSeeAccounts: can(req.user, 'acc_cashbook', 'view'),
    },
  });
});

/** Bottom status bar (like the desktop app): this month's loans / releases, unsettled > 12 months */
router.get('/status', async (req, res) => {
  const b = req.branchIds;
  const row = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD'
          AND loan_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) month_loans,
       (SELECT COUNT(*) FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_type IN ('RELEASE', 'AUCTION')
          AND txn_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) month_releases,
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND loan_date <= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)) unsettled_12m,
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN') open_loans,
       (SELECT COALESCE(SUM(principal),0) FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD'
          AND loan_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) month_lent,
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date = CURDATE()) today_loans,
       (SELECT COALESCE(SUM(principal),0) FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date = CURDATE()) today_lent,
       (SELECT COUNT(*) FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_type IN ('RELEASE', 'AUCTION') AND txn_date = CURDATE()) today_releases,
       (SELECT COALESCE(SUM(current_principal),0) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN') outstanding,
       (SELECT COALESCE(SUM(net_wt),0) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN') open_wt,
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date < CURDATE()) overdue,
       (SELECT COUNT(*) FROM message_queue WHERE branch_id IN (:b) AND status = 'PENDING') sms_pending,
       (SELECT COUNT(*) FROM message_queue WHERE branch_id IN (:b) AND status = 'FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) sms_failed`,
    { b },
  );
  res.json({ data: row });
});

/** Global search (Ctrl + K): loans + customers in the caller's branches */
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ data: { loans: [], customers: [] } });
  const b = req.branchIds;
  const like = `%${q}%`;
  const [loans, customers] = await Promise.all([
    can(req.user, 'loan_list', 'view') || can(req.user, 'loan_release', 'view')
      ? query(`SELECT l.id, l.bill_no, l.status, l.principal, l.loan_date, c.name customer_name FROM loans l JOIN customers c ON c.id = l.customer_id
                WHERE l.branch_id IN (:b) AND (l.bill_no LIKE :like OR l.barcode = :q OR l.manual_bill_no = :q OR c.name LIKE :like OR c.phone LIKE :like)
                ORDER BY (l.status = 'OPEN') DESC, l.id DESC LIMIT 8`, { b, like, q })
      : [],
    can(req.user, 'customers', 'view')
      ? query(`SELECT id, customer_no, name, phone, area, status FROM customers WHERE branch_id IN (:b) AND merged_into IS NULL
                AND (name LIKE :like OR phone LIKE :like OR id_proof_no LIKE :like OR customer_no = :n) ORDER BY name LIMIT 8`, { b, like, n: Number(q) || -1 })
      : [],
  ]);
  res.json({ data: { loans, customers } });
});

/** Notification centre: things that need attention */
router.get('/alerts', async (req, res) => {
  const b = req.branchIds;
  const [overdue, rateMissing, notClosed] = await Promise.all([
    queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND loan_date <= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)", { b }),
    queryOne('SELECT COUNT(*) c FROM metal_rates WHERE rate_date = :d', { d: await workDate(req.branchId) }),
    req.branchId ? queryOne('SELECT MAX(close_date) d FROM day_closes WHERE branch_id = :b', { b: req.branchId }) : null,
  ]);
  const alerts = [];
  if (overdue.c) alerts.push({ type: 'warning', key: 'overdue', text: `${overdue.c} loans are open for over 12 months`, link: '/auction' });
  if (!rateMissing.c) alerts.push({ type: 'info', key: 'rate', text: `Gold rate for ${dayjs(await workDate(req.branchId)).format('DD/MM/YYYY')} is not updated`, link: '/masters/rates' });
  if (notClosed && notClosed.d && dayjs().diff(dayjs(notClosed.d), 'day') > 1) {
    alerts.push({ type: 'info', key: 'dayclose', text: `Day close pending since ${dayjs(notClosed.d).add(1, 'day').format('DD/MM/YYYY')}`, link: '/accounts/day-close' });
  }
  const st = await getSettings(req.branchId || 0);
  // desktop: warn when there is no backup for this many days (BK..)
  const warnDays = Number(st.BACKUP_WARN_DAYS ?? 7);
  if (warnDays > 0) {
    const last = listBackupFiles()[0];
    const age = last ? dayjs().diff(dayjs(last.created_at), 'day') : null;
    if (age == null || age >= warnDays) alerts.push({ type: 'warning', key: 'backup', text: last ? `No backup for ${age} days` : 'No backup taken yet', link: '/settings/backup' });
  }
  // gold-rate watch: loans whose loan + interest now uses most of the metal's value at today's rate
  if (st.RATE_WATCH !== '0') {
    try {
      const t = dayjs().format('YYYY-MM-DD');
      const r = await nowRates(t);
      const w = await queryOne(`SELECT COALESCE(SUM((l.current_principal + ${RISK_ACCRUED}) >= ${RISK_VALUE} * 0.85),0) close_to,
          COALESCE(SUM((l.current_principal + ${RISK_ACCRUED}) >= ${RISK_VALUE}),0) over_value ${RISK_FROM}`, { b, t, ...r });
      if (Number(w.over_value)) alerts.push({ type: 'warning', key: 'ratewatch', text: `${w.over_value} loans are now worth less than the loan + interest at today's rate`, link: '/analytics' });
      else if (Number(w.close_to)) alerts.push({ type: 'info', key: 'ratewatch', text: `${w.close_to} loans are close to the value of their gold at today's rate`, link: '/analytics' });
    } catch { /* rates not set yet */ }
  }
  // desktop: the last year is over and not closed - remind to run Year End (YE..)
  if (st.YEAR_END_REMIND !== '0') {
    const fy = await queryOne('SELECT name, end_date, is_closed FROM financial_years WHERE is_current = 1');
    if (fy && !Number(fy.is_closed) && dayjs().isAfter(dayjs(fy.end_date), 'day')) alerts.push({ type: 'info', key: 'yearend', text: `A/c year ${fy.name} is over - run Year End Process`, link: '/settings/year-end' });
  }
  res.json({ data: alerts });
});

/* ---------------- Analytics: any date range, grouped by day / week / month, optional metal filter ---------------- */
const GROUPS = {
  day: (c) => `DATE_FORMAT(${c}, '%Y-%m-%d')`,
  week: (c) => `DATE_FORMAT(DATE_SUB(${c}, INTERVAL WEEKDAY(${c}) DAY), '%Y-%m-%d')`,
  month: (c) => `DATE_FORMAT(${c}, '%Y-%m')`,
};
const periodKeys = (from, to, group) => {
  const keys = [];
  let d = group === 'month' ? dayjs(from).startOf('month') : group === 'week' ? dayjs(from).subtract((dayjs(from).day() + 6) % 7, 'day') : dayjs(from);
  const end = dayjs(to);
  while (!d.isAfter(end) && keys.length < 400) {
    keys.push(group === 'month' ? d.format('YYYY-MM') : d.format('YYYY-MM-DD'));
    d = d.add(1, group);
  }
  return keys;
};

router.get('/analytics', permitAny(['dashboard', 'reports_summary']), async (req, res) => {
  const b = req.branchIds;
  const to = dayjs(req.query.to).isValid() ? dayjs(req.query.to) : dayjs();
  const from = dayjs(req.query.from).isValid() ? dayjs(req.query.from) : to.startOf('month');
  const span = Math.max(0, to.diff(from, 'day'));
  const group = GROUPS[req.query.group] ? req.query.group : span > 120 ? 'month' : span > 31 ? 'week' : 'day';
  const metal = ['GOLD', 'SILVER', 'MIX'].includes(req.query.metal) ? req.query.metal : '';
  const p = { b, f: from.format('YYYY-MM-DD'), t: to.format('YYYY-MM-DD'), metal };
  const pf = from.subtract(span + 1, 'day').format('YYYY-MM-DD');
  const pt = from.subtract(1, 'day').format('YYYY-MM-DD');
  const mf = "AND (:metal = '' OR l.loan_on = :metal)";
  const gl = GROUPS[group]('l.loan_date');
  const gt = GROUPS[group]('t.txn_date');

  // totals for a date range (this period and the one before it)
  const totals = async (f, t) => {
    const [lo, tx] = await Promise.all([
      queryOne(`SELECT COUNT(*) cnt, COALESCE(SUM(principal),0) lent, COALESCE(SUM(advance_interest),0) adv, COALESCE(AVG(principal),0) avg_loan,
                  COALESCE(AVG(interest_rate),0) avg_rate, COUNT(DISTINCT customer_id) customers, COALESCE(SUM(net_wt),0) net_wt
                FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}`, { ...p, f, t }),
      queryOne(`SELECT COALESCE(SUM(t.interest_amount + t.penal_amount),0) interest,
                  COALESCE(SUM(IF(t.txn_type IN ('RELEASE','PART_PAYMENT'), ABS(t.principal_amount), 0)),0) recovered,
                  COALESCE(SUM(t.txn_type = 'RELEASE'),0) releases
                FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
                WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf}`, { ...p, f, t }),
    ]);
    return { ...lo, ...tx, interest: Number(tx.interest) + Number(lo.adv) };
  };

  const [cur, prev, lentRows, txnRows, ageing, sizes, byMetal, byScheme, byBranch, topCustomers] = await Promise.all([
    totals(p.f, p.t),
    totals(pf, pt),
    query(`SELECT ${gl} k, COUNT(*) loans, COALESCE(SUM(principal),0) lent, COALESCE(SUM(advance_interest),0) adv
             FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf} GROUP BY k`, p),
    query(`SELECT ${gt} k, COALESCE(SUM(t.interest_amount + t.penal_amount),0) interest,
                  COALESCE(SUM(IF(t.txn_type IN ('RELEASE','PART_PAYMENT'), ABS(t.principal_amount), 0)),0) recovered,
                  COALESCE(SUM(t.txn_type = 'RELEASE'),0) releases
             FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf} GROUP BY k`, p),
    // open loans by age (as on the end date)
    query(`SELECT CASE WHEN TIMESTAMPDIFF(MONTH, l.loan_date, :t) < 3 THEN 1 WHEN TIMESTAMPDIFF(MONTH, l.loan_date, :t) < 6 THEN 2
                       WHEN TIMESTAMPDIFF(MONTH, l.loan_date, :t) < 9 THEN 3 WHEN TIMESTAMPDIFF(MONTH, l.loan_date, :t) < 12 THEN 4 ELSE 5 END bucket,
                  COUNT(*) loans, COALESCE(SUM(l.current_principal),0) amount
             FROM loans l WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${mf} GROUP BY bucket ORDER BY bucket`, p),
    // loan sizes given in the period
    query(`SELECT CASE WHEN principal < 10000 THEN 1 WHEN principal < 25000 THEN 2 WHEN principal < 50000 THEN 3
                       WHEN principal < 100000 THEN 4 WHEN principal < 200000 THEN 5 ELSE 6 END bucket, COUNT(*) loans, COALESCE(SUM(principal),0) amount
             FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf} GROUP BY bucket ORDER BY bucket`, p),
    query(`SELECT l.loan_on metal, COUNT(*) loans, COALESCE(SUM(l.current_principal),0) outstanding, COALESCE(SUM(l.net_wt),0) net_wt
             FROM loans l WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${mf} GROUP BY l.loan_on ORDER BY outstanding DESC`, p),
    query(`SELECT COALESCE(s.name, 'No scheme') name, COUNT(*) loans, COALESCE(SUM(l.principal),0) lent
             FROM loans l LEFT JOIN schemes s ON s.id = l.scheme_id
            WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}
            GROUP BY s.id ORDER BY lent DESC LIMIT 8`, p),
    b.length > 1
      ? query(`SELECT br.name, COUNT(l.id) loans, COALESCE(SUM(l.principal),0) lent FROM branches br
                 LEFT JOIN loans l ON l.branch_id = br.id AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}
                WHERE br.id IN (:b) GROUP BY br.id ORDER BY lent DESC`, p)
      : Promise.resolve([]),
    query(`SELECT c.id, c.name, c.phone, COUNT(*) loans, COALESCE(SUM(l.current_principal),0) outstanding, COALESCE(SUM(l.net_wt),0) net_wt
             FROM loans l JOIN customers c ON c.id = l.customer_id
            WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${mf} GROUP BY c.id ORDER BY outstanding DESC LIMIT 10`, p),
  ]);

  // one row per period, gaps filled with zero
  const lm = new Map(lentRows.map((r) => [r.k, r]));
  const tm = new Map(txnRows.map((r) => [r.k, r]));
  const series = periodKeys(p.f, p.t, group).map((k) => {
    const l = lm.get(k) || {}; const t = tm.get(k) || {};
    return { k, loans: Number(l.loans || 0), lent: Number(l.lent || 0), recovered: Number(t.recovered || 0), releases: Number(t.releases || 0), interest: Number(t.interest || 0) + Number(l.adv || 0) };
  });

  res.json({ data: { from: p.f, to: p.t, prevFrom: pf, prevTo: pt, group, metal, current: cur, previous: prev, series, ageing, sizes, byMetal, byScheme, byBranch, topCustomers } });
});

/* ---------------- Analytics money flow: net lending, loan book over time, cash in / out, interest sources, modes, concessions ---------------- */
router.get('/analytics/flows', permitAny(['dashboard', 'reports_summary']), async (req, res) => {
  const b = req.branchIds;
  const to = dayjs(req.query.to).isValid() ? dayjs(req.query.to) : dayjs();
  const from = dayjs(req.query.from).isValid() ? dayjs(req.query.from) : to.startOf('month');
  const span = Math.max(0, to.diff(from, 'day'));
  const group = GROUPS[req.query.group] ? req.query.group : span > 120 ? 'month' : span > 31 ? 'week' : 'day';
  const metal = ['GOLD', 'SILVER', 'MIX'].includes(req.query.metal) ? req.query.metal : '';
  const p = { b, f: from.format('YYYY-MM-DD'), t: to.format('YYYY-MM-DD'), metal, before: from.subtract(1, 'day').format('YYYY-MM-DD') };
  const pf = from.subtract(span + 1, 'day').format('YYYY-MM-DD');
  const pt = from.subtract(1, 'day').format('YYYY-MM-DD');
  const mf = "AND (:metal = '' OR l.loan_on = :metal)";
  const gl = GROUPS[group]('l.loan_date');
  const gt = GROUPS[group]('t.txn_date');
  // loan book (outstanding) as on a date: every loan given (incl. opening entries) + top-ups - amounts paid back / auctioned
  const bookAsOn = (d) => queryOne(`SELECT
      (SELECT COALESCE(SUM(l.principal),0) FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.loan_date <= :d ${mf})
    + (SELECT COALESCE(SUM(CASE WHEN t.txn_type = 'TOPUP' THEN t.principal_amount WHEN t.txn_type IN ('RELEASE','PART_PAYMENT','AUCTION') THEN -ABS(t.principal_amount) ELSE 0 END),0)
         FROM loan_transactions t JOIN loans l ON l.id = t.loan_id WHERE t.branch_id IN (:b) AND t.is_void = 0 AND l.status <> 'CANCELLED' AND t.txn_date <= :d ${mf}) book`, { ...p, d });
  const topupsIn = (f, t) => queryOne(`SELECT COALESCE(SUM(t.principal_amount),0) amt, COUNT(*) cnt FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'TOPUP' AND t.txn_date BETWEEN :f AND :t ${mf}`, { ...p, f, t });

  const [opening, closing, topups, topupsPrev, loanRows, moveRows, sources, adv, modes, manual, reductions, discounts] = await Promise.all([
    bookAsOn(p.before),
    bookAsOn(p.t),
    topupsIn(p.f, p.t),
    topupsIn(pf, pt),
    // every loan entered (incl. opening entries dated in the period) - for the book line
    query(`SELECT ${gl} k, COALESCE(SUM(l.principal),0) amt FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.loan_date BETWEEN :f AND :t ${mf} GROUP BY k`, p),
    query(`SELECT ${gt} k,
                  COALESCE(SUM(IF(t.txn_type = 'TOPUP', t.principal_amount, 0)),0) topups,
                  COALESCE(SUM(IF(t.txn_type IN ('RELEASE','PART_PAYMENT','AUCTION'), ABS(t.principal_amount), 0)),0) back,
                  COALESCE(SUM(IF(t.txn_type = 'AUCTION', ABS(t.principal_amount), 0)),0) auctioned
             FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 AND l.status <> 'CANCELLED' AND t.txn_date BETWEEN :f AND :t ${mf} GROUP BY k`, p),
    // interest by where it came from
    query(`SELECT CASE WHEN t.txn_type = 'RELEASE' AND t.remarks = 'Renewed' THEN 'RENEW' ELSE t.txn_type END src,
                  COALESCE(SUM(t.interest_amount),0) interest, COALESCE(SUM(t.penal_amount),0) penal, COUNT(*) cnt
             FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t AND (t.interest_amount > 0 OR t.penal_amount > 0) ${mf} GROUP BY src`, p),
    queryOne(`SELECT COALESCE(SUM(l.advance_interest),0) amt, COUNT(*) cnt FROM loans l
               WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.advance_interest > 0 AND l.loan_date BETWEEN :f AND :t ${mf}`, p),
    // money received from / paid to customers by payment mode
    query(`SELECT tp.mode, CASE WHEN t.txn_type IN ('DISBURSE','TOPUP') THEN 'OUT' ELSE 'IN' END dir, COALESCE(SUM(tp.amount),0) amt, COUNT(DISTINCT t.id) cnt
             FROM transaction_payments tp JOIN loan_transactions t ON t.id = tp.transaction_id JOIN loans l ON l.id = t.loan_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf} GROUP BY tp.mode, dir`, p),
    // manual interest: receipts charged by days / at a typed rate
    queryOne(`SELECT COALESCE(SUM(t.interest_days IS NOT NULL),0) by_days, COALESCE(SUM(IF(t.interest_days IS NOT NULL, t.interest_amount, 0)),0) by_days_amt,
                     COALESCE(SUM(t.interest_rate_used IS NOT NULL),0) typed_rate, COALESCE(SUM(IF(t.interest_rate_used IS NOT NULL, t.interest_amount, 0)),0) typed_rate_amt,
                     COALESCE(SUM(t.interest_amount > 0),0) receipts
                FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
               WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf}`, p),
    // interest given up at closing (Release / Re-loan below Auto) - from the audit trail
    query(`SELECT a.details FROM audit_logs a JOIN loans l ON l.id = a.entity_id
            WHERE a.action = 'INTEREST_REDUCED' AND a.entity = 'loans' AND l.branch_id IN (:b) AND DATE(a.created_at) BETWEEN :f AND :t ${mf}`, p),
    queryOne(`SELECT COALESCE(SUM(t.discount),0) amt, COALESCE(SUM(t.discount > 0),0) cnt FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
               WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf}`, p),
  ]);

  // loan book at the end of every period (opening + running net)
  const lm = new Map(loanRows.map((r) => [r.k, Number(r.amt)]));
  const mm = new Map(moveRows.map((r) => [r.k, r]));
  let run = Number(opening.book || 0);
  const series = periodKeys(p.f, p.t, group).map((k) => {
    const m = mm.get(k) || {};
    const given = (lm.get(k) || 0) + Number(m.topups || 0);
    const back = Number(m.back || 0);
    run += given - back;
    return { k, topups: Number(m.topups || 0), auctioned: Number(m.auctioned || 0), book: Math.round(run * 100) / 100 };
  });

  let reduced = 0; let penalReduced = 0; let reducedCnt = 0;
  for (const r of reductions) {
    let dt = r.details; if (typeof dt === 'string') { try { dt = JSON.parse(dt); } catch { dt = {}; } }
    const x = Math.max(0, Number(dt?.system || 0) - Number(dt?.charged || 0));
    const y = Math.max(0, Number(dt?.penal_system || 0) - Number(dt?.penal_charged ?? dt?.penal_system ?? 0));
    if (x || y) { reduced += x; penalReduced += y; reducedCnt += 1; }
  }

  res.json({ data: {
    group, opening: Number(opening.book || 0), closing: Number(closing.book || 0), series,
    topups: { amt: Number(topups.amt), cnt: Number(topups.cnt) }, topupsPrev: { amt: Number(topupsPrev.amt), cnt: Number(topupsPrev.cnt) },
    advance: { amt: Number(adv.amt), cnt: Number(adv.cnt) },
    sources: sources.map((r) => ({ src: r.src, interest: Number(r.interest), penal: Number(r.penal), cnt: Number(r.cnt) })),
    modes: modes.map((r) => ({ mode: r.mode, dir: r.dir, amt: Number(r.amt), cnt: Number(r.cnt) })),
    manual: { byDays: Number(manual.by_days), byDaysAmt: Number(manual.by_days_amt), typedRate: Number(manual.typed_rate), typedRateAmt: Number(manual.typed_rate_amt), receipts: Number(manual.receipts) },
    concessions: { reduced: Math.round(reduced * 100) / 100, penal: Math.round(penalReduced * 100) / 100, loans: reducedCnt, discount: Number(discounts.amt), discountCnt: Number(discounts.cnt) },
  } });
});

/* ---------------- Analytics insights: risk, pending interest, behaviour (as on the end date) ---------------- */
router.get('/analytics/insights', permitAny(['dashboard', 'reports_summary']), async (req, res) => {
  const b = req.branchIds;
  const to = dayjs(req.query.to).isValid() ? dayjs(req.query.to) : dayjs();
  const from = dayjs(req.query.from).isValid() ? dayjs(req.query.from) : to.startOf('month');
  const metal = ['GOLD', 'SILVER', 'MIX'].includes(req.query.metal) ? req.query.metal : '';
  const p = { b, f: from.format('YYYY-MM-DD'), t: to.format('YYYY-MM-DD'), metal };
  const mf = "AND (:metal = '' OR l.loan_on = :metal)";

  // today's per-gram rate in the same unit loans keep (market rate x 100 / purity)
  const rates = await query(`SELECT m.code, r.market_rate * 100 / NULLIF(r.purity, 0) per_gram FROM metal_rates r JOIN metals m ON m.id = r.metal_id
    WHERE r.id IN (SELECT MAX(id) FROM metal_rates WHERE rate_date <= :t GROUP BY metal_id)`, p);
  const nowGold = Number(rates.find((r) => r.code === 'GOLD')?.per_gram || 0);
  const nowSilver = Number(rates.find((r) => r.code === 'SILVER')?.per_gram || 0);
  const q = { ...p, g: nowGold, s: nowSilver };

  // value of the pledged metal today, and interest built up since the last interest payment (monthly rate, simple - an estimate)
  const valueNow = `(CASE WHEN l.loan_on = 'SILVER' THEN IF(l.silver_rate > 0 AND :s > 0, l.market_value * :s / l.silver_rate, l.market_value)
                          ELSE IF(l.gold_rate > 0 AND :g > 0, l.market_value * :g / l.gold_rate, l.market_value) END)`;
  const accrued = `(l.current_principal * l.interest_rate / 100 * GREATEST(0, DATEDIFF(:t, COALESCE(lp.last_paid, l.loan_date))) / 30)`;
  const base = `FROM loans l LEFT JOIN (SELECT loan_id, MAX(txn_date) last_paid FROM loan_transactions WHERE is_void = 0 AND interest_amount > 0 GROUP BY loan_id) lp ON lp.loan_id = l.id
                WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.loan_date <= :t ${mf}`;

  const [book, risky, weekday, areas, goldTrend, duration, custMix] = await Promise.all([
    queryOne(`SELECT COUNT(*) loans, COALESCE(SUM(l.current_principal),0) outstanding, COALESCE(SUM(${accrued}),0) accrued,
                COALESCE(SUM(l.current_principal * l.interest_rate / 100),0) monthly_run_rate, COALESCE(SUM(${valueNow}),0) value_now,
                COALESCE(SUM(l.market_value),0) value_at_loan,
                COALESCE(SUM((l.current_principal + ${accrued}) >= ${valueNow} * 0.85),0) at_risk,
                COALESCE(SUM(IF((l.current_principal + ${accrued}) >= ${valueNow} * 0.85, l.current_principal, 0)),0) at_risk_amount,
                COALESCE(SUM((l.current_principal + ${accrued}) >= ${valueNow}),0) underwater
              ${base}`, q),
    query(`SELECT l.id, l.bill_no, c.name customer_name, c.phone, l.loan_date, l.current_principal, ${accrued} accrued, ${valueNow} value_now,
                  (l.current_principal + ${accrued}) / NULLIF(${valueNow}, 0) * 100 cover_pct
             ${base.replace('FROM loans l', 'FROM loans l JOIN customers c ON c.id = l.customer_id')}
            HAVING cover_pct >= 75 ORDER BY cover_pct DESC LIMIT 15`, q),
    query(`SELECT DAYOFWEEK(l.loan_date) dow, COUNT(*) loans, COALESCE(SUM(l.principal),0) lent FROM loans l
            WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf} GROUP BY dow`, p),
    query(`SELECT COALESCE(NULLIF(TRIM(c.area), ''), 'Not set') area, COUNT(*) loans, COALESCE(SUM(l.current_principal),0) outstanding
             FROM loans l JOIN customers c ON c.id = l.customer_id
            WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${mf} GROUP BY area ORDER BY outstanding DESC LIMIT 8`, p),
    query(`SELECT r.rate_date d, MAX(IF(m.code = 'GOLD', ROUND(r.market_rate * 100 / NULLIF(r.purity, 0), 2), NULL)) gold,
                  MAX(IF(m.code = 'SILVER', ROUND(r.market_rate * 100 / NULLIF(r.purity, 0), 2), NULL)) silver
             FROM metal_rates r JOIN metals m ON m.id = r.metal_id
            WHERE m.code IN ('GOLD', 'SILVER') AND r.rate_date BETWEEN :f AND :t GROUP BY r.rate_date ORDER BY r.rate_date`, p),
    queryOne(`SELECT COUNT(*) released, COALESCE(AVG(DATEDIFF(l.close_date, l.loan_date)),0) avg_days,
                COALESCE(SUM(l.close_date <= l.due_date),0) on_time
              FROM loans l WHERE l.branch_id IN (:b) AND l.status = 'CLOSED' AND l.close_date BETWEEN :f AND :t ${mf}`, p),
    queryOne(`SELECT COUNT(*) customers, COALESCE(SUM(fc.first_loan BETWEEN :f AND :t),0) new_customers FROM (
                SELECT DISTINCT l.customer_id FROM loans l WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}) pc
              JOIN (SELECT customer_id, MIN(loan_date) first_loan FROM loans WHERE status <> 'CANCELLED' GROUP BY customer_id) fc ON fc.customer_id = pc.customer_id`, p),
  ]);

  res.json({ data: { asOn: p.t, rates: { gold: nowGold, silver: nowSilver }, book, risky, weekday, areas, goldTrend, duration, custMix } });
});

/* ---------------- shared: open-loan risk figures (value today vs loan + interest built up) ---------------- */
const nowRates = async (t) => {
  const rates = await query(`SELECT m.code, r.market_rate * 100 / NULLIF(r.purity, 0) per_gram FROM metal_rates r JOIN metals m ON m.id = r.metal_id
    WHERE r.id IN (SELECT MAX(id) FROM metal_rates WHERE rate_date <= :t GROUP BY metal_id)`, { t });
  return { g: Number(rates.find((r) => r.code === 'GOLD')?.per_gram || 0), s: Number(rates.find((r) => r.code === 'SILVER')?.per_gram || 0) };
};
const RISK_VALUE = `(CASE WHEN l.loan_on = 'SILVER' THEN IF(l.silver_rate > 0 AND :s > 0, l.market_value * :s / l.silver_rate, l.market_value)
                          ELSE IF(l.gold_rate > 0 AND :g > 0, l.market_value * :g / l.gold_rate, l.market_value) END)`;
const RISK_ACCRUED = '(l.current_principal * l.interest_rate / 100 * GREATEST(0, DATEDIFF(:t, COALESCE(lp.last_paid, l.loan_date))) / 30)';
const RISK_FROM = `FROM loans l LEFT JOIN (SELECT loan_id, MAX(txn_date) last_paid FROM loan_transactions WHERE is_void = 0 AND interest_amount > 0 GROUP BY loan_id) lp ON lp.loan_id = l.id
                   WHERE l.branch_id IN (:b) AND l.status = 'OPEN'`;

/* ---------------- Morning briefing: one call for the first screen of the day ---------------- */
router.get('/briefing', permit('dashboard', 'view'), async (req, res) => {
  const b = req.branchIds;
  const t = dayjs().format('YYYY-MM-DD');
  const r = await nowRates(t);
  const q = { b, t, ...r };
  const [due, overdue, risk, rateToday, lastCount, failed, yesterday] = await Promise.all([
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) amt FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date BETWEEN :t AND DATE_ADD(:t, INTERVAL 7 DAY)", q),
    queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) amt FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date < :t", q),
    queryOne(`SELECT COALESCE(SUM(${RISK_ACCRUED}),0) accrued, COALESCE(SUM((l.current_principal + ${RISK_ACCRUED}) >= ${RISK_VALUE} * 0.85),0) at_risk,
                COALESCE(SUM((l.current_principal + ${RISK_ACCRUED}) >= ${RISK_VALUE}),0) underwater ${RISK_FROM}`, q),
    queryOne('SELECT COUNT(*) c FROM metal_rates WHERE rate_date = :t', q),
    queryOne('SELECT count_date, difference FROM cash_denominations WHERE branch_id IN (:b) ORDER BY count_date DESC LIMIT 1', q),
    queryOne("SELECT COUNT(*) c FROM message_queue WHERE branch_id IN (:b) AND status = 'FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)", q),
    daySummary(b, dayjs().subtract(1, 'day').format('YYYY-MM-DD')),
  ]);
  const last = listBackupFiles()[0];
  const yt = yesterday.transactions || {};
  res.json({ data: {
    date: t, dueWeek: due, overdue, risk, rateEntered: rateToday.c > 0, lastCashCount: lastCount, failedMessages: failed.c,
    backupAgeDays: last ? dayjs().diff(dayjs(last.created_at), 'day') : null,
    yesterday: { loans: yesterday.loans.cnt, lent: yesterday.loans.principal, releases: Number(yt.RELEASE?.cnt || 0) + Number(yt.AUCTION?.cnt || 0),
      interest: Number(yesterday.loans.advance_interest || 0) + Object.values(yt).reduce((x, v) => x + Number(v.interest || 0) + Number(v.penal || 0), 0), cash: yesterday.cash.closing },
  } });
});

/* ---------------- Analytics extras: forecast, best customers, branch league, cash variance, unusual activity ---------------- */
router.get('/analytics/more', permitAny(['dashboard', 'reports_summary']), async (req, res) => {
  const b = req.branchIds;
  const to = dayjs(req.query.to).isValid() ? dayjs(req.query.to) : dayjs();
  const from = dayjs(req.query.from).isValid() ? dayjs(req.query.from) : to.startOf('month');
  const metal = ['GOLD', 'SILVER', 'MIX'].includes(req.query.metal) ? req.query.metal : '';
  const p = { b, f: from.format('YYYY-MM-DD'), t: to.format('YYYY-MM-DD'), metal };
  const mf = "AND (:metal = '' OR l.loan_on = :metal)";
  const audit = can(req.user, 's_audit', 'view');

  const [forecast, dueNext, bestCustomers, league, cashVar, voids, offHours, bigLoans, sameDay] = await Promise.all([
    // the next 30 days from the end date: interest that will build up, loans reaching their settle date
    queryOne(`SELECT COALESCE(SUM(l.current_principal * l.interest_rate / 100),0) interest_month, COUNT(*) open_loans
                FROM loans l WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${mf}`, p),
    query(`SELECT DATE_FORMAT(l.due_date, '%Y-%m-%d') d, COUNT(*) loans, COALESCE(SUM(l.current_principal),0) amount FROM loans l
            WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.due_date BETWEEN DATE_ADD(:t, INTERVAL 1 DAY) AND DATE_ADD(:t, INTERVAL 30 DAY) ${mf}
            GROUP BY d ORDER BY d`, p),
    // customers who paid the most interest in the period, with how they release
    query(`SELECT c.id, c.name, c.phone, COALESCE(SUM(t.interest_amount + t.penal_amount),0) interest_paid, COUNT(DISTINCT l.id) loans,
                  COALESCE(SUM(t.txn_type = 'RELEASE'),0) releases, COALESCE(SUM(t.txn_type = 'RELEASE' AND t.txn_date <= l.due_date),0) on_time
             FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id
            WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf}
            GROUP BY c.id HAVING interest_paid > 0 ORDER BY interest_paid DESC LIMIT 10`, p),
    // branch league (only when more than one branch is visible)
    b.length > 1
      ? query(`SELECT br.id, br.name,
                  (SELECT COALESCE(SUM(l.principal),0) FROM loans l WHERE l.branch_id = br.id AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}) lent,
                  (SELECT COALESCE(SUM(t.interest_amount + t.penal_amount),0) FROM loan_transactions t JOIN loans l ON l.id = t.loan_id WHERE t.branch_id = br.id AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t ${mf}) interest,
                  (SELECT COUNT(*) FROM loans l WHERE l.branch_id = br.id AND l.status = 'OPEN' ${mf}) open_loans,
                  (SELECT COUNT(*) FROM loans l WHERE l.branch_id = br.id AND l.status = 'OPEN' AND l.due_date < :t ${mf}) overdue,
                  (SELECT COALESCE(SUM(ABS(d.difference)),0) FROM cash_denominations d WHERE d.branch_id = br.id AND d.count_date BETWEEN :f AND :t) cash_diff
                 FROM branches br WHERE br.id IN (:b) ORDER BY lent DESC`, p)
      : Promise.resolve([]),
    query(`SELECT d.count_date d, br.name branch, d.total, d.book_balance, d.difference FROM cash_denominations d JOIN branches br ON br.id = d.branch_id
            WHERE d.branch_id IN (:b) AND d.count_date BETWEEN :f AND :t ORDER BY d.count_date`, p),
    // unusual activity - read from the audit trail (only for users allowed to see it)
    audit ? query(`SELECT u.full_name, a.user_id, COUNT(*) cnt, MAX(a.created_at) last_at FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
                     WHERE (a.branch_id IN (:b) OR a.branch_id IS NULL) AND a.created_at BETWEEN :f AND DATE_ADD(:t, INTERVAL 1 DAY)
                       AND (a.action IN ('DELETE', 'VOID', 'CANCEL', 'DISABLE') OR a.action LIKE '%VOID%' OR a.action LIKE '%CANCEL%')
                     GROUP BY a.user_id ORDER BY cnt DESC LIMIT 10`, p) : Promise.resolve([]),
    audit ? query(`SELECT u.full_name, a.created_at, a.ip FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
                     WHERE a.action = 'LOGIN' AND (HOUR(a.created_at) < 7 OR HOUR(a.created_at) >= 22) AND a.created_at BETWEEN :f AND DATE_ADD(:t, INTERVAL 1 DAY)
                     ORDER BY a.created_at DESC LIMIT 10`, p) : Promise.resolve([]),
    // a loan far above what this customer usually takes (3x their earlier average)
    query(`SELECT l.id, l.bill_no, l.loan_date, l.principal, c.name customer_name, ROUND(h.avg_prev) avg_prev FROM loans l JOIN customers c ON c.id = l.customer_id
             JOIN (SELECT l2.id, (SELECT AVG(x.principal) FROM loans x WHERE x.customer_id = l2.customer_id AND x.loan_date < l2.loan_date AND x.status <> 'CANCELLED') avg_prev
                     FROM loans l2 WHERE l2.branch_id IN (:b) AND l2.loan_date BETWEEN :f AND :t) h ON h.id = l.id
            WHERE l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND h.avg_prev > 0 AND l.principal >= h.avg_prev * 3 ${mf}
            ORDER BY l.principal / h.avg_prev DESC LIMIT 10`, p),
    // several loans for one customer on the same day
    query(`SELECT c.id, c.name customer_name, l.loan_date d, COUNT(*) loans, COALESCE(SUM(l.principal),0) amount FROM loans l JOIN customers c ON c.id = l.customer_id
            WHERE l.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :f AND :t ${mf}
            GROUP BY c.id, l.loan_date HAVING loans >= 3 ORDER BY loans DESC LIMIT 10`, p),
  ]);
  res.json({ data: { forecast: { ...forecast, dueNext }, bestCustomers, league, cashVar, watch: { canSeeAudit: audit, voids, offHours, bigLoans, sameDay } } });
});

/* WhatsApp message templates used at the counter after saving (only the WA_ texts, active ones) */
router.get('/wa-templates', async (_req, res) => {
  const rows = await query("SELECT event_key, body FROM message_templates WHERE event_key LIKE 'WA\\_%' AND is_active = 1");
  res.json({ data: Object.fromEntries(rows.map((r) => [r.event_key, r.body])) });
});
export default router;
