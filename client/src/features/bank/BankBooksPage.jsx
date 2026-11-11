import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderOpen, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut, FileText, Search } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useList, useLookups, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { Today: () => [today(), today()], 'This Month': () => [dayjs(today()).startOf('month').format('YYYY-MM-DD'), today()], 'A/c Year': () => [fyStart(), today()], 'All Years': () => ['', ''] };
const BOOK = [
  { key: 'sno', label: 'S.No' }, { key: 'pledge_no', label: 'Bank Loan No' }, { key: 'pledge_date', label: 'Loan Date', type: 'date' }, { key: 'bank', label: 'Bank / Branch' },
  { key: 'loan_count', label: 'Loans', type: 'number' }, { key: 'total_wt', label: 'Weight', type: 'weight' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'interest_rate', label: '% / Year', type: 'number' },
  { key: 'days', label: 'Days', type: 'number' }, { key: 'interest', label: 'Interest (due / paid)', type: 'money' }, { key: 'release_date', label: 'Released On', type: 'date' }, { key: 'state', label: 'Status' },
];
const TAKEN = [
  { key: 'sno', label: 'S.No' }, { key: 'pledge_no', label: 'Bank Loan No' }, { key: 'bank', label: 'Bank / Branch' }, { key: 'pledge_date', label: 'Loan Date', type: 'date' }, { key: 'loan_count', label: 'Loans', type: 'number' },
  { key: 'total_wt', label: 'Weight', type: 'weight' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'charges', label: 'Charges', type: 'money' }, { key: 'cash_received', label: 'Cash Received', type: 'money' },
  { key: 'interest_rate', label: '% / Year', type: 'number' }, { key: 'state', label: 'Status' }, { key: 'release_date', label: 'Released On', type: 'date' },
];
const RELEASED = [
  { key: 'sno', label: 'S.No' }, { key: 'pledge_no', label: 'Bank Loan No' }, { key: 'bank', label: 'Bank / Branch' }, { key: 'pledge_date', label: 'Loan Date', type: 'date' }, { key: 'release_date', label: 'Released On', type: 'date' },
  { key: 'days', label: 'Days', type: 'number' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'interest_rate', label: 'Loan % / Yr', type: 'number' }, { key: 'interest_calc', label: 'Interest (calc.)', type: 'money' },
  { key: 'interest_paid', label: 'Interest Paid', type: 'money' }, { key: 'paid_pct_year', label: 'Paid % / Yr', type: 'number' }, { key: 'total_paid', label: 'Total Paid', type: 'money' },
  { key: 'our_interest', label: 'Our Interest', type: 'money' }, { key: 'our_margin', label: 'Our Margin', type: 'money' },
];
const MONTHS = [
  { key: 'month_label', label: 'Month' }, { key: 'taken_count', label: 'Taken', type: 'number' }, { key: 'taken', label: 'Taken Amount', type: 'money' },
  { key: 'released_count', label: 'Released', type: 'number' }, { key: 'released', label: 'Released Amount', type: 'money' }, { key: 'interest', label: 'Interest Paid', type: 'money' },
  { key: 'charges', label: 'Charges', type: 'money' }, { key: 'at_bank_count', label: 'At Bank (loans)', type: 'number' }, { key: 'balance', label: 'At Bank (amount)', type: 'money' },
];

