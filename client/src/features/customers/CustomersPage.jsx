import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Users, Plus, Download } from 'lucide-react';
import { Avatar, Button, DataTable, PageHeader, SearchInput, Select, Segmented } from '@/components/ui';
import { useList, useFetch } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { CustomerFormDrawer } from './CustomerFormDrawer';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';

export const customerColumns = [
  { key: 'customer_no', label: 'No', sortable: true, width: 70, render: (r) => <span className="num font-semibold text-ink-500">#{r.customer_no}</span> },
  { key: 'name', label: 'Customer', sortable: true, exportKey: true, render: (r) => (
    <div className="flex items-center gap-3">
      <Avatar src={r.photo} name={r.name} size="sm" />
      <div className="min-w-0"><p className="truncate font-semibold text-ink-900 dark:text-white">{r.name}</p><p className="truncate text-xs text-ink-500">{r.relation_type} {r.relation_name}</p></div>
    </div>
  ) },
  { key: 'phone', label: 'Mobile' },
  { key: 'area', label: 'Area', sortable: true },
  { key: 'open_loans', label: 'Open loans', type: 'number' },
  { key: 'outstanding', label: 'Outstanding', type: 'money' },
  { key: 'status', label: 'Status', type: 'status' },
];

export default function CustomersPage() {
  const { can, isAllBranches } = useAuth();
  const [params, setParams] = useSearchParams();
  const [state, set] = useTableState({ sort: 'customer_no', order: 'desc', status: '' });
  const search = useDebounce(state.search);
  const list = useList('/customers', { ...state, search });
  const areas = useFetch('/customers/areas');
  const [editing, setEditing] = useState(null);
  const viewId = params.get('view');
  useEffect(() => { if (params.get('new') === '1') { setEditing({}); setParams({}); } }, [params, setParams]);

  const columns = isAllBranches ? [...customerColumns, { key: 'branch_name', label: 'Branch' }] : customerColumns;

  return (
    <div className="animate-rise">
      <PageHeader title="Customers" subtitle="Search by name, mobile, ID number or customer no" icon={Users} actions={(
        <>
          {can('customers', 'export') && (
            <Button variant="outline" icon={Download} onClick={async () => {
              const r = await api.get('/customers', { ...state, search, pageSize: 200, page: 1 });
              exportCsv('customers', [{ key: 'customer_no', label: 'No' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Mobile' }, { key: 'area', label: 'Area' }, { key: 'open_loans', label: 'Open loans' }, { key: 'outstanding', label: 'Outstanding' }], r.data);
            }}>Export</Button>
          )}
          {can('customers', 'add') && !isAllBranches && <Button variant="gold" icon={Plus} onClick={() => setEditing({})}>New customer</Button>}
        </>
      )} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={state.search} onChange={(v) => set({ search: v })} className="w-full sm:w-96" placeholder="Name, mobile, ID no, customer no…" />
        <Segmented value={state.status} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'BLOCKED', label: 'Blocked' }]} />
        <Select className="w-44" value={state.area || ''} onChange={(e) => set({ area: e.target.value })} placeholder="All areas" options={areas.data || []} />
      </div>
      <DataTable columns={columns} rows={list.data?.data} loading={list.isLoading} fetching={list.isFetching} meta={list.data?.meta}
        sort={state.sort} order={state.order} onSort={(sort, order) => set({ sort, order })} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
        onRowClick={(r) => setParams({ view: r.id })} />

      <CustomerDetailDrawer id={viewId} onClose={() => setParams({})} onEdit={(c) => setEditing(c)} />
      <CustomerFormDrawer open={!!editing} customer={editing?.id ? editing : null} onClose={() => setEditing(null)} />
    </div>
  );
}
