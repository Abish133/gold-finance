import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, FileDown, FileSpreadsheet, Coins, CalendarCheck, Printer, Check, X } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, ConfirmDrawer, Drawer, Input } from '@/components/ui';
import { useFetch, useCompany, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, n, today, setWorkDate } from '@/lib/format';
import { ExitButton, Line, useKeys } from '@/features/loans/desk';
import { CashCountDrawer } from './DenominationPage';

const MODE = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE'];

/** Day Report (desktop: frmDayDetails) and Day End (mode="end"): accounts summary, cash tally, close the day. */
export default function DayReportPage({ mode = 'report' }) {
  const isEnd = mode === 'end';
  const qc = useQueryClient();
  const { can, isAllBranches } = useAuth();
  const { data: lk } = useLookups();
  const billing = useFetch(isEnd ? '/desk/billing-date' : null);
  const [printFirst, setPrintFirst] = useState(true);
  const [closing, setClosing] = useState(false);
  const [count, setCount] = useState(false);
  const [sure, setSure] = useState(false);
  const navigate = useNavigate();
  const { data: company } = useCompany();
  // ?date= opens a given day (Day Close -> Day Details)
  const askDate = new URLSearchParams(window.location.search).get('date');
  const [r, setR] = useState({ from: askDate || today(), to: askDate || today() });
  const [q, setQ] = useState(r);
  // Day End works on the billing date (the day after the last Day End)
  useEffect(() => { const d = billing.data?.billingDate; if (isEnd && d) { setR({ from: d, to: d }); setQ({ from: d, to: d }); } }, [isEnd, billing.data?.billingDate]);
  const { data, refetch } = useFetch('/desk/day-report', q);
  const rateOk = (lk?.rates || []).some((x) => dayjs(x.rate_date).isSame(dayjs(q.to), 'day'));
  const nextDay = dayjs(q.to).add(1, 'day').format('YYYY-MM-DD');
  const t = data?.tally;
  const cols = [{ key: 'id', label: 'A/c No' }, { key: 'name', label: 'A/c Name' }, { key: 'jama', label: 'Jama (Received)', type: 'money' }, { key: 'nave', label: 'Nave (Paid)', type: 'money' }];
  const print = () => printTable({ title: `Day Report ${dayjs(q.from).format('DD/MM/YYYY')}${q.to !== q.from ? ` - ${dayjs(q.to).format('DD/MM/YYYY')}` : ''}`, company, columns: cols, rows: data?.accounts || [],
    totals: { jama: data?.jama, nave: data?.nave } });
  const modeAmt = (dir, m) => n((data?.modes || []).find((x) => x.dir === dir && x.mode === m)?.amount);
  const [check, setCheck] = useState(false);
  const closeDay = async (force) => {
    if (isAllBranches) return toast.error('Select a branch to close the day');
    if (q.from !== q.to) return toast.error('Day End closes one day - set From and To to the same date');
    if (data?.dayClosed) return toast.error('This day is already closed');
    // desktop: "Day End check failed - Cash has not been counted" -> Day Report / close anyway / go back
    if (force !== true && force !== 'ok' && t?.counted == null) return setCheck(true);
    setCheck(false);
    // desktop: "Everything is OK. Close dd/mm/yyyy and move to dd/mm/yyyy?"
    if (force !== 'ok') return setSure(true);
    setSure(false);
    setClosing(true);
    try {
      if (printFirst) await print();
      await api.post('/accounts/day-close', { date: q.to });
      toast.success(`Day ${dayjs(q.to).format('DD/MM/YYYY')} closed. Billing date is now ${dayjs(nextDay).format('DD/MM/YYYY')}`);
      ['/desk/billing-date', '/desk/day-report', '/accounts/day-close', '/dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      // desktop: Metal Rate Update opens for the new billing date
      setWorkDate(nextDay); navigate(`/masters/rates?date=${nextDay}`);
    } catch (e) { toast.error(e.message); } finally { setClosing(false); }
  };
  useKeys({ f5: () => setQ(r), f8: () => refetch(), f6: () => setCount(true), f10: () => (isEnd ? closeDay() : navigate('/settings/day-end')), f9: print, 'ctrl+p': print, 'ctrl+e': () => exportCsv('day-report', cols, data?.accounts || []) }, [r, q, data, printFirst, isEnd]);

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">{isEnd ? 'Day End' : 'Day Report'}</h1><p className="text-sm text-navy-100">{isEnd ? 'Check everything and close the day' : 'Accounts summary, cash update and print'}</p></div>
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-1.5 text-ink-800">
          <span className="px-1 text-xs">From</span><Input type="date" className="h-9 w-40" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} />
          <span className="px-1 text-xs">To</span><Input type="date" className="h-9 w-40" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} />
          <Button size="sm" icon={Search} onClick={() => setQ(r)}>Show (F5)</Button>
          <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F8)</Button>
          <Button size="sm" variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
          <Button size="sm" variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('day-report', cols, data?.accounts || [])}>Excel (Ctrl+E)</Button>
        </div>
        <div className={clsx('rounded-md px-4 py-1.5 text-center', data?.dayClosed ? 'bg-rose-600' : 'bg-white/10')}><p className="font-bold">{dayjs(q.to).format('DD/MM/YYYY')}</p><p className="text-xs">{data?.dayClosed ? 'Closed' : 'Open'}</p></div>
      </section>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="card overflow-hidden">
            <div className="flex justify-between px-4 py-2 text-sm"><b className="text-ink-600 uppercase">Accounts</b><b>{dayjs(q.to).format('DD/MM/YYYY (dddd)')}</b></div>
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr><th className="w-20 px-3 py-2 text-left">A/c No</th><th className="px-3 text-left">A/c Name</th><th className="px-3 text-right">Jama (Received)</th><th className="px-3 text-right">Nave (Paid)</th></tr></thead>
              <tbody className="divide-y divide-ink-200">
                <tr className="bg-cream-100 font-semibold"><td /><td className="px-3 py-1.5">Opening Balance {data?.lastClosed ? `(after Day End ${dayjs(data.lastClosed).format('DD/MM/YYYY')})` : '(no earlier Day End found)'}</td><td className="num px-3 text-right">{amount(data?.opening)}</td><td /></tr>
                {(data?.accounts || []).map((a) => (
                  <tr key={`${a.id}-${a.name}`} className={a.muted ? 'text-ink-400' : ''}><td className="px-3 py-1.5">{a.id}</td><td className="px-3">{a.name}</td><td className="num px-3 text-right">{amount(a.jama)}</td><td className="num px-3 text-right">{amount(a.nave)}</td></tr>
                ))}
                {!data?.accounts?.length && <tr><td colSpan={4} className="py-10 text-center text-ink-400">No cash entries in this period</td></tr>}
              </tbody>
              <tfoot className="navy-gradient text-white">
                <tr className="font-semibold"><td /><td className="px-3 py-1">Total</td><td className="num px-3 text-right">{amount(n(data?.jama) + n(data?.opening))}</td><td className="num px-3 text-right">{amount(data?.nave)}</td></tr>
                <tr className="font-semibold"><td /><td className="px-3 py-1">Closing Balance (Pote Baki)</td><td /><td className="num px-3 text-right">{amount(data?.closing)}</td></tr>
                <tr className="font-bold"><td /><td className="px-3 py-1.5">Grand Total</td><td className="num px-3 text-right">{amount(n(data?.jama) + n(data?.opening))}</td><td className="num px-3 text-right">{amount(n(data?.nave) + n(data?.closing))}</td></tr>
              </tfoot>
            </table>
          </div>
          <div className="card space-y-2 p-4 text-sm">
            <p className="text-xs font-bold text-ink-600 uppercase">How the money came / went (from payment mode entries)</p>
            {[['RECEIVED', 'Received from customers (part payment / interest / release)'], ['PAID', 'Paid to customers (new loans / top-up)']].map(([dir, label]) => (
              <div key={dir}><p className="text-ink-600">{label}</p><div className="mt-1 flex flex-wrap gap-1.5">{MODE.map((m) => <span key={m} className="rounded bg-ink-100 px-2 py-0.5 text-xs">{m.charAt(0) + m.slice(1).toLowerCase()} {amount(modeAmt(dir, m))}</span>)}</div></div>
            ))}
          </div>
        </div>
        <div className="card space-y-3 p-4">
          <p className="text-xs font-bold text-ink-600 uppercase">Cash tally</p>
          <Line label="Pote Baki (cash)" value={amount(t?.poteBaki ?? t?.cashInDrawer)} />
          <Line label="− Online / Card / Cheque received" value={amount(t?.onlineReceived)} tone="text-ink-500" />
          <Line label="+ Online / Card / Cheque paid" value={amount(t?.onlinePaid)} tone="text-ink-500" />
          <Line bold label="Cash should be in drawer" value={amount(t?.cashInDrawer)} />
          <div className="flex items-center justify-between rounded-md bg-cream-100 px-3 py-2">
            <div><p className="text-xs font-bold text-ink-600 uppercase">Counted cash {dayjs(q.to).format('DD/MM/YYYY')}</p><p className="text-lg font-bold">{t?.counted != null ? amount(t.counted) : 'Not counted'}</p></div>
            <Button variant="outline" icon={Coins} onClick={() => setCount(true)}>Count Cash (F6)</Button>
          </div>
          <div className={clsx('rounded-md p-3 text-center text-sm font-bold', t?.counted == null ? 'bg-rose-100 text-rose-700' : Math.abs(t.countDiff) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
            {t?.counted == null ? <>CASH NOT COUNTED<p className="text-xs font-normal">Press F6 and count the drawer.</p></> : Math.abs(t.countDiff) < 0.01 ? 'CASH TALLIED' : `${t.countDiff > 0 ? 'EXCESS' : 'SHORTAGE'} ${amount(Math.abs(t.countDiff))}`}
          </div>
          <div className="flex items-center justify-between text-sm"><b className="text-xs text-ink-600 uppercase">Day End</b><span className={clsx('rounded px-2 py-0.5 text-xs font-bold', data?.dayClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{data?.dayClosed ? 'Closed' : 'Not closed'}</span></div>
          {isEnd ? (
            <div className="space-y-1.5 text-sm">
              {[[rateOk, 'Gold / Silver rate entered'], [t?.counted != null, 'Cash counted (F6)', 'Cash not counted (F6)'], [t?.counted != null && Math.abs(t.countDiff) < 0.01, 'Cash tally', 'Cash not tally (Close Day will offer Day Report)']].map(([ok, yes, no]) => (
                <p key={yes} className={clsx('flex items-center gap-2', ok ? 'text-emerald-700' : 'text-rose-600')}>{ok ? <Check className="size-4" /> : <X className="size-4" />}{ok ? yes : no || yes}</p>
              ))}
              <p className="text-ink-600">Account posting: {(data?.accounts || []).filter((a) => a.post && (n(a.jama) || n(a.nave))).length} rows will be written</p>
              <div className="flex items-center justify-between"><span>New billing date</span><b className="num">{dayjs(nextDay).format('DD/MM/YYYY')}</b></div>
              <Checkbox checked={printFirst} onChange={setPrintFirst} label="Print Day Report before closing" />
              {can('day_close', 'add') && <Button variant="outline" size="lg" className="h-12 w-full border-emerald-600 bg-amber-50 text-emerald-800" icon={CalendarCheck} loading={closing} disabled={data?.dayClosed}
                onClick={closeDay}>{data?.dayClosed ? 'Day already closed' : `Close Day & Move to ${dayjs(nextDay).format('DD/MM/YYYY')} (F10)`}</Button>}
            </div>
          ) : (<>
            <p className="rounded-md bg-cream-100 p-3 text-xs text-ink-700">Update entries and count the cash (F6) here. When everything is correct, press Go to Day End.</p>
            <Button variant="outline" size="lg" className="h-12 w-full border-emerald-600 text-emerald-700" icon={CalendarCheck} onClick={() => navigate('/settings/day-end')}>Go to Day End (F10)</Button>
          </>)}
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button><ExitButton /></div>
        </div>
      </div>
      <ConfirmDrawer open={sure} onClose={() => setSure(false)} onConfirm={() => closeDay('ok')} tone="primary" loading={closing} confirmText="Yes, close the day"
        title={t?.counted != null && Math.abs(n(t.countDiff)) < 0.01 ? 'Everything is OK.' : 'Close the day?'}
        message={`Close ${dayjs(q.to).format('DD/MM/YYYY')} and move to ${dayjs(nextDay).format('DD/MM/YYYY')}?`} />
      <CashCountDrawer open={count} onClose={() => { setCount(false); refetch(); }} date={q.to} />
      <Drawer open={check} onClose={() => setCheck(false)} size="sm" icon={CalendarCheck} title={`Day End check failed for ${dayjs(q.to).format('DD/MM/YYYY')}`}
        footer={<><Button variant="outline" onClick={() => setCheck(false)}>Go back (Esc)</Button><Button variant="outline" onClick={() => closeDay(true)}>Close the day anyway</Button><Button variant="gold" onClick={() => { setCheck(false); navigate('/accounts/day-report'); }}>Open Day Report</Button></>}>
        <ul className="list-disc space-y-1 pl-5 text-sm"><li>Cash has not been counted.</li></ul>
      </Drawer>
    </div>
  );
}
