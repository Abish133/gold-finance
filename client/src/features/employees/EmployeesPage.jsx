import { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserCog, IdCard, KeyRound, BadgeIndianRupee, CalendarCheck, FileText, Users, Briefcase, FolderOpen, Printer } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Avatar, Button, DataTable, Drawer, Field, Input, Segmented, Select, Tabs } from '@/components/ui';
import { DocumentsPanel } from '@/components/common/DocumentsPanel';
import { DetailsSheet } from '@/features/print/LoanEstimate';
import { useFetch, useList, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { printTable } from '@/lib/printTable';
import { date, money } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

function IdCards({ list, company }) {
  return (
    <div className="flex flex-wrap gap-[4mm] text-black">
      {list.map((e) => (
        <div key={e.id} className="w-[86mm] overflow-hidden rounded-[3mm] border border-black" style={{ height: '54mm' }}>
          <div className="bg-[#18181b] px-3 py-1.5 text-center text-white"><p className="text-[12px] font-bold">{company?.name}</p><p className="text-[8px]">{company?.address1}</p></div>
          <div className="flex gap-3 p-2.5">
            <div className="h-[28mm] w-[22mm] overflow-hidden border border-black bg-gray-100">{e.photo && <img src={e.photo} alt="" className="size-full object-cover" />}</div>
            <div className="text-[10px] leading-relaxed">
              <p className="text-[13px] font-bold">{e.name}</p><p>{e.designation || '-'}</p><p>ID: <b>{e.emp_code}</b></p><p>Phone: {e.phone || '-'}</p><p>Joined: {date(e.doj)}</p>
              {e.emergency_phone && <p>Emergency: {e.emergency_phone}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Employee Master (desktop: frmEmloyeeInformation) - staff details, photo, salary and status. */
export default function EmployeesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: company } = useCompany();
  const { data: tiles } = useFetch('/desk/employee-tiles');
  const roles = useList('/admin/roles', { all: 1 }, { enabled: can('s_users', 'add') });
  const [login, setLogin] = useState(null);
  const [file, setFile] = useState(null);
  const [cred, setCred] = useState({ username: '', password: '', role_id: '' });
  const all = async () => (await api.get('/employees', { all: 1 })).data;
  const idCards = async () => { const l = (await all()).filter((e) => e.status === 'ACTIVE'); printElement(<IdCards list={l} company={company} />, { title: 'ID cards' }); };
  const salarySheet = async () => {
    const m = dayjs().format('YYYY-MM');
    const rows = (await api.get('/employees/salary', { month: m })).data;
    printTable({ title: `Salary sheet · ${dayjs(`${m}-01`).format('MMMM YYYY')}`, company, rows, columns: [
      { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' }, { key: 'salary', label: 'Salary', type: 'money' },
      { key: 'att_present', label: 'Present', type: 'number' }, { key: 'net_pay', label: 'Net paid', type: 'money' }, { key: 'sign', label: 'Signature', print: () => '' }] });
  };
  const summary = async () => printTable({ title: 'Staff summary', company, rows: await all(), columns: [
    { key: 'emp_code', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' }, { key: 'phone', label: 'Mobile' }, { key: 'doj', label: 'Joined', type: 'date' },
    { key: 'salary', label: 'Salary', type: 'money' }, { key: 'status', label: 'Status' }] });
  const createLogin = async () => {
    try {
      await api.post('/admin/users', { full_name: login.name, username: cred.username, password: cred.password, role_id: cred.role_id, employee_id: login.id, phone: login.phone, branch_ids: [login.branch_id] });
      toast.success('Login created'); setLogin(null);
    } catch (e) { toast.error(e.message); }
  };
  useKeys({ f7: () => navigate('/masters/designations'), f4: idCards, f8: () => navigate('/employees/salary'), f5: () => navigate('/employees/attendance'), f11: salarySheet, f12: summary }, [company]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Employees', tiles?.total, 'all', 'border-t-navy-800 bg-cream-100'], ['Working', tiles?.working, 'currently working', 'border-t-emerald-600'], ['Left', tiles?.left_count, 'left / inactive', 'border-t-rose-600'], ['With login', tiles?.with_login, 'employees who can log in', 'border-t-gold-500']].map(([l, v, h, c]) => (
          <div key={l} className={clsx('card border-t-4 px-4 py-3', c)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{v || 0}</p><p className="text-[11px] text-ink-500">{h}</p></div>
        ))}
      </div>
      <ResourcePage
        title="Employee Master" singular="Employee" endpoint="/employees" screen="employees" icon={UserCog} drawerSize="xl" cols={3}
        subtitle="Staff details, photo, salary and status" defaults={{ status: 'ACTIVE', title: 'Mr' }}
        filters={(s, set) => <Segmented value={s.status || ''} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All' }, { value: 'ACTIVE', label: 'Working' }, { value: 'LEFT', label: 'Left' }]} />}
        headerActions={<>
          <Button variant="outline" icon={Briefcase} onClick={() => navigate('/masters/designations')}>Designations (F7)</Button>
          <Button variant="outline" icon={IdCard} onClick={idCards}>ID Card (F4)</Button>
          <Button variant="outline" icon={BadgeIndianRupee} onClick={() => navigate('/employees/salary')}>Salary (F8)</Button>
          <Button variant="outline" icon={CalendarCheck} onClick={() => navigate('/employees/attendance')}>Attendance (F5)</Button>
          <Button variant="outline" icon={FileText} onClick={salarySheet}>Salary Sheet (F11)</Button>
          <Button variant="outline" icon={Users} onClick={summary}>Staff Summary (F12)</Button>
        </>}
        rowActions={(r) => (<>
          <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => setFile(r)}>File</Button>
          {can('s_users', 'add') && <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => { setLogin(r); setCred({ username: r.emp_code.toLowerCase(), password: '', role_id: '' }); }}>Login</Button>}
        </>)}
        columns={[
          { key: 'emp_code', label: 'ID', sortable: true },
          { key: 'name', label: 'Name', sortable: true, render: (r) => <div className="flex items-center gap-3"><Avatar src={r.photo} name={r.name} size="sm" /><div><p className="font-semibold">{r.name}</p><p className="text-xs text-ink-500">{r.relation_type} {r.relation_name}</p></div></div> },
          { key: 'designation', label: 'Designation' }, { key: 'phone', label: 'Mobile' }, { key: 'address', label: 'Address', className: 'max-w-48 truncate text-xs' },
          { key: 'doj', label: 'Joined', type: 'date', sortable: true }, { key: 'salary', label: 'Salary / Month', type: 'money' }, { key: 'login_role', label: 'Login', render: (r) => (r.login_role ? <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy-800 uppercase">{r.login_role}</span> : '') }, { key: 'status', label: 'Status', type: 'status' },
        ]}
        fields={[
          { type: 'section', name: 's1', label: 'Personal' },
          { name: 'emp_code', label: 'Employee ID', required: true }, { name: 'title', label: 'Title', type: 'select', options: ['Mr', 'Mrs', 'Miss'] },
          { name: 'name', label: 'Name', required: true }, { name: 'relation_type', label: 'Relation', type: 'select', options: ['S/o', 'D/o', 'W/o'] },
          { name: 'relation_name', label: 'Relation name' }, { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
          { name: 'dob', label: 'Date of birth', type: 'date' }, { name: 'marital_status', label: 'Marital status', type: 'select', options: ['Single', 'Married'] },
          { name: 'phone', label: 'Mobile' }, { name: 'email', label: 'Email', type: 'email' },
          { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 },
          { type: 'section', name: 's2', label: 'Job' },
          { name: 'designation_id', label: 'Designation', type: 'async-select', endpoint: '/masters/designations' },
          { name: 'department', label: 'Department' }, { name: 'doj', label: 'Date of joining', type: 'date' },
          { name: 'salary', label: 'Monthly salary', type: 'money' }, { name: 'qualification', label: 'Qualification' }, { name: 'experience', label: 'Experience' },
          { type: 'section', name: 's3', label: 'Bank & KYC' },
          { name: 'bank_account', label: 'Bank account' }, { name: 'ifsc', label: 'IFSC' }, { name: 'pan', label: 'PAN' }, { name: 'aadhaar', label: 'Aadhaar' },
          { name: 'emergency_name', label: 'Emergency contact' }, { name: 'emergency_phone', label: 'Emergency phone' },
          { type: 'section', name: 's4', label: 'Status' },
          { name: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Working' }, { value: 'LEFT', label: 'Left' }], placeholder: undefined },
          { name: 'left_date', label: 'Left on', type: 'date', show: (v) => v.status === 'LEFT' },
          { name: 'left_reason', label: 'Reason for leaving', show: (v) => v.status === 'LEFT' },
          { name: 'remarks', label: 'Remarks', type: 'textarea', span: 'full', rows: 2 },
        ]}
      />
      <EmployeeFile emp={file} onClose={() => setFile(null)} company={company} canEdit={can('employees', 'edit')} />
      <Drawer open={!!login} onClose={() => setLogin(null)} size="sm" icon={KeyRound} title={`Create login · ${login?.name}`} footer={<Button variant="gold" onClick={createLogin}>Create login (F6)</Button>}>
        <div className="space-y-3">
          <Field label="Username"><Input value={cred.username} onChange={(e) => setCred({ ...cred, username: e.target.value })} /></Field>
          <Field label="Password" hint="Minimum 6 characters"><Input type="password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} /></Field>
          <Field label="Role"><Select value={cred.role_id} onChange={(e) => setCred({ ...cred, role_id: e.target.value })} placeholder="Select role" options={(roles.data?.data || []).filter((r) => r.is_active && !r.is_system).map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <p className="text-xs text-ink-500">The login gets access to the employee's branch. Change branches later in Settings → Users.</p>
        </div>
      </Drawer>
    </div>
  );
}

/** Employee file: documents + salary history + full details print. */
function EmployeeFile({ emp, onClose, company, canEdit }) {
  const [tab, setTab] = useState('salary');
  const hist = useFetch(emp ? `/desk/employee/${emp.id}/history` : null);
  const salary = hist.data?.salary || [];
  const cols = [['pay_month', 'Month', (r) => dayjs(`${r.pay_month}-01`).format('MMM YYYY')], ['present_days', 'Present', (r) => `${r.present_days}/${r.working_days}`], ['basic', 'Basic', (r) => money(r.basic)],
    ['allowances', 'Allow.', (r) => money(r.allowances)], ['deductions', 'Deduct.', (r) => money(r.deductions)], ['net_pay', 'Net pay', (r) => money(r.net_pay)], ['paid_date', 'Paid on', (r) => (r.paid_date ? date(r.paid_date) : '-')]];
  const print = () => printElement(<DetailsSheet company={company} title="Employee Details" photo={emp.photo} groups={[
    ['Personal', [['Employee ID', emp.emp_code], ['Name', `${emp.title || ''} ${emp.name}`], ['Relation', emp.relation_name && `${emp.relation_type || ''} ${emp.relation_name}`], ['Gender', emp.gender], ['Date of birth', emp.dob && date(emp.dob)], ['Mobile', emp.phone], ['Email', emp.email], ['Address', emp.address]]],
    ['Job', [['Designation', emp.designation], ['Department', emp.department], ['Joined', emp.doj && date(emp.doj)], ['Salary / month', money(emp.salary)], ['Qualification', emp.qualification], ['Experience', emp.experience], ['Status', emp.status]]],
    ['Bank & KYC', [['Bank account', emp.bank_account], ['IFSC', emp.ifsc], ['PAN', emp.pan], ['Aadhaar', emp.aadhaar], ['Emergency', emp.emergency_name && `${emp.emergency_name} ${emp.emergency_phone || ''}`]]],
  ]} tables={[{ title: 'Salary history', rows: salary, columns: cols }]} />, { title: 'Employee details' });
  return (
    <Drawer open={!!emp} onClose={onClose} size="lg" icon={FolderOpen} title={emp ? `${emp.name} · ${emp.emp_code}` : ''} subtitle={emp?.designation}
      footer={emp && <Button variant="outline" icon={Printer} onClick={print}>Print full details</Button>}>
      {emp && (
        <div className="space-y-3">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'salary', label: 'Salary history', count: salary.length }, { value: 'docs', label: 'Documents' }]} />
          {tab === 'docs' ? <DocumentsPanel owner="employee" id={emp.id} canEdit={canEdit} /> : (
            <>
              <p className="text-sm">Total paid: <b>{money(hist.data?.totalPaid || 0)}</b></p>
              <DataTable dense loading={hist.isLoading} rows={salary} columns={cols.map(([key, label, render]) => ({ key, label, render }))} />
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
