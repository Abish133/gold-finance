import { Router } from 'express';
import { getSettings } from '#services/settings.service.js';
import dayjs from 'dayjs';
import { query, queryOne, withTransaction } from '#config/db.js';
import { permit } from '#middleware/auth.js';
import { requireBranch, assertBranch } from '#middleware/branch.js';
import { upload, publicPath } from '#middleware/upload.js';
import { createCrudRouter } from '#utils/crudFactory.js';
import { ApiError } from '#utils/ApiError.js';
import { round2, num } from '#utils/money.js';
import { audit } from '#services/audit.service.js';
import { postVoucher, paymentLedger, LEDGER } from '#services/accounting.service.js';
import { getCurrentFy } from '#services/settings.service.js';

const router = Router();

/* ---------------- employee master ---------------- */
const employees = createCrudRouter({
  table: 'employees', screen: 'employees', alias: 'e', branchScoped: true,
  select: `SELECT e.*, d.name designation, b.name branch_name, (SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.employee_id = e.id AND u.is_active = 1 LIMIT 1) login_role FROM employees e LEFT JOIN designations d ON d.id = e.designation_id JOIN branches b ON b.id = e.branch_id`,
  fields: ['emp_code', 'title', 'name', 'relation_type', 'relation_name', 'gender', 'dob', 'marital_status', 'address', 'phone', 'email', 'qualification', 'experience',
    'designation_id', 'department', 'doj', 'salary', 'bank_account', 'ifsc', 'pan', 'aadhaar', 'emergency_name', 'emergency_phone', 'status', 'left_date', 'left_reason', 'remarks'],
  required: ['emp_code', 'name'], searchable: ['e.name', 'e.emp_code', 'e.phone'], sortable: { name: 'e.name', emp_code: 'e.emp_code', doj: 'e.doj' },
  filters: { status: 'e.status', designation_id: 'e.designation_id' }, defaultSort: 'name',
  beforeSave: async (d, req, existing) => {
    if (existing && d.salary != null && num(d.salary) !== num(existing.salary)) {
      await query('INSERT INTO salary_history (employee_id, effective_date, old_salary, new_salary, reason, created_by) VALUES (:e, :d, :o, :n, :r, :u)',
        { e: existing.id, d: dayjs().format('YYYY-MM-DD'), o: existing.salary, n: d.salary, r: req.body.salary_reason || 'Revision', u: req.user.id });
    }
    if (d.status === 'LEFT' && !d.left_date) d.left_date = dayjs().format('YYYY-MM-DD');
    const st = await getSettings(req.branchId || 0);
    // desktop: an employee cannot be saved with a mobile number another employee already has
    if (st.EMP_UNIQUE_MOBILE !== '0' && d.phone) {
      const dup = await queryOne('SELECT name FROM employees WHERE phone = :p AND id <> :id LIMIT 1', { p: d.phone, id: existing?.id || 0 });
      if (dup) throw ApiError.conflict(`Mobile ${d.phone} is already used by ${dup.name}`);
    }
    // desktop: marking an employee as Left also makes that user inactive
    if (st.EMP_LEFT_STOP_LOGIN !== '0' && existing && d.status === 'LEFT') await query('UPDATE users SET is_active = 0 WHERE employee_id = :id', { id: existing.id });
    return d;
  },
  extend: (r) => {
    r.get('/:id/salary-history', permit('employees', 'view'), async (req, res) => {
      res.json({ data: await query('SELECT * FROM salary_history WHERE employee_id = :id ORDER BY effective_date DESC', { id: req.params.id }) });
    });
    r.post('/:id/photo', permit('employees', 'edit'), upload.single('file'), async (req, res) => {
      const emp = await queryOne('SELECT * FROM employees WHERE id = :id', { id: req.params.id });
      if (!emp) throw ApiError.notFound();
      assertBranch(req, emp.branch_id);
      const field = req.query.field === 'signature' ? 'signature' : 'photo';
      const p = publicPath(req.file);
      await query(`UPDATE employees SET ${field} = :p WHERE id = :id`, { p, id: emp.id });
      res.json({ data: { [field]: p } });
    });
    r.get('/:id/documents', permit('employees', 'view'), async (req, res) => {
      res.json({ data: await query("SELECT * FROM documents WHERE owner_type = 'EMPLOYEE' AND owner_id = :id AND branch_id IN (:b)", { id: req.params.id, b: req.branchIds }) });
    });
    r.post('/:id/documents', permit('employees', 'edit'), requireBranch, upload.single('file'), async (req, res) => {
      if (!req.file) throw ApiError.badRequest('No file');
      await query("INSERT INTO documents (branch_id, owner_type, owner_id, doc_type, file_path, remarks, created_by) VALUES (:b, 'EMPLOYEE', :o, :t, :p, :r, :u)",
        { b: req.branchId, o: req.params.id, t: req.body.doc_type || 'Document', p: publicPath(req.file), r: req.body.remarks || null, u: req.user.id });
      res.status(201).json({ ok: true });
    });
  },
});

