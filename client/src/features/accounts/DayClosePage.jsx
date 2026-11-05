import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, DataTable, KeyValue, PageHeader, Spinner, Stat } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, date } from '@/lib/format';

export default function DayClosePage() {
  const { can, isAllBranches } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useFetch(isAllBranches ? null : '/accounts/day-close');
  const refresh = () => qc.invalidateQueries({ queryKey: ['/accounts/day-close'] });
  const close = useMutation({ mutationFn: () => api.post('/accounts/day-close', { date: data.nextDate }), onSuccess: () => { toast.success('Day closed'); refresh(); }, onError: (e) => toast.error(e.message) });
  const reopen = useMutation({ mutationFn: (d) => api.del(`/accounts/day-close/${d}`), onSuccess: () => { toast.success('Day re-opened'); refresh(); }, onError: (e) => toast.error(e.message) });
  if (isAllBranches) return <Card><p className="text-sm">Select a branch.</p></Card>;
  if (isLoading || !data) return <Spinner />;
  const s = data.summary;
  return (
    <div className="animate-rise">
      <PageHeader icon={Lock} title="Day Close" subtitle="Locks all entries up to the closed date. Back-dated changes are blocked after closing." />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Last closed" value={data.lastClosed ? date(data.lastClosed) : 'Never'} />
        <Stat label="Next day to close" value={date(data.nextDate)} tone="blue" />
        <Stat label="Closing cash" value={money(s.cash.closing)} tone="green" />
      </div>
      <Card title={`Summary for ${date(data.nextDate)}`} actions={can('day_close', 'add') && <Button variant="gold" icon={Lock} loading={close.isPending} onClick={() => close.mutate()}>Close {date(data.nextDate)}</Button>}>
        <KeyValue cols={4} items={[['Opening cash', money(s.cash.opening)], ['Receipts', money(s.cash.receipts)], ['Payments', money(s.cash.payments)], ['Closing', money(s.cash.closing)],
          ['New loans', `${s.loans.cnt} · ${money(s.loans.principal)}`], ['Interest', money(Object.values(s.transactions).reduce((a, x) => a + Number(x.interest), 0))],
          ['Releases', s.transactions.RELEASE ? `${s.transactions.RELEASE.cnt} · ${money(s.transactions.RELEASE.principal)}` : '0']]} />
      </Card>
      <h3 className="mt-8 mb-3 font-semibold">History</h3>
      <DataTable dense rows={data.history} rowKey="close_date" columns={[
        { key: 'close_date', label: 'Date', type: 'date' }, { key: 'opening_cash', label: 'Opening', type: 'money' }, { key: 'closing_cash', label: 'Closing', type: 'money' },
        { key: 'closed_by_name', label: 'Closed by' }, { key: 'closed_at', label: 'At', type: 'datetime' },
        { key: 'x', label: '', align: 'right', render: (r, i) => r.close_date === data.lastClosed && can('day_close', 'delete') && <Button size="sm" variant="outline" icon={LockOpen} onClick={() => reopen.mutate(String(r.close_date).slice(0, 10))}>Re-open</Button> },
      ]} />
    </div>
  );
}
