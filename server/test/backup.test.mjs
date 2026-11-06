// Backup, restore and due-reminder checks. Restores the dev database to the backup taken at the start,
// so anything entered while this test runs is rolled back.
const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = ''; let branch = '';
const fails = [];
const call = async (method, url, body, expectFail) => {
  const isForm = body instanceof FormData;
  const res = await fetch(B + url, { method, headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), cookie, 'x-branch-id': branch }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => null);
  if (!res.ok && !expectFail) throw new Error(`${method} ${url} -> ${res.status} ${j?.message}`);
  if (res.ok && expectFail) throw new Error(`${method} ${url} should have failed`);
  return j;
};
const step = async (name, fn) => { try { console.log('✔', name, (await fn()) ?? ''); } catch (e) { fails.push(`${name}: ${e.message}`); console.log('✘', name, e.message); } };

const me = (await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' })).data.user;
branch = String(me.branches[0].id);

let file;
await step('server backup file written', async () => {
  file = (await call('POST', '/admin/backup-files')).data;
  const list = (await call('GET', '/admin/backup-files')).data.files;
  if (!list.find((f) => f.name === file.file)) throw new Error('file not listed');
  return `${file.file} · ${file.rows} rows · ${file.kb} KB`;
});
await step('full backup download is gzip', async () => {
  const res = await fetch(`${B}/admin/backup/full`, { headers: { cookie } });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error('not a gzip file');
  return `${Math.round(buf.length / 1024)} KB`;
});
await step('auto backup settings save + validate', async () => {
  await call('PUT', '/admin/backup-settings', { AUTO_BACKUP_TIME: '25:99' }, true);
  await call('PUT', '/admin/backup-settings', { AUTO_BACKUP_ENABLED: '1', AUTO_BACKUP_TIME: '21:00', AUTO_BACKUP_KEEP: '30' });
  const s = (await call('GET', '/admin/backup-files')).data.settings;
  if (s.AUTO_BACKUP_TIME !== '21:00') throw new Error('not saved');
  return 'bad time rejected';
});
await step('branch export cannot be restored', async () => {
  const res = await fetch(`${B}/admin/backup`, { headers: { cookie, 'x-branch-id': branch } });
  const fd = new FormData();
  fd.append('file', new Blob([await res.text()], { type: 'application/json' }), 'branch.json');
  fd.append('confirm', 'RESTORE'); fd.append('password', 'Admin@123');
  const r = await call('POST', '/admin/restore', fd, true);
  return r.message.slice(0, 50);
});
await step('restore needs RESTORE + password', async () => {
  await call('POST', '/admin/restore', { file: file.file, confirm: 'restore', password: 'Admin@123' }, true);
  await call('POST', '/admin/restore', { file: file.file, confirm: 'RESTORE', password: 'wrong' }, true);
});
await step('restore brings data back', async () => {
  const marker = `Restore Marker ${Date.now().toString().slice(-6)}`;
  const c = (await call('POST', '/customers', { name: marker, relation_name: 'X', phone: `8${Date.now().toString().slice(-9)}` })).data;
  const before = (await call('GET', '/customers?pageSize=1')).meta?.total;
  const r = (await call('POST', '/admin/restore', { file: file.file, confirm: 'RESTORE', password: 'Admin@123' })).data;
  // the session survives (users table restored with the same rows)
  const gone = await call('GET', `/customers/${c.id}`, undefined, true);
  const after = (await call('GET', '/customers?pageSize=1')).meta?.total;
  if (after !== before - 1) throw new Error(`customers ${before} -> ${after}`);
  return `${r.tables} tables · ${r.rows} rows · marker removed · safety ${r.safety}${gone ? '' : ''}`;
});
await step('due reminders preview + run', async () => {
  await call('PUT', '/admin/settings?scope=global', { SMS_ENABLED: '1', SMS_ON_DUE_REMINDER: '1', SMS_REMINDER_MONTHS: '1', SMS_REMINDER_GAP_DAYS: '15', SMS_PROVIDER_URL: '' });
  const p = (await call('GET', '/admin/reminders/preview')).data;
  const r1 = (await call('POST', '/admin/reminders/run')).data;
  const r2 = (await call('POST', '/admin/reminders/run')).data;
  await call('PUT', '/admin/settings?scope=global', { SMS_ENABLED: '0', SMS_REMINDER_MONTHS: '3' });
  if (r1.queued !== p.loans.length) throw new Error(`queued ${r1.queued} of ${p.loans.length}`);
  if (r2.queued !== 0 || r2.due !== 0) throw new Error(`second run queued ${r2.queued} (gap days not honoured)`);
  return `${p.loans.length} due · second run 0`;
});
await step('bad attendance status is a 400', async () => call('POST', '/employees/attendance/sheet', { date: '2026-01-01', rows: [{ employee_id: 1, status: 'PRESENT' }] }, true));
// put the data back as it was when the test started
await step('restore original data', async () => { const r = (await call('POST', '/admin/restore', { file: file.file, confirm: 'RESTORE', password: 'Admin@123' })).data; return `${r.rows} rows`; });

console.log(fails.length ? `\nFAILED ${fails.length}:\n${fails.join('\n')}` : '\nALL BACKUP TESTS PASSED');
if (fails.length) process.exitCode = 1;
