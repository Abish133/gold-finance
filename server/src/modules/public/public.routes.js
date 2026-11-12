import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';
import { query, queryOne } from '#config/db.js';
import { ApiError } from '#utils/ApiError.js';
import { getSettings } from '#services/settings.service.js';
import { getLoanFull } from '#modules/loans/loans.service.js';

/*
 * Customer loan-status link (no sign-in). Safe by design:
 *  - OFF until "Customer link" is switched on (SMS / WhatsApp > Auto SMS Rules > Automations)
 *  - read only; the token is long and random, expires, and staff can cancel it
 *  - shows only that customer's OPEN loans: amounts, dates, interest due - no address, photos, ID or other customers
 *  - rate limited per IP so tokens cannot be guessed
 */
const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests. Please try again later.' } });
const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const mask = (p) => { const s = String(p || '').replace(/\D/g, ''); return s.length >= 4 ? `${'x'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : ''; };

router.get('/loan-status/:token', limiter, async (req, res) => {
  const token = String(req.params.token || '');
  const gone = () => { throw ApiError.notFound('This link is not valid or has expired. Please ask the shop for a new link.'); };
  if (!TOKEN.test(token)) gone();
  const st = await getSettings(0);
  if (st.CUSTOMER_LINK_ENABLED !== '1') gone();
  const link = await queryOne('SELECT * FROM customer_links WHERE token = :t AND revoked = 0 AND expires_at > NOW()', { t: token });
  if (!link) gone();
  const customer = await queryOne('SELECT id, name, phone FROM customers WHERE id = :id', { id: link.customer_id });
  if (!customer) gone();
  const company = await queryOne('SELECT name, phone, mobile FROM company LIMIT 1');
  const open = await query("SELECT id, branch_id FROM loans WHERE customer_id = :c AND status = 'OPEN' ORDER BY loan_date", { c: customer.id });
  const loans = [];
  for (const o of open) {
    // the same interest calculation the counter uses, for this loan's own branch
    const full = await getLoanFull({ branchIds: [o.branch_id] }, o.id);
    const l = full.loan; const c = full.calc;
    loans.push({
      loan_no: l.manual_bill_no ? `${l.bill_no} / ${l.manual_bill_no}` : l.bill_no, branch: l.branch_name || null,
      loan_date: l.loan_date, due_date: l.due_date, items: l.item_summary, net_wt: l.net_wt, principal: l.principal,
      outstanding: c.principalOutstanding, interest_due: Number(c.interestDue || 0) + Number(c.penalDue || 0), total_payable: c.totalPayable,
      monthly_interest: c.monthlyInterest, paid_up_to: c.paidUpTo, overdue: !!c.isOverdue, overdue_days: c.overdueDays,
      recent: full.transactions.filter((t) => !t.is_void).slice(-4).reverse().map((t) => ({ date: t.txn_date, type: t.txn_type, amount: t.total_amount })),
    });
  }
  await query('UPDATE customer_links SET views = views + 1, last_viewed_at = NOW() WHERE id = :id', { id: link.id });
  res.set('Cache-Control', 'no-store');
  res.json({ data: {
    shop: { name: company?.name || '', phone: company?.mobile || company?.phone || '' },
    customer: { name: customer.name, phone: mask(customer.phone) },
    asOn: dayjs().format('YYYY-MM-DD'), expiresAt: link.expires_at, loans,
  } });
});

export default router;
