import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Search, FileDown, FileSpreadsheet, Eye, RefreshCw, BookOpen, LogOut, Scale, TrendingUp, Table2 } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { 'This A/c year': () => [fyStart(), today()], 'This month': () => [dayjs(today()).startOf('month').format('YYYY-MM-DD'), today()], 'Last month': () => [dayjs(today()).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs(today()).subtract(1, 'month').endOf('month').format('YYYY-MM-DD')] };
const NATURE = { ASSET: 'Balance Sheet - Asset', LIABILITY: 'Balance Sheet - Liability', EQUITY: 'Balance Sheet - Capital', INCOME: 'P&L - Income', EXPENSE: 'P&L - Expense' };
const TABS = [['tb', 'Trial Balance', Scale], ['pl', 'Profit & Loss', TrendingUp], ['bs', 'Balance Sheet', Table2]];

function TSide({ title, rows, total, extra }) {
  return (
    <div className="flex min-h-80 flex-col overflow-hidden rounded-md border border-ink-300 dark:border-ink-700">
      <div className="navy-gradient flex justify-between px-3 py-2 text-sm font-bold text-white"><span>{title}</span><span>Amount</span></div>
      <div className="flex-1 divide-y divide-ink-100 text-sm dark:divide-ink-800">
        {rows.map((r, i) => (
          <div key={`${r.id}-${r.name}`}>
            {r.section && r.section !== rows[i - 1]?.section && <p className="bg-ink-50 px-3 pt-1.5 pb-0.5 text-[10px] font-bold tracking-wide text-ink-500 uppercase dark:bg-ink-800/60">{r.section}</p>}
            <div className={clsx('flex justify-between px-3 py-1.5', r.profit && 'bg-emerald-50 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30')}><span>{r.name}{r.group_name && <span className="ml-2 text-[11px] text-ink-400">{r.group_name}</span>}</span><span className="num">{amount(r.amount)}</span></div>
          </div>
        ))}
        {extra && <div className="flex justify-between bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30"><span>{extra[0]}</span><span className="num">{amount(extra[1])}</span></div>}
      </div>
      <div className="navy-gradient flex justify-between px-3 py-2 text-sm font-bold text-white"><span>Total</span><span className="num">{amount(total)}</span></div>
    </div>
  );
}

