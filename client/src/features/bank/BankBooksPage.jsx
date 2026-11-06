import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderOpen, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut, FileText } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useList, useLookups, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { Today: () => [today(), today()], 'This Month': () => [dayjs().startOf('month').format('YYYY-MM-DD'), today()], 'A/c Year': () => [fyStart(), today()], 'All Years': () => ['', ''] };
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
  { key: 'days', label: 'Days', type: 'number' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'interest_paid', label: 'Interest Paid', type: 'money' }, { key: 'total_paid', label: 'Total Paid', type: 'money' },
];
const MONTHS = [
  { key: 'month_label', label: 'Month' }, { key: 'taken_count', label: 'Taken', type: 'number' }, { key: 'taken', label: 'Amount Taken', type: 'money' }, { key: 'charges', label: 'Charges', type: 'money' },
  { key: 'released_count', label: 'Released', type: 'number' }, { key: 'released', label: 'Amount Repaid', type: 'money' }, { key: 'interest', label: 'Interest Paid', type: 'money' }, { key: 'balance', label: 'Balance at Bank', type: 'money' },
];

function Grid({ cols, rows, onOpen, sel, setSel }) {
  return (
    <div className="card min-h-[calc(100vh-30rem)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="navy-gradient sticky top-0 text-white"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-2 whitespace-nowrap', ['money', 'weight', 'number'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
          {!rows.length && <tr><td colSpan={cols.length} className="py-16 text-center text-ink-400">Press Load (F5)</td></tr>}
          {rows.map((r) => (
            <tr key={r.id || r.month} onClick={() => setSel?.(r)} onDoubleClick={() => onOpen?.(r)} className={clsx('cursor-pointer', sel && (sel.id || sel.month) === (r.id || r.month) && 'bg-navy-50 dark:bg-ink-800')}>
              {cols.map((c) => <td key={c.key} className={clsx('px-2 py-1.5', ['money', 'weight', 'number'].includes(c.type) && 'num text-right')}>
                {c.key === 'state' ? <span className={clsx('rounded px-2 py-0.5 text-xs font-bold', r.status === 'OPEN' ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800')}>{r.state}</span>
                  : c.type === 'money' ? amount(r[c.key]) : c.type === 'weight' ? weight(r[c.key]) : c.type === 'date' ? (r[c.key] ? date(r[c.key]) : '') : r[c.key] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
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
  const [f, setF] = useState({ bank: '', date_on: 'loan', from: mode === 'book' ? '' : fyStart(), to: mode === 'book' ? '' : today(), search: '' });
  const [q, setQ] = useState(null);
  const [sel, setSel] = useState(null);
  const [view, setView] = useState(null);
  const dateOn = mode === 'reports' ? (tab === 'released' ? 'release' : 'loan') : f.date_on;
  const params = q && { bank_account_id: q.bank, date_on: dateOn, from: q.from, to: q.to, search: q.search, status: mode === 'reports' && tab === 'released' ? 'CLOSED' : '', pageSize: 200 };
  const list = useList('/bank/pledges', params || {}, { enabled: !!q && !(mode === 'reports' && tab === 'month') });
  const months = useFetch(q && mode === 'reports' && tab === 'month' ? '/bank/month-wise' : null, { bank_account_id: q?.bank, from: q?.from, to: q?.to });
  const detail = useFetch(view ? `/bank/pledges/${view}` : null);
  const t = list.data?.tiles;
  const rows = tab === 'month' && mode === 'reports'
    ? (months.data || []).map((m) => ({ ...m, month_label: dayjs(`${m.month}-01`).format('MMM YYYY') }))
    : (list.data?.data || []).map((r, i) => ({ ...r, sno: i + 1, bank: `${r.bank_name}${r.bank_branch ? ` · ${r.bank_branch}` : ''}`, state: r.status === 'OPEN' ? 'At bank' : 'Released' }));
  const cols = mode === 'book' ? BOOK : { taken: TAKEN, released: RELEASED, month: MONTHS }[tab];
  const title = mode === 'book' ? 'Bank Pledge Book' : { taken: 'Bank Loans Taken', released: 'Bank Loans Released', month: 'Bank - Month-wise Summary' }[tab];
  const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
  const preview = () => printTable({ title: `${title}${q?.from ? ` · ${date(q.from)} to ${date(q.to)}` : ''}`, company, columns: cols, rows, totals: { amount: sum('amount'), total_wt: sum('total_wt'), interest: sum('interest'), taken: sum('taken'), released: sum('released') } });
  const load = () => setQ({ ...f });
  useKeys({ f5: load, f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv(title, cols, rows), 'ctrl+1': () => setTab('taken'), 'ctrl+2': () => setTab('released'), 'ctrl+3': () => setTab('month'), escape: () => navigate('/') }, [f, rows, tab]);
  const seg = (val, cur, set, label) => <button key={label} type="button" onClick={() => set(val)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', cur === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{label}</button>;
  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">{mode === 'book' ? 'Bank Pledge Book' : 'Bank Reports'}</h1><p className="text-sm text-navy-100">{mode === 'book' ? 'All bank loans - at bank and released' : 'Bank loans taken, released and month-wise balance at bank'}</p></div>
        {mode === 'book' && <div className="rounded-md bg-white px-5 py-1.5 text-center text-ink-900"><p className="text-xs font-bold">BANK LOANS</p><p className="font-bold">{t?.all ?? 0}</p></div>}
      </section>
      {mode === 'reports' && <div className="flex gap-1">{[['taken', 'Bank Loans Taken'], ['released', 'Bank Loans Released'], ['month', 'Month-wise Summary']].map(([k, l]) => seg(k, tab, setTab, l))}<span className="ml-auto self-center text-xs text-ink-500">Rows shown: {rows.length}</span></div>}
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Bank" className="w-72"><Select value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} options={[{ value: '', label: 'All banks' }, ...(lk?.banks || []).filter((b) => b.used_for !== 'OPERATING').map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))]} /></Field>
        {mode === 'book' && <div><p className="label">Date on</p><div className="flex gap-1">{seg('loan', f.date_on, (v) => setF({ ...f, date_on: v }), 'Loan Date')}{seg('release', f.date_on, (v) => setF({ ...f, date_on: v }), 'Release Date')}</div></div>}
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Quick</p><div className="flex gap-1">{Object.entries(QUICK).filter(([k]) => mode === 'reports' || k !== 'Today').map(([k, fn]) => <button key={k} type="button" onClick={() => { const [a, b] = fn(); setF({ ...f, from: a, to: b }); }} className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 dark:bg-ink-900 dark:text-white">{k}</button>)}</div></div>
        <Field label="Search" className="w-64"><Input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} /></Field>
        <Button className="ml-auto" size="lg" variant="outline" icon={FolderOpen} onClick={load}>Load (F5)</Button>
      </div>
      {mode === 'book' ? (
        <div className="grid gap-3 sm:grid-cols-5">
          {tile('All bank loans', t?.all ?? 0, `Rs. ${amount(t?.allAmt || 0)}`, 'border-t-navy-800 bg-cream-100')}
          {tile('At bank (pending)', t?.open ?? 0, `Rs. ${amount(t?.openAmt || 0)}`, 'border-t-violet-600')}
          {tile('Interest due', `Rs. ${amount(t?.interestDue || 0)}`, `on pending, as on ${date(new Date())}`, 'border-t-rose-600')}
          {tile('Released', t?.released ?? 0, `Rs. ${amount(t?.releasedAmt || 0)}`, 'border-t-emerald-700')}
          {tile('Interest paid', `Rs. ${amount(t?.interestPaid || 0)}`, 'on released', 'border-t-amber-600')}
        </div>
      ) : tab !== 'month' && (
        <div className="grid gap-3 sm:grid-cols-5">
          {tile(tab === 'taken' ? 'Bank loans taken' : 'Bank loans released', rows.length, q?.from ? `${date(q.from)} to ${date(q.to)}` : 'all years', 'border-t-navy-800')}
          {tile('Amount', `Rs. ${amount(sum('amount'))}`, '', 'border-t-blue-600')}
          {tab === 'taken' ? tile('Charges', `Rs. ${amount(sum('charges'))}`, 'document / processing', 'border-t-rose-600') : tile('Interest paid', `Rs. ${amount(sum('interest_paid'))}`, '', 'border-t-rose-600')}
          {tab === 'taken' ? tile('Cash received', `Rs. ${amount(sum('cash_received'))}`, '', 'border-t-amber-600') : tile('Total paid', `Rs. ${amount(sum('total_paid'))}`, '', 'border-t-amber-600')}
          {tile('Still at bank', rows.filter((r) => r.status === 'OPEN').length, `Rs. ${amount(rows.filter((r) => r.status === 'OPEN').reduce((s, r) => s + n(r.amount), 0))}`, 'border-t-lime-700')}
        </div>
      )}
      <Grid cols={cols} rows={rows} sel={sel} setSel={setSel} onOpen={(r) => r.id && setView(r.id)} />
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        {!(mode === 'reports' && tab === 'month') && <Button variant="outline" icon={FileText} disabled={!sel?.id} onClick={() => setView(sel.id)}>Bank Loan Details (Enter)</Button>}
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => { list.refetch?.(); months.refetch?.(); }}>Refresh</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv(title, cols, rows)}>Excel</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">{mode === 'reports' ? 'Ctrl+1 / 2 / 3 = report · ' : ''}F5 = load · Enter / double-click = bank loan details · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <Drawer open={!!view} onClose={() => setView(null)} size="lg" title={detail.data ? `Bank loan ${detail.data.pledge_no}` : 'Bank loan'} subtitle={detail.data && `${detail.data.bank_name} · ${date(detail.data.pledge_date)} · ${detail.data.status === 'OPEN' ? 'at bank' : `released ${date(detail.data.release_date)}`}`}>
        {detail.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">{[['Amount', amount(detail.data.amount)], ['% / year', n(detail.data.interest_rate)], ['Charges', amount(detail.data.charges)], ['Weight', `${weight(detail.data.total_wt)} g`], ['Days', detail.data.calc.days], [detail.data.status === 'OPEN' ? 'Interest due' : 'Interest paid', amount(detail.data.status === 'OPEN' ? detail.data.calc.interest : detail.data.interest_paid)]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-ink-50 px-3 py-2 dark:bg-ink-800"><p className="label">{k}</p><p className="num font-bold">{v}</p></div>))}</div>
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr>{['Loan', 'Customer', 'Items', 'Net Wt', 'Amount', 'Status'].map((h) => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200">{detail.data.loans.map((l) => <tr key={l.id}><td className="px-2 py-1">{l.bill_no}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.item_summary}</td><td className="num px-2">{weight(l.net_wt)}</td><td className="num px-2">{amount(l.current_principal)}</td><td className="px-2">{l.status}</td></tr>)}</tbody></table>
            {detail.data.status === 'OPEN' && <Button variant="outline" onClick={() => { const id = detail.data.id; setView(null); navigate(`/bank/release?pledge=${id}`); }}>Release from Bank</Button>}
          </div>
        )}
      </Drawer>
    </div>
  );
}

