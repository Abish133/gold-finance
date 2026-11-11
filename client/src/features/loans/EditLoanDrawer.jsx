import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Drawer, Field, ImageCapture, Input, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { n } from '@/lib/format';

/** Edit Pledged Record: jewels, photo, remarks, due date; amount/rate only before any receipt. */
export function EditLoanDrawer({ open, onClose, full, onSaved }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({});
  const finLocked = full.transactions.filter((t) => !t.is_void).length > 1;

  useEffect(() => {
    if (!open) return;
    setItems(full.items.map((i) => ({ ...i })));
    setF({ remarks: full.loan.remarks || '', manual_bill_no: full.loan.manual_bill_no || '', due_date: full.loan.due_date, item_photo: full.loan.item_photo,
      principal: full.loan.principal, interest_rate: full.loan.interest_rate });
  }, [open, full]);

  const upd = (idx, patch) => setItems((l) => l.map((x, i) => (i === idx ? { ...x, ...patch, net_wt: undefined } : x)));
  const save = useMutation({
    mutationFn: () => api.put(`/loans/${full.loan.id}`, {
      ...f, items: items.map((i) => ({ ...i, net_wt: i.net_wt ?? Math.max(0, n(i.gross_wt) - n(i.stone_wt)) })),
      ...(finLocked ? { principal: undefined, interest_rate: undefined } : {}),
    }),
    onSuccess: () => { toast.success('Loan updated'); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Drawer open={open} onClose={onClose} size="lg" icon={Pencil} title={`Edit loan #${full.loan.bill_no}`} subtitle="Changes are recorded in the audit trail" bodyClassName="flex !px-4 !py-3 sm:!overflow-hidden"
      footer={<><Button variant="soft-danger" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <div className="dense flex min-h-0 w-full flex-col gap-3">
        <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Loan amount" hint={finLocked ? undefined : 'Accounting entry will be re-posted'}><Input type="number" disabled={finLocked} value={f.principal ?? ''} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
          <Field label="Interest %"><Input type="number" disabled={finLocked} value={f.interest_rate ?? ''} onChange={(e) => setF({ ...f, interest_rate: e.target.value })} /></Field>
          <Field label="Due date"><Input type="date" value={f.due_date || ''} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          <Field label="Manual bill no"><Input value={f.manual_bill_no || ''} onChange={(e) => setF({ ...f, manual_bill_no: e.target.value })} /></Field>
        </div>
        {finLocked && <p className="-mt-1 shrink-0 text-[11px] text-ink-400">Loan amount and interest are locked - receipts exist on this loan.</p>}
        <div className="flex max-h-[40%] shrink-0 flex-col">
          <div className="mb-1 flex items-center justify-between"><span className="label mb-0">Jewels · {items.length}</span>
            <Button size="sm" variant="soft" className="h-7" icon={Plus} onClick={() => setItems((l) => [...l, { item_name: '', pcs: 1, gross_wt: '', stone_wt: '', purity: 91.6 }])}>Add</Button></div>
          <div className="grid grid-cols-[1fr_56px_88px_88px_72px_32px] gap-1.5 px-0.5 pb-0.5 text-[10px] font-semibold tracking-wider text-ink-400 uppercase">
            <span>Item</span><span>Pcs</span><span>Gross g</span><span>Less g</span><span>Purity</span><span />
          </div>
          <div className="min-h-0 space-y-1.5 overflow-y-auto">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_56px_88px_88px_72px_32px] gap-1.5">
                <Input value={it.item_name} onChange={(e) => upd(i, { item_name: e.target.value })} placeholder="Item" />
                <Input type="number" value={it.pcs} onChange={(e) => upd(i, { pcs: e.target.value })} />
                <Input type="number" step="0.001" value={it.gross_wt} onChange={(e) => upd(i, { gross_wt: e.target.value })} placeholder="Gross" />
                <Input type="number" step="0.001" value={it.stone_wt} onChange={(e) => upd(i, { stone_wt: e.target.value })} placeholder="Stone" />
                <Input type="number" step="0.1" value={it.purity} onChange={(e) => upd(i, { purity: e.target.value })} />
                <Button size="icon" variant="ghost" className="size-9" title="Remove jewel" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, x) => x !== i))}><Trash2 className="size-4 text-rose-500" /></Button>
              </div>
            ))}
          </div>
        </div>
        <ImageCapture label="Jewel photo" className="flex min-h-32 flex-1 flex-col" aspect="aspect-[16/9] sm:aspect-auto sm:flex-1" value={f.item_photo} onChange={(v) => setF({ ...f, item_photo: v })}
          upload={async (file) => (await api.upload('/loans/upload/temp', file)).data.path} />
        <Field label="Remarks" className="shrink-0"><Textarea rows={1} value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
