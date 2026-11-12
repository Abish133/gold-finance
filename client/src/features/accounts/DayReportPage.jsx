import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, FileDown, FileSpreadsheet, Coins, CalendarCheck, Printer, Check, X } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, ConfirmDrawer, Input, Modal } from '@/components/ui';
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
      setWorkDate(nextDay); navigate(`/masters?tab=rates&date=${nextDay}`);
    } catch (e) { toast.error(e.message); } finally { setClosing(false); }
  };
  useKeys({ f5: () => setQ(r), f8: () => refetch(), f6: () => setCount(true), f10: () => (isEnd ? closeDay() : navigate('/settings/day-end')), f9: print, 'ctrl+p': print, 'ctrl+e': () => exportCsv('day-report', cols, data?.accounts || []) }, [r, q, data, printFirst, isEnd]);

  return (
    /* fit-screen: the page fits the window; the accounts table and the tally panel scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">{isEnd ? 'Day End' : 'Day Report'}</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">{isEnd ? 'Check everything and close the day' : 'Accounts summary, cash update and print'}</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/15">
          <div className="flex items-baseline gap-2 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Day</span><span className="num text-[13px] font-bold">{dayjs(q.to).format('DD/MM/YYYY (ddd)')}</span></div>
          <span className={clsx('flex items-center px-2.5 text-[11px] font-bold uppercase', data?.dayClosed ? 'bg-rose-600' : 'bg-emerald-600')}>{data?.dayClosed ? 'Closed' : 'Open'}</span>
        </div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <div><p className="label">From</p><Input type="date" className="!h-8 w-36 text-[13px]" value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} /></div>
        <div><p className="label">To</p><Input type="date" className="!h-8 w-36 text-[13px]" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} /></div>
        <Button icon={Search} onClick={() => setQ(r)}>Show (F5)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F8)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('day-report', cols, data?.accounts || [])}>Excel (Ctrl+E)</Button>
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          {/* accounts - header and totals stay while rows scroll */}
          <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
            <table className="w-full text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-20 px-3 py-1.5 text-left font-semibold">A/c No</th><th className="px-3 text-left font-semibold">A/c Name · {dayjs(q.to).format('DD/MM/YYYY (dddd)')}</th><th className="px-3 text-right font-semibold">Jama (Received)</th><th className="px-3 text-right font-semibold">Nave (Paid)</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                <tr className="bg-sky-50 font-semibold dark:bg-sky-950/30"><td /><td className="px-3 py-1">Opening Balance {data?.lastClosed ? `(after Day End ${dayjs(data.lastClosed).format('DD/MM/YYYY')})` : '(no earlier Day End found)'}</td><td className="num px-3 text-right">{amount(data?.opening)}</td><td /></tr>
                {(data?.accounts || []).map((a) => (
                  <tr key={`${a.id}-${a.name}`} className={clsx('hover:bg-ink-50 dark:hover:bg-ink-800/50', a.muted && 'text-ink-400')}><td className="num px-3 py-1">{a.id}</td><td className="px-3">{a.name}</td><td className="num px-3 text-right">{amount(a.jama)}</td><td className="num px-3 text-right">{amount(a.nave)}</td></tr>
                ))}
                {!data?.accounts?.length && <tr><td colSpan={4} className="py-10 text-center text-[12px] text-ink-400">No cash entries in this period</td></tr>}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                <tr className="font-semibold"><td /><td className="px-3 py-1">Total</td><td className="num px-3 text-right">{amount(n(data?.jama) + n(data?.opening))}</td><td className="num px-3 text-right">{amount(data?.nave)}</td></tr>
                <tr className="font-semibold"><td /><td className="px-3 py-1">Closing Balance (Pote Baki)</td><td /><td className="num px-3 text-right">{amount(data?.closing)}</td></tr>
                <tr className="border-t border-amber-300 font-bold dark:border-amber-800"><td /><td className="px-3 py-1">Grand Total</td><td className="num px-3 text-right">{amount(n(data?.jama) + n(data?.opening))}</td><td className="num px-3 text-right">{amount(n(data?.nave) + n(data?.closing))}</td></tr>
              </tfoot>
            </table>
          </div>
          {/* how the money came / went - one slim strip */}
          <div className="grid shrink-0 gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-[12px] sm:grid-cols-2 dark:border-ink-800 dark:bg-ink-900">
            {[['RECEIVED', 'Received from customers', 'bg-emerald-600'], ['PAID', 'Paid to customers', 'bg-rose-600']].map(([dir, label, bar]) => (
              <div key={dir} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase"><span className={clsx('h-3 w-0.5 rounded-sm', bar)} />{label}</p>
                <div className="mt-1 flex flex-wrap gap-1">{MODE.map((m) => (
                  <span key={m} className={clsx('num rounded-sm px-1.5 py-0.5 text-[11px]', n(modeAmt(dir, m)) ? 'bg-ink-100 font-semibold text-navy-900 dark:bg-ink-800 dark:text-white' : 'bg-ink-50 text-ink-400 dark:bg-ink-800/40')}>{m.charAt(0) + m.slice(1).toLowerCase()} {amount(modeAmt(dir, m))}</span>
                ))}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 text-[13px] xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Cash tally</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:border-b [&>div]:border-dashed [&>div]:border-ink-200 [&>div]:py-0.5 [&>div]:text-[13px] [&>div:last-child]:border-0 dark:[&>div]:border-ink-700">
          <Line label="Pote Baki (cash)" value={amount(t?.poteBaki ?? t?.cashInDrawer)} />
          <Line label="− Online / Card / Cheque received" value={amount(t?.onlineReceived)} tone="text-ink-500" />
          <Line label="+ Online / Card / Cheque paid" value={amount(t?.onlinePaid)} tone="text-ink-500" />
          <Line bold label="Cash should be in drawer" value={amount(t?.cashInDrawer)} />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 dark:border-sky-900 dark:bg-sky-950/30">
            <div className="min-w-0"><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">Counted cash</p><p className="num text-base font-bold">{t?.counted != null ? amount(t.counted) : 'Not counted'}</p></div>
            <Button className="h-8 border-0 !bg-sky-600 text-[12px] !text-white hover:!bg-sky-700" icon={Coins} onClick={() => setCount(true)}>Count Cash (F6)</Button>
          </div>
          <div className={clsx('flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-bold', t?.counted == null ? 'border-rose-200 bg-rose-50 text-rose-700' : Math.abs(t.countDiff) < 0.01 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
            {t?.counted == null ? <><X className="size-4" />CASH NOT COUNTED <span className="font-normal">· press F6</span></> : Math.abs(t.countDiff) < 0.01 ? <><Check className="size-4" />CASH TALLIED</> : `${t.countDiff > 0 ? 'EXCESS' : 'SHORTAGE'} ${amount(Math.abs(t.countDiff))}`}
          </div>
          <div className="flex items-center justify-between"><b className="text-[10px] tracking-wider text-ink-500 uppercase">Day End</b><span className={clsx('rounded px-2 py-0.5 text-xs font-bold', data?.dayClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{data?.dayClosed ? 'Closed' : 'Not closed'}</span></div>
          {isEnd ? (
            <div className="flex flex-1 flex-col gap-1.5">
              {[[rateOk, 'Gold / Silver rate entered'], [t?.counted != null, 'Cash counted (F6)', 'Cash not counted (F6)'], [t?.counted != null && Math.abs(t.countDiff) < 0.01, 'Cash tally', 'Cash not tally (Close Day will offer Day Report)']].map(([ok, yes, no]) => (
                <p key={yes} className={clsx('flex items-center gap-2', ok ? 'text-emerald-700' : 'text-rose-600')}>{ok ? <Check className="size-4" /> : <X className="size-4" />}{ok ? yes : no || yes}</p>
              ))}
              <p className="text-ink-600">Account posting: {(data?.accounts || []).filter((a) => a.post && (n(a.jama) || n(a.nave))).length} rows will be written</p>
              <div className="flex items-center justify-between"><span>New billing date</span><b className="num">{dayjs(nextDay).format('DD/MM/YYYY')}</b></div>
              <Checkbox checked={printFirst} onChange={setPrintFirst} label="Print Day Report before closing" />
              {can('day_close', 'add') && <Button variant="gold" className="mt-auto h-10 w-full" icon={CalendarCheck} loading={closing} disabled={data?.dayClosed}
                onClick={closeDay}>{data?.dayClosed ? 'Day already closed' : `Close Day & Move to ${dayjs(nextDay).format('DD/MM/YYYY')} (F10)`}</Button>}
            </div>
          ) : (<>
            <p className="rounded-md bg-ink-50 px-2.5 py-1.5 text-[12px] text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Update entries and count the cash (F6) here. When everything is correct, press Go to Day End.</p>
            <Button variant="gold" className="mt-auto h-10 w-full" icon={CalendarCheck} onClick={() => navigate('/settings/day-end')}>Go to Day End (F10)</Button>
          </>)}
          <div className="grid grid-cols-2 gap-1.5 [&_button]:h-8 [&_button]:w-full [&_button]:text-[12px]"><Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button><ExitButton /></div>
        </div>
      </div>
      <ConfirmDrawer open={sure} onClose={() => setSure(false)} onConfirm={() => closeDay('ok')} tone="primary" loading={closing} confirmText="Yes, close the day"
        title={t?.counted != null && Math.abs(n(t.countDiff)) < 0.01 ? 'Everything is OK.' : 'Close the day?'}
        message={`Close ${dayjs(q.to).format('DD/MM/YYYY')} and move to ${dayjs(nextDay).format('DD/MM/YYYY')}?`} />
      <CashCountDrawer open={count} onClose={() => { setCount(false); refetch(); }} date={q.to} />
      <Modal tone="amber" open={check} onClose={() => setCheck(false)} size="lg" icon={CalendarCheck} title={`Day End check failed for ${dayjs(q.to).format('DD/MM/YYYY')}`}
        footer={<><Button variant="outline" onClick={() => setCheck(false)}>Go back (Esc)</Button><Button variant="outline" onClick={() => closeDay(true)}>Close the day anyway</Button><Button variant="gold" onClick={() => { setCheck(false); navigate('/accounts/day-report'); }}>Open Day Report</Button></>}>
        <ul className="list-disc space-y-1 pl-5 text-sm"><li>Cash has not been counted.</li></ul>
      </Modal>
    </div>
  );
}
