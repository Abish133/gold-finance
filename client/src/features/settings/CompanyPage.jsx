import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ImageCapture, PageHeader, Spinner } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { useCompanyRaw } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { CompanyInfoList } from './CompanyInfoList';

const FIELDS = [
  { name: 'name', label: 'Company name (printed)', required: true, span: 2 }, { name: 'local_name', label: 'Name in Tamil (promissory note)' }, { name: 'proprietor', label: 'Proprietor' },
  { name: 'licence_no', label: 'Pawn broker licence no', hint: 'Default - each branch prints its own licence no' }, { name: 'licence_valid_till', label: 'Licence valid till', type: 'date' }, { name: 'gstin', label: 'GSTIN' },
  { name: 'address1', label: 'Address line 1', span: 'full' }, { name: 'address2', label: 'Address line 2', span: 'full' }, { name: 'address3', label: 'Address line 3', span: 'full' },
  { name: 'mobile', label: 'Mobile numbers' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'website', label: 'Website' },
];

export function CompanyForm({ embedded }) {
  const { data, isLoading } = useCompanyRaw();
  const qc = useQueryClient();
  const form = useForm();
  useEffect(() => { if (data) form.reset(data); }, [data, form]);
  const save = useMutation({ mutationFn: (v) => api.put('/admin/company', v), onSuccess: () => { toast.success('Company saved'); qc.invalidateQueries({ queryKey: ['/admin/company'] }); }, onError: (e) => toast.error(e.message) });
  if (isLoading) return <Spinner />;
  return (
    <div className={embedded ? 'dense flex w-full flex-col gap-2 lg:h-full' : 'animate-rise'}>
      {embedded ? <div className="flex shrink-0 items-center justify-between gap-2"><p className="text-[11px] text-ink-500">Printed on every bill, receipt and notice</p><Button variant="gold" className="h-8 text-[12px]" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save (F2)</Button></div>
        : <PageHeader icon={Building} title="Company Information" subtitle="Printed on every bill, receipt and notice" actions={<Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save</Button>} />}
      <div className={embedded ? 'grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_300px]' : 'grid gap-6 lg:grid-cols-[1fr_280px]'}>
        {embedded ? (
          <div className="overflow-y-auto rounded-md border border-ink-200 p-3 lg:min-h-0 dark:border-ink-800"><FormFields fields={FIELDS} form={form} cols={3} dense /></div>
        ) : <Card><FormFields fields={FIELDS} form={form} cols={3} /></Card>}
        {embedded ? (
          /* logo box stretches to the full height of the drawer */
          <div className="flex min-h-64 flex-col rounded-md border border-ink-200 p-3 lg:min-h-0 dark:border-ink-800">
            <ImageCapture label="Company logo" className="flex min-h-0 flex-1 flex-col" aspect="aspect-square lg:aspect-auto lg:flex-1" value={data?.logo_path} upload={async (f) => { const r = await api.upload('/admin/company/logo', f); qc.invalidateQueries({ queryKey: ['/admin/company'] }); return r.data.logo_path; }} />
          </div>
        ) : <Card title="Logo"><ImageCapture label="Company logo" value={data?.logo_path} upload={async (f) => { const r = await api.upload('/admin/company/logo', f); qc.invalidateQueries({ queryKey: ['/admin/company'] }); return r.data.logo_path; }} /></Card>}
      </div>
    </div>
  );
}

/** Company Information (desktop): company list with tiles; Edit Company opens the form, Receipt Header the bill content. */
export default function CompanyPage() {
  return <CompanyInfoList />;
}
