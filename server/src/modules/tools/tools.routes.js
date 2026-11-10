import { Router } from 'express';
import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit } from '#middleware/auth.js';
import { requireBranch } from '#middleware/branch.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { nextNumber, setNumber } from '#services/sequence.service.js';
import { writeBackupFile } from '#services/backup.service.js';
import { createLoan } from '#modules/loans/loans.service.js';
import { openingBalance } from '#modules/accounts/accounts.service.js';
import { getSettings, saveSettings } from '#services/settings.service.js';
import { tallyVouchers, tallyXml, postToTally, TALLY_GROUPS } from '#services/tally.service.js';

const router = Router();

/* ============================================================ Bank reconciliation */

/** Entries of a bank ledger with their bank (cleared) date. */
router.get('/bank-reco', permit('acc_bank_reco', 'view'), async (req, res) => {
  const ledgerId = Number(req.query.ledger_id);
  if (!ledgerId) throw ApiError.badRequest('Select bank account');
  const from = req.query.from || dayjs().subtract(1, 'month').format('YYYY-MM-DD');
  const to = req.query.to || dayjs().format('YYYY-MM-DD');
  const show = req.query.show || 'pending';
  const rows = await query(`SELECT e.id, e.entry_date, e.debit, e.credit, e.bank_date, e.reference, COALESCE(e.narration, v.narration) narration, v.voucher_no, v.voucher_type
    FROM voucher_entries e JOIN vouchers v ON v.id = e.voucher_id
    WHERE e.ledger_id = :l AND e.branch_id IN (:b) AND e.entry_date BETWEEN :f AND :t
      ${show === 'pending' ? 'AND e.bank_date IS NULL' : show === 'cleared' ? 'AND e.bank_date IS NOT NULL' : ''}
    ORDER BY e.entry_date, e.id`, { l: ledgerId, b: req.branchIds, f: from, t: to });
  // statement: as per books on `to`, minus items not yet in bank
  const asPerBooks = await openingBalance(ledgerId, req.branchIds, dayjs(to).add(1, 'day').format('YYYY-MM-DD'));
  const [nb] = await query(`SELECT COALESCE(SUM(debit),0) dep, COALESCE(SUM(credit),0) wd FROM voucher_entries
    WHERE ledger_id = :l AND branch_id IN (:b) AND entry_date <= :t AND (bank_date IS NULL OR bank_date > :t)`, { l: ledgerId, b: req.branchIds, t: to });
  const shouldBeInBank = round2(asPerBooks - num(nb.dep) + num(nb.wd));
  res.json({ data: { entries: rows, statement: { asPerBooks, depositsNotInBank: round2(nb.dep), withdrawalsNotInBank: round2(nb.wd), shouldBeInBank } } });
});

router.put('/bank-reco', permit('acc_bank_reco', 'edit'), async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  if (!ids.length) throw ApiError.badRequest('Select entries');
  await query('UPDATE voucher_entries SET bank_date = :d WHERE id IN (:ids) AND branch_id IN (:b)', { d: req.body.bank_date || null, ids, b: req.branchIds });
  audit(req, 'BANK_RECO', 'voucher_entries', ids.join(','), { bank_date: req.body.bank_date });
  res.json({ ok: true });
});

/* ============================================================ Tally export (desktop: Day End rows, old loan journals, auction sales) */

const tallyRange = (req) => ({ branchIds: req.branchIds, from: req.query.from || req.body?.from || dayjs().startOf('month').format('YYYY-MM-DD'), to: req.query.to || req.body?.to || dayjs().format('YYYY-MM-DD') });
const logTally = (req, d, how, result) => query("INSERT INTO export_logs (branch_id, export_type, from_date, to_date, records, created_by) VALUES (:b, 'TALLY', :f, :t, :n, :u)",
  { b: req.branchId || req.branchIds[0], f: d.from, t: d.to, n: d.vouchers.length, u: req.user.id }).then(() => audit(req, 'TALLY_EXPORT', 'vouchers', null, { from: d.from, to: d.to, count: d.vouchers.length, how, ...result }));

router.get('/tally/preview', permit('acc_tally', 'view'), async (req, res) => {
  const d = await tallyVouchers(tallyRange(req));
  const s = await getSettings(0);
  const last = await queryOne("SELECT * FROM export_logs WHERE export_type = 'TALLY' AND branch_id IN (:b) ORDER BY id DESC LIMIT 1", { b: req.branchIds });
  res.json({ data: { ...d, lastSent: last, groups: TALLY_GROUPS, tally: { host: s.TALLY_HOST, port: s.TALLY_PORT, company: s.TALLY_COMPANY } } });
});

