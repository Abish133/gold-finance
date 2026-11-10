import dayjs from 'dayjs';
import { query } from '#config/db.js';
import { logger } from '#config/logger.js';
import { getSettings } from './settings.service.js';
import { queueMessage } from './message.service.js';

/**
 * Loans that should get a due-reminder SMS today in one branch:
 *  - past the settle-before (due) date, and/or
 *  - no interest / part payment for N months,
 * and no reminder sent to that loan in the last GAP days.
 */
export const dueReminderLoans = async (branchId, s) => {
  const months = Math.max(1, Number(s.SMS_REMINDER_MONTHS) || 3);
  const gap = Math.max(1, Number(s.SMS_REMINDER_GAP_DAYS) || 15);
  const today = dayjs().format('YYYY-MM-DD');
  return query(`SELECT * FROM (
      SELECT l.id, l.bill_no, l.loan_date, l.due_date, l.current_principal, c.name customer_name, c.phone,
        GREATEST(l.loan_date, COALESCE((SELECT MAX(t.txn_date) FROM loan_transactions t WHERE t.loan_id = l.id AND t.is_void = 0 AND t.txn_type IN ('INTEREST','PART_PAYMENT','TOPUP')), l.loan_date)) last_paid,
        (SELECT MAX(q.created_at) FROM message_queue q WHERE q.loan_id = l.id AND q.event_key = 'DUE_REMINDER') last_reminder
      FROM loans l JOIN customers c ON c.id = l.customer_id
      WHERE l.branch_id = :b AND l.status = 'OPEN' AND c.phone IS NOT NULL AND c.phone <> '') x
    WHERE ((:od = 1 AND x.due_date < :t) OR x.last_paid <= DATE_SUB(:t, INTERVAL :m MONTH))
      AND (x.last_reminder IS NULL OR x.last_reminder < DATE_SUB(:t, INTERVAL :g DAY))
    ORDER BY x.loan_date`, { b: branchId, t: today, m: months, g: gap, od: s.SMS_REMINDER_OVERDUE === '0' ? 0 : 1 });
};

/** Queue reminders for one branch now. Returns how many were queued. */
export const runDueReminders = async (branchId) => {
  const s = await getSettings(branchId);
  const loans = await dueReminderLoans(branchId, s);
  let queued = 0;
  for (const l of loans) {
    const before = (await query("SELECT COUNT(*) c FROM message_queue WHERE loan_id = :l AND event_key = 'DUE_REMINDER'", { l: l.id }))[0].c;
    await queueMessage({ branchId, event: 'DUE_REMINDER', phone: l.phone, loanId: l.id,
      vars: { name: l.customer_name, loan_no: l.bill_no, amount: l.current_principal, date: dayjs(l.loan_date).format('DD/MM/YYYY'), due_date: dayjs(l.due_date).format('DD/MM/YYYY') } });
    const after = (await query("SELECT COUNT(*) c FROM message_queue WHERE loan_id = :l AND event_key = 'DUE_REMINDER'", { l: l.id }))[0].c;
    if (after > before) queued++;
  }
  return { due: loans.length, queued };
};

/** Daily job (checked every minute): after the set time, once a day per branch. */
const doneToday = new Map();
export const reminderTick = async () => {
  try {
    const day = dayjs().format('YYYY-MM-DD');
    const branches = await query('SELECT id FROM branches WHERE is_active = 1');
    for (const b of branches) {
      if (doneToday.get(b.id) === day) continue;
      const s = await getSettings(b.id);
      if (s.SMS_ENABLED !== '1' || s.SMS_AUTO_REMINDER !== '1') continue;
      const [h, m] = String(s.SMS_REMINDER_TIME || '10:00').split(':').map(Number);
      const now = dayjs();
      if (now.hour() * 60 + now.minute() < h * 60 + (m || 0)) continue;
      doneToday.set(b.id, day);
      const r = await runDueReminders(b.id);
      if (r.queued) logger.info({ branch: b.id, ...r }, 'due reminders queued');
    }
  } catch (err) {
    logger.warn({ err }, 'due reminder job failed');
  }
};
