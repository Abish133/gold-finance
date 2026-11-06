import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input, Select } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, weight } from '@/lib/format';
import { ExitButton, Line, useKeys } from '@/features/loans/desk';

const cols = [
  { key: 'bill_no', label: 'Loan', render: (r) => <b>{r.bill_no}</b> }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'auction_date', label: 'Auctioned', type: 'date' },
  { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' }, { key: 'loan_on', label: 'Metal' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'principal_due', label: 'Loan Amt', type: 'money' },
  { key: 'interest_due', label: 'Interest', type: 'money' }, { key: 'total_due', label: 'Total Due', type: 'money' }, { key: 'sale_amount', label: 'Sale', type: 'money' }, { key: 'surplus', label: 'Profit / Loss', type: 'money' },
];

/** Auction Report (desktop: frmAuctionReport) - auctioned loans with dues, sale amount and profit / loss. */
export default function AuctionReportPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const fyStart = (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
  const { data: years = [] } = useFetch('/admin/financial-years');
  const [f, setF] = useState({ from: fyStart, to: dayjs().format('YYYY-MM-DD'), search: '', metal: '', sale: '' });
  const [q, setQ] = useState(f);
  const { data: all = [], refetch, isFetching } = useFetch('/auction/sales');
  const [sel, setSel] = useState(null);
  const rows = useMemo(() => all.filter((r) => String(r.auction_date).slice(0, 10) >= q.from && String(r.auction_date).slice(0, 10) <= q.to && (!q.search || `${r.bill_no} ${r.customer_name}`.toLowerCase().includes(q.search.toLowerCase())))
    .filter((r) => (!q.metal || r.loan_on === q.metal) && (!q.sale || (q.sale === 'sold' ? n(r.sale_amount) > 0 : !n(r.sale_amount))))
    .map((r) => ({ ...r, total_due: n(r.principal_due) + n(r.interest_due) + n(r.charges) })), [all, q]);
  const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
  const preview = () => printTable({ title: `Auction Report ${date(q.from)} - ${date(q.to)}`, company, columns: cols, rows, totals: { net_wt: sum('net_wt'), principal_due: sum('principal_due'), interest_due: sum('interest_due'), total_due: sum('total_due'), sale_amount: sum('sale_amount'), surplus: sum('surplus') } });
  useKeys({ f5: () => setQ(f), f6: () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('auction-report', cols, rows), escape: () => navigate('/') }, [f, rows]);
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Auction Report</h1><p className="text-sm text-navy-100">Auctioned loans with dues, sale amount and profit / loss</p></section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Auction date (A/c year)" className="w-44"><Select value={years.find((y) => String(y.start_date).slice(0, 10) === f.from)?.id || ''} onChange={(e) => { const y = years.find((x) => String(x.id) === e.target.value); if (y) { const nf = { ...f, from: String(y.start_date).slice(0, 10), to: String(y.end_date).slice(0, 10) }; setF(nf); setQ(nf); } }} options={[{ value: '', label: 'Custom dates' }, ...years.map((y) => ({ value: y.id, label: y.name }))]} /></Field>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        {[['metal', 'Metal', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']]], ['sale', 'Sale', [['', 'All'], ['sold', 'Sold'], ['not', 'Not sold']]]].map(([k, l, opts]) => (
          <div key={k}><p className="label">{l}</p><div className="flex gap-1">{opts.map(([v, t]) => <button key={v} type="button" onClick={() => { const nf = { ...f, [k]: v }; setF(nf); setQ(nf); }} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{t}</button>)}</div></div>
        ))}
        <Field label="Search"><Input className="w-64" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} /></Field>
        <Button className="ml-auto" onClick={() => setQ(f)}>Show (F5)</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Loans auctioned</p><p className="num text-2xl font-bold">{rows.length}</p></div>
        {[['Gold', `${weight(rows.filter((r) => r.loan_on !== 'SILVER').reduce((t, r) => t + n(r.net_wt), 0))} g`, 'border-t-gold-500'], ['Silver', `${weight(rows.filter((r) => r.loan_on === 'SILVER').reduce((t, r) => t + n(r.net_wt), 0))} g`, 'border-t-ink-400'], ['Total due', amount(sum('total_due')), 'border-t-rose-600'], ['Sale amount', amount(sum('sale_amount')), 'border-t-navy-700'], ['Profit / loss', amount(sum('surplus')), 'border-t-emerald-600']].map(([l, v, c]) => (
          <div key={l} className={clsx('card border-t-4 px-4 py-3', c)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-xl font-bold text-navy-900">{v}</p></div>
        ))}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_300px]">
        <DataTable dense rows={rows} columns={cols} loading={isFetching && !all.length} onRowClick={setSel} rowClassName={(r) => (sel?.id === r.id ? 'bg-cream-200' : '')} />
        <div className="card space-y-1 p-4 text-sm">
          <p className="text-xs font-bold text-gold-700 uppercase">Select a loan</p>
          <Line label="Pledged" value={sel ? date(sel.loan_date) : '-'} /><Line label="Auctioned" value={sel ? date(sel.auction_date) : '-'} />
          <Line label="ROI / Months" value={sel ? `${n(sel.interest_rate)}% · ${sel.months} m` : '-'} />
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Notices</p>
          <Line label="First notice" value={sel?.first_notice ? date(sel.first_notice) : '-'} /><Line label="Registered notice" value={sel?.registered_notice ? date(sel.registered_notice) : '-'} />
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Due at auction</p>
          <Line label="Loan amount" value={sel ? amount(sel.principal_due) : '-'} /><Line label="Interest" value={sel ? amount(sel.interest_due) : '-'} /><Line label="Charges / notices" value={sel ? amount(sel.charges) : '-'} />
          <Line bold label="Total due" value={sel ? amount(sel.total_due) : '-'} />
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Sale</p>
          <Line label="Sold to" value={sel?.buyer_name || '-'} /><Line label="Sale amount" value={sel ? amount(sel.sale_amount) : '-'} />
          <Line bold label="Profit / loss" value={sel ? amount(sel.surplus) : '-'} tone={sel && n(sel.surplus) < 0 ? 'text-rose-600' : 'text-emerald-700'} />
          <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Entry</p><Line label="Marked by" value={sel?.marked_by || '-'} /><Line label="Sale approved by" value={sel?.approved_by || '-'} />
        </div>
      </div>
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auction-report', cols, rows)}>Excel (Ctrl+E)</Button>
        <ExitButton />
      </div>
    </div>
  );
}
