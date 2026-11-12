import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Eye, FileDown, FileSpreadsheet, Image, ScrollText } from 'lucide-react';
import clsx from 'clsx';
import { bookStatus } from '@/lib/loanStatus';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input, SearchInput } from '@/components/ui';
import { useList, useCompany } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { printElement } from '@/lib/print';
import { PhotoReport, FormD } from '@/features/print/LoanEstimate';
import { amount, n, today } from '@/lib/format';
import { ExitButton, useKeys } from './desk';
import { PageActions } from '@/components/common/PageActions';

const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { today: () => [today(), today()], month: () => [dayjs(today()).startOf('month').format('YYYY-MM-DD'), today()], year: () => [fyStart(), today()], all: () => ['', ''] };
const TILES = [['', 'Total loans', 'bg-navy-900 dark:bg-white'], ['PENDING', 'Pending', 'bg-blue-600'], ['RELEASED', 'Released', 'bg-rose-600'],
  ['IN_BANK', 'In bank', 'bg-violet-600'], ['AUCTIONED', 'Auctioned', 'bg-emerald-600'], ['CANCELLED', 'Cancelled', 'bg-fuchsia-600']];
const STATUS_PARAM = { PENDING: { status: 'OPEN', bank: '0' }, RELEASED: { status: 'CLOSED,RENEWED' }, IN_BANK: { status: 'OPEN', bank: '1' }, AUCTIONED: { status: 'AUCTIONED' }, CANCELLED: { status: 'CANCELLED' } };

const STATUS_TONE = { Pending: 'bg-navy-700 text-white', Released: 'bg-rose-700 text-white', 'In Bank': 'bg-violet-700 text-white', Auctioned: 'bg-amber-600 text-white', Cancelled: 'bg-ink-500 text-white' };

