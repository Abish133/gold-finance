import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import {
  Plus, Check, User, CalendarCheck, Coins, Receipt, BarChart3, Printer, UserPlus, Pencil, Tag, BookOpen, ArrowUpCircle, RefreshCcw, CalendarDays,
} from 'lucide-react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { Badge, Card, Spinner, Stat } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { allowed } from '@/config/navigation';
import { compact, money, amount, grams, date, n } from '@/lib/format';

const TXN_LABEL = { DISBURSE: 'New loan', INTEREST: 'Interest', PART_PAYMENT: 'Part payment', TOPUP: 'Top-up', RELEASE: 'Release', AUCTION: 'Auction' };
const TXN_TONE = { DISBURSE: 'blue', INTEREST: 'green', PART_PAYMENT: 'gold', TOPUP: 'violet', RELEASE: 'gray', AUCTION: 'red' };

/** Same tiles and F-keys as the desktop app's quick actions. */
const ACTIONS = [
  { label: 'New Loan', hint: 'Give a new loan', icon: Plus, color: 'text-emerald-600', path: '/loans/new', screen: 'loan_new', hot: 'F1' },
  { label: 'Release', hint: 'Close / settle a loan', icon: Check, color: 'text-emerald-600', path: '/loans/release', screen: 'loan_release', hot: 'F2' },
  { label: 'Customers', hint: 'Search / edit customers', icon: User, color: 'text-navy-600', path: '/customers', screen: 'customers', hot: 'F3' },
  { label: 'Day End', hint: 'Check cash and close the day', icon: CalendarCheck, color: 'text-navy-600', path: '/accounts/day-close', screen: 'day_close', hot: 'F4' },
  { label: 'Part Payment', hint: 'Interest / part amount', icon: Coins, color: 'text-gold-600', path: '/loans/part-payment', screen: 'loan_interest', hot: 'F5' },
  { label: 'Voucher Entry', hint: 'Rent, salary, bills', icon: Receipt, color: 'text-rose-700', path: '/accounts/vouchers', screen: 'acc_voucher', hot: 'F6' },
  { label: 'Day Report', hint: 'Today at a glance', icon: BarChart3, color: 'text-teal-600', path: '/accounts/day-report', screen: 'acc_cashbook', hot: 'F7' },
  { label: 'Duplicate Bill', hint: 'Reprint a receipt', icon: Printer, color: 'text-ink-600', path: '/loans/counter?tab=HISTORY', screen: 'loan_print', hot: 'F8' },
  { label: 'New Customer', hint: 'Add a customer', icon: UserPlus, color: 'text-emerald-600', path: '/customers?new=1', screen: 'customers' },
  { label: 'Old Loan Entry', hint: 'Enter an old paper loan', icon: Pencil, color: 'text-gold-600', path: '/loans/old', screen: 'loan_old' },
  { label: 'Sticker', hint: 'Print item stickers', icon: Tag, color: 'text-ink-600', path: '/loans/stickers', screen: 'loan_sticker', hot: 'F9' },
  { label: 'Pledge Book', hint: 'All loans register', icon: BookOpen, color: 'text-navy-600', path: '/loans', screen: 'loan_list' },
  { label: 'Top-up Loan', hint: 'Extra amount on same loan', icon: ArrowUpCircle, color: 'text-emerald-700', path: '/loans/topup', screen: 'loan_topup' },
  { label: 'Re-loan', hint: 'Release old, new loan in one step', icon: RefreshCcw, color: 'text-sky-600', path: '/loans/reloan', screen: 'loan_renewal' },
];

