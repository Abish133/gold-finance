import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Download, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const parse = (d) => { try { return typeof d === 'string' ? JSON.parse(d) : d || {}; } catch { return {}; } };

/** Backup Database (desktop): take a backup now, backup history, restore / auto backup guidance. */
export default function BackupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAllBranches, currentBranch } = useAuth();
  const { data } = useFetch('/admin/backup-history');
  const [tab, setTab] = useState('backup');
  const [busy, setBusy] = useState(false);
  const rows = data?.rows || [];
  const last = rows[0];
  const file = `gold-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const run = async () => {
    setBusy(true);
    try { await api.download('/admin/backup', undefined, file); toast.success('Backup downloaded - keep the file safe'); qc.invalidateQueries({ queryKey: ['/admin/backup-history'] }); } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  useKeys({ f2: run, escape: () => navigate('/') }, []);
  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="text-xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Backup Database</h1><p className="text-sm text-navy-100">Take a backup file of your data and keep it safe</p></section>
      <div className="grid gap-3 sm:grid-cols-4">
        {tile('Database', 'MySQL', data ? `${data.tables} tables · ${Math.round(data.sizeKb / 1024 * 10) / 10} MB` : '', 'border-t-navy-800')}
        {tile('Last backup', last ? dateTime(last.created_at) : 'Never', last ? `by ${last.by_name || '-'}` : 'Take a backup now', last ? 'border-t-emerald-700' : 'border-t-rose-600')}
        {tile('Backups taken', rows.length, 'downloaded backup files', 'border-t-amber-500')}
        {tile('Scope', isAllBranches ? 'All branches' : currentBranch?.name, 'masters + transactions', 'border-t-blue-600')}
      </div>
      <div className="flex gap-1">{[['backup', 'Backup'], ['restore', 'Restore'], ['auto', 'Auto Backup']].map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={clsx('h-9 rounded-md border px-5 text-sm font-semibold', tab === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>
      ))}</div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="card space-y-3 p-4 text-sm">
          {tab === 'backup' && (<>
            <p className="label">File name</p><p className="rounded-md bg-ink-50 px-3 py-2 font-mono text-xs dark:bg-ink-800">{file}</p>
            <p className="text-ink-600">The file has the company masters plus every customer, loan, receipt, voucher and bank entry of <b>{isAllBranches ? 'all your branches' : currentBranch?.name}</b>. Save it to a pen drive or Google Drive as a second copy.</p>
            <Button variant="gold" size="lg" className="w-full" icon={Download} loading={busy} onClick={run}>Take Backup Now (F2)</Button>
          </>)}
          {tab === 'restore' && <p className="text-ink-600">Restore puts an old copy back over today's data, so it is done on the server by the administrator from a MySQL dump (see Auto Backup). This protects you from someone restoring an old file by mistake at the counter.</p>}
          {tab === 'auto' && (<>
            <p className="text-ink-600">Schedule a nightly database dump on the server (Windows Task Scheduler / cron). Keep the last 30 files:</p>
            <pre className="overflow-x-auto rounded-md bg-ink-900 p-3 text-xs text-gold-200">mysqldump -u root -p --single-transaction gold_finance &gt; backup.sql</pre>
            <p className="text-xs text-ink-500">Restore: mysql -u root -p gold_finance &lt; backup.sql</p>
          </>)}
        </div>
        <div className="card overflow-hidden">
          <p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">Backup history · {rows.length}</p>
          <table className="w-full text-sm">
            <thead className="bg-navy-800 text-white"><tr><th className="px-2 py-1.5 text-left">Date / Time</th><th className="px-2 text-right">Rows</th><th className="px-2 text-right">Size</th><th className="px-2 text-left">Type</th><th className="px-2 text-left">By</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-ink-400">No backups yet</td></tr>}
              {rows.map((r) => { const d = parse(r.details); return (
                <tr key={r.id}><td className="px-2 py-1.5">{dateTime(r.created_at)}</td><td className="num px-2 text-right">{d.rows ?? '-'}</td><td className="num px-2 text-right">{d.kb ? `${d.kb} KB` : '-'}</td><td className="px-2">{d.type || 'Manual'}</td><td className="px-2">{r.by_name}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card flex justify-end px-3 py-2"><Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button></div>
      <p className="px-1 text-xs text-ink-500">F2 = take backup now · Esc = exit</p>
    </div>
  );
}
