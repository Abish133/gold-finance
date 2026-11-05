import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, ConfirmDrawer, DataTable, PageHeader } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function YearEndPage() {
  const { data = [], isLoading } = useFetch('/admin/financial-years');
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const cur = data.find((y) => y.is_current);
  return (
    <div className="animate-rise">
      <PageHeader icon={CalendarRange} title="Financial Year" subtitle="Open loans carry forward automatically. Profit & Loss restarts for the new year."
        actions={user.is_super_admin && <Button variant="gold" onClick={() => setConfirm(true)}>Close {cur?.name} & start next year</Button>} />
      <DataTable rows={data} loading={isLoading} columns={[
        { key: 'name', label: 'Year', render: (r) => <span className="font-bold">{r.name}</span> }, { key: 'start_date', label: 'From', type: 'date' }, { key: 'end_date', label: 'To', type: 'date' },
        { key: 's', label: 'Status', render: (r) => (r.is_current ? <Badge tone="green">Current</Badge> : r.is_closed ? <Badge>Closed</Badge> : <Badge tone="gold">Open</Badge>) },
      ]} />
      <ConfirmDrawer open={confirm} onClose={() => setConfirm(false)} title="Run year end?" confirmText="Run year end" tone="primary"
        message="The current year is marked closed and the next financial year becomes current. If 'restart loan numbers yearly' is on, numbering starts again from 1."
        onConfirm={async () => { try { const r = await api.post('/admin/financial-years/year-end'); toast.success(`Year ${r.data.name} started`); qc.invalidateQueries({ queryKey: ['/admin/financial-years'] }); setConfirm(false); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
