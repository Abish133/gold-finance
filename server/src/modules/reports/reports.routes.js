import { Router } from 'express';
import { can } from '#middleware/auth.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { REPORTS, defaultParams } from './reports.definitions.js';

const router = Router();

router.get('/', (req, res) => {
  const list = REPORTS.filter((r) => can(req.user, r.screen, 'view'))
    .map(({ key, title, group, params, description, screen }) => ({ key, title, group, params, description, screen }));
  res.json({ data: list });
});

router.get('/:key', async (req, res) => {
  const rep = REPORTS.find((r) => r.key === req.params.key);
  if (!rep) throw ApiError.notFound('Report not found');
  if (!can(req.user, rep.screen, 'view')) throw ApiError.forbidden();
  const params = defaultParams(req.query);
  const rows = await rep.run({ ...params, b: req.branchIds });
  const totals = {};
  for (const k of rep.totals || []) totals[k] = round2(rows.reduce((s, r) => s + num(r[k]), 0));
  res.json({ data: { key: rep.key, title: rep.title, columns: rep.columns, params, rows, totals, count: rows.length } });
});

export default router;