router.get('/tally/xml', permit('acc_tally', 'export'), async (req, res) => {
  const d = await tallyVouchers(tallyRange(req));
  const s = await getSettings(0);
  const company = req.query.company || s.TALLY_COMPANY || (await queryOne('SELECT name FROM company LIMIT 1'))?.name || '';
  await logTally(req, d, 'xml');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tally-${d.from}-to-${d.to}.xml"`);
  res.send(tallyXml(d, company));
});

/* Send to Tally: the server posts the XML to TallyPrime on the shop computer */
router.post('/tally/send', permit('acc_tally', 'export'), async (req, res) => {
  const d = await tallyVouchers(tallyRange(req));
  if (!d.vouchers.length) throw ApiError.badRequest('No vouchers to send - close the days (Day End) first');
  const s = await getSettings(0);
  const company = req.body.company || s.TALLY_COMPANY || (await queryOne('SELECT name FROM company LIMIT 1'))?.name || '';
  let r;
  try { r = await postToTally(tallyXml(d, company), s.TALLY_HOST, s.TALLY_PORT); } catch (e) { throw ApiError.badRequest(`Tally not reachable at ${s.TALLY_HOST || 'localhost'}:${s.TALLY_PORT || 9000} - open TallyPrime and switch on "acts as Server" (${e.message})`); }
  if (!r.ok) throw ApiError.badRequest(`Tally refused: ${r.errors} error(s). ${r.raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`);
  await logTally(req, d, 'send', { created: r.created });
  res.json({ data: { sent: d.vouchers.length, created: r.created, altered: r.altered } });
});

router.post('/tally/test', permit('acc_tally', 'view'), async (req, res) => {
  const host = req.body.host || 'localhost'; const port = req.body.port || 9000;
  try {
    const r = await fetch(`http://${host}:${port}`, { signal: AbortSignal.timeout(5000) });
    res.json({ data: { ok: true, message: (await r.text()).replace(/<[^>]+>/g, ' ').trim().slice(0, 120) || 'Tally answered' } });
  } catch (e) { res.json({ data: { ok: false, message: `No answer from ${host}:${port} (${e.message})` } }); }
});

/* Ledgers tab: Tally ledger names / groups + Tally address */
router.put('/tally/settings', permit('acc_tally', 'edit'), async (req, res) => {
  const b = req.body || {};
  const map = Object.fromEntries((b.ledgers || []).filter((l) => l.key).map((l) => [l.key, { name: String(l.name || '').slice(0, 100), group: l.group }]));
  const values = { TALLY_LEDGER_MAP: JSON.stringify(map) };
  if (b.host != null) values.TALLY_HOST = String(b.host);
  if (b.port != null) values.TALLY_PORT = String(b.port);
  if (b.company != null) values.TALLY_COMPANY = String(b.company);
  await saveSettings(values, 0);
  audit(req, 'UPDATE', 'settings', 0, { tally: true });
  res.json({ ok: true });
});

router.get('/tally/history', permit('acc_tally', 'view'), async (req, res) => {
  res.json({ data: await query("SELECT x.*, u.full_name FROM export_logs x LEFT JOIN users u ON u.id = x.created_by WHERE x.export_type = 'TALLY' AND x.branch_id IN (:b) ORDER BY x.id DESC LIMIT 50", { b: req.branchIds }) });
});

/* ============================================================ Start fresh */

const BRANCH_DATA = ['auction_sales', 'auction_notices', 'stock_checks', 'print_logs', 'cash_denominations', 'day_closes', 'salary_payments', 'employee_attendance',
  'bank_pledges', 'message_queue'];

/** What Start Fresh will remove in this branch (desktop shows the counts before you confirm). */
router.get('/start-fresh-preview', permit('s_start_fresh', 'view'), requireBranch, async (req, res) => {
  const p = { b: req.branchId };
  const one = async (sql) => Number((await queryOne(sql, p))?.c || 0);
  const t = (types) => one(`SELECT COUNT(*) c FROM loan_transactions WHERE branch_id = :b AND txn_type IN (${types})`);
  const rows = [
    ['Loans (new / old / re-loan)', await one('SELECT COUNT(*) c FROM loans WHERE branch_id = :b')],
    ['Releases and part payments', await t("'RELEASE','PART_PAYMENT'")],
    ['Interest and top-up entries', await t("'INTEREST','TOPUP'")],
    ['Bank re-pledge entries', await one('SELECT COUNT(*) c FROM bank_pledges WHERE branch_id = :b')],
    ['Cash and account entries', await one('SELECT COUNT(*) c FROM vouchers WHERE branch_id = :b')],
    ['Day End records', await one('SELECT COUNT(*) c FROM day_closes WHERE branch_id = :b')],
    ['Auction entries', await one('SELECT (SELECT COUNT(*) FROM auction_sales WHERE branch_id = :b) + (SELECT COUNT(*) FROM auction_notices WHERE branch_id = :b) c')],
    ['Stock check records', await one('SELECT COUNT(*) c FROM stock_checks WHERE branch_id = :b')],
    ['Employee salary and attendance entries', await one('SELECT (SELECT COUNT(*) FROM salary_payments WHERE branch_id = :b) + (SELECT COUNT(*) FROM employee_attendance WHERE branch_id = :b) c')],
    ['SMS queue and print / notice logs', await one('SELECT (SELECT COUNT(*) FROM message_queue WHERE branch_id = :b) + (SELECT COUNT(*) FROM print_logs WHERE branch_id = :b) c')],
    ['Customers who had practice loans', await one('SELECT COUNT(DISTINCT customer_id) c FROM loans WHERE branch_id = :b')],
  ];
  res.json({ data: { rows: rows.map(([label, count]) => ({ label, count })), today: dayjs().format('YYYY-MM-DD') } });
});

