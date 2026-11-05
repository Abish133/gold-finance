import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { queryOne, query } from '#config/db.js';
import { env } from '#config/env.js';
import { authenticate, signToken, COOKIE, loadAuthUser, invalidateUserCache } from '#middleware/auth.js';
import { validate } from '#middleware/validate.js';
import { ApiError } from '#utils/ApiError.js';
import { audit } from '#services/audit.service.js';
import { SCREENS } from '#config/screens.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' } });

const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: env.isProd, path: '/', maxAge: 12 * 3600 * 1000 };

const publicUser = (u) => ({
  id: u.id, username: u.username, full_name: u.full_name, role_name: u.role_name, role_id: u.role_id,
  is_super_admin: u.is_super_admin, all_branches: u.all_branches, branches: u.branches,
  default_branch_id: u.default_branch_id, permissions: u.permissions,
});

router.post('/login', loginLimiter,
  validate(z.object({ username: z.string().min(1), password: z.string().min(1) })),
  async (req, res) => {
    const row = await queryOne('SELECT * FROM users WHERE username = :u', { u: req.body.username.trim() });
    if (!row || !(await bcrypt.compare(req.body.password, row.password_hash))) throw ApiError.unauthorized('Invalid username or password');
    if (!row.is_active) throw ApiError.forbidden('Your account is disabled. Contact admin.');
    await query('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id: row.id });
    invalidateUserCache(row.id);
    const user = await loadAuthUser(row.id);
    if (!user.branches.length) throw ApiError.forbidden('No branch assigned to your account. Contact admin.');
    const token = signToken(row);
    res.cookie(COOKIE, token, cookieOpts);
    req.user = user;
    audit(req, 'LOGIN', 'users', row.id);
    res.json({ data: { user: publicUser(user), screens: SCREENS } });
  });

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => res.json({ data: { user: publicUser(req.user), screens: SCREENS } }));

router.post('/change-password', authenticate,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6, 'Minimum 6 characters') })),
  async (req, res) => {
    const row = await queryOne('SELECT password_hash FROM users WHERE id = :id', { id: req.user.id });
    if (!(await bcrypt.compare(req.body.currentPassword, row.password_hash))) throw ApiError.badRequest('Current password is wrong');
    const hash = await bcrypt.hash(req.body.newPassword, 10);
    await query('UPDATE users SET password_hash = :h, token_version = token_version + 1 WHERE id = :id', { h: hash, id: req.user.id });
    invalidateUserCache(req.user.id);
    const fresh = await queryOne('SELECT id, token_version FROM users WHERE id = :id', { id: req.user.id });
    res.cookie(COOKIE, signToken(fresh), cookieOpts);
    audit(req, 'CHANGE_PASSWORD', 'users', req.user.id);
    res.json({ ok: true });
  });

export default router;
