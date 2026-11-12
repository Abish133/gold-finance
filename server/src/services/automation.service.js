import dayjs from 'dayjs';
import { query, queryOne } from '#config/db.js';
import { logger } from '#config/logger.js';
import { getSettings } from './settings.service.js';
import { queueMessage, render, TEMPLATE_DEFS } from './message.service.js';
import { daySummary } from '#modules/accounts/accounts.service.js';

/*
 * Optional daily automations - both are OFF until switched on (SMS / WhatsApp settings).
 * They only READ the books and put messages in the existing queue; nothing in loans or accounts changes.
 *  - OWNER_SUMMARY: the day's figures to the owner's mobile, once a day after the set time
 *  - SMS_ON_BIRTHDAY: a greeting to customers whose birthday is today (customers with an open loan)
 * "Once a day" is checked against the message queue itself, so a server restart never sends twice.
 */
const inr = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const afterTime = (hhmm) => { const [h, m] = String(hhmm || '00:00').split(':').map(Number); const now = dayjs(); return now.hour() * 60 + now.minute() >= h * 60 + (m || 0); };

async function ownerSummary(branch, s, day) {
  if (s.SMS_ENABLED !== '1' || s.OWNER_SUMMARY !== '1' || !String(s.OWNER_PHONE || '').trim() || !afterTime(s.OWNER_SUMMARY_TIME || '20:00')) return;
  const sent = await queryOne("SELECT COUNT(*) c FROM message_queue WHERE branch_id = :b AND event_key = 'OWNER_SUMMARY' AND DATE(created_at) = :d", { b: branch.id, d: day });
  if (sent.c) return;
  const d = await daySummary([branch.id], day);
  const t = d.transactions || {};
  const interest = Number(d.loans.advance_interest || 0) + Object.values(t).reduce((x, r) => x + Number(r.interest || 0) + Number(r.penal || 0), 0);
  const rel = Number(t.RELEASE?.cnt || 0) + Number(t.AUCTION?.cnt || 0);
  const relAmt = Number(t.RELEASE?.principal || 0) + Number(t.AUCTION?.principal || 0);
  const open = await queryOne("SELECT COUNT(*) c, COALESCE(SUM(current_principal),0) amt FROM loans WHERE branch_id = :b AND status = 'OPEN'", { b: branch.id });
  const overdue = await queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id = :b AND status = 'OPEN' AND due_date < :d", { b: branch.id, d: day });
  const tpl = await queryOne("SELECT body, is_active FROM message_templates WHERE event_key = 'OWNER_SUMMARY'");
  if (tpl && !Number(tpl.is_active)) return;
  const body = tpl?.body || TEMPLATE_DEFS.find((t) => t[0] === 'OWNER_SUMMARY')[2];
  const msg = render(body, { branch: branch.name, date: dayjs(day).format('DD/MM/YY'), loans: d.loans.cnt, lent: inr(d.loans.principal), releases: rel, released: inr(relAmt),
    interest: inr(interest), cash: inr(d.cash.closing), open: open.c, open_amount: inr(open.amt), overdue: overdue.c });
  for (const phone of String(s.OWNER_PHONE).split(/[,\s]+/).filter(Boolean)) {
    await query("INSERT INTO message_queue (branch_id, event_key, phone, message) VALUES (:b, 'OWNER_SUMMARY', :p, :m)", { b: branch.id, p: phone, m: msg });
  }
  logger.info({ branch: branch.id }, 'owner summary queued');
}

async function birthdays(branch, s, day) {
  if (s.SMS_ENABLED !== '1' || s.SMS_ON_BIRTHDAY !== '1' || !afterTime(s.BIRTHDAY_TIME || '09:00')) return;
  // the greeting template is editable in SMS / WhatsApp > Templates (added at start by ensureTemplates)
  const company = (await queryOne('SELECT name FROM company LIMIT 1'))?.name || '';
  const rows = await query(`SELECT DISTINCT c.id, c.name, c.phone FROM customers c JOIN loans l ON l.customer_id = c.id AND l.status = 'OPEN' AND l.branch_id = :b
      WHERE c.dob IS NOT NULL AND c.phone IS NOT NULL AND c.phone <> '' AND MONTH(c.dob) = MONTH(:d) AND DAY(c.dob) = DAY(:d)
        AND NOT EXISTS (SELECT 1 FROM message_queue q WHERE q.event_key = 'BIRTHDAY' AND q.phone = c.phone AND DATE(q.created_at) = :d)`, { b: branch.id, d: day });
  for (const c of rows) await queueMessage({ branchId: branch.id, event: 'BIRTHDAY', phone: c.phone, vars: { name: c.name, company } });
  if (rows.length) logger.info({ branch: branch.id, count: rows.length }, 'birthday greetings queued');
}

/** Checked every minute from index.js - each automation decides for itself whether it is due. */
export const automationTick = async () => {
  try {
    const day = dayjs().format('YYYY-MM-DD');
    const branches = await query('SELECT id, name FROM branches WHERE is_active = 1');
    for (const b of branches) {
      const s = await getSettings(b.id);
      await ownerSummary(b, s, day);
      await birthdays(b, s, day);
    }
  } catch (err) {
    logger.warn({ err }, 'automation job failed');
  }
};