/* ---------------- attendance ---------------- */
router.get('/attendance/sheet', permit('attendance', 'view'), requireBranch, async (req, res) => {
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const rows = await query(`SELECT e.id employee_id, e.emp_code, e.name, d.name designation, a.status, a.in_time, a.out_time, a.remarks
    FROM employees e LEFT JOIN designations d ON d.id = e.designation_id
    LEFT JOIN employee_attendance a ON a.employee_id = e.id AND a.att_date = :d
    WHERE e.branch_id = :b AND e.status = 'ACTIVE' ORDER BY e.name`, { b: req.branchId, d: date });
  res.json({ data: rows });
});

router.post('/attendance/sheet', permit('attendance', 'add'), requireBranch, async (req, res) => {
  const date = req.body.date;
  const rows = (req.body.rows || []).filter((r) => r.status);
  if (!date || !rows.length) throw ApiError.badRequest('Nothing to save');
  const bad = rows.find((r) => !['P', 'A', 'H', 'L', 'WO'].includes(r.status));
  if (bad) throw ApiError.badRequest(`Attendance status must be P, A, H, L or WO (got "${bad.status}")`);
  const vals = rows.map((r) => [req.branchId, r.employee_id, date, r.status, r.in_time || null, r.out_time || null, r.remarks || null]);
  await query(`INSERT INTO employee_attendance (branch_id, employee_id, att_date, status, in_time, out_time, remarks) VALUES ?
    ON DUPLICATE KEY UPDATE status = VALUES(status), in_time = VALUES(in_time), out_time = VALUES(out_time), remarks = VALUES(remarks)`, [vals]);
  audit(req, 'ATTENDANCE', 'employee_attendance', date, { count: rows.length });
  res.json({ ok: true });
});

router.get('/attendance/monthly', permit('attendance', 'view'), async (req, res) => {
  const month = req.query.month || dayjs().format('YYYY-MM');
  const rows = await query(`SELECT e.id, e.emp_code, e.name, SUM(a.status = 'P') present, SUM(a.status = 'A') absent, SUM(a.status = 'L') leave_days,
      SUM(a.status = 'H') half_days, SUM(a.status = 'WO') week_off
    FROM employees e LEFT JOIN employee_attendance a ON a.employee_id = e.id AND DATE_FORMAT(a.att_date, '%Y-%m') = :m
    WHERE e.branch_id IN (:b) AND e.status = 'ACTIVE' GROUP BY e.id ORDER BY e.name`, { b: req.branchIds, m: month });
  res.json({ data: rows });
});

