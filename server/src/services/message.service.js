import { query, queryOne } from '#config/db.js';
import { logger } from '#config/logger.js';
import { getSettings } from './settings.service.js';

const render = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());

/** Queue an SMS for an event if the event + template are enabled. Never throws. */
export const queueMessage = async ({ branchId, event, phone, vars = {}, loanId = null }) => {
  try {
    if (!phone) return;
    const s = await getSettings(branchId);
    if (s.SMS_ENABLED !== '1') return;
    const flag = { NEW_LOAN: 'SMS_ON_NEW_LOAN', RELEASE: 'SMS_ON_RELEASE', INTEREST: 'SMS_ON_INTEREST', DUE_REMINDER: 'SMS_ON_DUE_REMINDER' }[event];
    if (flag && s[flag] !== '1') return;
    const tpl = await queryOne('SELECT body FROM message_templates WHERE event_key = :e AND is_active = 1', { e: event });
    if (!tpl) return;
    await query(
      'INSERT INTO message_queue (branch_id, event_key, phone, message, loan_id) VALUES (:b, :e, :p, :m, :l)',
      { b: branchId, e: event, p: phone, m: render(tpl.body, vars), l: loanId },
    );
  } catch (err) {
    logger.warn({ err }, 'queueMessage failed');
  }
};

/** Background sender: posts pending messages to the configured HTTP provider. */
let running = false;
export const processQueue = async () => {
  if (running) return;
  running = true;
  try {
    const rows = await query("SELECT * FROM message_queue WHERE status = 'PENDING' AND tries < 3 ORDER BY id LIMIT 25");
    for (const m of rows) {
      const s = await getSettings(m.branch_id);
      if (!s.SMS_PROVIDER_URL) {
        await query("UPDATE message_queue SET status = 'SKIPPED', last_error = 'Provider URL not set' WHERE id = :id", { id: m.id });
        continue;
      }
      try {
        const url = s.SMS_PROVIDER_URL
          .replace('{phone}', encodeURIComponent(m.phone))
          .replace('{message}', encodeURIComponent(m.message));
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await query("UPDATE message_queue SET status = 'SENT', sent_at = NOW(), tries = tries + 1 WHERE id = :id", { id: m.id });
      } catch (err) {
        await query(
          "UPDATE message_queue SET tries = tries + 1, last_error = :e, status = IF(tries + 1 >= 3, 'FAILED', 'PENDING') WHERE id = :id",
          { id: m.id, e: String(err.message).slice(0, 240) },
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, 'message queue processing failed');
  } finally {
    running = false;
  }
};
