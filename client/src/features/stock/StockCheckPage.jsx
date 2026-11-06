import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ScanLine, CheckCircle2, XCircle, Undo2, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, DataTable, Drawer, Field, Input, PageHeader, Segmented, Stat, Textarea } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { today, grams, compact, n } from '@/lib/format';

/** Physical vault verification by scanning packet barcodes. */
export default function StockCheckPage() {
  const { isAllBranches } = useAuth();
  const [d, setD] = useState(today());
  const [code, setCode] = useState('');
  const [view, setView] = useState('pending');
  const qc = useQueryClient();
  const input = useRef(null);
  const { data = [], isLoading } = useFetch(isAllBranches ? null : '/auction/stock-check', { date: d });
  const checked = data.filter((r) => r.checked_at);
  const pending = data.filter((r) => !r.checked_at);
  const notes = useFetch(isAllBranches ? null : '/desk/stock-notes');
  const noteOf = (id) => (notes.data || []).find((x) => x.loan_id === id && String(x.check_date).slice(0, 10) === d);
  const [note, setNote] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['/auction/stock-check'] }); qc.invalidateQueries({ queryKey: ['/desk/stock-notes'] }); };
  const saveNote = async () => {
    try { await api.put(`/desk/stock-note/${note.id}`, { date: d, remarks: note.remarks }); toast.success('Correction note saved'); setNote(null); refresh(); } catch (err) { toast.error(err.message); }
  };

  const scan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      const r = await api.post('/auction/stock-check', { date: d, code: code.trim() });
      toast.success(`#${r.data.bill_no} verified`);
      refresh();
    } catch (err) { toast.error(err.message); }
    setCode('');
    input.current?.focus();
  };

  if (isAllBranches) return <Card><p className="text-sm">Select a branch to do stock check.</p></Card>;

  return (
    <div className="animate-rise">
      <PageHeader icon={ScanLine} title="Stock Check" subtitle="Scan each packet; anything not scanned is highlighted" actions={<Input type="date" className="w-44" value={d} onChange={(e) => setD(e.target.value)} />} />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Packets in stock" value={data.length} />
        <Stat label="Verified" value={checked.length} tone="green" icon={CheckCircle2} />
        <Stat label="Not verified" value={pending.length} tone="red" icon={XCircle} />
        <Stat label="Gold in stock" value={grams(data.reduce((s, r) => s + n(r.net_wt), 0))} hint={compact(data.reduce((s, r) => s + n(r.current_principal), 0))} />
      </div>
      <form onSubmit={scan} className="mb-5 flex gap-2">
        <Input ref={input} autoFocus className="h-12 max-w-md text-base" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan barcode or type loan no and press Enter" />
        <Button type="submit" size="lg" variant="gold">Verify</Button>
      </form>
      <div className="mb-3"><Segmented value={view} onChange={setView} options={[{ value: 'pending', label: `Not verified (${pending.length})` }, { value: 'checked', label: `Verified (${checked.length})` }, { value: 'notes', label: `Correction notes (${notes.data?.length || 0})` }]} /></div>
      {view === 'notes' ? <DataTable dense loading={notes.isLoading} rows={notes.data || []} columns={[
        { key: 'check_date', label: 'Date', type: 'date' }, { key: 'bill_no', label: 'Loan', render: (r) => <b>#{r.bill_no}</b> }, { key: 'customer_name', label: 'Customer' },
        { key: 'remarks', label: 'Correction / remark' }, { key: 'checked_by_name', label: 'By' }, { key: 'status', label: 'Loan status' },
      ]} /> : <DataTable dense loading={isLoading} rows={view === 'pending' ? pending : checked} columns={[
        { key: 'bill_no', label: 'Loan no', render: (r) => <span className="font-semibold">#{r.bill_no}</span> },
        { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' },
        { key: 'net_wt', label: 'Net wt', type: 'weight' },
        { key: 'bank', label: '', render: (r) => r.bank_pledge_id && <Badge tone="violet">In bank</Badge> },
        { key: 'checked_by_name', label: 'Checked by' },
        { key: 'note', label: 'Correction', render: (r) => <span className="text-xs text-amber-700">{noteOf(r.id)?.remarks || ''}</span> },
        { key: 'u', label: '', align: 'right', render: (r) => (
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" title="Correction note" onClick={() => setNote({ id: r.id, bill_no: r.bill_no, remarks: noteOf(r.id)?.remarks || '' })}><StickyNote className="size-4" /></Button>
            {r.checked_at && <Button size="icon" variant="ghost" onClick={async () => { await api.del(`/auction/stock-check/${r.id}?date=${d}`); refresh(); }}><Undo2 className="size-4" /></Button>}
          </div>
        ) },
      ]} />}
      <Drawer open={!!note} onClose={() => setNote(null)} title={`Correction note · Loan #${note?.bill_no}`} icon={StickyNote} size="sm"
        footer={<Button variant="gold" onClick={saveNote}>Save note</Button>}>
        {note && <Field label="What was found / corrected" hint="e.g. seal broken - repacked, item count differs, weight re-checked">
          <Textarea rows={4} value={note.remarks} onChange={(e) => setNote({ ...note, remarks: e.target.value })} /></Field>}
      </Drawer>
    </div>
  );
}
