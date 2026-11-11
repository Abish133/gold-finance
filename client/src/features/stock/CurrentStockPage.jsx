import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';
import { Button, Checkbox, DataTable, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today, weight } from '@/lib/format';
import { ExitButton, Line, useKeys } from '@/features/loans/desk';

const cols = [
  { key: 'bill_no', label: 'Loan', render: (r) => <b>{r.bill_no}</b> }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'age_months', label: 'Age', render: (r) => `${r.age_months} m`, print: (r) => `${r.age_months} m` },
  { key: 'customer_name', label: 'Customer' }, { key: 'items_text', label: 'Items', className: 'max-w-48 truncate uppercase', render: (r) => r.items_text || r.item_summary, print: (r) => (r.items_text || r.item_summary || '').toUpperCase() }, { key: 'loan_on', label: 'Metal' },
  { key: 'gross_wt', label: 'Gross', type: 'weight' }, { key: 'stone_wt', label: 'Less', type: 'weight' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' },
  { key: 'principal', label: 'Amount', type: 'money' }, { key: 'part_paid', label: 'Part Paid', render: (r) => (n(r.part_paid) ? amount(r.part_paid) : ''), print: (r) => (n(r.part_paid) ? r.part_paid : '') }, { key: 'where', label: 'Where', render: (r) => (r.where === 'Bank' ? 'In bank' : 'In hand'), print: (r) => (r.where === 'Bank' ? 'In bank' : 'In hand') },
  { key: 'value_now', label: 'Value Now', type: 'money' },
  { key: 'margin_pct', label: 'Margin', render: (r) => (r.margin_pct == null ? '-' : <span className={clsx('rounded px-1.5 py-0.5 text-xs font-bold', r.at_risk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{n(r.margin_pct).toFixed(1)}%{r.at_risk ? ' · at risk' : ''}</span>), print: (r) => (r.margin_pct == null ? '' : `${n(r.margin_pct).toFixed(1)}%${r.at_risk ? ' RISK' : ''}`) },
];

/** Current Stock Report (desktop: frmcompleteStock) - pledged items still with us (in hand and at bank). */
export default function CurrentStockPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [f, setF] = useState({ asOn: today(), loan_on: '', where: '', older: 0, amount_from: '', amount_to: '', search: '' });
  const [q, setQ] = useState(f);
  const [metalTotals, setMetalTotals] = useState(false);
  const [riskOnly, setRiskOnly] = useState(false);
  const { data: all = [], isFetching, refetch } = useFetch('/desk/stock', q);
  const atRisk = all.filter((r) => r.at_risk);
  const rows = riskOnly ? atRisk : all;
  const s = useMemo(() => {
    const by = (m) => rows.filter((r) => r.loan_on === m);
    const age = [[0, 3], [3, 6], [6, 12], [12, 9999]].map(([a, b]) => { const x = rows.filter((r) => r.age_months >= a && r.age_months < b); return { cnt: x.length, amt: x.reduce((t, r) => t + n(r.principal), 0) }; });
    const sum = (list, k) => list.reduce((t, r) => t + n(r[k]), 0);
    return { gold: by('GOLD'), silver: by('SILVER'), mix: by('MIX'), age, hand: rows.filter((r) => r.where === 'Hand'), bank: rows.filter((r) => r.where === 'Bank'),
      total: sum(rows, 'principal'), part: sum(rows, 'part_paid'), out: sum(rows, 'current_principal'), sum };
  }, [rows]);
  const preview = () => printTable({ title: `Current Stock as on ${date(q.asOn)}`, company, columns: cols, rows, totals: { gross_wt: s.sum(rows, 'gross_wt'), net_wt: s.sum(rows, 'net_wt'), principal: s.total, part_paid: s.part } });
  useKeys({ f5: () => setQ(f), f6: () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('current-stock', cols, rows), escape: () => navigate('/') }, [f, rows]);
  const seg = (k, opts) => <div className="flex">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{f[k] === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div>;
  const cell = (label, value, hint, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{value}</p><p className="truncate text-[10px] text-ink-500">{hint}</p>
    </div>
  );
  const tile = (label, list, bar) => cell(label, amount(s.sum(list, 'principal')), `${list.length} loan${list.length === 1 ? '' : 's'} · ${weight(s.sum(list, 'net_wt'))} g`, bar);

  return (
    /* fit-screen: the page fits the window; the stock list and the summary scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Current Stock Report</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Pledged items still with us (in hand and at bank)</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">As on</span><span className="num text-[13px] font-bold">{date(q.asOn)}</span></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Stock as on"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.asOn} onChange={(e) => setF({ ...f, asOn: e.target.value })} /></Field>
        <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'At bank']])}</div>
        <div><p className="label">Older than</p>{seg('older', [[0, 'Any'], [6, '6 m'], [9, '9 m'], [12, '12 m']])}</div>
        <div><p className="label">Amount from - to</p><div className="flex gap-1"><Input type="number" className="!h-8 w-24 text-[13px]" value={f.amount_from} onChange={(e) => setF({ ...f, amount_from: e.target.value })} /><Input type="number" className="!h-8 w-24 text-[13px]" value={f.amount_to} onChange={(e) => setF({ ...f, amount_to: e.target.value })} /></div></div>
        <div className="min-w-48 flex-1"><p className="label">Search</p><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Loan / customer" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} /></div>
        <Button className="h-8" icon={Search} onClick={() => setQ(f)}>Show (F5)</Button>
        <div className="flex w-full flex-wrap items-center gap-4 text-[13px]">
          <Checkbox checked={metalTotals} onChange={setMetalTotals} label="Metal-wise totals" />
          <Checkbox checked={riskOnly} onChange={setRiskOnly} label={`At risk only (${atRisk.length})`} />
          <span className="ml-auto text-[11px] text-ink-500">Rows shown: {rows.length}</span>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-3 xl:grid-cols-6 dark:border-ink-800 dark:bg-ink-900">
        <div className="navy-gradient min-w-0 px-3 py-1.5 text-white"><p className="text-[10px] font-bold tracking-wider uppercase opacity-70">Loans in stock</p><p className="num text-[15px] leading-tight font-bold">{rows.length}</p><p className="truncate text-[10px] opacity-70">{s.hand.length} in hand · {s.bank.length} at bank</p></div>
        {tile('Gold', s.gold, 'bg-amber-500')}{tile('Silver', s.silver, 'bg-ink-400')}{tile('Mix', s.mix, 'bg-violet-600')}
        {cell('Total loan amount', amount(s.total), `at bank ${amount(s.sum(s.bank, 'principal'))}`, 'bg-blue-600')}
        {cell('Outstanding', amount(s.out), `part paid ${amount(s.part)}`, 'bg-emerald-600')}
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <DataTable fill rows={rows} columns={cols} loading={isFetching && !rows.length} onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)} />
          {metalTotals && (
            <div className="grid shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-3 dark:border-ink-800 dark:bg-ink-900">
              {[['Gold', s.gold, 'bg-amber-500'], ['Silver', s.silver, 'bg-ink-400'], ['Mix', s.mix, 'bg-violet-600']].map(([l, list, bar]) => (
                <div key={l} className="border-ink-200 px-3 py-1.5 not-last:border-r dark:border-ink-800">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase"><span className={clsx('h-3 w-0.5 rounded-sm', bar)} />{l}</p>
                  <p className="num text-[12px]">{list.length} loans · gross {weight(s.sum(list, 'gross_wt'))} · net {weight(s.sum(list, 'net_wt'))} · <b>₹{amount(s.sum(list, 'principal'))}</b></p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Stock by age · {date(q.asOn)}</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[12px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700">{['Up to 3 months', '3 - 6 months', '6 - 12 months', 'Over 12 months'].map((l, i) => <Line key={l} label={l} value={`${s.age[i].cnt} · ${amount(s.age[i].amt)}`} tone={i === 3 ? 'text-rose-600' : ''} />)}</div>
          <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Weight (net)</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[12px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700"><Line label="Gold" value={`${weight(s.sum(s.gold, 'net_wt'))} g`} /><Line label="Silver" value={`${weight(s.sum(s.silver, 'net_wt'))} g`} /><Line label="Mix" value={`${weight(s.sum(s.mix, 'net_wt'))} g`} /></div>
          <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Where</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[12px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700">
            <Line label="In hand" value={`${s.hand.length} · ${amount(s.sum(s.hand, 'principal'))}`} /><Line label="At bank" value={`${s.bank.length} · ${amount(s.sum(s.bank, 'principal'))}`} />
            <Line bold label="Total" value={amount(s.total)} /><Line minus label="Part paid" value={amount(s.part)} />
          </div>
          <div className="navy-gradient mt-auto flex items-baseline justify-between rounded-md px-3 py-2 text-white"><span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Outstanding</span><span className="num text-lg font-extrabold">{amount(s.out)}</span></div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('current-stock', cols, rows)}>Excel (Ctrl+E)</Button>
        <ExitButton />
      </div>
    </div>
  );
}
