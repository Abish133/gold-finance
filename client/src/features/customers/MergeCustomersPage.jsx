import { useState } from 'react';
import { Merge, ArrowRight } from 'lucide-react';
import { Button, Card, ConfirmDrawer, PageHeader } from '@/components/ui';
import { CustomerPicker } from '@/components/common/CustomerPicker';
import { useAction } from '@/hooks/useApi';

export default function MergeCustomersPage() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const merge = useAction({ url: '/customers/merge', invalidate: ['/customers'], success: 'Customers merged' });

  return (
    <div className="animate-rise">
      <PageHeader title="Merge Customers" subtitle="Combine duplicate customer records. All loans move to the customer you keep." icon={Merge} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Card title="Duplicate (will be removed)"><CustomerPicker value={from} onChange={setFrom} allowCreate={false} /></Card>
        <div className="hidden pt-16 lg:block"><ArrowRight className="size-8 text-gold-500" /></div>
        <Card title="Keep this customer"><CustomerPicker value={to} onChange={setTo} allowCreate={false} /></Card>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="gold" icon={Merge} disabled={!from || !to || from.id === to.id} onClick={() => setConfirm(true)}>Merge customers</Button>
      </div>
      <ConfirmDrawer open={confirm} onClose={() => setConfirm(false)} title="Merge customers?" loading={merge.isPending}
        message={`All loans of #${from?.customer_no} ${from?.name} will be moved to #${to?.customer_no} ${to?.name}. This cannot be undone.`}
        onConfirm={() => merge.mutate({ body: { fromId: from.id, toId: to.id } }, { onSuccess: () => { setConfirm(false); setFrom(null); setTo(null); } })} />
    </div>
  );
}
