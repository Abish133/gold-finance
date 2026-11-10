import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { can } from '#middleware/auth.js';
import { query, queryOne, withTransaction } from '#config/db.js';
import { assertBranch } from '#middleware/branch.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, round3, num, roundTo } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { nextNumber } from '#services/sequence.service.js';
import { getSettings, getCurrentFy } from '#services/settings.service.js';
import { ensureDateOpen } from '#services/daycontrol.service.js';
import { calculateInterest, eligibility, parseSlabs, itemValue } from '#services/interest.service.js';
import { LEDGER, postVoucher, paymentLines, normalisePayments, voidSourceVouchers } from '#services/accounting.service.js';
import { queueMessage } from '#services/message.service.js';

/* ============================================================ helpers */

export const LOAN_SELECT = `SELECT l.*, c.customer_no, c.title AS customer_title, c.name AS customer_name, c.phone AS customer_phone,
  c.relation_type, c.relation_name, c.door_no, c.street, c.area, c.city, c.pincode, c.photo AS customer_photo_master, c.status AS customer_status, c.id_proof_type, c.id_proof_no,
  s.code AS scheme_code, s.name AS scheme_name, m.name AS metal_name, b.name AS branch_name, b.code AS branch_code, b.phone AS branch_phone
  FROM loans l
  JOIN customers c ON c.id = l.customer_id
  JOIN schemes s ON s.id = l.scheme_id
  JOIN metals m ON m.id = l.metal_id
  JOIN branches b ON b.id = l.branch_id`;

const fmtBillNo = (fmt, { prefix, no, fy, branch }) =>
  (fmt || '{PREFIX}{NO}').replace('{PREFIX}', prefix || '').replace('{NO}', no).replace('{FY}', fy || '').replace('{BRANCH}', branch || '');

const loadScheme = async (db, id) => {
  const s = await db.queryOne('SELECT * FROM schemes WHERE id = :id', { id });
  if (!s) throw ApiError.badRequest('Invalid scheme');
  return s;
};

const loadTxns = (db, loanId) =>
  db.query('SELECT * FROM loan_transactions WHERE loan_id = :id AND is_void = 0 ORDER BY txn_date, id', { id: loanId });

export const calcOptions = (settings) => ({
  monthRoundHalfDays: num(settings.MONTH_ROUND_HALF_DAYS, 15),
  roundInterestTo: num(settings.ROUND_INTEREST_TO, 1),
  compoundMonths: num(settings.COMPOUND_PERIOD_MONTHS, 12),
  graceDays: num(settings.RELEASE_GRACE_DAYS, 0),
});

/**
 * Admin approval (desktop: frmAdminApproval). Amounts above the limit need a user with the
 * "admin_approval" permission: either the logged-in user, or an approver who types username + password.
 * Throws 428 so the UI can open the approval drawer.
 */
export const checkApproval = async (req, amount, settings, what = 'Discount') => {
  const limit = num(settings.DISCOUNT_APPROVAL_LIMIT, 0);
  if (!limit || num(amount) <= limit) return null;
  if (can(req.user, 'admin_approval', 'add')) return req.user.id;
  const a = req.body?.approval;
  if (!a?.username || !a?.password) throw new ApiError(428, `${what} above ₹${limit} needs admin approval`, { needApproval: true, limit });
  const u = await queryOne('SELECT * FROM users WHERE username = :u AND is_active = 1', { u: a.username });
  if (!u || !(await bcrypt.compare(a.password, u.password_hash))) throw ApiError.forbidden('Approver username or password is wrong');
  if (!u.is_super_admin) {
    const p = await queryOne("SELECT can_add FROM role_permissions WHERE role_id = :r AND screen_key = 'admin_approval'", { r: u.role_id });
    if (!p?.can_add) throw ApiError.forbidden(`${u.full_name} is not allowed to approve`);
  }
  audit(req, 'APPROVAL', 'users', u.id, { what, amount });
  return u.id;
};

/** Desktop rule: no new loan until today's gold / silver rate is entered. */
const ensureTodayRate = async (metalIds) => {
  for (const id of metalIds) {
    const r = await queryOne('SELECT id FROM metal_rates WHERE metal_id = :m AND rate_date = CURDATE() LIMIT 1', { m: id });
    if (!r) {
      const m = await queryOne('SELECT name FROM metals WHERE id = :m', { m: id });
      throw ApiError.badRequest(`Today's ${m?.name || 'metal'} rate is not entered. Enter it in Masters → Gold / Silver Rate first.`);
    }
  }
};

const lockLoan = async (tx, req, id) => {
  const loan = await tx.queryOne('SELECT * FROM loans WHERE id = :id FOR UPDATE', { id });
  if (!loan) throw ApiError.notFound('Loan not found');
  assertBranch(req, loan.branch_id);
  if (req.branchId && loan.branch_id !== req.branchId) throw ApiError.badRequest('Switch to the loan\'s branch to make entries');
  return loan;
};

const requireOpen = (loan) => {
  if (loan.status !== 'OPEN') throw ApiError.badRequest(`Loan is ${loan.status.toLowerCase()}`);
};

const insertTxn = async (tx, req, loan, t, payments) => {
  const fy = await getCurrentFy(tx);
  const settings = await getSettings(loan.branch_id);
  const rno = await nextNumber(tx, { branchId: loan.branch_id, key: 'RECEIPT', fyId: fy.id });
  const r = await tx.query(
    `INSERT INTO loan_transactions (branch_id, loan_id, receipt_no, txn_date, txn_type, principal_amount, interest_amount, penal_amount,
       charges, discount, total_amount, months_paid, interest_upto, remarks, created_by)
     VALUES (:b, :l, :rno, :d, :t, :p, :i, :pe, :c, :dis, :tot, :m, :upto, :rem, :u)`,
    {
      b: loan.branch_id, l: loan.id, rno: `${settings.RECEIPT_PREFIX || ''}${rno}`, d: t.date, t: t.type,
      p: round2(t.principal || 0), i: round2(t.interest || 0), pe: round2(t.penal || 0), c: round2(t.charges || 0),
      dis: round2(t.discount || 0), tot: round2(t.total || 0), m: t.months || 0, upto: t.upto || null, rem: t.remarks || null, u: req.user.id,
    },
  );
  for (const p of payments || []) {
    await tx.query('INSERT INTO transaction_payments (transaction_id, mode, bank_account_id, amount, reference) VALUES (:t, :m, :b, :a, :r)',
      { t: r.insertId, m: p.mode || 'CASH', b: p.bank_account_id || null, a: round2(p.amount), r: p.reference || null });
  }
  return { id: r.insertId, receipt_no: `${settings.RECEIPT_PREFIX || ''}${rno}`, fyId: fy.id };
};

/* ============================================================ read */