function Grid({ cols, rows, onOpen, sel, setSel }) {
  return (
    <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
      <table className="w-full text-[12px]">
        <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold whitespace-nowrap', ['money', 'weight', 'number'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {!rows.length && <tr><td colSpan={cols.length} className="py-8 text-center text-[12px] text-ink-400">No bank loans for these filters</td></tr>}
          {rows.map((r) => (
            <tr key={r.id || r.month} onClick={() => setSel?.(r)} onDoubleClick={() => onOpen?.(r)} className={clsx('cursor-pointer', sel && (sel.id || sel.month) === (r.id || r.month) && 'bg-emerald-50 dark:bg-emerald-950/30')}>
              {cols.map((c) => <td key={c.key} className={clsx('px-2 py-1', ['money', 'weight', 'number'].includes(c.type) && 'num text-right')}>
                {c.key === 'state' ? <span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold', r.status === 'OPEN' ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800')}>{r.state}</span>
                  : c.type === 'money' ? amount(r[c.key]) : c.type === 'weight' ? weight(r[c.key]) : c.type === 'date' ? (r[c.key] ? date(r[c.key]) : '') : r[c.key] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-[12px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr>
            {cols.map((c, k) => {
              // desktop total row: amounts / weights / counts added; at-bank balance = the last month; rates and days left blank
              const skip = ['sno', 'pledge_no', 'interest_rate', 'days', 'paid_pct_year', 'rate_monthly'].includes(c.key) || !['money', 'weight', 'number'].includes(c.type);
              const v = ['balance', 'at_bank_count'].includes(c.key) ? n(rows.at(-1)?.[c.key]) : rows.filter((r) => !r.opening).reduce((t, r) => t + n(r[c.key]), 0);
              return <td key={c.key} className={clsx('px-2 py-1.5 font-semibold', ['money', 'weight', 'number'].includes(c.type) && 'num text-right')}>
                {k === 0 ? `Total - ${rows.filter((r) => !r.opening).length}` : skip ? '' : c.type === 'money' ? amount(v) : c.type === 'weight' ? weight(v) : v}</td>;
            })}
          </tr></tfoot>
        )}
      </table>
    </div>
  );
}

/** Bank Pledge Book (mode="book") and Bank Reports (mode="reports") - desktop screens. */
export default function BankBooksPage({ mode = 'book' }) {
  const navigate = useNavigate();
  const { data: lk } = useLookups();
  const { data: company } = useCompany();
  const [tab, setTab] = useState('taken');
  const init = { bank: '', date_on: 'loan', from: mode === 'book' ? '' : fyStart(), to: mode === 'book' ? '' : today(), search: '' };
  const [f, setF] = useState(init);
  const [q, setQ] = useState(init);   // loads on open, like the desktop app
  const [sel, setSel] = useState(null);
  const [view, setView] = useState(null);
  const dateOn = mode === 'reports' ? (tab === 'released' ? 'release' : 'loan') : f.date_on;
  const params = q && { bank_account_id: q.bank, date_on: dateOn, from: q.from, to: q.to, search: q.search, status: mode === 'reports' && tab === 'released' ? 'CLOSED' : '', pageSize: 200 };
  const list = useList('/bank/pledges', params || {}, { enabled: !!q && !(mode === 'reports' && tab === 'month') });
  const months = useFetch(q && mode === 'reports' && tab === 'month' ? '/bank/month-wise' : null, { bank_account_id: q?.bank, from: q?.from, to: q?.to });
  const detail = useFetch(view ? `/bank/pledges/${view}` : null);
  const t = list.data?.tiles;
  const rows = tab === 'month' && mode === 'reports'
    ? (months.data || []).map((m) => ({ ...m, month_label: m.opening ? 'Opening' : dayjs(`${m.month}-01`).format('MMM YYYY') }))
    : (list.data?.data || []).map((r, i) => ({ ...r, sno: i + 1, bank: `${r.bank_name}${r.bank_branch ? ` · ${r.bank_branch}` : ''}`, state: r.status === 'OPEN' ? 'At bank' : 'Released' }));
  const cols = mode === 'book' ? BOOK : { taken: TAKEN, released: RELEASED, month: MONTHS }[tab];
  const title = mode === 'book' ? 'Bank Pledge Book' : { taken: 'Bank Loans Taken', released: 'Bank Loans Released', month: 'Bank - Month-wise Summary' }[tab];
  const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
  const preview = () => printTable({ title: `${title}${q?.from ? ` · ${date(q.from)} to ${date(q.to)}` : ''}`, company, columns: cols, rows, totals: { amount: sum('amount'), total_wt: sum('total_wt'), interest: sum('interest'), taken: sum('taken'), released: sum('released') } });
  const load = () => setQ({ ...f });
  useKeys({ f5: load, f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv(title, cols, rows), 'ctrl+1': () => setTab('taken'), 'ctrl+2': () => setTab('released'), 'ctrl+3': () => setTab('month'), escape: () => navigate('/') }, [f, rows, tab]);
  const seg = (val, cur, set, label) => <button key={label} type="button" onClick={() => set(val)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', cur === val ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{cur === val && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{label}</button>;
  const tile = (l, v, h, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );

  return (
    /* fit-screen: the page fits the window; tables and panels scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">{mode === 'book' ? 'Bank Pledge Book' : 'Bank Reports'}</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">{mode === 'book' ? 'All bank loans - at bank and released' : 'Bank loans taken, released and month-wise balance at bank'}</p></div>
        {mode === 'book' && <div className="rounded-md bg-white px-5 py-1.5 text-center text-ink-900"><p className="text-xs font-bold">BANK LOANS</p><p className="font-bold">{t?.all ?? 0}</p></div>}
      </section>
      {mode === 'reports' && <div className="flex shrink-0 items-center"><div className="flex">{[['taken', 'Bank Loans Taken'], ['released', 'Bank Loans Released'], ['month', 'Month-wise Summary']].map(([k, l]) => seg(k, tab, setTab, l))}</div><span className="ml-auto text-[11px] text-ink-500">Rows shown: {rows.length}</span></div>}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Bank" className="w-72"><Select value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} options={[{ value: '', label: 'All banks' }, ...(lk?.banks || []).filter((b) => b.used_for !== 'OPERATING').map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))]} /></Field>
        {mode === 'book' && <div><p className="label">Date on</p><div className="flex">{seg('loan', f.date_on, (v) => setF({ ...f, date_on: v }), 'Loan Date')}{seg('release', f.date_on, (v) => setF({ ...f, date_on: v }), 'Release Date')}</div></div>}
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Quick</p><div className="flex">{Object.entries(QUICK).filter(([k]) => mode === 'reports' || k !== 'Today').map(([k, fn]) => <button key={k} type="button" onClick={() => { const [a, b] = fn(); setF({ ...f, from: a, to: b }); }} className="-ml-px h-8 border border-ink-200 bg-white px-2.5 text-[12px] font-semibold whitespace-nowrap text-ink-600 first:ml-0 first:rounded-l-md last:rounded-r-md hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">{k}</button>)}</div></div>
        <Field label="Search" className="w-56"><Input prefix={<Search className="size-3.5" />} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} /></Field>
        <Button className="ml-auto h-9" icon={FolderOpen} onClick={load}>Load (F5)</Button>
      </div>
      {mode === 'book' ? (
        <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
          {tile('All bank loans', t?.all ?? 0, `Rs. ${amount(t?.allAmt || 0)}`, 'bg-navy-800')}
          {tile('At bank (pending)', t?.open ?? 0, `Rs. ${amount(t?.openAmt || 0)}`, 'bg-violet-600')}
          {tile('Interest due', `Rs. ${amount(t?.interestDue || 0)}`, `on pending, as on ${date(new Date())}`, 'bg-rose-600')}
          {tile('Released', t?.released ?? 0, `Rs. ${amount(t?.releasedAmt || 0)}`, 'bg-emerald-700')}
          {tile('Interest paid', `Rs. ${amount(t?.interestPaid || 0)}`, 'on released', 'bg-amber-600')}
        </div>
      ) : tab === 'month' ? (() => {
        const m = (months.data || []).filter((x) => !x.opening); const op = (months.data || [])[0]; const last = (months.data || []).at(-1);
        const s2 = (k) => m.reduce((t2, x) => t2 + n(x[k]), 0);
        return (
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
            {tile('Opening at bank', `Rs. ${amount(op?.balance || 0)}`, `${op?.at_bank_count || 0} bank loans on ${q?.from ? date(dayjs(q.from).subtract(1, 'day')) : '-'}`, 'bg-navy-800')}
            {tile('Taken', `Rs. ${amount(s2('taken'))}`, `${s2('taken_count')} bank loans`, 'bg-blue-600')}
            {tile('Interest paid', `Rs. ${amount(s2('interest'))}`, '', 'bg-rose-600')}
            {tile('Released', `Rs. ${amount(s2('released'))}`, `${s2('released_count')} bank loans`, 'bg-amber-600')}
            {tile('Closing at bank', `Rs. ${amount(last?.balance || 0)}`, `${last?.at_bank_count || 0} bank loans on ${q?.to ? date(q.to) : '-'}`, 'bg-lime-700')}
          </div>
        );
      })() : (
        <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
          {tile(tab === 'taken' ? 'Bank loans taken' : 'Bank loans released', rows.length, q?.from ? `${date(q.from)} to ${date(q.to)}` : 'all years', 'bg-navy-800')}
          {tile(tab === 'taken' ? 'Amount' : 'Principal repaid', `Rs. ${amount(sum('amount'))}`, '', 'bg-blue-600')}
          {tab === 'taken' ? tile('Charges', `Rs. ${amount(sum('charges'))}`, 'document / processing', 'bg-rose-600') : tile('Interest paid to bank', `Rs. ${amount(sum('interest_paid'))}`, `average ${rows.length ? (rows.reduce((t, r) => t + n(r.paid_pct_year), 0) / rows.length).toFixed(2) : '0.00'}% / year`, 'bg-rose-600')}
          {tab === 'taken' ? tile('Cash received', `Rs. ${amount(sum('cash_received'))}`, '', 'bg-amber-600') : tile('Charges', `Rs. ${amount(sum('charges'))}`, 'on these bank loans', 'bg-amber-600')}
          {tab === 'taken'
            ? tile('Still at bank', rows.filter((r) => r.status === 'OPEN').length, `Rs. ${amount(rows.filter((r) => r.status === 'OPEN').reduce((s, r) => s + n(r.amount), 0))}`, 'bg-lime-700')
            : tile('Our interest (estimate)', `Rs. ${amount(sum('our_interest'))}`, `margin Rs. ${amount(sum('our_margin'))}`, 'bg-lime-700')}
        </div>
      )}
      <Grid cols={cols} rows={rows} sel={sel} setSel={setSel} onOpen={(r) => r.id && setView(r.id)} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        {!(mode === 'reports' && tab === 'month') && <Button variant="outline" icon={FileText} disabled={!sel?.id} onClick={() => setView(sel.id)}>Bank Loan Details (Enter)</Button>}
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => { list.refetch?.(); months.refetch?.(); }}>Refresh</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv(title, cols, rows)}>Excel</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">{mode === 'reports' ? 'Ctrl+1 / 2 / 3 = report · ' : ''}F5 = load · Enter / double-click = bank loan details · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <Drawer open={!!view} onClose={() => setView(null)} size="lg" title={detail.data ? `Bank loan ${detail.data.pledge_no}` : 'Bank loan'} subtitle={detail.data && `${detail.data.bank_name} · ${date(detail.data.pledge_date)} · ${detail.data.status === 'OPEN' ? 'at bank' : `released ${date(detail.data.release_date)}`}`}>
        {detail.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">{[['Amount', amount(detail.data.amount)], ['% / year', n(detail.data.interest_rate)], ['Charges', amount(detail.data.charges)], ['Weight', `${weight(detail.data.total_wt)} g`], ['Days', detail.data.calc.days], [detail.data.status === 'OPEN' ? 'Interest due' : 'Interest paid', amount(detail.data.status === 'OPEN' ? detail.data.calc.interest : detail.data.interest_paid)]].map(([k, v]) => (
              <div key={k} className="rounded-md border border-ink-200 px-3 py-1.5 dark:border-ink-800"><p className="label">{k}</p><p className="num font-bold">{v}</p></div>))}</div>
            <table className="w-full text-[12px]"><thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['Loan', 'Customer', 'Items', 'Net Wt', 'Amount', 'Status'].map((h) => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200">{detail.data.loans.map((l) => <tr key={l.id}><td className="px-2 py-1">{l.bill_no}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.item_summary}</td><td className="num px-2">{weight(l.net_wt)}</td><td className="num px-2">{amount(l.current_principal)}</td><td className="px-2">{l.status}</td></tr>)}</tbody></table>
            {detail.data.status === 'OPEN' && <Button variant="outline" onClick={() => { const id = detail.data.id; setView(null); navigate(`/bank/release?pledge=${id}`); }}>Release from Bank</Button>}
          </div>
        )}
      </Drawer>
    </div>
  );
}

