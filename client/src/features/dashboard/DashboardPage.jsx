import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import {
  Plus, Check, User, CalendarCheck, Coins, Receipt, BarChart3, Printer, UserPlus, Pencil, Tag, BookOpen, ArrowUpCircle, RefreshCcw, CalendarDays, ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { Badge, Card, Spinner } from '@/components/ui';
import { useFetch, useSettings } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { allowed } from '@/config/navigation';
import { compact, money, amount, grams, date, n } from '@/lib/format';

const TXN_LABEL = { DISBURSE: 'New loan', INTEREST: 'Interest', PART_PAYMENT: 'Part payment', TOPUP: 'Top-up', RELEASE: 'Release', AUCTION: 'Auction' };
const TXN_TONE = { DISBURSE: 'blue', INTEREST: 'green', PART_PAYMENT: 'gold', TOPUP: 'violet', RELEASE: 'gray', AUCTION: 'red' };

/** Same tiles and F-keys as the desktop app's quick actions. */
const ACTIONS = [
  { label: 'New Loan', set: 'HOME_BTN_NEW_LOAN', hint: 'Give a new loan', icon: Plus, color: 'text-emerald-600', path: '/loans/new', screen: 'loan_new', hot: 'F1' },
  { label: 'Release', set: 'HOME_BTN_RELEASE', hint: 'Close / settle a loan', icon: Check, color: 'text-emerald-600', path: '/loans/release', screen: 'loan_release', hot: 'F2' },
  { label: 'Customers', set: 'HOME_BTN_CUSTOMERS', hint: 'Search / edit customers', icon: User, color: 'text-navy-600', path: '/customers', screen: 'customers', hot: 'F3' },
  { label: 'Day End', set: 'HOME_BTN_DAY_END', hint: 'Check cash and close the day', icon: CalendarCheck, color: 'text-navy-600', path: '/accounts/day-close', screen: 'day_close', hot: 'F4' },
  { label: 'Part Payment', set: 'HOME_BTN_PART_PAYMENT', hint: 'Interest / part amount', icon: Coins, color: 'text-gold-600', path: '/loans/part-payment', screen: 'loan_interest', hot: 'F5' },
  { label: 'Voucher Entry', set: 'HOME_BTN_VOUCHER', hint: 'Rent, salary, bills', icon: Receipt, color: 'text-rose-700', path: '/accounts/vouchers', screen: 'acc_voucher', hot: 'F6' },
  { label: 'Day Report', set: 'HOME_BTN_DAY_REPORT', hint: 'Today at a glance', icon: BarChart3, color: 'text-teal-600', path: '/accounts/day-report', screen: 'acc_cashbook', hot: 'F7' },
  { label: 'Duplicate Bill', set: 'HOME_BTN_DUPLICATE', hint: 'Reprint a receipt', icon: Printer, color: 'text-ink-600', path: '/loans/duplicate', screen: 'loan_print', hot: 'F8' },
  { label: 'New Customer', set: 'HOME_BTN_NEW_CUSTOMER', hint: 'Add a customer', icon: UserPlus, color: 'text-emerald-600', path: '/customers?new=1', screen: 'customers' },
  { label: 'Old Loan Entry', set: 'HOME_BTN_OLD_LOAN', hint: 'Enter an old paper loan', icon: Pencil, color: 'text-gold-600', path: '/loans/old', screen: 'loan_old' },
  { label: 'Sticker', set: 'HOME_BTN_STICKER', hint: 'Print item stickers', icon: Tag, color: 'text-ink-600', path: '/loans/stickers', screen: 'loan_sticker', hot: 'F9' },
  { label: 'Pledge Book', set: 'HOME_BTN_PLEDGE_BOOK', hint: 'All loans register', icon: BookOpen, color: 'text-navy-600', path: '/loans', screen: 'loan_list' },
  { label: 'Top-up Loan', set: 'HOME_BTN_TOPUP', hint: 'Extra amount on same loan', icon: ArrowUpCircle, color: 'text-emerald-700', path: '/loans/topup', screen: 'loan_topup' },
  { label: 'Re-loan', set: 'HOME_BTN_RELOAN', hint: 'Release old, new loan in one step', icon: RefreshCcw, color: 'text-sky-600', path: '/loans/reloan', screen: 'loan_renewal' },
];

/* ---------------------------------------------------------------- compact building blocks */
const Chip = ({ tone, children }) => (
  <span className={clsx('rounded-md px-1.5 py-0.5 font-medium',
    tone === 'bad' ? 'bg-rose-500/25 text-rose-100' : tone === 'good' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white/80')}>{children}</span>
);

/** One cell of the figures strip; a thin coloured bar on the left marks what it is. */
const Kpi = ({ tone, label, value, hint, valueClass, to }) => {
  const navigate = useNavigate();
  return (
  <div role={to ? 'link' : undefined} tabIndex={to ? 0 : undefined} onClick={to ? () => navigate(to) : undefined} onKeyDown={to ? (e) => e.key === 'Enter' && navigate(to) : undefined}
    title={to ? 'Open the details' : undefined}
    className={clsx('group relative border-ink-200 px-3 py-2 pl-4 not-last:border-b sm:not-last:border-b-0 sm:odd:border-r xl:not-last:border-r dark:border-ink-800', to && 'cursor-pointer transition hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
    {to && <ChevronRight aria-hidden className="absolute top-2 right-2 size-3.5 text-ink-300 opacity-0 transition group-hover:opacity-100" />}
    <span aria-hidden className={clsx('absolute inset-y-2 left-0 w-0.5 rounded-r-sm', tone)} />
    <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}</p>
    <div className="flex items-baseline gap-2">
      <span className={clsx('num text-xl font-bold', valueClass || 'text-navy-900 dark:text-white')}>{value}</span>
      <span className="truncate text-[11px] text-ink-500">{hint}</span>
    </div>
  </div>
  );
};

/** Bordered box with a 36px header; the body scrolls when given the scroll classes. */
const Panel = ({ title, count, head, className, bodyClass, children }) => (
  <section className={clsx('flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900', className)}>
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
      {head || <>
        <h3 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{title}</h3>
        {count > 0 && <span className="num rounded-sm bg-ink-100 px-1.5 text-[10px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{count}</span>}
      </>}
    </header>
    <div className={bodyClass}>{children}</div>
  </section>
);

const Remind = ({ tone, onClick, go, children }) => (
  <button type="button" onClick={onClick}
    className={clsx('flex w-full items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-left text-[13px] transition',
      tone === 'bad' ? 'border-rose-600 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-200' : 'border-navy-900 bg-ink-50 hover:bg-ink-100 dark:border-white dark:bg-ink-800')}>
    <span className="flex-1">{children}</span><span className="text-[11px] font-bold whitespace-nowrap">{go} →</span>
  </button>
);

export default function DashboardPage() {

  const { data: status } = useFetch('/dashboard/status');
  const { data: alerts = [] } = useFetch('/dashboard/alerts');
  const { data: settings } = useSettings();
  const { data: billing } = useFetch('/desk/billing-date');
  const { data, isLoading } = useFetch('/dashboard', billing?.billingDate ? { date: billing.billingDate } : undefined, { refetchInterval: 120_000 });
  const showCharts = settings?.HOME_SHOW_CHARTS !== '0';
  const showDue = settings?.HOME_SHOW_DUE_SOON !== '0';
  const { user, can, isAllBranches, currentBranch } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('actions');
  // owner on a new install: Getting Started opens by itself once; afterwards a banner until it is finished
  const { data: setup } = useFetch(user?.is_super_admin ? '/desk/setup-status' : null);
  useEffect(() => {
    if (!setup || setup.done > 2) return;
    try { if (localStorage.getItem('gf.setupShown')) return; localStorage.setItem('gf.setupShown', '1'); } catch { return; }
    navigate('/getting-started');
  }, [setup]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading || !data) return <Spinner label="Preparing your dashboard…" />;

  const t = data.today.transactions;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const goldToday = data.rates.some((r) => dayjs(r.rate_date).isSame(dayjs(billing?.billingDate || undefined), 'day'));
  const interestToday = n(data.today.loans.advance_interest) + Object.values(t).reduce((s, x) => s + n(x.interest) + n(x.penal), 0);
  const trend = data.trend.map((r) => ({ month: dayjs(`${r.m}-01`).format('MMM'), lent: n(r.lent), collected: n(r.collected), released: n(r.released) }));
  const on = (k) => settings?.[k] !== '0';   // System Control > Home page
  const actions = ACTIONS.filter((a) => on(a.set) && allowed(can, a.screen) && !(isAllBranches && ['loan_new', 'loan_old'].includes(a.screen)));

  const scroll = 'min-h-0 flex-1 overflow-y-auto overscroll-contain';
  const todayRows = data.recent.filter((r) => dayjs(r.txn_date).isSame(dayjs(billing?.billingDate || undefined), 'day'));
  const tabBtn = (key, label) => (
    <button type="button" onClick={() => setTab(key)}
      className={clsx('relative h-full px-1 text-[11px] font-bold tracking-wider uppercase transition',
        tab === key ? 'text-navy-900 dark:text-white' : 'text-ink-400 hover:text-navy-700')}>
      {label}
      {tab === key && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-navy-900 dark:bg-white" />}
    </button>
  );
  const remindCount = alerts.length + (billing?.behind ? 1 : 0);

  return (
    /* fit-screen: on desktop the page itself never scrolls; each section below scrolls on its own */
    <div className="fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      {setup && setup.done < setup.total && (
        <button type="button" onClick={() => navigate('/getting-started')}
          className="flex w-full shrink-0 items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-left text-[13px] text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-sm bg-amber-200 dark:bg-amber-900"><span className="block h-full bg-amber-600" style={{ width: `${(setup.done / setup.total) * 100}%` }} /></span>
          <span className="font-bold">Setup {setup.done}/{setup.total}</span>
          <span className="flex-1 truncate">Finish Getting Started before the shop starts real work.</span>
          <span className="font-bold">Continue →</span>
        </button>
      )}

      {/* greeting: one slim line */}
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-4 py-2 text-white">
        <h1 className="text-lg font-bold">{greet}, {user.full_name.split(' ')[0].toUpperCase()}</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Chip>{dayjs(billing?.billingDate || undefined).format('ddd, DD MMM YYYY')}</Chip>
          <Chip tone={billing?.behind ? 'bad' : undefined}>Billing {dayjs(billing?.billingDate).format('DD/MM/YYYY')}</Chip>
          <Chip tone={goldToday ? 'good' : 'bad'}>{goldToday ? 'Gold rate entered' : 'Gold rate NOT entered'}</Chip>
          <Chip>{isAllBranches ? 'All branches' : currentBranch?.name}</Chip>
        </div>
        {data.canSeeAccounts && on('HOME_TILE_CASH') && (
          <div className="ml-auto flex items-baseline gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">Cash in hand</span>
            <span className="num text-xl font-bold">₹{amount(data.today.cash.closing)}</span>
          </div>
        )}
      </section>

      {/* four figures in one strip */}
      <div className="grid shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-2 xl:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {on('HOME_TILE_LOANS') && <Kpi tone="bg-navy-900 dark:bg-white" to="/accounts/day-report" label="Loans today" value={data.today.loans.cnt} hint={`₹${amount(n(data.today.loans.principal) + n(t.TOPUP?.principal))} · ${grams(data.today.loans.net_wt)}`} />}
        {on('HOME_TILE_RELEASES') && <Kpi tone="bg-emerald-600" to="/accounts/day-report" label="Releases today" value={n(t.RELEASE?.cnt) + n(t.AUCTION?.cnt)} hint={`₹${amount(n(t.RELEASE?.principal) + n(t.AUCTION?.principal))}`} />}
        {on('HOME_TILE_INTEREST') && <Kpi tone="bg-amber-500" to="/accounts/day-report" label="Interest today" value={`₹${amount(interestToday)}`} hint="advance + release + part payment" />}
        {on('HOME_TILE_AUCTION') && <Kpi tone="bg-rose-600" to="/auction" label="Due for auction" value={n(status?.unsettled_12m)} hint={`over 12 months · ${n(data.overdue.cnt)} past due`} valueClass={n(status?.unsettled_12m) ? 'text-rose-600' : undefined} />}
      </div>

      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_380px]">
        <Panel head={<div className="flex h-full gap-4">{tabBtn('actions', 'Quick actions')}{tabBtn('overview', 'Business overview')}</div>}
          bodyClass={clsx('p-2', scroll)}>
          {tab === 'actions' ? (
            <div className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={() => navigate(a.path)}
                  className="group flex items-center gap-2.5 rounded-md border border-ink-200 px-2.5 py-2 text-left transition hover:border-navy-900 hover:bg-ink-50 dark:border-ink-800 dark:hover:border-white dark:hover:bg-ink-800">
                  <span className={clsx('grid size-8 shrink-0 place-items-center rounded-md bg-current/10', a.color)}>
                    <a.icon className="size-4" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-bold text-navy-900 dark:text-white">{a.label}</span>
                    <span className="block truncate text-[11px] text-ink-500">{a.hint}</span>
                  </span>
                  {a.hot && <kbd className="rounded border border-ink-200 px-1 text-[10px] font-bold text-ink-500 group-hover:border-navy-900 group-hover:text-navy-900 dark:border-ink-700">{a.hot}</kbd>}
                </button>
              ))}
            </div>
          ) : <Overview data={data} trend={trend} showCharts={showCharts} />}
        </Panel>

        <div className="flex flex-col gap-2 xl:min-h-0">
          <Panel title="Today" count={todayRows.length} className="xl:flex-[3]" bodyClass={scroll}>
            {!todayRows.length ? (
              <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 text-[13px] text-ink-400"><CalendarDays className="size-5" />No entries yet today</div>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {todayRows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => navigate(`/loans/counter?loan=${r.loan_id}`)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800/40">
                      <Badge tone={TXN_TONE[r.txn_type]}>{TXN_LABEL[r.txn_type]}</Badge>
                      <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-semibold">{r.customer_name}</span><span className="text-[11px] text-ink-500">{r.manual_bill_no ? `${r.manual_bill_no} / ` : '#'}{r.bill_no} · {dayjs(r.created_at).format('hh:mm A')}</span></span>
                      <span className="num text-[13px] font-bold">{amount(['DISBURSE', 'TOPUP', 'RELEASE', 'AUCTION'].includes(r.txn_type) ? Math.abs(r.principal_amount) : r.total_amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Reminders" count={remindCount} className="xl:flex-[2]" bodyClass={clsx('space-y-1 p-2', scroll)}>
            {!remindCount && !(showDue && data.dueSoon.length) && <p className="px-1 py-2 text-[13px] text-ink-400">All good - nothing pending</p>}
            {billing?.behind && (
              <Remind tone="bad" onClick={() => navigate('/accounts/day-report')} go="Day End">
                Billing date {dayjs(billing.billingDate).format('DD/MM/YYYY')} is behind today. Finish Day End to move to {dayjs().format('DD/MM/YYYY')}.
              </Remind>
            )}
            {alerts.map((a) => <Remind key={a.key} onClick={() => navigate(a.link)} go="Open">{a.text}</Remind>)}
            {showDue && data.dueSoon.length > 0 && <p className="px-1 pt-1.5 text-[10px] font-bold tracking-wider text-ink-400 uppercase">Due in next 15 days</p>}
            {showDue && data.dueSoon.slice(0, 5).map((r) => (
              <button key={r.id} type="button" onClick={() => navigate(`/loans/counter?loan=${r.id}`)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-ink-50 dark:hover:bg-ink-800">
                <span className="truncate">#{r.bill_no} {r.customer_name}</span><span className="num text-[11px] font-semibold text-rose-600">{date(r.due_date)}</span>
              </button>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Second tab of the main card: portfolio tiles, trend charts and branch-wise table. */
function Overview({ data, trend, showCharts }) {
  return (
    <div className="space-y-2">
      <div className="grid overflow-hidden rounded-md border border-ink-200 sm:grid-cols-2 2xl:grid-cols-4 dark:border-ink-800">
        <Kpi tone="bg-navy-900 dark:bg-white" label="Outstanding" value={compact(data.portfolio.outstanding)} hint={`${n(data.portfolio.open_loans)} open loans`} />
        <Kpi tone="bg-amber-500" label="Gold in custody" value={grams(data.portfolio.net_wt)} hint={`MV ${compact(data.portfolio.market_value)} · LTV ${data.portfolio.ltv}%`} />
        <Kpi tone="bg-emerald-600" label="This month lent" value={compact(data.month.loans.principal)} hint={`${data.month.loans.cnt} loans`} />
        <Kpi tone="bg-violet-600" label="Active customers" value={n(data.portfolio.active_customers)} hint="with open loans" />
      </div>
      {showCharts && <div className="grid gap-2 xl:grid-cols-3">
        <Card title="Business trend · 6 months" className="xl:col-span-2">
          <div className="h-52">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe4ea" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Area type="monotone" dataKey="lent" name="Lent" stroke="#18181b" strokeWidth={2} fill="#18181b" fillOpacity={0.12} />
                <Area type="monotone" dataKey="released" name="Recovered" stroke="#71717a" strokeWidth={2} fill="#71717a" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Interest collected">
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe4ea" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} fontSize={11} width={60} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="collected" name="Interest" fill="#059669" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>}
      {data.branchWise.length > 0 && (
        <Card title="Branch-wise portfolio" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-navy-50 text-left text-xs font-bold text-navy-800 uppercase"><th className="px-5 py-2">Branch</th><th className="px-5 py-2 text-right">Open loans</th><th className="px-5 py-2 text-right">Net wt</th><th className="px-5 py-2 text-right">Outstanding</th></tr></thead>
            <tbody className="divide-y divide-ink-200">{data.branchWise.map((b) => <tr key={b.id}><td className="px-5 py-2 font-semibold">{b.name}</td><td className="num px-5 py-2 text-right">{b.loans}</td><td className="num px-5 py-2 text-right">{grams(b.net_wt)}</td><td className="num px-5 py-2 text-right font-bold">{money(b.outstanding)}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
