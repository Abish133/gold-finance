import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, FileDown, RefreshCw, FileSpreadsheet, BookUser, Search, Eye, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Button, DataTable, Input, Select } from '@/components/ui';
import { useList, useFetch, useCompany } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { date } from '@/lib/format';
import { ExitButton, useKeys, CustomerLedgerDrawer } from '@/features/loans/desk';
import { CustomerFormDrawer } from './CustomerFormDrawer';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { MergeCustomersPanel } from './MergeCustomersPage';
import { PageActions } from '@/components/common/PageActions';
import { RowActions, ActionsHead } from '@/components/common/RowActions';

const address = (r) => [[r.door_no, r.street, r.area, r.city].filter(Boolean).join(', '), r.pincode].filter(Boolean).join(' - ');   // desktop: 5-43, Main Road, Kappiyarai, Nagercoil - 629157

export const customerColumns = [
  { key: 'customer_no', label: 'A/c No', sortable: true, width: 80, render: (r) => <span className="num font-bold text-navy-800">{r.customer_no}</span> },
  { key: 'name', label: 'Customer', sortable: true, render: (r) => (
    <div className="flex items-center gap-3">
      <Avatar src={r.photo} name={r.name} size="sm" />
      <div className="min-w-0"><p className="truncate font-semibold text-navy-900 dark:text-white">{r.title ? `${r.title} ` : ''}{r.name}</p><p className="truncate text-xs text-ink-500">{r.relation_type} {r.relation_name}</p></div>
    </div>
  ) },
  { key: 'address', label: 'Address', render: (r) => <span className="text-xs">{address(r)}</span>, print: (r) => address(r) },
  { key: 'phone', label: 'Phone' },
  { key: 'open_loans', label: 'Open Loans', render: (r) => (Number(r.open_loans) ? r.open_loans : ''), print: (r) => (Number(r.open_loans) ? r.open_loans : '') },
  { key: 'last_loan', label: 'Last Loan', type: 'date' },
  { key: 'status', label: 'Status', type: 'status' },
];

