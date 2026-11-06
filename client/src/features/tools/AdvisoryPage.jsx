import { useNavigate } from 'react-router';
import { Lightbulb, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { Card, DataTable, PageHeader, Spinner } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';

const LEVEL = {
  high: ['border-l-rose-600 bg-rose-50', AlertTriangle, 'text-rose-600'],
  medium: ['border-l-amber-500 bg-amber-50', AlertTriangle, 'text-amber-600'],
  low: ['border-l-ink-400 bg-ink-50', Info, 'text-ink-600'],
};

/** Advisory: what needs attention today, in order of importance. */
export default function AdvisoryPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useFetch('/desk/advisory', undefined, { refetchInterval: 5 * 60_000 });
  if (isLoading || !data) return <Spinner />;
  const order = { high: 0, medium: 1, low: 2 };
  const items = [...data.items].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <div className="animate-rise space-y-3">
      <PageHeader icon={Lightbulb} title="Advisory" subtitle="Things to act on today for a healthy loan book" />
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_380px]">
        <div className="space-y-2">
          {!items.length && <div className="card flex items-center gap-3 p-5 text-emerald-700"><CheckCircle2 className="size-6" /> Everything looks good today.</div>}
          {items.map((a) => {
            const [cls, Icon, ic] = LEVEL[a.level] || LEVEL.low;
            return (
              <button key={a.title} type="button" onClick={() => navigate(a.link)} className={clsx('flex w-full items-start gap-3 rounded-md border border-ink-200 border-l-4 px-4 py-3 text-left hover:shadow-sm', cls)}>
                <Icon className={clsx('mt-0.5 size-5 shrink-0', ic)} />
                <span className="flex-1"><p className="font-semibold">{a.title}</p><p className="text-sm text-ink-600">{a.text}</p></span>
                <span className="text-sm font-semibold whitespace-nowrap">Open →</span>
              </button>
            );
          })}
        </div>
        <Card title="Largest open exposures">
          <DataTable dense rows={data.topCustomers} columns={[{ key: 'name', label: 'Customer' }, { key: 'loans', label: 'Loans', type: 'number' }, { key: 'amount', label: 'Outstanding', type: 'money' }]} />
        </Card>
      </div>
    </div>
  );
}
