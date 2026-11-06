import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Trash, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const KEPT = ['Company details and logo', 'Branches, users, passwords and rights', 'Items, metals, purity and rates', 'Schemes and System Control settings', 'Printer, receipt and sticker designs',
  'Account heads (capital entry made again)', 'Bank accounts, employees, SMS settings', 'Customers without any loan'];

/** Start Fresh (desktop: Start fresh - remove practice entries) - used once before the shop starts real work. */
export default function StartFreshPage() {
  const navigate = useNavigate();
  const { user, currentBranch, isAllBranches } = useAuth();
  const qc = useQueryClient();
  const preview = useFetch(isAllBranches ? null : '/tools/start-fresh-preview');
  const blank = { confirm: '', password: '', customers: true, next_loan_no: '1', start_date: today() };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const ready = f.confirm === 'START FRESH' && !!f.password;
  const run = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      // a full backup is taken first
      await api.download('/admin/backup', { type: 'Start Fresh' }, `gold-finance-before-start-fresh-${today()}.json`);
      await api.post('/tools/start-fresh', f);
      toast.success('Practice entries removed - the shop can start real work');
      qc.clear(); setF(blank); preview.refetch();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  useKeys({ escape: () => navigate('/') }, []);
  if (isAllBranches) return <div className="card p-6 text-sm">Select one branch first.</div>;
  const rows = preview.data?.rows || [];
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Start Fresh - remove practice entries</h1><p className="text-sm text-navy-100">{currentBranch?.name}</p></section>
      <div className="card space-y-4 p-4">
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-rose-700">Use this once, before the shop starts real work. All entries below are removed for ever (a full backup is taken first).</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-ink-300 p-4 text-sm dark:border-ink-700">
            <p className="mb-2 text-xs font-bold text-rose-700 uppercase">Will be removed</p>
            {rows.map((r) => <div key={r.label} className="flex justify-between py-0.5"><span>{r.label}</span><b className="num">{r.count}</b></div>)}
          </div>
          <div className="rounded-md border border-ink-300 p-4 text-sm dark:border-ink-700">
            <p className="mb-2 text-xs font-bold text-emerald-700 uppercase">Will be kept</p>
            {KEPT.map((k) => <p key={k} className="py-0.5">- {k}</p>)}
          </div>
        </div>
        {!user.is_super_admin ? <p className="text-sm">Only the super admin can do this.</p> : (
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Field label="Next loan no."><Input type="number" min={1} value={f.next_loan_no} onChange={(e) => setF({ ...f, next_loan_no: e.target.value })} /></Field>
            <Field label="Start date (billing date)"><Input type="date" max={today()} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Checkbox checked={f.customers} onChange={(v) => setF({ ...f, customers: v })} label="Also remove customers who had practice loans" /></div>
            <Field label="Type START FRESH to confirm"><Input value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value.toUpperCase() })} /></Field>
            <Field label="Your password"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          </div>
        )}
      </div>
      <div className="card flex justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={X} onClick={() => navigate('/')}>Cancel (Esc)</Button>
        {user.is_super_admin && <Button variant="danger" icon={Trash} disabled={!ready} loading={busy} onClick={run}>Remove practice entries</Button>}
      </div>
    </div>
  );
}
