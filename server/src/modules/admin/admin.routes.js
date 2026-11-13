import { Router } from 'express';
import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit, invalidateUserCache } from '#middleware/auth.js';
import { requireBranch } from '#middleware/branch.js';
import { parsePhones, MAX_PHONES } from '#utils/phones.js';
import { upload, publicPath } from '#middleware/upload.js';
import { createCrudRouter } from '#utils/crudFactory.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { SCREENS, SCREEN_KEYS } from '#config/screens.js';
import { audit } from '#services/audit.service.js';
import { getSettings, saveSettings, DEFAULTS } from '#services/settings.service.js';
import { peekNumber, setNumber } from '#services/sequence.service.js';
import multer from 'multer';
import zlib from 'node:zlib';
import { buildFullBackup, writeBackupFile, listBackupFiles, backupFilePath, parseBackup, restoreBackup } from '#services/backup.service.js';
import { runDueReminders, dueReminderLoans } from '#services/reminder.service.js';
import fs from 'node:fs';

const router = Router();
const superOnly = (req, _res, next) => { if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can do this'); next(); };

/* ---------------- company ---------------- */
router.get('/company', async (_req, res) => {
  res.json({ data: await queryOne('SELECT * FROM company ORDER BY id LIMIT 1') });
});

router.put('/company', permit('s_company', 'edit'), async (req, res) => {
  const f = ['name', 'local_name', 'proprietor', 'licence_no', 'licence_valid_till', 'address1', 'address2', 'address3', 'phone', 'mobile', 'email', 'gstin', 'website'];
  const data = Object.fromEntries(f.filter((k) => k in req.body).map((k) => [k, req.body[k] === '' ? null : req.body[k]]));
  const existing = await queryOne('SELECT id FROM company LIMIT 1');
  if (existing) {
    if (Object.keys(data).length) await query(`UPDATE company SET ${Object.keys(data).map((k) => `${k} = :${k}`).join(', ')} WHERE id = :id`, { ...data, id: existing.id });
  } else {
    await query(`INSERT INTO company (${Object.keys(data).join(',')}) VALUES (${Object.keys(data).map((k) => `:${k}`).join(',')})`, data);
  }
  audit(req, 'UPDATE', 'company', existing?.id, data);
  res.json({ data: await queryOne('SELECT * FROM company LIMIT 1') });
});

router.post('/company/logo', permit('s_company', 'edit'), upload.single('file'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file');
  const path = publicPath(req.file);
  await query('UPDATE company SET logo_path = :p', { p: path });
  res.json({ data: { logo_path: path } });
});

/* ---------------- branches ---------------- */
router.use('/branches', createCrudRouter({
  table: 'branches', screen: 's_branches', alias: 'b',
  fields: ['code', 'name', 'local_name', 'address', 'city', 'pincode', 'phone', 'phones', 'licence_no', 'licence_valid_till', 'email', 'manager_name', 'loan_prefix', 'opening_cash', 'is_active'],
  booleans: ['is_active'], required: ['code', 'name'], searchable: ['b.name', 'b.code', 'b.city', 'b.licence_no', 'b.phone', 'b.phones'],
  sortable: { name: 'b.name', code: 'b.code', licence_no: 'b.licence_no' }, defaultSort: 'name',
  beforeSave: async (data, req, existing) => {
    // licence no + at least one contact number are compulsory for every branch
    const touchesPhones = 'phones' in req.body || 'phone' in req.body || !existing;
    if (touchesPhones) {
      const raw = 'phones' in req.body ? req.body.phones : req.body.phone;
      if (Array.isArray(raw) && raw.filter((p) => String(p ?? '').trim()).length > MAX_PHONES) throw ApiError.badRequest(`Up to ${MAX_PHONES} contact numbers only`);
      const phones = parsePhones(raw);
      if (!phones.length) throw ApiError.badRequest('At least one contact number is required');
      if (phones.some((p) => !/^[0-9+\-\s()]{6,20}$/.test(p))) throw ApiError.badRequest('Contact numbers can have only digits, spaces, + - ( )');
      data.phones = JSON.stringify(phones);
      data.phone = phones[0];
    }
    if ('licence_no' in data || !existing) {
      data.licence_no = String(data.licence_no ?? '').trim() || null;
      if (!data.licence_no) throw ApiError.badRequest('Licence number is required');
    }
    return data;
  },
  afterSave: async (row, req, existing) => {
    if (!existing) {
      // creator gets access to new branch immediately
      await query('INSERT IGNORE INTO user_branches (user_id, branch_id) VALUES (:u, :b)', { u: req.user.id, b: row.id });
    }
    invalidateUserCache();
  },
}));

/* ---------------- roles & permissions ---------------- */
router.get('/screens', (_req, res) => res.json({ data: SCREENS }));

router.use('/roles', createCrudRouter({
  table: 'roles', screen: 's_roles', alias: 'r',
  select: 'SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count, (SELECT COUNT(*) FROM role_permissions p WHERE p.role_id = r.id AND p.can_view = 1) AS screen_count FROM roles r',
  fields: ['name', 'description', 'all_branches', 'is_active'], booleans: ['all_branches', 'is_active'], required: ['name'],
  searchable: ['r.name'], sortable: { name: 'r.name' }, defaultSort: 'name',
  beforeSave: async (d, _req, existing) => {
    if (existing?.is_system && d.is_active === 0) throw ApiError.badRequest('System role cannot be disabled');
    return d;
  },
  afterSave: async () => invalidateUserCache(),
  extend: (r) => {
    r.get('/:id/permissions', permit('s_roles', 'view'), async (req, res) => {
      res.json({ data: await query('SELECT * FROM role_permissions WHERE role_id = :id', { id: req.params.id }) });
    });
    r.put('/:id/permissions', permit('s_roles', 'edit'), async (req, res) => {
      const roleId = Number(req.params.id);
      const perms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
      await withTransaction(async (tx) => {
        await tx.query('DELETE FROM role_permissions WHERE role_id = :id', { id: roleId });
        const rows = perms.filter((p) => SCREEN_KEYS.has(p.screen_key));
        if (rows.length) {
          const vals = rows.map((p) => [roleId, p.screen_key, +!!p.can_view, +!!p.can_add, +!!p.can_edit, +!!p.can_delete, +!!p.can_print, +!!p.can_export]);
          await tx.conn.query('INSERT INTO role_permissions (role_id, screen_key, can_view, can_add, can_edit, can_delete, can_print, can_export) VALUES ?', [vals]);
        }
      });
      invalidateUserCache();
      audit(req, 'PERMISSIONS', 'roles', roleId, { count: perms.length });
      res.json({ ok: true });
    });
  },
}));

/* ---------------- users ---------------- */
const userSelect = `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role_id, u.employee_id, u.default_branch_id,
  u.is_super_admin, u.is_active, u.last_login_at, u.created_at, r.name AS role_name, r.all_branches,
  (SELECT GROUP_CONCAT(ub.branch_id) FROM user_branches ub WHERE ub.user_id = u.id) AS branch_ids,
  (SELECT GROUP_CONCAT(b.name ORDER BY b.name SEPARATOR ', ') FROM user_branches ub JOIN branches b ON b.id = ub.branch_id WHERE ub.user_id = u.id) AS branch_names
  FROM users u JOIN roles r ON r.id = u.role_id`;

router.get('/users', permit('s_users', 'view'), async (req, res) => {
  const lq = parseListQuery(req.query, { sortable: { full_name: 'u.full_name', username: 'u.username' }, defaultSort: 'full_name', defaultOrder: 'asc' });
  const where = ['1=1'];
  const p = {};
  if (lq.search) { where.push('(u.full_name LIKE :s OR u.username LIKE :s OR u.phone LIKE :s)'); p.s = `%${lq.search}%`; }
  // non super admins only see users of their branches
  if (!req.user.is_super_admin) { where.push('u.is_super_admin = 0 AND EXISTS (SELECT 1 FROM user_branches x WHERE x.user_id = u.id AND x.branch_id IN (:b))'); p.b = req.user.branchIds; }
  const rows = await query(`${userSelect} WHERE ${where.join(' AND ')} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query(`SELECT COUNT(*) total FROM users u WHERE ${where.join(' AND ')}`, p);
  res.json(paged(rows, total, lq));
});

const saveUser = async (req, id) => {
  const b = req.body;
  const branchIds = (Array.isArray(b.branch_ids) ? b.branch_ids : String(b.branch_ids || '').split(',')).map(Number).filter(Boolean);
  if (!req.user.is_super_admin && branchIds.some((x) => !req.user.branchIds.includes(x))) throw ApiError.forbidden('You can assign only your branches');
  if (!b.full_name || !b.username || !b.role_id) throw ApiError.badRequest('Name, username and role are required');
  const data = {
    username: String(b.username).trim(), full_name: b.full_name, phone: b.phone || null, email: b.email || null,
    role_id: Number(b.role_id), employee_id: b.employee_id || null, default_branch_id: b.default_branch_id || branchIds[0] || null,
    is_active: b.is_active === false || b.is_active === 0 || b.is_active === '0' ? 0 : 1,
  };
  // the system "Super Admin" role means full access: it has no screen list of its own, so the user needs the super admin flag.
  // Only a super admin can make another one; moving a user to any other role takes the flag away.
  const role = await queryOne('SELECT name, is_system FROM roles WHERE id = :r', { r: data.role_id });
  const superRole = !!role?.is_system && role.name === 'Super Admin';
  if (superRole && !req.user.is_super_admin) throw ApiError.forbidden('Only a Super Admin can give the Super Admin role');
  if (Number(id) === Number(req.user.id) && req.user.is_super_admin && !superRole) throw ApiError.badRequest('You cannot remove your own Super Admin role');
  data.is_super_admin = superRole ? 1 : 0;
  return withTransaction(async (tx) => {
    let userId = id;
    if (id) {
      await tx.query(`UPDATE users SET ${Object.keys(data).map((k) => `${k} = :${k}`).join(', ')}, token_version = token_version + IF(:deact, 1, 0) WHERE id = :id`, { ...data, id, deact: data.is_active ? 0 : 1 });
      if (b.password) await tx.query('UPDATE users SET password_hash = :h, token_version = token_version + 1 WHERE id = :id', { h: await bcrypt.hash(b.password, 10), id });
    } else {
      if (!b.password || String(b.password).length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
      const r = await tx.query(`INSERT INTO users (${Object.keys(data).join(',')}, password_hash) VALUES (${Object.keys(data).map((k) => `:${k}`).join(',')}, :h)`, { ...data, h: await bcrypt.hash(b.password, 10) });
      userId = r.insertId;
    }
    await tx.query('DELETE FROM user_branches WHERE user_id = :id', { id: userId });
    if (branchIds.length) await tx.conn.query('INSERT INTO user_branches (user_id, branch_id) VALUES ?', [branchIds.map((x) => [userId, x])]);
    invalidateUserCache(userId);
    return userId;
  });
};

router.post('/users', permit('s_users', 'add'), async (req, res) => {
  const id = await saveUser(req, null);
  audit(req, 'CREATE', 'users', id, { username: req.body.username });
  res.status(201).json({ data: await queryOne(`${userSelect} WHERE u.id = :id`, { id }) });
});

router.put('/users/:id', permit('s_users', 'edit'), async (req, res) => {
  const target = await queryOne('SELECT id, is_super_admin FROM users WHERE id = :id', { id: req.params.id });
  if (!target) throw ApiError.notFound();
  if (target.is_super_admin && !req.user.is_super_admin) throw ApiError.forbidden();
  await saveUser(req, target.id);
  audit(req, 'UPDATE', 'users', target.id, { username: req.body.username });
  res.json({ data: await queryOne(`${userSelect} WHERE u.id = :id`, { id: target.id }) });
});

router.delete('/users/:id', permit('s_users', 'delete'), async (req, res) => {
  const target = await queryOne('SELECT id, is_super_admin FROM users WHERE id = :id', { id: req.params.id });
  if (!target) throw ApiError.notFound();
  if (target.is_super_admin || target.id === req.user.id) throw ApiError.badRequest('This user cannot be deleted');
  await query('UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE id = :id', { id: target.id });
  invalidateUserCache(target.id);
  audit(req, 'DISABLE', 'users', target.id);
  res.json({ ok: true });
});

/* ---------------- System health: read-only checks for the owner / admin ---------------- */
router.get('/health', permit('s_system', 'view'), async (req, res) => {
  const t = dayjs().format('YYYY-MM-DD');
  const b = req.branchId || 0;
  const st = await getSettings(b);
  const [tables, msgs, rateToday, cashToday, lastClose, todayLoans, unprinted, activity] = await Promise.all([
    query('SELECT table_name name, table_rows row_count, (data_length + index_length) size FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY size DESC'),
    query("SELECT status, COUNT(*) c FROM message_queue WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY status"),
    queryOne('SELECT COUNT(*) c FROM metal_rates WHERE rate_date = :t', { t }),
    b ? queryOne('SELECT total, difference FROM cash_denominations WHERE branch_id = :b AND count_date = :t', { b, t }) : null,
    b ? queryOne('SELECT MAX(close_date) d FROM day_closes WHERE branch_id = :b', { b }) : null,
    b ? queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id = :b AND loan_date = :t AND status <> 'CANCELLED'", { b, t }) : null,
    b ? queryOne("SELECT COUNT(*) c FROM loans WHERE branch_id = :b AND loan_date = :t AND status <> 'CANCELLED' AND sticker_printed_at IS NULL", { b, t }) : null,
    query(`SELECT a.user_id, u.full_name, u.username, COUNT(*) actions, MAX(a.created_at) last_at,
              SUM(a.action = 'LOGIN') logins, SUM(a.action IN ('DELETE','VOID','CANCEL') OR a.action LIKE '%VOID%') removals,
              SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT a.entity ORDER BY a.entity SEPARATOR ', '), ', ', 6) areas
             FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY a.user_id ORDER BY actions DESC LIMIT 20`),
  ]);
  // exact row counts (the table statistics above are estimates and can show 0)
  const exact = {};
  for (const tb of tables.slice(0, 12)) { const name = String(tb.name).replace(/[^a-z0-9_]/gi, ''); try { exact[tb.name] = (await queryOne('SELECT COUNT(*) c FROM ' + name)).c; } catch { /* skip */ } }
  const backups = listBackupFiles();
  const total = tables.reduce((x, r) => x + Number(r.size || 0), 0);
  const mem = process.memoryUsage();
  const failed = Number(msgs.find((m) => m.status === 'FAILED')?.c || 0);
  const pending = Number(msgs.find((m) => m.status === 'PENDING')?.c || 0);
  const backupAge = backups[0] ? dayjs().diff(dayjs(backups[0].created_at), 'hour') : null;
  // Day End checklist for the selected branch (what is still open today)
  const checklist = b ? [
    { key: 'rate', ok: rateToday.c > 0, text: "Today's gold / silver rate entered", link: '/masters?tab=rates' },
    { key: 'cash', ok: !!cashToday, text: cashToday ? `Cash counted (difference Rs. ${Number(cashToday.difference || 0).toFixed(2)})` : 'Cash count done today', link: '/accounts/denomination' },
    { key: 'stickers', ok: !unprinted?.c, text: unprinted?.c ? `${unprinted.c} of ${todayLoans.c} new loans have no packet sticker printed` : 'Packet stickers printed for new loans', link: '/loans/stickers' },
    { key: 'sms', ok: !failed, text: failed ? `${failed} SMS / WhatsApp failed this week` : 'No failed SMS / WhatsApp this week', link: '/settings/messages' },
    { key: 'backup', ok: backupAge != null && backupAge < 24, text: backupAge == null ? 'No backup taken yet' : backupAge < 24 ? 'Backup taken in the last 24 hours' : `Last backup ${Math.round(backupAge / 24)} day(s) ago`, link: '/settings/backup' },
    { key: 'dayend', ok: !!lastClose?.d && dayjs(t).diff(dayjs(lastClose.d), 'day') <= 1, text: lastClose?.d ? `Last Day End ${dayjs(lastClose.d).format('DD/MM/YYYY')}` : 'No Day End done yet', link: '/accounts/day-report' },
  ] : [];
  res.json({ data: {
    server: { uptimeSec: Math.round(process.uptime()), node: process.version, memoryMb: Math.round(mem.rss / 1048576), time: new Date().toISOString(), mode: process.env.NODE_ENV || 'development' },
    database: { totalMb: Math.round((total / 1048576) * 100) / 100, tables: tables.slice(0, 12).map((r) => ({ name: r.name, rows: Number(exact[r.name] ?? r.row_count ?? 0), kb: Math.round(Number(r.size || 0) / 1024) })) },
    backups: { count: backups.length, latest: backups.slice(0, 3), ageHours: backupAge },
    messages: { enabled: st.SMS_ENABLED === '1', provider: !!st.SMS_PROVIDER_URL, byStatus: msgs, failed, pending },
    checklist, activity,
  } });
});

/* ---------------- settings ---------------- */
router.get('/settings', async (req, res) => {
  res.json({ data: await getSettings(req.query.scope === 'global' ? 0 : req.branchId || 0) });
});
router.put('/settings', permit('s_system', 'edit'), async (req, res) => {
  const scope = req.query.scope === 'branch' ? req.branchId : 0;
  if (req.query.scope === 'branch' && !scope) throw ApiError.badRequest('Select a branch');
  const values = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => k in DEFAULTS));
  await saveSettings(values, scope);
  audit(req, 'UPDATE', 'settings', scope, values);
  res.json({ data: await getSettings(scope) });
});

/* ---------------- bill book / number sequences ---------------- */
router.get('/sequences', permit('s_system', 'view'), requireBranch, async (req, res) => {
  const fy = await queryOne('SELECT id FROM financial_years WHERE is_current = 1');
  const s = await getSettings(req.branchId);
  const loanFy = s.LOAN_NO_RESET_YEARLY === '1' ? fy.id : 0;
  res.json({ data: {
    LOAN: await peekNumber({ queryOne }, { branchId: req.branchId, key: 'LOAN', fyId: loanFy }),
    CUSTOMER: await peekNumber({ queryOne }, { branchId: req.branchId, key: 'CUSTOMER' }),
    RECEIPT: await peekNumber({ queryOne }, { branchId: req.branchId, key: 'RECEIPT', fyId: fy.id }),
  } });
});
router.put('/sequences', permit('s_system', 'edit'), requireBranch, async (req, res) => {
  const fy = await queryOne('SELECT id FROM financial_years WHERE is_current = 1');
  const s = await getSettings(req.branchId);
  const map = { LOAN: s.LOAN_NO_RESET_YEARLY === '1' ? fy.id : 0, CUSTOMER: 0, RECEIPT: fy.id };
  for (const [key, next] of Object.entries(req.body || {})) {
    if (!(key in map) || !Number(next)) continue;
    await setNumber({ query }, { branchId: req.branchId, key, fyId: map[key], lastNo: Number(next) - 1 });
  }
  audit(req, 'BILLBOOK_CHANGE', 'number_sequences', req.branchId, req.body);
  res.json({ ok: true });
});

/* ---------------- financial years ---------------- */
router.get('/financial-years', async (_req, res) => res.json({ data: await query('SELECT * FROM financial_years ORDER BY start_date DESC') }));
router.post('/financial-years/year-end', permit('s_year_end', 'edit'), superOnly, async (req, res) => {
  const cur = await queryOne('SELECT * FROM financial_years WHERE is_current = 1');
  const start = new Date(cur.end_date); start.setDate(start.getDate() + 1);
  const y = start.getFullYear();
  const name = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  await withTransaction(async (tx) => {
    await tx.query('UPDATE financial_years SET is_current = 0, is_closed = 1, closed_at = NOW(), closed_by = :u WHERE id = :id', { u: req.user.id, id: cur.id });
    await tx.query(`INSERT INTO financial_years (name, start_date, end_date, is_current) VALUES (:n, :s, :e, 1)
                    ON DUPLICATE KEY UPDATE is_current = 1`, { n: name, s: `${y}-04-01`, e: `${y + 1}-03-31` });
  });
  audit(req, 'YEAR_END', 'financial_years', cur.id, { next: name });
  res.json({ ok: true, data: { name } });
});

/* ---------------- audit trail ---------------- */
router.get('/audit-logs', permit('s_audit', 'view'), async (req, res) => {
  const lq = parseListQuery(req.query, { sortable: { created_at: 'a.created_at' }, defaultSort: 'created_at' });
  const where = ['(a.branch_id IS NULL OR a.branch_id IN (:b))'];
  const p = { b: req.branchIds };
  if (lq.search) { where.push('(a.action LIKE :s OR a.entity LIKE :s OR u.full_name LIKE :s OR a.entity_id = :raw)'); p.s = `%${lq.search}%`; p.raw = lq.search; }
  if (req.query.from) { where.push('a.created_at >= :from'); p.from = req.query.from; }
  if (req.query.to) { where.push('a.created_at < DATE_ADD(:to, INTERVAL 1 DAY)'); p.to = req.query.to; }
  if (req.query.user_id) { where.push('a.user_id = :uid'); p.uid = req.query.user_id; }
  const w = where.join(' AND ');
  const rows = await query(`SELECT a.*, u.full_name AS user_name, b.name AS branch_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN branches b ON b.id = a.branch_id WHERE ${w} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query(`SELECT COUNT(*) total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE ${w}`, p);
  res.json(paged(rows, total, lq));
});

