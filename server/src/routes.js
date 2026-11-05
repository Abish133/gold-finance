import { Router } from 'express';
import { authenticate } from '#middleware/auth.js';
import { branchScope } from '#middleware/branch.js';

import authRoutes from '#modules/auth/auth.routes.js';
import adminRoutes from '#modules/admin/admin.routes.js';
import mastersRoutes from '#modules/masters/masters.routes.js';
import customersRoutes from '#modules/customers/customers.routes.js';
import loansRoutes from '#modules/loans/loans.routes.js';
import accountsRoutes from '#modules/accounts/accounts.routes.js';
import reportsRoutes from '#modules/reports/reports.routes.js';
import dashboardRoutes from '#modules/dashboard/dashboard.routes.js';
import employeesRoutes from '#modules/employees/employees.routes.js';
import bankRoutes from '#modules/bank/bank.routes.js';
import auctionRoutes from '#modules/auction/auction.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
api.use('/auth', authRoutes);

// everything below needs a logged-in user + resolved branch scope
api.use(authenticate, branchScope);
api.use('/admin', adminRoutes);
api.use('/masters', mastersRoutes);
api.use('/customers', customersRoutes);
api.use('/loans', loansRoutes);
api.use('/accounts', accountsRoutes);
api.use('/reports', reportsRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/employees', employeesRoutes);
api.use('/bank', bankRoutes);
api.use('/auction', auctionRoutes);

export default api;
