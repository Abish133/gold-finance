import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Eye, FileDown, FileSpreadsheet, Calculator } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input, Tabs, DataTable } from '@/components/ui';
import { useFetch, useCompany, useSettings } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today } from '@/lib/format';
import { ExitButton, Line, useKeys } from './desk';
import QuoteCalculator from './InterestCalculatorPage';

const cols = [
  { key: 'bill_no', label: 'Loan', render: (r) => <b>{r.bill_no}</b> }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'customer_name', label: 'Customer' },
  { key: 'loan_on', label: 'Metal' }, { key: 'principal', label: 'Loan Amt', type: 'money' }, { key: 'interest_rate', label: 'ROI %', type: 'number' },
  { key: 'interest_type', label: 'Type', render: (r) => (r.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'), print: (r) => (r.interest_type === 'COMPOUND' ? 'Compound' : 'Flat') }, { key: 'months', label: 'Months', type: 'number' },
  { key: 'part_paid', label: 'Part Paid', render: (r) => (n(r.part_paid) ? amount(r.part_paid) : ''), print: (r) => (n(r.part_paid) ? r.part_paid : '') }, { key: 'interest_due', label: 'Interest Due', type: 'money' }, { key: 'total_due', label: 'Total Due', type: 'money' },
];

/** Interest Calculation (desktop: frmInterestCalculation) - interest due on open loans up to a date. */
export default function InterestDuePage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [tab, setTab] = useState('due');
  const { data: settings } = useSettings();
  const overdueMonths = n(settings?.AUCTION_OVERDUE_MONTHS) || 12;
  const [f, setF] = useState({ from: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), to: today(), upto: today(), loan_on: '', where: '', older: 0, search: '' });
  const [q, setQ] = useState(f);
  const { data, isFetching, refetch } = useFetch(tab === 'due' ? '/desk/interest-due' : null, q);
  const [sel, setSel] = useState(null);
  const rows = data?.rows || [];
  const s = data?.summary;
  const preview = () => printTable({ title: `Interest due up to ${date(q.upto)}`, company, columns: cols, rows, totals: { loan_due: s?.loanDue, interest_due: s?.interestDue, total_due: s?.totalDue, part_paid: s?.partPaid } });
  useKeys({ f5: () => setQ(f), 'ctrl+r': () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('interest-due', cols, rows), escape: () => navigate('/') }, [f, rows]);
  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('h-9 rounded-md border px-2.5 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{l}</button>)}</div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Interest Calculation</h1><p className="text-sm text-navy-100">Interest due on open loans up to a date</p></section>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'due', label: 'Open loans interest due' }, { value: 'quote', label: 'Quote a customer', icon: Calculator }]} />
      {tab === 'quote' ? <QuoteCalculator embedded /> : (
        <>
          <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
            <Field label="Pledged from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            <Field label="Interest up to"><Input type="date" value={f.upto} onChange={(e) => setF({ ...f, upto: e.target.value })} /></Field>
            <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
            <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'At bank']])}</div>
            <div><p className="label">Older than</p>{seg('older', [[0, 'Any'], [6, '6 m'], [9, '9 m'], [12, '12 m']])}</div>
            <Button className="ml-auto" loading={isFetching} onClick={() => setQ(f)}>Calculate (F5)</Button>
            <div className="w-full"><Input className="max-w-sm" placeholder="Search (F3) · loan / customer" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Open loans</p><p className="num text-2xl font-bold">{s?.open || 0}</p><p className="text-[11px]">{s?.over12 || 0} over 12 months</p></div>
            {[['Loan amount due', s?.loanDue, `part paid ${amount(s?.partPaid || 0)}`, 'border-t-navy-500'], ['Interest due', s?.interestDue, `up to ${date(q.upto)}`, 'border-t-gold-500'], ['Total due', s?.totalDue, 'loan amount + interest', 'border-t-navy-700'], ['Average age', `${n(s?.avgAge || 0).toFixed(1)} m`, 'by loan amount', 'border-t-ink-400']].map(([l, v, h, c]) => (
              <div key={l} className={clsx('card border-t-4 px-4 py-3', c)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{typeof v === 'number' ? amount(v) : v ?? 0}</p><p className="text-[11px] text-ink-500">{h}</p></div>
            ))}
          </div>
          <div className="grid items-start gap-3 xl:grid-cols-[1fr_300px]">
            <DataTable dense rows={rows} columns={cols} loading={isFetching && !data} onRowClick={setSel} rowClassName={(r) => (sel?.id === r.id ? 'bg-cream-200' : r.months > overdueMonths ? 'bg-rose-50/60' : '')} />
            <div className="card space-y-1 p-4 text-sm">
              <p className="text-xs font-bold text-gold-700 uppercase">{sel ? `Loan ${sel.bill_no} - ${sel.customer_name}` : 'Select a loan'}</p>
              <Line label="Pledged" value={sel ? date(sel.loan_date) : '-'} />
              <Line label="Items" value={sel ? (sel.items_text || '').toUpperCase() || `${sel.total_items} · ${n(sel.net_wt).toFixed(3)} g` : '-'} />
              <Line label="ROI / type" value={sel ? `${n(sel.interest_rate).toFixed(2)} %${sel.rate_type === 'MONTHLY' ? '' : ' p.a.'} · ${sel.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'}` : '-'} />
              <Line label="Months (T / P / D)" value={sel ? `${sel.months} / ${sel.months_paid} / ${Math.max(0, sel.months_due - sel.months_paid)}` : '-'} />
              <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Loan amount</p>
              <Line label="Loan amount" value={sel ? amount(sel.principal) : '-'} />
              <Line minus label="Part paid" value={sel ? amount(sel.part_paid) : '-'} />
              <Line label="Loan amount due" value={sel ? amount(sel.loan_due) : '-'} bold />
              <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Interest</p>
              <Line label="Total interest" value={sel ? amount(sel.total_interest) : '-'} />
              <Line minus label="Advance interest" value={sel ? amount(sel.advance) : '-'} />
              <Line minus label="Paid earlier" value={sel ? amount(sel.paid_earlier) : '-'} />
              <Line label="Interest due" value={sel ? amount(sel.interest_due) : '-'} bold />
              <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-base font-bold"><span>Total due</span><span className="num">{sel ? amount(sel.total_due) : '-'}</span></div>
              {sel && <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => navigate(`/loans/part-payment?loan=${sel.id}`)}>Receive interest</Button>}
            </div>
          </div>
          <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
            <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (Ctrl+R)</Button>
            <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
            <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('interest-due', cols, rows)}>Excel (Ctrl+E)</Button>
            <ExitButton />
          </div>
        </>
      )}
    </div>
  );
}