/* ---------------- message templates & queue ---------------- */
router.use('/message-templates', createCrudRouter({
  table: 'message_templates', screen: 's_messages', alias: 'm',
  fields: ['event_key', 'name', 'body', 'dlt_template_id', 'is_active'], booleans: ['is_active'], required: ['event_key', 'name', 'body'],
  searchable: ['m.name', 'm.event_key'], sortable: { name: 'm.name' }, defaultSort: 'name',
}));
router.get('/message-queue', permit('s_messages', 'view'), async (req, res) => {
  const lq = parseListQuery(req.query, { sortable: { created_at: 'q.created_at' }, defaultSort: 'created_at' });
  const p = { b: req.branchIds };
  const rows = await query(`SELECT q.* FROM message_queue q WHERE q.branch_id IN (:b) ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, p);
  const [{ total }] = await query('SELECT COUNT(*) total FROM message_queue WHERE branch_id IN (:b)', p);
  res.json(paged(rows, total, lq));
});
router.post('/message-queue/retry', permit('s_messages', 'edit'), async (req, res) => {
  await query("UPDATE message_queue SET status = 'PENDING', tries = 0 WHERE status IN ('FAILED','SKIPPED') AND branch_id IN (:b)", { b: req.branchIds });
  res.json({ ok: true });
});

/* ---------------- backup (JSON export of branch data) ---------------- */
const BACKUP_TABLES = ['customers', 'loans', 'loan_items', 'loan_transactions', 'transaction_payments', 'vouchers', 'voucher_entries',
  'bank_accounts', 'bank_pledges', 'auction_notices', 'auction_sales', 'employees', 'salary_payments', 'cash_denominations', 'day_closes'];
const GLOBAL_TABLES = ['company', 'branches', 'metals', 'purities', 'metal_rates', 'items', 'item_categories', 'schemes', 'ledger_groups', 'ledgers', 'settings', 'financial_years', 'roles', 'role_permissions'];

/* backup history + database size (desktop Backup screen tiles) */
router.get('/backup-history', permit('s_backup', 'view'), async (req, res) => {
  const rows = await query(`SELECT a.id, a.created_at, a.details, u.full_name by_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.action = 'BACKUP' ORDER BY a.id DESC LIMIT 50`);
  const size = await queryOne('SELECT ROUND(SUM(data_length + index_length) / 1024) kb, COUNT(*) tables FROM information_schema.tables WHERE table_schema = DATABASE()');
  res.json({ data: { rows, sizeKb: Number(size?.kb || 0), tables: Number(size?.tables || 0) } });
});

/* full backup (every table, every branch) - the kind that can be restored */
router.get('/backup/full', permit('s_backup', 'export'), async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can take a full backup');
  const data = await buildFullBackup();
  const gz = zlib.gzipSync(JSON.stringify(data));
  audit(req, 'BACKUP', 'database', null, { type: req.query.type || 'Full', scope: 'FULL', rows: Object.values(data.tables).reduce((t, r) => t + r.length, 0), kb: Math.round(gz.length / 1024) });
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="gold-finance-full-${new Date().toISOString().slice(0, 10)}.json.gz"`);
  res.send(gz);
});

