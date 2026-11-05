import { ApiError } from '#utils/ApiError.js';

/**
 * Branch scoping.
 * Client sends header `x-branch-id`: a branch id, or `all` (only users with all-branch access).
 *   req.branchIds -> branch ids the request may READ
 *   req.branchId  -> the single branch for WRITES (null when "all" is selected)
 */
export const branchScope = (req, _res, next) => {
  const user = req.user;
  const raw = (req.headers['x-branch-id'] || req.query.branchId || '').toString();
  const allowed = user.branchIds;
  if (!allowed.length) throw ApiError.forbidden('No branch is assigned to your account');

  if (raw === 'all') {
    if (!user.all_branches) throw ApiError.forbidden('You can access only your branch');
    req.branchIds = allowed;
    req.branchId = null;
  } else {
    const id = Number(raw) || user.default_branch_id || allowed[0];
    if (!allowed.includes(id)) throw ApiError.forbidden('You do not have access to this branch');
    req.branchIds = [id];
    req.branchId = id;
  }
  next();
};

/** Use on create/update endpoints: a concrete branch must be selected. */
export const requireBranch = (req, _res, next) => {
  if (!req.branchId) throw ApiError.badRequest('Select a single branch (not "All branches") to save entries');
  next();
};

/** Throws 404 if a record's branch is outside the caller's scope (no data leak). */
export const assertBranch = (req, branchId) => {
  if (!req.branchIds.includes(Number(branchId))) throw ApiError.notFound();
};
