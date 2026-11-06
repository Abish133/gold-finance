import { query } from '#config/db.js';
import { round2, num } from '#utils/money.js';
import { getSettings } from '#services/settings.service.js';
import { calculateInterest } from '#services/interest.service.js';
import { calcOptions } from '#modules/loans/loans.service.js';

/**
 * Interest position of many loans at once (one query for receipts and schemes).
 * Used by Interest Calculation, Customer Ledger and the customer card.
 */
export const withCalc = async (loans, asOn, branchId) => {
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
    const open = l.status === undefined || l.status === 'OPEN';
    const c = calculateInterest({ loan: l, scheme: sMap[l.scheme_id], txns: t, asOf: open ? asOn : l.close_date || asOn, options: opts });
    const partPaid = round2(t.filter((x) => x.txn_type === 'PART_PAYMENT').reduce((s, x) => s - num(x.principal_amount), 0));
    return {
      id: l.id, bill_no: l.bill_no, manual_bill_no: l.manual_bill_no, loan_date: l.loan_date, close_date: l.close_date, status: l.status, customer_name: l.customer_name, customer_phone: l.customer_phone,
      loan_on: l.loan_on, item_summary: l.item_summary, item_photo: l.item_photo,
      total_items: l.total_items, net_wt: l.net_wt, gross_wt: l.gross_wt, stone_wt: l.stone_wt, principal: l.principal, interest_rate: l.interest_rate, rate_type: l.rate_type,
      interest_type: l.interest_type, bank: !!l.bank_pledge_id, months: round2(c.elapsedDays / 30), days: c.elapsedDays, part_paid: partPaid, loan_due: c.principalOutstanding,
      total_interest: c.totalInterest, advance: num(l.advance_interest), paid_earlier: round2(c.interestPaid - num(l.advance_interest)),
      interest_due: open ? round2(c.interestDue + c.penalDue) : 0, total_due: open ? c.totalPayable : 0,
      interest_paid: c.interestPaid, months_paid: c.monthsPaid, months_due: c.monthsDue,
      interest_received: round2(t.reduce((s, x) => s + num(x.interest_amount) + num(x.penal_amount), 0)),
    };
  });
};