/* server backup files (auto backup folder) */
router.get('/backup-files', permit('s_backup', 'view'), async (req, res) => {
  const s = await getSettings(0);
  res.json({ data: { files: listBackupFiles(), settings: { AUTO_BACKUP_ENABLED: s.AUTO_BACKUP_ENABLED, AUTO_BACKUP_TIME: s.AUTO_BACKUP_TIME, AUTO_BACKUP_KEEP: s.AUTO_BACKUP_KEEP } } });
});
router.post('/backup-files', permit('s_backup', 'export'), async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can do this');
  res.status(201).json({ data: await writeBackupFile({ type: 'Server', userId: req.user.id, keep: 30 }) });
});
router.get('/backup-files/:name', permit('s_backup', 'export'), async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can do this');
  const p = backupFilePath(req.params.name);
  if (!p) throw ApiError.notFound('Backup file not found');
  res.download(p, req.params.name);
});
router.put('/backup-settings', permit('s_backup', 'edit'), async (req, res) => {
  const b = req.body || {};
  if (b.AUTO_BACKUP_TIME && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.AUTO_BACKUP_TIME)) throw ApiError.badRequest('Time must be HH:MM');
  const values = Object.fromEntries(['AUTO_BACKUP_ENABLED', 'AUTO_BACKUP_TIME', 'AUTO_BACKUP_KEEP'].filter((k) => b[k] != null).map((k) => [k, String(b[k])]));
  if (values.AUTO_BACKUP_KEEP && !(Number(values.AUTO_BACKUP_KEEP) >= 1)) throw ApiError.badRequest('Keep at least 1 file');
  await saveSettings(values, 0);
  audit(req, 'UPDATE', 'settings', 0, values);
  res.json({ ok: true });
});

