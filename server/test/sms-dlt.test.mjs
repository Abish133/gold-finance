/**
 * SMS provider link: {phone} {message} {template_id}, missing DLT template id, and "Failure text" in a 200 answer.
 * Runs on the dev database with its own fake provider on a free port; puts the settings and templates back when it ends.
 *   node test/sms-dlt.test.mjs
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { query, queryOne, pool } from '#config/db.js';
import { providerUrl, processQueue } from '#services/message.service.js';
import { getSettings, saveSettings } from '#services/settings.service.js';

let ok = 0;
const check = async (name, fn) => { await fn(); ok += 1; console.log(`  ✔ ${name}`); };

await check('providerUrl fills every placeholder', () => {
  const u = providerUrl('https://x/send?to={phone}&text={message}&tid={template_id}&again={phone}', { phone: '9443012345', message: 'Rs.500 & thanks', templateId: '1207161234567890123' });
  assert.equal(u, 'https://x/send?to=9443012345&text=Rs.500%20%26%20thanks&tid=1207161234567890123&again=9443012345');
});

// fake provider: answers "ERROR invalid template" when the template id is wrong
const seen = [];
const server = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  seen.push(Object.fromEntries(q));
  res.end(q.get('tid') === '1207161234567890123' ? 'OK 12345' : 'ERROR invalid template');
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const before = await getSettings(0);
const tplBefore = await queryOne("SELECT dlt_template_id FROM message_templates WHERE event_key = 'INTEREST'");
const branch = await queryOne('SELECT id FROM branches ORDER BY id LIMIT 1');
const add = async () => (await query("INSERT INTO message_queue (branch_id, event_key, phone, message) VALUES (:b, 'INTEREST', '9000000001', 'Dear Test, received Rs.750')", { b: branch.id })).insertId;
const row = (id) => queryOne('SELECT status, last_error FROM message_queue WHERE id = :id', { id });
const ids = [];
try {
  await saveSettings({ SMS_PROVIDER_URL: `http://127.0.0.1:${port}/send?to={phone}&text={message}&tid={template_id}`, SMS_FAIL_TEXT: 'error, invalid' }, 0);

  await check('no DLT template id -> FAILED with a clear reason, provider not called', async () => {
    await query("UPDATE message_templates SET dlt_template_id = NULL WHERE event_key = 'INTEREST'");
    const id = await add(); ids.push(id);
    await processQueue();
    const r = await row(id);
    assert.equal(r.status, 'FAILED'); assert.match(r.last_error, /No DLT template id/);
    assert.equal(seen.length, 0);
  });

  await check('wrong template id -> provider error text marks it not sent', async () => {
    await query("UPDATE message_templates SET dlt_template_id = '111' WHERE event_key = 'INTEREST'");
    const id = await add(); ids.push(id);
    await processQueue();
    const r = await row(id);
    assert.notEqual(r.status, 'SENT'); assert.match(r.last_error, /Provider said: ERROR invalid template/);
  });

  await check('right template id -> SENT with phone, text and template id in the link', async () => {
    await query("UPDATE message_templates SET dlt_template_id = '1207161234567890123' WHERE event_key = 'INTEREST'");
    await query("UPDATE message_queue SET status = 'SKIPPED' WHERE id IN (:ids)", { ids });   // earlier rows out of the way
    const id = await add(); ids.push(id);
    await processQueue();
    assert.equal((await row(id)).status, 'SENT');
    const last = seen.at(-1);
    assert.deepEqual(last, { to: '9000000001', text: 'Dear Test, received Rs.750', tid: '1207161234567890123' });
  });
} finally {
  await saveSettings({ SMS_PROVIDER_URL: before.SMS_PROVIDER_URL || '', SMS_FAIL_TEXT: before.SMS_FAIL_TEXT || '' }, 0);
  await query("UPDATE message_templates SET dlt_template_id = :t WHERE event_key = 'INTEREST'", { t: tplBefore?.dlt_template_id ?? null });
  if (ids.length) await query('DELETE FROM message_queue WHERE id IN (:ids)', { ids });
  server.close();
  await pool.end();
}
console.log(`sms-dlt: ${ok} passed`);
