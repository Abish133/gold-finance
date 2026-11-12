import jwt from 'jsonwebtoken';
import { env } from '#config/env.js';
import { queryOne, query } from '#config/db.js';
import { ApiError } from '#utils/ApiError.js';
import { parsePhones } from '#utils/phones.js';

export const COOKIE = 'gf_token';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.token_version }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

// Small in-memory cache so each request does not hit 3 tables. Invalidated on change.
const cache = new Map();
const TTL = 60_000;
export const invalidateUserCache = (userId) => (userId ? cache.delete(Number(userId)) : cache.clear());

/** what every screen needs of a branch: header, bills, receipts */
const BRANCH_COLS = 'b.id, b.code, b.name, b.local_name, b.address, b.city, b.pincode, b.phone, b.phones, b.licence_no, b.licence_valid_till';
const withPhones = (b) => ({ ...b, phones: parsePhones(b.phones, b.phone) });

export const loadAuthUser = async (userId) => {
  const hit = cache.get(userId);
  if (hit && hit.at > Date.now() - TTL) return hit.user;

  const user = await queryOne(
    `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role_id, u.is_super_admin, u.is_active,
            u.token_version, u.default_branch_id, r.name AS role_name, r.all_branches
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id`,
    { id: userId },
  );
  if (!user) return null;

  const allBranches = !!(user.is_super_admin || user.all_branches);
  const branches = allBranches
    ? await query(`SELECT ${BRANCH_COLS} FROM branches b WHERE b.is_active = 1 ORDER BY b.name`)
    : await query(
        `SELECT ${BRANCH_COLS} FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
          WHERE ub.user_id = :id AND b.is_active = 1 ORDER BY b.name`,
        { id: userId },
      );

  const perms = {};
  if (!user.is_super_admin) {
    const rows = await query('SELECT * FROM role_permissions WHERE role_id = :r', { r: user.role_id });
    for (const p of rows) {
      perms[p.screen_key] = {
        view: !!p.can_view, add: !!p.can_add, edit: !!p.can_edit,
        delete: !!p.can_delete, print: !!p.can_print, export: !!p.can_export,
      };
    }
  }

  const full = {
    ...user,
    is_super_admin: !!user.is_super_admin,
    all_branches: allBranches,
    branches: branches.map(withPhones),
    branchIds: branches.map((b) => b.id),
    permissions: perms,
  };
  cache.set(userId, { at: Date.now(), user: full });
  return full;
};

export const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch {
    throw ApiError.unauthorized('Session expired, please login again');
  }
  const user = await loadAuthUser(Number(payload.sub));
  if (!user || !user.is_active || user.token_version !== payload.tv) throw ApiError.unauthorized();
  req.user = user;
  next();
};

export const can = (user, screen, action = 'view') =>
  user.is_super_admin || !!user.permissions?.[screen]?.[action];

/** Route guard: permit('loan_new', 'add') */
export const permit = (screen, action = 'view') => (req, _res, next) => {
  if (!can(req.user, screen, action)) throw ApiError.forbidden();
  next();
};

/** Passes if the user has the action on ANY of the given screens. */
export const permitAny = (screens, action = 'view') => (req, _res, next) => {
  if (!screens.some((s) => can(req.user, s, action))) throw ApiError.forbidden();
  next();
};