export default function DashboardPage() {
  const { data, isLoading } = useFetch('/dashboard', undefined, { refetchInterval: 120_000 });
  const { data: status } = useFetch('/dashboard/status');
  const { data: alerts = [] } = useFetch('/dashboard/alerts');
  const { user, can, isAllBranches, currentBranch } = useAuth();
  const navigate = useNavigate();
  if (isLoading || !data) return <Spinner label="Preparing your dashboard…" />;

  const t = data.today.transactions;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const goldToday = data.rates.some((r) => dayjs(r.rate_date).isSame(dayjs(), 'day'));
  const interestToday = n(data.today.loans.advance_interest) + Object.values(t).reduce((s, x) => s + n(x.interest) + n(x.penal), 0);
  const trend = data.trend.map((r) => ({ month: dayjs(`${r.m}-01`).format('MMM'), lent: n(r.lent), collected: n(r.collected), released: n(r.released) }));
  const actions = ACTIONS.filter((a) => allowed(can, a.screen) && !(isAllBranches && ['loan_new', 'loan_old'].includes(a.screen)));

  return (
    <div className="animate-rise space-y-4">
      {/* greeting banner */}
      <section className="navy-gradient flex flex-wrap items-center gap-4 rounded-md border-l-[6px] border-gold-500 px-6 py-5 text-white">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{greet}, {user.full_name.split(' ')[0].toUpperCase()}</h1>
          <p className="mt-1 text-sm text-coral-400 sm:text-base">
            {dayjs().format('dddd, DD MMMM YYYY')} <span className="mx-2">·</span> Billing date {dayjs().format('DD/MM/YYYY')}
            <span className="mx-2">·</span> {goldToday ? <span className="text-gold-300">Gold rate entered</span> : 'Gold rate NOT entered'}
            <span className="mx-2">·</span> <span className="text-navy-100">{isAllBranches ? 'All branches' : currentBranch?.name}</span>
          </p>
        </div>
        {data.canSeeAccounts && (
          <div className="rounded-md bg-white/10 px-5 py-3 text-right">
            <p className="text-xs font-bold tracking-wide text-navy-100 uppercase">Cash in hand (expected)</p>
            <p className="num text-3xl font-bold text-gold-300">{amount(data.today.cash.closing)}</p>
          </div>
        )}
      </section>

      {/* four tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="blue" label="Loans today" value={data.today.loans.cnt} hint={`${amount(data.today.loans.principal)} · ${grams(data.today.loans.net_wt)}`} />
        <Stat tone="green" label="Releases today" value={n(t.RELEASE?.cnt)} hint={amount(t.RELEASE?.principal)} />
        <Stat tone="gold" label="Interest today" value={amount(interestToday)} hint="advance + release + part payment" />
        <Stat tone="red" label="Due for auction" value={n(status?.unsettled_12m)} hint={`open for over 12 months · ${n(data.overdue.cnt)} past due date`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
        <Card title="Quick actions">
          <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={() => navigate(a.path)}
                className="group flex items-center gap-3 rounded-md border border-ink-300 bg-white px-4 py-3.5 text-left transition hover:border-navy-500 hover:bg-navy-50/50 hover:shadow-sm dark:border-ink-700 dark:bg-ink-900">
                <a.icon className={clsx('size-6 shrink-0', a.color)} strokeWidth={2.4} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-navy-900 dark:text-white">{a.label}</span>
                  <span className="block truncate text-xs text-ink-500">{a.hint}</span>
                </span>
                {a.hot && <kbd className="rounded border border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-navy-800 dark:bg-ink-800 dark:text-ink-200">{a.hot}</kbd>}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Today" actions={<span className="text-xs text-ink-500">last entries</span>} bodyClassName="p-0" className="flex-1">
            {!data.recent.filter((r) => dayjs(r.txn_date).isSame(dayjs(), 'day')).length ? (
              <div className="flex flex-col items-center justify-center py-14 text-ink-500"><CalendarDays className="size-7 text-rose-500" /><p className="mt-3">No entries yet today</p></div>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800">
                {data.recent.filter((r) => dayjs(r.txn_date).isSame(dayjs(), 'day')).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => navigate(`/loans/counter?loan=${r.loan_id}`)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-navy-50/50 dark:hover:bg-ink-800/40">
                      <Badge tone={TXN_TONE[r.txn_type]}>{TXN_LABEL[r.txn_type]}</Badge>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.customer_name}</span><span className="text-xs text-ink-500">#{r.bill_no} · {dayjs(r.created_at).format('hh:mm A')}</span></span>
                      <span className="num text-sm font-bold">{amount(r.total_amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Reminders" bodyClassName="space-y-2 p-4">
            {!alerts.length && <p className="text-sm text-ink-500">Nothing pending.</p>}
            {alerts.map((a) => (
              <button key={a.key} type="button" onClick={() => navigate(a.link)} className="flex w-full items-center justify-between gap-3 rounded-md bg-cream-200 px-4 py-2.5 text-left text-sm hover:bg-gold-100 dark:bg-ink-800">
                <span>{a.text}</span><span className="font-semibold whitespace-nowrap text-navy-700">Open →</span>
              </button>
            ))}
            {data.dueSoon.length > 0 && <p className="pt-1 text-xs font-bold tracking-wide text-ink-500 uppercase">Due in next 15 days</p>}
            {data.dueSoon.slice(0, 5).map((r) => (
              <button key={r.id} type="button" onClick={() => navigate(`/loans/counter?loan=${r.id}`)} className="flex w-full items-center justify-between rounded-md border border-ink-200 px-3 py-2 text-left text-sm hover:border-navy-300 dark:border-ink-700">
                <span className="truncate">#{r.bill_no} {r.customer_name}</span><span className="text-xs text-rose-600">{date(r.due_date)}</span>
              </button>
            ))}
          </Card>
        </div>
      </div>

      {/* modern extras: portfolio + trends */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="blue" label="Outstanding portfolio" value={compact(data.portfolio.outstanding)} hint={`${n(data.portfolio.open_loans)} open loans`} />
        <Stat tone="gold" label="Gold in custody" value={grams(data.portfolio.net_wt)} hint={`Market value ${compact(data.portfolio.market_value)} · LTV ${data.portfolio.ltv}%`} />
        <Stat tone="green" label="This month lent" value={compact(data.month.loans.principal)} hint={`${data.month.loans.cnt} loans`} />
        <Stat tone="violet" label="Active customers" value={n(data.portfolio.active_customers)} hint="with open loans" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Business trend · 6 months" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe4ea" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Area type="monotone" dataKey="lent" name="Lent" stroke="#1f3a5f" strokeWidth={2} fill="#1f3a5f" fillOpacity={0.12} />
                <Area type="monotone" dataKey="released" name="Recovered" stroke="#d4a017" strokeWidth={2} fill="#d4a017" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Interest collected">
          <div className="h-64">
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
      </div>
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
