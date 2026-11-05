import { query, queryOne } from '#config/db.js';
import { round2, num } from '#utils/money.js';
import { ledgerId, LEDGER } from '#services/accounting.service.js';

/** Opening balance (Dr +ve) of a ledger for the branches, before `date`. */
export const openingBalance = async (ledger, branchIds, date) => {
  const cashId = await ledgerId({ queryOne }, LEDGER.CASH);
  const [o] = await query('SELECT COALESCE(SUM(amount),0) amt FROM ledger_openings WHERE ledger_id = :l AND branch_id IN (:b)', { l: ledger, b: branchIds });
  let base = num(o.amt);
  const capitalId = await ledgerId({ queryOne }, LEDGER.CAPITAL);
  if (Number(ledger) === cashId || Number(ledger) === capitalId) {
    // branch opening cash is balanced against Capital
    const [c] = await query('SELECT COALESCE(SUM(opening_cash),0) amt FROM branches WHERE id IN (:b)', { b: branchIds });
    base += Number(ledger) === cashId ? num(c.amt) : -num(c.amt);
  }
  const [m] = await query(
    `SELECT COALESCE(SUM(e.debit - e.credit),0) amt FROM voucher_entries e
      WHERE e.ledger_id = :l AND e.branch_id IN (:b) AND e.entry_date < :d`,
    { l: ledger, b: branchIds, d: date },
  );
  return round2(base + num(m.amt));
};

export const ledgerStatement = async (ledger, branchIds, from, to) => {
  const opening = await openingBalance(ledger, branchIds, from);
  const rows = await query(
    `SELECT e.entry_date, e.debit, e.credit, COALESCE(e.narration, v.narration) narration, v.voucher_no, v.voucher_type, v.source_type, v.source_id,
            b.name branch_name
       FROM voucher_entries e JOIN vouchers v ON v.id = e.voucher_id JOIN branches b ON b.id = e.branch_id
      WHERE e.ledger_id = :l AND e.branch_id IN (:b) AND e.entry_date BETWEEN :f AND :t
      ORDER BY e.entry_date, e.id`,
    { l: ledger, b: branchIds, f: from, t: to },
  );
  let bal = opening;
  const entries = rows.map((r) => { bal = round2(bal + num(r.debit) - num(r.credit)); return { ...r, balance: bal }; });
  const debit = round2(rows.reduce((s, r) => s + num(r.debit), 0));
  const credit = round2(rows.reduce((s, r) => s + num(r.credit), 0));
  return { opening, entries, debit, credit, closing: bal };
};

/** Balances per ledger between dates (or cumulative up to `to` when from is null). */
export const ledgerBalances = async (branchIds, from, to) => {
  const rows = await query(
    `SELECT l.id, l.name, l.system_key, g.name group_name, g.nature,
       COALESCE((SELECT SUM(o.amount) FROM ledger_openings o WHERE o.ledger_id = l.id AND o.branch_id IN (:b)), 0)
       + (CASE l.system_key WHEN 'CASH' THEN 1 WHEN 'CAPITAL' THEN -1 ELSE 0 END) * (SELECT COALESCE(SUM(opening_cash),0) FROM branches WHERE id IN (:b)) AS opening,
       COALESCE(SUM(IF(:f IS NULL OR e.entry_date >= :f, e.debit, 0)), 0) AS debit,
       COALESCE(SUM(IF(:f IS NULL OR e.entry_date >= :f, e.credit, 0)), 0) AS credit,
       COALESCE(SUM(IF(:f IS NOT NULL AND e.entry_date < :f, e.debit - e.credit, 0)), 0) AS prior
     FROM ledgers l JOIN ledger_groups g ON g.id = l.group_id
     LEFT JOIN voucher_entries e ON e.ledger_id = l.id AND e.branch_id IN (:b) AND e.entry_date <= :t
     WHERE l.is_active = 1 AND (l.branch_id IS NULL OR l.branch_id IN (:b))
     GROUP BY l.id ORDER BY g.nature, g.name, l.name`,
    { b: branchIds, f: from, t: to },
  );
  return rows.map((r) => {
    const isPL = r.nature === 'INCOME' || r.nature === 'EXPENSE';
    const open = isPL && from ? 0 : round2(num(r.opening) + num(r.prior));
    return { ...r, opening: open, debit: round2(r.debit), credit: round2(r.credit), balance: round2(open + num(r.debit) - num(r.credit)) };
  });
};

