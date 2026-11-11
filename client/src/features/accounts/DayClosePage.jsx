import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LockOpen, FileText, FileDown, FileSpreadsheet, CalendarCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Input } from '@/components/ui';
import { NeedBranch } from '@/components/common/NeedBranch';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { amount, date, n, today } from '@/lib/format';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { useKeys } from '@/features/loans/desk';

/** Day Close (desktop): closed days with cash, re-open the last closed day (with a reason) and close again. */
export default function DayClosePage() {
  const navigate = useNavigate();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const { data, refetch } = useFetch(isAllBranches ? null : '/accounts/day-close', { all: all ? '1' : '' });
  const [selDate, setSelDate] = useState(null);
  const [reason, setReason] = useState('');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  // the open billing date on top, then the closed days (newest first)
  const rows = useMemo(() => {
    if (!data) return [];
    const open = { date: today(), open: true };
    return [open, ...data.history.map((h) => ({ date: String(h.close_date).slice(0, 10), closed_at: h.closed_at, by: h.closed_by_name, expected: h.expected ?? h.closing_cash, counted: h.counted, pote: h.closing_cash }))];
  }, [data]);
  const sel = rows.find((r) => r.date === selDate) || rows[0];
  const last = data?.lastClosed ? String(data.lastClosed).slice(0, 10) : null;
  const canReopen = sel && !sel.open && sel.date === last && can('day_close', 'delete');

  const reopen = async () => {
    if (!reason.trim()) return toast.error('Enter the reason for re-opening');
    setBusy(true);
    try {
      await api.del(`/accounts/day-close/${sel.date}?reason=${encodeURIComponent(reason.trim())}`);
      toast.success(`${date(sel.date)} re-opened - entries are allowed again`);
      setAsk(false); setReason('');
      ['/accounts/day-close', '/desk/billing-date', '/desk/day-report', '/dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      refetch();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const cols = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'status', label: 'Status' }, { key: 'closed_at', label: 'Closed on', type: 'datetime' }, { key: 'by', label: 'By' },
    { key: 'expected', label: 'Cash expected', type: 'money' }, { key: 'counted', label: 'Cash in hand', type: 'money' }, { key: 'pote', label: 'Pote Baki', type: 'money' }];
  const printRows = rows.map((r) => ({ ...r, status: r.open ? 'OPEN (billing date)' : 'CLOSED' }));
  const pdf = () => printTable({ title: `Day Close · ${all ? 'all days' : 'last 60 days'}`, company, columns: cols, rows: printRows });
  const details = () => navigate(`/accounts/day-report?date=${sel?.date || today()}`);
  const closeAgain = () => navigate('/settings/day-end');
  useKeys({ f3: () => canReopen && setAsk(true), f5: details, f2: closeAgain, 'ctrl+p': pdf, 'ctrl+e': () => exportCsv('day-close', cols, printRows), escape: () => navigate('/') }, [sel, canReopen, rows]);

  if (isAllBranches) return <NeedBranch action="close or reopen its days" />;
  const L = (k, v, cls) => <div className="flex justify-between gap-2 border-b border-dashed border-ink-200 py-1 text-[13px] last:border-0 dark:border-ink-700"><span className="text-ink-500">{k}</span><span className={clsx('num font-semibold', cls)}>{v}</span></div>;
  const closedCount = rows.filter((r) => !r.open).length;
  return (
    /* fit-screen: same layout as Day End - the page fits the window; the day list and the panel scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Day Close</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">Closed days, reopen and close again</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/15">
          <div className="flex items-baseline gap-2 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Billing date</span><span className="num text-[13px] font-bold">{date(today())}</span></div>
          <div className={clsx('flex items-baseline gap-2 border-l border-white/15 px-3 py-1', n(data?.reopened) && 'bg-amber-500 text-navy-950')}><span className={clsx('text-[10px] font-semibold tracking-wider uppercase', n(data?.reopened) ? 'opacity-70' : 'text-white/55')}>Reopened</span><span className="num text-[13px] font-bold">{n(data?.reopened)} days</span></div>
        </div>
      </section>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900">
        <span className="px-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Show</span>
        <div className="flex">{[[false, 'Last 60 days'], [true, 'All days']].map(([v, l]) => (
          <button key={l} type="button" onClick={() => setAll(v)}
            className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md', all === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
            {all === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}
          </button>
        ))}</div>
        <span className="ml-auto text-[11px] text-ink-500">{rows.length} days · {closedCount} closed</span>
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
        {/* days - header stays while rows scroll */}
        <div className="min-h-64 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full text-[12px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-3 py-1.5 font-semibold', c.type === 'money' ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!rows.length && <tr><td colSpan={cols.length} className="py-10 text-center text-[12px] text-ink-400">No closed days yet</td></tr>}
              {rows.map((r) => (
                <tr key={r.date} onClick={() => setSelDate(r.date)} onDoubleClick={() => { setSelDate(r.date); navigate(`/accounts/day-report?date=${r.date}`); }} title="Click to select · double-click for the Day Report"
                  className={clsx('cursor-pointer', sel?.date === r.date ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  <td className="num px-3 py-1">{date(r.date)} <span className="text-[10px] text-ink-400">{dayjs(r.date).format('ddd')}</span></td>
                  <td className="px-3"><span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase', r.open ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40')}>{r.open ? 'Open · billing date' : 'Closed'}</span></td>
                  <td className="num px-3 text-ink-600 dark:text-ink-300">{r.closed_at ? dayjs(r.closed_at).format('DD/MM/YYYY hh:mm A') : '-'}</td><td className="px-3">{r.by || '-'}</td>
                  <td className="num px-3 text-right">{r.open ? '-' : amount(r.expected)}</td><td className="num px-3 text-right">{r.open || r.counted == null ? '-' : amount(r.counted)}</td>
                  <td className="num px-3 text-right font-semibold">{r.open ? '-' : amount(r.pote)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* selected day */}
        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Selected day · {sel ? date(sel.date) : '-'}</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-0.5 dark:border-ink-800">
            {L('Day', sel ? dayjs(sel.date).format('ddd, DD/MM/YYYY') : '-')}
            {L('Status', sel ? (sel.open ? 'OPEN' : 'CLOSED') : '-', sel?.open ? 'text-emerald-700' : 'text-rose-700')}
            {L('Closed on', sel?.closed_at ? dayjs(sel.closed_at).format('DD/MM/YYYY hh:mm A') : '-')}
            {L('Closed by', sel?.by || '-')}
          </div>
          <div className="navy-gradient flex items-baseline justify-between rounded-md px-3 py-2 text-white"><span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Pote Baki</span><span className="num text-xl font-extrabold">{sel && !sel.open ? amount(sel.pote) : '-'}</span></div>
          <div className={clsx('rounded-md border px-2.5 py-1.5 text-[12px]', canReopen ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-800 dark:bg-ink-800/40')}>
            <p className="text-[10px] font-bold tracking-wider uppercase">Reopen will open</p>
            <p>{canReopen ? `${date(sel.date)} - entries allowed again, close it again after correcting` : sel && !sel.open && sel.date !== last ? 'Only the last closed day can be re-opened' : 'Select the last closed day to reopen it'}</p>
          </div>
          <div><p className="label">Reason for reopen</p><Input className="!h-8 text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canReopen} placeholder={canReopen ? 'e.g. wrong release amount' : ''} /></div>
          <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1 [&_button]:h-9 [&_button]:w-full [&_button]:text-[12px]">
            <Button variant="soft-danger" icon={LockOpen} disabled={!canReopen} onClick={() => setAsk(true)}>Reopen (F3)</Button>
            {can('day_close', 'add') ? <Button variant="gold" icon={CalendarCheck} onClick={closeAgain}>Close Again (F2)</Button> : <span />}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="outline" icon={FileText} onClick={details}>Day Details (F5)</Button>
        <p className="hidden min-w-0 flex-1 truncate px-2 text-[11px] text-ink-400 2xl:block">F3 Reopen day (admin) · F2 Close again · F5 Day details · double-click a day = Day Report · Esc Exit</p>
        <span className="flex-1 2xl:hidden" />
        <Button variant="outline" icon={FileDown} onClick={pdf}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('day-close', cols, printRows)}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <ConfirmDrawer open={ask} onClose={() => setAsk(false)} onConfirm={reopen} loading={busy} confirmText="Yes, re-open" title={sel ? `Re-open ${date(sel.date)}?` : 'Re-open day?'}
        message="Entries on this day will be allowed again. Correct them and close the day again from Day End." />
    </div>
  );
}
