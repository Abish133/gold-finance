import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { LayoutDashboard, Wallet, Gem, Users, AlertTriangle, TrendingUp, FilePlus2, HandCoins, Coins, Unlock, CalendarClock } from 'lucide-react';
import dayjs from 'dayjs';
import { Badge, Button, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { compact, money, grams, date, n } from '@/lib/format';

const TXN_LABEL = { DISBURSE: 'New loan', INTEREST: 'Interest', PART_PAYMENT: 'Part payment', TOPUP: 'Top-up', RELEASE: 'Release', AUCTION: 'Auction' };
const TXN_TONE = { DISBURSE: 'gold', INTEREST: 'green', PART_PAYMENT: 'blue', TOPUP: 'violet', RELEASE: 'gray', AUCTION: 'red' };

export default function DashboardPage() {
  const { data, isLoading } = useFetch('/dashboard', undefined, { refetchInterval: 120_000 });
  const { user, can, isAllBranches, currentBranch } = useAuth();
  const navigate = useNavigate();
  if (isLoading || !data) return <Spinner label="Preparing your dashboard…" />;
  const p = data.portfolio;
  const t = data.today.transactions;
  const m = data.month;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const trend = data.trend.map((r) => ({ ...r, month: dayjs(`${r.m}-01`).format('MMM'), lent: n(r.lent), collected: n(r.collected), released: n(r.released) }));
  const monthInterest = Object.values(m.transactions).reduce((s, x) => s + n(x.interest) + n(x.penal), 0) + n(m.loans.advance_interest);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader icon={LayoutDashboard} title={`${greet}, ${user.full_name.split(' ')[0]}`}
        subtitle={`${isAllBranches ? 'All branches' : currentBranch?.name} · ${dayjs().format('dddd, DD MMM YYYY')}`}
        actions={(
          <>
            {can('loan_release', 'add') && <Button variant="outline" icon={HandCoins} onClick={() => navigate('/loans/counter')}>Loan counter</Button>}
            {can('loan_new', 'add') && !isAllBranches && <Button variant="gold" icon={FilePlus2} onClick={() => navigate('/loans/new')}>New loan</Button>}
          </>
        )} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding portfolio" value={compact(p.outstanding)} hint={`${n(p.open_loans).toLocaleString('en-IN')} open loans`} icon={Wallet} tone="gold" />
        <Stat label="Gold in custody" value={grams(p.net_wt)} hint={`Market value ${compact(p.market_value)} · LTV ${p.ltv}%`} icon={Gem} tone="violet" />
        <Stat label="Interest this month" value={compact(monthInterest)} hint={`${m.loans.cnt} new loans · ${compact(m.loans.principal)} lent`} icon={TrendingUp} tone="green" />
        <Stat label="Overdue loans" value={n(data.overdue.cnt).toLocaleString('en-IN')} hint={`${compact(data.overdue.amount)} past due date`} icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat icon={FilePlus2} label="Today's loans" value={money(data.today.loans.principal)} sub={`${data.today.loans.cnt} loans · ${grams(data.today.loans.net_wt)}`} />
        <MiniStat icon={Coins} label="Interest today" value={money(n(t.INTEREST?.interest) + n(t.RELEASE?.interest) + n(t.PART_PAYMENT?.interest))} sub={`${n(t.INTEREST?.cnt)} receipts`} />
        <MiniStat icon={Unlock} label="Released today" value={money(t.RELEASE?.principal)} sub={`${n(t.RELEASE?.cnt)} loans closed`} />
        <MiniStat icon={Users} label="Active customers" value={n(p.active_customers).toLocaleString('en-IN')} sub="with open loans" />
        {data.canSeeAccounts && <MiniStat icon={Wallet} label="Cash in hand" value={money(data.today.cash.closing)} sub={`Opening ${money(data.today.cash.opening)}`} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Business trend" subtitle="Last 6 months" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gLent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f59e0b" stopOpacity={0.35} /><stop offset="1" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" stopOpacity={0.25} /><stop offset="1" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Area type="monotone" dataKey="lent" name="Lent" stroke="#d97706" strokeWidth={2} fill="url(#gLent)" />
                <Area type="monotone" dataKey="released" name="Recovered" stroke="#0284c7" strokeWidth={2} fill="url(#gRel)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Interest collected" subtitle="Monthly">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => compact(v)} tickLine={false} axisLine={false} fontSize={11} width={60} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="collected" name="Interest" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent activity" className="xl:col-span-2" bodyClassName="p-0">
          {!data.recent.length ? <Empty title="No transactions yet" /> : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => navigate(`/loans/counter?loan=${r.loan_id}`)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <Badge tone={TXN_TONE[r.txn_type]}>{TXN_LABEL[r.txn_type]}</Badge>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.customer_name}</p><p className="text-xs text-ink-500">#{r.bill_no} · {dayjs(r.created_at).format('DD MMM, hh:mm A')}</p></div>
                    <span className="num font-bold">{money(r.total_amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Due in next 15 days" icon={CalendarClock} bodyClassName="p-0">
          {!data.dueSoon.length ? <Empty title="Nothing due soon" /> : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.dueSoon.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => navigate(`/loans/counter?loan=${r.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.customer_name}</p><p className="text-xs text-ink-500">#{r.bill_no} · {r.phone}</p></div>
                    <div className="text-right"><p className="num text-sm font-bold">{compact(r.current_principal)}</p><p className="text-xs text-rose-600">{date(r.due_date)}</p></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.branchWise.length > 0 && (
        <Card title="Branch performance" subtitle="Open portfolio by branch">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.branchWise.map((b) => ({ ...b, outstanding: n(b.outstanding) }))} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => compact(v)} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={12} width={110} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"><Icon className="size-5" /></div>
      <div className="min-w-0"><p className="text-xs text-ink-500">{label}</p><p className="num truncate font-bold text-ink-900 dark:text-white">{value}</p><p className="truncate text-[11px] text-ink-400">{sub}</p></div>
    </div>
  );
}
