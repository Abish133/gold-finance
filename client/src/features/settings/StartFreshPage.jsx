import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Checkbox, Field, Input, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

/** Start Fresh (desktop: frmStartFresh) - remove practice entries of the selected branch. */
export default function StartFreshPage() {
  const { user, currentBranch, isAllBranches } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ confirm: '', password: '', customers: false });
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await api.post('/tools/start-fresh', f); toast.success('Practice entries removed'); qc.clear(); setF({ confirm: '', password: '', customers: false }); } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (isAllBranches) return <Card><p className="text-sm">Select one branch first.</p></Card>;
  return (
    <div className="animate-rise space-y-4">
      <PageHeader icon={Trash} title="Start Fresh" subtitle="Remove practice / trial entries before going live" />
      <Card>
        <div className="flex gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="size-6 shrink-0" />
          <div>
            <p className="font-bold">This permanently deletes all loans, receipts, vouchers, bank pledges, auctions, attendance, salary and day closes of <u>{currentBranch?.name}</u>.</p>
            <p className="mt-1">Masters (company, schemes, items, rates, users, ledgers) are kept. Take a backup first.</p>
          </div>
        </div>
        {!user.is_super_admin ? <p className="mt-4 text-sm">Only the super admin can do this.</p> : (
          <div className="mt-4 grid max-w-md gap-3">
            <Checkbox checked={f.customers} onChange={(v) => setF({ ...f, customers: v })} label="Also delete customers of this branch" />
            <Field label='Type "START FRESH" to confirm'><Input value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
            <Field label="Your password"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <Button variant="danger" icon={Trash} disabled={f.confirm !== 'START FRESH' || !f.password} loading={busy} onClick={run}>Remove practice entries</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
