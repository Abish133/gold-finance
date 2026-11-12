import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Building2 } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge } from '@/components/ui';
import { money } from '@/lib/format';
import { branchPhones, MAX_PHONES } from '@/lib/branchInfo';

const formPhones = (r) => { const p = branchPhones(r.phones, r.phone); return p.length ? p : ['']; };

export default function BranchesPage() {
  const qc = useQueryClient();
  return (
    <ResourcePage title="Branches" singular="Branch" endpoint="/admin/branches" screen="s_branches" icon={Building2} cols={2}
      subtitle="Each branch has its own licence, contact numbers, customers, loans, numbering, cash and accounts" defaults={{ is_active: 1, opening_cash: 0, phones: [''] }}
      onSaved={() => qc.invalidateQueries({ queryKey: ['auth'] })}
      fromRecord={(r) => ({ ...r, phones: formPhones(r), licence_valid_till: r.licence_valid_till ? dayjs(r.licence_valid_till).format('YYYY-MM-DD') : '' })}
      toPayload={(v) => ({ ...v, phones: (v.phones || []).map((p) => String(p ?? '').trim()).filter(Boolean) })}
      columns={[
        { key: 'code', label: 'Code', sortable: true, render: (r) => <span className="font-bold">{r.code}</span> },
        { key: 'name', label: 'Branch', sortable: true }, { key: 'city', label: 'City' },
        { key: 'licence_no', label: 'Licence no', sortable: true, render: (r) => (r.licence_no ? <span className="num font-semibold">{r.licence_no}</span> : <Badge tone="red">Not set</Badge>) },
        { key: 'phones', label: 'Contact numbers', render: (r) => { const p = branchPhones(r.phones, r.phone); return p.length ? <span className="num">{p.join(', ')}</span> : <Badge tone="red">Not set</Badge>; } },
        { key: 'manager_name', label: 'Manager' },
        { key: 'loan_prefix', label: 'Loan prefix' }, { key: 'opening_cash', label: 'Opening cash', render: (r) => money(r.opening_cash), align: 'right' },
        { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
      ]}
      fields={[
        { name: 'code', label: 'Branch code', required: true, hint: 'Short code, also used in barcodes' }, { name: 'name', label: 'Branch name', required: true },
        { name: 'local_name', label: 'Name in Tamil' }, { name: 'manager_name', label: 'Manager' },
        { name: 'licence_no', label: 'Pawn broker licence no', required: true, hint: 'Printed on every bill of this branch' },
        { name: 'licence_valid_till', label: 'Licence valid till', type: 'date' },
        { name: 'phones', label: 'Contact numbers (printed on bill)', type: 'phone-list', required: true, max: MAX_PHONES, span: 'full', hint: 'first is the primary number' },
        { name: 'email', label: 'Email' },
        { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 }, { name: 'city', label: 'City' }, { name: 'pincode', label: 'PIN' },
        { name: 'loan_prefix', label: 'Loan number prefix', hint: 'e.g. KRL- → KRL-101' }, { name: 'opening_cash', label: 'Opening cash balance', type: 'money' },
        { name: 'is_active', label: 'Active', type: 'switch' },
      ]} />
  );
}
