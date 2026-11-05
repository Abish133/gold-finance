import { Router } from 'express';
import { query, queryOne } from '#config/db.js';
import { permit } from '#middleware/auth.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';
import { ApiError } from './ApiError.js';
import { parseListQuery, paged } from './pagination.js';
import { audit } from '#services/audit.service.js';

/**
 * Generic, secure CRUD router for master tables.
 *
 * createCrudRouter({
 *   table: 'items', screen: 'm_items',
 *   fields: ['name', 'category_id', ...]          // writable whitelist
 *   select: 'SELECT i.*, c.name AS category_name FROM items i LEFT JOIN item_categories c ON c.id = i.category_id',
 *   alias: 'i',                                    // alias of `table` inside `select`
 *   searchable: ['i.name'], sortable: { name: 'i.name' }, filters: { category_id: 'i.category_id' },
 *   branchScoped: false,                           // true -> branch_id enforced on every query
 *   sharedBranch: false,                           // true -> rows with branch_id NULL visible to all
 *   required: ['name'], booleans: ['is_active'], beforeSave: async (data, req, existing) => data,
 * })
 */
export const createCrudRouter = (cfg) => {
  const {
    table, screen, fields, alias = 't', select, searchable = [], sortable = {}, filters = {},
    branchScoped = false, sharedBranch = false, required = [], booleans = [], json = [],
    defaultSort, defaultOrder = 'asc', beforeSave, afterSave, extend,
  } = cfg;
  const base = select || `SELECT ${alias}.* FROM ${table} ${alias}`;
  const router = Router();

  const scopeWhere = (req, where, params) => {
    if (!branchScoped) return;
    params.zz_branches = req.branchIds;
    where.push(sharedBranch ? `(${alias}.branch_id IS NULL OR ${alias}.branch_id IN (:zz_branches))` : `${alias}.branch_id IN (:zz_branches)`);
  };

  const clean = (body) => {
    const data = {};
    for (const f of fields) {
      if (!(f in body)) continue;
      let v = body[f];
      if (v === '' || v === undefined) v = null;
      if (booleans.includes(f)) v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
      if (json.includes(f) && v != null && typeof v !== 'string') v = JSON.stringify(v);
      data[f] = v;
    }
    return data;
  };

  const getOne = async (req, id) => {
    const where = [`${alias}.id = :id`];
    const params = { id };
    scopeWhere(req, where, params);
    return queryOne(`${base} WHERE ${where.join(' AND ')}`, params);
  };

  if (extend) extend(router);

  router.get('/', permit(screen, 'view'), async (req, res) => {
    const lq = parseListQuery(req.query, { sortable, defaultSort, defaultOrder });
    const where = ['1=1'];
    const params = {};
    scopeWhere(req, where, params);
    for (const [qk, col] of Object.entries(filters)) {
      if (req.query[qk] !== undefined && req.query[qk] !== '') { where.push(`${col} = :f_${qk}`); params[`f_${qk}`] = req.query[qk]; }
    }
    if (lq.search && searchable.length) {
      where.push(`(${searchable.map((c) => `${c} LIKE :zz_s`).join(' OR ')})`);
      params.zz_s = `%${lq.search}%`;
    }
    const whereSql = where.join(' AND ');
    if (req.query.all === '1') {
      const rows = await query(`${base} WHERE ${whereSql} ${lq.orderBy} LIMIT 2000`, params);
      return res.json({ data: rows });
    }
    const [rows, [{ total }]] = await Promise.all([
      query(`${base} WHERE ${whereSql} ${lq.orderBy} LIMIT ${lq.pageSize} OFFSET ${lq.offset}`, params),
      query(`SELECT COUNT(*) AS total FROM (${base} WHERE ${whereSql}) x`, params),
    ]);
    res.json(paged(rows, total, lq));
  });

  router.get('/:id', permit(screen, 'view'), async (req, res) => {
    const row = await getOne(req, req.params.id);
    if (!row) throw ApiError.notFound();
    res.json({ data: row });
  });

  const writeGuards = branchScoped && !sharedBranch ? [requireBranch] : [];

  router.post('/', permit(screen, 'add'), ...writeGuards, async (req, res) => {
    let data = clean(req.body);
    for (const r of required) if (data[r] == null) throw ApiError.badRequest(`${r.replace(/_/g, ' ')} is required`);
    if (branchScoped && !sharedBranch) data.branch_id = req.branchId;
    if (beforeSave) data = await beforeSave(data, req, null);
    const cols = Object.keys(data);
    const r = await query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => `:${c}`).join(',')})`, data);
    const row = await getOne(req, r.insertId);
    if (afterSave) await afterSave(row, req, null);
    audit(req, 'CREATE', table, r.insertId, data);
    res.status(201).json({ data: row });
  });

  router.put('/:id', permit(screen, 'edit'), async (req, res) => {
    const existing = await getOne(req, req.params.id);
    if (!existing) throw ApiError.notFound();
    if (branchScoped && existing.branch_id) assertBranch(req, existing.branch_id);
    let data = clean(req.body);
    delete data.branch_id;
    if (beforeSave) data = await beforeSave(data, req, existing);
    const cols = Object.keys(data);
    if (cols.length) {
      await query(`UPDATE ${table} SET ${cols.map((c) => `${c} = :${c}`).join(', ')} WHERE id = :zz_id`, { ...data, zz_id: existing.id });
    }
    const row = await getOne(req, existing.id);
    if (afterSave) await afterSave(row, req, existing);
    audit(req, 'UPDATE', table, existing.id, data);
    res.json({ data: row });
  });

  router.delete('/:id', permit(screen, 'delete'), async (req, res) => {
    const existing = await getOne(req, req.params.id);
    if (!existing) throw ApiError.notFound();
    await query(`DELETE FROM ${table} WHERE id = :id`, { id: existing.id });
    audit(req, 'DELETE', table, existing.id, existing);
    res.json({ ok: true });
  });

  return router;
};
