import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, Cell, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, FileSpreadsheet, Search, ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Input } from '@/components/ui';
import { toast } from 'sonner';
import { PageActions } from '@/components/common/PageActions';
import { downloadWorkbook } from '@/lib/excelCharts';
import { useFetch } from '@/hooks/useApi';
import { amount, compact, grams, n, today } from '@/lib/format';
import { isDarkMode } from '@/lib/appearance';
import { SHELL, Head, Chip, Toggle, Bar as FilterBar, F, RunButton, inp } from '@/features/accounts/compact';

/* ---------- chart colours: the validated reference palette (colour-blind safe), separate light / dark steps */
const PAL = {
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#6250d6', grid: '#e1e0d9', axis: '#898781', good: '#006300', bad: '#d03b3b', warn: '#b26b00', crit: '#d03b3b' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#9085e9', grid: '#2c2c2a', axis: '#898781', good: '#0ca30c', bad: '#e66767', warn: '#fab219', crit: '#e66767' },
};
const usePalette = () => {
  const [dark, setDark] = useState(isDarkMode());
  useEffect(() => { const on = () => setDark(isDarkMode()); window.addEventListener('gf-appearance', on); return () => window.removeEventListener('gf-appearance', on); }, []);
  return dark ? PAL.dark : PAL.light;
};

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1));
const RANGES = {
  month: ['This month', () => [dayjs(today()).startOf('month'), dayjs(today())]],
  last: ['Last month', () => [dayjs(today()).subtract(1, 'month').startOf('month'), dayjs(today()).subtract(1, 'month').endOf('month')]],
  q: ['3 months', () => [dayjs(today()).subtract(2, 'month').startOf('month'), dayjs(today())]],
  h: ['6 months', () => [dayjs(today()).subtract(5, 'month').startOf('month'), dayjs(today())]],
  fy: ['A/c year', () => [fyStart(), dayjs(today())]],
  y: ['12 months', () => [dayjs(today()).subtract(11, 'month').startOf('month'), dayjs(today())]],
};
const AGE = ['', '0-3 months', '3-6 months', '6-9 months', '9-12 months', 'Over 12 months'];
const SIZE = ['', 'Under 10K', '10K - 25K', '25K - 50K', '50K - 1L', '1L - 2L', 'Over 2L'];
const METALS = { GOLD: 'Gold', SILVER: 'Silver', MIX: 'Gold + Silver' };
const DOW = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/* where interest came from (money flow) */
const SOURCES = { ADVANCE: 'Advance (new loans)', INTEREST: 'Interest receipts', PART_PAYMENT: 'With part payments', RELEASE: 'At release', RENEW: 'At re-loan', TOPUP: 'Deducted at top-up', PENAL: 'Penal (late) interest' };
const MODE_NAMES = { CASH: 'Cash', UPI: 'UPI', ONLINE: 'Online', BANK: 'Bank / NEFT', CARD: 'Card', CHEQUE: 'Cheque' };
/* how much of today's metal value the loan + interest already uses */
const cover = (pct) => (pct >= 100 ? ['Over value', 'crit'] : pct >= 85 ? ['Close to value', 'warn'] : ['Watch', null]);

/* x-axis label for a period key */
const label = (k, group) => (group === 'month' ? dayjs(`${k}-01`).format('MMM YY') : group === 'week' ? `${dayjs(k).format('DD MMM')}` : dayjs(k).format('DD MMM'));

/* change vs the previous period: text colour = good / bad for the business, arrow = direction */
function Delta({ cur, prev, goodUp = true, pal }) {
  const c = n(cur); const p = n(prev);
  if (!p && !c) return <span className="text-[10px] text-ink-400">no data</span>;
  if (!p) return <span className="text-[10px] font-semibold text-ink-500">new this period</span>;
  const pct = Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const good = pct === 0 ? null : (pct > 0) === goodUp;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: good == null ? undefined : good ? pal.good : pal.bad }}>
      <Icon className="size-3" />{pct > 0 ? '+' : ''}{pct}%<span className="ml-1 font-normal text-ink-400">vs before</span>
    </span>
  );
}

function Kpi({ label: l, value, sub, children }) {
  return (
    <div className="min-w-0 border-ink-200 px-3 py-2 not-last:border-b sm:not-last:border-b-0 sm:not-last:border-r dark:border-ink-800">
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[18px] leading-tight font-bold text-navy-900 dark:text-white">{value}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">{children}{sub && <span className="truncate text-[10px] text-ink-500">{sub}</span>}</div>
    </div>
  );
}

