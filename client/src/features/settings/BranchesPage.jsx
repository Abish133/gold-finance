import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge } from '@/components/ui';
import { money } from '@/lib/format';

export default function BranchesPage() {
  const qc = useQueryClient();
  return (
    <ResourcePage title="Branches" singular="Branch" endpoint="/admin/branches" screen="s_branches" icon={Building2} cols={2}
      subtitle="Each branch has its own customers, loans, numbering, cash and accounts" defaults={{ is_active: 1, opening_cash: 0 }}
      onSaved={() => qc.invalidateQueries({ queryKey: ['auth'] })}
      columns={[
        { key: 'code', label: 'Code', sortable: true, render: (r) => <span className="font-bold">{r.code}</span> },
        { key: 'name', label: 'Branch', sortable: true }, { key: 'city', label: 'City' }, { key: 'phone', label: 'Phone' }, { key: 'manager_name', label: 'Manager' },
        { key: 'loan_prefix', label: 'Loan prefix' }, { key: 'opening_cash', label: 'Opening cash', render: (r) => money(r.opening_cash), align: 'right' },
        { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
      ]}
      fields={[
        { name: 'code', label: 'Branch code', required: true, hint: 'Short code, also used in barcodes' }, { name: 'name', label: 'Branch name', required: true },
        { name: 'local_name', label: 'Name in Tamil' }, { name: 'manager_name', label: 'Manager' },
        { name: 'phone', label: 'Phone (printed on bill)' }, { name: 'email', label: 'Email' },
        { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 }, { name: 'city', label: 'City' }, { name: 'pincode', label: 'PIN' },
        { name: 'loan_prefix', label: 'Loan number prefix', hint: 'e.g. KRL- → KRL-101' }, { name: 'opening_cash', label: 'Opening cash balance', type: 'money' },
        { name: 'is_active', label: 'Active', type: 'switch' },
      ]} />
  );
}