/** Remove practice entries of one branch (loans, receipts, vouchers...). Masters stay. Super admin + password. */
router.post('/start-fresh', permit('s_start_fresh', 'delete'), requireBranch, async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can start fresh');
  if (req.body.confirm !== 'START FRESH') throw ApiError.badRequest('Type START FRESH to confirm');
  const me = await queryOne('SELECT password_hash FROM users WHERE id = :id', { id: req.user.id });
  if (!(await bcrypt.compare(req.body.password || '', me.password_hash))) throw ApiError.forbidden('Password is wrong');
  // a full safety backup is saved on the server first (Settings > Backup > Restore can bring it back)
  const safety = await writeBackupFile({ type: 'Before start fresh', userId: req.user.id, keep: 10 });
  const b = req.branchId;
  const nextLoanNo = Math.max(1, parseInt(req.body.next_loan_no, 10) || 1);
  const start = req.body.start_date ? dayjs(req.body.start_date) : null;
  if (start && (!start.isValid() || start.isAfter(dayjs(), 'day'))) throw ApiError.badRequest('Start date cannot be after today');
  await withTransaction(async (tx) => {
    // customers who only came for practice loans go with them; customers without any loan stay
    const practice = req.body.customers ? (await tx.query('SELECT DISTINCT customer_id id FROM loans WHERE branch_id = :b', { b })).map((r) => r.id) : [];
    await tx.query('DELETE p FROM bank_pledge_loans p JOIN bank_pledges bp ON bp.id = p.bank_pledge_id WHERE bp.branch_id = :b', { b });
    for (const t of BRANCH_DATA) await tx.query(`DELETE FROM ${t} WHERE branch_id = :b`, { b });
    await tx.query('DELETE FROM release_by_other WHERE loan_id IN (SELECT id FROM loans WHERE branch_id = :b)', { b });
    await tx.query('DELETE FROM loan_transactions WHERE branch_id = :b', { b });
    await tx.query('DELETE FROM loans WHERE branch_id = :b', { b });
    await tx.query('DELETE FROM vouchers WHERE branch_id = :b', { b });
    if (practice.length) {
      await tx.query("DELETE FROM documents WHERE owner_type = 'CUSTOMER' AND owner_id IN (:ids)", { ids: practice });
      await tx.query('DELETE FROM customers WHERE id IN (:ids) AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.customer_id = customers.id)', { ids: practice });
    }
    const left = await tx.queryOne('SELECT COUNT(*) c FROM customers WHERE branch_id = :b', { b });
    await tx.query(`DELETE FROM number_sequences WHERE branch_id = :b AND seq_key IN ('LOAN','RECEIPT','RELEASE','VCH'${Number(left.c) ? '' : ",'CUSTOMER'"})`, { b });
    // next loan no: set for both the running and the yearly-reset sequence
    if (nextLoanNo > 1) {
      const fy = await tx.queryOne('SELECT id FROM financial_years WHERE is_current = 1');
      for (const fyId of [0, fy?.id].filter((x) => x != null)) await setNumber(tx, { branchId: b, key: 'LOAN', fyId, lastNo: nextLoanNo - 1 });
    }
    // start (billing) date: the day before is marked closed so the billing date starts there
    if (start && start.isBefore(dayjs(), 'day')) {
      await tx.query('INSERT INTO day_closes (branch_id, close_date, opening_cash, closing_cash, summary, closed_by) VALUES (:b, :d, 0, 0, :s, :u)',
        { b, d: start.subtract(1, 'day').format('YYYY-MM-DD'), s: JSON.stringify({ startFresh: true }), u: req.user.id });
    }
  });
  audit(req, 'START_FRESH', 'branches', b, { customers: !!req.body.customers, next_loan_no: nextLoanNo, start_date: start?.format('YYYY-MM-DD') || null, safety: safety.file });
  res.json({ ok: true, safety: safety.file });
});

