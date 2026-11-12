import { useNavigate } from 'react-router';
import { Lightbulb, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { Card, DataTable, PageHeader, Spinner } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';

const LEVEL = {
  high: ['border-rose-600 bg-rose-50', AlertTriangle, 'text-rose-600'],
  medium: ['border-amber-500 bg-amber-50', AlertTriangle, 'text-amber-600'],
  low: ['border-ink-400 bg-ink-50', Info, 'text-ink-600'],
};

/** Advisory: what needs attention today, in order of importance. */
export default function AdvisoryPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useFetch('/desk/advisory', undefined, { refetchInterval: 5 * 60_000 });
  if (isLoading || !data) return <Spinner />;
  const order = { high: 0, medium: 1, low: 2 };
  const items = [...data.items].sort((a, b) => order[a.level] - order[b.level]);
  return (
    /* fit-screen: the alerts and the exposure table scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <PageHeader icon={Lightbulb} title="Advisory" subtitle="Things to act on today for a healthy loan book" />
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_360px]">
        <div className="space-y-1.5 overflow-y-auto xl:min-h-0">
          {!items.length && <div className="card flex items-center gap-2.5 p-4 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="size-5" /> Everything looks good today.</div>}
          {items.map((a) => {
            const [cls, Icon, ic] = LEVEL[a.level] || LEVEL.low;
            return (
              <button key={a.title} type="button" onClick={() => navigate(a.link)} className={clsx('flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition hover:brightness-95', cls)}>
                <Icon className={clsx('mt-0.5 size-4 shrink-0', ic)} />
                <span className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{a.title}</p><p className="text-[12px] text-ink-600 dark:text-ink-300">{a.text}</p></span>
                <span className="text-[12px] font-semibold whitespace-nowrap">Open →</span>
              </button>
            );
          })}
        </div>
        <Card title="Largest open exposures" className="flex flex-col xl:min-h-0" bodyClassName="flex min-h-0 flex-1 flex-col p-2">
          <DataTable fill rows={data.topCustomers} columns={[{ key: 'name', label: 'Customer' }, { key: 'loans', label: 'Loans', type: 'number' }, { key: 'amount', label: 'Outstanding', type: 'money' }]} />
        </Card>
      </div>
    </div>
  );
}
