import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Merge, FileDown, RefreshCw, FileSpreadsheet, BookUser } from 'lucide-react';
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

const address = (r) => [r.door_no, r.street, r.area, r.city, r.pincode].filter(Boolean).join(', ');

export const customerColumns = [
  { key: 'customer_no', label: 'A/c No', sortable: true, width: 80, render: (r) => <span className="num font-bold text-navy-800">{r.customer_no}</span> },
  { key: 'name', label: 'Customer', sortable: true, render: (r) => (
    <div className="flex items-center gap-3">
      <Avatar src={r.photo} name={r.name} size="sm" />
      <div className="min-w-0"><p className="truncate font-semibold text-navy-900 dark:text-white">{r.title ? `${r.title}. ` : ''}{r.name}</p><p className="truncate text-xs text-ink-500">{r.relation_type} {r.relation_name}</p></div>
    </div>
  ) },
  { key: 'address', label: 'Address', render: (r) => <span className="text-xs">{address(r)}</span>, print: (r) => address(r) },
  { key: 'phone', label: 'Phone' },
  { key: 'open_loans', label: 'Open Loans', type: 'number' },
  { key: 'last_loan', label: 'Last Loan', type: 'date' },
  { key: 'status', label: 'Status', type: 'status' },
];

/** Customers (desktop: frmManageCustomer) - search and open the customer ledger. */
export default function CustomersPage() {
  const navigate = useNavigate();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const [params, setParams] = useSearchParams();
  const [state, set] = useTableState({ sort: 'customer_no', order: 'desc', status: '', loans: '', pageSize: 50 });
  const search = useDebounce(state.search);
  const list = useList('/customers', { ...state, search });
  const areas = useFetch('/customers/areas');
  const [editing, setEditing] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [selected, setSelected] = useState(null);
  const viewId = params.get('view');
  useEffect(() => { if (params.get('new') === '1') { setEditing({}); setParams({}); } }, [params, setParams]);
  const tiles = list.data?.tiles || {};
  const columns = isAllBranches ? [...customerColumns, { key: 'branch_name', label: 'Branch' }] : customerColumns;
  const all = async () => (await api.get('/customers', { ...state, search, pageSize: 200, page: 1 })).data;
  const pdf = async () => printTable({ title: 'Customer List', company, columns, rows: await all() });
  const excel = async () => exportCsv('customers', columns.map((c) => ({ ...c, key: c.key })), (await all()).map((r) => ({ ...r, address: address(r) })));
  useKeys({
    'ctrl+n': () => can('customers', 'add') && setEditing({}), f8: () => navigate('/customers/merge'), f5: () => list.refetch(),
    'ctrl+p': pdf, 'ctrl+e': excel, f3: () => document.querySelector('#cust-search input')?.focus(),
    enter: () => selected && setLedger(selected.id), escape: () => navigate('/'),
  }, [selected, state, search]);

  const seg = (k, v, opts) => (
    <div className="flex gap-1">{opts.map(([val, label]) => (
      <button key={val} type="button" onClick={() => set({ [k]: val })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', v === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{label}</button>
    ))}</div>
  );

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Customers</h1><p className="text-sm text-navy-100">All customers of this shop - search and open the customer ledger</p></div>
        <div className="rounded-md bg-white px-5 py-1.5 text-center text-ink-900"><p className="text-xs font-bold">CUSTOMERS</p><p className="font-bold">{tiles.total || 0}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <div id="cust-search" className="min-w-72 flex-1"><p className="label">Search</p><Input autoFocus className="bg-gold-50" value={state.search} onChange={(e) => set({ search: e.target.value })} placeholder="Name, mobile, A/c no, ID no…" /></div>
        <div><p className="label">Status</p>{seg('status', state.status, [['', 'All'], ['ACTIVE', 'Active'], ['BLOCKED', 'Blocked'], ['MERGED', 'Merged'], ['DUPLICATE', 'Possible duplicates']])}</div>
        <div><p className="label">Loans</p>{seg('loans', state.loans, [['', 'All'], ['open', 'With open loans'], ['none', 'No open loan']])}</div>
        <div><p className="label">Area</p><Select className="w-40" value={state.area || ''} onChange={(e) => set({ area: e.target.value })} placeholder="All areas" options={areas.data || []} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Total customers', tiles.total, 'in this shop', 'border-t-navy-800 bg-cream-100'], ['Active', tiles.active, 'can take loans', 'border-t-emerald-600'],
          ['Blocked', tiles.blocked, 'new loan not allowed', 'border-t-rose-600'], ['With open loans', tiles.with_open, `${tiles.with_open || 0} open loans`, 'border-t-navy-500']].map(([l, v, h, cls]) => (
          <div key={l} className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-700 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{v || 0}</p><p className="text-xs text-ink-500">{h}</p></div>
        ))}
      </div>
      <DataTable dense columns={columns} rows={list.data?.data} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
        sort={state.sort} order={state.order} onSort={(sort, order) => set({ sort, order })} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
        onRowClick={(r) => { setSelected(r); setParams({ view: r.id }); }} rowClassName={(r) => (selected?.id === r.id ? 'bg-cream-200' : '')} />
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        {can('customers', 'add') && !isAllBranches && <Button variant="outline" icon={Plus} onClick={() => setEditing({})}>New Customer (Ctrl+N)</Button>}
        {can('customer_merge', 'edit') && <Button variant="outline" icon={Merge} onClick={() => navigate('/customers/merge')}>Merge (F8)</Button>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" icon={FileDown} onClick={pdf}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={RefreshCw} onClick={() => list.refetch()}>Refresh (F5)</Button>
          {can('customers', 'export') && <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>}
          <Button variant="outline" icon={BookUser} disabled={!selected} onClick={() => setLedger(selected.id)}>Open Ledger (Enter)</Button>
          <ExitButton />
        </div>
      </div>
      <p className="px-1 text-xs text-ink-500">F3 = search · Enter / double-click = customer ledger · Ctrl+N = new customer · F8 = merge customers · F5 = refresh · Ctrl+E = Excel · Esc = exit · Last updated {date(new Date())}</p>

      <CustomerDetailDrawer id={viewId} onClose={() => setParams({})} onEdit={(c) => setEditing(c)} />
      <CustomerFormDrawer open={!!editing} customer={editing?.id ? editing : null} onClose={() => setEditing(null)} />
      <CustomerLedgerDrawer customerId={ledger} onClose={() => setLedger(null)} />
    </div>
  );
}