export const getLoan = async (req, id) => {
  const loan = await queryOne(`${LOAN_SELECT} WHERE l.id = :id`, { id });
  if (!loan) throw ApiError.notFound('Loan not found');
  assertBranch(req, loan.branch_id);
  return loan;
};

export const getLoanFull = async (req, id, asOf) => {
  const loan = await getLoan(req, id);
  const [items, txns, scheme, settings, payments, other, notices] = await Promise.all([
    query('SELECT li.*, m.code AS metal_code FROM loan_items li LEFT JOIN metals m ON m.id = li.metal_id WHERE li.loan_id = :id ORDER BY li.id', { id: loan.id }),
    query(`SELECT t.*, u.full_name AS created_by_name FROM loan_transactions t LEFT JOIN users u ON u.id = t.created_by
            WHERE t.loan_id = :id ORDER BY t.txn_date, t.id`, { id: loan.id }),
    loadScheme({ queryOne }, loan.scheme_id),
    getSettings(loan.branch_id),
    query(`SELECT tp.*, ba.bank_name FROM transaction_payments tp JOIN loan_transactions t ON t.id = tp.transaction_id
            LEFT JOIN bank_accounts ba ON ba.id = tp.bank_account_id WHERE t.loan_id = :id`, { id: loan.id }),
    queryOne('SELECT * FROM release_by_other WHERE loan_id = :id', { id: loan.id }),
    query('SELECT * FROM auction_notices WHERE loan_id = :id ORDER BY notice_date', { id: loan.id }),
  ]);
  const calcDate = asOf || (loan.status === 'OPEN' ? dayjs().format('YYYY-MM-DD') : loan.close_date || dayjs().format('YYYY-MM-DD'));
  const calc = calculateInterest({ loan, scheme, txns: txns.filter((t) => !t.is_void && t.txn_type !== 'RELEASE'), asOf: calcDate, options: calcOptions(settings) });
  const byTxn = {};
  for (const p of payments) (byTxn[p.transaction_id] ||= []).push(p);
  return {
    loan, items, scheme, calc, releasedByOther: other, notices,
    transactions: txns.map((t) => ({ ...t, payments: byTxn[t.id] || [] })),
    parent: loan.parent_loan_id ? await queryOne('SELECT id, bill_no, loan_date FROM loans WHERE id = :id', { id: loan.parent_loan_id }) : null,
    child: await queryOne('SELECT id, bill_no, loan_date FROM loans WHERE parent_loan_id = :id', { id: loan.id }),
  };
};

/* ============================================================ create */

const prepareItems = (items, loanRate) => {
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest('Add at least one jewel item');
  return items.map((it) => {
    const gross = round3(it.gross_wt);
    const stone = round3(it.stone_wt);
    const net = it.net_wt != null && it.net_wt !== '' ? round3(it.net_wt) : round3(Math.max(0, gross - stone));
    if (!it.item_name) throw ApiError.badRequest('Item name is required');
    if (gross <= 0 || net <= 0) throw ApiError.badRequest(`Enter weight for ${it.item_name}`);
    if (net > gross) throw ApiError.badRequest(`Net weight cannot exceed gross weight (${it.item_name})`);
    const purity = num(it.purity, 91.6);
    const rate = num(it.rate_per_gram, loanRate);
    const basis = num(it.rate_basis, it.metal_code === 'SILVER' ? 92.5 : 91.6) || 91.6;
    return {
      item_id: it.item_id || null, metal_id: it.metal_id || null, item_name: String(it.item_name).slice(0, 80), pcs: Math.max(1, num(it.pcs, 1)),
      gross_wt: gross, stone_wt: round3(gross - net), net_wt: net, purity, fine_wt: round3((net * purity) / 100), rate_per_gram: rate,
      value: round2(it.value != null && it.value !== '' && it.value_manual ? it.value : itemValue(net, purity, rate, basis)), remarks: it.remarks || null,
    };
  });
};

const itemSummary = (items) => items.map((i) => (i.pcs > 1 ? `${i.item_name} x${i.pcs}` : i.item_name)).join(', ').slice(0, 300);

