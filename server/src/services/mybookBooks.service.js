import dayjs from 'dayjs';
import { query } from '#config/db.js';
import { round2, num } from '#utils/money.js';
import { dayReport } from './dayreport.service.js';

/*
 * Final accounts in the desktop (MyBook) layout: the books are the Day Report heads, not our detailed ledgers.
 *   1 Girvi (loans given - released), 2 Interest, 4 Document Charges, 5 Ashal Jama (part amounts), 6 Interest Jama,
 *   8 Auction, 9 Potali (bank girvi), 10 Potali Interest, 11 Bank Loan Charges, 13 Old Loan Opening, other vouchers by account, Cash.
 * The money is the same as the detailed books; only the grouping differs (part payments are a separate head, old loans are
 * "Old Loan Opening" and interest is split into Interest / Interest Jama).
 */
const BEGIN = '2000-01-01';
// MyBook groups: shown in the Trial Balance "Group" column; nature decides P&L / Balance Sheet
const HEAD = {
  1: ['LIABILITY', 'Loans (Girvi)'], 2: ['INCOME'], 3: ['INCOME'], 4: ['INCOME'], 5: ['ASSET'], 6: ['INCOME'], 7: ['EXPENSE'],
  8: ['LIABILITY'], 9: ['ASSET'], 10: ['EXPENSE'], 11: ['EXPENSE'], 13: ['ASSET'],
};
const NAMES = { 1: 'Girvi', 5: 'Ashal Jama', 6: 'Interest Jama', 9: 'Potali', 11: 'Bank Loan Charges (Potali)' };
const GIRVI_INCOME = new Set([2, 3, 4, 6]);

const heads = async (branchIds, from, to) => {
  const rep = await dayReport({ branchIds, branchId: null, from, to });
  const map = new Map();
  const add = (key, row) => {
    const cur = map.get(key) || { ...row, balance: 0 };
    cur.balance = round2(cur.balance + num(row.balance));
    map.set(key, cur);
  };
  for (const a of rep.accounts) {
    const fixed = HEAD[a.id] && !a.ledger_id;
    const nature = fixed ? HEAD[a.id][0] : (a.nature || 'EXPENSE');
    add(fixed ? `H${a.id}` : `L${a.ledger_id || a.name}`, {
      code: String(a.id), name: fixed ? (NAMES[a.id] || a.name.replace(/\s*\(.*\)$/, '')) : a.name, ledger_id: a.ledger_id || null, nature,
      section: fixed && GIRVI_INCOME.has(a.id) ? 'From Girvi (Day End)' : fixed && a.id === 1 ? 'Loans (Girvi)' : null,
      balance: round2(num(a.nave) - num(a.jama)),
    });
  }
  // old loan entries: Girvi Dr / Old Loan Opening Cr, on the day they were entered
  const [old] = await query(`SELECT COALESCE(SUM(l.principal),0) amt FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
     WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'DISBURSE' AND COALESCE(t.remarks, '') = 'Old loan entry' AND DATE(t.created_at) BETWEEN :f AND :t`,
  { b: branchIds, f: from, t: to });
  if (num(old.amt)) {
    add('H1', { code: '1', name: 'Girvi', nature: 'LIABILITY', section: 'Loans (Girvi)', balance: num(old.amt) });
    add('H13', { code: '13', name: 'Old Loan Opening', nature: 'ASSET', balance: -num(old.amt) });
  }
  return { rep, rows: [...map.values()] };
};

const sortRows = (rows) => rows.sort((a, b) => (Number(a.code) || 999) - (Number(b.code) || 999) || a.name.localeCompare(b.name));

/** Trial Balance as on `to` (all entries up to that day). Cash in hand is the balancing line. */
export const mybookTrialBalance = async (branchIds, to) => {
  const { rep, rows } = await heads(branchIds, BEGIN, to);
  const opening = num(rep.opening);
  const list = sortRows(rows).map((r) => ({ ...r, id: r.ledger_id || `H${r.code}` }));
  if (opening) list.push({ id: 'OPEN', code: '', name: 'Opening Balance (cash)', nature: 'EQUITY', balance: round2(-opening) });
  // money through UPI / card / cheque is in the bank, not the drawer
  const online = round2(num(rep.tally.onlineReceived) - num(rep.tally.onlinePaid));
  if (online) list.push({ id: 'BANK', code: '', name: 'Bank (online / card / cheque)', nature: 'ASSET', balance: online });
  list.push({ id: 'CASH', code: '', system_key: 'CASH', name: 'Cash in hand (Pote Baki)', nature: 'ASSET', balance: round2(rep.closing - online) });
  const dr = round2(list.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0));
  const cr = round2(list.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0));
  return { rows: list, totalDebit: dr, totalCredit: cr, books: 'mybook' };
};