/** Customers (desktop: frmManageCustomer) - search and open the customer ledger. */
export default function CustomersPage() {
  const navigate = useNavigate();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const [params, setParams] = useSearchParams();
  const [state, set] = useTableState({ sort: 'customer_no', order: 'asc', status: '', loans: '', pageSize: 50 });
  const search = useDebounce(state.search);
  const list = useList('/customers', { ...state, search });
  const areas = useFetch('/customers/areas');
  const [editing, setEditing] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [selected, setSelected] = useState(null);
  const viewId = params.get('view');
  useEffect(() => { if (params.get('new') === '1') { setEditing({}); setParams({}); } }, [params, setParams]);
  // merge section sits beside the table for everyone allowed to merge (old /customers/merge lands here too)
  const merging = can('customer_merge', 'edit');
  useEffect(() => { if (params.get('merge') === '1') setParams({}); }, [params, setParams]);
  const tiles = list.data?.tiles || {};
  const columns = isAllBranches ? [...customerColumns, { key: 'branch_name', label: 'Branch' }] : customerColumns;
  const all = async () => (await api.get('/customers', { ...state, search, pageSize: 200, page: 1 })).data;
  const pdf = async () => printTable({ title: 'Customer List', company, columns, rows: await all() });
  const excel = async () => exportCsv('customers', columns.map((c) => ({ ...c, key: c.key })), (await all()).map((r) => ({ ...r, address: address(r) })));
  useKeys({
    'ctrl+n': () => can('customers', 'add') && setEditing({}), f5: () => list.refetch(),
    'ctrl+p': pdf, 'ctrl+e': excel, f3: () => document.querySelector('#cust-search input')?.focus(),
    enter: () => selected && setLedger(selected.id), escape: () => navigate('/'),
  }, [selected, state, search]);

  const seg = (k, v, opts) => (
    <div className="flex">{opts.map(([val, label]) => (
      <button key={val} type="button" onClick={() => set({ [k]: val })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', v === val ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{v === val && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{label}</button>
    ))}</div>
  );

  return (
    /* fit-screen: the page fits the window; only the list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Customers</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">All customers of this shop - search and open the customer ledger</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Customers</span><span className="num text-[13px] font-bold">{tiles.total || 0}</span></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <div id="cust-search" className="min-w-64 flex-1"><p className="label">Search (F3)</p><Input autoFocus prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" value={state.search} onChange={(e) => set({ search: e.target.value })} placeholder="Name, mobile, A/c no, ID no…" /></div>
        <div><p className="label">Status</p>{seg('status', state.status, [['', 'All'], ['ACTIVE', 'Active'], ['BLOCKED', 'Blocked'], ['MERGED', 'Merged'], ['DUPLICATE', 'Possible duplicates']])}</div>
        <div><p className="label">Loans</p>{seg('loans', state.loans, [['', 'All'], ['open', 'With open loans'], ['none', 'No open loan']])}</div>
        <div><p className="label">Area</p><Select className="!h-8 w-40 text-[13px]" value={state.area || ''} onChange={(e) => set({ area: e.target.value })} placeholder="All areas" options={areas.data || []} /></div>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {[['Total customers', tiles.total, 'in this shop', 'bg-navy-900 dark:bg-white'], ['Active', tiles.active, 'can take loans', 'bg-emerald-600'],
          ['Blocked', tiles.blocked, 'new loan not allowed', 'bg-rose-600'], ['With open loans', tiles.with_open, `${tiles.open_loans ?? tiles.with_open ?? 0} open loans`, 'bg-blue-600']].map(([l, v, h, bar]) => (
          <div key={l} className="relative border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
            <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
            <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
            <p className="flex items-baseline gap-2"><span className="num text-lg leading-tight font-bold text-navy-900 dark:text-white">{v || 0}</span><span className="truncate text-[11px] text-ink-500">{h}</span></p>
          </div>
        ))}
      </div>
      {/* table, with the merge section on its right when open */}
      <div className={clsx('grid gap-2 xl:min-h-0 xl:flex-1 xl:[grid-template-rows:minmax(0,1fr)]', merging && 'xl:grid-cols-[1fr_340px]')}>
        <DataTable fill columns={[...columns, { key: '_actions', label: 'Actions', align: 'right', className: 'w-px !py-0.5', render: (r) => (
          <RowActions actions={[
            { icon: Eye, label: 'Customer details', onClick: () => { setSelected(r); setParams({ view: r.id }); } },
            { icon: BookUser, label: 'Customer ledger', onClick: () => setLedger(r.id) },
            { icon: Pencil, label: 'Edit customer', hidden: !can('customers', 'edit'), onClick: () => setEditing(r) },
          ]} />) }]} rows={list.data?.data} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
          sort={state.sort} order={state.order} onSort={(sort, order) => set({ sort, order })} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r) => setSelected(r)} onRowDoubleClick={(r) => { setSelected(r); setParams({ view: r.id }); }} rowClassName={(r) => (selected?.id === r.id ? '!bg-emerald-50 dark:!bg-emerald-950/30' : '')} />
        <MergeCustomersPanel open={merging} selected={selected} />
      </div>
      <PageActions>
        {can('customers', 'add') && !isAllBranches && <Button variant="outline" icon={Plus} onClick={() => setEditing({})}>New Customer (Ctrl+N)</Button>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" icon={FileDown} onClick={pdf}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={RefreshCw} onClick={() => list.refetch()}>Refresh (F5)</Button>
          {can('customers', 'export') && <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>}
          <Button variant="outline" icon={BookUser} disabled={!selected} onClick={() => setLedger(selected.id)}>Open Ledger (Enter)</Button>
          <ExitButton />
        </div>
      </PageActions>
      <PageActions keys={`F3 = search · click = select · double-click = details · Enter = customer ledger · Ctrl+N = new customer · F5 = refresh · Ctrl+E = Excel · Esc = exit · Last updated ${date(new Date())}`} />

      <CustomerDetailDrawer id={viewId} onClose={() => setParams({})} onEdit={(c) => setEditing(c)} />
      <CustomerFormDrawer open={!!editing} customer={editing?.id ? editing : null} onClose={() => setEditing(null)} />
      <CustomerLedgerDrawer customerId={ledger} onClose={() => setLedger(null)} />
    </div>
  );
}
