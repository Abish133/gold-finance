import { useState } from 'react';
import { UserX, Ban, CheckCircle2 } from 'lucide-react';
import { Button, ConfirmDrawer, DataTable, Field, PageHeader, SearchInput, Segmented, Textarea } from '@/components/ui';
import { useList, useAction } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { customerColumns } from './CustomersPage';

export default function BlockedCustomersPage() {
  const [state, set] = useTableState({ status: 'BLOCKED' });
  const search = useDebounce(state.search);
  const list = useList('/customers', { ...state, search });
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const act = useAction({ invalidate: ['/customers'], success: 'Customer status updated' });
  const blocking = target?.status !== 'BLOCKED';

  return (
    <div className="animate-rise">
      <PageHeader title="Block / Unblock Customers" subtitle="Blocked customers cannot take new loans" icon={UserX} />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={state.search} onChange={(v) => set({ search: v })} className="w-full sm:w-96" />
        <Segmented value={state.status} onChange={(v) => set({ status: v })} options={[{ value: 'BLOCKED', label: 'Blocked' }, { value: 'ACTIVE', label: 'Active' }]} />
      </div>
      <DataTable
        columns={[...customerColumns, { key: 'block_reason', label: 'Reason' }, {
          key: 'act', label: '', align: 'right', render: (r) => (
            r.status === 'BLOCKED'
              ? <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => { setTarget(r); setReason(''); }}>Unblock</Button>
              : <Button size="sm" variant="danger" icon={Ban} onClick={() => { setTarget(r); setReason(''); }}>Block</Button>
          ),
        }]}
        rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })}
      />
      <ConfirmDrawer open={!!target} onClose={() => setTarget(null)} title={blocking ? `Block ${target?.name}?` : `Unblock ${target?.name}?`}
        confirmText={blocking ? 'Block customer' : 'Unblock'} tone={blocking ? 'danger' : 'primary'} loading={act.isPending}
        onConfirm={() => act.mutate({ url: `/customers/${target.id}/block`, body: { block: blocking, reason } }, { onSuccess: () => setTarget(null) })}>
        {blocking && <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fake jewel, fraud attempt" /></Field>}
      </ConfirmDrawer>
    </div>
  );
}
