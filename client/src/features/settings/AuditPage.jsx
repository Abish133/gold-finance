import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Badge, DataTable, Drawer, Input, PageHeader, SearchInput } from '@/components/ui';
import { useList } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { dateTime } from '@/lib/format';

export default function AuditPage() {
  const [state, set] = useTableState({ pageSize: 50, search: new URLSearchParams(window.location.search).get('action') || '' });
  const search = useDebounce(state.search);
  const list = useList('/admin/audit-logs', { ...state, search });
  const [row, setRow] = useState(null);
  return (
    <div className="animate-rise">
      <PageHeader icon={ScrollText} title="Audit Trail" subtitle="Who did what, when - every login, entry, edit, print and delete" />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput className="w-full sm:w-80" value={state.search} onChange={(v) => set({ search: v })} placeholder="Action, screen, user, record id" />
        <Input type="date" className="w-40" value={state.from || ''} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-40" value={state.to || ''} onChange={(e) => set({ to: e.target.value })} />
      </div>
      <DataTable dense rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })} onRowClick={setRow} columns={[
        { key: 'created_at', label: 'Time', render: (r) => dateTime(r.created_at) }, { key: 'user_name', label: 'User' },
        { key: 'action', label: 'Action', render: (r) => <Badge tone={/DELETE|CANCEL|VOID/.test(r.action) ? 'red' : /CREATE|NEW/.test(r.action) ? 'green' : 'blue'}>{r.action}</Badge> },
        { key: 'entity', label: 'Record' }, { key: 'entity_id', label: 'Id' }, { key: 'branch_name', label: 'Branch' }, { key: 'ip', label: 'IP' },
      ]} />
      <Drawer open={!!row} onClose={() => setRow(null)} title={row?.action} subtitle={row && `${row.user_name} · ${dateTime(row.created_at)}`} icon={ScrollText}>
        <pre className="overflow-x-auto rounded-xl bg-ink-50 p-4 text-xs dark:bg-ink-950">{row?.details ? JSON.stringify(typeof row.details === 'string' ? JSON.parse(row.details) : row.details, null, 2) : 'No details'}</pre>
      </Drawer>
    </div>
  );
}
