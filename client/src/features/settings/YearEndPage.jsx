import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarRange, RefreshCw, Printer, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Badge, Button, ConfirmDrawer, DataTable } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { amount, compact, n } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { useNavigate } from 'react-router';

const STEPS = [['Checks', 'Year over, Day End, other computers'], ['Backup', 'Separate Year End backup file'], ['Accounts', 'Closing of every account, profit'], ['Pending loans', 'Loans pending go to the new year'], ['Close year', 'Lock the year, new financial year'], ['Reports', 'Print accounts and pending loans']];
const TAG = (c) => (c.ok ? ['OK', 'bg-emerald-100 text-emerald-800'] : c.warn ? ['WARNING', 'bg-amber-100 text-amber-800'] : ['STOP', 'bg-rose-100 text-rose-800']);

/** Year End Process (desktop: frmYearEnd) - close the accounting year; open loans carry forward. */
export default function YearEndPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: company } = useCompany();
  const { data: years = [] } = useFetch('/admin/financial-years');
  const { data, refetch } = useFetch('/desk/year-end-checks');
  const pl = useFetch('/accounts/profit-loss', data ? { from: data.fy.start_date, to: data.fy.end_date } : undefined, { enabled: !!data });
  const pending = useFetch('/loans', { status: 'OPEN', pageSize: 200 });
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('checks');
  const fy = data?.fy;
  const next = fy ? `${dayjs(fy.end_date).year()}-${String((dayjs(fy.end_date).year() + 1) % 100).padStart(2, '0')}` : '';
  // every month of the year, April to March (desktop chart)
  const chart = fy ? Array.from({ length: 12 }, (_, i) => { const d = dayjs(fy.start_date).add(i, 'month'); const r = (data?.monthly || []).find((x) => x.m === d.format('YYYY-MM')); return { m: d.format('MMM'), Given: n(r?.given), Released: n(r?.released) }; }) : [];
  const checks = data?.checks || [];
  const warns = checks.filter((c) => !c.ok).length;
  const printYear = () => pl.data && printTable({ title: `Profit & Loss ${fy?.name}`, company, rows: [...pl.data.income.map((r) => ({ ...r, side: 'Income' })), ...pl.data.expense.map((r) => ({ ...r, side: 'Expense' }))], columns: [{ key: 'side', label: 'Type' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'money' }] });
  useKeys({ f5: () => refetch(), f9: printYear, escape: () => navigate('/') }, [pl.data, fy]);
  const income = n(pl.data?.income?.reduce((t, r) => t + n(r.amount), 0));
  const expense = n(pl.data?.expense?.reduce((t, r) => t + n(r.amount), 0));
  const icon = (c) => (c.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : c.warn ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-rose-600" />);
  return (
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Year End Process</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Close the accounting year - everything runs automatically</p></div></section>
      <div className="card flex shrink-0 flex-wrap items-center gap-4 px-3 py-2">
        <div><p className="label">Year to close</p><p className="text-[15px] font-bold text-navy-900 dark:text-white">{fy?.name} · {fy && `${dayjs(fy.start_date).format('DD/MM/YYYY')} - ${dayjs(fy.end_date).format('DD/MM/YYYY')}`} → new year {next}</p></div>
        <Badge tone={fy?.is_closed ? 'green' : 'gold'} className="ml-auto px-4 py-1.5 text-sm">{fy?.is_closed ? 'CLOSED' : 'NOT CLOSED YET'}</Badge>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[360px_1fr]">
        <div className="card overflow-hidden">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Year end steps</p>
          <div className="px-3 pt-3"><p className="text-sm font-bold">{fy?.is_closed ? 'Done' : 'Ready'}</p><div className="mt-1 h-2 rounded bg-ink-200"><div className="h-2 rounded bg-emerald-600" style={{ width: fy?.is_closed ? '100%' : '0%' }} /></div></div>
          <ol className="space-y-1 p-3">{STEPS.map(([t, h], i) => (
            <li key={t} className="flex gap-3 rounded-md p-2"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy-100 text-sm font-bold text-navy-800">{i + 1}</span><span><p className="font-semibold">{t}</p><p className="text-xs text-ink-500">{h}</p></span></li>
          ))}</ol>
          <div className="space-y-2 p-3 pt-0">
            <Button variant="gold" className="h-10 w-full !bg-ink-900 !text-white" disabled={!user.is_super_admin || fy?.is_closed} onClick={() => setConfirm(true)}>Start Year End (Admin)</Button>
            <Button variant="outline" className="w-full" icon={RefreshCw} onClick={() => refetch()}>Check Again (F5)</Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
            {[['Loans given', data?.given?.c, compact(data?.given?.a)], ['Released', data?.released?.c, compact(data?.released?.a)], ['Net profit', pl.data ? `Rs ${amount(pl.data.netProfit)}` : '-', `income ${compact(income)} - expense ${compact(expense)}`],
              ['Pending loans', data?.pending?.c, `${data?.pending?.bank || 0} at bank · go to new year`], ['Carried forward', data ? `Rs ${amount(data.pending.a)}` : '-', 'outstanding carried']].map(([l, v, h]) => (
              <div key={l} className="relative overflow-hidden rounded-md border border-ink-200 bg-white px-3 py-1.5 pl-4 dark:border-ink-800 dark:bg-ink-900"><span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm bg-navy-900 dark:bg-white" /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className="num text-[15px] font-bold text-navy-900">{v ?? 0}</p><p className="text-[11px] text-ink-500">{h}</p></div>
            ))}
          </div>
          <div className="card p-2.5"><p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Loans given vs released - month-wise (amount)</p>
            <div className="h-44"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" /><XAxis dataKey="m" fontSize={11} /><YAxis fontSize={10} width={60} tickFormatter={(x) => compact(x)} /><Tooltip /><Legend verticalAlign="top" align="right" iconSize={10} wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="Given" fill="#18181b" /><Bar dataKey="Released" fill="#b8892b" /></BarChart></ResponsiveContainer></div>
          </div>
          <div className="flex">{[['checks', `Checks${warns ? ` (${warns} warning${warns > 1 ? 's' : ''})` : ''}`], ['accounts', 'Accounts'], ['pending', `Pending Loans (${data?.pending?.c ?? 0})`], ['log', 'Log']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={clsx('h-9 rounded-md border px-5 text-sm font-semibold', tab === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>
          ))}</div>
          {tab === 'checks' && <div className="card overflow-hidden">
            <table className="w-full text-[12px]"><thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-24 px-3 py-2" /><th className="px-3 text-left">Check</th><th className="px-3 text-left">Detail</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{checks.map((c) => { const [t, cls] = TAG(c); return <tr key={c.text}><td className="px-3 py-2"><span className={clsx('inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold', cls)}>{icon(c)}{t}</span></td><td className="px-3">{c.text}</td><td className="px-3 text-ink-600">{c.detail}</td></tr>; })}</tbody></table>
          </div>}
          {tab === 'accounts' && <DataTable dense rows={[...(pl.data?.income || []).map((r) => ({ ...r, side: 'Income' })), ...(pl.data?.expense || []).map((r) => ({ ...r, side: 'Expense' }))]} empty="No income / expense entries this year"
            columns={[{ key: 'side', label: 'Type' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'money' }]} />}
          {tab === 'pending' && <DataTable dense rows={pending.data?.data || []} empty="No pending loans"
            columns={[{ key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'current_principal', label: 'Outstanding', type: 'money' }, { key: 'bank_pledge_id', label: 'At bank', render: (r) => (r.bank_pledge_id ? 'Yes' : '') }]} />}
          {tab === 'log' && <DataTable dense rows={years} columns={[{ key: 'name', label: 'Year', render: (r) => <b>{r.name}</b> }, { key: 'start_date', label: 'From', type: 'date' }, { key: 'end_date', label: 'To', type: 'date' },
            { key: 's', label: 'Status', render: (r) => (r.is_current ? <Badge tone="green">Current</Badge> : r.is_closed ? <Badge>Closed</Badge> : <Badge tone="gold">Open</Badge>) }]} />}
        </div>
      </div>
      <div className={clsx('card flex flex-wrap justify-end gap-2 px-3 py-2')}>
        {[['Own pledge book', '0'], ['Bank pledge book', '1']].map(([t, bank]) => (
          <Button key={t} variant="outline" icon={Printer} onClick={async () => { const r = await api.get('/loans', { from: fy?.start_date, to: fy?.end_date, bank, pageSize: 200, sort: 'loan_no', order: 'asc' });
            printTable({ title: `${t} ${fy?.name}`, company, rows: r.data, totals: { principal: r.summary?.principal, net_wt: r.summary?.net_wt },
              columns: [{ key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' }, { key: 'net_wt', label: 'Net', type: 'weight' }, { key: 'principal', label: 'Loan', type: 'money' }, { key: 'status', label: 'Status' }, { key: 'close_date', label: 'Released', type: 'date' }] }); }}>{t}</Button>
        ))}
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: 'Pending loans carried to new year', company, rows: pending.data?.data || [], columns: [{ key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'net_wt', label: 'Net', type: 'weight' }, { key: 'current_principal', label: 'Outstanding', type: 'money' }] })}>Print Pending Loans</Button>
        <Button variant="outline" icon={Printer} onClick={printYear}>Print Year End (F9)</Button>
        <ExitButton />
      </div>
      <ConfirmDrawer open={confirm} onClose={() => setConfirm(false)} title={`Close ${fy?.name} and start ${next}?`} confirmText="Run year end" tone="primary"
        message="The current year is closed and the next financial year starts. Open loans carry forward automatically; profit & loss restarts. Take a backup first."
        onConfirm={async () => { try { const r = await api.post('/admin/financial-years/year-end'); toast.success(`Year ${r.data.name} started`); qc.invalidateQueries({ queryKey: ['/admin/financial-years'] }); refetch(); setConfirm(false); } catch (e) { toast.error(e.message); } }}
        icon={CalendarRange} />
    </div>
  );
}
