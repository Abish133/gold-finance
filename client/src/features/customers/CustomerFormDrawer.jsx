import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Drawer, ImageCapture } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useUtils';

export const ID_PROOFS = ['Aadhaar', 'PAN', 'Voter ID', 'Driving Licence', 'Passport', 'Ration Card', 'Other'];

const FIELDS = [
  { type: 'section', name: 's1', label: 'Personal' },
  { name: 'title', label: 'Title', type: 'select', options: ['Mr', 'Mrs', 'Ms', 'Dr'], placeholder: '' },
  { name: 'name', label: 'Full name', required: true },
  { name: 'relation_type', label: 'Relation', type: 'select', options: ['S/o', 'D/o', 'W/o', 'C/o'], placeholder: '' },
  { name: 'relation_name', label: 'Relation name' },
  { name: 'phone', label: 'Mobile', type: 'tel', required: true, maxLength: 15, rules: { pattern: { value: /^[0-9+ -]{6,15}$/, message: 'Invalid number' } } },
  { name: 'alt_phone', label: 'Alternate mobile', type: 'tel', maxLength: 15 },
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

  useEffect(() => {
    if (!open) return;
    form.reset(customer || { title: 'Mr', state: 'Tamil Nadu' });
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
    mutationFn: async (values) => {
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

  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={UserPlus}
      title={customer?.id ? `Edit customer #${customer.customer_no}` : 'New customer'}
      subtitle="Customer details, KYC and photos"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save customer</Button></>}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
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