/* ---------------- salary ---------------- */
router.get('/salary', permit('salary', 'view'), async (req, res) => {
  const month = req.query.month || dayjs().format('YYYY-MM');
  const rows = await query(`SELECT e.id employee_id, e.emp_code, e.name, e.salary, d.name designation, s.id, s.pay_month, s.working_days, s.present_days, s.basic, s.allowances,
      s.deductions, s.advance_recovery, s.net_pay, s.paid_date, s.payment_mode, s.remarks,
      (SELECT COUNT(*) FROM employee_attendance a WHERE a.employee_id = e.id AND DATE_FORMAT(a.att_date, '%Y-%m') = :m AND a.status IN ('P','WO')) +
      (SELECT COUNT(*) FROM employee_attendance a WHERE a.employee_id = e.id AND DATE_FORMAT(a.att_date, '%Y-%m') = :m AND a.status = 'H') * 0.5 att_present
    FROM employees e LEFT JOIN designations d ON d.id = e.designation_id LEFT JOIN salary_payments s ON s.employee_id = e.id AND s.pay_month = :m
    WHERE e.branch_id IN (:b) AND (e.status = 'ACTIVE' OR s.id IS NOT NULL) ORDER BY e.name`, { b: req.branchIds, m: month });
  res.json({ data: rows });
});

router.post('/salary', permit('salary', 'add'), requireBranch, async (req, res) => {
  const b = req.body;
  const emp = await queryOne('SELECT * FROM employees WHERE id = :id', { id: b.employee_id });
  if (!emp) throw ApiError.notFound('Employee not found');
  assertBranch(req, emp.branch_id);
  const net = round2(num(b.basic) + num(b.allowances) - num(b.deductions) - num(b.advance_recovery));
  if (net < 0) throw ApiError.badRequest('Net pay cannot be negative');
  const paidDate = b.paid_date || dayjs().format('YYYY-MM-DD');
  await withTransaction(async (tx) => {
    const existing = await tx.queryOne('SELECT * FROM salary_payments WHERE employee_id = :e AND pay_month = :m FOR UPDATE', { e: emp.id, m: b.pay_month });
    if (existing?.voucher_id) {
      await tx.query('UPDATE vouchers SET is_void = 1 WHERE id = :id', { id: existing.voucher_id });
      await tx.query('DELETE FROM voucher_entries WHERE voucher_id = :id', { id: existing.voucher_id });
    }
    const fy = await getCurrentFy(tx);
    const vId = net > 0 ? await postVoucher(tx, {
      branchId: emp.branch_id, fyId: fy.id, date: paidDate, type: 'PAYMENT', narration: `Salary ${b.pay_month} - ${emp.name}`, sourceType: 'SALARY', sourceId: emp.id, userId: req.user.id,
      lines: [{ ledger: LEDGER.SALARY, debit: net }, { ledger: await paymentLedger(tx, { mode: b.payment_mode || 'CASH', bank_account_id: b.bank_account_id }), credit: net }],
    }) : null;
    await tx.query(`INSERT INTO salary_payments (branch_id, employee_id, pay_month, working_days, present_days, basic, allowances, deductions, advance_recovery, net_pay,
        paid_date, payment_mode, voucher_id, remarks, created_by)
      VALUES (:b, :e, :m, :wd, :pd, :basic, :al, :de, :adv, :net, :paid, :mode, :v, :r, :u)
      ON DUPLICATE KEY UPDATE working_days = :wd, present_days = :pd, basic = :basic, allowances = :al, deductions = :de, advance_recovery = :adv, net_pay = :net,
        paid_date = :paid, payment_mode = :mode, voucher_id = :v, remarks = :r`,
    { b: emp.branch_id, e: emp.id, m: b.pay_month, wd: num(b.working_days), pd: num(b.present_days), basic: num(b.basic), al: num(b.allowances), de: num(b.deductions),
      adv: num(b.advance_recovery), net, paid: paidDate, mode: b.payment_mode || 'CASH', v: vId, r: b.remarks || null, u: req.user.id });
  });
  audit(req, 'SALARY', 'salary_payments', emp.id, { month: b.pay_month, net });
  res.json({ ok: true });
});

router.use('/', employees);

export default router;
