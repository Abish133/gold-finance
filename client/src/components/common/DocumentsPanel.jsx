import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, Trash2, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Input, Select } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { date } from '@/lib/format';

const TYPES = {
  customer: ['Aadhaar', 'PAN', 'Voter ID', 'Driving licence', 'Ration card', 'Passport', 'Address proof', 'Photo', 'Agreement', 'Other'],
  employee: ['Aadhaar', 'PAN', 'Resume', 'Offer letter', 'Bank passbook', 'Certificate', 'Photo', 'Relieving letter', 'Other'],
  loan: ['Bill copy', 'Valuation', 'Notice copy', 'Postal receipt', 'Other'],
};
const isImage = (p) => /\.(png|jpe?g|webp|gif)$/i.test(p || '');

/** Any number of documents for a customer / employee / loan (upload, view, delete). */
export function DocumentsPanel({ owner, id, canEdit = true }) {
  const qc = useQueryClient();
  const key = `/desk/documents/${owner}/${id}`;
  const { data = [], isLoading } = useFetch(id ? key : null);
  const [form, setForm] = useState({ doc_type: TYPES[owner][0], remarks: '' });
  const [busy, setBusy] = useState(false);
  const file = useRef(null);

  const upload = async (f) => {
    if (!f) return;
    setBusy(true);
    try { await api.upload(key, f, form); toast.success('Document uploaded'); setForm({ ...form, remarks: '' }); qc.invalidateQueries({ queryKey: [key] }); } catch (e) { toast.error(e.message); }
    setBusy(false);
    if (file.current) file.current.value = '';
  };
  const remove = async (d) => {
    try { await api.del(`/desk/documents/${d.id}`); qc.invalidateQueries({ queryKey: [key] }); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-ink-200 p-3">
          <Field label="Document type"><Select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} options={TYPES[owner]} /></Field>
          <Field label="Remarks" className="min-w-48 flex-1"><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
          <input ref={file} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button icon={FileUp} loading={busy} onClick={() => file.current?.click()}>Upload</Button>
        </div>
      )}
      {!isLoading && !data.length && <p className="text-sm text-ink-500">No documents yet.</p>}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {data.map((d) => (
          <div key={d.id} className="overflow-hidden rounded-md border border-ink-200">
            <a href={d.file_path} target="_blank" rel="noreferrer" className="block bg-ink-50">
              {isImage(d.file_path) ? <img src={d.file_path} alt={d.doc_type} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center"><FileText className="size-10 text-ink-400" /></div>}
            </a>
            <div className="flex items-start gap-2 p-2 text-xs">
              <div className="min-w-0 flex-1"><p className="font-bold">{d.doc_type}</p><p className="truncate text-ink-500">{d.remarks || '—'}</p><p className="text-ink-400">{date(d.created_at)} · {d.by_name || ''}</p></div>
              <a href={d.file_path} target="_blank" rel="noreferrer" className="p-1 text-ink-500 hover:text-ink-900"><ExternalLink className="size-4" /></a>
              {canEdit && <button type="button" onClick={() => remove(d)} className="p-1 text-rose-600 hover:text-rose-800"><Trash2 className="size-4" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
