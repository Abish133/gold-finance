import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { UserPlus, AlertTriangle, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Drawer, ImageCapture } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useUtils';
import { useFetch } from '@/hooks/useApi';

export const ID_PROOFS = ['Aadhaar Card', 'PAN Card', 'Voter ID', 'Driving Licence', 'Passport', 'Ration Card', 'Other'];

/** Names are saved in Proper Case (desktop behaviour). */
const proper = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s.(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : v);
const PROPER = ['name', 'relation_name', 'street', 'area', 'city', 'district', 'nominee_name', 'occupation'];
const DEFAULTS = { title: 'Mr', relation_type: 'S/o', id_proof_type: 'Aadhaar Card', state: 'Tamil Nadu' };

const FIELDS = [
  { type: 'section', name: 's1', label: 'Personal' },
  { name: 'title', label: 'Title', type: 'select', options: ['Mr', 'Mrs', 'Ms', 'Dr'], placeholder: '' },
  { name: 'name', label: 'Customer name', required: true },
  { name: 'relation_type', label: 'Relation', type: 'select', options: ['S/o', 'D/o', 'W/o', 'C/o'], placeholder: '' },
  { name: 'relation_name', label: 'Father / Husband name', required: true },
  { name: 'phone', label: 'Mobile (10 digit)', type: 'tel', required: true, maxLength: 10, rules: { pattern: { value: /^[0-9]{10}$/, message: 'Enter a 10 digit mobile number' } } },
  { name: 'alt_phone', label: 'Alternate mobile', type: 'tel', maxLength: 10, rules: { pattern: { value: /^([0-9]{10})?$/, message: 'Enter a 10 digit mobile number' } } },
  { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
  { name: 'dob', label: 'Date of birth', type: 'date' },
  { name: 'occupation', label: 'Occupation' },
  { name: 'email', label: 'Email', type: 'email' },
  { type: 'section', name: 's2', label: 'Address' },
  { name: 'door_no', label: 'Door no' },
  { name: 'street', label: 'Street' },
  { name: 'area', label: 'Area / Village' },
  { name: 'city', label: 'City / Town' },
  { name: 'district', label: 'District' },
  { name: 'pincode', label: 'PIN code', maxLength: 6 },
  { type: 'section', name: 's3', label: 'KYC & Nominee' },
  { name: 'id_proof_type', label: 'ID proof', type: 'select', options: ID_PROOFS },
  { name: 'id_proof_no', label: 'ID number' },
  { name: 'nominee_name', label: 'Nominee name' },
  { name: 'nominee_relation', label: 'Nominee relation' },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 'full', rows: 2 },
];

const FILES = [
  ['photo', 'Customer photo'], ['signature', 'Signature'], ['doc_front', 'ID proof - front'], ['doc_back', 'ID proof - back'],
];

/** Create / edit customer. Photos captured before save are uploaded right after the record is created. */
export function CustomerFormDrawer({ open, onClose, customer, onSaved }) {
  const qc = useQueryClient();
  const form = useForm();
  const [pending, setPending] = useState({});   // files chosen before the customer exists
  const [images, setImages] = useState({});
  const phone = useDebounce(form.watch('phone'), 400);
  const [dupes, setDupes] = useState([]);
  const nextNo = useFetch(open && !customer?.id ? '/customers/next-no' : null);

  useEffect(() => {
    if (!open) return;
    form.reset(customer || DEFAULTS);
    setImages(Object.fromEntries(FILES.map(([k]) => [k, customer?.[k] || null])));
    setPending({});
    setDupes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  useEffect(() => {
    if (!open || !phone || phone.length < 8) return setDupes([]);
    api.get('/customers/check-phone', { phone, excludeId: customer?.id }).then((r) => setDupes(r.data)).catch(() => {});
  }, [phone, open, customer]);

  const save = useMutation({
    mutationFn: async (raw) => {
      const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, PROPER.includes(k) ? proper(v) : v]));
      const res = customer?.id ? await api.put(`/customers/${customer.id}`, values) : await api.post('/customers', values);
      const id = res.data.id;
      for (const [field, file] of Object.entries(pending)) await api.upload(`/customers/${id}/files/${field}`, file);
      return (await api.get(`/customers/${id}`)).data;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['/customers'] });
      toast.success(customer?.id ? 'Customer updated' : `Customer #${c.customer_no} created`);
      onSaved?.(c);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploader = (field) => async (file) => {
    if (customer?.id) {
      const r = await api.upload(`/customers/${customer.id}/files/${field}`, file);
      qc.invalidateQueries({ queryKey: ['/customers'] });
      return r.data[field];
    }
    setPending((p) => ({ ...p, [field]: file }));
    return URL.createObjectURL(file);
  };

  const submit = form.handleSubmit((v) => save.mutate(v));
  const clear = () => { form.reset(DEFAULTS); setImages({}); setPending({}); setDupes([]); };
  // Enter = next box, F2 = save, Ctrl+N = clear (desktop keys)
  const keys = (e) => {
    if (e.key === 'F2') { e.preventDefault(); e.stopPropagation(); submit(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); clear(); return; }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
      e.preventDefault();
      const list = [...e.currentTarget.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter((x) => !x.disabled && x.offsetParent);
      const i = list.indexOf(e.target);
      if (i >= 0 && i < list.length - 1) list[i + 1].focus(); else submit();
    }
  };
  const acNo = customer?.id ? customer.customer_no : nextNo.data?.customer_no;
  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={UserPlus}
      title={customer?.id ? `Edit Customer · A/c No ${customer.customer_no}` : 'New Customer'}
      subtitle={`${customer?.id ? 'Customer details, KYC and photos' : `New A/c No ${acNo ?? '-'}`} - fields with * are required`}
      footer={<>
        <p className="mr-auto text-xs text-ink-500">Enter = next box · names are saved in Proper Case</p>
        {!customer?.id && <Button variant="outline" icon={Eraser} onClick={clear}>Clear (Ctrl+N)</Button>}
        <Button variant="outline" onClick={onClose}>Cancel (Esc)</Button>
        <Button variant="gold" loading={save.isPending} onClick={submit}>Save Customer (F2)</Button>
      </>}>
      <form onSubmit={submit} onKeyDown={keys} className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          {acNo != null && <div className="mb-3 inline-block rounded-md bg-navy-50 px-5 py-1.5 text-sm font-bold text-navy-900 dark:bg-ink-800 dark:text-white">A/C NO {acNo}</div>}
          {dupes.length > 0 && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="size-5 shrink-0" />
              <div>This mobile is already used by: {dupes.map((d) => `#${d.customer_no} ${d.name}`).join(', ')}</div>
            </div>
          )}
          <FormFields fields={FIELDS} form={form} cols={3} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {FILES.map(([k, label]) => (
            <ImageCapture key={k} label={label} value={images[k]} aspect={k === 'photo' ? 'aspect-square' : 'aspect-[16/10]'}
              upload={uploader(k)} onChange={(v) => setImages((s) => ({ ...s, [k]: v }))} />
          ))}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
