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
    /* fit-screen: the page fits the window; only the log scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <PageHeader icon={ScrollText} title="User Log" subtitle="Who did what and when - every login, entry, edit, print and delete" />
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <div className="min-w-56 flex-1"><p className="label">Search</p><SearchInput className="[&_input]:!h-8 [&_input]:text-[13px]" value={state.search} onChange={(v) => set({ search: v })} placeholder="Action, screen, user, record id" /></div>
        <div><p className="label">From</p><Input type="date" className="!h-8 w-36 text-[13px]" value={state.from || ''} onChange={(e) => set({ from: e.target.value })} /></div>
        <div><p className="label">To</p><Input type="date" className="!h-8 w-36 text-[13px]" value={state.to || ''} onChange={(e) => set({ to: e.target.value })} /></div>
      </div>
      {/* figures - click one to filter the log */}
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
        {[['Entries', tiles?.entries, 'in date range', 'bg-navy-900 dark:bg-white', ''], ['Logins', tiles?.logins, `${tiles?.users || 0} users`, 'bg-blue-600', 'LOGIN'], ['Edits', tiles?.edits, 'records changed', 'bg-amber-500', 'UPDATE'],
          ['Deletes', tiles?.deletes, 'records deleted', 'bg-rose-600', 'DELETE'], ['Settings changed', tiles?.settings_changed, 'settings / rates / roles', 'bg-violet-600', 'settings']].map(([l, v, h, c, s]) => (
          <button key={l} type="button" onClick={() => set({ search: s })}
            className={`relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 text-left not-last:border-r dark:border-ink-800 ${state.search === s ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
            <span aria-hidden className={`absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm ${c}`} />
            <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
            <p className="flex items-baseline gap-2"><span className="num text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v || 0}</span><span className="truncate text-[10px] text-ink-500">{h}</span></p>
          </button>
        ))}
      </div>
      <DataTable fill rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })} onRowClick={setRow} columns={[
        { key: 'created_at', label: 'Time', render: (r) => dateTime(r.created_at) }, { key: 'user_name', label: 'User' },
        { key: 'action', label: 'Action', render: (r) => <Badge tone={/DELETE|CANCEL|VOID/.test(r.action) ? 'red' : /CREATE|NEW/.test(r.action) ? 'green' : 'blue'}>{r.action}</Badge> },
        { key: 'entity', label: 'Record' }, { key: 'entity_id', label: 'Id' }, { key: 'branch_name', label: 'Branch' }, { key: 'ip', label: 'IP' },
      ]} />
      <Drawer open={!!row} onClose={() => setRow(null)} title={row?.action} subtitle={row && `${row.user_name} · ${dateTime(row.created_at)}`} icon={ScrollText}>
        <pre className="overflow-x-auto rounded-md border border-ink-200 bg-ink-50 p-3 text-[12px] dark:border-ink-800 dark:bg-ink-950">{row?.details ? JSON.stringify(typeof row.details === 'string' ? JSON.parse(row.details) : row.details, null, 2) : 'No details'}</pre>
      </Drawer>
    </div>
  );
}
