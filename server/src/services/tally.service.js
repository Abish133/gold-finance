import dayjs from 'dayjs';
import { query } from '#config/db.js';
import { round2, num } from '#utils/money.js';
import { dayReport } from './dayreport.service.js';
import { getSettings } from './settings.service.js';

/*
 * Tally export the desktop way (MyBook "Tally Export"):
 *  - every Day Report row of a CLOSED day becomes vouchers: paid side = Payment (row Dr / Cash Cr), received side = Receipt (Cash Dr / row Cr)
 *  - old loan entries -> Journal  Girvi Dr / Old Loan Opening Cr  (dated the day they were entered)
 *  - auction sales    -> Receipt  Cash Dr / Auction Cr            (on the sale date)
 * Tally ledger names and groups can be renamed (Ledgers tab) and are kept in TALLY_LEDGER_MAP.
 */
export const BOOK_LEDGERS = [
  ['CASH', '-', 'Cash in hand', 'Cash', 'Cash-in-Hand'],
  ['GIRVI', '1', 'Girvi', 'Girvi', 'Loans & Advances (Asset)'],
  ['INTEREST', '2', 'Interest', 'Interest', 'Direct Incomes'],
  ['OTHER', '3', 'Other Charges', 'Other Charges', 'Direct Incomes'],
  ['DOC', '4', 'Document Charges', 'Document Charges', 'Direct Incomes'],
  ['ASHAL', '5', 'Ashal Jama', 'Ashal Jama', 'Loans & Advances (Asset)'],
  ['INTJAMA', '6', 'Interest Jama', 'Interest Jama', 'Direct Incomes'],
  ['DISCOUNT', '7', 'Discount', 'Discount Allowed', 'Indirect Expenses'],
  ['AUCTION', '8', 'Auction', 'Auction', 'Current Assets'],
  ['POTALI', '9', 'Potali', 'Potali', 'Secured Loans'],
  ['POTALI_INT', '10', 'Potali Interest', 'Potali Interst', 'Indirect Expenses'],
  ['BANK_CHARGES', '11', 'Bank Loan Charges (Potali)', 'Bank Loan Charges', 'Indirect Expenses'],
  ['OLD_OPENING', '13', 'Old Loan Opening', 'Old Loan Opening', 'Current Assets'],
].map(([key, code, account, name, group]) => ({ key, code, account, name, group }));
const ROW_KEY = { 1: 'GIRVI', 2: 'INTEREST', 3: 'OTHER', 4: 'DOC', 5: 'ASHAL', 6: 'INTJAMA', 7: 'DISCOUNT', 8: 'AUCTION', 9: 'POTALI', 10: 'POTALI_INT', 11: 'BANK_CHARGES' };
export const TALLY_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Loans & Advances (Asset)', 'Current Assets', 'Fixed Assets', 'Capital Account', 'Secured Loans', 'Unsecured Loans',
  'Current Liabilities', 'Direct Incomes', 'Indirect Incomes', 'Direct Expenses', 'Indirect Expenses'];
const OUR_GROUP = { 'Direct Income': 'Direct Incomes', 'Indirect Income': 'Indirect Incomes', 'Loans (Liability)': 'Secured Loans' };

const ledgerMap = (settings) => {
  let saved = {};
  try { saved = JSON.parse(settings.TALLY_LEDGER_MAP || '{}') || {}; } catch { saved = {}; }
  return saved;
};