/** Final Accounts (desktop): Trial Balance, Profit & Loss and Balance Sheet in one screen with tabs. */
export default function FinalAccountsPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { data: company } = useCompany();
  const [tab, setTab] = useState(sp.get('tab') || 'tb');
  const [f, setF] = useState({ from: fyStart(), to: today(), hideZero: false });
  // books: 'mybook' = the desktop layout (Girvi, Ashal Jama, Interest Jama, Old Loan Opening ...), 'detailed' = every ledger
  const [books, setBooksState] = useState(() => { try { return localStorage.getItem('gf.books') || 'mybook'; } catch { return 'mybook'; } });
  const setBooks = (v) => { setBooksState(v); try { localStorage.setItem('gf.books', v); } catch { /* private mode */ } };
  const mb = books === 'mybook';
  const [q, setQ] = useState(f);
  const tb = useFetch(tab === 'tb' ? '/accounts/trial-balance' : null, { to: q.to, all: '1', books });
  const pl = useFetch(tab !== 'tb' ? '/accounts/profit-loss' : null, { from: q.from, to: q.to, books });
  const bs = useFetch(tab === 'bs' ? '/accounts/balance-sheet' : null, { to: q.to, from: q.from, books });
  const day = useFetch('/accounts/day-summary', { from: q.to, to: q.to });
  const tbRows = (tb.data?.rows || []).filter((r) => !q.hideZero || r.balance).map((r, i) => ({ ...r, sno: mb ? r.code || '' : i + 1, group: NATURE[r.nature] || r.group_name, dr: r.balance > 0 ? r.balance : 0, cr: r.balance < 0 ? -r.balance : 0 }));
  const cashRow = tbRows.find((r) => r.system_key === 'CASH');
  const p = pl.data; const b = bs.data;
  const show = () => setQ(f);
  const exportRows = () => (tab === 'tb' ? [tbRows, [{ key: 'sno', label: 'A/c' }, { key: 'name', label: 'Account' }, { key: 'group', label: 'Group' }, { key: 'dr', label: 'Nave (Debit)', type: 'money' }, { key: 'cr', label: 'Jama (Credit)', type: 'money' }]]
    : tab === 'pl' ? [[...(p?.expense || []).map((r) => ({ ...r, side: 'Expense' })), ...(p?.income || []).map((r) => ({ ...r, side: 'Income' }))], [{ key: 'side', label: 'Side' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'money' }]]
      : [[...(b?.liabilities || []).map((r) => ({ ...r, side: 'Capital & Liabilities' })), ...(b?.assets || []).map((r) => ({ ...r, side: 'Assets' }))], [{ key: 'side', label: 'Side' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', type: 'money' }]]);
  const title = { tb: `Trial Balance as on ${date(q.to)}`, pl: `Profit & Loss ${date(q.from)} - ${date(q.to)}`, bs: `Balance Sheet as on ${date(q.to)}` }[tab];
  const print = () => { const [rows, columns] = exportRows(); printTable({ title, company, rows, columns, totals: tab === 'tb' ? { dr: tb.data?.totalDebit, cr: tb.data?.totalCredit } : undefined }); };
  useKeys({ f5: show, f6: () => { tb.refetch?.(); pl.refetch?.(); bs.refetch?.(); }, f9: print, 'ctrl+p': print, 'ctrl+e': () => { const [rows, columns] = exportRows(); exportCsv(title, columns, rows); },
    arrowleft: () => setTab(TABS[(TABS.findIndex((t) => t[0] === tab) + 2) % 3][0]), arrowright: () => setTab(TABS[(TABS.findIndex((t) => t[0] === tab) + 1) % 3][0]), escape: () => navigate('/') }, [tab, f, q, tbRows, p, b]);
  const tile = (l, v, h, cls, dark) => <div className={clsx('rounded-md border-t-4 px-4 py-3', dark ? 'navy-gradient border-t-amber-500 text-white' : 'card', cls)}><p className="text-xs font-bold uppercase opacity-80">{l}</p><p className="num text-2xl font-bold">{v}</p><p className="text-[11px] opacity-70">{h}</p></div>;
  const pote = day.data?.cash?.closing;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">{TABS.find((t) => t[0] === tab)[1]}</h1>
        <p className="text-sm text-navy-100">{{ tb: `Closing balance of every account on ${date(q.to)} - Nave (debit) and Jama (credit) must be equal`, pl: `Income minus expenses from ${date(q.from)} - ${date(q.to)}`, bs: `What the business owns and owes on ${date(q.to)}` }[tab]}</p></section>
      <div className="flex gap-1">{TABS.map(([k, l, I]) => <button key={k} type="button" onClick={() => setTab(k)} className={clsx('flex h-10 items-center gap-2 rounded-md border px-5 text-sm font-semibold', tab === k ? 'border-ink-400 bg-white text-navy-900 dark:bg-ink-900 dark:text-white' : 'border-transparent bg-ink-100 text-ink-600 dark:bg-ink-800')}><I className="size-4" />{l}</button>)}</div>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        {tab === 'pl' && <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>}
        {tab !== 'pl' && <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>}
        <Field label="To / as on"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex gap-1">{Object.entries(QUICK).map(([k, fn]) => <button key={k} type="button" onClick={() => { const [a, c] = fn(); const nf = { ...f, from: a, to: c }; setF(nf); setQ(nf); }} className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 dark:bg-ink-900 dark:text-white">{k}</button>)}</div>
        <div><p className="label">Books</p><div className="flex gap-1">{[['mybook', 'MyBook heads'], ['detailed', 'Detailed ledgers']].map(([k, l]) => <button key={k} type="button" onClick={() => setBooks(k)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', books === k ? 'border-navy-700 bg-navy-800 text-white' : 'border-ink-300 bg-white text-navy-800 hover:bg-navy-50 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div></div>
        <Checkbox checked={f.hideZero} onChange={(v) => { setF({ ...f, hideZero: v }); setQ({ ...q, hideZero: v }); }} label="Hide zero accounts" />
        <span className="flex-1" />
        <Button variant="outline" icon={Search} onClick={show}>Show (F5)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => { const [rows, columns] = exportRows(); exportCsv(title, columns, rows); }}>Excel</Button>
        <Button variant="outline" icon={Eye} onClick={print}>Print Preview (F9)</Button>
      </div>

      {tab === 'tb' && (<>
        <div className="grid gap-3 sm:grid-cols-4">
          {tile('Total Nave (Debit)', amount(tb.data?.totalDebit || 0), '', 'border-t-rose-600')}
          {tile('Total Jama (Credit)', amount(tb.data?.totalCredit || 0), '', 'border-t-emerald-700')}
          {tile('Cash in hand (books)', amount(cashRow?.balance || 0), `${tbRows.length} accounts + cash`, 'border-t-ink-400')}
          {tile(`Pote Baki (Day End ${date(q.to)})`, amount(pote || 0), n(pote) !== n(cashRow?.balance) ? `Books differ by ${amount(Math.abs(n(pote) - n(cashRow?.balance)))}` : 'Books agree', '', true)}
        </div>
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr><th className="w-16 px-2 py-2 text-left">A/c</th><th className="px-2 text-left">Account</th><th className="px-2 text-left">Group</th><th className="px-2 text-right">Nave (Debit)</th><th className="px-2 text-right">Jama (Credit)</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">{tbRows.map((r) => (
              <tr key={r.id} onDoubleClick={() => (mb ? r.ledger_id : r.id) && navigate(`/accounts/ledger?ledger=${mb ? r.ledger_id : r.id}`)} className="cursor-pointer hover:bg-navy-50/60"><td className="px-2 py-1.5">{r.sno}</td><td className="px-2">{r.name}</td><td className="px-2 text-ink-600">{r.group}</td><td className="num px-2 text-right">{r.dr ? amount(r.dr) : ''}</td><td className="num px-2 text-right">{r.cr ? amount(r.cr) : ''}</td></tr>
            ))}</tbody>
            <tfoot className="navy-gradient text-white"><tr className="font-bold"><td colSpan={3} className="px-2 py-2">Total ({tbRows.length} accounts)</td><td className="num px-2 text-right">{amount(tb.data?.totalDebit || 0)}</td><td className="num px-2 text-right">{amount(tb.data?.totalCredit || 0)}</td></tr></tfoot>
          </table>
        </div>
        <p className="text-sm text-ink-500">Debit and credit always match because cash in hand is the balancing line. Compare it with the Day End Pote Baki (right tile).{mb ? ' MyBook heads: part payments are Ashal Jama, old paper loans are Old Loan Opening - "Detailed ledgers" shows every account.' : ''}</p>
      </>)}

      {tab === 'pl' && (<>
        <div className="grid gap-3 sm:grid-cols-4">
          {tile('Total income', amount(p?.totalIncome || 0), '', 'border-t-emerald-700')}
          {tile('Total expenses', amount(p?.totalExpense || 0), '', 'border-t-rose-600')}
          {tile('Period', `${date(q.from)} - ${date(q.to)}`, '', 'border-t-ink-400')}
          {tile(n(p?.netProfit) >= 0 ? 'Net profit' : 'Net loss', amount(Math.abs(p?.netProfit || 0)), '', '', true)}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <TSide title="Expenses (Nave)" rows={p?.expense || []} total={Math.max(n(p?.totalExpense) + Math.max(0, n(p?.netProfit)), n(p?.totalIncome))} extra={n(p?.netProfit) > 0 ? ['Net Profit (to Balance Sheet)', p.netProfit] : null} />
          <TSide title="Income (Jama)" rows={p?.income || []} total={Math.max(n(p?.totalIncome) + Math.max(0, -n(p?.netProfit)), n(p?.totalExpense))} extra={n(p?.netProfit) < 0 ? ['Net Loss (to Balance Sheet)', -p.netProfit] : null} />
        </div>
        <p className="text-sm text-ink-500">Only accounts in the Profit &amp; Loss group, entries from {date(q.from)} - {date(q.to)}.</p>
      </>)}

      {tab === 'bs' && (<>
        <div className="grid gap-3 sm:grid-cols-4">
          {tile('Capital + liabilities', amount(b?.totalLiabilities || 0), '', 'border-t-rose-600')}
          {tile('Assets', amount(b?.totalAssets || 0), '', 'border-t-emerald-700')}
          {tile('Net profit (from P&L)', amount(p?.netProfit || 0), `${date(q.from)} - ${date(q.to)}`, 'border-t-ink-400')}
          {tile('Difference', `${amount(b?.difference || 0)}${Math.abs(n(b?.difference)) < 0.01 ? ' ✓ Tallied' : ''}`, '', '', true)}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <TSide title="Capital & Liabilities" rows={(b?.liabilities || []).map((r) => (mb ? { ...r, group_name: '' } : r))} total={b?.totalLiabilities || 0} />
          <TSide title="Assets" rows={(b?.assets || []).filter((r) => !(q.hideZero && r.zero)).map((r) => (mb ? { ...r, group_name: '' } : r))} total={b?.totalAssets || 0} />
        </div>
        <p className="text-sm text-ink-500">Balance Sheet accounts on {date(q.to)}. A Jama balance is shown under Capital / Liabilities, a Nave balance under Assets.</p>
      </>)}

      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => { tb.refetch?.(); pl.refetch?.(); bs.refetch?.(); }}>Refresh (F6)</Button>
        <Button variant="outline" icon={BookOpen} onClick={() => navigate('/accounts/ledger')}>Open Ledger (Enter)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">Left / Right = change report · F5 = show · F6 = refresh · double-click account = its ledger · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
    </div>
  );
}
