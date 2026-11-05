import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Card, DataTable, Input, PageHeader, Tabs } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import dayjs from 'dayjs';

const ST = [['P', 'Present', 'bg-emerald-600'], ['A', 'Absent', 'bg-rose-600'], ['H', 'Half day', 'bg-amber-500'], ['L', 'Leave', 'bg-sky-600'], ['WO', 'Week off', 'bg-ink-500']];

export default function AttendancePage() {
  const { isAllBranches } = useAuth();
  const [tab, setTab] = useState('daily');
  const [d, setD] = useState(today());
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const sheet = useFetch(tab === 'daily' && !isAllBranches ? '/employees/attendance/sheet' : null, { date: d });
  const monthly = useFetch(tab === 'monthly' ? '/employees/attendance/monthly' : null, { month });
  const [rows, setRows] = useState([]);
  useEffect(() => setRows(sheet.data || []), [sheet.data]);
  const save = useMutation({ mutationFn: () => api.post('/employees/attendance/sheet', { date: d, rows }), onSuccess: () => toast.success('Attendance saved'), onError: (e) => toast.error(e.message) });
  const upd = (id, p) => setRows((r) => r.map((x) => (x.employee_id === id ? { ...x, ...p } : x)));

  return (
    <div className="animate-rise">
      <PageHeader icon={CalendarCheck} title="Attendance" subtitle="Mark daily attendance, view monthly summary" />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly summary' }]} />
      {tab === 'daily' && (isAllBranches ? <Card><p className="text-sm">Select a branch.</p></Card> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input type="date" className="w-44" value={d} onChange={(e) => setD(e.target.value)} />
            <Button variant="outline" onClick={() => setRows((r) => r.map((x) => ({ ...x, status: x.status || 'P' })))}>Mark all present</Button>
            <Button variant="gold" className="ml-auto" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
          </div>
          <DataTable rowKey="employee_id" rows={rows} loading={sheet.isLoading} columns={[
            { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' },
            { key: 'status', label: 'Status', render: (r) => (
              <div className="flex flex-wrap gap-1">{ST.map(([k, l, c]) => (
                <button key={k} type="button" onClick={() => upd(r.employee_id, { status: k })} className={clsx('rounded-lg px-2.5 py-1 text-xs font-semibold', r.status === k ? `${c} text-white` : 'bg-ink-100 text-ink-600 dark:bg-ink-800')}>{l}</button>
              ))}</div>
            ) },
            { key: 'in_time', label: 'In', render: (r) => <Input type="time" className="h-8 w-28" value={r.in_time || ''} onChange={(e) => upd(r.employee_id, { in_time: e.target.value })} /> },
            { key: 'out_time', label: 'Out', render: (r) => <Input type="time" className="h-8 w-28" value={r.out_time || ''} onChange={(e) => upd(r.employee_id, { out_time: e.target.value })} /> },
          ]} />
        </>
      ))}
      {tab === 'monthly' && (
        <>
          <Input type="month" className="mb-4 w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
          <DataTable rows={monthly.data || []} loading={monthly.isLoading} columns={[
            { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'present', label: 'Present', type: 'number' }, { key: 'absent', label: 'Absent', type: 'number' },
            { key: 'half_days', label: 'Half', type: 'number' }, { key: 'leave_days', label: 'Leave', type: 'number' }, { key: 'week_off', label: 'Week off', type: 'number' },
          ]} />
        </>
      )}
    </div>
  );
}
