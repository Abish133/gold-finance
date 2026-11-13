import { query, queryOne } from '#config/db.js';
import { logger } from '#config/logger.js';
import { getSettings } from './settings.service.js';

export const render = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());

/** Every message the app can send - SMS (sent by the server) and WhatsApp (opened at the counter). Bodies are the defaults. */
export const TEMPLATE_DEFS = [
  ['NEW_LOAN', 'New loan (SMS)', 'Dear {name}, your gold loan {loan_no} of Rs.{amount} dated {date} is sanctioned. Net wt {weight} g. Thank you.'],
  ['INTEREST', 'Interest received (SMS)', 'Dear {name}, received Rs.{amount} towards loan {loan_no} on {date}. Thank you.'],
  ['RELEASE', 'Loan closed (SMS)', 'Dear {name}, your loan {loan_no} is closed on {date}. Amount received Rs.{amount}. Thank you.'],
  ['DUE_REMINDER', 'Due reminder / auction notice (SMS)', 'Dear {name}, your loan {loan_no} is overdue. Please pay the interest / renew at the earliest to avoid auction.'],
  ['BIRTHDAY', 'Birthday wishes (SMS)', 'Dear {name}, warm birthday wishes from {company}!'],
  ['OWNER_SUMMARY', 'Daily summary to owner (SMS)', '{branch} {date}: Loans {loans} Rs.{lent}, Releases {releases} Rs.{released}, Interest Rs.{interest}, Cash Rs.{cash}. Open {open} loans Rs.{open_amount}, overdue {overdue}.'],
  ['WA_NEW_LOAN', 'New loan (WhatsApp)', '{shop}\nDear {name}, your loan {loan_no} of Rs {amount} is given on {date} ({items}). Settle before {due_date}.'],
  ['WA_RELEASE', 'Loan released (WhatsApp)', '{shop}\nDear {name}, your loan {loan_no} is released on {date}. Received Rs {amount}. Thank you.'],
  ['WA_PART_PAYMENT', 'Part payment (WhatsApp)', '{shop}\nDear {name}, received Rs {amount} on loan {loan_no}. Balance loan amount Rs {balance}.'],
  ['WA_INTEREST', 'Interest received (WhatsApp)', '{shop}\nDear {name}, received interest Rs {amount} on loan {loan_no}{months}.'],
];
export const ensureTemplates = async () => {
  try {
    for (const [k, n, b] of TEMPLATE_DEFS) await query('INSERT IGNORE INTO message_templates (event_key, name, body, is_active) VALUES (:k, :n, :b, 1)', { k, n, b });
  } catch (err) { logger.warn({ err }, 'ensureTemplates failed'); }
};

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

/**
 * The provider link with this message filled in.
 *   {phone} {message}  - always
 *   {template_id}      - the DLT template id typed on that message's template (Settings > SMS Settings > Templates);
 *                        DLT gateways (BSNL, Jio, Airtel, Vi registrations) reject an SMS without it
 * Every placeholder is replaced wherever it appears.
 */
export const providerUrl = (link, { phone, message, templateId }) => String(link)
  .split('{phone}').join(encodeURIComponent(phone))
  .split('{message}').join(encodeURIComponent(message))
  .split('{template_id}').join(encodeURIComponent(templateId || ''));

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
        const tpl = m.event_key ? await queryOne('SELECT dlt_template_id FROM message_templates WHERE event_key = :e', { e: m.event_key }) : null;
        const templateId = String(tpl?.dlt_template_id || '').trim();
        if (s.SMS_PROVIDER_URL.includes('{template_id}') && !templateId) {
          await query("UPDATE message_queue SET status = 'FAILED', tries = tries + 1, last_error = :e WHERE id = :id",
            { id: m.id, e: `No DLT template id on the "${m.event_key}" template - type it in SMS Settings > Templates, then Retry failed` });
          continue;
        }
        const url = providerUrl(s.SMS_PROVIDER_URL, { phone: m.phone, message: m.message, templateId });
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // many Indian gateways answer HTTP 200 with an error in the text - "Failure text" catches those
        const failText = String(s.SMS_FAIL_TEXT || '').trim();
        if (failText) {
          const body = (await res.text()).slice(0, 2000);
          const hit = failText.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).find((x) => body.toLowerCase().includes(x));
          if (hit) throw new Error(`Provider said: ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
        }
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
