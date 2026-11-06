import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Download, LogOut, DatabaseBackup, HardDriveDownload, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const parse = (d) => { try { return typeof d === 'string' ? JSON.parse(d) : d || {}; } catch { return {}; } };
const day = () => new Date().toISOString().slice(0, 10);

/** Backup Database (desktop): take a backup, restore a backup, nightly auto backup on the server. */
export default function BackupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAllBranches, currentBranch } = useAuth();
  const admin = !!user?.is_super_admin;
  const { data } = useFetch('/admin/backup-history');
  const files = useFetch('/admin/backup-files');
  const [tab, setTab] = useState('backup');
  const [busy, setBusy] = useState('');
  const [auto, setAuto] = useState(null);
  const [rs, setRs] = useState({ source: 'server', file: '', upload: null, confirm: '', password: '' });
  const rows = data?.rows || [];
  const last = rows[0];
  const list = files.data?.files || [];
  const a = auto || files.data?.settings || {};
  const refresh = () => { qc.invalidateQueries({ queryKey: ['/admin/backup-history'] }); files.refetch(); };
  const work = async (key, fn) => { setBusy(key); try { await fn(); } catch (e) { toast.error(e.message); } setBusy(''); };

  const branchBackup = () => work('branch', async () => { await api.download('/admin/backup', undefined, `gold-finance-backup-${day()}.json`); toast.success('Backup downloaded - keep the file safe'); refresh(); });
  const fullBackup = () => work('full', async () => { await api.download('/admin/backup/full', undefined, `gold-finance-full-${day()}.json.gz`); toast.success('Full backup downloaded - this file can be restored'); refresh(); });
  const serverBackup = () => work('server', async () => { const r = await api.post('/admin/backup-files'); toast.success(`Saved on server: ${r.data.file}`); refresh(); });
  const saveAuto = () => work('auto', async () => { await api.put('/admin/backup-settings', a); toast.success('Auto backup settings saved'); setAuto(null); files.refetch(); });
  const restore = () => work('restore', async () => {
    const extra = { confirm: rs.confirm, password: rs.password };
    const r = rs.source === 'upload' ? await api.upload('/admin/restore', rs.upload, extra) : await api.post('/admin/restore', { ...extra, file: rs.file });
    toast.success(`Restored ${r.data.rows} rows from the backup of ${dateTime(r.data.taken)}. Safety copy: ${r.data.safety}`);
    setRs({ source: rs.source, file: '', upload: null, confirm: '', password: '' });
    qc.clear(); refresh();
  });
  const canRestore = rs.confirm === 'RESTORE' && rs.password && (rs.source === 'upload' ? !!rs.upload : !!rs.file);

  useKeys({ f2: tab === 'backup' ? (admin ? fullBackup : branchBackup) : () => {}, escape: () => navigate('/') }, [tab, admin]);
  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="text-xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Backup Database</h1><p className="text-sm text-navy-100">Take a backup, restore a backup, and the nightly auto backup</p></section>
      <div className="grid gap-3 sm:grid-cols-4">
        {tile('Database', 'MySQL', data ? `${data.tables} tables · ${Math.round(data.sizeKb / 1024 * 10) / 10} MB` : '', 'border-t-navy-800')}
        {tile('Last backup', last ? dateTime(last.created_at) : 'Never', last ? `${parse(last.details).type || 'Manual'} · by ${last.by_name || 'auto'}` : 'Take a backup now', last ? 'border-t-emerald-700' : 'border-t-rose-600')}
        {tile('Auto backup', a.AUTO_BACKUP_ENABLED === '1' ? `On · ${a.AUTO_BACKUP_TIME}` : 'Off', `${list.length} files on server · keeps ${a.AUTO_BACKUP_KEEP || 30}`, a.AUTO_BACKUP_ENABLED === '1' ? 'border-t-amber-500' : 'border-t-rose-600')}
        {tile('Scope', isAllBranches ? 'All branches' : currentBranch?.name, 'masters + transactions', 'border-t-blue-600')}
      </div>
      <div className="flex gap-1">{[['backup', 'Backup'], ['restore', 'Restore'], ['auto', 'Auto Backup']].map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={clsx('h-9 rounded-md border px-5 text-sm font-semibold', tab === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>
      ))}</div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="card space-y-3 p-4 text-sm">
          {tab === 'backup' && (<>
            {admin && (<>
              <p className="font-bold">Full backup (can be restored)</p>
              <p className="text-ink-600">Every table of every branch, users and settings included. Save it to a pen drive or Google Drive as a second copy.</p>
              <Button variant="gold" size="lg" className="w-full" icon={DatabaseBackup} loading={busy === 'full'} onClick={fullBackup}>Take Full Backup Now (F2)</Button>
              <hr className="border-ink-200 dark:border-ink-700" />
            </>)}
            <p className="font-bold">Branch data export</p>
            <p className="text-ink-600">Masters plus every customer, loan, receipt, voucher and bank entry of <b>{isAllBranches ? 'all your branches' : currentBranch?.name}</b>, as a readable file. This file is for keeping / checking, not for restore.</p>
            <Button variant={admin ? 'outline' : 'gold'} size="lg" className="w-full" icon={Download} loading={busy === 'branch'} onClick={branchBackup}>{admin ? 'Export Branch Data' : 'Take Backup Now (F2)'}</Button>
          </>)}
          {tab === 'restore' && (!admin ? <p className="text-ink-600">Only the super admin can restore a backup.</p> : (<>
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">Restore puts the backup's data back over <b>all of today's data, in every branch</b>. Anything entered after that backup is lost. A safety backup of the current data is saved on the server first.</p>
            <div className="flex gap-1">{[['server', 'Server backup file'], ['upload', 'Upload a file']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setRs({ ...rs, source: k })} className={clsx('h-9 rounded-md border px-4 text-sm font-semibold', rs.source === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>
            ))}</div>
            {rs.source === 'server'
              ? <Field label="Backup file"><Select value={rs.file} onChange={(e) => setRs({ ...rs, file: e.target.value })} placeholder={list.length ? 'Choose a backup' : 'No server backups yet'} options={list.map((f) => ({ value: f.name, label: `${dateTime(f.created_at)} · ${f.name.replace('gold-finance-', '').replace(/-\d{4}-\d\d-\d\d_\d+\.json\.gz$/, '')} · ${f.kb} KB` }))} /></Field>
              : <Field label="Full backup file (.json.gz)"><Input type="file" accept=".gz,.json" onChange={(e) => setRs({ ...rs, upload: e.target.files?.[0] || null })} /></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type RESTORE to confirm"><Input value={rs.confirm} onChange={(e) => setRs({ ...rs, confirm: e.target.value.toUpperCase() })} /></Field>
              <Field label="Your password"><Input type="password" value={rs.password} onChange={(e) => setRs({ ...rs, password: e.target.value })} /></Field>
            </div>
            <Button variant="danger" size="lg" className="w-full" icon={RotateCcw} disabled={!canRestore} loading={busy === 'restore'} onClick={restore}>Restore Backup</Button>
          </>))}
          {tab === 'auto' && (<>
            <p className="text-ink-600">Every night the server saves a full backup in its <b>backups</b> folder and keeps the newest files. Copy that folder to a pen drive or cloud drive now and then.</p>
            <Checkbox checked={a.AUTO_BACKUP_ENABLED === '1'} onChange={(v) => setAuto({ ...a, AUTO_BACKUP_ENABLED: v ? '1' : '0' })} label="Take an auto backup every day" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Backup time (24 hours)"><Input type="time" value={a.AUTO_BACKUP_TIME || '21:00'} onChange={(e) => setAuto({ ...a, AUTO_BACKUP_TIME: e.target.value })} /></Field>
              <Field label="Keep last (files)"><Input type="number" min={1} value={a.AUTO_BACKUP_KEEP || '30'} onChange={(e) => setAuto({ ...a, AUTO_BACKUP_KEEP: e.target.value })} /></Field>
            </div>
            <div className="flex gap-2">
              <Button variant="gold" icon={Save} disabled={!auto} loading={busy === 'auto'} onClick={saveAuto}>Save Settings</Button>
              {admin && <Button variant="outline" icon={HardDriveDownload} loading={busy === 'server'} onClick={serverBackup}>Back Up to Server Now</Button>}
            </div>
            <p className="text-xs text-ink-500">If the computer is off at the backup time, the backup runs as soon as the server starts again that day.</p>
          </>)}
        </div>
        <div className="card overflow-hidden">
          {tab === 'backup' ? (<>
            <p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">Backup history · {rows.length}</p>
            <table className="w-full text-sm">
              <thead className="bg-navy-800 text-white"><tr><th className="px-2 py-1.5 text-left">Date / Time</th><th className="px-2 text-right">Rows</th><th className="px-2 text-right">Size</th><th className="px-2 text-left">Type</th><th className="px-2 text-left">By</th></tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-ink-400">No backups yet</td></tr>}
                {rows.map((r) => { const d = parse(r.details); return (
                  <tr key={r.id}><td className="px-2 py-1.5">{dateTime(r.created_at)}</td><td className="num px-2 text-right">{d.rows ?? '-'}</td><td className="num px-2 text-right">{d.kb ? `${d.kb} KB` : '-'}</td><td className="px-2">{d.type || 'Manual'}{d.scope === 'FULL' ? ' (full)' : ''}</td><td className="px-2">{r.by_name || 'Auto'}</td></tr>
                ); })}
              </tbody>
            </table>
          </>) : (<>
            <p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">Backup files on the server · {list.length}</p>
            <table className="w-full text-sm">
              <thead className="bg-navy-800 text-white"><tr><th className="px-2 py-1.5 text-left">Date / Time</th><th className="px-2 text-left">File</th><th className="px-2 text-right">Size</th><th className="w-10" /></tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!list.length && <tr><td colSpan={4} className="py-10 text-center text-ink-400">No server backups yet</td></tr>}
                {list.map((f) => (
                  <tr key={f.name}><td className="px-2 py-1.5">{dateTime(f.created_at)}</td><td className="px-2 font-mono text-xs">{f.name}</td><td className="num px-2 text-right">{f.kb} KB</td>
                    <td className="px-2">{admin && <button type="button" title="Download" className="text-navy-800 dark:text-white" onClick={() => work('dl', () => api.download(`/admin/backup-files/${f.name}`, undefined, f.name))}><Upload className="size-4 rotate-180" /></button>}</td></tr>
                ))}
              </tbody>
            </table>
          </>)}
        </div>
      </div>
      <div className="card flex justify-end px-3 py-2"><Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button></div>
      <p className="px-1 text-xs text-ink-500">F2 = take backup now · Esc = exit</p>
    </div>
  );
}
