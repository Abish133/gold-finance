import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarRange, RefreshCw, Printer, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Badge, Button, ConfirmDrawer, DataTable } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { amount, compact, n } from '@/lib/format';
import { ExitButton } from '@/features/loans/desk';

const STEPS = [['Checks', 'Year over, Day End, other computers'], ['Backup', 'Take a backup file first'], ['Accounts', 'Closing of every account, profit'], ['Pending loans', 'Loans pending go to the new year'], ['Close year', 'Lock the year, new financial year'], ['Reports', 'Print accounts and pending loans']];

/** Year End Process (desktop: frmYearEnd) - close the accounting year; open loans carry forward. */
export default function YearEndPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: company } = useCompany();
  const { data: years = [] } = useFetch('/admin/financial-years');
  const { data, refetch } = useFetch('/desk/year-end-checks');
  const pl = useFetch('/accounts/profit-loss', data ? { from: data.fy.start_date, to: data.fy.end_date } : undefined, { enabled: !!data });
  const pending = useFetch('/loans', { status: 'OPEN', pageSize: 200 });
  const [confirm, setConfirm] = useState(false);
  const fy = data?.fy;
  const next = fy ? `${dayjs(fy.end_date).year()}-${String((dayjs(fy.end_date).year() + 1) % 100).padStart(2, '0')}` : '';
  const chart = (data?.monthly || []).map((m) => ({ m: dayjs(`${m.m}-01`).format('MMM'), given: n(m.given) }));
  const icon = (c) => (c.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : c.warn ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-rose-600" />);
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Year End Process</h1><p className="text-sm text-navy-100">Close the accounting year - everything runs automatically</p></section>
      <div className="card flex flex-wrap items-center gap-6 px-4 py-3">
        <div><p className="label">Year to close</p><p className="text-lg font-bold text-navy-900">{fy?.name} · {fy && `${dayjs(fy.start_date).format('DD/MM/YYYY')} - ${dayjs(fy.end_date).format('DD/MM/YYYY')}`} → new year {next}</p></div>
        <Badge tone={fy?.is_closed ? 'green' : 'gold'} className="ml-auto px-4 py-1.5 text-sm">{fy?.is_closed ? 'CLOSED' : 'NOT CLOSED YET'}</Badge>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[360px_1fr]">
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Year end steps</p>
          <ol className="space-y-1 p-3">{STEPS.map(([t, h], i) => (
            <li key={t} className="flex gap-3 rounded-md p-2"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy-100 text-sm font-bold text-navy-800">{i + 1}</span><span><p className="font-semibold">{t}</p><p className="text-xs text-ink-500">{h}</p></span></li>
          ))}</ol>
          <div className="space-y-2 p-3 pt-0">
            <Button variant="gold" size="lg" className="w-full !bg-ink-900 !text-white" disabled={!user.is_super_admin || fy?.is_closed} onClick={() => setConfirm(true)}>Start Year End (Admin)</Button>
            <Button variant="outline" className="w-full" icon={RefreshCw} onClick={() => refetch()}>Check Again (F5)</Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-5">
            {[['Loans given', data?.given?.c, `Rs ${compact(data?.given?.a)}`], ['Released', data?.released?.c, `Rs ${compact(data?.released?.a)}`], ['Net profit', pl.data ? amount(pl.data.netProfit) : '-', 'income - expense'],
              ['Pending loans', data?.pending?.c, `${data?.pending?.bank || 0} at bank · go to new year`], ['Carried forward', data ? amount(data.pending.a) : '-', 'outstanding carried']].map(([l, v, h]) => (
              <div key={l} className="card border-t-4 border-t-navy-600 px-4 py-3"><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-xl font-bold text-navy-900">{v ?? 0}</p><p className="text-[11px] text-ink-500">{h}</p></div>
            ))}
          </div>
          <div className="card p-3"><p className="mb-1 text-xs font-bold text-ink-600 uppercase">Loans given - month-wise (amount)</p>
            <div className="h-44"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" /><XAxis dataKey="m" fontSize={11} /><YAxis fontSize={10} width={60} tickFormatter={(x) => compact(x)} /><Tooltip /><Bar dataKey="given" fill="#18181b" /></BarChart></ResponsiveContainer></div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="w-12 px-3 py-2" /><th className="px-3 text-left">Check</th><th className="px-3 text-left">Detail</th></tr></thead>
              <tbody className="divide-y divide-ink-200">{(data?.checks || []).map((c) => <tr key={c.text}><td className="px-3 py-2">{icon(c)}</td><td className="px-3">{c.text}</td><td className="px-3 text-ink-600">{c.detail}</td></tr>)}</tbody></table>
          </div>
          <DataTable dense rows={years} columns={[{ key: 'name', label: 'Year', render: (r) => <b>{r.name}</b> }, { key: 'start_date', label: 'From', type: 'date' }, { key: 'end_date', label: 'To', type: 'date' },
            { key: 's', label: 'Status', render: (r) => (r.is_current ? <Badge tone="green">Current</Badge> : r.is_closed ? <Badge>Closed</Badge> : <Badge tone="gold">Open</Badge>) }]} />
        </div>
      </div>
      <div className={clsx('card flex flex-wrap justify-end gap-2 px-3 py-2')}>
        {[['Own pledge book', '0'], ['Bank pledge book', '1']].map(([t, bank]) => (
          <Button key={t} variant="outline" icon={Printer} onClick={async () => { const r = await api.get('/loans', { from: fy?.start_date, to: fy?.end_date, bank, pageSize: 200, sort: 'loan_no', order: 'asc' });
            printTable({ title: `${t} ${fy?.name}`, company, rows: r.data, totals: { principal: r.summary?.principal, net_wt: r.summary?.net_wt },
              columns: [{ key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' }, { key: 'net_wt', label: 'Net', type: 'weight' }, { key: 'principal', label: 'Loan', type: 'money' }, { key: 'status', label: 'Status' }, { key: 'close_date', label: 'Released', type: 'date' }] }); }}>{t}</Button>
        ))}
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: 'Pending loans carried to new year', company, rows: pending.data?.data || [], columns: [{ key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'net_wt', label: 'Net', type: 'weight' }, { key: 'current_principal', label: 'Outstanding', type: 'money' }] })}>Print Pending Loans</Button>
        <Button variant="outline" icon={Printer} onClick={() => pl.data && printTable({ title: `Profit & Loss ${fy?.name}`, company, rows: [...pl.data.income.map((r) => ({ ...r, side: 'Income' })), ...pl.data.expense.map((r) => ({ ...r, side: 'Expense' }))], columns: [{ key: 'side', label: 'Type' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'money' }] })}>Print Year End (F9)</Button>
        <ExitButton />
      </div>
      <ConfirmDrawer open={confirm} onClose={() => setConfirm(false)} title={`Close ${fy?.name} and start ${next}?`} confirmText="Run year end" tone="primary"
        message="The current year is closed and the next financial year starts. Open loans carry forward automatically; profit & loss restarts. Take a backup first."
        onConfirm={async () => { try { const r = await api.post('/admin/financial-years/year-end'); toast.success(`Year ${r.data.name} started`); qc.invalidateQueries({ queryKey: ['/admin/financial-years'] }); refetch(); setConfirm(false); } catch (e) { toast.error(e.message); } }}
        icon={CalendarRange} />
    </div>
  );
}
