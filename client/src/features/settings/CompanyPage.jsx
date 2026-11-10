import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ImageCapture, PageHeader, Spinner } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { CompanyInfoList } from './CompanyInfoList';

const FIELDS = [
  { name: 'name', label: 'Company name (printed)', required: true, span: 2 }, { name: 'local_name', label: 'Name in Tamil (promissory note)' }, { name: 'proprietor', label: 'Proprietor' },
  { name: 'licence_no', label: 'Pawn broker licence no' }, { name: 'licence_valid_till', label: 'Licence valid till', type: 'date' }, { name: 'gstin', label: 'GSTIN' },
  { name: 'address1', label: 'Address line 1', span: 'full' }, { name: 'address2', label: 'Address line 2', span: 'full' }, { name: 'address3', label: 'Address line 3', span: 'full' },
  { name: 'mobile', label: 'Mobile numbers' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'website', label: 'Website' },
];

export function CompanyForm({ embedded }) {
  const { data, isLoading } = useCompany();
  const qc = useQueryClient();
  const form = useForm();
  useEffect(() => { if (data) form.reset(data); }, [data, form]);
  const save = useMutation({ mutationFn: (v) => api.put('/admin/company', v), onSuccess: () => { toast.success('Company saved'); qc.invalidateQueries({ queryKey: ['/admin/company'] }); }, onError: (e) => toast.error(e.message) });
  if (isLoading) return <Spinner />;
  return (
    <div className="animate-rise">
      {embedded ? <div className="mb-3 flex justify-end"><Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save (F2)</Button></div>
        : <PageHeader icon={Building} title="Company Information" subtitle="Printed on every bill, receipt and notice" actions={<Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save</Button>} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card><FormFields fields={FIELDS} form={form} cols={3} /></Card>
        <Card title="Logo"><ImageCapture label="Company logo" value={data?.logo_path} upload={async (f) => { const r = await api.upload('/admin/company/logo', f); qc.invalidateQueries({ queryKey: ['/admin/company'] }); return r.data.logo_path; }} /></Card>
      </div>
    </div>
  );
}

/** Company Information (desktop): company list with tiles; Edit Company opens the form, Receipt Header the bill content. */
export default function CompanyPage() {
  return <CompanyInfoList />;
}
