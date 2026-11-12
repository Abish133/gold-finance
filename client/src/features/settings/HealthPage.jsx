import { useNavigate } from 'react-router';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, Database, HardDriveDownload, MessageSquare, ChevronRight, Users } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { ExitButton } from '@/features/loans/desk';
import { PageActions } from '@/components/common/PageActions';
import { SHELL, Head, Chip } from '@/features/accounts/compact';

const up = (s) => { const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };

function Box({ icon: Icon, title, sub, children, className }) {
  return (
    <section className={clsx('flex min-w-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900', className)}>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
        <Icon className="size-3.5 text-navy-700 dark:text-white" /><h3 className="text-[11px] font-bold tracking-wider whitespace-nowrap text-navy-900 uppercase dark:text-white">{title}</h3>
        {sub && <span className="truncate text-[11px] text-ink-500">{sub}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2.5 text-[12px]">{children}</div>
    </section>
  );
}
const Line = ({ k, v, tone }) => <div className="flex justify-between gap-3 border-b border-dashed border-ink-200 py-1 last:border-0 dark:border-ink-700"><span className="text-ink-500">{k}</span><b className={clsx('num text-right', tone)}>{v}</b></div>;

/** System health: server, database, backups, messages, today's Day End checklist and user activity - read only. */
export default function HealthPage() {
  const navigate = useNavigate();
  const { isAllBranches } = useAuth();
  const { data: d, isLoading, refetch, isFetching } = useFetch('/admin/health', undefined, { refetchInterval: 60_000 });
  const okCount = d?.checklist.filter((c) => c.ok).length || 0;

  return (
    <div className={SHELL}>
      <Head icon={Activity} title="System Health" sub="Server, database, backups, messages, Day End checklist and user activity">
        {d && <Chip label="Server up" value={up(d.server.uptimeSec)} />}
        {d && d.checklist.length > 0 && <Chip strong label="Today" value={`${okCount}/${d.checklist.length} done`} />}
      </Head>
      <PageActions keys="Refreshes by itself every minute">
        <Button variant="outline" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Refresh</Button>
        <ExitButton />
      </PageActions>

      {isLoading || !d ? <div className="grid gap-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />)}</div> : (
        <div className="grid content-start gap-2 overflow-y-auto xl:min-h-0 xl:flex-1 lg:grid-cols-3">
          {/* Day End checklist */}
          <Box icon={CheckCircle2} title="Day End checklist" sub={isAllBranches ? 'select a branch to see it' : `${okCount} of ${d.checklist.length} done`} className="lg:row-span-2">
            {isAllBranches ? <p className="py-6 text-center text-ink-400">Choose one branch in the header to see its checklist.</p> : (
              <ul className="space-y-1.5">
                {d.checklist.map((c) => (
                  <li key={c.key}>
                    <button type="button" onClick={() => navigate(c.link)} className={clsx('flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition hover:brightness-95',
                      c.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200')}>
                      {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-amber-600" />}
                      <span className="min-w-0 flex-1 text-[12px] font-semibold">{c.text}</span>
                      <span className="shrink-0 text-[10px] font-bold uppercase opacity-70">{c.ok ? 'Done' : 'To do'}</span>
                      <ChevronRight className="size-3.5 shrink-0 opacity-50" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Box>

          <Box icon={Server} title="Server">
            <Line k="Running for" v={up(d.server.uptimeSec)} />
            <Line k="Memory used" v={`${d.server.memoryMb} MB`} tone={d.server.memoryMb > 800 ? 'text-amber-700' : undefined} />
            <Line k="Node.js" v={d.server.node} />
            <Line k="Mode" v={d.server.mode} />
            <Line k="Server time" v={dayjs(d.server.time).format('DD/MM/YYYY hh:mm A')} />
          </Box>

          <Box icon={HardDriveDownload} title="Backups" sub={`${d.backups.count} on the server`}>
            <Line k="Last backup" v={d.backups.ageHours == null ? 'never' : d.backups.ageHours < 1 ? 'less than an hour ago' : d.backups.ageHours < 48 ? `${d.backups.ageHours} hours ago` : `${Math.round(d.backups.ageHours / 24)} days ago`}
              tone={d.backups.ageHours == null || d.backups.ageHours >= 24 ? 'text-rose-600' : 'text-emerald-700'} />
            {d.backups.latest.map((f) => <Line key={f.name} k={<span className="truncate">{f.name}</span>} v={dayjs(f.created_at).format('DD/MM hh:mm A')} />)}
            <Button variant="outline" className="mt-2 h-7 w-full text-[12px]" onClick={() => navigate('/settings/backup')}>Open Backup</Button>
          </Box>

          <Box icon={MessageSquare} title="SMS / WhatsApp" sub="last 7 days">
            <Line k="Service" v={d.messages.enabled ? (d.messages.provider ? 'On' : 'On - provider URL missing') : 'Off'} tone={d.messages.enabled && d.messages.provider ? 'text-emerald-700' : 'text-amber-700'} />
            {['SENT', 'PENDING', 'FAILED', 'SKIPPED'].map((s) => <Line key={s} k={s.charAt(0) + s.slice(1).toLowerCase()} v={Number(d.messages.byStatus.find((m) => m.status === s)?.c || 0)} tone={s === 'FAILED' && d.messages.failed ? 'text-rose-600' : undefined} />)}
          </Box>

          <Box icon={Database} title="Database" sub={`${d.database.totalMb} MB in total`}>
            <table className="w-full"><thead className="text-[10px] tracking-wider text-ink-500 uppercase"><tr><th className="py-1 text-left">Table</th><th className="text-right">Rows</th><th className="text-right">Size</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{d.database.tables.map((t) => <tr key={t.name}><td className="py-1">{t.name}</td><td className="num text-right">{t.rows.toLocaleString('en-IN')}</td><td className="num text-right text-ink-500">{t.kb} KB</td></tr>)}</tbody>
            </table>
          </Box>

          <Box icon={Users} title="User activity" sub="last 30 days, from the audit trail" className="lg:col-span-2">
            <table className="w-full"><thead className="text-[10px] tracking-wider text-ink-500 uppercase"><tr><th className="py-1 text-left">User</th><th className="text-right">Actions</th><th className="text-right">Logins</th><th className="text-right">Deletes / voids</th><th className="px-2 text-left">Screens used</th><th className="text-right">Last seen</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {d.activity.map((a) => (
                  <tr key={a.user_id ?? 'x'}><td className="py-1 font-semibold">{a.full_name || a.username || 'System'}</td><td className="num text-right">{a.actions}</td><td className="num text-right">{a.logins}</td>
                    <td className={clsx('num text-right', Number(a.removals) > 0 && 'font-bold text-rose-600')}>{a.removals}</td><td className="max-w-72 truncate px-2 text-ink-500" title={a.areas}>{a.areas}</td><td className="num text-right whitespace-nowrap">{dayjs(a.last_at).format('DD/MM hh:mm A')}</td></tr>
                ))}
                {!d.activity.length && <tr><td colSpan={6} className="py-6 text-center text-ink-400">No activity</td></tr>}
              </tbody>
            </table>
          </Box>
        </div>
      )}
    </div>
  );
}
