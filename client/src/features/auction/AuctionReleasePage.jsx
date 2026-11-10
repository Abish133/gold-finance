import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Save, Trash2, Undo2, Search, FileSpreadsheet, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { AuctionReleaseTab } from './AuctionReleaseTab';

const COLS = [
  { key: 'bill_no', label: 'Loan No' }, { key: 'auction_date', label: 'Auctioned', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'item_summary', label: 'Items' },
  { key: 'loan_on', label: 'Metal' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'principal_due', label: 'Loan Amount', type: 'money' },
  { key: 'sale_amount', label: 'Sold For', type: 'money' }, { key: 'surplus', label: 'Profit / Loss', type: 'money' },
];

/** Auction Release (desktop): Due for Auction -> mark as auctioned; Auctioned -> enter what the items sold for. */
export default function AuctionReleasePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const admin = !!user?.is_super_admin;
  const { data: company } = useCompany();
  const { data: billing } = useFetch('/desk/billing-date');
  const bd = billing?.billingDate || dayjs().format('YYYY-MM-DD');
  const [tab, setTab] = useState('due');
  const [dueCount, setDueCount] = useState(null);
  const sales = useFetch('/auction/sales');
  const [f, setF] = useState({ from: dayjs(bd).startOf('year').subtract(9, 'month').format('YYYY-MM-DD'), to: '', show: '' });
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ sale_amount: '', sale_date: '' });
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const to = f.to || bd;
  const all = sales.data || [];
  const rows = useMemo(() => all.filter((r) => String(r.auction_date).slice(0, 10) >= f.from && String(r.auction_date).slice(0, 10) <= to)
    .filter((r) => (f.show === 'sold' ? r.sale_date : f.show === 'open' ? !r.sale_date : true)), [all, f, to]);
  const cur = rows.find((r) => r.loan_id === sel) || null;
  const pick = (r) => { setSel(r.loan_id); setForm({ sale_amount: r.sale_date ? String(n(r.sale_amount)) : '', sale_date: String(r.sale_date || bd).slice(0, 10) }); };
  const profit = cur && n(form.sale_amount) ? n(form.sale_amount) - n(cur.principal_due) : null;
  const refresh = () => { sales.refetch(); qc.invalidateQueries({ queryKey: ['/auction/list'] }); qc.invalidateQueries({ queryKey: ['/loans'] }); };
  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast.success(ok); refresh(); setAsk(null); } catch (e) { toast.error(e.message); } setBusy(false); };
  const saveSale = () => {
    if (!cur) return toast.error('Select an auctioned loan');
    if (!n(form.sale_amount)) return toast.error('Enter what the items sold for');
    setAsk({ title: `Save sale of loan ${cur.bill_no} for Rs ${amount(form.sale_amount)} on ${date(form.sale_date)}?`, message: `${profit >= 0 ? 'Profit' : 'Loss'}: ${amount(Math.abs(profit))}`,
      go: () => run(() => api.put(`/auction/sales/${cur.loan_id}`, form), 'Sale saved') });
  };
  const removeSale = () => cur?.sale_date && setAsk({ title: `Remove the sale of loan ${cur.bill_no}?`, message: 'The loan stays auctioned; the money entry of the sale is taken back.', danger: true,
    go: () => run(() => api.del(`/auction/sales/${cur.loan_id}/sale`), 'Sale removed') });
  const undo = () => cur && !cur.sale_date && setAsk({ title: `Undo auction of loan ${cur.bill_no}?`, message: 'The loan becomes open again with its loan amount.', danger: true,
    go: () => run(() => api.post(`/auction/sales/${cur.loan_id}/undo`), 'Auction undone - loan is open again') });
  useKeys({ f10: tab === 'done' ? saveSale : () => {}, 'ctrl+r': tab === 'done' ? removeSale : () => {}, escape: () => navigate('/') }, [tab, cur, form]);
  const sum = (k) => rows.reduce((t, r) => t + n(r[k]), 0);
  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Auction Release</h1><p className="text-sm text-navy-100">Close unredeemed loans as AUCTION and record what the items sold for</p></section>
      <div className="flex gap-1">
        {[['due', `Due for Auction${dueCount != null ? ` (${dueCount})` : ''}`], ['done', `Auctioned (${all.length})`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={clsx('h-11 min-w-64 rounded-t-md border px-6 text-base font-bold', tab === k ? 'border-ink-300 bg-white text-navy-900 dark:bg-ink-900 dark:text-white' : 'border-transparent bg-ink-100 text-ink-600 dark:bg-ink-800')}>{l}</button>
        ))}
      </div>
      {tab === 'due' ? <AuctionReleaseTab onCount={setDueCount} onDone={refresh} /> : (
        <>
          <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
            <Field label="Auctioned from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            <div><p className="label">Show</p>{seg('show', [['', 'All'], ['open', 'Sale not entered'], ['sold', 'Sold']])}</div>
            <Button className="ml-auto" icon={Search} onClick={() => sales.refetch()}>Show (F5)</Button>
          </div>
          <div className="grid items-start gap-3 xl:grid-cols-[1fr_340px]">
            <div className="card min-h-[calc(100vh-30rem)] overflow-auto">
              <table className="w-full text-sm">
                <thead className="navy-gradient sticky top-0 text-white"><tr>{COLS.map((c) => <th key={c.key} className={clsx('px-2 py-2', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                  {!rows.length && <tr><td colSpan={COLS.length} className="py-14 text-center text-ink-400">No auctioned loans in these dates</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.loan_id} onClick={() => pick(r)} className={clsx('cursor-pointer', sel === r.loan_id && 'bg-navy-50 dark:bg-ink-800')}>
                      <td className="px-2 py-1.5 font-semibold">{r.bill_no}</td><td className="px-2">{date(r.auction_date)}</td><td className="px-2"><b>{r.customer_name}</b></td><td className="px-2">{r.item_summary}</td>
                      <td className="px-2">{r.loan_on}</td><td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.principal_due)}</td>
                      <td className="num px-2 text-right">{r.sale_date ? amount(r.sale_amount) : <span className="text-ink-400">not entered</span>}</td>
                      <td className={clsx('num px-2 text-right', n(r.surplus) < 0 ? 'text-rose-600' : 'text-emerald-700')}>{r.sale_date ? `${n(r.surplus) >= 0 ? '+ ' : '- '}${amount(Math.abs(n(r.surplus)))}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="navy-gradient text-white"><tr className="font-bold"><td className="px-2 py-2" colSpan={5}>Total - {rows.length} loans ({rows.filter((r) => r.sale_date).length} sold)</td>
                  <td className="num px-2 text-right">{weight(sum('net_wt'))}</td><td className="num px-2 text-right">{amount(sum('principal_due'))}</td><td className="num px-2 text-right">{amount(sum('sale_amount'))}</td>
                  <td className="num px-2 text-right">{sum('surplus') >= 0 ? '+ ' : '- '}{amount(Math.abs(sum('surplus')))}</td></tr></tfoot>
              </table>
            </div>
            <div className="card space-y-2 p-4 text-sm">
              <p className="text-xs font-bold text-amber-700 uppercase">{cur ? `Loan ${cur.bill_no} - ${cur.customer_name}` : 'Select an auctioned loan'}</p>
              <div className="flex justify-between"><span>Loan amount</span><b className="num">{cur ? amount(cur.principal_due) : '-'}</b></div>
              <div className="flex justify-between"><span>Auctioned on</span><b>{cur ? date(cur.auction_date) : '-'}</b></div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sold for (Rs)"><Input type="number" disabled={!cur || (cur.sale_date && !admin)} value={form.sale_amount} onChange={(e) => setForm({ ...form, sale_amount: e.target.value })} /></Field>
                <Field label="Sale date"><Input type="date" disabled={!cur || (cur.sale_date && !admin)} min={cur ? String(cur.auction_date).slice(0, 10) : undefined} value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></Field>
              </div>
              <div className="flex justify-between"><span>{profit == null ? 'Profit / Loss' : profit >= 0 ? 'Profit' : 'Loss'}</span><b className={clsx('num', profit < 0 ? 'text-rose-600' : 'text-emerald-700')}>{profit == null ? '' : `${profit >= 0 ? '+ ' : '- '}${amount(Math.abs(profit))}`}</b></div>
              <Button variant={cur?.sale_date ? 'gold' : 'outline'} size="lg" className="w-full" icon={Save} loading={busy} disabled={!cur || (cur.sale_date && !admin)} onClick={saveSale}>{cur?.sale_date ? 'Change Sale (Admin)' : 'Save Sale (F10)'}</Button>
              <Button variant="outline" size="lg" className="w-full" icon={Trash2} disabled={!cur?.sale_date} onClick={removeSale}>Remove Sale (Ctrl+R)</Button>
              <Button variant="outline" size="lg" className="w-full text-rose-700" icon={Undo2} disabled={!cur || !!cur.sale_date || !admin} onClick={undo}>{cur?.sale_date ? 'Undo Auction (remove sale first)' : 'Undo Auction (Admin)'}</Button>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auctioned', COLS, rows)}>Excel (Ctrl+E)</Button>
                <Button variant="outline" icon={FileDown} onClick={() => printTable({ title: 'Auctioned loans', company, columns: COLS, rows })}>PDF (Ctrl+P)</Button>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="flex justify-end"><Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button></div>
      <p className="px-1 text-xs text-ink-500">F3 = scan / type loan no · Space = tick selected rows · Ctrl+A = tick all · Ctrl+N = tick with notice · Ctrl+D = untick · F10 = mark / save sale · Ctrl+R = remove sale · Ctrl+E = Excel · Esc = exit</p>
      <ConfirmDrawer open={!!ask} onClose={() => setAsk(null)} title={ask?.title} message={ask?.message} confirmText="Yes" tone={ask?.danger ? 'danger' : 'primary'} onConfirm={() => ask?.go()} />
    </div>
  );
}
