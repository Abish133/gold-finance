import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { nextNumber } from './sequence.service.js';

/** System ledgers created by the seed. Business code refers to them by key only. */
export const LEDGER = {
  CASH: 'CASH',
  LOAN_RECEIVABLE: 'LOAN_RECEIVABLE',
  INTEREST_INCOME: 'INTEREST_INCOME',
  PENAL_INCOME: 'PENAL_INCOME',
  DOC_CHARGES: 'DOC_CHARGES',
  OTHER_CHARGES: 'OTHER_CHARGES',
  DISCOUNT: 'DISCOUNT',
  AUCTION_SURPLUS: 'AUCTION_SURPLUS',
  AUCTION_LOSS: 'AUCTION_LOSS',
  BANK_BORROWING: 'BANK_BORROWING',
  BANK_INTEREST: 'BANK_INTEREST',
  BANK_CHARGES: 'BANK_CHARGES',
  SALARY: 'SALARY',
  CAPITAL: 'CAPITAL',
};

const keyCache = new Map();
export const ledgerId = async (tx, key) => {
  if (keyCache.has(key)) return keyCache.get(key);
  const row = await tx.queryOne('SELECT id FROM ledgers WHERE system_key = :k', { k: key });
  if (!row) throw new Error(`System ledger ${key} missing - run db:seed`);
  keyCache.set(key, row.id);
  return row.id;
};

/** Ledger for a payment line: cash, or the bank account's ledger. */
export const paymentLedger = async (tx, p) => {
  if (!p.mode || p.mode === 'CASH') return ledgerId(tx, LEDGER.CASH);
  if (!p.bank_account_id) throw ApiError.badRequest(`Select bank account for ${p.mode} payment`);
  const ba = await tx.queryOne('SELECT ledger_id FROM bank_accounts WHERE id = :id', { id: p.bank_account_id });
  if (!ba?.ledger_id) throw ApiError.badRequest('Bank account has no ledger');
  return ba.ledger_id;
};

/**
 * Post a balanced voucher.
 * lines: [{ ledger: key | id, debit, credit, narration }]
 */
export const postVoucher = async (tx, { branchId, fyId, date, type = 'SYSTEM', narration, sourceType, sourceId, userId, lines }) => {
  const resolved = [];
  for (const l of lines) {
    const debit = round2(l.debit), credit = round2(l.credit);
    if (!debit && !credit) continue;
    const id = typeof l.ledger === 'number' ? l.ledger : await ledgerId(tx, l.ledger);
    resolved.push({ id, debit, credit, narration: l.narration || null });
  }
  if (!resolved.length) return null;
  const dr = round2(resolved.reduce((s, l) => s + l.debit, 0));
  const cr = round2(resolved.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(dr - cr) > 0.009) throw new Error(`Voucher not balanced: Dr ${dr} / Cr ${cr}`);

  const no = await nextNumber(tx, { branchId, key: 'VCH', fyId });
  const v = await tx.query(
    `INSERT INTO vouchers (branch_id, voucher_no, voucher_date, voucher_type, narration, source_type, source_id, created_by)
     VALUES (:b, :no, :d, :t, :n, :st, :sid, :u)`,
    { b: branchId, no: `V${no}`, d: date, t: type, n: narration, st: sourceType || null, sid: sourceId || null, u: userId },
  );
  const voucherId = v.insertId;
  const values = resolved.map((_, i) => `(:v, :b, :d, :l${i}, :dr${i}, :cr${i}, :n${i})`).join(',');
  const params = { v: voucherId, b: branchId, d: date };
  resolved.forEach((l, i) => { params[`l${i}`] = l.id; params[`dr${i}`] = l.debit; params[`cr${i}`] = l.credit; params[`n${i}`] = l.narration || narration; });
  await tx.query(`INSERT INTO voucher_entries (voucher_id, branch_id, entry_date, ledger_id, debit, credit, narration) VALUES ${values}`, params);
  return voucherId;
};

/** Void vouchers attached to a source (loan cancel / txn reversal). */
export const voidSourceVouchers = async (tx, sourceType, sourceId) => {
  const rows = await tx.query('SELECT id FROM vouchers WHERE source_type = :t AND source_id = :id AND is_void = 0', { t: sourceType, id: sourceId });
  for (const r of rows) {
    await tx.query('UPDATE vouchers SET is_void = 1 WHERE id = :id', { id: r.id });
    await tx.query('DELETE FROM voucher_entries WHERE voucher_id = :id', { id: r.id });
  }
};

/** Expand payment lines into ledger lines on the given side. */
export const paymentLines = async (tx, payments, side, narration) => {
  const out = [];
  for (const p of payments || []) {
    if (!num(p.amount)) continue;
    out.push({ ledger: await paymentLedger(tx, p), [side]: num(p.amount), narration });
  }
  return out;
};

/** Normalise payments: default to all-cash for `total`, validate the sum. */
export const normalisePayments = (payments, total) => {
  const t = round2(total);
  if (!payments?.length) return t > 0 ? [{ mode: 'CASH', amount: t }] : [];
  const sum = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  if (Math.abs(sum - t) > 0.009) throw ApiError.badRequest(`Payment split ₹${sum} does not match total ₹${t}`);
  return payments.filter((p) => num(p.amount) > 0);
};
