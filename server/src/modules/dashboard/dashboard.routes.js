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
       (SELECT COUNT(*) FROM loans WHERE branch_id IN (:b) AND status = 'OPEN') open_loans`,
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

export default router;