export const createLoan = async (req, body, entryType = 'NEW') => {
  const settings = await getSettings(req.branchId);
  const date = entryType === 'OLD' ? dayjs(body.loan_date).format('YYYY-MM-DD') : await ensureDateOpen(req, body.loan_date || dayjs().format('YYYY-MM-DD'));

  const customer = await queryOne('SELECT * FROM customers WHERE id = :id', { id: body.customer_id });
  if (!customer) throw ApiError.badRequest('Select a customer');
  assertBranch(req, customer.branch_id);
  if (customer.branch_id !== req.branchId) throw ApiError.badRequest('Customer belongs to another branch');
  if (customer.status === 'BLOCKED' && settings.BLOCK_LOAN_FOR_BLOCKED_CUSTOMER === '1') {
    throw ApiError.badRequest(`Customer is blocked: ${customer.block_reason || ''}`);
  }

  const scheme = await loadScheme({ queryOne }, body.scheme_id);
  const slabs = parseSlabs(scheme.slabs);
  const metals = await query('SELECT id, code FROM metals');
  const metalById = Object.fromEntries(metals.map((m) => [m.id, m.code]));
  const goldId = metals.find((m) => m.code === 'GOLD')?.id;
  const silverId = metals.find((m) => m.code === 'SILVER')?.id;
  const loanOn = ['GOLD', 'SILVER', 'MIX'].includes(body.loan_on) ? body.loan_on : (metalById[scheme.metal_id] === 'SILVER' ? 'SILVER' : 'GOLD');
  for (const it of body.items || []) {
    if (!it.metal_id) it.metal_id = loanOn === 'SILVER' ? silverId : loanOn === 'GOLD' ? goldId : (it.metal_code === 'SILVER' ? silverId : goldId);
    it.metal_code = metalById[it.metal_id];
    if (it.rate_per_gram == null || it.rate_per_gram === '') it.rate_per_gram = it.metal_code === 'SILVER' ? body.silver_rate : body.rate_per_gram;
  }
  const metalId = loanOn === 'SILVER' ? silverId : loanOn === 'GOLD' ? (body.metal_id || scheme.metal_id || goldId) : goldId;
  if (!metalId) throw ApiError.badRequest('Select metal');
  if (entryType === 'NEW' && settings.REQUIRE_TODAY_RATE === '1') {
    await ensureTodayRate([...new Set((body.items || []).map((i) => i.metal_id))]);
  }
  const loanRate = num(body.rate_per_gram);
  const items = prepareItems(body.items, loanRate);
  const totals = eligibility({ items, loanRate, ltvPercent: scheme.ltv_percent, roundStep: num(settings.ROUND_LOAN_TO, 100) });
  totals.market_value = round2(items.reduce((s, i) => s + i.value, 0));
  totals.eligible_amount = Math.floor((totals.market_value * num(scheme.ltv_percent)) / 100 / (num(settings.ROUND_LOAN_TO, 100) || 1)) * (num(settings.ROUND_LOAN_TO, 100) || 1);

  const principal = round2(body.principal);
  if (principal <= 0) throw ApiError.badRequest('Enter loan amount');
  if (principal > totals.eligible_amount && settings.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' && !body.skipEligibility && scheme.calc_mode !== 'MYBOOK') {
    throw ApiError.badRequest(`Loan amount exceeds eligible amount ₹${totals.eligible_amount}`);
  }
  if (num(scheme.min_amount) && principal < num(scheme.min_amount)) throw ApiError.badRequest(`Minimum loan for this scheme is ₹${scheme.min_amount}`);
  if (num(scheme.max_amount) && principal > num(scheme.max_amount)) throw ApiError.badRequest(`Maximum loan for this scheme is ₹${scheme.max_amount}`);

  const rate = num(body.interest_rate, slabs[0].rate);
  const docCharges = body.doc_charges != null && body.doc_charges !== ''
    ? round2(body.doc_charges)
    : round2((principal * num(scheme.doc_charge_percent)) / 100 + num(scheme.doc_charge_fixed));
  const monthly = scheme.rate_type === 'MONTHLY' ? rate / 100 : rate / 100 / 12;
  const advance = body.advance_interest != null && body.advance_interest !== ''
    ? round2(body.advance_interest)
    : round2(roundTo(principal * monthly * num(scheme.advance_interest_months), num(settings.ROUND_INTEREST_TO, 1)));
  const otherCharges = round2(body.other_charges);
  const net = round2(principal - docCharges - advance - otherCharges);
  if (net < 0) throw ApiError.badRequest('Deductions exceed loan amount');
  const payments = entryType === 'OLD' ? [] : normalisePayments(body.payments, net);
  const dueDate = body.due_date || dayjs(date).add(num(scheme.tenure_months, 12), 'month').format('YYYY-MM-DD');

  const result = await withTransaction(async (tx) => {
    const fy = await getCurrentFy(tx);
    const branch = await tx.queryOne('SELECT code, loan_prefix FROM branches WHERE id = :id', { id: req.branchId });
    const seqFy = settings.LOAN_NO_RESET_YEARLY === '1' ? fy.id : 0;
    let loanNo;
    if (entryType === 'OLD' && !body.manual_bill_no) throw ApiError.badRequest('Bill book number is required for old loans');
    if (body.manual_bill_no) {
      const dup = await tx.queryOne('SELECT bill_no FROM loans WHERE branch_id = :b AND manual_bill_no = :m LIMIT 1', { b: req.branchId, m: String(body.manual_bill_no) });
      if (dup) throw ApiError.conflict(`Bill book no ${body.manual_bill_no} is already used on loan ${dup.bill_no}`);
    }
    if (entryType === 'OLD' && !num(body.loan_no)) {
      loanNo = await nextNumber(tx, { branchId: req.branchId, key: 'LOAN', fyId: seqFy });
    } else if (entryType === 'OLD') {
      loanNo = num(body.loan_no);
      if (!loanNo) throw ApiError.badRequest('Enter old loan number');
      const dup = await tx.queryOne('SELECT id FROM loans WHERE branch_id = :b AND fy_id = :f AND loan_no = :n', { b: req.branchId, f: fy.id, n: loanNo });
      if (dup) throw ApiError.conflict(`Loan number ${loanNo} already exists`);
    } else {
      loanNo = await nextNumber(tx, { branchId: req.branchId, key: 'LOAN', fyId: seqFy });
    }
    const billNo = fmtBillNo(settings.LOAN_NO_FORMAT, { prefix: branch.loan_prefix, no: loanNo, fy: fy.name, branch: branch.code });
    const barcode = `${branch.code}${String(loanNo).padStart(6, '0')}`;

    const r = await tx.query(
      `INSERT INTO loans (branch_id, fy_id, loan_no, bill_no, manual_bill_no, barcode, loan_date, due_date, customer_id, scheme_id, metal_id,
         principal, current_principal, interest_rate, rate_type, interest_type, loan_on, slabs_snapshot, doc_charges, advance_interest, other_charges, net_disbursed,
         total_items, total_pcs, gross_wt, stone_wt, net_wt, avg_purity, rate_per_gram, gold_rate, silver_rate, market_value, eligible_amount, item_summary,
         item_photo, customer_photo, entry_type, parent_loan_id, remarks, created_by)
       VALUES (:branch_id, :fy_id, :loan_no, :bill_no, :manual, :barcode, :loan_date, :due_date, :customer_id, :scheme_id, :metal_id,
         :principal, :principal, :rate, :rate_type, :itype, :loan_on, :slabs, :doc, :adv, :other, :net,
         :total_items, :total_pcs, :gross_wt, :stone_wt, :net_wt, :avg_purity, :rpg, :grate, :srate, :market_value, :eligible_amount, :summary,
         :item_photo, :cust_photo, :entry_type, :parent, :remarks, :u)`,
      {
        branch_id: req.branchId, fy_id: fy.id, loan_no: loanNo, bill_no: billNo, manual: body.manual_bill_no || null, barcode,
        loan_date: date, due_date: dueDate, customer_id: customer.id, scheme_id: scheme.id, metal_id: metalId,
        principal, rate, rate_type: scheme.rate_type, itype: body.interest_type === 'COMPOUND' ? 'COMPOUND' : 'SIMPLE', loan_on: loanOn,
        grate: num(body.rate_per_gram) || null, srate: num(body.silver_rate) || null, slabs: JSON.stringify(slabs.map((s, i) => (i === 0 ? { ...s, rate } : s))),
        doc: docCharges, adv: advance, other: otherCharges, net,
        total_items: items.length, total_pcs: totals.total_pcs, gross_wt: totals.gross_wt, stone_wt: totals.stone_wt, net_wt: totals.net_wt,
        avg_purity: totals.avg_purity, rpg: loanRate, market_value: totals.market_value, eligible_amount: totals.eligible_amount,
        summary: itemSummary(items), item_photo: body.item_photo || null, cust_photo: body.customer_photo || customer.photo || null,
        entry_type: entryType, parent: body.parent_loan_id || null, remarks: body.remarks || null, u: req.user.id,
      },
    );
    const loanId = r.insertId;
    const vals = items.map((i) => [loanId, i.item_id, i.metal_id, i.item_name, i.pcs, i.gross_wt, i.stone_wt, i.net_wt, i.purity, i.fine_wt, i.rate_per_gram, i.value, i.remarks]);
    await tx.conn.query('INSERT INTO loan_items (loan_id, item_id, metal_id, item_name, pcs, gross_wt, stone_wt, net_wt, purity, fine_wt, rate_per_gram, value, remarks) VALUES ?', [vals]);

    const loan = { id: loanId, branch_id: req.branchId };
    const txn = await insertTxn(tx, req, loan, {
      date, type: 'DISBURSE', principal, charges: docCharges + otherCharges, total: net, remarks: entryType === 'OLD' ? 'Old loan entry' : null,
    }, payments);

    if (!body.skipVoucher) {
      const narration = `Loan ${billNo} - ${customer.name}`;
      const lines = entryType === 'OLD'
        ? [{ ledger: LEDGER.LOAN_RECEIVABLE, debit: principal }, { ledger: LEDGER.CAPITAL, credit: principal }]
        : [
            { ledger: LEDGER.LOAN_RECEIVABLE, debit: principal },
            ...(await paymentLines(tx, payments, 'credit', narration)),
            { ledger: LEDGER.DOC_CHARGES, credit: docCharges },
            { ledger: LEDGER.INTEREST_INCOME, credit: advance },
            { ledger: LEDGER.OTHER_CHARGES, credit: otherCharges },
          ];
      const vId = await postVoucher(tx, { branchId: req.branchId, fyId: fy.id, date, type: entryType === 'OLD' ? 'JOURNAL' : 'PAYMENT', narration, sourceType: 'LOAN_TXN', sourceId: txn.id, userId: req.user.id, lines });
      await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: txn.id });
    }
    return { loanId, billNo };
  });

  audit(req, entryType === 'OLD' ? 'OLD_LOAN' : 'NEW_LOAN', 'loans', result.loanId, { bill_no: result.billNo, principal });
  if (entryType === 'NEW') {
    queueMessage({ branchId: req.branchId, event: 'NEW_LOAN', phone: customer.phone, loanId: result.loanId,
      vars: { name: customer.name, loan_no: result.billNo, amount: principal, date: dayjs(date).format('DD-MM-YYYY'), weight: totals.net_wt } });
  }
  return result.loanId;
};

