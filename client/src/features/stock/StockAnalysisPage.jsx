import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderOpen, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut, FileText, Search } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { LoanDetailsDrawer } from '@/features/loans/LoanDetailsDrawer';
import { api } from '@/lib/api';

const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const RESULT = { PROFIT: ['Profit', 'bg-emerald-100 text-emerald-800'], RISK: ['At risk', 'bg-amber-100 text-amber-800'], LOSS: ['Loss', 'bg-rose-100 text-rose-700'] };
const cols = [
  { key: 'sno', label: 'S.No' }, { key: 'result', label: 'Result', print: (r) => RESULT[r.result]?.[0] }, { key: 'bill_no', label: 'Loan No' }, { key: 'manual_bill_no', label: 'Bill Book No' },
  { key: 'loan_date', label: 'Pledge Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'loan_on', label: 'Metal' }, { key: 'where', label: 'Where' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'purity', label: 'Purity %', type: 'number' }, { key: 'months', label: 'Months', type: 'number' }, { key: 'interest_rate', label: 'ROI %', type: 'number' },
  { key: 'principal', label: 'Loan Amt', type: 'money' }, { key: 'part_paid', label: 'Part Paid', type: 'money' }, { key: 'balance', label: 'Balance', type: 'money' },
  { key: 'interest_due', label: 'Interest Due', type: 'money' }, { key: 'total_due', label: 'Total Due', type: 'money' }, { key: 'market_value', label: 'Market Value', type: 'money' },
  { key: 'margin', label: 'Margin', type: 'money' }, { key: 'margin_pct', label: 'Margin %', type: 'number' },
];

/** Stock Analysis (desktop): open loans - amount due against the market value of the pledged items. */
export default function StockAnalysisPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: fyStart(), to: today(), as_on: today(), age: 0, loan_on: '', where: '', search: '' });
  const [q, setQ] = useState(null);
  const { data: billing } = useFetch('/desk/billing-date');
  useEffect(() => { if (billing?.oldestOpen) setF((x) => (x.from === fyStart() ? { ...x, from: billing.oldestOpen } : x)); }, [billing?.oldestOpen]);
  const [result, setResult] = useState('');
  const [sel, setSel] = useState(null);
  const [details, setDetails] = useState(null);
  const { data, isFetching, refetch } = useFetch(q ? '/desk/stock-analysis' : null, q);
  const s = data?.summary;
  const rows = useMemo(() => (data?.rows || []).filter((r) => !result || r.result === result).map((r, i) => ({ ...r, sno: i + 1 })), [data, result]);
  const load = () => setQ({ ...f });
  const open = async (r) => { if (r) setDetails((await api.get(`/loans/${r.id}`)).data); };
  const title = `Stock Analysis as on ${date(q?.as_on || f.as_on)}`;
  const preview = () => printTable({ title, company, columns: cols, rows, totals: { net_wt: rows.reduce((t, r) => t + n(r.net_wt), 0), principal: rows.reduce((t, r) => t + n(r.principal), 0), total_due: rows.reduce((t, r) => t + n(r.total_due), 0), market_value: rows.reduce((t, r) => t + n(r.market_value), 0) } });
  useKeys({ f5: load, 'ctrl+r': () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('stock-analysis', cols, rows), f3: () => document.getElementById('sa-search')?.focus(), escape: () => navigate('/') }, [f, rows, sel]);
  const seg = (k, opts) => <div className="flex">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{f[k] === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div>;
  const tile = (label, v, h, cls, k) => (
    <button type="button" disabled={k === undefined} onClick={() => k !== undefined && setResult(result === k ? '' : k)}
      className={clsx('relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 text-left not-last:border-r dark:border-ink-800', k !== undefined ? 'hover:bg-ink-50 dark:hover:bg-ink-800/50' : 'cursor-default', k !== undefined && result === k && 'bg-emerald-50/70 dark:bg-emerald-950/30')}>
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', cls)} />
      <p className="flex items-center gap-1.5 truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="num truncate text-lg leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </button>
  );

  return (
    /* fit-screen: the page fits the window; only the table scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Stock Analysis</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Open loans - amount due against the market value of pledged items</p></div>
        <div className="flex overflow-hidden rounded-md border border-white/15">
          {[['As on', date(q?.as_on || f.as_on)], ['Gold', data?.rates.gold ? `₹${amount(data.rates.gold)}` : '-', true], ['Silver', data?.rates.silver ? `₹${amount(data.rates.silver)}` : '-']].map(([k, v, g]) => (
            <div key={k} className={clsx('flex items-baseline gap-2 border-l border-white/15 px-3 py-1 first:border-l-0', g && 'bg-white text-ink-900')}><span className={clsx('text-[10px] font-semibold tracking-wider uppercase', g ? 'text-ink-500' : 'text-white/55')}>{k}</span><span className="num text-[13px] font-bold">{v}</span></div>
          ))}
        </div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="From"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="As on"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.as_on} max={today()} onChange={(e) => setF({ ...f, as_on: e.target.value })} /></Field>
        <div><p className="label">Age</p>{seg('age', [[0, 'All'], [6, '6 m +'], [12, '12 m +']])}</div>
        <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'In bank']])}</div>
        <div><p className="label">Result</p><div className="flex">{[['', 'All'], ['PROFIT', 'Profit'], ['RISK', 'At risk'], ['LOSS', 'Loss']].map(([k, l]) => <button key={k} type="button" onClick={() => setResult(k)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', result === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{result === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div></div>
        <div className="min-w-48 flex-1"><p className="label">Search (F3)</p><Input id="sa-search" prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Loan / customer" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
        <Button className="h-8" icon={FolderOpen} loading={isFetching} onClick={load}>Load (F5)</Button>
      </div>
      <div className="grid shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 dark:border-ink-800 dark:bg-ink-900">
        {tile('Open loans', s?.open ?? 0, `Gold ${weight(s?.goldWt)} g · Silver ${weight(s?.silverWt)} g`, 'bg-navy-800')}
        {tile('Principal due', `Rs. ${amount(s?.principal || 0)}`, `Loan given Rs. ${amount(s?.given || 0)}`, 'bg-blue-600')}
        {tile('Interest due', `Rs. ${amount(s?.interest || 0)}`, `Up to ${date(q?.as_on || f.as_on)}`, 'bg-violet-600')}
        {tile('Market value', `Rs. ${amount(s?.market || 0)}`, `Total due Rs. ${amount(s?.totalDue || 0)}`, 'bg-lime-700')}
        {tile('Profit loans', s?.profit ?? 0, `Rs. ${amount(s?.profitAmt || 0)} margin`, 'bg-emerald-700', 'PROFIT')}
        {tile(`At risk (margin < ${data?.margin ?? 10}%)`, s?.risk ?? 0, `Rs. ${amount(s?.riskAmt || 0)} margin`, 'bg-amber-500', 'RISK')}
        {tile('Loss loans', s?.loss ?? 0, `Rs. ${amount(Math.abs(s?.lossAmt || 0))} short`, 'bg-rose-600', 'LOSS')}
      </div>
      <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full min-w-[1600px] text-[12px]">
          <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold whitespace-nowrap', ['money', 'weight', 'number'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!rows.length && <tr><td colSpan={cols.length} className="py-12 text-center text-[12px] text-ink-400">{q ? 'No open loans' : 'Select the dates and press Load (F5)'}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => open(r)} className={clsx('cursor-pointer', sel?.id === r.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                <td className={clsx('border-l-2 px-2 py-1', sel?.id === r.id ? 'border-emerald-600' : 'border-transparent')}>{r.sno}</td><td className="px-2"><span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold', RESULT[r.result][1])}>{RESULT[r.result][0]}</span></td>
                <td className="px-2 font-semibold">{r.bill_no}</td><td className="px-2">{r.manual_bill_no || '-'}</td><td className="px-2">{date(r.loan_date)}</td>
                <td className="px-2"><b>{r.customer_name}</b>{r.relation_name ? <span className="text-xs text-ink-500"> {r.relation_type} {r.relation_name}</span> : ''}</td>
                <td className="px-2">{r.loan_on}</td><td className={clsx('px-2', r.where === 'Bank' && 'text-violet-700')}>{r.where === 'Bank' ? 'In bank' : r.where === 'Hand' ? 'In hand' : r.where}</td><td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{n(r.purity)}</td>
                <td className="num px-2 text-right">{Math.round(n(r.months) * 10) / 10}</td><td className="num px-2 text-right">{n(r.interest_rate)}</td><td className="num px-2 text-right">{amount(r.principal)}</td>
                <td className="num px-2 text-right">{n(r.part_paid) ? amount(r.part_paid) : '-'}</td><td className="num px-2 text-right">{amount(r.balance)}</td><td className="num px-2 text-right">{amount(r.interest_due)}</td>
                <td className="num px-2 text-right font-bold">{amount(r.total_due)}</td><td className="num px-2 text-right">{amount(r.market_value)}</td>
                <td className={clsx('num px-2 text-right font-semibold', n(r.margin) < 0 ? 'text-rose-600' : 'text-emerald-700')}>{amount(r.margin)}</td><td className="num px-2 text-right">{r.margin_pct ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="outline" icon={FileText} disabled={!sel} onClick={() => open(sel)}>Loan Details (Enter)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (Ctrl+R)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('stock-analysis', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">F5 = load · F3 = search · Enter / double-click = loan details · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <LoanDetailsDrawer full={details} onClose={() => setDetails(null)} />
    </div>
  );
}
