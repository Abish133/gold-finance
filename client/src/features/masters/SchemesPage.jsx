import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge, Button, Input } from '@/components/ui';

const parse = (s) => (typeof s === 'string' ? JSON.parse(s || '[]') : s) || [];

/** Interest slab editor (e.g. ≤3m 15%, ≤6m 18%, ≤12m 20%, above 24%). */
function SlabEditor({ form }) {
  const slabs = form.watch('slabs') || [];
  const set = (v) => form.setValue('slabs', v, { shouldDirty: true });
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Interest slabs</span>
        <Button size="sm" variant="soft" icon={Plus} onClick={() => set([...slabs, { upto_months: '', rate: '' }])}>Add slab</Button>
      </div>
      <div className="space-y-2">
        {slabs.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
            <Input type="number" placeholder="Up to months (blank = above)" value={s.upto_months ?? ''} onChange={(e) => set(slabs.map((x, j) => (j === i ? { ...x, upto_months: e.target.value } : x)))} suffix="months" />
            <Input type="number" step="0.01" placeholder="Rate" value={s.rate} onChange={(e) => set(slabs.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} suffix="%" />
            <Button size="icon" variant="ghost" onClick={() => set(slabs.filter((_, j) => j !== i))}><Trash2 className="size-4 text-rose-500" /></Button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-400">Leave “months” blank on the last slab for “above”. Slab mode “From loan date” applies the reached slab to the whole period (as printed on the receipt).</p>
    </div>
  );
}

export default function SchemesPage() {
  return (
    <ResourcePage
      title="Loan Schemes" singular="Scheme" endpoint="/masters/schemes" screen="m_schemes" icon={ListChecks} drawerSize="lg" cols={3}
      subtitle="LTV, interest slabs, minimum days, tenure, charges"
      defaults={{ ltv_percent: 75, rate_type: 'YEARLY', calc_mode: 'DAYS', slab_mode: 'FROM_LOAN_DATE', min_days: 7, tenure_months: 12, is_active: 1,
        slabs: [{ upto_months: 3, rate: 15 }, { upto_months: 6, rate: 18 }, { upto_months: 12, rate: 20 }, { upto_months: '', rate: 24 }] }}
      fromRecord={(r) => ({ ...r, slabs: parse(r.slabs) })}
      toPayload={(v) => ({ ...v, slabs: (v.slabs || []).filter((s) => s.rate !== '').map((s) => ({ upto_months: s.upto_months === '' || s.upto_months == null ? null : Number(s.upto_months), rate: Number(s.rate) })) })}
      columns={[
        { key: 'code', label: 'Code', sortable: true, render: (r) => <span className="font-bold">{r.code}</span> },
        { key: 'name', label: 'Name', sortable: true }, { key: 'metal_name', label: 'Metal' }, { key: 'ltv_percent', label: 'LTV %', type: 'number' },
        { key: 'slabs', label: 'Slabs', render: (r) => <div className="flex flex-wrap gap-1">{parse(r.slabs).map((s, i) => <Badge key={i} tone="blue">{s.upto_months ? `≤${s.upto_months}m` : '>'} {s.rate}%</Badge>)}</div> },
        { key: 'branch_name', label: 'Branch', render: (r) => r.branch_name || 'All' },
        { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>) },
      ]}
      fields={[
        { name: 'code', label: 'Scheme code', required: true }, { name: 'name', label: 'Scheme name', required: true },
        { name: 'metal_id', label: 'Metal', type: 'async-select', endpoint: '/masters/metals' },
        { name: 'ltv_percent', label: 'LTV % of rate', type: 'number', step: '0.01', required: true },
        { name: 'rate_type', label: 'Rate type', type: 'select', options: [{ value: 'YEARLY', label: '% per year' }, { value: 'MONTHLY', label: '% per month' }], placeholder: undefined },
        { name: 'calc_mode', label: 'Calculate by', type: 'select', options: [{ value: 'DAYS', label: 'Exact days' }, { value: 'MONTHS', label: 'Months (half/full)' }], placeholder: undefined },
        { name: 'slab_mode', label: 'Slab mode', type: 'select', options: [{ value: 'FROM_LOAN_DATE', label: 'From loan date' }, { value: 'STEPPED', label: 'Stepped' }], placeholder: undefined },
        { name: 'min_days', label: 'Minimum days', type: 'number' }, { name: 'tenure_months', label: 'Tenure (months)', type: 'number' },
        { name: 'grace_days', label: 'Grace days', type: 'number' }, { name: 'penal_rate', label: 'Penal % p.a. after due', type: 'number', step: '0.01' },
        { name: 'doc_charge_percent', label: 'Doc charge %', type: 'number', step: '0.001' }, { name: 'doc_charge_fixed', label: 'Doc charge fixed ₹', type: 'number' },
        { name: 'advance_interest_months', label: 'Advance interest (months)', type: 'number' },
        { name: 'min_amount', label: 'Min loan ₹', type: 'number' }, { name: 'max_amount', label: 'Max loan ₹ (0 = no limit)', type: 'number' },
        { name: 'branch_id', label: 'Only for branch', type: 'async-select', endpoint: '/admin/branches', placeholder: 'All branches' },
        { name: 'description', label: 'Description', span: 'full' },
        { name: 'is_active', label: 'Active', type: 'switch' },
      ]}
      formExtra={(form) => <SlabEditor form={form} />}
    />
  );
}