/* ============================================================ Import (database migration) */

/**
 * Bulk import from CSV/Excel exported out of the old software.
 * type=customers : rows [{ customer_no?, title, name, relation_type, relation_name, door_no, street, area, city, pincode, phone, id_proof_type, id_proof_no }]
 * type=loans     : rows [{ loan_no, loan_date, customer_phone|customer_no, amount, rate, item_name, pcs, gross_wt, stone_wt, purity, bill_book_no }]
 * Loans are imported as OLD (opening) loans so today's cash is untouched.
 */
router.post('/import', permit('s_import', 'add'), requireBranch, async (req, res) => {
  const { type, rows = [], scheme_id } = req.body;
  if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest('No rows to import');
  if (rows.length > 5000) throw ApiError.badRequest('Import at most 5000 rows at a time');
  const result = { imported: 0, skipped: 0, errors: [] };
  if (type === 'customers') {
    for (const [i, r] of rows.entries()) {
      try {
        if (!r.name || !r.phone) throw new Error('name and phone are required');
        await withTransaction(async (tx) => {
          const no = r.customer_no ? Number(r.customer_no) : await nextNumber(tx, { branchId: req.branchId, key: 'CUSTOMER' });
          const dup = await tx.queryOne('SELECT id FROM customers WHERE branch_id = :b AND customer_no = :n', { b: req.branchId, n: no });
          if (dup) throw new Error(`customer no ${no} already exists`);
          await tx.query(`INSERT INTO customers (branch_id, customer_no, title, name, relation_type, relation_name, door_no, street, area, city, pincode, phone, alt_phone, id_proof_type, id_proof_no, created_by)
            VALUES (:b, :no, :title, :name, :rt, :rn, :door, :street, :area, :city, :pin, :phone, :alt, :idt, :idn, :u)`,
          { b: req.branchId, no, title: r.title || null, name: r.name, rt: r.relation_type || null, rn: r.relation_name || null, door: r.door_no || null, street: r.street || null,
            area: r.area || null, city: r.city || null, pin: r.pincode || null, phone: String(r.phone), alt: r.alt_phone || null, idt: r.id_proof_type || null, idn: r.id_proof_no || null, u: req.user.id });
          if (r.customer_no) await tx.query(`INSERT INTO number_sequences (branch_id, seq_key, fy_id, last_no) VALUES (:b, 'CUSTOMER', 0, :n) ON DUPLICATE KEY UPDATE last_no = GREATEST(last_no, :n)`, { b: req.branchId, n: no });
        });
        result.imported += 1;
      } catch (e) { result.skipped += 1; result.errors.push({ row: i + 2, error: e.message }); }
    }
  } else if (type === 'loans') {
    if (!scheme_id) throw ApiError.badRequest('Select the scheme for imported loans');
    const groups = {};
    for (const [i, r] of rows.entries()) (groups[r.loan_no || `row${i}`] ||= []).push({ ...r, __row: i + 2 });
    for (const list of Object.values(groups)) {
      const r = list[0];
      try {
        const cust = await queryOne('SELECT id FROM customers WHERE branch_id = :b AND (phone = :p OR customer_no = :n) ORDER BY customer_no = :n DESC LIMIT 1',
          { b: req.branchId, p: String(r.customer_phone || ''), n: Number(r.customer_no) || -1 });
        if (!cust) throw new Error('customer not found (import customers first)');
        await createLoan({ ...req, body: {} }, {
          customer_id: cust.id, scheme_id, loan_no: r.loan_no, loan_date: dayjs(r.loan_date).format('YYYY-MM-DD'), principal: num(r.amount), interest_rate: r.rate,
          manual_bill_no: r.bill_book_no || String(r.loan_no), skipEligibility: true, rate_per_gram: num(r.rate_per_gram) || 1, interest_type: r.interest_type,
          items: list.map((x) => ({ item_name: x.item_name || 'Jewel', pcs: x.pcs || 1, gross_wt: x.gross_wt, stone_wt: x.stone_wt || 0, purity: x.purity || 91.6, rate_per_gram: num(x.rate_per_gram) || 1 })),
        }, 'OLD').catch((e) => { throw e; });
        result.imported += 1;
      } catch (e) { result.skipped += 1; result.errors.push({ row: r.__row, error: e.message }); }
    }
  } else throw ApiError.badRequest('Unknown import type');
  audit(req, 'IMPORT', type, null, { imported: result.imported, skipped: result.skipped });
  res.json({ data: { ...result, errors: result.errors.slice(0, 200) } });
});

export default router;
