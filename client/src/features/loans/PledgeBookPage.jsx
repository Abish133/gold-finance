import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Eye, FileDown, FileSpreadsheet, Image, ScrollText } from 'lucide-react';
import clsx from 'clsx';
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

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { today: () => [today(), today()], month: () => [dayjs().startOf('month').format('YYYY-MM-DD'), today()], year: () => [fyStart(), today()], all: () => ['', ''] };
const TILES = [['', 'Total loans', 'border-t-navy-700 bg-cream-100'], ['PENDING', 'Pending', 'border-t-navy-500'], ['RELEASED', 'Released', 'border-t-rose-600'],
  ['IN_BANK', 'In bank', 'border-t-violet-600'], ['AUCTIONED', 'Auctioned', 'border-t-emerald-700'], ['CANCELLED', 'Cancelled', 'border-t-fuchsia-600']];
const STATUS_PARAM = { PENDING: { status: 'OPEN', bank: '0' }, RELEASED: { status: 'CLOSED,RENEWED' }, IN_BANK: { status: 'OPEN', bank: '1' }, AUCTIONED: { status: 'AUCTIONED' }, CANCELLED: { status: 'CANCELLED' } };

const columns = [
  { key: 'sno', label: 'S.No', render: (r) => r.__i, print: (r, i) => i + 1 },
  { key: 'bill_no', label: 'Loan No', sortable: true, render: (r) => <b>{r.bill_no}</b> },
  { key: 'manual_bill_no', label: 'Bill Book No', render: (r) => r.manual_bill_no || '-' },
  { key: 'loan_date', label: 'Loan Date', type: 'date', sortable: true },
  { key: 'customer_name', label: 'Customer', sortable: true, render: (r) => <div><p className="font-semibold">{r.customer_name}</p><p className="text-[11px] text-ink-500">{[r.relation_name && `${r.relation_type || ''} ${r.relation_name}`, r.customer_phone].filter(Boolean).join(' · ')}</p></div> },
  { key: 'loan_on', label: 'Metal', render: (r) => <span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{r.loan_on || r.metal_name}</span>, print: (r) => r.loan_on || r.metal_name },
  { key: 'item_summary', label: 'Pledged Items', className: 'max-w-56 truncate' },
  { key: 'gross_wt', label: 'Gross Wt', type: 'weight' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight', sortable: true },
  { key: 'principal', label: 'Loan Amount', type: 'money', sortable: true },
  { key: 'interest_rate', label: 'ROI %', type: 'number' },
  { key: 'advance_interest', label: 'Adv. Int.', type: 'money' },
  { key: 'market_value', label: 'Item Value', type: 'money' },
  { key: 'due_date', label: 'Settle Before', type: 'date', sortable: true },
  { key: 'status', label: 'Status', type: 'status' },
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
  const [page, setPage] = useState({ page: 1, pageSize: 50, sort: 'loan_date', order: 'desc' });
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

  const seg = (val, cur, set, label) => <button type="button" onClick={() => set(val)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', cur === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{label}</button>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Pledge Book</h1><p className="text-sm text-navy-100">Complete register of loans - pending, released, in bank, auctioned and cancelled</p></div>
        <div className="rounded-md bg-white px-5 py-1.5 text-center text-ink-900"><p className="text-xs font-bold">LOANS</p><p className="font-bold">{totalCnt}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <div><p className="label">Date on</p><div className="flex gap-1">{seg('loan', dateOn, setDateOn, 'Loan Date')}{seg('release', dateOn, setDateOn, 'Release Date')}</div></div>
        <Field label="Pledged from"><Input type="date" value={from} onChange={(e) => setRange([e.target.value, to])} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setRange([from, e.target.value])} /></Field>
        <div><p className="label">Quick</p><div className="flex gap-1">{[['today', 'Today'], ['month', 'This Month'], ['year', 'A/c Year'], ['all', 'All Years']].map(([k, l]) => <button key={k} type="button" onClick={() => setRange(QUICK[k]())} className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">{l}</button>)}</div></div>
        <div><p className="label">Metal</p><div className="flex gap-1">{[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => <span key={k}>{seg(k, metal, setMetal, l)}</span>)}</div></div>
        <div><p className="label">Loan amount · from - to</p><div className="flex gap-1"><Input type="number" className="w-28" value={amt.from} onChange={(e) => setAmt({ ...amt, from: e.target.value })} /><Input type="number" className="w-28" value={amt.to} onChange={(e) => setAmt({ ...amt, to: e.target.value })} /></div></div>
        <Button className="ml-auto" icon={RefreshCw} onClick={() => list.refetch()}>Load (F5)</Button>
        <div id="pb-search" className="w-full"><SearchInput value={search} onChange={setSearch} className="max-w-md" placeholder="Search (F3) · loan / customer / item" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {TILES.map(([k, label, cls]) => {
          const t = k ? tiles[k] : { cnt: totalCnt, amount: totalAmt };
          return (
            <button key={k} type="button" onClick={() => setTile(k)} className={clsx('card border-t-4 px-4 py-3 text-left transition hover:shadow-md', cls, tile === k && 'ring-2 ring-navy-500')}>
              <p className="text-xs font-bold text-ink-700 uppercase">{label}</p><p className="num text-2xl font-bold text-navy-900">{t?.cnt || 0}</p><p className="num text-xs text-ink-500">Rs. {amount(t?.amount || 0)}</p>
            </button>
          );
        })}
      </div>
      <DataTable dense columns={cols} rows={rows} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
        sort={page.sort} order={page.order} onSort={(sort, order) => setPage({ ...page, sort, order })} onPage={(p) => setPage({ ...page, page: p })} onPageSize={(s) => setPage({ ...page, pageSize: s, page: 1 })}
        onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)}
        totals={rows.length ? { gross_wt: rows.reduce((s, r) => s + n(r.gross_wt), 0), net_wt: rows.reduce((s, r) => s + n(r.net_wt), 0), principal: rows.reduce((s, r) => s + n(r.principal), 0), market_value: rows.reduce((s, r) => s + n(r.market_value), 0) } : undefined} />
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={RefreshCw} onClick={() => list.refetch()}>Refresh (Ctrl+R)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={Image} onClick={photos}>Photo Report</Button>
        <Button variant="outline" icon={ScrollText} onClick={formD}>Form D (TN)</Button>
        <ExitButton />
      </div>
      <p className="px-1 text-xs text-ink-500">F5 = load · F3 = search · Enter / double-click = loan details · Ctrl+R = refresh · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
    </div>
  );
}
