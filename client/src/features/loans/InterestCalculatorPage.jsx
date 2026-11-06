import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, DataTable, Field, Input, PageHeader, Checkbox } from '@/components/ui';
import { useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { today } from '@/lib/format';
import dayjs from 'dayjs';

/** Interest calculator + side-by-side scheme comparison (Loan Comparison). */
export default function InterestCalculatorPage({ embedded }) {
  const { data: lk } = useLookups();
  const [f, setF] = useState({ principal: 50000, loan_date: dayjs().subtract(3, 'month').format('YYYY-MM-DD'), as_of: today() });
  const [ids, setIds] = useState([]);
  const calc = useMutation({ mutationFn: () => api.post('/loans/calculate', { ...f, scheme_ids: ids.length ? ids : (lk?.schemes || []).map((s) => s.id) }), onError: (e) => toast.error(e.message) });

  return (
    <div className="animate-rise">
      {!embedded && <PageHeader icon={Calculator} title="Interest Calculator" subtitle="Quote any customer instantly and compare schemes" />}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="Inputs">
          <div className="space-y-4">
            <Field label="Loan amount"><Input type="number" prefix="₹" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
            <Field label="Loan date"><Input type="date" value={f.loan_date} onChange={(e) => setF({ ...f, loan_date: e.target.value })} /></Field>
            <Field label="Calculate till"><Input type="date" value={f.as_of} onChange={(e) => setF({ ...f, as_of: e.target.value })} /></Field>
            <div>
              <span className="label">Schemes (none = all)</span>
              <div className="space-y-1.5">{(lk?.schemes || []).map((s) => <Checkbox key={s.id} label={`${s.code} · ${s.name}`} checked={ids.includes(s.id)} onChange={(c) => setIds((x) => (c ? [...x, s.id] : x.filter((y) => y !== s.id)))} />)}</div>
            </div>
            <Button variant="gold" className="w-full" loading={calc.isPending} onClick={() => calc.mutate()}>Calculate</Button>
          </div>
        </Card>
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
