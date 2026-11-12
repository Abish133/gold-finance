import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, DataTable, Input } from '@/components/ui';
import { NeedBranch } from '@/components/common/NeedBranch';
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
    /* fit-screen: the page fits the window; only the staff list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <CalendarCheck className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Attendance</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Mark daily attendance, view monthly summary</p></div>
        <div className="flex overflow-hidden rounded-md border border-white/20">
          {[['daily', 'Daily'], ['monthly', 'Monthly summary']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={clsx('px-3 py-1 text-[12px] font-semibold transition', tab === k ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10')}>{l}</button>
          ))}
        </div>
      </section>
      {tab === 'daily' && (isAllBranches ? <NeedBranch action="mark attendance" /> : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
            <Input type="date" className="!h-8 w-40 text-[13px]" value={d} onChange={(e) => setD(e.target.value)} />
            <Button variant="outline" onClick={() => setRows((r) => r.map((x) => ({ ...x, status: x.status || 'P' })))}>Mark all present</Button>
            <span className="ml-1 text-[11px] text-ink-500">{rows.filter((r) => r.status === 'P').length} present · {rows.filter((r) => r.status === 'A').length} absent · {rows.filter((r) => !r.status).length} not marked</span>
            <Button variant="gold" className="ml-auto" loading={save.isPending} onClick={() => save.mutate()}>Save Attendance</Button>
          </div>
          <DataTable fill rowKey="employee_id" rows={rows} loading={sheet.isLoading} columns={[
            { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' },
            { key: 'status', label: 'Status', render: (r) => (
              <div className="flex flex-wrap gap-1">{ST.map(([k, l, c]) => (
                <button key={k} type="button" onClick={() => upd(r.employee_id, { status: k })} className={clsx('rounded-md px-2 py-0.5 text-[11px] font-semibold transition', r.status === k ? `${c} text-white` : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800')}>{l}</button>
              ))}</div>
            ) },
            { key: 'in_time', label: 'In', render: (r) => <Input type="time" className="!h-7 w-28 text-[12px]" value={r.in_time || ''} onChange={(e) => upd(r.employee_id, { in_time: e.target.value })} /> },
            { key: 'out_time', label: 'Out', render: (r) => <Input type="time" className="!h-7 w-28 text-[12px]" value={r.out_time || ''} onChange={(e) => upd(r.employee_id, { out_time: e.target.value })} /> },
          ]} />
        </>
      ))}
      {tab === 'monthly' && (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]"><span className="text-[11px] font-semibold text-ink-500">Month</span><Input type="month" className="!h-8 w-40 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <DataTable fill rows={monthly.data || []} loading={monthly.isLoading} columns={[
            { key: 'emp_code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'present', label: 'Present', type: 'number' }, { key: 'absent', label: 'Absent', type: 'number' },
            { key: 'half_days', label: 'Half', type: 'number' }, { key: 'leave_days', label: 'Leave', type: 'number' }, { key: 'week_off', label: 'Week off', type: 'number' },
          ]} />
        </>
      )}
    </div>
  );
}
