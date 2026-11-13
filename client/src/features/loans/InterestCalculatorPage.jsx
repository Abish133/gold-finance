import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, DataTable, Field, Input, PageHeader, Checkbox } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { amount, n, today } from '@/lib/format';
import { convertRate, ratePer, rateText } from '@/lib/rateUnits';
import { RateField } from './InterestChoice';
import dayjs from 'dayjs';

/** Manual quote: any rate in any unit, by days and by months, for the dates above. */
function ManualQuote({ principal, from, to, defaultRate }) {
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState('PM');
  const r = rate === '' ? defaultRate : rate;
  const days = Math.max(0, dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day'));
  const fullMonths = Math.max(0, dayjs(to).diff(dayjs(from), 'month'));
  const startedMonths = Math.max(1, dayjs(from).add(fullMonths, 'month').isBefore(dayjs(to), 'day') ? fullMonths + 1 : fullMonths);
  const { monthly, perDay } = ratePer(principal, r, unit);
  const byDays = Math.round(perDay * days);
  const rows = [
    ['By days', `${days} days × ₹${amount(perDay)} a day`, byDays],
    ['By full months', `${fullMonths} month${fullMonths === 1 ? '' : 's'} × ₹${amount(monthly)}`, Math.round(monthly * fullMonths)],
    ['By started months', `${startedMonths} month${startedMonths === 1 ? '' : 's'} × ₹${amount(monthly)} (every started month)`, Math.round(monthly * startedMonths)],
  ];
  return (
    <Card title="Manual quote - any rate, by days or months">
      <div className="space-y-3">
        <RateField title="Quote" rate={r} unit={unit} typed={rate !== ''} perDay={perDay} monthly={monthly} resetLabel="Default rate" idleLabel="default rate - type any rate"
          onRate={setRate} onUnit={(u) => { setRate(String(convertRate(r, unit, u, principal))); setUnit(u); }}
          onReset={() => { setRate(''); setUnit('PM'); }} />
        <div className="overflow-hidden rounded-md border border-ink-200 text-[13px] dark:border-ink-800">
          {rows.map(([k, how, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-ink-100 px-3 py-1.5 last:border-0 dark:border-ink-800">
              <div className="min-w-0"><p className="font-semibold">{k}</p><p className="truncate text-[11px] text-ink-500">{how}</p></div>
              <span className="num shrink-0 text-[15px] font-bold">₹{amount(v)}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-500">₹{amount(principal)} at {rateText(r, unit)} from {dayjs(from).format('DD/MM/YYYY')} to {dayjs(to).format('DD/MM/YYYY')}. Use these on Part Payment / Release with the Interest box (Manual → Days or Months, same rate and unit).</p>
      </div>
    </Card>
  );
}

/** Interest calculator + side-by-side scheme comparison (Loan Comparison). */
export default function InterestCalculatorPage({ embedded }) {
  const { data: lk } = useLookups();
  const { data: settings } = useFetch('/admin/settings');
  const [f, setF] = useState({ principal: 50000, loan_date: dayjs().subtract(3, 'month').format('YYYY-MM-DD'), as_of: today() });
  const [ids, setIds] = useState([]);
  const calc = useMutation({ mutationFn: () => api.post('/loans/calculate', { ...f, scheme_ids: ids.length ? ids : (lk?.schemes || []).map((s) => s.id) }), onError: (e) => toast.error(e.message) });
  const defaultRate = n(settings?.DEFAULT_INTEREST_RATE) || 1.5;

  return (
    <div className="animate-rise">
      {!embedded && <PageHeader icon={Calculator} title="Interest Calculator" subtitle="Quote any customer instantly, compare schemes, or work out a manual rate by days or months" />}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card title="Inputs">
            <div className="space-y-4">
              <Field label="Loan amount"><Input type="number" prefix="₹" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
              <Field label="Loan date"><Input type="date" value={f.loan_date} onChange={(e) => setF({ ...f, loan_date: e.target.value })} /></Field>
              <Field label="Calculate till"><Input type="date" value={f.as_of} onChange={(e) => setF({ ...f, as_of: e.target.value })} /></Field>
              <div>
                <span className="label">Schemes (none = all)</span>
                <div className="space-y-1.5">{(lk?.schemes || []).map((s) => <Checkbox key={s.id} label={`${s.code} · ${s.name}`} checked={ids.includes(s.id)} onChange={(c) => setIds((x) => (c ? [...x, s.id] : x.filter((y) => y !== s.id)))} />)}</div>
              </div>
              <Button variant="gold" className="w-full" loading={calc.isPending} onClick={() => calc.mutate()}>Calculate schemes</Button>
            </div>
          </Card>
          <ManualQuote principal={n(f.principal)} from={f.loan_date} to={f.as_of} defaultRate={defaultRate} />
        </div>
        <DataTable columns={[
          { key: 'scheme', label: 'Scheme', render: (r) => <span className="font-semibold">{r.scheme.code} · {r.scheme.name}</span> },
          { key: 'elapsedDays', label: 'Days', type: 'number' },
          { key: 'chargeDays', label: 'Charged days', type: 'number' },
          { key: 'rate', label: 'Rate %', type: 'number' },
          { key: 'totalInterest', label: 'Interest', type: 'money' },
          { key: 'penalDue', label: 'Penal', type: 'money' },
          { key: 'totalPayable', label: 'Total payable', type: 'money', render: (r) => <span className="font-bold">{Number(r.totalPayable).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span> },
        ]} rows={(calc.data?.data || []).map((r, i) => ({ ...r, id: r.scheme.id ?? i }))} />
      </div>
    </div>
  );
}