export const profitAndLoss = async (branchIds, from, to) => {
  const rows = (await ledgerBalances(branchIds, from, to)).filter((r) => r.nature === 'INCOME' || r.nature === 'EXPENSE');
  const income = rows.filter((r) => r.nature === 'INCOME').map((r) => ({ ...r, amount: round2(-r.balance) })).filter((r) => r.amount);
  const expense = rows.filter((r) => r.nature === 'EXPENSE').map((r) => ({ ...r, amount: round2(r.balance) })).filter((r) => r.amount);
  const ti = round2(income.reduce((s, r) => s + r.amount, 0));
  const te = round2(expense.reduce((s, r) => s + r.amount, 0));
  return { income, expense, totalIncome: ti, totalExpense: te, netProfit: round2(ti - te) };
};

export const balanceSheet = async (branchIds, asOn) => {
  const rows = await ledgerBalances(branchIds, null, asOn);
  const pl = rows.filter((r) => r.nature === 'INCOME' || r.nature === 'EXPENSE').reduce((s, r) => s - r.balance, 0);
  const assets = rows.filter((r) => r.nature === 'ASSET' && r.balance).map((r) => ({ ...r, amount: r.balance }));
  const liabilities = rows.filter((r) => (r.nature === 'LIABILITY' || r.nature === 'EQUITY') && r.balance).map((r) => ({ ...r, amount: round2(-r.balance) }));
  liabilities.push({ id: 0, name: 'Profit & Loss (accumulated)', group_name: 'Reserves', nature: 'EQUITY', amount: round2(pl) });
  const ta = round2(assets.reduce((s, r) => s + r.amount, 0));
  const tl = round2(liabilities.reduce((s, r) => s + r.amount, 0));
  return { assets, liabilities, totalAssets: ta, totalLiabilities: tl, difference: round2(ta - tl) };
};

/** One-day business summary used by Day Report, Day Close and Dashboard. */
export const daySummary = async (branchIds, from, to = from) => {
  const p = { b: branchIds, f: from, t: to };
  const [byType, loans, cash] = await Promise.all([
    query(`SELECT txn_type, COUNT(*) cnt, COALESCE(SUM(ABS(principal_amount)),0) principal, COALESCE(SUM(interest_amount),0) interest,
             COALESCE(SUM(penal_amount),0) penal, COALESCE(SUM(charges),0) charges, COALESCE(SUM(discount),0) discount, COALESCE(SUM(total_amount),0) total
           FROM loan_transactions WHERE branch_id IN (:b) AND is_void = 0 AND txn_date BETWEEN :f AND :t GROUP BY txn_type`, p),
    queryOne(`SELECT COUNT(*) cnt, COALESCE(SUM(principal),0) principal, COALESCE(SUM(net_wt),0) net_wt, COALESCE(SUM(doc_charges),0) doc_charges,
             COALESCE(SUM(advance_interest),0) advance_interest
           FROM loans WHERE branch_id IN (:b) AND status <> 'CANCELLED' AND entry_type <> 'OLD' AND loan_date BETWEEN :f AND :t`, p),
    (async () => {
      const cashId = await ledgerId({ queryOne }, LEDGER.CASH);
      const opening = await openingBalance(cashId, branchIds, from);
      const [m] = await query(`SELECT COALESCE(SUM(debit),0) receipts, COALESCE(SUM(credit),0) payments FROM voucher_entries
                                WHERE ledger_id = :l AND branch_id IN (:b) AND entry_date BETWEEN :f AND :t`, { l: cashId, ...p });
      return { opening, receipts: round2(m.receipts), payments: round2(m.payments), closing: round2(opening + num(m.receipts) - num(m.payments)) };
    })(),
  ]);
  const t = Object.fromEntries(byType.map((r) => [r.txn_type, r]));
  return { from, to, loans, transactions: t, cash };
};
