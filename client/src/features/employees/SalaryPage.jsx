import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeIndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, DataTable, Drawer, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, n, round2, today } from '@/lib/format';
import dayjs from 'dayjs';

export default function SalaryPage() {
  const { can, isAllBranches } = useAuth();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const { data = [], isLoading } = useFetch('/employees/salary', { month });
  const { data: lk } = useLookups();
  const [edit, setEdit] = useState(null);
  const qc = useQueryClient();
  const days = dayjs(`${month}-01`).daysInMonth();
  const save = useMutation({
    mutationFn: () => api.post('/employees/salary', { ...edit, pay_month: month }),
    onSuccess: () => { toast.success('Salary saved & posted to accounts'); qc.invalidateQueries({ queryKey: ['/employees/salary'] }); setEdit(null); },
    onError: (e) => toast.error(e.message),
  });
  const open = (r) => setEdit({
    employee_id: r.employee_id, name: r.name, working_days: r.working_days || days, present_days: r.present_days || r.att_present || days,
    basic: r.basic ?? round2((n(r.salary) / days) * n(r.present_days || r.att_present || days)), allowances: r.allowances || 0, deductions: r.deductions || 0,
    advance_recovery: r.advance_recovery || 0, payment_mode: r.payment_mode || 'CASH', paid_date: r.paid_date || today(), remarks: r.remarks || '',
  });
  const net = edit ? round2(n(edit.basic) + n(edit.allowances) - n(edit.deductions) - n(edit.advance_recovery)) : 0;

  return (
    <div className="animate-rise">
      <PageHeader icon={BadgeIndianRupee} title="Salary" subtitle="Monthly payroll with attendance-based pay; payments post to the Salary ledger" actions={<Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />} />
      <DataTable rowKey="employee_id" rows={data} loading={isLoading} onRowClick={can('salary', 'add') && !isAllBranches ? open : undefined}
        totals={{ net_pay: data.reduce((s, r) => s + n(r.net_pay), 0) }} columns={[
          { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' },
          { key: 'salary', label: 'Monthly salary', type: 'money' }, { key: 'att_present', label: 'Present (att.)', type: 'number' },
          { key: 'net_pay', label: 'Net paid', type: 'money' },
          { key: 'paid', label: 'Status', render: (r) => (r.id ? <Badge tone="green">Paid {r.paid_date && dayjs(r.paid_date).format('DD MMM')}</Badge> : <Badge tone="gold">Pending</Badge>) },
        ]} />
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={`Salary · ${edit?.name}`} subtitle={dayjs(`${month}-01`).format('MMMM YYYY')} icon={BadgeIndianRupee}
        footer={<Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Pay {money(net)}</Button>}>
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Working days"><Input type="number" value={edit.working_days} onChange={(e) => setEdit({ ...edit, working_days: e.target.value })} /></Field>
            <Field label="Present days"><Input type="number" value={edit.present_days} onChange={(e) => setEdit({ ...edit, present_days: e.target.value })} /></Field>
            <Field label="Basic"><Input type="number" value={edit.basic} onChange={(e) => setEdit({ ...edit, basic: e.target.value })} /></Field>
            <Field label="Allowances / incentive"><Input type="number" value={edit.allowances} onChange={(e) => setEdit({ ...edit, allowances: e.target.value })} /></Field>
            <Field label="Deductions"><Input type="number" value={edit.deductions} onChange={(e) => setEdit({ ...edit, deductions: e.target.value })} /></Field>
            <Field label="Advance recovery"><Input type="number" value={edit.advance_recovery} onChange={(e) => setEdit({ ...edit, advance_recovery: e.target.value })} /></Field>
            <Field label="Paid on"><Input type="date" value={edit.paid_date} onChange={(e) => setEdit({ ...edit, paid_date: e.target.value })} /></Field>
            <Field label="Mode"><Select value={edit.payment_mode} onChange={(e) => setEdit({ ...edit, payment_mode: e.target.value })} options={['CASH', 'BANK', 'UPI']} /></Field>
            {edit.payment_mode !== 'CASH' && <Field label="Bank account" className="col-span-2"><Select value={edit.bank_account_id || ''} onChange={(e) => setEdit({ ...edit, bank_account_id: e.target.value })} placeholder="Select" options={(lk?.banks || []).map((b) => ({ value: b.id, label: b.bank_name }))} /></Field>}
            <Field label="Remarks" className="col-span-2"><Textarea value={edit.remarks} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
    </div>
  );
}
