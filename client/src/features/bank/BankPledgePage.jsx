import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Landmark, Plus, Unlock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ConfirmDrawer, DataTable, Drawer, Field, Input, KeyValue, PageHeader, Segmented, Select, Textarea, Badge } from '@/components/ui';
import { useList, useFetch, useLookups } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, today, grams, n, date } from '@/lib/format';

function NewPledgeDrawer({ open, onClose }) {
  const qc = useQueryClient();
  const { data: lk } = useLookups();
  const { data: loans = [] } = useFetch(open ? '/bank/pledges/available-loans' : null);
  const [sel, setSel] = useState([]);
  const [f, setF] = useState({ pledge_date: today(), received_mode: 'BANK' });
  const chosen = loans.filter((l) => sel.includes(l.id));
  const save = useMutation({
    mutationFn: () => api.post('/bank/pledges', { ...f, loan_ids: sel }),
    onSuccess: () => { toast.success('Bank pledge saved'); qc.invalidateQueries({ queryKey: ['/bank/pledges'] }); onClose(); setSel([]); },
    onError: (e) => toast.error(e.message),
  });
  const banks = (lk?.banks || []).filter((b) => b.used_for !== 'OPERATING').map((b) => ({ value: b.id, label: `${b.bank_name} ${b.account_no || ''}` }));
  return (
    <Drawer open={open} onClose={onClose} size="full" icon={Landmark} title="New bank pledge" subtitle="Re-pledge customer jewels with a bank to raise funds"
      footer={<><Button variant="soft-danger" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} disabled={!sel.length} onClick={() => save.mutate()}>Save pledge</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Field label="Bank" required><Select value={f.bank_account_id || ''} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })} placeholder="Select bank" options={banks} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank loan no" required><Input value={f.pledge_no || ''} onChange={(e) => setF({ ...f, pledge_no: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={f.pledge_date} onChange={(e) => setF({ ...f, pledge_date: e.target.value })} /></Field>
            <Field label="Amount" required><Input type="number" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Interest % / year"><Input type="number" value={f.interest_rate || ''} onChange={(e) => setF({ ...f, interest_rate: e.target.value, rate_monthly: e.target.value ? (Number(e.target.value) / 12).toFixed(3) : '' })} /></Field>
            <Field label="% / month"><Input type="number" value={f.rate_monthly || ''} onChange={(e) => setF({ ...f, rate_monthly: e.target.value, interest_rate: e.target.value ? (Number(e.target.value) * 12).toFixed(2) : '' })} /></Field>
            <Field label="Minimum days"><Input type="number" value={f.min_days || ''} onChange={(e) => setF({ ...f, min_days: e.target.value })} /></Field>
            <Field label="Bank charges"><Input type="number" value={f.charges || ''} onChange={(e) => setF({ ...f, charges: e.target.value })} /></Field>
          </div>
          <Field label="Cash received (amount - charges)"><Input readOnly className="bg-ink-50" value={((Number(f.amount) || 0) - (Number(f.charges) || 0)).toFixed(2)} /></Field>
          <Field label="Scan barcode / type loan no">
            <Input placeholder="Enter to add" onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const v = e.currentTarget.value.trim();
              const hit = loans.find((l) => l.bill_no === v || String(l.id) === v);
              if (!hit) toast.error('Loan not available for pledge'); else setSel((x) => (x.includes(hit.id) ? x : [...x, hit.id]));
              e.currentTarget.value = '';
            }} />
          </Field>
          <Field label="Amount received in"><Select value={f.received_mode} onChange={(e) => setF({ ...f, received_mode: e.target.value })} options={[{ value: 'BANK', label: 'Same bank account' }, { value: 'CASH', label: 'Cash' }]} /></Field>
          <Field label="Remarks"><Textarea value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
          <div className="rounded-2xl bg-ink-50 p-4 dark:bg-ink-800/50">
            <KeyValue items={[['Loans added', chosen.length], ['Weight', grams(chosen.reduce((s, l) => s + n(l.net_wt), 0))], ['Our loan amount', money(chosen.reduce((s, l) => s + n(l.current_principal), 0))], ['Bank amount', money(f.amount || 0)]]} />
          </div>
        </div>
        <DataTable dense selectable selected={sel} onSelect={setSel} rows={loans} columns={[
          { key: 'bill_no', label: 'Loan no' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' },
          { key: 'item_summary', label: 'Items' }, { key: 'net_wt', label: 'Net wt', type: 'weight' }, { key: 'current_principal', label: 'Loan', type: 'money' },
        ]} />
      </div>
    </Drawer>
  );
}

