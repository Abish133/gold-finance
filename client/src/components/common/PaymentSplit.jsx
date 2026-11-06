import { useEffect } from 'react';
import { Plus, Trash2, Banknote, Smartphone, Building2 } from 'lucide-react';
import clsx from 'clsx';
import { Button, Input, Select } from '@/components/ui';
import { useLookups } from '@/hooks/useApi';
import { money, round2, n } from '@/lib/format';

const MODES = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'BANK', label: 'Bank / NEFT', icon: Building2 },
];

/**
 * Split an amount across Cash / UPI / Bank. Keeps the first line auto-balanced.
 * value: [{ mode, amount, bank_account_id, reference }]
 */
export function PaymentSplit({ total, value, onChange, label = 'Payment mode', direction = 'received' }) {
  const { data: lookups } = useLookups();
  const banks = (lookups?.banks || []).map((b) => ({ value: b.id, label: `${b.bank_name} ${b.account_no ? `· ${String(b.account_no).slice(-4)}` : ''}` }));
  const lines = value?.length ? value : [{ mode: 'CASH', amount: round2(total) }];

  // auto-balance the first line whenever total changes
  useEffect(() => {
    const rest = lines.slice(1).reduce((s, l) => s + n(l.amount), 0);
    const first = round2(Math.max(0, n(total) - rest));
    if (!value?.length || n(lines[0].amount) !== first) onChange([{ ...lines[0], amount: first }, ...lines.slice(1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const update = (i, patch) => {
    const next = lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    if (i !== 0 && 'amount' in patch) {
      const rest = next.slice(1).reduce((s, l) => s + n(l.amount), 0);
      next[0] = { ...next[0], amount: round2(Math.max(0, n(total) - rest)) };
    }
    onChange(next);
  };
  const sum = round2(lines.reduce((s, l) => s + n(l.amount), 0));
  const diff = round2(n(total) - sum);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange([...lines, { mode: 'UPI', amount: 0 }])}>Split</Button>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="rounded-2xl border border-ink-200 p-3 dark:border-ink-700">
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button key={m.value} type="button" onClick={() => update(i, { mode: m.value })}
                  className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    l.mode === m.value ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-950' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300')}>
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              ))}
              {i > 0 && <Button size="icon" variant="ghost" className="ml-auto size-7" onClick={() => onChange(lines.filter((_, idx) => idx !== i))}><Trash2 className="size-3.5 text-rose-500" /></Button>}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Input type="number" step="0.01" prefix="₹" value={l.amount} disabled={i === 0 && lines.length > 1} onChange={(e) => update(i, { amount: e.target.value })} />
              {l.mode !== 'CASH' && <Select value={l.bank_account_id || ''} onChange={(e) => update(i, { bank_account_id: e.target.value })} placeholder="Bank account" options={banks} />}
              {l.mode !== 'CASH' && <Input placeholder="Ref / UTR no" value={l.reference || ''} onChange={(e) => update(i, { reference: e.target.value })} />}
            </div>
          </div>
        ))}
      </div>
      {Math.abs(diff) > 0.009 && <p className="mt-2 text-xs font-semibold text-rose-600">Split total {money(sum)} differs from {direction} amount {money(total)}</p>}
    </div>
  );
}
