import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { RefreshCw, FileDown, FileSpreadsheet, Printer, Lock, NotebookPen, Search } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Badge, Button, Input } from '@/components/ui';
import { SwitchPill, RunButton } from './compact';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
export const NATURE_TONE = { ASSET: 'green', LIABILITY: 'red', INCOME: 'blue', EXPENSE: 'gold', EQUITY: 'violet' };
export const jn = (v) => `${amount(Math.abs(n(v)))} ${n(v) >= 0 ? 'Nave' : 'Jama'}`;

/** Account Ledger (desktop: frmAccountLedger) - every entry of one account with running balance. */
export default function LedgerReportPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: ledgers = [] } = useFetch('/desk/ledger-balances');
  const [q, setQ] = useState('');
  const [ledger, setLedger] = useState(null);
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const [run, setRun] = useState(null);
  const [showSys, setShowSys] = useState(true);
  const { data, refetch } = useFetch(run ? '/accounts/ledger-statement' : null, run);
  const list = useMemo(() => ledgers.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || String(l.id) === q), [ledgers, q]);
  const entries = (data?.entries || []).filter((e) => showSys || !e.source_type);
  const pick = (l) => { setLedger(l); setRun({ ledger_id: l.id, ...range }); };
  const [sp] = useSearchParams();
  // opened from Trial Balance / Final Accounts with ?ledger=<id>
  useEffect(() => { const id = Number(sp.get('ledger')); const l = id && ledgers.find((x) => x.id === id); if (l && ledger?.id !== id) pick(l); }, [sp, ledgers]); // eslint-disable-line react-hooks/exhaustive-deps
  const quick = (k) => {
    const r = { year: [fyStart(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')], today: [today(), today()] }[k];
    setRange({ from: r[0], to: r[1] }); if (ledger) setRun({ ledger_id: ledger.id, from: r[0], to: r[1] });
  };
  const cols = [{ key: 'entry_date', label: 'Date', type: 'date' }, { key: 'voucher_no', label: 'V. No' }, { key: 'narration', label: 'Narration' }, { key: 'voucher_type', label: 'Type' },
    { key: 'credit', label: 'Jama', type: 'money' }, { key: 'debit', label: 'Nave', type: 'money' }, { key: 'balance', label: 'Balance', print: (r) => jn(r.balance) }];
  const doPrint = () => printTable({ title: `Ledger - ${ledger?.name}`, subtitle: `${date(range.from)} to ${date(range.to)}`, company, columns: cols, rows: entries });
  useKeys({ f5: () => ledger && setRun({ ledger_id: ledger.id, ...range }), f6: () => refetch(), 'ctrl+p': doPrint, f9: doPrint, 'ctrl+e': () => exportCsv('ledger', cols, entries), escape: () => navigate('/') }, [ledger, range, entries]);

  const dot = <span className="relative flex size-1.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>;
  const isQuick = (k) => { const r = { year: [fyStart(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')], today: [today(), today()] }[k]; return range.from === r[0] && range.to === r[1]; };
  return (
    /* fit-screen: account list and statement each scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <NotebookPen className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Account Ledger</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Every entry of one account with running balance</p></div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Account</span><b className="truncate text-[13px]">{ledger ? `${ledger.id} · ${ledger.name}` : 'none selected'}</b></div>
      </section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[300px_1fr]">
        <div className="card flex max-h-[50vh] flex-col overflow-hidden xl:max-h-none xl:min-h-0">
          <div className="shrink-0 border-b border-ink-100 p-1.5 dark:border-ink-800"><Input autoFocus prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account name or A/c no" /></div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {list.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => pick(l)} className={clsx('flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px]', ledger?.id === l.id ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                  <span className="num w-7 text-[11px] text-ink-500">{l.id}</span><span className="flex-1 truncate">{l.name}</span>
                  {ledger?.id === l.id && dot}
                  {l.is_system ? <Lock className="size-3 text-gold-600" /> : null}<Badge tone={NATURE_TONE[l.nature]} className="px-1.5 text-[9px]">{l.nature === 'EXPENSE' ? 'Expense' : l.nature.charAt(0) + l.nature.slice(1).toLowerCase()}</Badge>
                </button>
              </li>
            ))}
            {!list.length && <li className="p-3 text-[12px] text-ink-400">No account found</li>}
          </ul>
          <p className="shrink-0 border-t border-ink-100 px-2.5 py-1 text-[10px] text-ink-500 dark:border-ink-800">{list.length} accounts</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
            <div><p className="label">From</p><Input type="date" className="!h-8 w-36 text-[13px]" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
            <div><p className="label">To</p><Input type="date" className="!h-8 w-36 text-[13px]" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
            <div className="flex">{[['year', 'This A/c year'], ['month', 'This month'], ['last', 'Last month'], ['today', 'Today']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => quick(k)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md', isQuick(k) ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{isQuick(k) && dot}{l}</button>
            ))}</div>
            <SwitchPill checked={showSys} onChange={setShowSys} label="Loan / Day End entries" />
            <RunButton className="ml-auto" icon={Search} label="Show" keyHint="F5" disabled={!ledger} onClick={() => ledger && setRun({ ledger_id: ledger.id, ...range })} />
          </div>
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
            {[['Opening', data ? jn(data.opening) : '0.00', 'bg-navy-900 dark:bg-white', 'text-navy-900 dark:text-white'], ['Jama (received)', amount(data?.credit || 0), 'bg-emerald-600', 'text-emerald-700'], ['Nave (paid)', amount(data?.debit || 0), 'bg-rose-600', 'text-rose-600'], ['Closing', data ? jn(data.closing) : '0.00', 'bg-amber-500', 'text-navy-900 dark:text-white']].map(([l, v, bar, c]) => (
              <div key={l} className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800"><span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className={clsx('num truncate text-[15px] leading-tight font-bold', c)}>{v}</p></div>
            ))}
          </div>
          <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 text-left">V. No</th><th className="px-3 text-left">Narration</th><th className="px-3 text-left">Type</th><th className="px-3 text-right">Jama</th><th className="px-3 text-right">Nave</th><th className="px-3 text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data && <tr className="bg-ink-50 dark:bg-ink-800/50"><td className="px-3 py-1.5">{date(range.from)}</td><td /><td className="px-3 font-semibold">Opening balance</td><td /><td /><td /><td className="num px-3 text-right font-semibold">{jn(data.opening)}</td></tr>}
                  {entries.map((e, i) => (
                    <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-800/50"><td className="px-3 py-1.5 whitespace-nowrap">{date(e.entry_date)}</td><td className="px-3">{e.voucher_no}</td><td className="max-w-96 truncate px-3" title={e.narration}>{e.narration}</td><td className="px-3 text-[11px] text-ink-500">{e.voucher_type}</td>
                      <td className="num px-3 text-right text-emerald-700">{n(e.credit) ? amount(e.credit) : ''}</td><td className="num px-3 text-right text-rose-600">{n(e.debit) ? amount(e.debit) : ''}</td><td className="num px-3 text-right font-semibold whitespace-nowrap">{jn(e.balance)}</td></tr>
                  ))}
                  {!data && <tr><td colSpan={7} className="py-12 text-center text-ink-400">Choose an account on the left</td></tr>}
                  {data && !entries.length && <tr><td colSpan={7} className="py-12 text-center text-ink-400">No entries in this period</td></tr>}
                </tbody>
                {data && <tfoot className="sticky bottom-0 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"><tr><td colSpan={4} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total · {entries.length} entries</td><td className="num px-3 text-right text-emerald-700">{amount(data.credit || 0)}</td><td className="num px-3 text-right text-rose-600">{amount(data.debit || 0)}</td><td className="num px-3 text-right whitespace-nowrap">{jn(data.closing)}</td></tr></tfoot>}
              </table>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
            <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
            <Button variant="outline" icon={FileDown} disabled={!data} onClick={doPrint}>PDF (Ctrl+P)</Button>
            <Button variant="outline" icon={FileSpreadsheet} disabled={!data} onClick={() => exportCsv('ledger', cols, entries)}>Excel (Ctrl+E)</Button>
            <Button variant="outline" icon={Printer} disabled={!data} onClick={doPrint}>Print (F9)</Button>
            <ExitButton />
          </div>
        </div>
      </div>
    </div>
  );
}