/** chart card with a chart / table switch (the table is the accessible view of the same numbers) */
function ChartCard({ title, sub, legend, table, className, children, xl }) {
  const [view, setView] = useState('chart');
  return (
    <section className={clsx('flex min-w-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900', className)}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
        <div className="min-w-0 flex-1"><h3 className="truncate text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{title}</h3>{sub && <p className="truncate text-[11px] text-ink-500">{sub}</p>}</div>
        {legend && view === 'chart' && <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-600 dark:text-ink-300">{legend.map(([c, t]) => <span key={t} className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: c }} />{t}</span>)}</div>}
        {table && (
          <div className="flex overflow-hidden rounded-md border border-ink-200 dark:border-ink-700">
            {[['chart', BarChart3, 'Chart'], ['table', Table2, 'Table']].map(([k, I, t]) => (
              <button key={k} type="button" title={t} aria-label={`${t} view`} onClick={() => setView(k)} className={clsx('grid size-6 place-items-center', view === k ? 'bg-ink-100 text-navy-900 dark:bg-ink-800 dark:text-white' : 'text-ink-400 hover:text-ink-700')}><I className="size-3.5" /></button>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 p-2" data-xl={xl}>{view === 'chart' || !table ? children : table}</div>
    </section>
  );
}

/* small plain table used for the table views and the lists */
function MiniTable({ cols, rows, onRow }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold', c.right ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={clsx(onRow && 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
              {cols.map((c) => <td key={c.key} className={clsx('px-2 py-1', c.right && 'num text-right')}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length} className="py-6 text-center text-ink-400">No data for these filters</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* horizontal share bars (one hue, magnitude) for small breakdowns */
function ShareBars({ rows, labelKey, valueKey, fmt, color, extra }) {
  const max = Math.max(1, ...rows.map((r) => n(r[valueKey])));
  return (
    <div className="space-y-1.5 py-1">
      {rows.map((r) => (
        <div key={r[labelKey]} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-[12px]">
          <span className="truncate text-ink-700 dark:text-ink-200" title={r[labelKey]}>{r[labelKey]}</span>
          <span className="h-3 overflow-hidden rounded-sm bg-ink-100 dark:bg-ink-800"><span className="block h-full rounded-r-[4px]" style={{ width: `${(n(r[valueKey]) / max) * 100}%`, background: color }} /></span>
          <span className="num text-right font-semibold whitespace-nowrap">{fmt(r[valueKey])}{extra && <span className="ml-1.5 font-normal text-ink-500">{extra(r)}</span>}</span>
        </div>
      ))}
      {!rows.length && <p className="py-6 text-center text-[12px] text-ink-400">No data for these filters</p>}
    </div>
  );
}

const tip = { contentStyle: { fontSize: 12, borderRadius: 6, padding: '6px 8px' }, labelStyle: { fontWeight: 700, marginBottom: 2 } };

/** Analytics: any period, grouped by day / week / month, compared with the period before it. */
export default function AnalyticsPage() {
  const navigate = useNavigate();
  const pal = usePalette();
  const [range, setRange] = useState('h');
  const [f, setF] = useState(() => { const [a, b] = RANGES.h[1](); return { from: a.format('YYYY-MM-DD'), to: b.format('YYYY-MM-DD'), group: 'auto', metal: '' }; });
  const [q, setQ] = useState(f);
  const { data, isLoading, isFetching } = useFetch('/dashboard/analytics', { from: q.from, to: q.to, group: q.group === 'auto' ? undefined : q.group, metal: q.metal || undefined });
  const ins = useFetch('/dashboard/analytics/insights', { from: q.from, to: q.to, metal: q.metal || undefined });
  const more = useFetch('/dashboard/analytics/more', { from: q.from, to: q.to, metal: q.metal || undefined });
  const hold = useFetch('/dashboard/analytics/holdings', { from: q.from, to: q.to, metal: q.metal || undefined });
  const flw = useFetch('/dashboard/analytics/flows', { from: q.from, to: q.to, group: q.group === 'auto' ? undefined : q.group, metal: q.metal || undefined });
  const pick = (k) => { const [a, b] = RANGES[k][1](); const nf = { ...f, from: a.format('YYYY-MM-DD'), to: b.format('YYYY-MM-DD') }; setRange(k); setF(nf); setQ(nf); };
  const setNow = (patch) => { const nf = { ...f, ...patch }; setF(nf); setQ(nf); };

  const d = data;
  const [xlBusy, setXlBusy] = useState(false);
  /* Excel: each table of the page, with its chart drawn as a picture beside it */
  const excel = async () => {
    if (!d) return;
    setXlBusy(true);
    try {
      const el = (k) => document.querySelector(`[data-xl="${k}"]`);
      const i = ins.data; const m = more.data;
      const pct = (c, p) => (n(p) ? Math.round(((n(c) - n(p)) / Math.abs(n(p))) * 1000) / 10 : '');
      const cur2 = d.current; const prv = d.previous;
      const money2 = (key, label) => ({ key, label, money: true });
      await downloadWorkbook(`analytics-${d.from}-to-${d.to}.xlsx`, {
        title: 'Business Analytics',
        subtitle: `${dayjs(d.from).format('DD MMM YYYY')} to ${dayjs(d.to).format('DD MMM YYYY')} · compared with ${dayjs(d.prevFrom).format('DD MMM YYYY')} to ${dayjs(d.prevTo).format('DD MMM YYYY')}${d.metal ? ` · ${METALS[d.metal]}` : ''}`,
        sheets: [
          { name: 'Summary', blocks: [{ title: 'This period vs before', columns: [{ key: 'k', label: 'Figure', width: 28 }, money2('c', 'This period'), money2('p', 'Before'), { key: 'x', label: 'Change %', num: true }],
            rows: [['Loan amount given', cur2.lent, prv.lent], ['Loan amount recovered', cur2.recovered, prv.recovered], ['Net lent (given − recovered)', n(cur2.lent) - n(cur2.recovered), n(prv.lent) - n(prv.recovered)], ['Interest collected', cur2.interest, prv.interest],
              ['New loans', cur2.cnt, prv.cnt], ['Releases', cur2.releases, prv.releases], ['Average loan', cur2.avg_loan, prv.avg_loan]].map(([k, c, p]) => ({ k, c: n(c), p: n(p), x: pct(c, p) })) }] },
          { name: 'Trend', blocks: [
            { title: 'Loan amount given vs recovered', chart: el('given'), columns: [{ key: 'name', label: 'Period' }, money2('lent', 'Given'), money2('recovered', 'Recovered')], rows: series },
            { title: 'Interest collected', chart: el('interest'), columns: [{ key: 'name', label: 'Period' }, money2('interest', 'Interest')], rows: series },
            { title: 'New loans vs releases', chart: el('counts'), columns: [{ key: 'name', label: 'Period' }, { key: 'loans', label: 'New loans', num: true }, { key: 'releases', label: 'Releases', num: true }], rows: series },
          ] },
          ...(flow ? [{ name: 'Money flow', blocks: [
            { title: 'Money flow this period', columns: [{ key: 'k', label: 'Figure', width: 34 }, money2('v', 'Value')],
              rows: [['Net lent (given − recovered)', flow.net], ['Loan book at the start', fl.opening], ['Loan book at the end', fl.closing], ['Paid out to customers', flow.paidOut],
                ['Received from customers', flow.received], ['Net cash (received − paid out)', flow.netCash], ['Top-ups given', fl.topups.amt],
                ['Interest given up below Auto', flow.givenUp], ['Discounts', fl.concessions.discount]].map(([k, v]) => ({ k, v: n(v) })) },
            { title: 'Net lent per period', chart: el('net'), columns: [{ key: 'name', label: 'Period' }, money2('net', 'Given − recovered')], rows: flow.rows },
            { title: 'Loan book over time', chart: el('book'), columns: [{ key: 'name', label: 'Period end' }, money2('book', 'Outstanding')], rows: flow.rows },
            { title: 'Cash out vs cash in', chart: el('cashflow'), columns: [{ key: 'name', label: 'Period' }, money2('out', 'Paid out'), money2('inn', 'Received'), money2('cash', 'Net')], rows: flow.rows },
            { title: 'Interest - running total', chart: el('cumint'), columns: [{ key: 'name', label: 'Period' }, money2('cumInt', 'Total so far')], rows: flow.rows },
            { title: 'Where the interest came from', columns: [{ key: 'name', label: 'Source' }, { key: 'cnt', label: 'Entries', num: true }, money2('amt', 'Interest')], rows: flow.src },
            { title: 'Received by payment mode', columns: [{ key: 'name', label: 'Mode' }, { key: 'cnt', label: 'Entries', num: true }, money2('amt', 'Amount')], rows: flow.modesIn },
            { title: 'Paid out by payment mode', columns: [{ key: 'name', label: 'Mode' }, { key: 'cnt', label: 'Entries', num: true }, money2('amt', 'Amount')], rows: flow.modesOut },
          ] }] : []),
          ...(hold.data ? [{ name: 'Metal by branch', blocks: [
            { title: 'Metal in custody by branch', columns: [{ key: 'branch', label: 'Branch' }, { key: 'metal', label: 'Metal', value: (r) => METALS[r.metal] || r.metal }, { key: 'loans', label: 'Loans', num: true }, { key: 'pcs', label: 'Pcs', num: true },
              { key: 'gross', label: 'Gross (g)', num: true }, { key: 'net', label: 'Net (g)', num: true }, { key: 'fine', label: 'Fine (g)', num: true }, money2('value', 'Value today'), money2('loan', 'Loan'), money2('canLend', 'Can still lend')], rows: hold.data.byBranchMetal },
            { title: 'Gold held by branch', chart: el('held-GOLD'), columns: [{ key: 'name', label: 'Branch' }, { key: 'goldNet', label: 'Net (g)', num: true }, { key: 'goldFine', label: 'Fine (g)', num: true }, money2('goldLoan', 'Loan')], rows: hold.data.byBranch },
            { title: 'Silver held by branch', chart: el('held-SILVER'), columns: [{ key: 'name', label: 'Branch' }, { key: 'silverNet', label: 'Net (g)', num: true }, { key: 'silverFine', label: 'Fine (g)', num: true }, money2('silverLoan', 'Loan')], rows: hold.data.byBranch },
            { title: 'Loan vs metal value by branch', chart: el('loan-value'), columns: [{ key: 'name', label: 'Branch' }, money2('loan', 'Loan'), money2('value', 'Value today')], rows: hold.data.byBranch },
            { title: 'Branches in this period', chart: el('branch-flow'), columns: [{ key: 'name', label: 'Branch' }, { key: 'newLoans', label: 'New loans', num: true }, money2('lent', 'Given'), money2('recovered', 'Recovered'), money2('interest', 'Interest'),
              money2('lentGold', 'Gold given'), money2('lentSilver', 'Silver given'), money2('lentMix', 'Gold + silver given')], rows: hold.data.byBranch },
          ] }] : []),
          { name: 'Loan book', blocks: [
            { title: 'Open loans by age', columns: [{ key: 'age', label: 'Age' }, { key: 'loans', label: 'Loans', num: true }, money2('amount', 'Amount')], rows: d.ageing.map((r) => ({ ...r, age: AGE[r.bucket] })) },
            { title: 'Loan sizes given', columns: [{ key: 'size', label: 'Loan amount' }, { key: 'loans', label: 'Loans', num: true }, money2('amount', 'Total')], rows: d.sizes.map((r) => ({ ...r, size: SIZE[r.bucket] })) },
            { title: 'Open loans by metal', columns: [{ key: 'metal', label: 'Metal', value: (r) => METALS[r.metal] || r.metal }, { key: 'loans', label: 'Loans', num: true }, { key: 'net_wt', label: 'Weight (g)', num: true }, money2('outstanding', 'Outstanding')], rows: d.byMetal },
            { title: 'Loan amount by scheme', columns: [{ key: 'name', label: 'Scheme' }, { key: 'loans', label: 'Loans', num: true }, money2('lent', 'Given')], rows: d.byScheme },
            { title: 'Loan amount by branch', columns: [{ key: 'name', label: 'Branch' }, { key: 'loans', label: 'Loans', num: true }, money2('lent', 'Given')], rows: d.byBranch },
          ] },
          ...(i ? [{ name: 'Insights', blocks: [
            { title: 'Loan book health (estimates)', columns: [{ key: 'k', label: 'Figure', width: 34 }, money2('v', 'Value')],
              rows: [['Interest built up, not yet paid', i.book.accrued], ['Expected interest per month', i.book.monthly_run_rate], ['Metal value today', i.book.value_now], ['Metal value at loan time', i.book.value_at_loan],
                ['Loans close to their value (count)', i.book.at_risk], ['Loans over their value (count)', i.book.underwater]].map(([k, v]) => ({ k, v: n(v) })) },
            { title: 'Gold rate per gram', chart: el('rate-gold'), columns: [{ key: 'd', label: 'Date', value: (r) => dayjs(r.d).format('DD/MM/YYYY') }, money2('gold', 'Gold / g')], rows: i.goldTrend.filter((r) => r.gold != null) },
            { title: 'Silver rate per gram', chart: el('rate-silver'), columns: [{ key: 'd', label: 'Date', value: (r) => dayjs(r.d).format('DD/MM/YYYY') }, money2('silver', 'Silver / g')], rows: i.goldTrend.filter((r) => r.silver != null) },
            { title: 'Busiest days of the week', chart: el('weekday'), columns: [{ key: 'dow', label: 'Day', value: (r) => DOW[r.dow] }, { key: 'loans', label: 'Loans', num: true }, money2('lent', 'Amount')], rows: i.weekday },
            { title: 'Top areas', columns: [{ key: 'area', label: 'Area' }, { key: 'loans', label: 'Loans', num: true }, money2('outstanding', 'Outstanding')], rows: i.areas },
            { title: 'Loans to watch', columns: [{ key: 'bill_no', label: 'Loan' }, { key: 'customer_name', label: 'Customer' }, money2('current_principal', 'Loan'), money2('accrued', 'Interest'), money2('value_now', 'Value now'), { key: 'cover_pct', label: 'Used %', value: (r) => Math.round(n(r.cover_pct)) }], rows: i.risky },
          ] }] : []),
          ...(m ? [{ name: 'Plan & watch', blocks: [
            { title: 'Next 30 days - loans reaching settle date', chart: el('next30'), columns: [{ key: 'd', label: 'Date', value: (r) => dayjs(r.d).format('DD/MM/YYYY') }, { key: 'loans', label: 'Loans', num: true }, money2('amount', 'Amount')], rows: m.forecast.dueNext },
            { title: 'Cash count differences', chart: el('cash'), columns: [{ key: 'd', label: 'Date', value: (r) => dayjs(r.d).format('DD/MM/YYYY') }, { key: 'branch', label: 'Branch' }, money2('difference', 'Difference')], rows: m.cashVar },
            { title: 'Best customers', columns: [{ key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, money2('interest_paid', 'Interest paid'), { key: 'on_time', label: 'Released on time', value: (r) => (n(r.releases) ? `${r.on_time} of ${r.releases}` : '') }], rows: m.bestCustomers },
            { title: 'Branch league', columns: [{ key: 'name', label: 'Branch' }, money2('lent', 'Given'), money2('interest', 'Interest'), { key: 'open_loans', label: 'Open', num: true }, { key: 'overdue', label: 'Overdue', num: true }, money2('cash_diff', 'Cash diff')], rows: m.league },
          ] }] : []),
          { name: 'Top customers', blocks: [{ title: 'Top 10 customers by outstanding', columns: [{ key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'loans', label: 'Loans', num: true }, { key: 'net_wt', label: 'Weight (g)', num: true }, money2('outstanding', 'Outstanding')], rows: d.topCustomers }] },
        ],
      });
    } catch (e) { toast.error(e.message || 'Could not make the Excel file'); }
    setXlBusy(false);
  };
  const series = useMemo(() => (d?.series || []).map((r) => ({ ...r, name: label(r.k, d.group) })), [d]);
  const cur = d?.current || {}; const prev = d?.previous || {};
  /* ---------- money flow (derived) ---------- */
  const fl = flw.data;
  const flow = useMemo(() => {
    if (!d || !fl) return null;
    const tm = new Map(fl.series.map((r) => [r.k, r]));
    let cumInt = 0;
    const rows = series.map((r) => {
      const x = tm.get(r.k) || {};
      const out = n(r.lent) + n(x.topups);
      const inn = n(r.recovered) + n(r.interest);
      cumInt += n(r.interest);
      return { name: r.name, k: r.k, net: Math.round(n(r.lent) - n(r.recovered)), out, inn, cash: Math.round(inn - out), book: n(x.book), topups: n(x.topups), cumInt: Math.round(cumInt) };
    });
    const sumMode = (dir) => fl.modes.filter((m) => m.dir === dir).reduce((a, m) => a + n(m.amt), 0);
    const paidOut = sumMode('OUT') || n(cur.lent) + n(fl.topups.amt);
    const received = sumMode('IN') || n(cur.recovered) + n(cur.interest) - n(fl.advance.amt);
    const avgBook = rows.length ? rows.reduce((a, r) => a + r.book, 0) / rows.length : n(fl.closing);
    const months = Math.max(1, dayjs(d.to).diff(dayjs(d.from), 'day') + 1) / 30.4;
    const src = [{ k: 'ADVANCE', amt: n(fl.advance.amt), cnt: n(fl.advance.cnt) },
      ...fl.sources.map((x) => ({ k: x.src, amt: n(x.interest), cnt: n(x.cnt) })),
      { k: 'PENAL', amt: fl.sources.reduce((a, x) => a + n(x.penal), 0), cnt: fl.sources.filter((x) => n(x.penal) > 0).reduce((a, x) => a + n(x.cnt), 0) }]
      .filter((x) => x.amt > 0).map((x) => ({ ...x, name: SOURCES[x.k] || x.k })).sort((a, b) => b.amt - a.amt);
    const modeRows = (dir) => fl.modes.filter((m) => m.dir === dir).map((m) => ({ name: MODE_NAMES[m.mode] || m.mode, amt: n(m.amt), cnt: n(m.cnt) })).sort((a, b) => b.amt - a.amt);
    return {
      rows, paidOut, received, netCash: received - paidOut, avgBook,
      net: n(cur.lent) - n(cur.recovered), netPrev: n(prev.lent) - n(prev.recovered),
      recoveryPct: n(cur.lent) ? (n(cur.recovered) / n(cur.lent)) * 100 : 0,
      yieldPm: avgBook ? (n(cur.interest) / avgBook / months) * 100 : 0,
      bookChange: fl.opening ? ((fl.closing - fl.opening) / fl.opening) * 100 : 0,
      src, modesIn: modeRows('IN'), modesOut: modeRows('OUT'),
      manualAmt: n(fl.manual.byDaysAmt) + n(fl.manual.typedRateAmt),
      givenUp: n(fl.concessions.reduced) + n(fl.concessions.penal),
    };
  }, [d, fl, series, cur, prev]);
  const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: pal.axis };
  const money = (v) => compact(v);

  return (
    /* fit-screen: filters stay at the top, the charts scroll */
    <div className={SHELL}>
      <Head icon={ChartNoAxesCombined} title="Business Analytics" sub="Trends, comparison with the previous period, loan ageing and top customers">
        {d && <Chip label="Period" value={`${dayjs(d.from).format('DD MMM YY')} - ${dayjs(d.to).format('DD MMM YY')}`} />}
        {d && <Chip label="Compared with" value={`${dayjs(d.prevFrom).format('DD MMM YY')} - ${dayjs(d.prevTo).format('DD MMM YY')}`} />}
      </Head>

      <PageActions keys="Excel: every table of this page with its chart as a picture">
        <Button variant="outline" icon={FileSpreadsheet} loading={xlBusy} disabled={!d} onClick={excel}>Excel with charts</Button>
      </PageActions>

      <FilterBar>
        <Toggle options={Object.entries(RANGES).map(([k, [l]]) => [k, l])} value={range} onChange={pick} />
        <F label="From"><Input type="date" className={`${inp} w-36`} value={f.from} onChange={(e) => { setRange(''); setF({ ...f, from: e.target.value }); }} /></F>
        <F label="To"><Input type="date" className={`${inp} w-36`} value={f.to} onChange={(e) => { setRange(''); setF({ ...f, to: e.target.value }); }} /></F>
        <F label="Show by"><Toggle value={f.group} onChange={(v) => setNow({ group: v })} options={[['auto', 'Auto'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} /></F>
        <F label="Metal"><Toggle value={f.metal} onChange={(v) => setNow({ metal: v })} options={[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']]} /></F>
        <RunButton className="ml-auto" icon={Search} label={isFetching ? 'Loading…' : 'Show'} onClick={() => setQ(f)} />
      </FilterBar>

      <div className={clsx('flex flex-col gap-2 overflow-y-auto xl:min-h-0 xl:flex-1', isFetching && !isLoading && 'opacity-70 transition-opacity')}>
        {isLoading || !d ? (
          <div className="grid gap-2 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />)}</div>
        ) : (
          <>
            {/* headline figures with the change against the previous period */}
            <div className="grid shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-3 xl:grid-cols-6 dark:border-ink-800 dark:bg-ink-900">
              <Kpi label="Loan amount given" value={money(cur.lent)}><Delta cur={cur.lent} prev={prev.lent} pal={pal} /></Kpi>
              <Kpi label="Loan amount recovered" value={money(cur.recovered)}><Delta cur={cur.recovered} prev={prev.recovered} pal={pal} /></Kpi>
              <Kpi label="Interest collected" value={money(cur.interest)}><Delta cur={cur.interest} prev={prev.interest} pal={pal} /></Kpi>
              <Kpi label="New loans" value={n(cur.cnt)} sub={`${n(cur.customers)} customers`}><Delta cur={cur.cnt} prev={prev.cnt} pal={pal} /></Kpi>
              <Kpi label="Releases" value={n(cur.releases)}><Delta cur={cur.releases} prev={prev.releases} pal={pal} /></Kpi>
              <Kpi label="Average loan" value={money(cur.avg_loan)} sub={`${n(cur.avg_rate).toFixed(2)}% avg rate`}><Delta cur={cur.avg_loan} prev={prev.avg_loan} pal={pal} /></Kpi>
            </div>

            {/* ---------- money flow: net lending, loan book, cash in / out ---------- */}
            {flow && (
              <section className="shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                <header className="flex min-h-9 flex-wrap items-center gap-x-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
                  <h3 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Money flow</h3>
                  <span className="truncate text-[11px] text-ink-500">given minus recovered, the loan book, and cash in / out with customers in this period</span>
                </header>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                  <Kpi label="Net lent (given − recovered)" value={`${flow.net < 0 ? '−' : ''}${money(Math.abs(flow.net))}`} sub={flow.net >= 0 ? 'more given than recovered' : 'more recovered than given'}>
                    <Delta cur={flow.net} prev={flow.netPrev} pal={pal} />
                  </Kpi>
                  <Kpi label="Loan book (outstanding)" value={money(fl.closing)} sub={`from ${money(fl.opening)} at the start`}>
                    <span className="text-[11px] font-semibold" style={{ color: Math.abs(flow.bookChange) < 0.05 ? undefined : flow.bookChange > 0 ? pal.good : pal.bad }}>{flow.bookChange > 0 ? '+' : ''}{flow.bookChange.toFixed(1)}%</span>
                  </Kpi>
                  <Kpi label="Recovered vs given" value={n(cur.lent) ? `${flow.recoveryPct.toFixed(0)}%` : '-'} sub={`${money(cur.recovered)} back of ${money(cur.lent)} given`} />
                  <Kpi label="Interest earned / month" value={`${flow.yieldPm.toFixed(2)}%`} sub={`of the average book ${money(flow.avgBook)}`} />
                </div>
                <div className="grid border-t border-ink-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-ink-800">
                  <Kpi label="Paid out to customers" value={money(flow.paidOut)} sub={`new loans + ${n(fl.topups.cnt)} top-up${n(fl.topups.cnt) === 1 ? '' : 's'} (${money(fl.topups.amt)})`}>
                  </Kpi>
                  <Kpi label="Received from customers" value={money(flow.received)} sub="loan amount back + interest" />
                  <Kpi label="Net cash (received − paid out)" value={`${flow.netCash < 0 ? '−' : ''}${money(Math.abs(flow.netCash))}`} sub={flow.netCash >= 0 ? 'more cash came in' : 'more cash went out'}>
                    <span className="text-[11px] font-semibold" style={{ color: flow.netCash >= 0 ? pal.good : pal.warn }}>{flow.netCash >= 0 ? 'cash in' : 'cash out'}</span>
                  </Kpi>
                  <Kpi label="Interest given up" value={money(flow.givenUp + n(fl.concessions.discount))}
                    sub={`${money(flow.givenUp)} below Auto on ${n(fl.concessions.loans)} loan${n(fl.concessions.loans) === 1 ? '' : 's'} · ${money(fl.concessions.discount)} discounts`} />
                </div>
              </section>
            )}

            {flow && (
              <div className="grid gap-2 lg:grid-cols-2">
                <ChartCard xl="net" title="Net lent per period" sub={`given − recovered per ${d.group} · above the line = more given (book grows), below = more recovered`}
                  legend={[[pal.s1, 'More given'], [pal.s2, 'More recovered']]}
                  table={<MiniTable rows={flow.rows} cols={[{ key: 'name', label: 'Period' }, { key: 'net', label: 'Given − recovered', right: true, render: (r) => `${r.net > 0 ? '+' : ''}${amount(r.net)}` }]} />}>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={flow.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={pal.grid} />
                        <XAxis dataKey="name" {...axis} minTickGap={16} />
                        <YAxis {...axis} width={64} tickFormatter={money} />
                        <ReferenceLine y={0} stroke={pal.axis} />
                        <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v) => [`${v > 0 ? '+' : ''}₹${amount(v)}`, v >= 0 ? 'More given' : 'More recovered']} />
                        <Bar dataKey="net" name="Given − recovered" radius={[4, 4, 4, 4]} maxBarSize={32}>
                          {flow.rows.map((r, k) => <Cell key={k} fill={r.net >= 0 ? pal.s1 : pal.s2} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard xl="book" title="Loan book over time" sub={`outstanding at the end of each ${d.group} · ${money(fl.opening)} → ${money(fl.closing)}`}
                  table={<MiniTable rows={flow.rows} cols={[{ key: 'name', label: 'Period end' }, { key: 'book', label: 'Outstanding', right: true, render: (r) => amount(r.book) }]} />}>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <AreaChart data={flow.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={pal.grid} />
                        <XAxis dataKey="name" {...axis} minTickGap={16} />
                        <YAxis {...axis} width={64} tickFormatter={money} domain={['auto', 'auto']} />
                        <Tooltip {...tip} formatter={(v) => [`₹${amount(v)}`, 'Outstanding']} />
                        <Area type="monotone" dataKey="book" name="Outstanding" stroke={pal.s1} strokeWidth={2} fill={pal.s1} fillOpacity={0.12} dot={flow.rows.length <= 31 ? { r: 3 } : false} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard xl="cashflow" title="Cash out vs cash in" sub={`per ${d.group} · out = new loans + top-ups · in = loan amount back + interest`}
                  legend={[[pal.s1, 'Paid out'], [pal.s3, 'Received']]}
                  table={<MiniTable rows={flow.rows} cols={[{ key: 'name', label: 'Period' }, { key: 'out', label: 'Paid out', right: true, render: (r) => amount(r.out) }, { key: 'inn', label: 'Received', right: true, render: (r) => amount(r.inn) }, { key: 'cash', label: 'Net', right: true, render: (r) => `${r.cash > 0 ? '+' : ''}${amount(r.cash)}` }]} />}>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={flow.rows} barGap={2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={pal.grid} />
                        <XAxis dataKey="name" {...axis} minTickGap={16} />
                        <YAxis {...axis} width={64} tickFormatter={money} />
                        <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k) => [`₹${amount(v)}`, k]} />
                        <Bar dataKey="out" name="Paid out" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="inn" name="Received" fill={pal.s3} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard xl="cumint" title="Interest collected - running total" sub={`adds up through the period · ${money(cur.interest)} in all`}
                  table={<MiniTable rows={flow.rows} cols={[{ key: 'name', label: 'Period' }, { key: 'cumInt', label: 'Total so far', right: true, render: (r) => amount(r.cumInt) }]} />}>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <AreaChart data={flow.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={pal.grid} />
                        <XAxis dataKey="name" {...axis} minTickGap={16} />
                        <YAxis {...axis} width={64} tickFormatter={money} />
                        <Tooltip {...tip} formatter={(v) => [`₹${amount(v)}`, 'Interest so far']} />
                        <Area type="monotone" dataKey="cumInt" name="Interest so far" stroke={pal.s3} strokeWidth={2} fill={pal.s3} fillOpacity={0.12} dot={false} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard title="Where the interest came from" sub="this period · advance, receipts, part payments, release, re-loan, top-up, penal"
                  table={<MiniTable rows={flow.src} cols={[{ key: 'name', label: 'Source' }, { key: 'cnt', label: 'Entries', right: true }, { key: 'amt', label: 'Interest', right: true, render: (r) => amount(r.amt) }]} />}>
                  <ShareBars rows={flow.src} labelKey="name" valueKey="amt" fmt={(v) => `₹${amount(v)}`} color={pal.s3}
                    extra={(r) => `${n(cur.interest) ? Math.round((r.amt / n(cur.interest)) * 100) : 0}% · ${r.cnt}`} />
                </ChartCard>

                <ChartCard title="Interest: Auto and Manual" sub="receipts in this period charged by days or at a typed rate, and what was given up">
                  <div className="space-y-2 py-1 text-[12px]">
                    <ShareBars labelKey="name" valueKey="amt" fmt={(v) => `₹${amount(v)}`} color={pal.s4}
                      rows={[{ name: 'Auto / months', amt: Math.max(0, n(cur.interest) - flow.manualAmt - n(fl.advance.amt)) + n(fl.advance.amt), cnt: Math.max(0, n(fl.manual.receipts) - n(fl.manual.byDays)) },
                        { name: 'Manual - by days', amt: n(fl.manual.byDaysAmt), cnt: n(fl.manual.byDays) },
                        { name: 'Manual - typed rate', amt: n(fl.manual.typedRateAmt), cnt: n(fl.manual.typedRate) }].filter((r) => r.amt > 0 || r.cnt > 0)}
                      extra={(r) => `${r.cnt} receipt${r.cnt === 1 ? '' : 's'}`} />
                    <div className="grid grid-cols-3 gap-2 border-t border-ink-100 pt-2 dark:border-ink-800">
                      {[['Below Auto at closing', flow.givenUp, `${n(fl.concessions.loans)} loans`], ['Penal waived', n(fl.concessions.penal), 'release'], ['Discounts', n(fl.concessions.discount), `${n(fl.concessions.discountCnt)} entries`]].map(([k, v, s2]) => (
                        <div key={k} className="min-w-0"><p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{k}</p><p className="num text-[15px] font-bold">₹{amount(v)}</p><p className="text-[10px] text-ink-500">{s2}</p></div>
                      ))}
                    </div>
                  </div>
                </ChartCard>

                <ChartCard title="Money received by payment mode" sub="from customers in this period"
                  table={<MiniTable rows={flow.modesIn} cols={[{ key: 'name', label: 'Mode' }, { key: 'cnt', label: 'Entries', right: true }, { key: 'amt', label: 'Amount', right: true, render: (r) => amount(r.amt) }]} />}>
                  <ShareBars rows={flow.modesIn} labelKey="name" valueKey="amt" fmt={(v) => `₹${amount(v)}`} color={pal.s3}
                    extra={(r) => `${flow.received ? Math.round((r.amt / flow.received) * 100) : 0}%`} />
                </ChartCard>

                <ChartCard title="Money paid out by payment mode" sub="new loans and top-ups in this period"
                  table={<MiniTable rows={flow.modesOut} cols={[{ key: 'name', label: 'Mode' }, { key: 'cnt', label: 'Entries', right: true }, { key: 'amt', label: 'Amount', right: true, render: (r) => amount(r.amt) }]} />}>
                  <ShareBars rows={flow.modesOut} labelKey="name" valueKey="amt" fmt={(v) => `₹${amount(v)}`} color={pal.s1}
                    extra={(r) => `${flow.paidOut ? Math.round((r.amt / flow.paidOut) * 100) : 0}%`} />
                </ChartCard>
              </div>
            )}

            {/* ---------- metal in custody + branches ---------- */}
            {hold.data && (() => {
              const h = hold.data;
              const T = (m) => h.totals.find((t) => t.metal === m) || { loans: 0, pcs: 0, gross: 0, net: 0, fine: 0, value: 0, loan: 0, canLend: 0 };
              const g = T('GOLD'); const sv = T('SILVER');
              const value = g.value + sv.value; const loan = g.loan + sv.loan; const canLend = g.canLend + sv.canLend;
              const used = value ? (loan / value) * 100 : 0;
              const usedTone = used >= 100 ? pal.crit : used >= 85 ? pal.warn : pal.good;
              const br = h.byBranch.map((r) => ({ ...r, used: r.value ? Math.round((r.loan / r.value) * 100) : 0, net: r.lent - r.recovered }));
              const many = br.length > 1;
              const bTable = (cols) => <MiniTable rows={br} cols={[{ key: 'name', label: 'Branch' }, ...cols]} />;
              const metalName = (m) => METALS[m] || m;
              return (
                <>
                  <section className="shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                    <header className="flex min-h-9 flex-wrap items-center gap-x-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
                      <h3 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Metal in custody</h3>
                      <span className="truncate text-[11px] text-ink-500">gold and silver held on open loans{many ? `, ${br.length} branches` : ''} · valued at the rate of {h.rates.GOLD ? `₹${amount(h.rates.GOLD.perGram)}/g gold` : 'no gold rate'}{h.rates.SILVER ? ` · ₹${amount(h.rates.SILVER.perGram)}/g silver` : ''} (100%)</span>
                    </header>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                      <Kpi label="Gold held" value={grams(g.net)} sub={`${grams(g.fine)} fine · ${n(g.pcs)} pcs · ${n(g.loans)} loan${n(g.loans) === 1 ? '' : 's'}`} />
                      <Kpi label="Silver held" value={grams(sv.net)} sub={`${grams(sv.fine)} fine · ${n(sv.pcs)} pcs · ${n(sv.loans)} loan${n(sv.loans) === 1 ? '' : 's'}`} />
                      <Kpi label="Gold loan outstanding" value={money(g.loan)} sub={`metal value ${money(g.value)}`} />
                      <Kpi label="Silver loan outstanding" value={money(sv.loan)} sub={`metal value ${money(sv.value)}`} />
                    </div>
                    <div className="grid border-t border-ink-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-ink-800">
                      <Kpi label="Metal value today" value={money(value)} sub={`gold ${money(g.value)} · silver ${money(sv.value)}`} />
                      <Kpi label="Loan used of value" value={value ? `${used.toFixed(1)}%` : '-'} sub={`${money(loan)} on ${money(value)}`}>
                        {value > 0 && <span className="text-[11px] font-semibold" style={{ color: usedTone }}>{used >= 100 ? 'over value' : used >= 85 ? 'close to value' : 'safe'}</span>}
                      </Kpi>
                      <Kpi label="Can still lend (top-up room)" value={money(Math.max(0, canLend))} sub="up to each scheme's LTV on today's value" />
                      <Kpi label="Gold in custody (fine)" value={`${(g.fine / 8).toFixed(2)} sov`} sub={`${grams(g.fine)} of 100% gold · 1 sovereign = 8 g`} />
                    </div>
                  </section>

                  <div className="grid gap-2 lg:grid-cols-2">
                    <ChartCard xl="hold-detail" title="Metal in custody by branch" sub={`open loans as on ${dayjs(h.asOn).format('DD MMM YYYY')}${many ? '' : ' · choose All Branches in the header to compare branches'}`} className="lg:col-span-2">
                      <MiniTable rows={h.byBranchMetal} cols={[{ key: 'branch', label: 'Branch', render: (r) => <span className="font-semibold">{r.branch}</span> }, { key: 'metal', label: 'Metal', render: (r) => metalName(r.metal) },
                        { key: 'loans', label: 'Loans', right: true }, { key: 'pcs', label: 'Pcs', right: true }, { key: 'gross', label: 'Gross', right: true, render: (r) => grams(r.gross) },
                        { key: 'net', label: 'Net', right: true, render: (r) => grams(r.net) }, { key: 'fine', label: 'Fine', right: true, render: (r) => grams(r.fine) },
                        { key: 'value', label: 'Value today', right: true, render: (r) => amount(r.value) }, { key: 'loan', label: 'Loan', right: true, render: (r) => amount(r.loan) },
                        { key: 'used', label: 'Used', right: true, render: (r) => { const u = r.value ? (r.loan / r.value) * 100 : 0; return <b style={{ color: u >= 100 ? pal.crit : u >= 85 ? pal.warn : undefined }}>{Math.round(u)}%</b>; } },
                        { key: 'canLend', label: 'Can still lend', right: true, render: (r) => amount(Math.max(0, r.canLend)) }]} />
                    </ChartCard>

                    {['GOLD', 'SILVER'].filter((m) => !q.metal || q.metal === m || q.metal === 'MIX').map((m) => (
                      <ChartCard key={m} xl={`held-${m}`} title={`${m === 'GOLD' ? 'Gold' : 'Silver'} held by branch`} sub="net weight on open loans (grams)"
                        table={bTable([{ key: m === 'GOLD' ? 'goldNet' : 'silverNet', label: 'Net (g)', right: true, render: (r) => grams(m === 'GOLD' ? r.goldNet : r.silverNet) }, { key: m === 'GOLD' ? 'goldFine' : 'silverFine', label: 'Fine (g)', right: true, render: (r) => grams(m === 'GOLD' ? r.goldFine : r.silverFine) }, { key: m === 'GOLD' ? 'goldLoan' : 'silverLoan', label: 'Loan', right: true, render: (r) => amount(m === 'GOLD' ? r.goldLoan : r.silverLoan) }])}>
                        {br.some((r) => (m === 'GOLD' ? r.goldNet : r.silverNet) > 0) ? (
                          <div style={{ height: Math.max(140, br.length * 44 + 40) }}>
                            <ResponsiveContainer>
                              <BarChart data={br} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke={pal.grid} />
                                <XAxis type="number" {...axis} tickFormatter={(v) => `${v} g`} />
                                <YAxis type="category" dataKey="name" {...axis} width={110} />
                                <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k, it) => [`${grams(v)} · loan ₹${amount(m === 'GOLD' ? it.payload.goldLoan : it.payload.silverLoan)}`, `${m === 'GOLD' ? 'Gold' : 'Silver'} net`]} />
                                <Bar dataKey={m === 'GOLD' ? 'goldNet' : 'silverNet'} name="Net weight" fill={m === 'GOLD' ? pal.s4 : pal.s5} radius={[0, 4, 4, 0]} maxBarSize={26} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : <p className="py-10 text-center text-[12px] text-ink-400">No {m === 'GOLD' ? 'gold' : 'silver'} on open loans</p>}
                      </ChartCard>
                    ))}

                    <ChartCard xl="loan-value" title="Loan vs metal value by branch" sub="outstanding loan against today's value of the metal held" legend={[[pal.s1, 'Loan'], [pal.s3, 'Metal value']]}
                      table={bTable([{ key: 'loan', label: 'Loan', right: true, render: (r) => amount(r.loan) }, { key: 'value', label: 'Value today', right: true, render: (r) => amount(r.value) }, { key: 'used', label: 'Used', right: true, render: (r) => `${r.used}%` }])}>
                      <div className="h-60">
                        <ResponsiveContainer>
                          <BarChart data={br} barGap={2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke={pal.grid} />
                            <XAxis dataKey="name" {...axis} interval={0} />
                            <YAxis {...axis} width={64} tickFormatter={money} />
                            <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k, it) => [`₹${amount(v)}${k === 'Loan' ? ` (${it.payload.used}% of value)` : ''}`, k]} />
                            <Bar dataKey="loan" name="Loan" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="value" name="Metal value" fill={pal.s3} radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard xl="branch-flow" title="Branches in this period" sub="loan amount given and recovered" legend={[[pal.s1, 'Given'], [pal.s2, 'Recovered']]}
                      table={bTable([{ key: 'newLoans', label: 'New loans', right: true }, { key: 'lent', label: 'Given', right: true, render: (r) => amount(r.lent) }, { key: 'recovered', label: 'Recovered', right: true, render: (r) => amount(r.recovered) }, { key: 'net', label: 'Net lent', right: true, render: (r) => `${r.net > 0 ? '+' : ''}${amount(r.net)}` }, { key: 'interest', label: 'Interest', right: true, render: (r) => amount(r.interest) }])}>
                      <div className="h-60">
                        <ResponsiveContainer>
                          <BarChart data={br} barGap={2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke={pal.grid} />
                            <XAxis dataKey="name" {...axis} interval={0} />
                            <YAxis {...axis} width={64} tickFormatter={money} />
                            <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k) => [`₹${amount(v)}`, k]} />
                            <Bar dataKey="lent" name="Given" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="recovered" name="Recovered" fill={pal.s2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Interest by branch" sub="collected in this period">
                      <ShareBars rows={br} labelKey="name" valueKey="interest" fmt={(v) => `₹${amount(v)}`} color={pal.s3} extra={(r) => `${r.releases} releases`} />
                    </ChartCard>

                    <ChartCard title="Can still lend by branch" sub="top-up room: each scheme's LTV on today's metal value minus the loan">
                      <ShareBars rows={br.map((r) => ({ ...r, canLendPos: Math.max(0, r.canLend) }))} labelKey="name" valueKey="canLendPos" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.used}% used`} />
                    </ChartCard>

                    <ChartCard title="Lending by metal and branch" sub="loan amount given in this period"
                      className={many ? '' : 'lg:col-span-2'}>
                      {bTable([{ key: 'lentGold', label: 'Gold', right: true, render: (r) => amount(r.lentGold) }, { key: 'lentSilver', label: 'Silver', right: true, render: (r) => amount(r.lentSilver) }, { key: 'lentMix', label: 'Gold + silver', right: true, render: (r) => amount(r.lentMix) }, { key: 'lent', label: 'Total', right: true, render: (r) => <b>{amount(r.lent)}</b> }])}
                    </ChartCard>
                  </div>
                </>
              );
            })()}

            <div className="grid gap-2 lg:grid-cols-2">
              <ChartCard xl="given" title="Loan amount given vs recovered" sub={`per ${d.group}`} legend={[[pal.s1, 'Given'], [pal.s2, 'Recovered']]}
                table={<MiniTable rows={series} cols={[{ key: 'name', label: 'Period' }, { key: 'lent', label: 'Given', right: true, render: (r) => amount(r.lent) }, { key: 'recovered', label: 'Recovered', right: true, render: (r) => amount(r.recovered) }]} />}>
                <div className="h-60">
                  <ResponsiveContainer>
                    <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={pal.grid} />
                      <XAxis dataKey="name" {...axis} minTickGap={16} />
                      <YAxis {...axis} width={64} tickFormatter={money} />
                      <Tooltip {...tip} formatter={(v, k) => [`₹${amount(v)}`, k]} />
                      <Line type="monotone" dataKey="lent" name="Given" stroke={pal.s1} strokeWidth={2} dot={series.length <= 31 ? { r: 3 } : false} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="recovered" name="Recovered" stroke={pal.s2} strokeWidth={2} dot={series.length <= 31 ? { r: 3 } : false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard xl="interest" title="Interest collected" sub={`per ${d.group} · advance + release + part payment`}
                table={<MiniTable rows={series} cols={[{ key: 'name', label: 'Period' }, { key: 'interest', label: 'Interest', right: true, render: (r) => amount(r.interest) }]} />}>
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={pal.grid} />
                      <XAxis dataKey="name" {...axis} minTickGap={16} />
                      <YAxis {...axis} width={64} tickFormatter={money} />
                      <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v) => [`₹${amount(v)}`, 'Interest']} />
                      <Bar dataKey="interest" name="Interest" fill={pal.s3} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard xl="counts" title="New loans vs releases" sub={`number of loans per ${d.group}`} legend={[[pal.s1, 'New loans'], [pal.s2, 'Releases']]}
                table={<MiniTable rows={series} cols={[{ key: 'name', label: 'Period' }, { key: 'loans', label: 'New loans', right: true }, { key: 'releases', label: 'Releases', right: true }]} />}>
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={series} barGap={2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={pal.grid} />
                      <XAxis dataKey="name" {...axis} minTickGap={16} />
                      <YAxis {...axis} width={40} allowDecimals={false} />
                      <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} />
                      <Bar dataKey="loans" name="New loans" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="releases" name="Releases" fill={pal.s2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Open loans by age" sub={`as on ${dayjs(d.to).format('DD MMM YYYY')} · older loans need follow-up`}
                table={<MiniTable rows={d.ageing} cols={[{ key: 'bucket', label: 'Age', render: (r) => AGE[r.bucket] }, { key: 'loans', label: 'Loans', right: true }, { key: 'amount', label: 'Amount', right: true, render: (r) => amount(r.amount) }]} />}>
                <ShareBars rows={d.ageing.map((r) => ({ ...r, name: AGE[r.bucket] }))} labelKey="name" valueKey="amount" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.loans} loans`} />
              </ChartCard>

              <ChartCard title="Loan sizes given" sub="how many loans of each amount in this period"
                table={<MiniTable rows={d.sizes} cols={[{ key: 'bucket', label: 'Loan amount', render: (r) => SIZE[r.bucket] }, { key: 'loans', label: 'Loans', right: true }, { key: 'amount', label: 'Total', right: true, render: (r) => amount(r.amount) }]} />}>
                <ShareBars rows={d.sizes.map((r) => ({ ...r, name: SIZE[r.bucket] }))} labelKey="name" valueKey="loans" fmt={(v) => `${n(v)} loans`} color={pal.s1} extra={(r) => `₹${compact(r.amount).replace('₹', '')}`} />
              </ChartCard>

              <ChartCard title="Open loans by metal" sub="outstanding amount and weight in custody">
                <ShareBars rows={d.byMetal.map((r) => ({ ...r, name: METALS[r.metal] || r.metal }))} labelKey="name" valueKey="outstanding" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.loans} loans · ${grams(r.net_wt)}`} />
              </ChartCard>

              <ChartCard title="Loan amount by scheme" sub="given in this period">
                <ShareBars rows={d.byScheme} labelKey="name" valueKey="lent" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.loans} loans`} />
              </ChartCard>

              {d.byBranch.length > 0 && (
                <ChartCard title="Loan amount by branch" sub="given in this period">
                  <ShareBars rows={d.byBranch} labelKey="name" valueKey="lent" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.loans} loans`} />
                </ChartCard>
              )}

              {/* ---------- insights: as on the end date ---------- */}
              {ins.data && (() => {
                const i = ins.data; const bk = i.book;
                const yieldPa = n(bk.outstanding) ? (n(bk.monthly_run_rate) * 12 * 100) / n(bk.outstanding) : 0;
                const valueChange = n(bk.value_at_loan) ? ((n(bk.value_now) - n(bk.value_at_loan)) / n(bk.value_at_loan)) * 100 : 0;
                const onTime = n(i.duration.released) ? Math.round((n(i.duration.on_time) / n(i.duration.released)) * 100) : 0;
                const returning = n(i.custMix.customers) - n(i.custMix.new_customers);
                const week = [2, 3, 4, 5, 6, 7, 1].map((dw) => { const r = i.weekday.find((x) => Number(x.dow) === dw) || {}; return { name: DOW[dw], loans: n(r.loans), lent: n(r.lent) }; });
                const trend = i.goldTrend.map((r) => ({ name: dayjs(r.d).format('DD MMM'), gold: r.gold == null ? null : n(r.gold), silver: r.silver == null ? null : n(r.silver) }));
                // the metal filter decides which rates to show: Gold, Silver, or both (Mix / All)
                const rateMetals = q.metal === 'GOLD' ? ['gold'] : q.metal === 'SILVER' ? ['silver'] : ['gold', 'silver'];
                return (
                  <>
                    <section className="lg:col-span-2 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                      <header className="flex min-h-9 items-center gap-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
                        <h3 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Loan book health</h3>
                        <span className="truncate text-[11px] text-ink-500">open loans as on {dayjs(i.asOn).format('DD MMM YYYY')} · interest figures are estimates (monthly rate, since the last interest paid)</span>
                      </header>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                        <Kpi label="Interest built up, not yet paid" value={money(bk.accrued)} sub={`on ${n(bk.loans)} open loans`} />
                        <Kpi label="Expected interest / month" value={money(bk.monthly_run_rate)} sub={`about ${yieldPa.toFixed(1)}% a year on ${money(bk.outstanding)}`} />
                        <Kpi label="Metal value today" value={money(bk.value_now)} sub={`at loan time ${money(bk.value_at_loan)}`}>
                          <span className="text-[11px] font-semibold" style={{ color: Math.abs(valueChange) < 0.05 ? undefined : valueChange > 0 ? pal.good : pal.bad }}>{valueChange > 0 ? '+' : ''}{valueChange.toFixed(1)}%</span>
                        </Kpi>
                        <Kpi label="Loans close to their value" value={n(bk.at_risk)} sub={`${money(bk.at_risk_amount)} · ${n(bk.underwater)} over value`}>
                          {n(bk.at_risk) > 0 && <span className="text-[11px] font-semibold" style={{ color: pal.crit }}>needs follow-up</span>}
                        </Kpi>
                      </div>
                      <div className="grid border-t border-ink-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-ink-800">
                        <Kpi label="Average days to release" value={n(i.duration.released) ? `${Math.round(n(i.duration.avg_days))} days` : '-'} sub={`${n(i.duration.released)} released in the period`} />
                        <Kpi label="Released before due date" value={n(i.duration.released) ? `${onTime}%` : '-'} sub={`${n(i.duration.on_time)} of ${n(i.duration.released)} loans`} />
                        <Kpi label="New customers" value={n(i.custMix.new_customers)} sub={`first loan in this period`} />
                        <Kpi label="Returning customers" value={returning} sub={`${n(i.custMix.customers) ? Math.round((returning / n(i.custMix.customers)) * 100) : 0}% of ${n(i.custMix.customers)} borrowers`} />
                      </div>
                    </section>

                    {rateMetals.map((mk) => {
                      const nameM = mk === 'gold' ? 'Gold' : 'Silver';
                      const rows = trend.filter((r) => r[mk] != null);
                      const first = rows[0]?.[mk]; const last = rows.at(-1)?.[mk];
                      const chg = first ? ((last - first) / first) * 100 : 0;
                      return (
                        <ChartCard key={mk} xl={`rate-${mk}`} title={`${nameM} rate in this period`} className={rateMetals.length === 1 ? 'lg:col-span-2' : ''}
                          sub={rows.length ? `per gram · ₹${amount(first)} → ₹${amount(last)} (${chg > 0 ? '+' : ''}${chg.toFixed(1)}%)` : 'per gram'}
                          table={<MiniTable rows={rows} cols={[{ key: 'name', label: 'Date' }, { key: mk, label: `${nameM} / g`, right: true, render: (r) => amount(r[mk]) }]} />}>
                          {rows.length ? (
                            <div className="h-56">
                              <ResponsiveContainer>
                                <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                  <CartesianGrid vertical={false} stroke={pal.grid} />
                                  <XAxis dataKey="name" {...axis} minTickGap={24} />
                                  <YAxis {...axis} width={56} domain={['auto', 'auto']} tickFormatter={(v) => (mk === 'gold' ? Math.round(v) : Number(v).toFixed(1))} />
                                  <Tooltip {...tip} formatter={(v) => [`₹${amount(v)}`, `${nameM} / g`]} />
                                  <Line type="monotone" dataKey={mk} name={`${nameM} / g`} stroke={mk === 'gold' ? pal.s4 : pal.s5} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : <p className="py-10 text-center text-[12px] text-ink-400">No {nameM.toLowerCase()} rates entered in this period</p>}
                        </ChartCard>
                      );
                    })}

                    <ChartCard xl="weekday" title="Busiest days of the week" sub="new loans given in this period"
                      table={<MiniTable rows={week} cols={[{ key: 'name', label: 'Day' }, { key: 'loans', label: 'Loans', right: true }, { key: 'lent', label: 'Amount', right: true, render: (r) => amount(r.lent) }]} />}>
                      <div className="h-56">
                        <ResponsiveContainer>
                          <BarChart data={week} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke={pal.grid} />
                            <XAxis dataKey="name" {...axis} />
                            <YAxis {...axis} width={40} allowDecimals={false} />
                            <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k, item) => [`${v} loans · ₹${amount(item.payload.lent)}`, 'New loans']} />
                            <Bar dataKey="loans" name="New loans" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Top areas" sub="outstanding on open loans, by customer area">
                      <ShareBars rows={i.areas} labelKey="area" valueKey="outstanding" fmt={(v) => `₹${amount(v)}`} color={pal.s1} extra={(r) => `${r.loans} loans`} />
                    </ChartCard>

                    <ChartCard title="Loans to watch" sub="loan + interest as a share of today's metal value · click to open">
                      <MiniTable rows={i.risky} onRow={(r) => navigate(`/loans/counter?loan=${r.id}`)}
                        cols={[{ key: 'bill_no', label: 'Loan', render: (r) => <span className="font-semibold">#{r.bill_no}</span> }, { key: 'customer_name', label: 'Customer' },
                          { key: 'current_principal', label: 'Loan', right: true, render: (r) => amount(r.current_principal) }, { key: 'accrued', label: 'Interest', right: true, render: (r) => amount(r.accrued) },
                          { key: 'value_now', label: 'Value now', right: true, render: (r) => amount(r.value_now) },
                          { key: 'cover_pct', label: 'Used', right: true, render: (r) => { const [t, tone] = cover(n(r.cover_pct)); return <span className="whitespace-nowrap"><b className="num" style={{ color: tone ? pal[tone] : undefined }}>{Math.round(n(r.cover_pct))}%</b><span className="ml-1 text-[10px] text-ink-500">{t}</span></span>; } }]} />
                    </ChartCard>
                  </>
                );
              })()}


              {/* ---------- plan & watch ---------- */}
              {more.data && (() => {
                const m = more.data;
                const due = m.forecast.dueNext.map((r) => ({ name: dayjs(r.d).format('DD MMM'), loans: n(r.loans), amount: n(r.amount) }));
                const dueAmt = due.reduce((x, r) => x + r.amount, 0); const dueCnt = due.reduce((x, r) => x + r.loans, 0);
                const cash = m.cashVar.map((r) => ({ name: dayjs(r.d).format('DD MMM'), diff: n(r.difference), branch: r.branch }));
                const w = m.watch;
                const watchCount = w.voids.length + w.offHours.length + w.bigLoans.length + w.sameDay.length;
                return (
                  <>
                    <ChartCard xl="next30" title="Next 30 days" sub={`after ${dayjs(q.to).format('DD MMM YYYY')} · ${dueCnt} loans reach their settle date (${money(dueAmt)}) · about ${money(m.forecast.interest_month)} interest builds up each month`}
                      table={<MiniTable rows={due} cols={[{ key: 'name', label: 'Settle date' }, { key: 'loans', label: 'Loans', right: true }, { key: 'amount', label: 'Amount', right: true, render: (r) => amount(r.amount) }]} />}>
                      {due.length ? (
                        <div className="h-56">
                          <ResponsiveContainer>
                            <BarChart data={due} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke={pal.grid} />
                              <XAxis dataKey="name" {...axis} minTickGap={16} />
                              <YAxis {...axis} width={64} tickFormatter={money} />
                              <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v, k, it) => [`₹${amount(v)} · ${it.payload.loans} loans`, 'Reaching settle date']} />
                              <Bar dataKey="amount" name="Amount" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="py-10 text-center text-[12px] text-ink-400">No open loan reaches its settle date in the next 30 days</p>}
                    </ChartCard>

                    <ChartCard xl="cash" title="Cash count differences" sub="each day's counted cash minus the books · above the line = excess, below = short"
                      table={<MiniTable rows={cash} cols={[{ key: 'name', label: 'Date' }, { key: 'branch', label: 'Branch' }, { key: 'diff', label: 'Difference', right: true, render: (r) => <span>{r.diff > 0 ? '+' : ''}{amount(r.diff)} <span className="text-[10px] text-ink-500">{r.diff > 0 ? 'excess' : r.diff < 0 ? 'short' : 'tally'}</span></span> }]} />}>
                      {cash.length ? (
                        <div className="h-56">
                          <ResponsiveContainer>
                            <BarChart data={cash} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke={pal.grid} />
                              <XAxis dataKey="name" {...axis} minTickGap={16} />
                              <YAxis {...axis} width={64} tickFormatter={money} />
                              <Tooltip {...tip} cursor={{ fill: pal.grid, opacity: 0.5 }} formatter={(v) => [`${v > 0 ? '+' : ''}₹${amount(v)} ${v > 0 ? '(excess)' : v < 0 ? '(short)' : '(tally)'}`, 'Difference']} />
                              <Bar dataKey="diff" name="Difference" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                {cash.map((r, k) => <Cell key={k} fill={r.diff < 0 ? pal.crit : pal.warn} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="py-10 text-center text-[12px] text-ink-400">No cash count in this period</p>}
                    </ChartCard>

                    <ChartCard title="Best customers" sub="most interest paid in this period · click to open">
                      <MiniTable rows={m.bestCustomers} onRow={(r) => navigate(`/customers?view=${r.id}`)}
                        cols={[{ key: 'name', label: 'Customer', render: (r) => <span className="font-semibold">{r.name}</span> }, { key: 'phone', label: 'Mobile' },
                          { key: 'interest_paid', label: 'Interest paid', right: true, render: (r) => amount(r.interest_paid) },
                          { key: 'releases', label: 'Released on time', right: true, render: (r) => (n(r.releases) ? `${r.on_time} of ${r.releases}` : '-') }]} />
                    </ChartCard>

                    {m.league.length > 0 && (
                      <ChartCard title="Branch league" sub="this period · overdue and cash differences as on the end date">
                        <MiniTable rows={m.league}
                          cols={[{ key: 'name', label: 'Branch', render: (r) => <span className="font-semibold">{r.name}</span> }, { key: 'lent', label: 'Given', right: true, render: (r) => amount(r.lent) },
                            { key: 'interest', label: 'Interest', right: true, render: (r) => amount(r.interest) }, { key: 'open_loans', label: 'Open', right: true },
                            { key: 'overdue', label: 'Overdue', right: true, render: (r) => `${r.overdue} (${n(r.open_loans) ? Math.round((n(r.overdue) / n(r.open_loans)) * 100) : 0}%)` },
                            { key: 'cash_diff', label: 'Cash diff', right: true, render: (r) => amount(r.cash_diff) }]} />
                      </ChartCard>
                    )}

                    <ChartCard title="Unusual activity" sub={`${watchCount} item${watchCount === 1 ? '' : 's'} to look at in this period`} className="lg:col-span-2">
                      {!watchCount ? <p className="py-6 text-center text-[12px] text-ink-400">Nothing unusual in this period</p> : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {w.bigLoans.length > 0 && (
                            <div><p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Loans far above the customer's usual</p>
                              <MiniTable rows={w.bigLoans} onRow={(r) => navigate(`/loans/counter?loan=${r.id}`)} cols={[{ key: 'bill_no', label: 'Loan', render: (r) => `#${r.bill_no}` }, { key: 'customer_name', label: 'Customer' },
                                { key: 'principal', label: 'This loan', right: true, render: (r) => amount(r.principal) }, { key: 'avg_prev', label: 'Usual', right: true, render: (r) => amount(r.avg_prev) }]} /></div>
                          )}
                          {w.sameDay.length > 0 && (
                            <div><p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">3 or more loans for one customer in a day</p>
                              <MiniTable rows={w.sameDay} onRow={(r) => navigate(`/customers?view=${r.id}`)} cols={[{ key: 'customer_name', label: 'Customer' }, { key: 'd', label: 'Date', render: (r) => dayjs(r.d).format('DD/MM/YYYY') },
                                { key: 'loans', label: 'Loans', right: true }, { key: 'amount', label: 'Amount', right: true, render: (r) => amount(r.amount) }]} /></div>
                          )}
                          {w.voids.length > 0 && (
                            <div><p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Deletes, voids and cancels by user</p>
                              <MiniTable rows={w.voids} cols={[{ key: 'full_name', label: 'User', render: (r) => r.full_name || 'System' }, { key: 'cnt', label: 'Count', right: true }, { key: 'last_at', label: 'Last', right: true, render: (r) => dayjs(r.last_at).format('DD/MM hh:mm A') }]} /></div>
                          )}
                          {w.offHours.length > 0 && (
                            <div><p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Logins before 7 AM or after 10 PM</p>
                              <MiniTable rows={w.offHours} cols={[{ key: 'full_name', label: 'User', render: (r) => r.full_name || '-' }, { key: 'created_at', label: 'When', render: (r) => dayjs(r.created_at).format('DD/MM/YYYY hh:mm A') }, { key: 'ip', label: 'From' }]} /></div>
                          )}
                        </div>
                      )}
                      {!w.canSeeAudit && <p className="mt-2 text-[11px] text-ink-400">Deletes and login times are shown only to users who can open the User Log.</p>}
                    </ChartCard>
                  </>
                );
              })()}

              <ChartCard title="Top 10 customers" sub="by outstanding amount on open loans · click to open" className={d.byBranch.length ? '' : 'lg:col-span-2'}>
                <MiniTable rows={d.topCustomers} onRow={(r) => navigate(`/customers?view=${r.id}`)}
                  cols={[{ key: 'name', label: 'Customer', render: (r) => <span className="font-semibold">{r.name}</span> }, { key: 'phone', label: 'Mobile' }, { key: 'loans', label: 'Loans', right: true },
                    { key: 'net_wt', label: 'Weight', right: true, render: (r) => grams(r.net_wt) }, { key: 'outstanding', label: 'Outstanding', right: true, render: (r) => amount(r.outstanding) }]} />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
