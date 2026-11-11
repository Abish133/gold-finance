import { RefreshCw, Printer, BookCheck, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { Button, Spinner } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { printTable } from '@/lib/printTable';
import { date } from '@/lib/format';
import { ExitButton } from '@/features/loans/desk';
import { NeedBranch } from '@/components/common/NeedBranch';

const ALL_OK = <p className="flex h-full min-h-16 items-center justify-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" />None - all in order</p>;
/** [5,6,7,9] -> [[5,7],[9,9]] - runs of consecutive numbers; anything not a number stays on its own */
const toRanges = (list) => {
  const out = [];
  for (const x of list) {
    const v = Number(x);
    const last = out[out.length - 1];
    if (Number.isInteger(v) && last && Number.isInteger(last[1]) && v === last[1] + 1) last[1] = v;
    else out.push([Number.isInteger(v) ? v : x, Number.isInteger(v) ? v : x]);
  }
  return out;
};
const Chips = ({ list, tone }) => {
  if (!list.length) return ALL_OK;
  const ranges = toRanges(list);
  const cls = tone === 'red' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <div className="space-y-2">
      {ranges.some(([f, t]) => f !== t) && (
        <div className="flex flex-wrap gap-1">
          {ranges.filter(([f, t]) => f !== t).map(([f, t]) => (
            <span key={`${f}-${t}`} className={clsx('num inline-flex items-baseline gap-1.5 rounded-sm px-2 py-0.5 text-[12px] font-bold', cls)}>
              {f} – {t}<span className="text-[10px] font-semibold opacity-70">{t - f + 1} nos</span>
            </span>
          ))}
        </div>
      )}
      {/* single numbers: equal cells so the columns line up */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1">
        {ranges.filter(([f, t]) => f === t).map(([f]) => <span key={f} className={clsx('num rounded-sm py-0.5 text-center text-[12px] font-bold', cls)}>{f}</span>)}
      </div>
    </div>
  );
};

/** One result box: header with a count, body scrolls on its own. */
const Box = ({ title, count, bad, children }) => (
  <section className="flex min-h-40 flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
      <span aria-hidden className={clsx('h-3.5 w-0.5 rounded-sm', count ? (bad ? 'bg-rose-600' : 'bg-amber-500') : 'bg-emerald-600')} />
      <span className="flex-1 truncate text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{title}</span>
      <span className={clsx('num rounded-sm px-1.5 text-[11px] font-bold', count ? (bad ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800') : 'bg-emerald-50 text-emerald-700')}>{count}</span>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
  </section>
);
const MiniTable = ({ head, rows }) => (
  <table className="w-full text-[12px]">
    <thead className="sticky top-0 bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr>{head.map((h) => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{rows}</tbody>
  </table>
);

/** Bill Book Check: missing loan numbers, missing / repeated paper bill book numbers, cancelled bills. */
export default function BillBookCheckPage() {
  const { isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data, isFetching, refetch } = useFetch(isAllBranches ? null : '/desk/bill-book-check');
  if (isAllBranches) return <NeedBranch action="check its bill book" />;
  if (!data) return <Spinner />;
  const print = () => printTable({ title: `Bill Book Check · ${data.fy}`, company, rows: [
    { k: 'Loans this year', v: `${data.total} (No ${data.first ?? '-'} to ${data.last ?? '-'})` },
    { k: 'Missing loan numbers', v: data.missingLoanNos.join(', ') || 'None' },
    { k: 'Missing bill book numbers', v: data.missingBillBook.join(', ') || 'None' },
    { k: 'Repeated bill book numbers', v: data.duplicateBillBook.map((d) => `${d.bill_book_no} (${d.loans})`).join('; ') || 'None' },
    { k: 'Cancelled bills', v: data.cancelled.map((c) => c.bill_no).join(', ') || 'None' },
  ], columns: [{ key: 'k', label: 'Check' }, { key: 'v', label: 'Result' }] });
  const checks = [
    ['Missing loan nos', data.missingLoanNos.length, true], ['Missing bill book nos', data.missingBillBook.length, false],
    ['Repeated bill book nos', data.duplicateBillBook.length, true], ['Cancelled bills', data.cancelled.length, false],
  ];
  return (
    /* fit-screen: the page fits the window; each result box scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <BookCheck className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Bill Book Check</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">Missing and repeated loan / bill book numbers, cancelled bills</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/15">
          {[['Year', data.fy], ['Loans', data.total], ['Numbers', `${data.first ?? '-'} – ${data.last ?? '-'}`]].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 border-l border-white/15 px-3 py-1 first:border-l-0"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">{k}</span><span className="num text-[13px] font-bold">{v}</span></div>
          ))}
        </div>
      </section>

      {/* quick verdict per check */}
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {checks.map(([l, cnt, bad]) => (
          <div key={l} className="relative border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
            <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', cnt ? (bad ? 'bg-rose-600' : 'bg-amber-500') : 'bg-emerald-600')} />
            <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
            <p className="flex items-baseline gap-2">
              <span className={clsx('num text-lg leading-tight font-bold', cnt ? (bad ? 'text-rose-600' : 'text-amber-700') : 'text-emerald-700')}>{cnt}</span>
              <span className="text-[11px] text-ink-500">{cnt ? (bad ? 'needs checking' : 'listed below') : 'all in order'}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-2">
        <Box title="Missing loan numbers" count={data.missingLoanNos.length} bad><Chips list={data.missingLoanNos} tone="red" /></Box>
        <Box title="Missing paper bill book numbers" count={data.missingBillBook.length}><Chips list={data.missingBillBook} tone="gold" /></Box>
        <Box title="Bill book number used more than once" count={data.duplicateBillBook.length} bad>
          {data.duplicateBillBook.length
            ? <MiniTable head={['Bill book no', 'Loans']} rows={data.duplicateBillBook.map((d) => <tr key={d.bill_book_no}><td className="num px-2 py-1 font-bold text-rose-700">{d.bill_book_no}</td><td className="num px-2">{d.loans}</td></tr>)} />
            : ALL_OK}
        </Box>
        <Box title="Cancelled bills" count={data.cancelled.length}>
          {data.cancelled.length
            ? <MiniTable head={['Loan', 'Date']} rows={data.cancelled.map((c) => <tr key={c.bill_no}><td className="num px-2 py-1 font-bold">{c.bill_no}</td><td className="num px-2">{date(c.loan_date)}</td></tr>)} />
            : <p className="flex h-full min-h-16 items-center justify-center text-[12px] text-ink-400">No cancelled bills</p>}
        </Box>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="outline" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Check again</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print</Button>
        <div className="ml-auto"><ExitButton /></div>
      </div>
    </div>
  );
}
