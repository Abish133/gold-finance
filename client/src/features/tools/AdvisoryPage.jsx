import { useNavigate } from 'react-router';
import { Lightbulb, AlertTriangle, Info, CheckCircle2, Clock3, ArrowRight, ChartNoAxesCombined, Activity, Calculator, RefreshCw, Users } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { amount, n } from '@/lib/format';
import { ExitButton } from '@/features/loans/desk';
import { PageActions } from '@/components/common/PageActions';
import { SHELL, Head, Chip } from '@/features/accounts/compact';

/* each level: what it means for the user, its icon and its (reserved) status colours - always shown with a text label */
const LEVELS = [
  { key: 'high', title: 'Act now', hint: 'affects money or blocks work today', icon: AlertTriangle,
    tag: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', box: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' },
  { key: 'medium', title: 'Soon', hint: 'plan for it this week', icon: Clock3,
    tag: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', box: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' },
  { key: 'low', title: 'Good to know', hint: 'keep an eye on it', icon: Info,
    tag: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300', box: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' },
];

/** Advisory: what to act on today for a healthy loan book, grouped by urgency. */
export default function AdvisoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch, isFetching } = useFetch('/desk/advisory', undefined, { refetchInterval: 5 * 60_000 });
  const { data: status } = useFetch('/dashboard/status');

  const items = data?.items || [];
  const count = (k) => items.filter((a) => a.level === k).length;
  // a simple health score: each open point takes some off 100
  const score = Math.max(0, 100 - count('high') * 20 - count('medium') * 10 - count('low') * 4);
  const [scoreLabel, scoreTone] = score >= 85 ? ['Healthy', 'text-emerald-300'] : score >= 60 ? ['Needs attention', 'text-amber-300'] : ['Act now', 'text-rose-300'];
  const book = n(status?.outstanding);
  const top = data?.topCustomers || [];
  const topShare = book && top[0] ? (n(top[0].amount) / book) * 100 : 0;

  return (
    <div className={SHELL}>
      <Head icon={Lightbulb} title="Advisory" sub="What to act on today for a healthy loan book">
        <div className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1" title="100 minus 20 for each 'Act now', 10 for each 'Soon' and 4 for each 'Good to know'">
          <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Health</span>
          <b className="num text-[15px]">{data ? score : '-'}</b><span className={clsx('text-[12px] font-semibold', scoreTone)}>{data ? scoreLabel : ''}</span>
        </div>
        {book > 0 && <Chip label="Loan book" value={`₹${amount(book)}`} />}
      </Head>
      <PageActions keys="Refreshes by itself every 5 minutes">
        <Button variant="outline" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Refresh</Button>
        <ExitButton />
      </PageActions>

      {/* the three levels at a glance */}
      <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        {LEVELS.map((l) => (
          <div key={l.key} className="flex items-center gap-2.5 border-ink-200 px-3 py-2 not-last:border-r dark:border-ink-800">
            <span className={clsx('grid size-8 shrink-0 place-items-center rounded-md', l.box)}><l.icon className="size-4" /></span>
            <div className="min-w-0"><p className="num text-[18px] leading-tight font-bold text-navy-900 dark:text-white">{data ? count(l.key) : '-'}</p><p className="truncate text-[11px] text-ink-500"><b className="text-ink-700 dark:text-ink-200">{l.title}</b> · {l.hint}</p></div>
          </div>
        ))}
      </div>

      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_360px]">
        {/* the advice, grouped by urgency */}
        <div className="space-y-3 overflow-y-auto xl:min-h-0">
          {isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />)}</div>}
          {data && !items.length && (
            <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="size-6 shrink-0" />
              <div><p className="text-[14px] font-bold">Everything looks good today</p><p className="text-[12px] opacity-80">No rate, cash, Day End, overdue or risk point needs action right now.</p></div>
            </div>
          )}
          {LEVELS.map((l) => {
            const list = items.filter((a) => a.level === l.key);
            if (!list.length) return null;
            return (
              <section key={l.key}>
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">
                  {l.title}<span className="num rounded-sm bg-ink-100 px-1.5 text-[10px] text-ink-600 dark:bg-ink-800 dark:text-ink-300">{list.length}</span>
                  <span className="text-[10px] font-normal tracking-normal text-ink-400 normal-case">{l.hint}</span>
                </p>
                <div className="space-y-1.5">
                  {list.map((a) => (
                    <div key={a.title} className="flex items-center gap-3 rounded-md border border-ink-200 bg-white px-3 py-2.5 dark:border-ink-800 dark:bg-ink-900">
                      <span className={clsx('grid size-9 shrink-0 place-items-center rounded-md', l.box)}><l.icon className="size-4.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-navy-900 dark:text-white">{a.title}<span className={clsx('rounded-sm px-1.5 py-px text-[10px] font-bold uppercase', l.tag)}>{l.title}</span></p>
                        <p className="text-[12px] text-ink-600 dark:text-ink-300">{a.text}</p>
                      </div>
                      <Button variant={l.key === 'high' ? 'gold' : 'outline'} className="h-8 shrink-0 text-[12px]" onClick={() => navigate(a.link)}>Open<ArrowRight className="size-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* right: exposure + where to look next */}
        <div className="flex flex-col gap-2 xl:min-h-0">
          <section className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 xl:flex-1 dark:border-ink-800 dark:bg-ink-900">
            <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
              <Users className="size-3.5 text-navy-700 dark:text-white" /><h3 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Largest open exposures</h3>
              <span className="truncate text-[11px] text-ink-500">share of the loan book</span>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[12px]">
              {top.map((c, i) => {
                const share = book ? (n(c.amount) / book) * 100 : 0;
                return (
                  <div key={`${c.name}-${i}`}>
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{i + 1}. {c.name}<span className="ml-1.5 font-normal text-ink-500">{c.loans} loan{c.loans === 1 ? '' : 's'}</span></span><b className="num shrink-0">₹{amount(c.amount)}</b></div>
                    <div className="mt-1 flex items-center gap-2"><span className="h-2 flex-1 overflow-hidden rounded-sm bg-ink-100 dark:bg-ink-800"><span className="block h-full rounded-r-[3px] bg-navy-700 dark:bg-navy-300" style={{ width: `${Math.min(100, share)}%` }} /></span><span className="num w-10 text-right text-[11px] text-ink-500">{share.toFixed(1)}%</span></div>
                  </div>
                );
              })}
              {!top.length && <p className="py-6 text-center text-ink-400">No open loans</p>}
              {topShare >= 20 && (
                <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-px size-3.5 shrink-0" />One customer holds {topShare.toFixed(0)}% of the loan book. Spreading risk across more customers is safer.</p>
              )}
            </div>
          </section>
          <section className="shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            <p className="border-b border-ink-200 px-3 py-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white">Look deeper</p>
            {[[ChartNoAxesCombined, 'Business Analytics', 'trends, loans to watch, forecast', '/analytics'], [Activity, 'System Health', 'Day End checklist, backups, SMS', '/settings/health'], [Calculator, 'Interest Calculator', 'interest due on open loans', '/loans/calculator']].map(([I, t, s, to]) => (
              <button key={to} type="button" onClick={() => navigate(to)} className="flex w-full items-center gap-2.5 border-b border-ink-100 px-3 py-2 text-left last:border-0 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800">
                <I className="size-4 shrink-0 text-navy-700 dark:text-ink-300" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{t}</span><span className="block truncate text-[11px] text-ink-500">{s}</span></span><ArrowRight className="size-3.5 text-ink-400" />
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
