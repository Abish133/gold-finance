import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Field, Input, PageHeader, Stat, Textarea } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, today, n } from '@/lib/format';

const NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export default function DenominationPage() {
  const { isAllBranches } = useAuth();
  const [d, setD] = useState(today());
  const qc = useQueryClient();
  const { data } = useFetch(isAllBranches ? null : '/accounts/denominations', { date: d });
  const [notes, setNotes] = useState({});
  const [coins, setCoins] = useState('');
  const [remarks, setRemarks] = useState('');
  useEffect(() => {
    const saved = data?.record?.notes ? (typeof data.record.notes === 'string' ? JSON.parse(data.record.notes) : data.record.notes) : {};
    setNotes(saved); setCoins(saved.coins || ''); setRemarks(data?.record?.remarks || '');
  }, [data]);
  const total = NOTES.reduce((s, x) => s + x * n(notes[x]), 0) + n(coins);
  const diff = total - n(data?.bookBalance);
  const save = useMutation({
    mutationFn: () => api.post('/accounts/denominations', { date: d, notes: Object.fromEntries(NOTES.map((x) => [x, n(notes[x])])), coins: n(coins), remarks }),
    onSuccess: () => { toast.success('Cash count saved'); qc.invalidateQueries({ queryKey: ['/accounts/denominations'] }); },
    onError: (e) => toast.error(e.message),
  });
  if (isAllBranches) return <Card><p className="text-sm">Select a branch.</p></Card>;
  return (
    <div className="animate-rise">
      <PageHeader icon={Coins} title="Cash Denomination" subtitle="Count the cash drawer and tally with the books" actions={<Input type="date" className="w-44" value={d} onChange={(e) => setD(e.target.value)} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            {NOTES.map((x) => (
              <div key={x} className="flex items-center gap-3 rounded-2xl border border-ink-200 p-3 dark:border-ink-700">
                <span className="w-16 rounded-lg bg-emerald-50 px-2 py-1 text-center font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">₹{x}</span>
                <span className="text-ink-400">×</span>
                <Input type="number" min="0" value={notes[x] || ''} onChange={(e) => setNotes({ ...notes, [x]: e.target.value })} />
                <span className="num w-24 text-right text-sm font-semibold">{money(x * n(notes[x]))}</span>
              </div>
            ))}
            <Field label="Loose coins (amount)"><Input type="number" value={coins} onChange={(e) => setCoins(e.target.value)} /></Field>
          </div>
          <Field label="Remarks" className="mt-4"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        </Card>
        <div className="space-y-3">
          <Stat label="Counted cash" value={money(total)} />
          <Stat label="Book balance" value={money(data?.bookBalance)} tone="blue" />
          <Stat label={diff === 0 ? 'Tallied' : diff > 0 ? 'Excess' : 'Shortage'} value={money(Math.abs(diff))} tone={Math.abs(diff) < 0.01 ? 'green' : 'red'} />
          <Button variant="gold" className="w-full" size="lg" loading={save.isPending} onClick={() => save.mutate()}>Save count</Button>
        </div>
      </div>
    </div>
  );
}
