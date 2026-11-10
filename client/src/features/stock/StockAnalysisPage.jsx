import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderOpen, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut, FileText } from 'lucide-react';
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

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
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
  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div>;
  const tile = (label, v, h, cls, k) => (
    <button type="button" disabled={k === undefined} onClick={() => k !== undefined && setResult(result === k ? '' : k)} className={clsx('card border-t-4 px-4 py-3 text-left', cls, k !== undefined && result === k && 'ring-2 ring-navy-500')}>
      <p className="text-xs font-bold text-ink-600 uppercase">{label}</p><p className="num text-2xl font-bold text-navy-900 dark:text-white">{v}</p><p className="text-[11px] text-ink-500">{h}</p>
    </button>
  );

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Stock Analysis</h1><p className="text-sm text-navy-100">Open loans - amount due against the market value of pledged items</p></div>
        {[['As on', date(q?.as_on || f.as_on)], ['Gold rate', data?.rates.gold ? `Rs. ${amount(data.rates.gold)}` : '-', true], ['Silver rate', data?.rates.silver ? `Rs. ${amount(data.rates.silver)}` : '-']].map(([k, v, g]) => (
          <div key={k} className={clsx('min-w-32 rounded-md px-4 py-1.5 text-center', g ? 'bg-white text-ink-900' : 'bg-white/10')}><p className="text-[11px] font-bold uppercase">{k}</p><p className="font-bold">{v}</p></div>
        ))}
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Pledged from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="As on"><Input type="date" value={f.as_on} max={today()} onChange={(e) => setF({ ...f, as_on: e.target.value })} /></Field>
        <div><p className="label">Age</p>{seg('age', [[0, 'All'], [6, '6 m +'], [12, '12 m +']])}</div>
        <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'In bank']])}</div>
        <Button className="ml-auto" size="lg" variant="outline" icon={FolderOpen} loading={isFetching} onClick={load}>Load (F5)</Button>
        <div className="flex w-full flex-wrap items-center gap-3">
          <Input id="sa-search" className="max-w-md" placeholder="Search (F3) · loan / customer" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <span className="label mb-0">Result</span>
          <div className="flex gap-1">{[['', 'All'], ['PROFIT', 'Profit'], ['RISK', 'At risk'], ['LOSS', 'Loss']].map(([k, l]) => <button key={k} type="button" onClick={() => setResult(k)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', result === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div>
          <span className="ml-auto text-xs text-ink-500">{q ? `Rows shown: ${rows.length}` : 'Select the dates and press Load (F5)'}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {tile('Open loans', s?.open ?? 0, `Gold ${weight(s?.goldWt)} g · Silver ${weight(s?.silverWt)} g`, 'border-t-navy-800 bg-cream-100')}
        {tile('Principal due', `Rs. ${amount(s?.principal || 0)}`, `Loan given Rs. ${amount(s?.given || 0)}`, 'border-t-blue-600')}
        {tile('Interest due', `Rs. ${amount(s?.interest || 0)}`, `Up to ${date(q?.as_on || f.as_on)}`, 'border-t-violet-600')}
        {tile('Market value', `Rs. ${amount(s?.market || 0)}`, `Total due Rs. ${amount(s?.totalDue || 0)}`, 'border-t-lime-700')}
        {tile('Profit loans', s?.profit ?? 0, `Rs. ${amount(s?.profitAmt || 0)} margin`, 'border-t-emerald-700', 'PROFIT')}
        {tile(`At risk (margin < ${data?.margin ?? 10}%)`, s?.risk ?? 0, `Rs. ${amount(s?.riskAmt || 0)} margin`, 'border-t-amber-500', 'RISK')}
        {tile('Loss loans', s?.loss ?? 0, `Rs. ${amount(Math.abs(s?.lossAmt || 0))} short`, 'border-t-rose-600', 'LOSS')}
      </div>
      <div className="card overflow-auto">
        <table className="w-full min-w-[1700px] text-sm">
          <thead className="navy-gradient sticky top-0 text-white"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-2 whitespace-nowrap', ['money', 'weight', 'number'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {!rows.length && <tr><td colSpan={cols.length} className="py-16 text-center text-ink-400">{q ? 'No open loans' : 'Select the dates and press Load (F5)'}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => open(r)} className={clsx('cursor-pointer', sel?.id === r.id && 'bg-navy-50 dark:bg-ink-800')}>
                <td className="px-2 py-1.5">{r.sno}</td><td className="px-2"><span className={clsx('rounded px-2 py-0.5 text-xs font-bold', RESULT[r.result][1])}>{RESULT[r.result][0]}</span></td>
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
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={FileText} disabled={!sel} onClick={() => open(sel)}>Loan Details (Enter)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (Ctrl+R)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('stock-analysis', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 = load · F3 = search · Enter / double-click = loan details · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <LoanDetailsDrawer full={details} onClose={() => setDetails(null)} />
    </div>
  );
}
