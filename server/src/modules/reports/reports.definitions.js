import dayjs from 'dayjs';
import { query } from '#config/db.js';
import { calculateInterest } from '#services/interest.service.js';
import { getSettings } from '#services/settings.service.js';
import { num, round2 } from '#utils/money.js';

/**
 * Declarative report catalogue. Each report:
 *   key, title, group, screen, params: ['from','to','asOn','status','metal'...],
 *   columns: [{ key, label, type: text|date|money|weight|number|status }],
 *   totals:  [column keys to sum],
 *   run(ctx) -> rows      ctx = { b: branchIds, from, to, asOn, ...query }
 * Adding a report = adding one object here. The UI renders it automatically.
 */

const C = (key, label, type = 'text') => ({ key, label, type });
const LOAN_BASE = `FROM loans l JOIN customers c ON c.id = l.customer_id JOIN metals m ON m.id = l.metal_id
  JOIN schemes s ON s.id = l.scheme_id JOIN branches b ON b.id = l.branch_id`;
const custAddr = "CONCAT_WS(', ', c.door_no, c.street, c.area, c.city)";

const withInterest = async (rows, asOn) => {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const [txns, schemes] = await Promise.all([
    query('SELECT * FROM loan_transactions WHERE loan_id IN (:ids) AND is_void = 0 ORDER BY txn_date, id', { ids }),
    query('SELECT * FROM schemes'),
  ]);
  const settings = await getSettings(0);
  const sMap = Object.fromEntries(schemes.map((s) => [s.id, s]));
  const tMap = {};
  for (const t of txns) (tMap[t.loan_id] ||= []).push(t);
  return rows.map((r) => {
    const calc = calculateInterest({ loan: r, scheme: sMap[r.scheme_id], txns: tMap[r.id] || [], asOf: asOn,
      options: { monthRoundHalfDays: num(settings.MONTH_ROUND_HALF_DAYS, 15), roundInterestTo: num(settings.ROUND_INTEREST_TO, 1) } });
    return { ...r, days: calc.elapsedDays, rate_now: calc.rate, interest_due: calc.interestDue + calc.penalDue, total_due: calc.totalPayable };
  });
};