export const tallyVouchers = async ({ branchIds, from, to }) => {
  const settings = await getSettings(0);
  const map = ledgerMap(settings);
  const prefix = settings.TALLY_VCH_PREFIX || 'GF';
  const ledgers = new Map(BOOK_LEDGERS.map((l) => [l.key, { ...l, name: map[l.key]?.name || l.name, group: map[l.key]?.group || l.group, entries: 0 }]));
  const led = (key, fallback) => {
    if (!ledgers.has(key)) ledgers.set(key, { key, code: fallback.code || '', account: fallback.name, name: map[key]?.name || fallback.name, group: map[key]?.group || fallback.group || 'Indirect Expenses', entries: 0 });
    const l = ledgers.get(key); l.entries += 1; return l.name;
  };
  const raw = [];
  // old loan entries (opening loans) on the day they were entered
  const olds = await query(`SELECT DATE(t.created_at) d, l.bill_no, l.principal FROM loan_transactions t JOIN loans l ON l.id = t.loan_id
     WHERE t.branch_id IN (:b) AND t.is_void = 0 AND t.txn_type = 'DISBURSE' AND COALESCE(t.remarks, '') = 'Old loan entry' AND DATE(t.created_at) BETWEEN :f AND :t ORDER BY t.id`, { b: branchIds, f: from, t: to });
  for (const o of olds) raw.push({ date: dayjs(o.d).format('YYYY-MM-DD'), sort: 0, type: 'Journal', dr: ['GIRVI'], cr: ['OLD_OPENING'], amount: num(o.principal), narration: `Old Loan Opening - Loan ${o.bill_no}` });
  // auction sales on their sale date
  const sales = await query(`SELECT a.sale_date d, a.sale_amount, l.bill_no FROM auction_sales a JOIN loans l ON l.id = a.loan_id
     WHERE a.branch_id IN (:b) AND a.sale_voucher_id IS NOT NULL AND a.sale_date BETWEEN :f AND :t ORDER BY a.id`, { b: branchIds, f: from, t: to });
  for (const x of sales) raw.push({ date: dayjs(x.d).format('YYYY-MM-DD'), sort: 1.5, type: 'Receipt', dr: ['CASH'], cr: ['AUCTION'], amount: num(x.sale_amount), narration: `Auction Sale - Loan ${x.bill_no}` });
  // Day End rows of every closed day, branch by branch
  const closed = await query('SELECT branch_id, close_date d FROM day_closes WHERE branch_id IN (:b) AND close_date BETWEEN :f AND :t ORDER BY close_date, branch_id', { b: branchIds, f: from, t: to });
  for (const c of closed) {
    const d = dayjs(c.d).format('YYYY-MM-DD');
    const rep = await dayReport({ branchIds: [c.branch_id], branchId: c.branch_id, from: d, to: d });
    const rows = [...rep.accounts].sort((a, b2) => (ROW_KEY[a.id] === 'AUCTION' ? -1 : 0) - (ROW_KEY[b2.id] === 'AUCTION' ? -1 : 0));
    for (const r of rows) {
      const key = ROW_KEY[r.id] || `L:${r.name}`;
      const meta = { code: String(r.id), name: r.name, group: OUR_GROUP[r.group] || r.group };
      const label = `Day End ${dayjs(d).format('DD/MM/YYYY')} - ${ledgers.get(key)?.account || r.name}`;
      if (num(r.nave) > 0) raw.push({ date: d, sort: key === 'AUCTION' ? 1 : 2, type: 'Payment', dr: [key, meta], cr: ['CASH'], amount: num(r.nave), narration: label, pair: true });
      if (num(r.jama) > 0 && key !== 'AUCTION') raw.push({ date: d, sort: 2, type: 'Receipt', dr: ['CASH'], cr: [key, meta], amount: num(r.jama), narration: label, second: num(r.nave) > 0 });
    }
  }
  raw.sort((a, b2) => a.date.localeCompare(b2.date) || a.sort - b2.sort);
  let n = 0;
  const vouchers = raw.map((v) => {
    if (!v.second) n += 1;
    return { date: v.date, type: v.type, no: `${prefix}-${n}${v.second ? '-2' : ''}`, debit: led(v.dr[0], v.dr[1] || {}), credit: led(v.cr[0], v.cr[1] || {}), amount: round2(v.amount), narration: v.narration };
  });
  const sum = (t) => vouchers.filter((v) => v.type === t);
  return {
    from, to, vouchers, closedDays: closed.length,
    ledgers: [...ledgers.values()].map((l) => ({ key: l.key, code: l.code, account: l.account, name: l.name, group: l.group, entries: l.entries })),
    totals: { receipts: sum('Receipt').length, payments: sum('Payment').length, contra: sum('Contra').length, journal: sum('Journal').length, amount: round2(vouchers.reduce((t, v) => t + v.amount, 0)) },
  };
};

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const tallyXml = (d, company) => {
  const masters = d.ledgers.filter((l) => l.entries).map((l) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${esc(l.name)}" ACTION="Create"><NAME>${esc(l.name)}</NAME><PARENT>${esc(l.group)}</PARENT></LEDGER></TALLYMESSAGE>`).join('\n');
  const vch = d.vouchers.map((v) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${v.type}" ACTION="Create"><DATE>${dayjs(v.date).format('YYYYMMDD')}</DATE><VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME><VOUCHERNUMBER>${esc(v.no)}</VOUCHERNUMBER><NARRATION>${esc(v.narration)}</NARRATION>`
    + `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(v.debit)}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${v.amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`
    + `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(v.credit)}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${v.amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER></TALLYMESSAGE>`).join('\n');
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>
${masters}
${vch}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
};

/** Post to TallyPrime's HTTP server (Tally: F1 Help > Settings > Connectivity > "TallyPrime acts as Server", port 9000). */
export const postToTally = async (xml, host, port) => {
  const res = await fetch(`http://${host || 'localhost'}:${port || 9000}`, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  const pick = (tag) => Number((text.match(new RegExp(`<${tag}>(\\d+)</${tag}>`)) || [])[1] || 0);
  return { ok: res.ok && !pick('ERRORS'), created: pick('CREATED'), altered: pick('ALTERED'), errors: pick('ERRORS'), raw: text.slice(0, 2000) };
};
