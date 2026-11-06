import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit, invalidateUserCache } from '#middleware/auth.js';
import { requireBranch } from '#middleware/branch.js';
import { upload, publicPath } from '#middleware/upload.js';
import { createCrudRouter } from '#utils/crudFactory.js';
import { ApiError } from '#utils/ApiError.js';
import { parseListQuery, paged } from '#utils/pagination.js';
import { SCREENS, SCREEN_KEYS } from '#config/screens.js';
import { audit } from '#services/audit.service.js';
import { getSettings, saveSettings, DEFAULTS } from '#services/settings.service.js';
import { peekNumber, setNumber } from '#services/sequence.service.js';

const router = Router();
const superOnly = (req, _res, next) => { if (!req.user.is_super_admin) throw ApiError.forbidden('Only the super admin can do this'); next(); };

/* ---------------- company ---------------- */
router.get('/company', async (_req, res) => {
  res.json({ data: await queryOne('SELECT * FROM company ORDER BY id LIMIT 1') });
});

router.put('/company', permit('s_company', 'edit'), async (req, res) => {
  const f = ['name', 'local_name', 'licence_no', 'licence_valid_till', 'address1', 'address2', 'address3', 'phone', 'mobile', 'email', 'gstin', 'website'];
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
  fields: ['code', 'name', 'local_name', 'address', 'city', 'pincode', 'phone', 'email', 'manager_name', 'loan_prefix', 'opening_cash', 'is_active'],
  booleans: ['is_active'], required: ['code', 'name'], searchable: ['b.name', 'b.code', 'b.city'],
  sortable: { name: 'b.name', code: 'b.code' }, defaultSort: 'name',
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
  select: 'SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count FROM roles r',
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