/* ============================================================ interest receipt */

export const payInterest = async (req, id, body) => {
  const date = await ensureDateOpen(req, body.date);
  const res = await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    const interest = round2(body.interest_amount);
    const penal = round2(body.penal_amount);
    const charges = round2(body.charges);
    const discount = round2(body.discount);
    const approvedBy = await checkApproval(req, discount, await getSettings(loan.branch_id));
    const total = round2(interest + penal + charges - discount);
    if (total <= 0) throw ApiError.badRequest('Enter interest amount');
    const payments = normalisePayments(body.payments, total);
    const txn = await insertTxn(tx, req, loan, { date, type: 'INTEREST', interest, penal, charges, discount, total, months: body.months_paid, upto: body.interest_upto || date, remarks: body.remarks }, payments);
    const fy = await getCurrentFy(tx);
    const narration = `Interest ${loan.bill_no}`;
    const vId = await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'RECEIPT', narration, sourceType: 'LOAN_TXN', sourceId: txn.id, userId: req.user.id,
      lines: [...(await paymentLines(tx, payments, 'debit', narration)), { ledger: LEDGER.DISCOUNT, debit: discount },
        { ledger: LEDGER.INTEREST_INCOME, credit: interest }, { ledger: LEDGER.PENAL_INCOME, credit: penal }, { ledger: LEDGER.OTHER_CHARGES, credit: charges }],
    });
    await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: txn.id });
    return { loan, txn, total };
  });
  audit(req, 'INTEREST', 'loans', id, { amount: res.total, receipt: res.txn.receipt_no });
  notify(req, res.loan, 'INTEREST', { amount: res.total, date });
  return res.txn;
};

/* ============================================================ part payment (principal) */

export const partPayment = async (req, id, body) => {
  const date = await ensureDateOpen(req, body.date);
  const res = await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    const principal = round2(body.principal_amount);
    const interest = round2(body.interest_amount);
    const discount = round2(body.discount);
    if (principal <= 0) throw ApiError.badRequest('Enter principal amount');
    if (principal >= num(loan.current_principal)) throw ApiError.badRequest('Part payment must be less than outstanding. Use Release to close the loan.');
    const total = round2(principal + interest - discount);
    const payments = normalisePayments(body.payments, total);
    const txn = await insertTxn(tx, req, loan, { date, type: 'PART_PAYMENT', principal: -principal, interest, discount, total, upto: interest ? date : null, remarks: body.remarks }, payments);
    await tx.query('UPDATE loans SET current_principal = current_principal - :p WHERE id = :id', { p: principal, id: loan.id });
    const fy = await getCurrentFy(tx);
    const narration = `Part payment ${loan.bill_no}`;
    const vId = await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'RECEIPT', narration, sourceType: 'LOAN_TXN', sourceId: txn.id, userId: req.user.id,
      lines: [...(await paymentLines(tx, payments, 'debit', narration)), { ledger: LEDGER.DISCOUNT, debit: discount },
        { ledger: LEDGER.LOAN_RECEIVABLE, credit: principal }, { ledger: LEDGER.INTEREST_INCOME, credit: interest }],
    });
    await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: txn.id });
    return { loan, txn, total };
  });
  audit(req, 'PART_PAYMENT', 'loans', id, { amount: res.total });
  notify(req, res.loan, 'INTEREST', { amount: res.total, date });
  return res.txn;
};

/* ============================================================ top-up */

export const topUp = async (req, id, body) => {
  const date = await ensureDateOpen(req, body.date);
  const settings = await getSettings(req.branchId);
  const res = await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    if (loan.entry_type === 'OLD') throw ApiError.badRequest('This is an Old Loan Entry (opening loan). Top-up is not allowed on it. Use Re-loan instead.');
    const amount = round2(body.amount);
    const within = num(settings.TOPUP_WITHIN_DAYS, 0);
    if (within > 0 && dayjs(date).diff(dayjs(loan.loan_date), 'day') > within) {
      throw ApiError.badRequest(`Top-up is allowed only within ${within} days of the loan date. Use Re-loan instead.`);
    }
    const interest = round2(body.interest_amount);   // interest collected / deducted now
    const charges = round2(body.charges);
    if (amount <= 0) throw ApiError.badRequest('Enter top-up amount');
    const newPrincipal = round2(num(loan.current_principal) + amount);
    const mybook = (await tx.queryOne('SELECT calc_mode FROM schemes WHERE id = :id', { id: loan.scheme_id }))?.calc_mode === 'MYBOOK';
    if (newPrincipal > num(loan.eligible_amount) && settings.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' && !mybook) {
      throw ApiError.badRequest(`Total loan ₹${newPrincipal} exceeds eligible amount ₹${loan.eligible_amount}`);
    }
    const net = round2(amount - interest - charges);
    if (net < 0) throw ApiError.badRequest('Deductions exceed top-up amount');
    const payments = normalisePayments(body.payments, net);
    const txn = await insertTxn(tx, req, loan, { date, type: 'TOPUP', principal: amount, interest, charges, total: net, upto: interest ? date : null, remarks: body.remarks }, payments);
    await tx.query('UPDATE loans SET current_principal = :p WHERE id = :id', { p: newPrincipal, id: loan.id });
    const fy = await getCurrentFy(tx);
    const narration = `Top-up ${loan.bill_no}`;
    const vId = await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'PAYMENT', narration, sourceType: 'LOAN_TXN', sourceId: txn.id, userId: req.user.id,
      lines: [{ ledger: LEDGER.LOAN_RECEIVABLE, debit: amount }, ...(await paymentLines(tx, payments, 'credit', narration)),
        { ledger: LEDGER.INTEREST_INCOME, credit: interest }, { ledger: LEDGER.OTHER_CHARGES, credit: charges }],
    });
    await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: txn.id });
    return { txn, amount };
  });
  audit(req, 'TOPUP', 'loans', id, { amount: res.amount });
  return res.txn;
};

