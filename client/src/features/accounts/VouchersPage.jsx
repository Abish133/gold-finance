import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ConfirmDrawer, DataTable, Drawer, Field, Input, PageHeader, Segmented, Select, Textarea } from '@/components/ui';
import { useList, useLookups } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, today, monthStart, n, round2 } from '@/lib/format';
import { LedgerSelect, DateRange } from './shared';

function VoucherDrawer({ open, onClose }) {
  const qc = useQueryClient();
  const { data: lk } = useLookups();
  const [f, setF] = useState({ voucher_type: 'PAYMENT', date: today(), mode: 'CASH', lines: [{ debit: '', credit: '' }, { debit: '', credit: '' }] });
  const journal = f.voucher_type === 'JOURNAL' || f.voucher_type === 'CONTRA';
  const dr = round2(f.lines.reduce((s, l) => s + n(l.debit), 0));
  const cr = round2(f.lines.reduce((s, l) => s + n(l.credit), 0));
  const save = useMutation({
    mutationFn: () => api.post('/accounts/vouchers', f),
    onSuccess: () => { toast.success('Voucher saved'); qc.invalidateQueries({ queryKey: ['/accounts/vouchers'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const setLine = (i, p) => setF({ ...f, lines: f.lines.map((l, x) => (x === i ? { ...l, ...p } : l)) });
  return (
    <Drawer open={open} onClose={onClose} icon={Receipt} title="New voucher" size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} disabled={journal && (dr !== cr || !dr)} onClick={() => save.mutate()}>Save voucher</Button></>}>
      <div className="space-y-4">
        <Segmented value={f.voucher_type} onChange={(v) => setF({ ...f, voucher_type: v })} options={[{ value: 'PAYMENT', label: 'Payment' }, { value: 'RECEIPT', label: 'Receipt' }, { value: 'JOURNAL', label: 'Journal' }, { value: 'CONTRA', label: 'Contra' }]} />
        <Field label="Date"><Input type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        {!journal ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.voucher_type === 'PAYMENT' ? 'Paid to (expense / account)' : 'Received from (income / account)'} className="sm:col-span-2"><LedgerSelect value={f.ledger_id} onChange={(v) => setF({ ...f, ledger_id: v })} filter={(l) => l.system_key !== 'CASH'} /></Field>
            <Field label="Amount"><Input type="number" prefix="₹" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Mode"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[{ value: 'CASH', label: 'Cash' }, { value: 'BANK', label: 'Bank' }]} /></Field>
            {f.mode === 'BANK' && <Field label="Bank" className="sm:col-span-2"><LedgerSelect value={f.bank_ledger_id} onChange={(v) => setF({ ...f, bank_ledger_id: v })} filter={(l) => l.group_name === 'Bank Accounts'} placeholder={lk?.banks?.length ? 'Select bank' : 'Add a bank account first'} /></Field>}
          </div>
        ) : (
          <div className="space-y-2">
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_120px_36px] gap-2">
                <LedgerSelect value={l.ledger_id} onChange={(v) => setLine(i, { ledger_id: v })} />
                <Input type="number" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} />
                <Input type="number" placeholder="Credit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} />
                <Button size="icon" variant="ghost" disabled={f.lines.length <= 2} onClick={() => setF({ ...f, lines: f.lines.filter((_, x) => x !== i) })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="soft" icon={Plus} onClick={() => setF({ ...f, lines: [...f.lines, { debit: '', credit: '' }] })}>Add line</Button>
              <span className={`num text-sm font-semibold ${dr === cr ? 'text-emerald-600' : 'text-rose-600'}`}>Dr {money(dr)} · Cr {money(cr)}</span>
            </div>
          </div>
        )}
        <Field label="Narration"><Textarea value={f.narration || ''} onChange={(e) => setF({ ...f, narration: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

export default function VouchersPage() {
  const { can, isAllBranches } = useAuth();
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [state, set] = useTableState({ manual: '1' });
  const list = useList('/accounts/vouchers', { ...state, ...range });
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const qc = useQueryClient();
  return (
    <div className="animate-rise">
      <PageHeader icon={Receipt} title="Voucher Entry" subtitle="Expenses, other income, bank transfers and journals"
        actions={can('acc_voucher', 'add') && !isAllBranches && <Button variant="gold" icon={Plus} onClick={() => setOpen(true)}>New voucher</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <DateRange value={range} onChange={setRange} />
        <Segmented value={state.manual} onChange={(v) => set({ manual: v })} options={[{ value: '1', label: 'Manual' }, { value: '', label: 'All incl. system' }]} />
      </div>
      <DataTable rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })} columns={[
        { key: 'voucher_date', label: 'Date', type: 'date' }, { key: 'voucher_no', label: 'No' }, { key: 'voucher_type', label: 'Type' },
        { key: 'narration', label: 'Narration' }, { key: 'lines_text', label: 'Entries', className: 'max-w-md text-xs text-ink-500' },
        { key: 'amount', label: 'Amount', type: 'money' }, { key: 'created_by_name', label: 'By' },
        { key: 'x', label: '', align: 'right', render: (r) => !r.source_type && can('acc_voucher', 'delete') && <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="size-4 text-rose-500" /></Button> },
      ]} />
      <VoucherDrawer open={open} onClose={() => setOpen(false)} />
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} title={`Delete voucher ${del?.voucher_no}?`}
        onConfirm={async () => { try { await api.del(`/accounts/vouchers/${del.id}`); toast.success('Voucher deleted'); qc.invalidateQueries({ queryKey: ['/accounts/vouchers'] }); setDel(null); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
