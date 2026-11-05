import { Router } from 'express';
import dayjs from 'dayjs';
import { query, queryOne } from '#config/db.js';
import { permit, can } from '#middleware/auth.js';
import { daySummary } from '#modules/accounts/accounts.service.js';

const router = Router();

router.get('/', permit('dashboard', 'view'), async (req, res) => {
  const b = req.branchIds;
  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
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
    query(`SELECT t.id, t.txn_type, t.txn_date, t.total_amount, t.receipt_no, l.id loan_id, l.bill_no, c.name customer_name, t.created_at
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
    queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' AND due_date < CURDATE()", { b }),
    queryOne('SELECT COUNT(*) c FROM metal_rates WHERE rate_date = CURDATE()'),
    req.branchId ? queryOne('SELECT MAX(close_date) d FROM day_closes WHERE branch_id = :b', { b: req.branchId }) : null,
  ]);
  const alerts = [];
  if (overdue.c) alerts.push({ type: 'warning', key: 'overdue', text: `${overdue.c} loans are past due date`, link: '/auction' });
  if (!rateMissing.c) alerts.push({ type: 'info', key: 'rate', text: "Today's gold rate is not updated", link: '/masters/rates' });
  if (notClosed && notClosed.d && dayjs().diff(dayjs(notClosed.d), 'day') > 1) {
    alerts.push({ type: 'info', key: 'dayclose', text: `Day close pending since ${dayjs(notClosed.d).add(1, 'day').format('DD-MM-YYYY')}`, link: '/accounts/day-close' });
  }
  res.json({ data: alerts });
});

export default router;
