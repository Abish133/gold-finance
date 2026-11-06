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

const QUICK = { Today: [0, 0], Yesterday: [1, 1], Week: [6, 0], Month: [29, 0] };
const STATUS = { OPEN: 'Pending', CLOSED: 'Released', RENEWED: 'Re-loaned', AUCTIONED: 'Auctioned', CANCELLED: 'Cancelled' };

/** Duplicate Bill Print (desktop): find loans by date, loan no or customer and reprint the loan receipt marked DUPLICATE. */
export default function DuplicateBillPage() {
  const navigate = useNavigate();
  const { printLoans, printerUi, busy } = usePrinter();
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
      setRows(r.data); setSel(r.data.length === 1 ? [r.data[0].id] : []);
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
  const quick = (k) => { const [a, b] = QUICK[k]; setF({ ...f, from: dayjs().subtract(a, 'day').format('YYYY-MM-DD'), to: dayjs().subtract(b, 'day').format('YYYY-MM-DD') }); };

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Duplicate Bill Print</h1><p className="text-sm text-navy-100">Reprint loan receipt</p></div>
        <div className="flex items-center gap-2 rounded-md bg-white p-1.5 text-ink-900">
          <span className="px-2 text-sm font-semibold text-ink-600">LOAN / BILL / MOBILE / NAME</span>
          <Input className="h-10 w-56" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} />
          <Button icon={Search} onClick={find}>Find (Enter)</Button>
        </div>
        <div className="rounded-md bg-white/10 px-4 py-2 text-lg font-bold">{dayjs().format('DD/MM/YYYY')}</div>
      </section>
      <div className="grid items-stretch gap-3 xl:min-h-[calc(100vh-21rem)] xl:grid-cols-[340px_1fr]">
        <div className="card space-y-4 p-4">
          <p className="text-sm font-bold text-navy-900 uppercase dark:text-white">Find loans</p>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-cream-100 p-1 dark:bg-ink-800">
            {[['date', 'Date'], ['no', 'Loan No'], ['customer', 'Customer']].map(([k, l]) => <button key={k} type="button" onClick={() => setBy(k)} className={clsx('rounded py-2 text-sm font-bold', by === k ? 'bg-navy-800 text-white' : 'text-navy-800 dark:text-white')}>{l}</button>)}
          </div>
          {by === 'date' && (<>
            <div className="grid grid-cols-2 gap-2"><Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
            <div className="grid grid-cols-4 gap-1">{Object.keys(QUICK).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => quick(k)}>{k}</Button>)}</div>
          </>)}
          {by === 'no' && <div className="grid grid-cols-2 gap-2"><Field label="Loan no from"><Input type="number" value={f.noFrom} onChange={(e) => setF({ ...f, noFrom: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field><Field label="To"><Input type="number" value={f.noTo} onChange={(e) => setF({ ...f, noTo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field></div>}
          {by === 'customer' && <Field label="Customer name / mobile"><Input value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field>}
          <Button size="lg" variant="outline" className="w-full" icon={Search} loading={loading} onClick={search}>Search (Enter)</Button>
          <p className="text-xs font-bold text-ink-600 uppercase">Options</p>
          <div className="grid gap-2">
            <Checkbox checked={f.released} onChange={(v) => setF({ ...f, released: v })} label="Include released loans" />
            <Checkbox checked={f.showBook} onChange={(v) => setF({ ...f, showBook: v })} label="Show Bill Book No" />
          </div>
        </div>
        <div className="card flex min-w-0 flex-col p-4">
          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-lg font-bold">{sel.length} / {rows.length} selected</p>
            <Button variant="outline" onClick={() => setSel(rows.map((r) => r.id))}>Select all (Ctrl+A)</Button>
            <Button variant="outline" onClick={() => setSel([])}>Clear (Ctrl+U)</Button>
          </div>
          <div className="flex-1 overflow-auto rounded-md border border-ink-300 dark:border-ink-700">
            <table className="w-full text-sm">
              <thead className="navy-gradient sticky top-0 text-white"><tr><th className="w-10 px-2 py-2" /><th className="px-2 text-left">Loan</th>{f.showBook && <th className="px-2 text-left">Bill Book</th>}<th className="px-2 text-left">Date</th><th className="px-2 text-left">Customer</th><th className="px-2 text-left">Phone</th><th className="px-2 text-left">Item</th><th className="px-2 text-right">Amount</th><th className="px-2 text-left">Paid by</th><th className="px-2 text-left">Status</th><th className="px-2 text-right">Reprints</th></tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!rows.length && <tr><td colSpan={11} className="py-16 text-center text-ink-400">Search loans to reprint the receipt</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => toggle(r.id)} className={clsx('cursor-pointer', sel.includes(r.id) && 'bg-navy-50 dark:bg-ink-800')}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={sel.includes(r.id)} readOnly /></td>
                    <td className="px-2 font-semibold">{r.bill_no}</td>{f.showBook && <td className="px-2">{r.manual_bill_no || '-'}</td>}<td className="px-2">{date(r.loan_date)}</td>
                    <td className="px-2">{r.customer_name}</td><td className="px-2">{r.customer_phone}</td><td className="px-2">{r.item_summary}</td><td className="num px-2 text-right">{amount(r.principal)}</td>
                    <td className="px-2">{r.paid_by || 'CASH'}</td><td className="px-2">{STATUS[r.status] || r.status}</td><td className="num px-2 text-right">{Math.max(0, Number(r.receipt_prints || 0) - 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="rounded-md bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">{sel.length} receipt(s) will be printed</span>
        <span className="text-sm text-ink-500">{rows.length ? 'Tick the loans and press F10.' : 'Search loans to reprint the receipt.'}</span>
        <span className="ml-auto text-sm text-ink-500">Preview · DUPLICATE mark · 1 copy</span>
        <Button variant="outline" icon={RefreshCw} onClick={search}>Refresh (F5)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
        <Button variant="gold" icon={Eye} loading={busy} disabled={!sel.length} onClick={print}>Preview &amp; Print (F10)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = find / next · Space / click = tick · Ctrl+A = all · Ctrl+U = clear · F5 = refresh · F10 = Print · Esc = close</p>
      {printerUi}
    </div>
  );
}
