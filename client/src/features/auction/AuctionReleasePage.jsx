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
import { amount, date, n, weight, today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { AuctionReleaseTab } from './AuctionReleaseTab';
import { PageActions } from '@/components/common/PageActions';

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
  const bd = billing?.billingDate || dayjs(today()).format('YYYY-MM-DD');
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
  const seg = (k, opts) => <div className="flex">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{f[k] === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div>;

  return (
    /* fit-screen: the page fits the window; the lists and side panels scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Auction Release</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Close unredeemed loans as AUCTION and record what the items sold for</p></div>
        <div className="flex overflow-hidden rounded-md border border-white/20">
          {[['due', `Due for Auction${dueCount != null ? ` (${dueCount})` : ''}`], ['done', `Auctioned (${all.length})`]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={clsx('px-3 py-1 text-[12px] font-semibold transition', tab === k ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10')}>{l}</button>
          ))}
        </div>
      </section>
      {tab === 'due' ? <AuctionReleaseTab onCount={setDueCount} onDone={refresh} /> : (
        <>
          <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
            <Field label="Auctioned from"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            <div><p className="label">Show</p>{seg('show', [['', 'All'], ['open', 'Sale not entered'], ['sold', 'Sold']])}</div>
            <Button className="ml-auto h-8" icon={Search} onClick={() => sales.refetch()}>Show (F5)</Button>
          </div>
          <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
            <div className="min-h-64 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
              <table className="w-full text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{COLS.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {!rows.length && <tr><td colSpan={COLS.length} className="py-12 text-center text-[12px] text-ink-400">No auctioned loans in these dates</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.loan_id} onClick={() => pick(r)} className={clsx('cursor-pointer', sel === r.loan_id ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                      <td className={clsx('border-l-2 px-2 py-1 font-semibold', sel === r.loan_id ? 'border-emerald-600' : 'border-transparent')}>{r.bill_no}</td><td className="px-2">{date(r.auction_date)}</td><td className="px-2"><b>{r.customer_name}</b></td><td className="max-w-48 truncate px-2" title={r.item_summary}>{r.item_summary}</td>
                      <td className="px-2">{r.loan_on}</td><td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.principal_due)}</td>
                      <td className="num px-2 text-right">{r.sale_date ? amount(r.sale_amount) : <span className="text-ink-400">not entered</span>}</td>
                      <td className={clsx('num px-2 text-right', n(r.surplus) < 0 ? 'text-rose-600' : 'text-emerald-700')}>{r.sale_date ? `${n(r.surplus) >= 0 ? '+ ' : '- '}${amount(Math.abs(n(r.surplus)))}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-[12px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr><td className="px-2 py-1.5" colSpan={5}>Total - {rows.length} loans ({rows.filter((r) => r.sale_date).length} sold)</td>
                  <td className="num px-2 text-right">{weight(sum('net_wt'))}</td><td className="num px-2 text-right">{amount(sum('principal_due'))}</td><td className="num px-2 text-right">{amount(sum('sale_amount'))}</td>
                  <td className="num px-2 text-right">{sum('surplus') >= 0 ? '+ ' : '- '}{amount(Math.abs(sum('surplus')))}</td></tr></tfoot>
              </table>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 text-[13px] xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
              <p className="flex items-center gap-2 truncate text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 shrink-0 rounded-sm bg-navy-900 dark:bg-white" />{cur ? `Loan ${cur.bill_no} · ${cur.customer_name}` : 'Select an auctioned loan'}</p>
              <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800">
                <div className="flex justify-between py-0.5"><span className="text-ink-500">Loan amount</span><b className="num">{cur ? amount(cur.principal_due) : '-'}</b></div>
                <div className="flex justify-between py-0.5"><span className="text-ink-500">Auctioned on</span><b>{cur ? date(cur.auction_date) : '-'}</b></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Sold for (Rs)"><Input type="number" disabled={!cur || (cur.sale_date && !admin)} value={form.sale_amount} onChange={(e) => setForm({ ...form, sale_amount: e.target.value })} /></Field>
                <Field label="Sale date"><Input type="date" disabled={!cur || (cur.sale_date && !admin)} min={cur ? String(cur.auction_date).slice(0, 10) : undefined} value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></Field>
              </div>
              <div className={clsx('flex justify-between rounded-md px-2.5 py-1.5', profit == null ? 'bg-ink-50 dark:bg-ink-800/50' : profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30')}><span className="font-semibold">{profit == null ? 'Profit / Loss' : profit >= 0 ? 'Profit' : 'Loss'}</span><b className={clsx('num', profit < 0 ? 'text-rose-600' : 'text-emerald-700')}>{profit == null ? '' : `${profit >= 0 ? '+ ' : '- '}${amount(Math.abs(profit))}`}</b></div>
              <Button variant="gold" className="mt-auto h-9 w-full" icon={Save} loading={busy} disabled={!cur || (cur.sale_date && !admin)} onClick={saveSale}>{cur?.sale_date ? 'Change Sale (Admin)' : 'Save Sale (F10)'}</Button>
              <Button variant="soft-danger" className="h-8 w-full text-[12px]" icon={Trash2} disabled={!cur?.sale_date} onClick={removeSale}>Remove Sale (Ctrl+R)</Button>
              <Button variant="soft-danger" className="h-8 w-full text-[12px]" icon={Undo2} disabled={!cur || !!cur.sale_date || !admin} onClick={undo}>{cur?.sale_date ? 'Undo Auction (remove sale first)' : 'Undo Auction (Admin)'}</Button>
              <div className="grid grid-cols-2 gap-1.5 border-t border-ink-100 pt-2 dark:border-ink-800 [&_button]:h-8 [&_button]:text-[12px]">
                <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auctioned', COLS, rows)}>Excel (Ctrl+E)</Button>
                <Button variant="outline" icon={FileDown} onClick={() => printTable({ title: 'Auctioned loans', company, columns: COLS, rows })}>PDF (Ctrl+P)</Button>
              </div>
            </div>
          </div>
        </>
      )}
      <PageActions keys="F3 = scan / type loan no · Space = tick selected rows · Ctrl+A = tick all · Ctrl+N = tick with notice · Ctrl+D = untick · F10 = mark / save sale · Ctrl+R = remove sale · Ctrl+E = Excel · Esc = exit">
        
        <div className="ml-auto"><Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button></div>
      </PageActions>
      <p className="hidden">F3 = scan / type loan no · Space = tick selected rows · Ctrl+A = tick all · Ctrl+N = tick with notice · Ctrl+D = untick · F10 = mark / save sale · Ctrl+R = remove sale · Ctrl+E = Excel · Esc = exit</p>
      <ConfirmDrawer open={!!ask} onClose={() => setAsk(null)} title={ask?.title} message={ask?.message} confirmText="Yes" tone={ask?.danger ? 'danger' : 'primary'} onConfirm={() => ask?.go()} />
    </div>
  );
}
