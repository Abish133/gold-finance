import dayjs from 'dayjs';
import { query, queryOne } from '#config/db.js';
import { round2, num } from '#utils/money.js';
import { ledgerId, LEDGER } from '#services/accounting.service.js';
import { openingBalance } from '#modules/accounts/accounts.service.js';
import { lastClosedDate } from '#services/daycontrol.service.js';

/** Desktop Day Report rows (loan counter by kind, bank potali, auction, other cash vouchers) + cash tally. */
export const dayReport = async ({ branchIds, branchId, from, to }) => {
  const b = branchIds;
  const p = { b, f: from, t: to };
  const cashId = await ledgerId({ queryOne }, LEDGER.CASH);

  // desktop rows: loan counter entries by kind (all payment modes), like MyBook's Day Report
  const R = {
    girvi: [1, 'Girvi (Loan / Release)'], interest: [2, 'Interest'], other: [3, 'Other Charges'], doc: [4, 'Document Charges'],
    ashal: [5, 'Ashal Jama (Part Amount)'], intjama: [6, 'Interest Jama (Part Payment)'], discount: [7, 'Discount'], auction: [8, 'Auction'],
    potali: [9, 'Potali (Bank Girvi)'], potaliInt: [10, 'Potali Interest'],
  };
  const rows = Object.fromEntries(Object.entries(R).map(([k, [id, name]]) => [k, { id, name, jama: 0, nave: 0 }]));
  const add = (k, j = 0, nv = 0) => { rows[k].jama += num(j); rows[k].nave += num(nv); };
  // old loan entries are opening balances, not today's cash; a re-loan's new loan is counted (MyBook shows it in Girvi)
  const txns = await query(`SELECT t.*, l.advance_interest loan_advance FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
     WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t
       AND NOT (t.txn_type = 'DISBURSE' AND (l.entry_type = 'OLD' OR COALESCE(t.remarks, '') = 'Old loan entry'))`, p);
  for (const t of txns) {
    const pr = Math.abs(num(t.principal_amount)); const it = num(t.interest_amount) + num(t.penal_amount);
    switch (t.txn_type) {
      case 'DISBURSE': add('girvi', 0, pr); add('interest', t.loan_advance); add('doc', t.charges); break;
      case 'TOPUP': add('girvi', 0, pr); add('intjama', it); add('other', t.charges); break;
      case 'PART_PAYMENT': add('ashal', pr); add('intjama', it); add('other', t.charges); add('discount', 0, t.discount); break;
      case 'INTEREST': add('intjama', it); add('other', t.charges); add('discount', 0, t.discount); break;
      case 'RELEASE': add('girvi', pr); add('interest', it); add('other', t.charges); add('discount', 0, t.discount); break;
      case 'AUCTION': add('girvi', pr); add('auction', t.total_amount, pr); break; // marked: loan back from Girvi into auction stock
      default:
    }
  }
  // auction sales saved on these days
  const sold = await query('SELECT COALESCE(SUM(sale_amount),0) a FROM auction_sales WHERE branch_id IN (:b) AND sale_voucher_id IS NOT NULL AND sale_date BETWEEN :f AND :t', p);
  add('auction', sold[0]?.a);
  // bank potali (only what went through cash)
  const bank = await query(`SELECT l.system_key, l.id, l.name, (SELECT g.nature FROM ledger_groups g WHERE g.id = l.group_id) nature, SUM(e.credit) cr, SUM(e.debit) dr FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id JOIN vouchers v ON v.id = e.voucher_id
     WHERE e.branch_id IN (:b) AND e.entry_date BETWEEN :f AND :t AND v.source_type IN ('BANK_PLEDGE','BANK_PLEDGE_REL') AND e.ledger_id <> :cash
       AND EXISTS (SELECT 1 FROM voucher_entries c WHERE c.voucher_id = e.voucher_id AND c.ledger_id = :cash) GROUP BY l.id`, { ...p, cash: cashId });
  const extra = [];
  for (const x of bank) {
    if (x.system_key === LEDGER.BANK_BORROWING) add('potali', x.cr, x.dr);
    else if (x.system_key === LEDGER.BANK_INTEREST) add('potaliInt', x.cr, x.dr);
    else if (x.system_key === LEDGER.BANK_CHARGES) extra.push({ id: 11, name: 'Bank Loan Charges (Potali)', jama: num(x.cr), nave: num(x.dr) });
    else extra.push({ id: x.id + 100, ledger_id: x.id, nature: x.nature, name: x.name, jama: num(x.cr), nave: num(x.dr) });
  }
  // every other cash voucher (expenses, income, salary...) by account
  const others = await query(`SELECT l.id, l.code, l.name, l.system_key, g.nature, COALESCE(SUM(e.credit),0) jama, COALESCE(SUM(e.debit),0) nave
      FROM voucher_entries e JOIN ledgers l ON l.id = e.ledger_id JOIN ledger_groups g ON g.id = l.group_id JOIN vouchers v ON v.id = e.voucher_id
     WHERE e.branch_id IN (:b) AND e.entry_date BETWEEN :f AND :t AND e.ledger_id <> :cash
       AND (v.source_type IS NULL OR v.source_type NOT IN ('LOAN_TXN','BANK_PLEDGE','BANK_PLEDGE_REL','AUCTION_SALE'))
       AND EXISTS (SELECT 1 FROM voucher_entries c WHERE c.voucher_id = e.voucher_id AND c.ledger_id = :cash)
     GROUP BY l.id ORDER BY l.id`, { ...p, cash: cashId });
  const always = new Set([1, 2, 4, 5, 6, 9, 10]); // the desktop always lists these
  const accounts = [
    // post: rows the Day End writes to the books (auction sales and other vouchers are already vouchers)
    ...Object.values(rows).filter((r) => always.has(r.id) || r.jama || r.nave).map((r) => ({ ...r, jama: round2(r.jama), nave: round2(r.nave), muted: !r.jama && !r.nave, post: r.id !== 8 })),
    ...extra.map((x) => ({ ...x, post: x.id === 11 })), ...others.map((o) => ({ id: o.code || o.id, ledger_id: o.id, nature: o.nature, system_key: o.system_key, name: o.name, jama: num(o.jama), nave: num(o.nave) })),
  ];
  const opening = await openingBalance(cashId, b, from);
  const jama = round2(accounts.reduce((s2, a) => s2 + num(a.jama), 0));
  const nave = round2(accounts.reduce((s2, a) => s2 + num(a.nave), 0));
  const modes = await query(`SELECT IF(t.txn_type IN ('DISBURSE','TOPUP'), 'PAID', 'RECEIVED') dir, p.mode, SUM(p.amount) amount
      FROM transaction_payments p JOIN loan_transactions t ON t.id = p.transaction_id
     WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_date BETWEEN :f AND :t GROUP BY dir, p.mode`, p);
  const count = branchId ? await queryOne('SELECT * FROM cash_denominations WHERE branch_id = :b AND count_date = :d', { b: branchId, d: to }) : null;
  const closed = branchId ? await lastClosedDate(branchId) : null;
  const online = (dir) => round2(modes.filter((m) => m.dir === dir && m.mode !== 'CASH').reduce((s2, m) => s2 + num(m.amount), 0));
  const poteBaki = round2(opening + jama - nave);
  const cashInDrawer = round2(poteBaki - online('RECEIVED') + online('PAID'));
  return {
    from, to, accounts, opening, jama, nave, closing: poteBaki, modes,
    tally: { poteBaki, cashInDrawer, onlineReceived: online('RECEIVED'), onlinePaid: online('PAID'), counted: count ? num(count.total) : null, countDiff: count ? num(count.difference) : null },
    dayClosed: closed && !dayjs(to).isAfter(dayjs(closed)), lastClosed: closed,
  };
};
