import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LockOpen, FileText, FileDown, FileSpreadsheet, CalendarCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Card, ConfirmDrawer, Input } from '@/components/ui';
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

  if (isAllBranches) return <Card><p className="text-sm">Select a branch.</p></Card>;
  const L = (k, v, cls) => <div className="flex justify-between py-1 text-sm"><span className="text-ink-500">{k}</span><span className={clsx('font-semibold', cls)}>{v}</span></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Day Close</h1><p className="text-sm text-navy-100">Closed days, reopen and close again</p></div>
        <div className="rounded-md bg-white/10 px-4 py-1.5 text-center"><p className="text-[11px] font-bold uppercase">Billing date</p><p className="font-bold">{date(today())}</p></div>
        <div className="rounded-md bg-gold-500 px-4 py-1.5 text-center text-navy-950"><p className="text-[11px] font-bold uppercase">Reopened</p><p className="font-bold">{n(data?.reopened)} days</p></div>
      </section>
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_320px]">
        <div className="card min-h-[calc(100vh-22rem)] overflow-auto">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-bold text-navy-900 uppercase dark:text-white">Days · {all ? 'all' : 'last 60 days'} · {rows.length}</p>
            <div className="flex gap-1">{[[false, 'Last 60 days'], [true, 'All']].map(([v, l]) => <button key={l} type="button" onClick={() => setAll(v)} className={clsx('h-8 rounded border px-4 text-sm font-semibold', all === v ? 'border-navy-300 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div>
          </div>
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-3 py-2', c.type === 'money' ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {rows.map((r) => (
                <tr key={r.date} onClick={() => setSelDate(r.date)} onDoubleClick={() => { setSelDate(r.date); navigate(`/accounts/day-report?date=${r.date}`); }}
                  className={clsx('cursor-pointer hover:bg-navy-50/50', sel?.date === r.date && 'bg-cream-200 dark:bg-ink-800')}>
                  <td className="px-3 py-1.5">{date(r.date)}</td>
                  <td className={clsx('px-3 font-bold', r.open ? 'text-emerald-700' : 'text-rose-700')}>{r.open ? 'OPEN (billing date)' : 'CLOSED'}</td>
                  <td className="px-3">{r.closed_at ? dayjs(r.closed_at).format('DD/MM/YYYY hh:mm A') : '-'}</td><td className="px-3">{r.by || '-'}</td>
                  <td className="num px-3 text-right">{r.open ? '-' : amount(r.expected)}</td><td className="num px-3 text-right">{r.open || r.counted == null ? '-' : amount(r.counted)}</td>
                  <td className="num px-3 text-right">{r.open ? '-' : amount(r.pote)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <p className="navy-gradient -m-4 mb-3 rounded-t-md px-4 py-2 text-sm font-bold text-white uppercase">Selected day · {sel ? date(sel.date) : '-'}</p>
          {L('Day', sel ? dayjs(sel.date).format('ddd, DD/MM/YYYY') : '-')}
          {L('Status', sel ? (sel.open ? 'OPEN' : 'CLOSED') : '-', sel?.open ? 'text-emerald-700' : 'text-rose-700')}
          {L('Closed on', sel?.closed_at ? dayjs(sel.closed_at).format('DD/MM/YYYY hh:mm A') : '-')}
          {L('Closed by', sel?.by || '-')}
          {L('Pote Baki', sel && !sel.open ? amount(sel.pote) : '-')}
          <p className="mt-3 border-t border-ink-200 pt-2 text-xs font-bold text-ink-600 uppercase">Reopen will open</p>
          <p className="text-sm">{canReopen ? `${date(sel.date)} - entries allowed again, close it again after correcting` : sel && !sel.open && sel.date !== last ? 'Only the last closed day can be re-opened' : '-'}</p>
          <p className="mt-3 text-xs font-bold text-ink-600 uppercase">Reason for reopen</p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canReopen} placeholder={canReopen ? 'e.g. wrong release amount' : ''} />
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={LockOpen} disabled={!canReopen} onClick={() => setAsk(true)}>Reopen Day (F3)</Button>
        <Button variant="outline" icon={FileText} onClick={details}>Day Details (F5)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={FileDown} onClick={pdf}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('day-close', cols, printRows)}>Excel (Ctrl+E)</Button>
        {can('day_close', 'add') && <Button variant="gold" icon={CalendarCheck} onClick={closeAgain}>Close Again (F2)</Button>}
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F3 Reopen day (admin) · F2 Close again · F5 Day details · Esc Exit</p>
      <ConfirmDrawer open={ask} onClose={() => setAsk(false)} onConfirm={reopen} loading={busy} confirmText="Yes, re-open" title={sel ? `Re-open ${date(sel.date)}?` : 'Re-open day?'}
        message="Entries on this day will be allowed again. Correct them and close the day again from Day End." />
    </div>
  );
}