export const REPORTS = [
  /* ------------------------------------------------ LOANS */
  {
    key: 'daywise_loans', title: 'Day-wise Loan Register', group: 'Loan Reports', screen: 'reports_loan', params: ['from', 'to', 'metal'],
    columns: [C('loan_date', 'Date', 'date'), C('bill_no', 'Loan No'), C('customer_name', 'Customer'), C('customer_phone', 'Phone'), C('item_summary', 'Items'),
      C('gross_wt', 'Gross Wt', 'weight'), C('net_wt', 'Net Wt', 'weight'), C('principal', 'Amount', 'money'), C('doc_charges', 'Doc Chg', 'money'),
      C('net_disbursed', 'Paid', 'money'), C('interest_rate', 'ROI %', 'number'), C('scheme_code', 'Scheme'), C('status', 'Status', 'status'), C('branch_name', 'Branch')],
    totals: ['gross_wt', 'net_wt', 'principal', 'doc_charges', 'net_disbursed'],
    run: ({ b, from, to, metal }) => query(`SELECT l.*, c.name customer_name, c.phone customer_phone, s.code scheme_code, b.name branch_name ${LOAN_BASE}
      WHERE l.branch_id IN (:b) AND l.loan_date BETWEEN :from AND :to AND l.status <> 'CANCELLED' ${metal ? 'AND l.metal_id = :metal' : ''}
      ORDER BY l.loan_date, l.loan_no`, { b, from, to, metal }),
  },
  {
    key: 'pledge_register', title: 'Pledge Register (Form-D style)', group: 'Loan Reports', screen: 'reports_loan', params: ['from', 'to'],
    columns: [C('bill_no', 'Loan No'), C('loan_date', 'Date', 'date'), C('customer_name', 'Name'), C('address', 'Address'), C('item_name', 'Article'),
      C('pcs', 'Pcs', 'number'), C('gross_wt', 'Gross Wt', 'weight'), C('net_wt', 'Net Wt', 'weight'), C('principal', 'Loan', 'money'),
      C('interest_rate', 'ROI', 'number'), C('close_date', 'Redeemed On', 'date'), C('status', 'Status', 'status')],
    totals: ['pcs', 'gross_wt', 'net_wt'],
    run: ({ b, from, to }) => query(`SELECT l.bill_no, l.loan_date, c.name customer_name, ${custAddr} address, i.item_name, i.pcs, i.gross_wt, i.net_wt,
      l.principal, l.interest_rate, l.close_date, l.status ${LOAN_BASE} JOIN loan_items i ON i.loan_id = l.id
      WHERE l.branch_id IN (:b) AND l.loan_date BETWEEN :from AND :to AND l.status <> 'CANCELLED' ORDER BY l.loan_date, l.loan_no, i.id`, { b, from, to }),
  },
  {
    key: 'outstanding', title: 'Outstanding Loans with Interest Due', group: 'Loan Reports', screen: 'reports_loan', params: ['asOn', 'metal', 'scheme'],
    columns: [C('bill_no', 'Loan No'), C('loan_date', 'Date', 'date'), C('customer_name', 'Customer'), C('customer_phone', 'Phone'), C('net_wt', 'Net Wt', 'weight'),
      C('current_principal', 'Principal', 'money'), C('days', 'Days', 'number'), C('rate_now', 'ROI Now', 'number'), C('interest_due', 'Interest Due', 'money'),
      C('total_due', 'Total Due', 'money'), C('due_date', 'Due Date', 'date'), C('branch_name', 'Branch')],
    totals: ['net_wt', 'current_principal', 'interest_due', 'total_due'],
    run: async ({ b, asOn, metal, scheme }) => withInterest(await query(`SELECT l.*, c.name customer_name, c.phone customer_phone, b.name branch_name ${LOAN_BASE}
      WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.loan_date <= :asOn ${metal ? 'AND l.metal_id = :metal' : ''} ${scheme ? 'AND l.scheme_id = :scheme' : ''}
      ORDER BY l.loan_date`, { b, asOn, metal, scheme }), asOn),
  },
  {
    key: 'maturity', title: 'Maturity / Overdue Loans', group: 'Loan Reports', screen: 'reports_loan', params: ['asOn', 'days'],
    description: 'Open loans past due date, or maturing within the next N days',
    columns: [C('bill_no', 'Loan No'), C('loan_date', 'Date', 'date'), C('due_date', 'Due Date', 'date'), C('overdue_days', 'Overdue Days', 'number'),
      C('customer_name', 'Customer'), C('customer_phone', 'Phone'), C('address', 'Address'), C('net_wt', 'Net Wt', 'weight'),
      C('current_principal', 'Principal', 'money'), C('interest_due', 'Interest Due', 'money'), C('notices', 'Notices', 'number')],
    totals: ['net_wt', 'current_principal', 'interest_due'],
    run: async ({ b, asOn, days }) => withInterest(await query(`SELECT l.*, c.name customer_name, c.phone customer_phone, ${custAddr} address,
      DATEDIFF(:asOn, l.due_date) overdue_days, (SELECT COUNT(*) FROM auction_notices n WHERE n.loan_id = l.id) notices ${LOAN_BASE}
      WHERE l.branch_id IN (:b) AND l.status = 'OPEN' AND l.due_date <= DATE_ADD(:asOn, INTERVAL :d DAY) ORDER BY l.due_date`,
    { b, asOn, d: num(days, 0) }), asOn),
  },
  {
    key: 'current_stock', title: 'Current Pledge Stock (Item-wise)', group: 'Loan Reports', screen: 'reports_loan', params: ['metal'],
    columns: [C('bill_no', 'Loan No'), C('loan_date', 'Date', 'date'), C('customer_name', 'Customer'), C('metal_name', 'Metal'), C('item_name', 'Item'),
      C('pcs', 'Pcs', 'number'), C('gross_wt', 'Gross', 'weight'), C('stone_wt', 'Stone', 'weight'), C('net_wt', 'Net', 'weight'), C('purity', 'Purity', 'number'),
      C('current_principal', 'Loan', 'money'), C('in_bank', 'In Bank')],
    totals: ['pcs', 'gross_wt', 'stone_wt', 'net_wt'],
    run: ({ b, metal }) => query(`SELECT l.bill_no, l.loan_date, c.name customer_name, m.name metal_name, i.item_name, i.pcs, i.gross_wt, i.stone_wt, i.net_wt, i.purity,
      l.current_principal, IF(l.bank_pledge_id IS NULL, '', 'Yes') in_bank ${LOAN_BASE} JOIN loan_items i ON i.loan_id = l.id
      WHERE l.branch_id IN (:b) AND l.status = 'OPEN' ${metal ? 'AND l.metal_id = :metal' : ''} ORDER BY l.loan_date, l.loan_no`, { b, metal }),
  },
  {
    key: 'stock_analysis', title: 'Stock Analysis (Amount Slabs)', group: 'Loan Reports', screen: 'reports_loan', params: [],
    columns: [C('slab', 'Loan Amount Range'), C('loans', 'Loans', 'number'), C('net_wt', 'Net Wt', 'weight'), C('principal', 'Outstanding', 'money'), C('avg_loan', 'Avg Loan', 'money')],
    totals: ['loans', 'net_wt', 'principal'],
    run: ({ b }) => query(`SELECT CASE WHEN current_principal <= 10000 THEN '1. Up to 10,000' WHEN current_principal <= 25000 THEN '2. 10,001 - 25,000'
        WHEN current_principal <= 50000 THEN '3. 25,001 - 50,000' WHEN current_principal <= 100000 THEN '4. 50,001 - 1,00,000'
        WHEN current_principal <= 300000 THEN '5. 1,00,001 - 3,00,000' ELSE '6. Above 3,00,000' END slab,
        COUNT(*) loans, SUM(net_wt) net_wt, SUM(current_principal) principal, ROUND(AVG(current_principal), 2) avg_loan
      FROM loans WHERE branch_id IN (:b) AND status = 'OPEN' GROUP BY slab ORDER BY slab`, { b }),
  },
  {
    key: 'area_wise', title: 'Area-wise Loans', group: 'Loan Reports', screen: 'reports_loan', params: [],
    columns: [C('area', 'Area'), C('customers', 'Customers', 'number'), C('loans', 'Open Loans', 'number'), C('net_wt', 'Net Wt', 'weight'), C('principal', 'Outstanding', 'money')],
    totals: ['customers', 'loans', 'net_wt', 'principal'],
    run: ({ b }) => query(`SELECT COALESCE(c.area, '-') area, COUNT(DISTINCT c.id) customers, COUNT(*) loans, SUM(l.net_wt) net_wt, SUM(l.current_principal) principal
      FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.branch_id IN (:b) AND l.status = 'OPEN' GROUP BY c.area ORDER BY principal DESC`, { b }),
  },
  {
    key: 'scheme_wise', title: 'Scheme-wise Summary', group: 'Loan Reports', screen: 'reports_loan', params: [],
    columns: [C('scheme_code', 'Scheme'), C('scheme_name', 'Name'), C('loans', 'Open Loans', 'number'), C('net_wt', 'Net Wt', 'weight'), C('principal', 'Outstanding', 'money')],
    totals: ['loans', 'net_wt', 'principal'],
    run: ({ b }) => query(`SELECT s.code scheme_code, s.name scheme_name, COUNT(*) loans, SUM(l.net_wt) net_wt, SUM(l.current_principal) principal
      FROM loans l JOIN schemes s ON s.id = l.scheme_id WHERE l.branch_id IN (:b) AND l.status = 'OPEN' GROUP BY s.id ORDER BY principal DESC`, { b }),
  },
  {
    key: 'cancelled_loans', title: 'Cancelled Loans', group: 'Loan Reports', screen: 'reports_loan', params: ['from', 'to'],
    columns: [C('bill_no', 'Loan No'), C('loan_date', 'Date', 'date'), C('customer_name', 'Customer'), C('principal', 'Amount', 'money'), C('cancel_reason', 'Reason'), C('cancelled_by_name', 'Cancelled By'), C('cancelled_at', 'On', 'date')],
    totals: ['principal'],
    run: ({ b, from, to }) => query(`SELECT l.*, c.name customer_name, u.full_name cancelled_by_name ${LOAN_BASE} LEFT JOIN users u ON u.id = l.cancelled_by
      WHERE l.branch_id IN (:b) AND l.status = 'CANCELLED' AND l.loan_date BETWEEN :from AND :to ORDER BY l.loan_date`, { b, from, to }),
  },

  /* ------------------------------------------------ RELEASE */
  {
    key: 'daywise_releases', title: 'Day-wise Release Report', group: 'Release Reports', screen: 'reports_release', params: ['from', 'to'],
    columns: [C('txn_date', 'Release Date', 'date'), C('receipt_no', 'Receipt'), C('bill_no', 'Loan No'), C('loan_date', 'Loan Date', 'date'), C('customer_name', 'Customer'),
      C('net_wt', 'Net Wt', 'weight'), C('principal', 'Principal', 'money'), C('interest', 'Interest', 'money'), C('penal', 'Penal', 'money'), C('discount', 'Discount', 'money'),
      C('total', 'Received', 'money'), C('days', 'Days', 'number'), C('remarks', 'Remarks')],
    totals: ['net_wt', 'principal', 'interest', 'penal', 'discount', 'total'],
    run: ({ b, from, to }) => query(`SELECT t.txn_date, t.receipt_no, l.bill_no, l.loan_date, c.name customer_name, l.net_wt, ABS(t.principal_amount) principal,
      t.interest_amount interest, t.penal_amount penal, t.discount, t.total_amount total, DATEDIFF(t.txn_date, l.loan_date) days, t.remarks
      FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id
      WHERE t.branch_id IN (:b) AND t.txn_type = 'RELEASE' AND t.is_void = 0 AND t.txn_date BETWEEN :from AND :to ORDER BY t.txn_date, t.id`, { b, from, to }),
  },
  {
    key: 'release_items', title: 'Released Item Details', group: 'Release Reports', screen: 'reports_release', params: ['from', 'to'],
    columns: [C('close_date', 'Released', 'date'), C('bill_no', 'Loan No'), C('customer_name', 'Customer'), C('item_name', 'Item'), C('pcs', 'Pcs', 'number'),
      C('gross_wt', 'Gross', 'weight'), C('net_wt', 'Net', 'weight'), C('released_to', 'Released To')],
    totals: ['pcs', 'gross_wt', 'net_wt'],
    run: ({ b, from, to }) => query(`SELECT l.close_date, l.bill_no, c.name customer_name, i.item_name, i.pcs, i.gross_wt, i.net_wt, COALESCE(o.name, c.name) released_to
      ${LOAN_BASE} JOIN loan_items i ON i.loan_id = l.id LEFT JOIN release_by_other o ON o.loan_id = l.id
      WHERE l.branch_id IN (:b) AND l.status = 'CLOSED' AND l.close_date BETWEEN :from AND :to ORDER BY l.close_date`, { b, from, to }),
  },
  {
    key: 'renewals', title: 'Renewal / Re-Loan Report', group: 'Release Reports', screen: 'reports_release', params: ['from', 'to'],
    columns: [C('loan_date', 'Date', 'date'), C('old_bill', 'Old Loan'), C('bill_no', 'New Loan'), C('customer_name', 'Customer'), C('old_principal', 'Old Amount', 'money'), C('principal', 'New Amount', 'money')],
    totals: ['old_principal', 'principal'],
    run: ({ b, from, to }) => query(`SELECT l.loan_date, p.bill_no old_bill, l.bill_no, c.name customer_name, p.principal old_principal, l.principal ${LOAN_BASE}
      JOIN loans p ON p.id = l.parent_loan_id WHERE l.branch_id IN (:b) AND l.entry_type = 'RENEWAL' AND l.status <> 'CANCELLED' AND l.loan_date BETWEEN :from AND :to ORDER BY l.loan_date`, { b, from, to }),
  },

  /* ------------------------------------------------ COLLECTIONS */
  {
    key: 'interest_collection', title: 'Interest Collection', group: 'Interest & Collection', screen: 'reports_collection', params: ['from', 'to'],
    columns: [C('txn_date', 'Date', 'date'), C('receipt_no', 'Receipt'), C('bill_no', 'Loan No'), C('customer_name', 'Customer'), C('type', 'Type'),
      C('interest', 'Interest', 'money'), C('penal', 'Penal', 'money'), C('discount', 'Discount', 'money'), C('total', 'Collected', 'money'), C('modes', 'Mode'), C('user_name', 'By')],
    totals: ['interest', 'penal', 'discount', 'total'],
    run: ({ b, from, to }) => query(`SELECT t.txn_date, t.receipt_no, l.bill_no, c.name customer_name, t.txn_type type, t.interest_amount interest, t.penal_amount penal,
      t.discount, t.interest_amount + t.penal_amount - t.discount total, (SELECT GROUP_CONCAT(DISTINCT mode) FROM transaction_payments p WHERE p.transaction_id = t.id) modes,
      u.full_name user_name FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id LEFT JOIN users u ON u.id = t.created_by
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND (t.interest_amount > 0 OR t.penal_amount > 0) AND t.txn_date BETWEEN :from AND :to ORDER BY t.txn_date, t.id`, { b, from, to }),
  },
  {
    key: 'part_payments', title: 'Part Payment (Principal) Report', group: 'Interest & Collection', screen: 'reports_collection', params: ['from', 'to'],
    columns: [C('txn_date', 'Date', 'date'), C('receipt_no', 'Receipt'), C('bill_no', 'Loan No'), C('customer_name', 'Customer'), C('principal', 'Principal Paid', 'money'),
      C('interest', 'Interest', 'money'), C('total', 'Total', 'money'), C('balance', 'Balance Principal', 'money')],
    totals: ['principal', 'interest', 'total'],
    run: ({ b, from, to }) => query(`SELECT t.txn_date, t.receipt_no, l.bill_no, c.name customer_name, ABS(t.principal_amount) principal, t.interest_amount interest,
      t.total_amount total, l.current_principal balance FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'PART_PAYMENT' AND t.txn_date BETWEEN :from AND :to ORDER BY t.txn_date`, { b, from, to }),
  },
  {
    key: 'topups', title: 'Top-up Loans', group: 'Interest & Collection', screen: 'reports_collection', params: ['from', 'to'],
    columns: [C('txn_date', 'Date', 'date'), C('bill_no', 'Loan No'), C('customer_name', 'Customer'), C('amount', 'Top-up', 'money'), C('interest', 'Interest Deducted', 'money'), C('paid', 'Paid', 'money')],
    totals: ['amount', 'interest', 'paid'],
    run: ({ b, from, to }) => query(`SELECT t.txn_date, l.bill_no, c.name customer_name, t.principal_amount amount, t.interest_amount interest, t.total_amount paid
      FROM loan_transactions t JOIN loans l ON l.id = t.loan_id JOIN customers c ON c.id = l.customer_id
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'TOPUP' AND t.txn_date BETWEEN :from AND :to ORDER BY t.txn_date`, { b, from, to }),
  },
  {
    key: 'payment_modes', title: 'Payment Mode Summary', group: 'Interest & Collection', screen: 'reports_collection', params: ['from', 'to'],
    columns: [C('txn_type', 'Transaction'), C('mode', 'Mode'), C('count', 'Count', 'number'), C('amount', 'Amount', 'money')],
    totals: ['count', 'amount'],
    run: ({ b, from, to }) => query(`SELECT t.txn_type, p.mode, COUNT(*) count, SUM(p.amount) amount FROM transaction_payments p JOIN loan_transactions t ON t.id = p.transaction_id
      WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :from AND :to GROUP BY t.txn_type, p.mode ORDER BY t.txn_type, p.mode`, { b, from, to }),
  },

  /* ------------------------------------------------ CUSTOMERS */
  {
    key: 'customer_due', title: 'Customer-wise Due Details', group: 'Customer Reports', screen: 'reports_customer', params: ['asOn'],
    columns: [C('customer_no', 'Cust No', 'number'), C('customer_name', 'Customer'), C('customer_phone', 'Phone'), C('loans', 'Loans', 'number'),
      C('net_wt', 'Net Wt', 'weight'), C('current_principal', 'Principal', 'money'), C('interest_due', 'Interest Due', 'money'), C('total_due', 'Total Due', 'money')],
    totals: ['loans', 'net_wt', 'current_principal', 'interest_due', 'total_due'],
    run: async ({ b, asOn }) => {
      const rows = await withInterest(await query(`SELECT l.*, c.customer_no, c.name customer_name, c.phone customer_phone ${LOAN_BASE}
        WHERE l.branch_id IN (:b) AND l.status = 'OPEN'`, { b }), asOn);
      const g = {};
      for (const r of rows) {
        const k = r.customer_id;
        g[k] ||= { customer_no: r.customer_no, customer_name: r.customer_name, customer_phone: r.customer_phone, loans: 0, net_wt: 0, current_principal: 0, interest_due: 0, total_due: 0 };
        g[k].loans += 1; g[k].net_wt = round2(g[k].net_wt + num(r.net_wt)); g[k].current_principal = round2(g[k].current_principal + num(r.current_principal));
        g[k].interest_due = round2(g[k].interest_due + r.interest_due); g[k].total_due = round2(g[k].total_due + r.total_due);
      }
      return Object.values(g).sort((a, z) => z.total_due - a.total_due);
    },
  },
  {
    key: 'customer_list', title: 'Customer List', group: 'Customer Reports', screen: 'reports_customer', params: ['status'],
    columns: [C('customer_no', 'No', 'number'), C('name', 'Name'), C('relation', 'Relation'), C('phone', 'Phone'), C('address', 'Address'), C('id_proof', 'ID Proof'),
      C('open_loans', 'Open Loans', 'number'), C('status', 'Status', 'status'), C('branch_name', 'Branch')],
    totals: ['open_loans'],
    run: ({ b, status }) => query(`SELECT c.customer_no, c.name, CONCAT_WS(' ', c.relation_type, c.relation_name) relation, c.phone, ${custAddr} address,
      CONCAT_WS(': ', c.id_proof_type, c.id_proof_no) id_proof, (SELECT COUNT(*) FROM loans l WHERE l.customer_id = c.id AND l.status = 'OPEN') open_loans, c.status, b.name branch_name
      FROM customers c JOIN branches b ON b.id = c.branch_id WHERE c.branch_id IN (:b) AND c.merged_into IS NULL ${status ? 'AND c.status = :status' : ''} ORDER BY c.customer_no`, { b, status }),
  },
  {
    key: 'top_customers', title: 'Top Customers by Business', group: 'Customer Reports', screen: 'reports_customer', params: ['from', 'to'],
    columns: [C('customer_name', 'Customer'), C('customer_phone', 'Phone'), C('loans', 'Loans', 'number'), C('lent', 'Total Lent', 'money'), C('interest', 'Interest Paid', 'money')],
    totals: ['loans', 'lent', 'interest'],
    run: ({ b, from, to }) => query(`SELECT c.name customer_name, c.phone customer_phone, COUNT(DISTINCT l.id) loans, SUM(DISTINCT l.principal) lent,
      COALESCE((SELECT SUM(t.interest_amount) FROM loan_transactions t JOIN loans x ON x.id = t.loan_id WHERE x.customer_id = c.id AND t.is_void = 0 AND t.txn_date BETWEEN :from AND :to), 0) interest
      FROM customers c JOIN loans l ON l.customer_id = c.id WHERE c.branch_id IN (:b) AND l.status <> 'CANCELLED' AND l.loan_date BETWEEN :from AND :to
      GROUP BY c.id ORDER BY lent DESC LIMIT 100`, { b, from, to }),
  },

  /* ------------------------------------------------ SUMMARY */
  {
    key: 'loan_release_summary', title: 'Loan & Release Summary (Date-wise)', group: 'Summary Reports', screen: 'reports_summary', params: ['from', 'to'],
    columns: [C('d', 'Date', 'date'), C('loans', 'New Loans', 'number'), C('loan_amount', 'Loan Amount', 'money'), C('releases', 'Releases', 'number'),
      C('release_principal', 'Released Principal', 'money'), C('interest', 'Interest', 'money')],
    totals: ['loans', 'loan_amount', 'releases', 'release_principal', 'interest'],
    run: ({ b, from, to }) => query(`SELECT d, SUM(loans) loans, SUM(loan_amount) loan_amount, SUM(releases) releases, SUM(release_principal) release_principal, SUM(interest) interest FROM (
        SELECT loan_date d, COUNT(*) loans, SUM(principal) loan_amount, 0 releases, 0 release_principal, 0 interest FROM loans
          WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date BETWEEN :from AND :to GROUP BY loan_date
        UNION ALL
        SELECT txn_date, 0, 0, SUM(txn_type = 'RELEASE'), SUM(IF(txn_type = 'RELEASE', ABS(principal_amount), 0)), SUM(interest_amount + penal_amount) FROM loan_transactions
          WHERE branch_id IN (:b) AND is_void = 0 AND txn_date BETWEEN :from AND :to GROUP BY txn_date) x GROUP BY d ORDER BY d`, { b, from, to }),
  },
  {
    key: 'owner_summary', title: 'Owner Summary (Branch-wise)', group: 'Summary Reports', screen: 'reports_summary', params: ['from', 'to'],
    columns: [C('branch_name', 'Branch'), C('open_loans', 'Open Loans', 'number'), C('outstanding', 'Outstanding', 'money'), C('gold_wt', 'Gold in Custody', 'weight'),
      C('new_loans', 'New Loans', 'number'), C('lent', 'Lent', 'money'), C('collected_interest', 'Interest', 'money'), C('released', 'Released', 'money'), C('customers', 'Customers', 'number')],
    totals: ['open_loans', 'outstanding', 'gold_wt', 'new_loans', 'lent', 'collected_interest', 'released', 'customers'],
    run: ({ b, from, to }) => query(`SELECT br.name branch_name,
        (SELECT COUNT(*) FROM loans l WHERE l.branch_id = br.id AND l.status = 'OPEN') open_loans,
        (SELECT COALESCE(SUM(current_principal),0) FROM loans l WHERE l.branch_id = br.id AND l.status = 'OPEN') outstanding,
        (SELECT COALESCE(SUM(net_wt),0) FROM loans l WHERE l.branch_id = br.id AND l.status = 'OPEN') gold_wt,
        (SELECT COUNT(*) FROM loans l WHERE l.branch_id = br.id AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :from AND :to) new_loans,
        (SELECT COALESCE(SUM(principal),0) FROM loans l WHERE l.branch_id = br.id AND l.status <> 'CANCELLED' AND l.entry_type <> 'OLD' AND l.loan_date BETWEEN :from AND :to) lent,
        (SELECT COALESCE(SUM(interest_amount + penal_amount),0) FROM loan_transactions t WHERE t.branch_id = br.id AND t.is_void = 0 AND t.txn_date BETWEEN :from AND :to) collected_interest,
        (SELECT COALESCE(SUM(ABS(principal_amount)),0) FROM loan_transactions t WHERE t.branch_id = br.id AND t.is_void = 0 AND t.txn_type IN ('RELEASE','PART_PAYMENT') AND t.txn_date BETWEEN :from AND :to) released,
        (SELECT COUNT(*) FROM customers c WHERE c.branch_id = br.id) customers
      FROM branches br WHERE br.id IN (:b) ORDER BY br.name`, { b, from, to }),
  },
  {
    key: 'monthly_trend', title: 'Monthly Business Trend', group: 'Summary Reports', screen: 'reports_summary', params: ['from', 'to'],
    columns: [C('month', 'Month'), C('loans', 'Loans', 'number'), C('lent', 'Lent', 'money'), C('interest', 'Interest', 'money'), C('released', 'Released Principal', 'money')],
    totals: ['loans', 'lent', 'interest', 'released'],
    run: ({ b, from, to }) => query(`SELECT m month, SUM(loans) loans, SUM(lent) lent, SUM(interest) interest, SUM(released) released FROM (
        SELECT DATE_FORMAT(loan_date, '%Y-%m') m, COUNT(*) loans, SUM(principal) lent, 0 interest, 0 released FROM loans
         WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date BETWEEN :from AND :to GROUP BY m
        UNION ALL SELECT DATE_FORMAT(txn_date, '%Y-%m'), 0, 0, SUM(interest_amount + penal_amount), SUM(IF(txn_type IN ('RELEASE','PART_PAYMENT'), ABS(principal_amount), 0))
         FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_date BETWEEN :from AND :to GROUP BY 1) x GROUP BY m ORDER BY m`, { b, from, to }),
  },
  {
    key: 'user_activity', title: 'User-wise Transactions', group: 'Summary Reports', screen: 'reports_summary', params: ['from', 'to'],
    columns: [C('user_name', 'User'), C('txn_type', 'Type'), C('count', 'Count', 'number'), C('amount', 'Amount', 'money')],
    totals: ['count', 'amount'],
    run: ({ b, from, to }) => query(`SELECT COALESCE(u.full_name, '-') user_name, t.txn_type, COUNT(*) count, SUM(t.total_amount) amount FROM loan_transactions t
      LEFT JOIN users u ON u.id = t.created_by WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :from AND :to GROUP BY u.id, t.txn_type ORDER BY user_name`, { b, from, to }),
  },
];

export const defaultParams = (q) => {
  const today = dayjs().format('YYYY-MM-DD');
  return { ...q, from: q.from || dayjs().startOf('month').format('YYYY-MM-DD'), to: q.to || today, asOn: q.asOn || today };
};
