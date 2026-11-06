import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, FileDown, FileSpreadsheet, Coins, CalendarCheck, Printer } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, n, today } from '@/lib/format';
import { ExitButton, Line, useKeys } from '@/features/loans/desk';

const MODE = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE'];

/** Day Report (desktop: frmDayDetails) - accounts summary, cash tally and Day End. */
export default function DayReportPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [r, setR] = useState({ from: today(), to: today() });
  const [q, setQ] = useState(r);
  const { data, refetch } = useFetch('/desk/day-report', q);
  const t = data?.tally;
  const cols = [{ key: 'id', label: 'A/c No' }, { key: 'name', label: 'A/c Name' }, { key: 'jama', label: 'Jama (Received)', type: 'money' }, { key: 'nave', label: 'Nave (Paid)', type: 'money' }];
  const print = () => printTable({ title: `Day Report ${dayjs(q.from).format('DD/MM/YYYY')}${q.to !== q.from ? ` - ${dayjs(q.to).format('DD/MM/YYYY')}` : ''}`, company, columns: cols, rows: data?.accounts || [],
    totals: { jama: data?.jama, nave: data?.nave } });
  const modeAmt = (dir, m) => n((data?.modes || []).find((x) => x.dir === dir && x.mode === m)?.amount);
  useKeys({ f5: () => setQ(r), f8: () => refetch(), f6: () => navigate('/accounts/denomination'), f10: () => navigate('/accounts/day-close'), f9: print, 'ctrl+p': print, 'ctrl+e': () => exportCsv('day-report', cols, data?.accounts || []) }, [r, data]);

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Day Report</h1><p className="text-sm text-navy-100">Accounts summary, cash update and print</p></div>
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
                  <tr key={a.id}><td className="px-3 py-1.5">{a.id}</td><td className="px-3">{a.name}</td><td className="num px-3 text-right">{amount(a.jama)}</td><td className="num px-3 text-right">{amount(a.nave)}</td></tr>
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
          <Line label="Pote Baki (cash)" value={amount(t?.cashInDrawer)} />
          <Line label="− Online / Card / Cheque received" value={amount(t?.onlineReceived)} tone="text-ink-500" />
          <Line label="+ Online / Card / Cheque paid" value={amount(t?.onlinePaid)} tone="text-ink-500" />
          <Line bold label="Cash should be in drawer" value={amount(t?.cashInDrawer)} />
          <div className="flex items-center justify-between rounded-md bg-cream-100 px-3 py-2">
            <div><p className="text-xs font-bold text-ink-600 uppercase">Counted cash {dayjs(q.to).format('DD/MM/YYYY')}</p><p className="text-lg font-bold">{t?.counted != null ? amount(t.counted) : 'Not counted'}</p></div>
            <Button variant="outline" icon={Coins} onClick={() => navigate('/accounts/denomination')}>Count Cash (F6)</Button>
          </div>
          <div className={clsx('rounded-md p-3 text-center text-sm font-bold', t?.counted == null ? 'bg-rose-100 text-rose-700' : Math.abs(t.countDiff) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
            {t?.counted == null ? <>CASH NOT COUNTED<p className="text-xs font-normal">Press F6 and count the drawer.</p></> : Math.abs(t.countDiff) < 0.01 ? 'CASH TALLIED' : `${t.countDiff > 0 ? 'EXCESS' : 'SHORTAGE'} ${amount(Math.abs(t.countDiff))}`}
          </div>
          <div className="flex items-center justify-between text-sm"><b className="text-xs text-ink-600 uppercase">Day End</b><span className={clsx('rounded px-2 py-0.5 text-xs font-bold', data?.dayClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{data?.dayClosed ? 'Closed' : 'Not closed'}</span></div>
          <p className="rounded-md bg-cream-100 p-3 text-xs text-ink-700">Update entries and count the cash (F6) here. When everything is correct, press "Go to Day End".</p>
          <Button variant="outline" size="lg" className="h-12 w-full border-emerald-600 text-emerald-700" icon={CalendarCheck} onClick={() => navigate('/accounts/day-close')}>Go to Day End (F10)</Button>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button><ExitButton /></div>
        </div>
      </div>
    </div>
  );
}
