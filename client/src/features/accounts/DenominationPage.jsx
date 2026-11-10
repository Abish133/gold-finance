import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Drawer, Field, Input, PageHeader, Stat, Textarea } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { money, today, n, date as fmtDate } from '@/lib/format';

const NOTES = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/** Cash count form (same note list as the desktop app). Enter = next note, F2 = save. */
export function CashCount({ date, onSaved }) {
  const qc = useQueryClient();
  const { data } = useFetch('/accounts/denominations', { date });
  const [notes, setNotes] = useState({});
  const [coins, setCoins] = useState('');
  const [remarks, setRemarks] = useState('');
  const boxes = useRef([]);
  useEffect(() => {
    const saved = data?.record?.notes ? (typeof data.record.notes === 'string' ? JSON.parse(data.record.notes) : data.record.notes) : {};
    setNotes(saved); setCoins(saved.coins || ''); setRemarks(data?.record?.remarks || '');
  }, [data]);
  const total = NOTES.reduce((s, x) => s + x * n(notes[x]), 0) + n(coins);
  const diff = Math.round((total - n(data?.bookBalance)) * 100) / 100;
  const save = useMutation({
    mutationFn: () => api.post('/accounts/denominations', { date, notes: Object.fromEntries(NOTES.map((x) => [x, n(notes[x])])), coins: n(coins), remarks }),
    onSuccess: () => {
      toast.success('Cash saved successfully');
      qc.invalidateQueries({ queryKey: ['/accounts/denominations'] });
      qc.invalidateQueries({ queryKey: ['/desk/day-report'] });
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });
  const next = (i) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); (boxes.current[i + 1] || boxes.current[0])?.select?.(); }
    if (e.key === 'F2') { e.preventDefault(); save.mutate(); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-200 text-xs text-ink-500 uppercase"><th className="py-1.5 text-left">Note / coin</th><th className="w-32 text-center">Count</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {NOTES.map((x, i) => (
              <tr key={x} className="border-b border-ink-100 dark:border-ink-800">
                <td className="py-1 font-bold">₹ {x}</td>
                <td className="py-1"><Input ref={(el) => { boxes.current[i] = el; }} type="number" min="0" className="text-right" value={notes[x] ?? ''} placeholder="0"
                  onChange={(e) => setNotes({ ...notes, [x]: e.target.value })} onKeyDown={next(i)} autoFocus={i === 0} /></td>
                <td className="num py-1 text-right">{money(x * n(notes[x]))}</td>
              </tr>
            ))}
            <tr><td className="py-1 text-ink-600">Loose coins (amount)</td><td className="py-1"><Input ref={(el) => { boxes.current[NOTES.length] = el; }} type="number" className="text-right" value={coins} onChange={(e) => setCoins(e.target.value)} onKeyDown={next(NOTES.length)} /></td><td /></tr>
          </tbody>
          <tfoot><tr className="bg-cream-100 font-bold dark:bg-ink-800"><td className="px-1 py-2" colSpan={2}>Counted cash</td><td className="num py-2 text-right">{money(total)}</td></tr></tfoot>
        </table>
        <Field label="Remarks" className="mt-3"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      </div>
      <div className="space-y-3">
        <Stat label="Cash in drawer (expected)" value={money(data?.bookBalance)} tone="blue" />
        <Stat label="Counted cash" value={money(total)} />
        <Stat label="Difference" value={Math.abs(diff) < 0.01 ? 'Cash Tally' : `${diff > 0 ? '+ ' : '- '}${money(Math.abs(diff))}`} hint={Math.abs(diff) < 0.01 ? 'drawer cash matches' : diff > 0 ? 'excess' : 'shortage'} tone={Math.abs(diff) < 0.01 ? 'green' : 'red'} />
        <Button variant="gold" className="w-full" size="lg" loading={save.isPending} onClick={() => save.mutate()}>Save Count (F2)</Button>
        <p className="text-xs text-ink-500">Enter = next note · type the number of notes / coins</p>
      </div>
    </div>
  );
}

/** Cash count as a drawer over the Day Report / Day End (F6). */
export function CashCountDrawer({ open, onClose, date }) {
  return (
    <Drawer open={open} onClose={onClose} size="lg" icon={Coins} title={`Cash Count - ${fmtDate(date)}`} subtitle="Count the cash in the drawer - it must match the Day Report">
      {open && <CashCount date={date} onSaved={onClose} />}
    </Drawer>
  );
}

export default function DenominationPage() {
  const { isAllBranches } = useAuth();
  const [d, setD] = useState(today());
  if (isAllBranches) return <Card><p className="text-sm">Select a branch.</p></Card>;
  return (
    <div className="animate-rise">
      <PageHeader icon={Coins} title="Cash Denomination" subtitle="Count the cash drawer and tally with the books" actions={<Input type="date" className="w-44" value={d} onChange={(e) => setD(e.target.value)} />} />
      <Card><CashCount key={d} date={d} /></Card>
    </div>
  );
}
