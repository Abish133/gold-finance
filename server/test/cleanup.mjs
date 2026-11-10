// Removes the branches and users that the automatic tests created, so the dev database is left with only the shop's own data.
// Only branches with a test code AND a test name are touched (ZTEST "Automatic Tests", Mxxxx "MyBook Check", Xxxxx "MyBook Mirror",
// Kxxxx "Karungal", Txxxx "Flow Test"). Run by npm test at the end; can be run alone: node test/cleanup.mjs
import { query, withTransaction, pool } from '../src/config/db.js';

const B = `${process.env.API_URL || 'http://localhost:5000'}/api`;
let cookie = '';
const call = async (method, url, body, branch = '') => {
  const res = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-branch-id': branch }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { ok: res.ok, j: await res.json().catch(() => null) };
};

const isTest = (b) => (b.code === 'ZTEST' && b.name === 'Automatic Tests')
  || (/^M\d{4}$/.test(b.code) && /^MyBook Check /.test(b.name))
  || (/^X\d{4}$/.test(b.code) && /^MyBook Mirror /.test(b.name))
  || (/^K\d{4}$/.test(b.code) && b.name === 'Karungal')
  || (/^T\d{4}$/.test(b.code) && /^Flow Test /.test(b.name));

await call('POST', '/auth/login', { username: 'admin', password: 'Admin@123' });
const branches = (await query('SELECT id, code, name FROM branches')).filter(isTest);
const tables = (await query("SELECT table_name t FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = 'branch_id'"))
  .map((r) => r.t || r.TABLE_NAME).filter((t) => !['branches', 'audit_logs'].includes(t));
for (const b of branches) {
  // the app's own Start Fresh clears loans, vouchers and practice customers in the right order
  await call('POST', '/tools/start-fresh', { confirm: 'START FRESH', password: 'Admin@123', customers: true }, String(b.id));
  await withTransaction(async (tx) => {
    await tx.query('SET FOREIGN_KEY_CHECKS = 0');
    // bank ledgers of this branch's bank accounts go with them
    await tx.query('DELETE FROM ledgers WHERE id IN (SELECT ledger_id FROM bank_accounts WHERE branch_id = :b) AND NOT EXISTS (SELECT 1 FROM voucher_entries e WHERE e.ledger_id = ledgers.id AND e.branch_id <> :b)', { b: b.id });
    for (const t of tables) await tx.query(`DELETE FROM \`${t}\` WHERE branch_id = :b`, { b: b.id });
    await tx.query('UPDATE audit_logs SET branch_id = NULL WHERE branch_id = :b', { b: b.id });
    await tx.query('DELETE FROM branches WHERE id = :b', { b: b.id });
    await tx.query('SET FOREIGN_KEY_CHECKS = 1');
  });
}
// rows left by branches removed earlier (no branch any more)
for (const t of tables) {
  await query(`DELETE FROM \`${t}\` WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches)`).catch(() => {});
}
// cashier users the tests made (krl12345 / cash12345) that no longer have a branch
const users = await query("SELECT id FROM users WHERE username REGEXP '^(krl|cash)[0-9]{5}$' AND NOT EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = users.id)");
for (const u of users) {
  try { await query('DELETE FROM users WHERE id = :id', { id: u.id }); } catch { await query('UPDATE users SET is_active = 0 WHERE id = :id', { id: u.id }); }
}
console.log(`cleanup: ${branches.length} test branches and ${users.length} test users removed`);
await pool.end();
