import { useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function BackupPage() {
  const [busy, setBusy] = useState(false);
  const { isAllBranches, currentBranch } = useAuth();
  const run = async () => {
    setBusy(true);
    try { await api.download('/admin/backup', undefined, `gold-finance-backup-${new Date().toISOString().slice(0, 10)}.json`); toast.success('Backup downloaded'); } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div className="animate-rise">
      <PageHeader icon={DatabaseBackup} title="Backup & Export" subtitle="Download a full JSON export of your data" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Download backup">
          <p className="mb-4 text-sm text-ink-600 dark:text-ink-300">Exports masters plus all transactions of <b>{isAllBranches ? 'all your branches' : currentBranch?.name}</b>. Keep it in a safe place.</p>
          <Button variant="gold" icon={Download} loading={busy} onClick={run}>Download now</Button>
        </Card>
        <Card title="Recommended: scheduled database backup">
          <p className="text-sm text-ink-600 dark:text-ink-300">For full point-in-time safety, schedule a nightly MySQL dump on the server (Windows Task Scheduler / cron):</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs text-gold-200">mysqldump -u root -p --single-transaction gold_finance &gt; backup.sql</pre>
        </Card>
      </div>
    </div>
  );
}