const columns = [
  { key: 'sno', label: 'S.No', render: (r) => r.__i, print: (r, i) => i + 1 },
  { key: 'bill_no', label: 'Loan No', sortable: true, render: (r) => <b>{r.bill_no}</b> },
  { key: 'manual_bill_no', label: 'Bill Book No', render: (r) => r.manual_bill_no || '-' },
  { key: 'loan_date', label: 'Loan Date', type: 'date', sortable: true },
  { key: 'customer_name', label: 'Customer', sortable: true, render: (r) => <div><p className="font-semibold">{r.customer_name}</p><p className="text-[11px] text-ink-500">{[r.relation_name && `${r.relation_type || ''} ${r.relation_name}`, r.customer_phone].filter(Boolean).join(' · ')}</p></div> },
  { key: 'loan_on', label: 'Metal', render: (r) => <span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{r.loan_on || r.metal_name}</span>, print: (r) => r.loan_on || r.metal_name },
  { key: 'items_text', label: 'Pledged Items', className: 'max-w-56 truncate uppercase', render: (r) => r.items_text || r.item_summary, print: (r) => (r.items_text || r.item_summary || '').toUpperCase() },
  { key: 'gross_wt', label: 'Gross Wt', type: 'weight' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight', sortable: true },
  { key: 'loan_amount', label: 'Loan Amount', type: 'money', sortable: true },
  { key: 'interest_rate', label: 'ROI %', type: 'number' },
  { key: 'advance_interest', label: 'Adv. Int.', type: 'money' },
  { key: 'market_value', label: 'Item Value', type: 'money' },
  { key: 'due_date', label: 'Settle Before', type: 'date', sortable: true },
  { key: 'status', label: 'Status', render: (r) => <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', STATUS_TONE[bookStatus(r)])}>{bookStatus(r)}</span>, print: (r) => bookStatus(r) },
  { key: 'release_no', label: 'Release No', type: 'number' },
  { key: 'close_date', label: 'Release Date', type: 'date' },
];

/** Pledge Book (desktop: frmPledgeBook) - complete loan register. */
export default function PledgeBookPage() {
  const navigate = useNavigate();
  const { isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const [dateOn, setDateOn] = useState('loan');
  const [[from, to], setRange] = useState(QUICK.year());
  const [metal, setMetal] = useState('');
  const [amt, setAmt] = useState({ from: '', to: '' });
  const [tile, setTile] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState({ page: 1, pageSize: 50, sort: 'loan_date', order: 'asc' });
  const ds = useDebounce(search);
  const params = { ...page, date_on: dateOn, from, to, loan_on: metal, amount_from: amt.from, amount_to: amt.to, search: ds, ...(STATUS_PARAM[tile] || {}) };
  const list = useList('/loans', params);
  const rows = (list.data?.data || []).map((r, i) => ({ ...r, __i: (page.page - 1) * page.pageSize + i + 1 }));
  const tiles = list.data?.tiles || {};
  const totalCnt = Object.values(tiles).reduce((s, t) => s + t.cnt, 0);
  const totalAmt = Object.values(tiles).reduce((s, t) => s + n(t.amount), 0);
  const cols = isAllBranches ? [...columns, { key: 'branch_name', label: 'Branch' }] : columns;
  const all = async () => (await api.get('/loans', { ...params, page: 1, pageSize: 200 })).data;
  const title = `Pledge Book · ${from ? `${dayjs(from).format('DD/MM/YYYY')} to ${dayjs(to).format('DD/MM/YYYY')}` : 'All years'}`;
  const preview = async () => printTable({ title, company, columns: cols, rows: await all() });
  const photos = async () => printElement(<PhotoReport company={company} loans={await all()} />, { title: 'Photo report' });
  const formD = async () => printElement(<FormD company={company} loans={await all()} from={from} to={to} />, { title: 'Form D' });
  const excel = async () => exportCsv('pledge-book', cols.filter((c) => c.key !== 'sno'), await all());
  useKeys({ f5: () => list.refetch(), 'ctrl+r': () => list.refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': excel, f3: () => document.querySelector('#pb-search input')?.focus(), escape: () => navigate('/') }, [params]);

  const seg = (val, cur, set, label) => <button key={val} type="button" onClick={() => set(val)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', cur === val ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{cur === val && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{label}</button>;

  return (
    /* fit-screen: the page fits the window; only the register scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Pledge Book</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Complete register of loans - pending, released, in bank, auctioned and cancelled</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Loans</span><span className="num text-[13px] font-bold">{totalCnt}</span></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <div><p className="label">Date on</p><div className="flex">{seg('loan', dateOn, setDateOn, 'Loan Date')}{seg('release', dateOn, setDateOn, 'Release Date')}</div></div>
        <Field label="From"><Input type="date" className="!h-8 w-36 text-[13px]" value={from} onChange={(e) => setRange([e.target.value, to])} /></Field>
        <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={to} onChange={(e) => setRange([from, e.target.value])} /></Field>
        <div><p className="label">Quick</p><div className="flex">{[['today', 'Today'], ['month', 'This Month'], ['year', 'A/c Year'], ['all', 'All Years']].map(([k, l]) => <button key={k} type="button" onClick={() => setRange(QUICK[k]())} className="-ml-px h-8 border border-ink-200 bg-white px-2.5 text-[12px] font-semibold whitespace-nowrap text-ink-600 first:ml-0 first:rounded-l-md last:rounded-r-md hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">{l}</button>)}</div></div>
        <div><p className="label">Metal</p><div className="flex">{[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => seg(k, metal, setMetal, l))}</div></div>
        <div><p className="label">Amount from - to</p><div className="flex gap-1"><Input type="number" className="!h-8 w-24 text-[13px]" value={amt.from} onChange={(e) => setAmt({ ...amt, from: e.target.value })} /><Input type="number" className="!h-8 w-24 text-[13px]" value={amt.to} onChange={(e) => setAmt({ ...amt, to: e.target.value })} /></div></div>
        <div id="pb-search" className="min-w-52 flex-1"><p className="label">Search (F3)</p><SearchInput value={search} onChange={setSearch} className="[&_input]:!h-8 [&_input]:text-[13px]" placeholder="Loan / customer / item" /></div>
        <Button className="h-8" icon={RefreshCw} onClick={() => list.refetch()}>Load (F5)</Button>
      </div>
      <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-md border border-ink-200 bg-white xl:grid-cols-6 dark:border-ink-800 dark:bg-ink-900">
        {TILES.map(([k, label, bar]) => {
          const t = k ? tiles[k] : { cnt: totalCnt, amount: totalAmt };
          return (
            <button key={k} type="button" onClick={() => setTile(k)} className={clsx('relative border-ink-200 px-3 py-1.5 pl-4 text-left transition not-last:border-r dark:border-ink-800', tile === k ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
              <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}{tile === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}</p>
              <p className="flex items-baseline gap-2"><span className="num text-lg leading-tight font-bold text-navy-900 dark:text-white">{t?.cnt || 0}</span><span className="num truncate text-[11px] text-ink-500">₹{amount(t?.amount || 0)}</span></p>
            </button>
          );
        })}
      </div>
      <DataTable fill columns={cols} rows={rows} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
        sort={page.sort} order={page.order} onSort={(sort, order) => setPage({ ...page, sort, order })} onPage={(p) => setPage({ ...page, page: p })} onPageSize={(s) => setPage({ ...page, pageSize: s, page: 1 })}
        onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)}
        totals={rows.length ? { gross_wt: rows.reduce((s, r) => s + n(r.gross_wt), 0), net_wt: rows.reduce((s, r) => s + n(r.net_wt), 0), loan_amount: rows.reduce((s, r) => s + n(r.loan_amount), 0), market_value: rows.reduce((s, r) => s + n(r.market_value), 0) } : undefined} />
      <PageActions keys="F5 = load · F3 = search · click = loan details · Ctrl+R = refresh · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit">
        
        <span className="flex-1 2xl:hidden" />
        <Button variant="outline" icon={RefreshCw} onClick={() => list.refetch()}>Refresh (Ctrl+R)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={Image} onClick={photos}>Photo Report</Button>
        <Button variant="outline" icon={ScrollText} onClick={formD}>Form D (TN)</Button>
        <ExitButton />
      </PageActions>
    </div>
  );
}
