import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Printer, FileDown, FileSpreadsheet, RefreshCw, LogOut } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useFetch, useList, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { Today: () => [today(), today()], 'This month': () => [dayjs().startOf('month').format('YYYY-MM-DD'), today()], 'A/c year': () => [fyStart(), today()] };
const CASH = [{ key: 'entry_date', label: 'Date', type: 'date' }, { key: 'ref', label: 'Voucher / Ref' }, { key: 'account', label: 'Account' }, { key: 'narration', label: 'Particulars' }, { key: 'debit', label: 'Receipt', type: 'money' }, { key: 'credit', label: 'Payment', type: 'money' }, { key: 'balance', label: 'Balance', type: 'money' }];
const DAY = [{ key: 'voucher_date', label: 'Date', type: 'date' }, { key: 'voucher_no', label: 'Voucher' }, { key: 'voucher_type', label: 'Type' }, { key: 'narration', label: 'Narration' }, { key: 'lines_text', label: 'Accounts (Dr / Cr)' }, { key: 'amount', label: 'Amount', type: 'money' }];

/** Cash Book / Day Book (desktop): cash movement with running balance, or every voucher of the period. */
export default function CashBookPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today(), view: 'cash', search: '' });
  const [q, setQ] = useState(f);
  const cash = useFetch(q.view === 'cash' ? '/accounts/cash-book' : null, { from: q.from, to: q.to });
  const day = useList('/accounts/vouchers', { from: q.from, to: q.to, pageSize: 200, sort: 'voucher_date', order: 'asc', search: q.search }, { enabled: q.view === 'day' });
  const c = cash.data;
  const rows = useMemo(() => {
    if (q.view === 'day') return day.data?.data || [];
    const list = (c?.entries || []).map((e) => ({ ...e, ref: [e.voucher_type, e.voucher_no].filter(Boolean).join(' ') }))
      .filter((e) => !q.search || `${e.narration} ${e.account} ${e.ref}`.toLowerCase().includes(q.search.toLowerCase()));
    return c ? [{ entry_date: q.from, narration: 'Opening balance (cash in hand)', balance: c.opening, opening: true }, ...list] : [];
  }, [q, c, day.data]);
  const cols = q.view === 'cash' ? CASH : DAY;
  const title = `${q.view === 'cash' ? 'Cash Book' : 'Day Book'} · ${date(q.from)} - ${date(q.to)}`;
  const print = () => printTable({ title, company, columns: cols, rows, totals: q.view === 'cash' ? { debit: c?.debit, credit: c?.credit, balance: c?.closing } : { amount: rows.reduce((s, r) => s + n(r.amount), 0) } });
  useKeys({ f5: () => setQ(f), f6: () => { cash.refetch?.(); day.refetch?.(); }, f4: () => { const v = f.view === 'cash' ? 'day' : 'cash'; setF({ ...f, view: v }); setQ({ ...f, view: v }); }, 'ctrl+p': print, 'ctrl+d': print, 'ctrl+e': () => exportCsv(title, cols, rows), escape: () => navigate('/') }, [f, rows]);
  const seg = (val, label) => <button type="button" onClick={() => { setF({ ...f, view: val }); setQ({ ...q, view: val }); }} className={clsx('h-9 rounded-md border px-4 text-sm font-semibold', f.view === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{label}</button>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-2 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Cash Book</h1><p className="text-sm text-navy-100">Cash Book · Day Book</p></div>
        {[['Opening', c?.opening], ['Receipts', c?.debit], ['Payments', c?.credit], ['Closing', c?.closing, true]].map(([k, v, g]) => (
          <div key={k} className={clsx('min-w-28 rounded-md px-4 py-1.5 text-center', g ? 'bg-white text-ink-900' : 'bg-white/10')}><p className="text-[11px] font-bold uppercase">{k}</p><p className="num font-bold">{amount(v || 0)}</p></div>
        ))}
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex gap-1">{Object.entries(QUICK).map(([k, fn]) => <button key={k} type="button" onClick={() => { const [a, b] = fn(); setF({ ...f, from: a, to: b }); setQ({ ...f, from: a, to: b }); }} className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 dark:bg-ink-900 dark:text-white">{k}</button>)}</div>
        <div><p className="label">View</p><div className="flex gap-1">{seg('cash', 'Cash Book')}{seg('day', 'Day Book')}</div></div>
        <Field label="Search" className="w-72"><Input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} /></Field>
        <Button className="ml-auto" size="lg" variant="outline" icon={Search} onClick={() => setQ(f)}>Show (F5)</Button>
      </div>
      <div className="card min-h-[calc(100vh-24rem)] overflow-auto">
        <p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">{title} · {rows.filter((r) => !r.opening).length} entries</p>
        <table className="w-full text-sm">
          <thead className="bg-navy-800 text-white"><tr>{cols.map((x) => <th key={x.key} className={clsx('px-2 py-2', x.type === 'money' ? 'text-right' : 'text-left')}>{x.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {!rows.length && <tr><td colSpan={cols.length} className="py-16 text-center text-ink-400">No entries</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className={clsx(r.opening && 'bg-navy-50 font-semibold dark:bg-ink-800')}>
                {cols.map((x) => <td key={x.key} className={clsx('px-2 py-1.5', x.type === 'money' && 'num text-right', x.key === 'lines_text' && 'text-xs text-ink-600')}>
                  {x.type === 'money' ? (r[x.key] || x.key === 'balance' ? amount(r[x.key]) : '') : x.type === 'date' ? date(r[x.key]) : r[x.key] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
          {q.view === 'cash' && <tfoot className="navy-gradient text-white"><tr className="font-bold"><td colSpan={4} className="px-2 py-2 text-center">Total · closing balance</td><td className="num px-2 text-right">{amount(c?.debit || 0)}</td><td className="num px-2 text-right">{amount(c?.credit || 0)}</td><td className="num px-2 text-right">{amount(c?.closing || 0)}</td></tr></tfoot>}
        </table>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Printer} onClick={print}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+D)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv(title, cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={RefreshCw} onClick={() => { cash.refetch?.(); day.refetch?.(); }}>Refresh (F6)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 Show · F6 Refresh · F4 Cash Book / Day Book · Ctrl+P Print · Ctrl+D PDF · Ctrl+E Excel · Esc Exit</p>
    </div>
  );
}
