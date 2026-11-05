import { Building2 } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge } from '@/components/ui';

export default function BankAccountsPage() {
  return (
    <ResourcePage
      title="Bank Accounts" singular="Bank Account" endpoint="/masters/bank-accounts" screen="bank_accounts" icon={Building2}
      subtitle="Operating & pledge accounts. A ledger is created automatically for each account."
      defaults={{ used_for: 'BOTH', is_active: 1 }}
      columns={[
        { key: 'bank_name', label: 'Bank', sortable: true, render: (r) => <div><p className="font-semibold">{r.bank_name}</p><p className="text-xs text-ink-500">{r.bank_branch}</p></div> },
        { key: 'account_no', label: 'Account no' }, { key: 'ifsc', label: 'IFSC' },
        { key: 'used_for', label: 'Used for', render: (r) => <Badge tone="blue">{r.used_for}</Badge> },
        { key: 'branch_name', label: 'Our branch' },
        { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>) },
      ]}
      fields={[
        { name: 'bank_name', label: 'Bank name', required: true }, { name: 'bank_branch', label: 'Bank branch' },
        { name: 'account_name', label: 'Account name' }, { name: 'account_no', label: 'Account no' },
        { name: 'ifsc', label: 'IFSC' }, { name: 'customer_id_at_bank', label: 'Customer ID at bank' },
        { name: 'phone', label: 'Phone' }, { name: 'opened_on', label: 'Opened on', type: 'date' },
        { name: 'used_for', label: 'Used for', type: 'select', options: ['OPERATING', 'PLEDGE', 'BOTH'], placeholder: undefined },
        { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 },
        { name: 'is_active', label: 'Active', type: 'switch' },
      ]}
    />
  );
}