/* restore a full backup: super admin + password + type RESTORE; a safety backup is written first */
const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
router.post('/restore', permit('s_backup', 'edit'), restoreUpload.single('file'), async (req, res) => {
  if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can restore');
  if (req.body.confirm !== 'RESTORE') throw ApiError.badRequest('Type RESTORE to confirm');
  const me = await queryOne('SELECT password_hash FROM users WHERE id = :id', { id: req.user.id });
  if (!(await bcrypt.compare(req.body.password || '', me.password_hash))) throw ApiError.forbidden('Password is wrong');
  let buf;
  if (req.file) buf = req.file.buffer;
  else { const p = backupFilePath(req.body.file); if (!p) throw ApiError.badRequest('Choose a backup file'); buf = fs.readFileSync(p); }
  let data;
  try { data = parseBackup(buf); } catch (e) { throw ApiError.badRequest(e.message); }
  const safety = await writeBackupFile({ type: 'Before restore', userId: req.user.id, keep: 10 });
  const done = await restoreBackup(data);
  invalidateUserCache?.();
  audit(req, 'RESTORE', 'database', null, { from: req.file?.originalname || req.body.file, taken: data.generated_at, tables: done.length, rows: done.reduce((t, x) => t + x.rows, 0), safety: safety.file });
  res.json({ data: { tables: done.length, rows: done.reduce((t, x) => t + x.rows, 0), taken: data.generated_at, safety: safety.file } });
});

