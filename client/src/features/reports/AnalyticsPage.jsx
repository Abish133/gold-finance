import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, Search, ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Input } from '@/components/ui';
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
function ChartCard({ title, sub, legend, table, className, children }) {
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
      <div className="min-h-0 flex-1 p-2">{view === 'chart' || !table ? children : table}</div>
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
  const pick = (k) => { const [a, b] = RANGES[k][1](); const nf = { ...f, from: a.format('YYYY-MM-DD'), to: b.format('YYYY-MM-DD') }; setRange(k); setF(nf); setQ(nf); };
  const setNow = (patch) => { const nf = { ...f, ...patch }; setF(nf); setQ(nf); };

  const d = data;
  const series = useMemo(() => (d?.series || []).map((r) => ({ ...r, name: label(r.k, d.group) })), [d]);
  const cur = d?.current || {}; const prev = d?.previous || {};
  const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: pal.axis };
  const money = (v) => compact(v);

  return (
    /* fit-screen: filters stay at the top, the charts scroll */
    <div className={SHELL}>
      <Head icon={ChartNoAxesCombined} title="Business Analytics" sub="Trends, comparison with the previous period, loan ageing and top customers">
        {d && <Chip label="Period" value={`${dayjs(d.from).format('DD MMM YY')} - ${dayjs(d.to).format('DD MMM YY')}`} />}
        {d && <Chip label="Compared with" value={`${dayjs(d.prevFrom).format('DD MMM YY')} - ${dayjs(d.prevTo).format('DD MMM YY')}`} />}
      </Head>

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

            <div className="grid gap-2 lg:grid-cols-2">
              <ChartCard title="Loan amount given vs recovered" sub={`per ${d.group}`} legend={[[pal.s1, 'Given'], [pal.s2, 'Recovered']]}
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

              <ChartCard title="Interest collected" sub={`per ${d.group} · advance + release + part payment`}
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

              <ChartCard title="New loans vs releases" sub={`number of loans per ${d.group}`} legend={[[pal.s1, 'New loans'], [pal.s2, 'Releases']]}
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
                        <ChartCard key={mk} title={`${nameM} rate in this period`} className={rateMetals.length === 1 ? 'lg:col-span-2' : ''}
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

                    <ChartCard title="Busiest days of the week" sub="new loans given in this period"
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