/* ============================================================ release */

export const releaseLoan = async (req, id, body) => {
  const date = await ensureDateOpen(req, body.date);
  const settings = await getSettings(req.branchId);
  const res = await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    if (loan.bank_pledge_id) {
      const bp = await tx.queryOne('SELECT status, pledge_no FROM bank_pledges WHERE id = :id', { id: loan.bank_pledge_id });
      if (bp?.status === 'OPEN') throw ApiError.badRequest(`Jewels are pledged in bank (${bp.pledge_no}). Release from bank first.`);
    }
    const scheme = await loadScheme(tx, loan.scheme_id);
    const txns = await loadTxns(tx, loan.id);
    const calc = calculateInterest({ loan, scheme, txns, asOf: date, options: calcOptions(settings) });
    const principal = calc.principalOutstanding;
    const interest = body.interest_amount != null && body.interest_amount !== '' ? round2(body.interest_amount) : calc.interestDue;
    const penal = body.penal_amount != null && body.penal_amount !== '' ? round2(body.penal_amount) : calc.penalDue;
    const charges = round2(num(body.charges) + num(body.ticket_charge) + num(body.post_charge));
    const discount = round2(body.discount);
    const approvedBy = await checkApproval(req, discount, settings);
    const total = round2(principal + interest + penal + charges - discount);
    if (total < 0) throw ApiError.badRequest('Discount too high');
    const fyR = await getCurrentFy(tx);
    const releaseNo = await nextNumber(tx, { branchId: loan.branch_id, key: 'RELEASE', fyId: fyR.id });
    const payments = normalisePayments(body.payments, total);
    const txn = await insertTxn(tx, req, loan, { date, type: 'RELEASE', principal: -principal, interest, penal, charges, discount, total, upto: date, remarks: body.remarks }, payments);
    await tx.query("UPDATE loans SET status = 'CLOSED', current_principal = 0, close_date = :d, closed_by = :u, release_no = :rn, released_unable = :un WHERE id = :id",
      { d: date, u: req.user.id, id: loan.id, rn: releaseNo, un: body.unable_to_release ? 1 : 0 });
    await tx.query('UPDATE loan_transactions SET release_no = :rn, approved_by = :a WHERE id = :t', { rn: releaseNo, a: approvedBy, t: txn.id });
    if (body.released_by_other?.name) {
      const o = body.released_by_other;
      await tx.query(`INSERT INTO release_by_other (loan_id, name, relation_type, relation_name, address, phone, id_proof, photo)
        VALUES (:l, :n, :rt, :rn, :a, :p, :idp, :ph) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      { l: loan.id, n: o.name, rt: o.relation_type || null, rn: o.relation_name || null, a: o.address || null, p: o.phone || null, idp: o.id_proof || null, ph: o.photo || null });
    }
    const fy = await getCurrentFy(tx);
    const narration = `Release ${loan.bill_no}`;
    const vId = await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'RECEIPT', narration, sourceType: 'LOAN_TXN', sourceId: txn.id, userId: req.user.id,
      lines: [...(await paymentLines(tx, payments, 'debit', narration)), { ledger: LEDGER.DISCOUNT, debit: discount },
        { ledger: LEDGER.LOAN_RECEIVABLE, credit: principal }, { ledger: LEDGER.INTEREST_INCOME, credit: interest },
        { ledger: LEDGER.PENAL_INCOME, credit: penal }, { ledger: LEDGER.OTHER_CHARGES, credit: charges }],
    });
    await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: txn.id });
    return { loan, txn, total };
  });
  audit(req, 'RELEASE', 'loans', id, { amount: res.total });
  notify(req, res.loan, 'RELEASE', { amount: res.total, date });
  return res.txn;
};

/* ============================================================ renewal / re-loan */

export const renewLoan = async (req, id, body) => {
  const date = await ensureDateOpen(req, body.date);
  const settings = await getSettings(req.branchId);
  const old = await getLoanFull(req, id, date);
  requireOpen(old.loan);
  if (old.loan.bank_pledge_id) throw ApiError.badRequest('Loan is pledged in bank. Release from bank first.');
  const calc = old.calc;
  const interest = body.interest_amount != null && body.interest_amount !== '' ? round2(body.interest_amount) : round2(calc.interestDue + calc.penalDue);
  const discount = round2(body.discount);
  await checkApproval(req, discount, settings);
  const newPrincipal = round2(body.new_principal || (body.add_interest ? calc.principalOutstanding + interest - discount : calc.principalOutstanding));
  const schemeId = body.scheme_id || old.loan.scheme_id;

  // net cash: +ve -> paid to customer, -ve -> collected from customer
  const scheme = await loadScheme({ queryOne }, schemeId);
  const docCharges = body.doc_charges != null && body.doc_charges !== '' ? round2(body.doc_charges) : round2((newPrincipal * num(scheme.doc_charge_percent)) / 100 + num(scheme.doc_charge_fixed));
  const advance = round2(body.advance_interest);
  const net = round2(newPrincipal - calc.principalOutstanding - interest + discount - docCharges - advance);

  const newId = await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    const payments = normalisePayments(body.payments, Math.abs(net));
    const fy = await getCurrentFy(tx);
    const close = await insertTxn(tx, req, loan, {
      date, type: 'RELEASE', principal: -calc.principalOutstanding, interest, discount, total: round2(calc.principalOutstanding + interest - discount), upto: date, remarks: 'Renewed',
    }, []);
    await tx.query("UPDATE loans SET status = 'RENEWED', current_principal = 0, close_date = :d, closed_by = :u WHERE id = :id", { d: date, u: req.user.id, id: loan.id });

    // create the new loan inside this same transaction by re-using the numbering + insert
    const seqFy = settings.LOAN_NO_RESET_YEARLY === '1' ? fy.id : 0;
    const branch = await tx.queryOne('SELECT code, loan_prefix FROM branches WHERE id = :id', { id: loan.branch_id });
    const loanNo = await nextNumber(tx, { branchId: loan.branch_id, key: 'LOAN', fyId: seqFy });
    const billNo = fmtBillNo(settings.LOAN_NO_FORMAT, { prefix: branch.loan_prefix, no: loanNo, fy: fy.name, branch: branch.code });
    const slabs = parseSlabs(scheme.slabs);
    const rate = num(body.interest_rate, slabs[0].rate);
    const loanRate = num(body.rate_per_gram, loan.rate_per_gram);
    const silverRate = num(body.silver_rate, loan.silver_rate) || loanRate;   // silver items are valued at the silver rate
    const rateOf = (code) => (code === 'SILVER' ? silverRate : loanRate);
    const basis = num(body.rate_basis, 91.6) || 91.6;
    const marketValue = round2(old.items.reduce((s, i) => s + itemValue(i.net_wt, i.purity, rateOf(i.metal_code), basis), 0));
    // paper bill book: the given number, else the next one when the old loan had a bill book no (as the desktop app does)
    let billBook = body.manual_bill_no ? String(body.manual_bill_no) : null;
    if (!billBook && loan.manual_bill_no) {
      const bk = await tx.queryOne("SELECT MAX(CAST(manual_bill_no AS UNSIGNED)) n FROM loans WHERE branch_id = :b AND manual_bill_no REGEXP '^[0-9]+$'", { b: loan.branch_id });
      if (bk?.n) billBook = String(Number(bk.n) + 1);
    }
    if (billBook) {
      const dup = await tx.queryOne('SELECT bill_no FROM loans WHERE branch_id = :b AND manual_bill_no = :m LIMIT 1', { b: loan.branch_id, m: billBook });
      if (dup) throw ApiError.conflict(`Bill book no ${billBook} is already used on loan ${dup.bill_no}`);
    }
    const step = num(settings.ROUND_LOAN_TO, 100) || 1;
    const eligible = Math.floor((marketValue * num(scheme.ltv_percent)) / 100 / step) * step;
    if (newPrincipal > eligible && settings.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' && scheme.calc_mode !== 'MYBOOK') throw ApiError.badRequest(`New loan exceeds eligible amount ₹${eligible}`);
    const r = await tx.query(
      `INSERT INTO loans (branch_id, fy_id, loan_no, bill_no, barcode, loan_date, due_date, customer_id, scheme_id, metal_id, principal, current_principal,
         interest_rate, rate_type, slabs_snapshot, doc_charges, advance_interest, net_disbursed, total_items, total_pcs, gross_wt, stone_wt, net_wt, avg_purity, rate_per_gram,
         market_value, eligible_amount, item_summary, item_photo, customer_photo, entry_type, parent_loan_id, remarks, created_by, loan_on, silver_rate, manual_bill_no)
       SELECT branch_id, :fy, :no, :bill, :barcode, :d, :due, customer_id, :scheme, metal_id, :p, :p, :rate, :rt, :slabs, :doc, :adv, :net,
         total_items, total_pcs, gross_wt, stone_wt, net_wt, avg_purity, :lr, :mv, :el, item_summary, item_photo, customer_photo, 'RENEWAL', id, :rem, :u, loan_on, :sr, :mb
       FROM loans WHERE id = :old`,
      { fy: fy.id, no: loanNo, bill: billNo, barcode: `${branch.code}${String(loanNo).padStart(6, '0')}`, d: date,
        due: dayjs(date).add(num(scheme.tenure_months, 12), 'month').format('YYYY-MM-DD'), scheme: scheme.id, p: newPrincipal, rate,
        rt: scheme.rate_type, slabs: JSON.stringify(slabs.map((s, i) => (i === 0 ? { ...s, rate } : s))), doc: docCharges, adv: advance, net: Math.max(0, net),
        lr: loanRate, sr: silverRate, mb: billBook, mv: marketValue, el: eligible, rem: `Renewal of ${loan.bill_no}`, u: req.user.id, old: loan.id },
    );
    const newLoanId = r.insertId;
    await tx.query(`INSERT INTO loan_items (loan_id, item_id, metal_id, item_name, pcs, gross_wt, stone_wt, net_wt, purity, fine_wt, rate_per_gram, value, remarks)
      SELECT :n, li.item_id, li.metal_id, li.item_name, li.pcs, li.gross_wt, li.stone_wt, li.net_wt, li.purity, li.fine_wt, IF(m.code = 'SILVER', :sr, :lr),
             ROUND(ROUND(li.net_wt * li.purity / 100, 3) * IF(m.code = 'SILVER', :sr, :lr) * 100 / :basis / 100) * 100, li.remarks
        FROM loan_items li LEFT JOIN metals m ON m.id = li.metal_id WHERE li.loan_id = :o ORDER BY li.id`,
    { n: newLoanId, o: loan.id, lr: loanRate, sr: silverRate, basis });
    if (Array.isArray(body.add_items) && body.add_items.length) {
      const extra = prepareItems(body.add_items, loanRate);
      await tx.conn.query('INSERT INTO loan_items (loan_id, item_id, metal_id, item_name, pcs, gross_wt, stone_wt, net_wt, purity, fine_wt, rate_per_gram, value, remarks) VALUES ?',
        [extra.map((i) => [newLoanId, i.item_id, i.metal_id, i.item_name, i.pcs, i.gross_wt, i.stone_wt, i.net_wt, i.purity, i.fine_wt, i.rate_per_gram, i.value, i.remarks])]);
      await tx.query(`UPDATE loans l SET total_items = (SELECT COUNT(*) FROM loan_items WHERE loan_id = l.id), total_pcs = (SELECT SUM(pcs) FROM loan_items WHERE loan_id = l.id),
        gross_wt = (SELECT SUM(gross_wt) FROM loan_items WHERE loan_id = l.id), stone_wt = (SELECT SUM(stone_wt) FROM loan_items WHERE loan_id = l.id),
        net_wt = (SELECT SUM(net_wt) FROM loan_items WHERE loan_id = l.id), market_value = (SELECT SUM(value) FROM loan_items WHERE loan_id = l.id),
        item_summary = (SELECT LEFT(GROUP_CONCAT(item_name SEPARATOR ', '), 300) FROM loan_items WHERE loan_id = l.id) WHERE l.id = :n`, { n: newLoanId });
    }
    await tx.query('UPDATE loans SET interest_type = :it, item_photo = COALESCE(:ph, item_photo) WHERE id = :n',
      { n: newLoanId, it: body.interest_type === 'COMPOUND' || (!body.interest_type && loan.interest_type === 'COMPOUND') ? 'COMPOUND' : 'SIMPLE', ph: body.item_photo || null });
    const open = await insertTxn(tx, req, { id: newLoanId, branch_id: loan.branch_id }, {
      date, type: 'DISBURSE', principal: newPrincipal, charges: docCharges, total: net, remarks: `Renewal of ${loan.bill_no}`,
    }, payments);

    const narration = `Renewal ${loan.bill_no} -> ${billNo}`;
    const cashSide = net >= 0 ? 'credit' : 'debit';
    const vId = await postVoucher(tx, {
      branchId: loan.branch_id, fyId: fy.id, date, type: 'JOURNAL', narration, sourceType: 'LOAN_TXN', sourceId: open.id, userId: req.user.id,
      lines: [
        { ledger: LEDGER.LOAN_RECEIVABLE, debit: newPrincipal },
        { ledger: LEDGER.DISCOUNT, debit: discount },
        { ledger: LEDGER.LOAN_RECEIVABLE, credit: calc.principalOutstanding },
        { ledger: LEDGER.INTEREST_INCOME, credit: interest },
        { ledger: LEDGER.DOC_CHARGES, credit: docCharges },
        { ledger: LEDGER.INTEREST_INCOME, credit: advance },
        ...(await paymentLines(tx, payments, cashSide, narration)),
      ],
    });
    await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id IN (:a, :b)', { v: vId, a: open.id, b: close.id });
    return newLoanId;
  });
  audit(req, 'RENEWAL', 'loans', id, { new_loan_id: newId, new_principal: newPrincipal });
  return newId;
};

/* ============================================================ cancel / void */

export const cancelLoan = async (req, id, reason) => {
  if (!reason) throw ApiError.badRequest('Reason is required');
  const settings = await getSettings(req.branchId);
  await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    requireOpen(loan);
    const txns = await loadTxns(tx, loan.id);
    if (txns.some((t) => t.txn_type !== 'DISBURSE')) throw ApiError.badRequest('Loan has receipts. Void them before cancelling.');
    if (settings.CANCEL_SAME_DAY_ONLY === '1' && !req.user.is_super_admin && dayjs(loan.created_at).format('YYYY-MM-DD') !== dayjs().format('YYYY-MM-DD')) {
      throw ApiError.badRequest('Only same-day loans can be cancelled');
    }
    for (const t of txns) {
      await voidSourceVouchers(tx, 'LOAN_TXN', t.id);
      await tx.query('UPDATE loan_transactions SET is_void = 1 WHERE id = :id', { id: t.id });
    }
    await tx.query("UPDATE loans SET status = 'CANCELLED', current_principal = 0, cancel_reason = :r, cancelled_by = :u, cancelled_at = NOW() WHERE id = :id",
      { r: reason, u: req.user.id, id: loan.id });
    if (loan.parent_loan_id) {
      // cancelling a renewal re-opens the parent
      const parentClose = await tx.queryOne("SELECT id FROM loan_transactions WHERE loan_id = :p AND txn_type = 'RELEASE' AND is_void = 0 ORDER BY id DESC LIMIT 1", { p: loan.parent_loan_id });
      if (parentClose) await tx.query('UPDATE loan_transactions SET is_void = 1 WHERE id = :id', { id: parentClose.id });
      await tx.query("UPDATE loans p SET p.status = 'OPEN', p.close_date = NULL, p.current_principal = (SELECT COALESCE(SUM(principal_amount),0) FROM loan_transactions t WHERE t.loan_id = p.id AND t.is_void = 0) WHERE p.id = :p", { p: loan.parent_loan_id });
    }
  });
  audit(req, 'CANCEL', 'loans', id, { reason });
};

/** Void the latest receipt of a loan (interest / part payment / top-up / release). */
export const voidTransaction = async (req, loanId, txnId, reason) => {
  if (!reason) throw ApiError.badRequest('Reason is required');
  await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, loanId);
    const last = await tx.queryOne('SELECT * FROM loan_transactions WHERE loan_id = :l AND is_void = 0 ORDER BY id DESC LIMIT 1', { l: loan.id });
    if (!last || last.id !== Number(txnId)) throw ApiError.badRequest('Only the latest receipt can be voided');
    if (last.txn_type === 'DISBURSE') throw ApiError.badRequest('Use Cancel Loan to cancel disbursement');
    if (loan.status === 'RENEWED') throw ApiError.badRequest('Cancel the renewed loan instead');
    await ensureDateOpen(req, last.txn_date);
    await voidSourceVouchers(tx, 'LOAN_TXN', last.id);
    await tx.query("UPDATE loan_transactions SET is_void = 1, remarks = CONCAT(COALESCE(remarks, ''), ' | VOID: ', :r) WHERE id = :id", { id: last.id, r: reason });
    await tx.query(`UPDATE loans SET current_principal = (SELECT COALESCE(SUM(principal_amount),0) FROM loan_transactions WHERE loan_id = :l AND is_void = 0),
      status = IF(:rel, 'OPEN', status), close_date = IF(:rel, NULL, close_date) WHERE id = :l`, { l: loan.id, rel: last.txn_type === 'RELEASE' ? 1 : 0 });
  });
  audit(req, 'VOID_RECEIPT', 'loans', loanId, { txnId, reason });
};

/* ============================================================ edit pledged record */

export const editLoan = async (req, id, body) => {
  const settings = await getSettings(req.branchId);
  await withTransaction(async (tx) => {
    const loan = await lockLoan(tx, req, id);
    if (!['OPEN'].includes(loan.status)) throw ApiError.badRequest('Only open loans can be edited');
    const set = {};
    for (const f of ['manual_bill_no', 'remarks', 'due_date', 'item_photo', 'customer_photo']) if (f in body) set[f] = body[f] || null;
    if (body.interest_type && ['SIMPLE', 'COMPOUND'].includes(body.interest_type)) set.interest_type = body.interest_type;
    if (body.customer_id && Number(body.customer_id) !== loan.customer_id) {
      const c = await tx.queryOne('SELECT id, branch_id, status FROM customers WHERE id = :id', { id: body.customer_id });
      if (!c || c.branch_id !== loan.branch_id) throw ApiError.badRequest('Customer must be from the same branch');
      set.customer_id = c.id;
    }
    if (body.loan_date && body.loan_date !== loan.loan_date) {
      const cnt = await tx.queryOne('SELECT COUNT(*) c FROM loan_transactions WHERE loan_id = :id AND is_void = 0', { id: loan.id });
      if (cnt.c > 1) throw ApiError.badRequest('Loan date cannot be changed after receipts are posted');
      await ensureDateOpen(req, body.loan_date);
      set.loan_date = body.loan_date;
      await tx.query("UPDATE loan_transactions SET txn_date = :d WHERE loan_id = :id AND txn_type = 'DISBURSE'", { d: body.loan_date, id: loan.id });
      await tx.query("UPDATE voucher_entries e JOIN vouchers v ON v.id = e.voucher_id JOIN loan_transactions t ON t.id = v.source_id AND v.source_type = 'LOAN_TXN' SET e.entry_date = :d, v.voucher_date = :d WHERE t.loan_id = :id AND t.txn_type = 'DISBURSE'", { d: body.loan_date, id: loan.id });
    }
    if (Array.isArray(body.items)) {
      const items = prepareItems(body.items, num(body.rate_per_gram, loan.rate_per_gram));
      const scheme = await loadScheme(tx, loan.scheme_id);
      const mv = round2(items.reduce((s, i) => s + i.value, 0));
      const step = num(settings.ROUND_LOAN_TO, 100) || 1;
      Object.assign(set, {
        total_items: items.length, total_pcs: items.reduce((s, i) => s + i.pcs, 0),
        gross_wt: round3(items.reduce((s, i) => s + i.gross_wt, 0)), stone_wt: round3(items.reduce((s, i) => s + i.stone_wt, 0)),
        net_wt: round3(items.reduce((s, i) => s + i.net_wt, 0)), market_value: mv,
        eligible_amount: Math.floor((mv * num(scheme.ltv_percent)) / 100 / step) * step, item_summary: itemSummary(items),
      });
      await tx.query('DELETE FROM loan_items WHERE loan_id = :id', { id: loan.id });
      const vals = items.map((i) => [loan.id, i.item_id, i.metal_id, i.item_name, i.pcs, i.gross_wt, i.stone_wt, i.net_wt, i.purity, i.fine_wt, i.rate_per_gram, i.value, i.remarks]);
      await tx.conn.query('INSERT INTO loan_items (loan_id, item_id, metal_id, item_name, pcs, gross_wt, stone_wt, net_wt, purity, fine_wt, rate_per_gram, value, remarks) VALUES ?', [vals]);
    }
    // financial correction allowed only when nothing but the disbursement exists
    const finChange = (body.principal != null && round2(body.principal) !== num(loan.principal)) || (body.interest_rate != null && num(body.interest_rate) !== num(loan.interest_rate));
    if (finChange) {
      const txns = await loadTxns(tx, loan.id);
      if (txns.length > 1) throw ApiError.badRequest('Amount / rate cannot be changed after receipts are posted');
      const disb = txns[0];
      const principal = body.principal != null ? round2(body.principal) : num(loan.principal);
      const rate = body.interest_rate != null ? num(body.interest_rate) : num(loan.interest_rate);
      const net = round2(principal - num(loan.doc_charges) - num(loan.advance_interest) - num(loan.other_charges));
      const slabs = parseSlabs(loan.slabs_snapshot, rate).map((s, i) => (i === 0 ? { ...s, rate } : s));
      Object.assign(set, { principal, current_principal: principal, interest_rate: rate, net_disbursed: net, slabs_snapshot: JSON.stringify(slabs) });
      if (disb) {
        await voidSourceVouchers(tx, 'LOAN_TXN', disb.id);
        await tx.query('DELETE FROM transaction_payments WHERE transaction_id = :id', { id: disb.id });
        await tx.query('UPDATE loan_transactions SET principal_amount = :p, total_amount = :n WHERE id = :id', { p: principal, n: net, id: disb.id });
        const payments = loan.entry_type === 'OLD' ? [] : [{ mode: 'CASH', amount: net }];
        for (const p of payments) await tx.query('INSERT INTO transaction_payments (transaction_id, mode, amount) VALUES (:t, :m, :a)', { t: disb.id, m: p.mode, a: p.amount });
        const fy = await getCurrentFy(tx);
        const narration = `Loan ${loan.bill_no} (edited)`;
        const lines = loan.entry_type === 'OLD'
          ? [{ ledger: LEDGER.LOAN_RECEIVABLE, debit: principal }, { ledger: LEDGER.CAPITAL, credit: principal }]
          : [{ ledger: LEDGER.LOAN_RECEIVABLE, debit: principal }, ...(await paymentLines(tx, payments, 'credit', narration)),
              { ledger: LEDGER.DOC_CHARGES, credit: num(loan.doc_charges) }, { ledger: LEDGER.INTEREST_INCOME, credit: num(loan.advance_interest) },
              { ledger: LEDGER.OTHER_CHARGES, credit: num(loan.other_charges) }];
        const vId = await postVoucher(tx, { branchId: loan.branch_id, fyId: fy.id, date: disb.txn_date, type: 'PAYMENT', narration, sourceType: 'LOAN_TXN', sourceId: disb.id, userId: req.user.id, lines });
        await tx.query('UPDATE loan_transactions SET voucher_id = :v WHERE id = :id', { v: vId, id: disb.id });
      }
    }
    if (Object.keys(set).length) await tx.query(`UPDATE loans SET ${Object.keys(set).map((k) => `${k} = :${k}`).join(', ')} WHERE id = :zz_id`, { ...set, zz_id: loan.id });
  });
  audit(req, 'EDIT', 'loans', id, body);
};

/* ============================================================ misc */

const notify = async (req, loan, event, extra) => {
  const c = await queryOne('SELECT name, phone FROM customers WHERE id = :id', { id: loan.customer_id });
  queueMessage({ branchId: loan.branch_id, event, phone: c?.phone, loanId: loan.id,
    vars: { name: c?.name, loan_no: loan.bill_no, amount: extra.amount, date: dayjs(extra.date).format('DD-MM-YYYY') } });
};

/* ============================================================ mark old loans (desktop: frmMarkOldLoan) */

/** Convert loans entered as NEW into opening (OLD) entries: removes them from today's cash. */
export const markOldLoans = async (req, ids) => {
  const done = [];
  await withTransaction(async (tx) => {
    for (const id of ids) {
      const loan = await lockLoan(tx, req, id);
      if (loan.entry_type === 'OLD' || loan.status !== 'OPEN') continue;
      const txns = await loadTxns(tx, loan.id);
      if (txns.length !== 1) continue;
      const fy = await getCurrentFy(tx);
      await voidSourceVouchers(tx, 'LOAN_TXN', txns[0].id);
      await tx.query('DELETE FROM transaction_payments WHERE transaction_id = :t', { t: txns[0].id });
      const vId = await postVoucher(tx, {
        branchId: loan.branch_id, fyId: fy.id, date: loan.loan_date, type: 'JOURNAL', narration: `Old loan ${loan.bill_no}`, sourceType: 'LOAN_TXN', sourceId: txns[0].id, userId: req.user.id,
        lines: [{ ledger: LEDGER.LOAN_RECEIVABLE, debit: num(loan.principal) }, { ledger: LEDGER.CAPITAL, credit: num(loan.principal) }],
      });
      await tx.query("UPDATE loan_transactions SET voucher_id = :v, remarks = 'Old loan entry' WHERE id = :t", { v: vId, t: txns[0].id });
      await tx.query("UPDATE loans SET entry_type = 'OLD' WHERE id = :id", { id: loan.id });
      done.push(loan.id);
    }
  });
  audit(req, 'MARK_OLD', 'loans', done.join(','), { count: done.length });
  return done;
};

/** Item photo of the customer's latest loan (desktop F8 "Old photo"). */
export const lastItemPhoto = async (req, customerId) => {
  const row = await queryOne(`SELECT item_photo FROM loans WHERE customer_id = :c AND branch_id IN (:b) AND item_photo IS NOT NULL ORDER BY id DESC LIMIT 1`, { c: customerId, b: req.branchIds });
  return row?.item_photo || null;
};
