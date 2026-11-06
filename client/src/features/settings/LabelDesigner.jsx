import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { Stickers, STICKER_FIELDS, DEFAULT_STICKER_FIELDS } from '@/features/print/Sticker';

const KEYS = ['STICKER_WIDTH_MM', 'STICKER_HEIGHT_MM', 'STICKER_COLUMNS', 'STICKER_GAP_MM', 'STICKER_FIELDS'];
const SAMPLE = [1, 2, 3].map((i) => ({ id: i, bill_no: 100 + i, barcode: `GL${100 + i}`, customer_name: 'SAMPLE CUSTOMER', customer_phone: '9876543210', loan_date: new Date(), due_date: new Date(Date.now() + 365 * 864e5), net_wt: 12.345, total_pcs: 2, principal: 45000, item_summary: 'Chain x1, Ring x1' }));

/** Label / sticker designer: size, sheet columns, gap and which fields print. */
export default function LabelDesigner() {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const { data } = useFetch('/admin/settings', { scope: 'global' });
  const [v, setV] = useState({});
  useEffect(() => { if (data) setV(Object.fromEntries(KEYS.map((k) => [k, data[k] ?? '']))); }, [data]);
  const fields = new Set(String(v.STICKER_FIELDS || DEFAULT_STICKER_FIELDS).split(',').filter(Boolean));
  const toggle = (k) => { const s = new Set(fields); s.has(k) ? s.delete(k) : s.add(k); setV({ ...v, STICKER_FIELDS: STICKER_FIELDS.map(([x]) => x).filter((x) => s.has(x)).join(',') }); };
  const save = async () => {
    try { await api.put('/admin/settings?scope=global', Object.fromEntries(Object.entries(v).filter(([k]) => k in (data || {})))); toast.success('Label design saved'); qc.invalidateQueries({ queryKey: ['/admin/settings'] }); } catch (e) { toast.error(e.message); }
  };
  const test = () => printElement(<Stickers loans={SAMPLE} settings={v} company={company} />, { title: 'Sticker test' });
  return (
    <div className="grid items-start gap-3 xl:grid-cols-[380px_1fr]">
      <div className="card space-y-3 p-4">
        <p className="text-xs font-bold text-ink-600 uppercase">Size & sheet</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (mm)"><Input type="number" value={v.STICKER_WIDTH_MM || ''} onChange={(e) => setV({ ...v, STICKER_WIDTH_MM: e.target.value })} /></Field>
          <Field label="Height (mm)"><Input type="number" value={v.STICKER_HEIGHT_MM || ''} onChange={(e) => setV({ ...v, STICKER_HEIGHT_MM: e.target.value })} /></Field>
          <Field label="Labels per row"><Input type="number" min="1" value={v.STICKER_COLUMNS || ''} onChange={(e) => setV({ ...v, STICKER_COLUMNS: e.target.value })} /></Field>
          <Field label="Gap (mm)"><Input type="number" min="0" value={v.STICKER_GAP_MM || ''} onChange={(e) => setV({ ...v, STICKER_GAP_MM: e.target.value })} /></Field>
        </div>
        <p className="pt-2 text-xs font-bold text-ink-600 uppercase">Print on label</p>
        <div className="grid grid-cols-2 gap-2">{STICKER_FIELDS.map(([k, l]) => <Checkbox key={k} checked={fields.has(k)} onChange={() => toggle(k)} label={l} />)}</div>
        <div className="grid grid-cols-2 gap-2 pt-2"><Button variant="outline" icon={Printer} onClick={test}>Test print</Button><Button icon={Save} onClick={save}>Save</Button></div>
      </div>
      <div className="card overflow-auto p-4">
        <p className="mb-3 text-xs font-bold text-ink-600 uppercase">Preview</p>
        <div className="inline-block bg-white p-3"><Stickers loans={SAMPLE} settings={v} company={company} /></div>
      </div>
    </div>
  );
}
