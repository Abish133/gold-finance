import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, LogOut, Eye } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, today } from '@/lib/format';
import { useKeys } from './desk';
import { PageActions } from '@/components/common/PageActions';

const QUICK = { Today: [0, 0], Yesterday: [1, 1], Week: [6, 0], Month: [29, 0] };
const STATUS = { OPEN: 'Open', CLOSED: 'Released', RENEWED: 'Released', AUCTIONED: 'Auctioned', CANCELLED: 'Cancelled' };

/** Duplicate Bill Print (desktop): find loans by date, loan no or customer and reprint the loan receipt marked DUPLICATE. */
export default function DuplicateBillPage() {
  const navigate = useNavigate();
  const { printLoans, printerUi, busy, settings } = usePrinter();
  const [by, setBy] = useState('date');
  const [f, setF] = useState({ from: today(), to: today(), noFrom: '', noTo: '', customer: '', released: false, showBook: false });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async (params) => {
    setLoading(true);
    try {
      const r = await api.get('/loans', { ...params, status: f.released ? '' : 'OPEN', pageSize: 200, sort: 'loan_no', order: 'asc' });
      // desktop: a typed loan / bill book number finds that loan only (not every loan whose phone has the digits)
      const typed = String(params.search || '').trim();
      const exact = typed && /^[A-Za-z0-9/-]+$/.test(typed) ? r.data.filter((x) => String(x.bill_no) === typed || String(x.loan_no) === typed || String(x.manual_bill_no || '') === typed) : [];
      const list = exact.length ? exact : r.data;
      setRows(list); setSel(list.length === 1 ? [list[0].id] : []);
      if (!r.data.length) toast.info('No loans found');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  const search = () => load(by === 'date' ? { from: f.from, to: f.to } : by === 'no' ? { loan_no_from: f.noFrom, loan_no_to: f.noTo || f.noFrom } : { search: f.customer });
  const find = () => q.trim() && load({ search: q.trim() });
  const print = async () => {
    const list = rows.filter((r) => sel.includes(r.id));
    if (!list.length) return toast.error('Tick the loans to reprint');
    const fulls = await Promise.all(list.map((r) => api.get(`/loans/${r.id}`).then((x) => x.data)));
    await printLoans(fulls);
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  useKeys({ f10: print, f5: search, 'ctrl+a': () => setSel(rows.map((r) => r.id)), 'ctrl+u': () => setSel([]), escape: () => navigate('/') }, [rows, sel, f, by]);
  const quick = (k) => { const [a, b] = QUICK[k]; setF({ ...f, from: dayjs(today()).subtract(a, 'day').format('YYYY-MM-DD'), to: dayjs(today()).subtract(b, 'day').format('YYYY-MM-DD') }); };

  return (
    /* fit-screen: the page fits the window; only the list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Duplicate Bill Print</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Reprint loan receipt</p></div>
        <div className="flex items-center gap-1 rounded-md bg-white p-1 text-ink-900">
          <Input prefix={<Search className="size-3.5" />} placeholder="Loan / bill / mobile / name" className="!h-8 w-60 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} />
          <Button size="sm" onClick={find}>Find (Enter)</Button>
        </div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Date</span><span className="num text-[13px] font-bold">{dayjs(today()).format('DD/MM/YYYY')}</span></div>
      </section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-2.5 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Find loans</p>
          <div className="grid grid-cols-3">
            {[['date', 'Date'], ['no', 'Loan No'], ['customer', 'Customer']].map(([k, l]) => <button key={k} type="button" onClick={() => setBy(k)} className={clsx('-ml-px flex h-8 items-center justify-center gap-1.5 border text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md', by === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{by === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}
          </div>
          {by === 'date' && (<>
            <div className="grid grid-cols-2 gap-2"><Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
            <div className="grid grid-cols-4 gap-1 [&_button]:h-7 [&_button]:px-1 [&_button]:text-[11px]">{Object.keys(QUICK).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => quick(k)}>{k}</Button>)}</div>
          </>)}
          {by === 'no' && <div className="grid grid-cols-2 gap-2"><Field label="Loan no from"><Input type="number" value={f.noFrom} onChange={(e) => setF({ ...f, noFrom: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field><Field label="To"><Input type="number" value={f.noTo} onChange={(e) => setF({ ...f, noTo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field></div>}
          {by === 'customer' && <Field label="Customer name / mobile"><Input value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field>}
          <Button variant="gold" className="h-9 w-full" icon={Search} loading={loading} onClick={search}>Search (Enter)</Button>
          <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Options</p>
          <div className="grid gap-1.5 rounded-md border border-ink-200 p-2 text-[13px] dark:border-ink-800">
            <Checkbox checked={f.released} onChange={(v) => setF({ ...f, released: v })} label="Include released loans" />
            <Checkbox checked={f.showBook} onChange={(v) => setF({ ...f, showBook: v })} label="Show Bill Book No" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-ink-200 bg-white p-2 xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <div className="flex shrink-0 items-center gap-2 [&_button]:h-7 [&_button]:text-[12px]">
            <p className="flex-1 text-[13px] font-bold"><span className="num text-base">{sel.length}</span> <span className="text-ink-400">/ {rows.length} selected</span></p>
            <Button variant="outline" onClick={() => setSel(rows.map((r) => r.id))}>Select all (Ctrl+A)</Button>
            <Button variant="soft-danger" onClick={() => setSel([])}>Clear (Ctrl+U)</Button>
          </div>
          <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 xl:min-h-0 dark:border-ink-800">
            <table className="w-full text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-10 px-2 py-2" /><th className="px-2 text-left">Loan</th>{f.showBook && <th className="px-2 text-left">Bill Book</th>}<th className="px-2 text-left">Date</th><th className="px-2 text-left">Customer</th><th className="px-2 text-left">Phone</th><th className="px-2 text-left">Item</th><th className="px-2 text-right">Amount</th><th className="px-2 text-left">Paid by</th><th className="px-2 text-left">Status</th><th className="px-2 text-right">Reprints</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!rows.length && <tr><td colSpan={11} className="py-12 text-center text-[12px] text-ink-400">Search loans on the left to reprint the receipt</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => toggle(r.id)} className={clsx('cursor-pointer', sel.includes(r.id) ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                    <td className={clsx('border-l-2 px-2 py-1 text-center', sel.includes(r.id) ? 'border-emerald-600' : 'border-transparent')}><input type="checkbox" className="size-3.5 accent-emerald-600" checked={sel.includes(r.id)} readOnly /></td>
                    <td className="px-2 font-semibold">{r.bill_no}</td>{f.showBook && <td className="px-2">{r.manual_bill_no || '-'}</td>}<td className="px-2">{date(r.loan_date)}</td>
                    <td className="px-2">{r.customer_name}</td><td className="px-2">{r.customer_phone}</td><td className="max-w-56 truncate px-2 uppercase" title={r.items_text || r.item_summary}>{r.items_text || r.item_summary}</td><td className="num px-2 text-right">{amount(r.principal)}</td>
                    <td className="px-2">{String(r.paid_by || 'CASH').split(',').map((m) => ({ CASH: 'Cash', UPI: 'UPI', BANK: 'Bank', CARD: 'Card', CHEQUE: 'Cheque' }[m] || m)).join(', ')}</td><td className="px-2 text-xs font-bold uppercase">{STATUS[r.status] || r.status}</td><td className="num px-2 text-right">{Math.max(0, Number(r.receipt_prints || 0) - 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <PageActions keys="Enter = find / next · Space / click = tick · Ctrl+A = all · Ctrl+U = clear · F5 = refresh · F10 = Print · Esc = close">
        <span className="rounded-md bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{sel.length} receipt(s) will be printed</span>
        <span className="hidden text-[12px] text-ink-500 lg:inline">{rows.length ? 'Tick the loans and press F10.' : 'Search loans to reprint the receipt.'}</span>
        <span className="ml-auto hidden text-[11px] text-ink-400 xl:inline">{[settings?.DUP_PREVIEW !== '0' ? 'Preview' : 'Straight to printer', settings?.DUP_MARK !== '0' ? 'DUPLICATE mark' : 'no DUPLICATE mark', `${Number(settings?.DUP_COPIES) || 1} cop${Number(settings?.DUP_COPIES) > 1 ? 'ies' : 'y'}`].join(' · ')}</span>
        <Button variant="outline" icon={RefreshCw} onClick={search}>Refresh (F5)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
        <Button variant="gold" icon={Eye} loading={busy} disabled={!sel.length} onClick={print}>Preview &amp; Print (F10)</Button>
      </PageActions>
      {printerUi}
    </div>
  );
}
