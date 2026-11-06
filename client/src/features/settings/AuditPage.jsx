import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Badge, DataTable, Drawer, Input, PageHeader, SearchInput } from '@/components/ui';
import { useList, useFetch } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { dateTime } from '@/lib/format';

export default function AuditPage() {
  const [state, set] = useTableState({ pageSize: 50, search: new URLSearchParams(window.location.search).get('action') || '' });
  const search = useDebounce(state.search);
  const list = useList('/admin/audit-logs', { ...state, search });
  const [row, setRow] = useState(null);
  const { data: tiles } = useFetch('/desk/audit-tiles', { from: state.from, to: state.to });
  return (
    <div className="animate-rise">
      <PageHeader icon={ScrollText} title="User Log" subtitle="Who did what and when - every login, entry, edit, print and delete" />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput className="w-full sm:w-80" value={state.search} onChange={(v) => set({ search: v })} placeholder="Action, screen, user, record id" />
        <Input type="date" className="w-40" value={state.from || ''} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-40" value={state.to || ''} onChange={(e) => set({ to: e.target.value })} />
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-5">
        {[['Entries', tiles?.entries, 'in date range', 'border-t-navy-800 bg-cream-100', ''], ['Logins', tiles?.logins, `${tiles?.users || 0} users`, 'border-t-navy-500', 'LOGIN'], ['Edits', tiles?.edits, 'records changed', 'border-t-gold-500', 'UPDATE'],
          ['Deletes', tiles?.deletes, 'records deleted', 'border-t-rose-600', 'DELETE'], ['Settings changed', tiles?.settings_changed, 'settings / rates / roles', 'border-t-violet-600', 'settings']].map(([l, v, h, c, s]) => (
          <button key={l} type="button" onClick={() => set({ search: s })} className={`card border-t-4 px-4 py-3 text-left ${c}`}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{v || 0}</p><p className="text-[11px] text-ink-500">{h}</p></button>
        ))}
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
