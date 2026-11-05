import { useNavigate } from 'react-router';
import { BookOpen, Download, FilePlus2 } from 'lucide-react';
import { Button, DataTable, Input, PageHeader, SearchInput, Segmented, Select, Stat } from '@/components/ui';
import { useList, useLookups } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { money, grams, compact } from '@/lib/format';

const columns = [
  { key: 'bill_no', label: 'Loan no', sortable: true, render: (r) => <span className="font-bold text-ink-900 dark:text-white">#{r.bill_no}</span> },
  { key: 'loan_date', label: 'Date', type: 'date', sortable: true },
  { key: 'customer_name', label: 'Customer', sortable: true, render: (r) => <div><p className="font-semibold">{r.customer_name}</p><p className="text-xs text-ink-500">{r.customer_phone}</p></div> },
  { key: 'item_summary', label: 'Items', className: 'max-w-56 truncate' },
  { key: 'net_wt', label: 'Net wt', type: 'weight', sortable: true },
  { key: 'principal', label: 'Loan', type: 'money', sortable: true },
  { key: 'current_principal', label: 'Balance', type: 'money' },
  { key: 'due_date', label: 'Due', type: 'date', sortable: true },
  { key: 'status', label: 'Status', type: 'status' },
];

const EXPORT = [
  { key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'customer_phone', label: 'Phone' },
  { key: 'item_summary', label: 'Items' }, { key: 'gross_wt', label: 'Gross' }, { key: 'net_wt', label: 'Net' }, { key: 'principal', label: 'Loan' },
  { key: 'current_principal', label: 'Balance' }, { key: 'due_date', label: 'Due', type: 'date' }, { key: 'status', label: 'Status' }, { key: 'branch_name', label: 'Branch' },
];

export default function PledgeBookPage() {
  const navigate = useNavigate();
  const { can, isAllBranches } = useAuth();
  const { data: lk } = useLookups();
  const [state, set] = useTableState({ status: 'OPEN', sort: 'loan_date', order: 'desc' });
  const search = useDebounce(state.search);
  const params = { ...state, search };
  const list = useList('/loans', params);
  const sm = list.data?.summary;
  const cols = isAllBranches ? [...columns, { key: 'branch_name', label: 'Branch' }] : columns;

  return (
    <div className="animate-rise">
      <PageHeader title="Pledge Book" subtitle="Every loan with filters, search and export" icon={BookOpen} actions={(
        <>
          {can('loan_list', 'export') && <Button variant="outline" icon={Download} onClick={async () => { const r = await api.get('/loans', { ...params, page: 1, pageSize: 200 }); exportCsv('pledge-book', EXPORT, r.data); }}>Export</Button>}
          {can('loan_new', 'add') && <Button variant="gold" icon={FilePlus2} onClick={() => navigate('/loans/new')}>New loan</Button>}
        </>
      )} />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Loans" value={(sm?.total || 0).toLocaleString('en-IN')} />
        <Stat label="Loan amount" value={compact(sm?.principal)} tone="blue" />
        <Stat label="Outstanding" value={compact(sm?.outstanding)} tone="red" />
        <Stat label="Net weight" value={grams(sm?.net_wt)} tone="gold" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={state.search} onChange={(v) => set({ search: v })} className="w-full sm:w-80" placeholder="Loan no, name, mobile, barcode…" />
        <Segmented value={state.status} onChange={(v) => set({ status: v })} options={[{ value: 'OPEN', label: 'Open' }, { value: 'CLOSED,RENEWED', label: 'Closed' }, { value: 'AUCTIONED', label: 'Auctioned' }, { value: 'CANCELLED', label: 'Cancelled' }, { value: '', label: 'All' }]} />
        <Input type="date" className="w-40" value={state.from || ''} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-40" value={state.to || ''} onChange={(e) => set({ to: e.target.value })} />
        <Select className="w-40" value={state.scheme_id || ''} onChange={(e) => set({ scheme_id: e.target.value })} placeholder="All schemes" options={(lk?.schemes || []).map((s) => ({ value: s.id, label: s.code }))} />
        <Segmented size="sm" value={state.overdue || ''} onChange={(v) => set({ overdue: v })} options={[{ value: '', label: 'Any due' }, { value: '1', label: 'Overdue' }]} />
      </div>
      <DataTable columns={cols} rows={list.data?.data} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
        sort={state.sort} order={state.order} onSort={(sort, order) => set({ sort, order })} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
        onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)} rowClassName={(r) => (r.status === 'OPEN' && r.due_date < new Date().toISOString().slice(0, 10) ? 'bg-rose-50/40 dark:bg-rose-500/5' : '')}
        totals={list.data?.data?.length ? { principal: list.data.data.reduce((s, r) => s + Number(r.principal), 0), current_principal: list.data.data.reduce((s, r) => s + Number(r.current_principal), 0), net_wt: list.data.data.reduce((s, r) => s + Number(r.net_wt), 0) } : undefined} />
      <p className="mt-2 text-xs text-ink-400">Totals row covers this page; summary cards cover all filtered loans.</p>
    </div>
  );
}