/** Profit & Loss between dates: income / expense heads of the Day Report. */
export const mybookProfitLoss = async (branchIds, from, to) => {
  const { rows } = await heads(branchIds, from, to);
  const pl = sortRows(rows.filter((r) => r.nature === 'INCOME' || r.nature === 'EXPENSE'));
  const income = pl.filter((r) => r.nature === 'INCOME').map((r) => ({ ...r, id: r.ledger_id || `H${r.code}`, amount: round2(-r.balance) }));
  const expense = pl.filter((r) => r.nature === 'EXPENSE').map((r) => ({ ...r, id: r.ledger_id || `H${r.code}`, amount: round2(r.balance) }));
  const ti = round2(income.reduce((s, r) => s + r.amount, 0));
  const te = round2(expense.reduce((s, r) => s + r.amount, 0));
  return { income, expense, totalIncome: ti, totalExpense: te, netProfit: round2(ti - te), books: 'mybook' };
};

/** Balance Sheet as on `to`: a Jama balance goes under Capital / Liabilities, a Nave balance under Assets (as the desktop). */
export const mybookBalanceSheet = async (branchIds, to, from) => {
  const tb = await mybookTrialBalance(branchIds, to);
  const bsRows = tb.rows.filter((r) => r.nature !== 'INCOME' && r.nature !== 'EXPENSE');
  const profit = round2(-tb.rows.filter((r) => r.nature === 'INCOME' || r.nature === 'EXPENSE').reduce((s, r) => s + r.balance, 0));
  const capital = bsRows.filter((r) => r.nature === 'EQUITY').map((r) => ({ ...r, section: 'Capital', amount: round2(-r.balance) }));
  const liabilities = [
    ...capital,
    { id: 'PL', name: `Add: Net Profit${from ? ` (${dayjs(from).format('DD/MM/YYYY')} - ${dayjs(to).format('DD/MM/YYYY')})` : ''}`, section: 'Capital', profit: true, amount: profit },
    ...bsRows.filter((r) => r.nature !== 'EQUITY' && r.balance < 0).map((r) => ({ ...r, section: 'Liabilities', amount: round2(-r.balance) })),
  ];
  const assets = bsRows.filter((r) => r.nature !== 'EQUITY' && r.balance > 0).map((r) => ({
    ...r, section: r.code === '1' ? 'Loans (Girvi)' : r.system_key === 'CASH' ? 'Cash' : 'Other assets', amount: r.balance,
  })).sort((a, b) => ['Loans (Girvi)', 'Other assets', 'Cash'].indexOf(a.section) - ['Loans (Girvi)', 'Other assets', 'Cash'].indexOf(b.section));
  // the desktop also lists the bank accounts under Other assets, even at 0.00 ("Hide zero accounts" hides them)
  const banks = await query("SELECT ba.ledger_id, CONCAT(ba.bank_name, ' ', COALESCE(ba.bank_branch, ''), ' A/c') name FROM bank_accounts ba WHERE ba.branch_id IN (:b) OR ba.branch_id IS NULL", { b: branchIds });
  for (const k of banks) if (!assets.some((a) => a.ledger_id && a.ledger_id === k.ledger_id)) assets.push({ id: `BA${k.ledger_id}`, ledger_id: k.ledger_id, name: k.name.replace(/\s+/g, ' '), section: 'Other assets', amount: 0, zero: true });
  assets.sort((a, b) => ['Loans (Girvi)', 'Other assets', 'Cash'].indexOf(a.section) - ['Loans (Girvi)', 'Other assets', 'Cash'].indexOf(b.section));
  const ta = round2(assets.reduce((s, r) => s + r.amount, 0));
  const tl = round2(liabilities.reduce((s, r) => s + r.amount, 0));
  return { assets, liabilities, totalAssets: ta, totalLiabilities: tl, difference: round2(ta - tl), books: 'mybook' };
};
