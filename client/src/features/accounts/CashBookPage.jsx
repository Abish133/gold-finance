import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Printer, FileDown, FileSpreadsheet, RefreshCw, LogOut, BookText } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Input } from '@/components/ui';
import { useFetch, useList, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { SHELL, Head, HeadTabs, Chip, Toggle, Bar, Actions, Strip, F, thead, tfoot, inp, RunButton } from './compact';

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
  const setView = (val) => { setF({ ...f, view: val }); setQ({ ...q, view: val }); };
  const isQ = (k) => { const [a, b] = QUICK[k](); return f.from === a && f.to === b; };
  const dayTotal = q.view === 'day' ? rows.reduce((s, r) => s + n(r.amount), 0) : 0;
  return (
    /* fit-screen: only the book table scrolls */
    <div className={SHELL}>
      <Head icon={BookText} title={q.view === 'cash' ? 'Cash Book' : 'Day Book'} sub="Cash movement with running balance · every voucher of the period">
        <HeadTabs value={f.view} onChange={setView} tabs={[['cash', 'Cash Book'], ['day', 'Day Book']]} />
      </Head>
      <Bar>
        <F label="From"><Input type="date" className={`${inp} w-36`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></F>
        <F label="To"><Input type="date" className={`${inp} w-36`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></F>
        <Toggle options={Object.keys(QUICK).map((k) => [k, k])} isOn={isQ} onChange={(k) => { const [a, b] = QUICK[k](); setF({ ...f, from: a, to: b }); setQ({ ...f, from: a, to: b }); }} />
        <F label="Search" className="w-64"><Input prefix={<Search className="size-3.5" />} className={inp} placeholder="Account, particulars, voucher" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} /></F>
        <RunButton className="ml-auto" icon={Search} label="Show" keyHint="F5" onClick={() => setQ(f)} />
      </Bar>
      <Strip items={q.view === 'cash'
        ? [{ label: 'Opening', value: amount(c?.opening || 0) }, { label: 'Receipts', value: amount(c?.debit || 0), bar: 'bg-emerald-600', tone: 'text-emerald-700' }, { label: 'Payments', value: amount(c?.credit || 0), bar: 'bg-rose-600', tone: 'text-rose-600' }, { label: 'Closing (cash in hand)', value: amount(c?.closing || 0), bar: 'bg-amber-500' }]
        : [{ label: 'Vouchers', value: rows.length }, { label: 'Total amount', value: amount(dayTotal), bar: 'bg-amber-500' }]} />
      <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" /><p className="truncate text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{title}</p><span className="ml-auto shrink-0 text-[11px] text-ink-500">{rows.filter((r) => !r.opening).length} entries</span></div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className={thead}><tr>{cols.map((x) => <th key={x.key} className={clsx('px-3 py-2', x.type === 'money' ? 'text-right' : 'text-left')}>{x.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!rows.length && <tr><td colSpan={cols.length} className="py-12 text-center text-ink-400">No entries</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} className={clsx(r.opening ? 'bg-ink-50 font-semibold dark:bg-ink-800/50' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  {cols.map((x) => <td key={x.key} className={clsx('px-3 py-1.5', x.type === 'money' && 'num text-right whitespace-nowrap', x.type === 'date' && 'whitespace-nowrap', x.key === 'debit' && 'text-emerald-700', x.key === 'credit' && 'text-rose-600', x.key === 'balance' && 'font-semibold', x.key === 'lines_text' && 'text-[11px] text-ink-600 dark:text-ink-300')}>
                    {x.type === 'money' ? (r[x.key] || x.key === 'balance' ? amount(r[x.key]) : '') : x.type === 'date' ? date(r[x.key]) : r[x.key] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
            {q.view === 'cash' && !!rows.length && <tfoot className={tfoot}><tr><td colSpan={4} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total · closing balance</td><td className="num px-3 text-right text-emerald-700">{amount(c?.debit || 0)}</td><td className="num px-3 text-right text-rose-600">{amount(c?.credit || 0)}</td><td className="num px-3 text-right">{amount(c?.closing || 0)}</td></tr></tfoot>}
            {q.view === 'day' && !!rows.length && <tfoot className={tfoot}><tr><td colSpan={5} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total · {rows.length} vouchers</td><td className="num px-3 text-right">{amount(dayTotal)}</td></tr></tfoot>}
          </table>
        </div>
      </div>
      <Actions hint="F5 Show · F6 Refresh · F4 Cash Book / Day Book · Ctrl+P Print · Ctrl+D PDF · Ctrl+E Excel · Esc Exit">
        <Button variant="outline" icon={RefreshCw} onClick={() => { cash.refetch?.(); day.refetch?.(); }}>Refresh (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+D)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv(title, cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </Actions>
    </div>
  );
}
