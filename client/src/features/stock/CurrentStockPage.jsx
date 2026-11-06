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
  { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items', className: 'max-w-48 truncate' }, { key: 'loan_on', label: 'Metal' },
  { key: 'gross_wt', label: 'Gross', type: 'weight' }, { key: 'stone_wt', label: 'Less', type: 'weight' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' },
  { key: 'principal', label: 'Amount', type: 'money' }, { key: 'part_paid', label: 'Part Paid', type: 'money' }, { key: 'where', label: 'Where' },
];

/** Current Stock Report (desktop: frmcompleteStock) - pledged items still with us (in hand and at bank). */
export default function CurrentStockPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [f, setF] = useState({ asOn: today(), loan_on: '', where: '', older: 0, amount_from: '', amount_to: '', search: '' });
  const [q, setQ] = useState(f);
  const [metalTotals, setMetalTotals] = useState(false);
  const { data: rows = [], isFetching, refetch } = useFetch('/desk/stock', q);
  const s = useMemo(() => {
    const by = (m) => rows.filter((r) => r.loan_on === m);
    const age = [[0, 3], [3, 6], [6, 12], [12, 9999]].map(([a, b]) => { const x = rows.filter((r) => r.age_months >= a && r.age_months < b); return { cnt: x.length, amt: x.reduce((t, r) => t + n(r.current_principal), 0) }; });
    const sum = (list, k) => list.reduce((t, r) => t + n(r[k]), 0);
    return { gold: by('GOLD'), silver: by('SILVER'), mix: by('MIX'), age, hand: rows.filter((r) => r.where === 'Hand'), bank: rows.filter((r) => r.where === 'Bank'),
      total: sum(rows, 'principal'), part: sum(rows, 'part_paid'), out: sum(rows, 'current_principal'), sum };
  }, [rows]);
  const preview = () => printTable({ title: `Current Stock as on ${date(q.asOn)}`, company, columns: cols, rows, totals: { gross_wt: s.sum(rows, 'gross_wt'), net_wt: s.sum(rows, 'net_wt'), principal: s.total, part_paid: s.part } });
  useKeys({ f5: () => setQ(f), f6: () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('current-stock', cols, rows), escape: () => navigate('/') }, [f, rows]);
  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('h-9 rounded-md border px-2.5 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{l}</button>)}</div>;
  const tile = (label, list, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{label}</p><p className="num text-2xl font-bold text-navy-900">{list.length}</p><p className="text-[11px] text-ink-500">{list.length} loans · {weight(s.sum(list, 'net_wt'))} g</p></div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Current Stock Report</h1><p className="text-sm text-navy-100">Pledged items still with us (in hand and at bank)</p></section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Stock as on"><Input type="date" value={f.asOn} onChange={(e) => setF({ ...f, asOn: e.target.value })} /></Field>
        <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'At bank']])}</div>
        <div><p className="label">Older than</p>{seg('older', [[0, 'Any'], [6, '6 m'], [9, '9 m'], [12, '12 m']])}</div>
        <Field label="Amount from"><Input type="number" className="w-28" value={f.amount_from} onChange={(e) => setF({ ...f, amount_from: e.target.value })} /></Field>
        <Field label="To"><Input type="number" className="w-28" value={f.amount_to} onChange={(e) => setF({ ...f, amount_to: e.target.value })} /></Field>
        <Button className="ml-auto" icon={Search} onClick={() => setQ(f)}>Show (F5)</Button>
        <div className="flex w-full items-center gap-4"><Input className="max-w-sm" placeholder="Search loan / customer" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} />
          <Checkbox checked={metalTotals} onChange={setMetalTotals} label="Metal-wise totals" /><span className="ml-auto text-xs text-ink-500">Rows shown: {rows.length}</span></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Loans in stock</p><p className="num text-2xl font-bold">{rows.length}</p><p className="text-[11px]">{s.hand.length} in hand · {s.bank.length} at bank</p></div>
        {tile('Gold', s.gold, 'border-t-gold-500')}{tile('Silver', s.silver, 'border-t-ink-400')}{tile('Mix', s.mix, 'border-t-violet-600')}
        <div className="card border-t-4 border-t-navy-500 px-4 py-3"><p className="text-xs font-bold text-ink-600 uppercase">Total loan amount</p><p className="num text-xl font-bold text-navy-900">{amount(s.total)}</p><p className="text-[11px] text-ink-500">at bank {amount(s.sum(s.bank, 'current_principal'))}</p></div>
        <div className="card border-t-4 border-t-navy-800 px-4 py-3"><p className="text-xs font-bold text-ink-600 uppercase">Outstanding</p><p className="num text-xl font-bold text-navy-900">{amount(s.out)}</p><p className="text-[11px] text-ink-500">part paid {amount(s.part)}</p></div>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <DataTable dense rows={rows} columns={cols} loading={isFetching && !rows.length} onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)} />
          {metalTotals && (
            <div className="card grid gap-3 p-4 sm:grid-cols-3">
              {[['Gold', s.gold], ['Silver', s.silver], ['Mix', s.mix]].map(([l, list]) => <div key={l}><p className="font-bold">{l}</p><Line label="Loans" value={list.length} /><Line label="Gross" value={weight(s.sum(list, 'gross_wt'))} /><Line label="Net" value={weight(s.sum(list, 'net_wt'))} /><Line label="Amount" value={amount(s.sum(list, 'principal'))} /></div>)}
            </div>
          )}
        </div>
        <div className="card space-y-1 p-4 text-sm">
          <p className="text-xs font-bold text-gold-700 uppercase">Stock by age (as on {date(q.asOn)})</p>
          {['Up to 3 months', '3 - 6 months', '6 - 12 months', 'Over 12 months'].map((l, i) => <Line key={l} label={l} value={`${s.age[i].cnt} · ${amount(s.age[i].amt)}`} tone={i === 3 ? 'text-rose-600' : ''} />)}
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Weight (net)</p>
          <Line label="Gold" value={`${weight(s.sum(s.gold, 'net_wt'))} g`} /><Line label="Silver" value={`${weight(s.sum(s.silver, 'net_wt'))} g`} /><Line label="Mix" value={`${weight(s.sum(s.mix, 'net_wt'))} g`} />
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Where</p>
          <Line label="In hand" value={`${s.hand.length} · ${amount(s.sum(s.hand, 'current_principal'))}`} /><Line label="At bank" value={`${s.bank.length} · ${amount(s.sum(s.bank, 'current_principal'))}`} />
          <Line bold label="Total" value={amount(s.total)} /><Line minus label="Part paid" value={amount(s.part)} /><Line bold label="Outstanding" value={amount(s.out)} />
        </div>
      </div>
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('current-stock', cols, rows)}>Excel (Ctrl+E)</Button>
        <ExitButton />
      </div>
    </div>
  );
}
