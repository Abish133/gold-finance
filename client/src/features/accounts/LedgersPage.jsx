import { useState } from 'react';
import { Layers, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge, Button, Drawer, Field, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

function OpeningDrawer({ ledger, onClose }) {
  const [f, setF] = useState({ amount: '', type: 'DR' });
  return (
    <Drawer open={!!ledger} onClose={onClose} size="sm" title={`Opening balance · ${ledger?.name}`} subtitle="For the selected branch" icon={Scale}
      footer={<Button variant="gold" onClick={async () => { try { await api.put(`/accounts/ledgers/${ledger.id}/opening`, f); toast.success('Saved'); onClose(); } catch (e) { toast.error(e.message); } }}>Save</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: 'DR', label: 'Debit' }, { value: 'CR', label: 'Credit' }]} /></Field>
      </div>
    </Drawer>
  );
}

export default function LedgersPage() {
  const [opening, setOpening] = useState(null);
  const { can, isAllBranches } = useAuth();
  return (
    <>
      <ResourcePage title="Account Master" singular="Account" endpoint="/accounts/ledgers" screen="acc_ledgers" icon={Layers}
        subtitle="Ledgers used in vouchers & final accounts. System ledgers are posted automatically." defaults={{ is_active: 1 }} canDelete
        columns={[
          { key: 'name', label: 'Account', sortable: true, render: (r) => <span className="font-semibold">{r.name} {r.is_system ? <Badge tone="gold" className="ml-1">System</Badge> : null}</span> },
          { key: 'group_name', label: 'Group', sortable: true }, { key: 'nature', label: 'Nature', render: (r) => <Badge tone="blue">{r.nature}</Badge> },
          { key: 'code', label: 'Code' },
        ]}
        rowActions={(r) => can('acc_ledgers', 'edit') && !isAllBranches && <Button size="sm" variant="ghost" onClick={() => setOpening(r)}>Opening</Button>}
        fields={[
          { name: 'name', label: 'Account name', required: true },
          { name: 'group_id', label: 'Group', type: 'async-select', endpoint: '/accounts/groups', required: true },
          { name: 'code', label: 'Code' },
          { name: 'is_active', label: 'Active', type: 'switch' },
        ]} />
      <OpeningDrawer ledger={opening} onClose={() => setOpening(null)} />
    </>
  );
}
