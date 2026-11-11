import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeIndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, DataTable, Drawer, Field, Input, Select, Textarea } from '@/components/ui';
import { useFetch, useLookups, useSettings } from '@/hooks/useApi';
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
  const { data: settings } = useSettings();
  const cut = settings?.EMP_CUT_ABSENT !== '0';   // desktop: Salary Sheet cuts salary for Absent / Half Day
  const open = (r) => setEdit({
    employee_id: r.employee_id, name: r.name, working_days: r.working_days || days, present_days: r.present_days || r.att_present || days,
    basic: r.basic ?? (cut ? round2((n(r.salary) / days) * n(r.present_days || r.att_present || days)) : n(r.salary)), allowances: r.allowances || 0, deductions: r.deductions || 0,
    advance_recovery: r.advance_recovery || 0, payment_mode: r.payment_mode || 'CASH', paid_date: r.paid_date || today(), remarks: r.remarks || '',
  });
  const net = edit ? round2(n(edit.basic) + n(edit.allowances) - n(edit.deductions) - n(edit.advance_recovery)) : 0;

  return (
    /* fit-screen: the page fits the window; only the payroll list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <BadgeIndianRupee className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Salary</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Monthly payroll with attendance-based pay; payments post to the Salary ledger</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Paid</span><span className="num text-[13px] font-bold">{data.filter((r) => r.id).length} / {data.length}</span></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <span className="text-[11px] font-semibold text-ink-500">Month</span><Input type="month" className="!h-8 w-40 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)} />
        <span className="ml-auto text-[11px] text-ink-500">Click a staff member to pay this month&apos;s salary</span>
      </div>
      <DataTable fill rowKey="employee_id" rows={data} loading={isLoading} onRowClick={can('salary', 'add') && !isAllBranches ? open : undefined}
        totals={{ net_pay: data.reduce((s, r) => s + n(r.net_pay), 0) }} columns={[
          { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' },
          { key: 'salary', label: 'Monthly salary', type: 'money' }, { key: 'att_present', label: 'Present (att.)', type: 'number' },
          { key: 'net_pay', label: 'Net paid', type: 'money' },
          { key: 'paid', label: 'Status', render: (r) => (r.id ? <Badge tone="green">Paid {r.paid_date && dayjs(r.paid_date).format('DD MMM')}</Badge> : <Badge tone="gold">Pending</Badge>) },
        ]} />
      <Drawer open={!!edit} onClose={() => setEdit(null)} bodyClassName="!px-4 !py-3" title={`Salary · ${edit?.name}`} subtitle={dayjs(`${month}-01`).format('MMMM YYYY')} icon={BadgeIndianRupee}
        footer={<Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Pay {money(net)}</Button>}>
        {edit && (
          <div className="dense grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="Working days"><Input type="number" value={edit.working_days} onChange={(e) => setEdit({ ...edit, working_days: e.target.value })} /></Field>
            <Field label="Present days"><Input type="number" value={edit.present_days} onChange={(e) => setEdit({ ...edit, present_days: e.target.value })} /></Field>
            <Field label="Basic"><Input type="number" value={edit.basic} onChange={(e) => setEdit({ ...edit, basic: e.target.value })} /></Field>
            <Field label="Allowances / incentive"><Input type="number" value={edit.allowances} onChange={(e) => setEdit({ ...edit, allowances: e.target.value })} /></Field>
            <Field label="Deductions"><Input type="number" value={edit.deductions} onChange={(e) => setEdit({ ...edit, deductions: e.target.value })} /></Field>
            <Field label="Advance recovery"><Input type="number" value={edit.advance_recovery} onChange={(e) => setEdit({ ...edit, advance_recovery: e.target.value })} /></Field>
            <Field label="Paid on"><Input type="date" value={edit.paid_date} onChange={(e) => setEdit({ ...edit, paid_date: e.target.value })} /></Field>
            <Field label="Mode"><Select value={edit.payment_mode} onChange={(e) => setEdit({ ...edit, payment_mode: e.target.value })} options={['CASH', 'BANK', 'UPI']} /></Field>
            {edit.payment_mode !== 'CASH' && <Field label="Bank account" className="col-span-2"><Select value={edit.bank_account_id || ''} onChange={(e) => setEdit({ ...edit, bank_account_id: e.target.value })} placeholder="Select" options={(lk?.banks || []).map((b) => ({ value: b.id, label: b.bank_name }))} /></Field>}
            <Field label="Remarks" className="col-span-2"><Textarea rows={2} value={edit.remarks} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
    </div>
  );
}