function PledgeDetail({ id, onClose }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [d, setD] = useState(today());
  const { data } = useFetch(id ? `/bank/pledges/${id}` : null, { date: d });
  const [f, setF] = useState({ mode: 'BANK' });
  const [del, setDel] = useState(false);
  const rel = useMutation({
    mutationFn: () => api.post(`/bank/pledges/${id}/release`, { ...f, date: d }),
    onSuccess: () => { toast.success('Released from bank'); qc.invalidateQueries({ queryKey: ['/bank/pledges'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Drawer open={!!id} onClose={onClose} size="lg" icon={Landmark} title={data ? `Bank loan ${data.pledge_no}` : 'Bank pledge'} subtitle={data && `${data.bank_name} · ${date(data.pledge_date)}`}
      footer={data?.status === 'OPEN' && (
        <>
          {can('bank_pledge', 'delete') && <Button variant="soft-danger" icon={Trash2} onClick={() => setDel(true)}>Delete</Button>}
          {can('bank_pledge', 'edit') && <Button variant="gold" icon={Unlock} loading={rel.isPending} onClick={() => rel.mutate()}>Release from bank</Button>}
        </>
      )}>
      {data && (
        <div className="space-y-5">
          <KeyValue cols={3} items={[['Amount', money(data.amount)], ['Rate', `${n(data.interest_rate)}%`], ['Status', data.status], ['Weight', grams(data.total_wt)], ['Days', data.calc.days], ['Interest', money(data.calc.interest)]]} />
          {data.status === 'OPEN' && (
            <div className="grid gap-3 rounded-2xl border border-ink-200 p-4 sm:grid-cols-4 dark:border-ink-700">
              <Field label="Release date"><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
              <Field label="Interest paid"><Input type="number" placeholder={String(data.calc.interest)} value={f.interest || ''} onChange={(e) => setF({ ...f, interest: e.target.value })} /></Field>
              <Field label="Charges"><Input type="number" value={f.charges || ''} onChange={(e) => setF({ ...f, charges: e.target.value })} /></Field>
              <Field label="Paid from"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[{ value: 'BANK', label: 'Bank' }, { value: 'CASH', label: 'Cash' }]} /></Field>
            </div>
          )}
          <DataTable dense rows={data.loans} columns={[{ key: 'bill_no', label: 'Loan' }, { key: 'customer_name', label: 'Customer' }, { key: 'net_wt', label: 'Net', type: 'weight' }, { key: 'current_principal', label: 'Loan', type: 'money' }, { key: 'status', label: 'Status', type: 'status' }]} />
        </div>
      )}
      <ConfirmDrawer open={del} onClose={() => setDel(false)} title="Delete bank pledge?" message="Loans will be marked as back in our vault and the accounting entry is reversed."
        onConfirm={async () => { try { await api.del(`/bank/pledges/${id}`); toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['/bank/pledges'] }); setDel(false); onClose(); } catch (e) { toast.error(e.message); } }} />
    </Drawer>
  );
}

export default function BankPledgePage() {
  const { can, isAllBranches } = useAuth();
  const [state, set] = useTableState({ status: new URLSearchParams(window.location.search).get('status') === 'all' ? '' : 'OPEN' });
  const list = useList('/bank/pledges', state);
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get('new') === '1');
  const [view, setView] = useState(null);
  return (
    <div className="animate-rise">
      <PageHeader icon={Landmark} title="Bank Re-pledge" subtitle="Track customer jewels pledged with banks and the bank interest"
        actions={can('bank_pledge', 'add') && !isAllBranches && <Button variant="gold" icon={Plus} onClick={() => setCreating(true)}>New bank pledge</Button>} />
      <div className="mb-4"><Segmented value={state.status} onChange={(v) => set({ status: v })} options={[{ value: 'OPEN', label: 'With bank' }, { value: 'CLOSED', label: 'Released' }, { value: '', label: 'All' }]} /></div>
      <DataTable rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })} onRowClick={(r) => setView(r.id)} columns={[
        { key: 'pledge_no', label: 'Bank loan no', render: (r) => <span className="font-semibold">{r.pledge_no}</span> },
        { key: 'pledge_date', label: 'Date', type: 'date' }, { key: 'bank_name', label: 'Bank' }, { key: 'loan_count', label: 'Loans', type: 'number' },
        { key: 'total_wt', label: 'Weight', type: 'weight' }, { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'interest', label: 'Interest till today', type: 'money' }, { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'OPEN' ? 'violet' : 'gray'}>{r.status}</Badge> },
      ]} />
      <NewPledgeDrawer open={creating} onClose={() => setCreating(false)} />
      <PledgeDetail id={view} onClose={() => setView(null)} />
    </div>
  );
}