/* due-reminder SMS: who gets one today, and run now */
router.get('/reminders/preview', permit('s_messages', 'view'), requireBranch, async (req, res) => {
  const s = await getSettings(req.branchId);
  res.json({ data: { loans: await dueReminderLoans(req.branchId, s), smsEnabled: s.SMS_ENABLED === '1', templateOn: s.SMS_ON_DUE_REMINDER === '1' } });
});
router.post('/reminders/run', permit('s_messages', 'edit'), requireBranch, async (req, res) => {
  const r = await runDueReminders(req.branchId);
  audit(req, 'SMS_REMINDERS', 'message_queue', null, r);
  res.json({ data: r });
});

router.get('/backup', permit('s_backup', 'export'), async (req, res) => {
  const out = { generated_at: new Date().toISOString(), branches: req.branchIds, tables: {} };
  for (const t of GLOBAL_TABLES) out.tables[t] = await query(`SELECT * FROM ${t}`);
  for (const t of BACKUP_TABLES) {
    const hasBranch = !['loan_items', 'transaction_payments'].includes(t);
    out.tables[t] = hasBranch
      ? await query(`SELECT * FROM ${t} WHERE branch_id IN (:b)`, { b: req.branchIds })
      : t === 'loan_items'
        ? await query('SELECT li.* FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.branch_id IN (:b)', { b: req.branchIds })
        : await query('SELECT tp.* FROM transaction_payments tp JOIN loan_transactions t ON t.id = tp.transaction_id WHERE t.branch_id IN (:b)', { b: req.branchIds });
  }
  const rowsCount = Object.values(out.tables).reduce((t, r) => t + r.length, 0);
  audit(req, 'BACKUP', 'database', null, { branches: req.branchIds, rows: rowsCount, kb: Math.round(JSON.stringify(out).length / 1024), type: req.query.type || 'Manual' });
  res.setHeader('Content-Disposition', `attachment; filename="gold-finance-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(out);
});

export default router;
