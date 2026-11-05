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
    <Drawer open={open} onClose={onClose} size="lg" icon={Pencil} title={`Edit loan #${full.loan.bill_no}`} subtitle="Changes are recorded in the audit trail"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Loan amount" hint={finLocked ? 'Locked - receipts exist' : 'Accounting entry will be re-posted'}><Input type="number" disabled={finLocked} value={f.principal ?? ''} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
          <Field label="Interest %"><Input type="number" disabled={finLocked} value={f.interest_rate ?? ''} onChange={(e) => setF({ ...f, interest_rate: e.target.value })} /></Field>
          <Field label="Due date"><Input type="date" value={f.due_date || ''} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          <Field label="Manual bill no"><Input value={f.manual_bill_no || ''} onChange={(e) => setF({ ...f, manual_bill_no: e.target.value })} /></Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="label mb-0">Jewels</span>
            <Button size="sm" variant="soft" icon={Plus} onClick={() => setItems((l) => [...l, { item_name: '', pcs: 1, gross_wt: '', stone_wt: '', purity: 91.6 }])}>Add</Button></div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_90px_90px_80px_36px] gap-2">
                <Input value={it.item_name} onChange={(e) => upd(i, { item_name: e.target.value })} placeholder="Item" />
                <Input type="number" value={it.pcs} onChange={(e) => upd(i, { pcs: e.target.value })} />
                <Input type="number" step="0.001" value={it.gross_wt} onChange={(e) => upd(i, { gross_wt: e.target.value })} placeholder="Gross" />
                <Input type="number" step="0.001" value={it.stone_wt} onChange={(e) => upd(i, { stone_wt: e.target.value })} placeholder="Stone" />
                <Input type="number" step="0.1" value={it.purity} onChange={(e) => upd(i, { purity: e.target.value })} />
                <Button size="icon" variant="ghost" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, x) => x !== i))}><Trash2 className="size-4 text-rose-500" /></Button>
              </div>
            ))}
          </div>
        </div>
        <ImageCapture label="Jewel photo" aspect="aspect-[16/9]" value={f.item_photo} onChange={(v) => setF({ ...f, item_photo: v })}
          upload={async (file) => (await api.upload('/loans/upload/temp', file)).data.path} />
        <Field label="Remarks"><Textarea value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
