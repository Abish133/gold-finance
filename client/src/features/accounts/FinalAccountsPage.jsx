import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Search, FileDown, FileSpreadsheet, Eye, RefreshCw, BookOpen, LogOut, Scale, TrendingUp, Table2 } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { SHELL, Head, HeadTabs, Chip, Toggle, Bar, Actions, Strip, F, thead, tfoot, inp, SwitchPill, RunButton } from './compact';

const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
const QUICK = { 'This A/c year': () => [fyStart(), today()], 'This month': () => [dayjs(today()).startOf('month').format('YYYY-MM-DD'), today()], 'Last month': () => [dayjs(today()).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs(today()).subtract(1, 'month').endOf('month').format('YYYY-MM-DD')] };
const NATURE = { ASSET: 'Balance Sheet - Asset', LIABILITY: 'Balance Sheet - Liability', EQUITY: 'Balance Sheet - Capital', INCOME: 'P&L - Income', EXPENSE: 'P&L - Expense' };
const TABS = [['tb', 'Trial Balance', Scale], ['pl', 'Profit & Loss', TrendingUp], ['bs', 'Balance Sheet', Table2]];

function TSide({ title, rows, total, extra }) {
  return (
    <div className="flex min-h-64 flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
      <div className="navy-gradient flex shrink-0 justify-between px-3 py-2 text-[10px] font-bold tracking-wider text-white uppercase"><span>{title}</span><span>Amount</span></div>
      <div className="min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto text-[12px] dark:divide-ink-800">
        {rows.map((r, i) => (
          <div key={`${r.id}-${r.name}`}>
            {r.section && r.section !== rows[i - 1]?.section && <p className="sticky top-0 bg-ink-50 px-3 pt-1.5 pb-0.5 text-[10px] font-bold tracking-wide text-ink-500 uppercase dark:bg-ink-800/60">{r.section}</p>}
            <div className={clsx('flex justify-between gap-2 px-3 py-1', r.profit && 'bg-emerald-50 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/30')}><span>{r.name}{r.group_name && <span className="ml-2 text-[11px] text-ink-400">{r.group_name}</span>}</span><span className="num">{amount(r.amount)}</span></div>
          </div>
        ))}
        {extra && <div className="flex justify-between bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/30"><span>{extra[0]}</span><span className="num">{amount(extra[1])}</span></div>}
      </div>
      <div className="flex shrink-0 justify-between border-t-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"><span className="text-[11px] tracking-wider uppercase">Total</span><span className="num">{amount(total)}</span></div>
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
  const pote = day.data?.cash?.closing;
  const isQ = (k) => { const [a, c] = QUICK[k](); return f.from === a && f.to === c; };
  const strip = {
    tb: [{ label: 'Total Nave (Debit)', value: amount(tb.data?.totalDebit || 0), bar: 'bg-rose-600', tone: 'text-rose-600' }, { label: 'Total Jama (Credit)', value: amount(tb.data?.totalCredit || 0), bar: 'bg-emerald-600', tone: 'text-emerald-700' },
      { label: 'Cash in hand (books)', value: amount(cashRow?.balance || 0), hint: `${tbRows.length} accounts`, bar: 'bg-ink-400' },
      { label: `Pote Baki (Day End ${date(q.to)})`, value: amount(pote || 0), hint: n(pote) !== n(cashRow?.balance) ? `Books differ by ${amount(Math.abs(n(pote) - n(cashRow?.balance)))}` : 'Books agree', bar: 'bg-amber-500' }],
    pl: [{ label: 'Total income', value: amount(p?.totalIncome || 0), bar: 'bg-emerald-600', tone: 'text-emerald-700' }, { label: 'Total expenses', value: amount(p?.totalExpense || 0), bar: 'bg-rose-600', tone: 'text-rose-600' },
      { label: 'Period', value: `${date(q.from)} - ${date(q.to)}`, bar: 'bg-ink-400' }, { label: n(p?.netProfit) >= 0 ? 'Net profit' : 'Net loss', value: amount(Math.abs(p?.netProfit || 0)), bar: 'bg-amber-500', tone: n(p?.netProfit) >= 0 ? 'text-emerald-700' : 'text-rose-600' }],
    bs: [{ label: 'Capital + liabilities', value: amount(b?.totalLiabilities || 0), bar: 'bg-rose-600' }, { label: 'Assets', value: amount(b?.totalAssets || 0), bar: 'bg-emerald-600' },
      { label: 'Net profit (from P&L)', value: amount(p?.netProfit || 0), hint: `${date(q.from)} - ${date(q.to)}`, bar: 'bg-ink-400' },
      { label: 'Difference', value: amount(b?.difference || 0), hint: Math.abs(n(b?.difference)) < 0.01 ? '✓ Tallied' : 'not tallied', bar: 'bg-amber-500', tone: Math.abs(n(b?.difference)) < 0.01 ? 'text-emerald-700' : 'text-rose-600' }],
  }[tab];
  const note = {
    tb: `Debit and credit always match because cash in hand is the balancing line - compare it with the Day End Pote Baki.${mb ? ' MyBook heads: part payments are Ashal Jama, old paper loans are Old Loan Opening.' : ''} Double-click an account = its ledger.`,
    pl: `Only accounts in the Profit & Loss group, entries from ${date(q.from)} - ${date(q.to)}.`,
    bs: `Balance Sheet accounts on ${date(q.to)}. A Jama balance is shown under Capital / Liabilities, a Nave balance under Assets.`,
  }[tab];

  return (
    /* fit-screen: report fills the window; tables scroll on their own */
    <div className={SHELL}>
      <Head icon={TABS.find((t) => t[0] === tab)[2]} title={TABS.find((t) => t[0] === tab)[1]}
        sub={{ tb: `Closing balance of every account on ${date(q.to)} - Nave and Jama must be equal`, pl: `Income minus expenses from ${date(q.from)} - ${date(q.to)}`, bs: `What the business owns and owes on ${date(q.to)}` }[tab]}>
        <HeadTabs value={tab} onChange={setTab} tabs={TABS} />
      </Head>
      <Bar>
        <F label="From"><Input type="date" className={`${inp} w-36`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></F>
        <F label="To / as on"><Input type="date" className={`${inp} w-36`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></F>
        <Toggle options={Object.keys(QUICK).map((k) => [k, k])} isOn={isQ} onChange={(k) => { const [a, c] = QUICK[k](); const nf = { ...f, from: a, to: c }; setF(nf); setQ(nf); }} />
        <F label="Books"><Toggle value={books} onChange={setBooks} options={[['mybook', 'MyBook heads'], ['detailed', 'Detailed ledgers']]} /></F>
        <SwitchPill checked={f.hideZero} onChange={(v) => { setF({ ...f, hideZero: v }); setQ({ ...q, hideZero: v }); }} label="Hide zero accounts" />
        <RunButton className="ml-auto" icon={Search} label="Show" keyHint="F5" onClick={show} />
      </Bar>
      <Strip items={strip} />

      {tab === 'tb' && (
        <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-[12px]">
              <thead className={thead}><tr><th className="w-16 px-3 py-2 text-left">A/c</th><th className="px-3 text-left">Account</th><th className="px-3 text-left">Group</th><th className="px-3 text-right">Nave (Debit)</th><th className="px-3 text-right">Jama (Credit)</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{tbRows.map((r) => (
                <tr key={r.id} onDoubleClick={() => (mb ? r.ledger_id : r.id) && navigate(`/accounts/ledger?ledger=${mb ? r.ledger_id : r.id}`)} className={clsx('cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50', r.system_key === 'CASH' && 'bg-amber-50/50 font-semibold dark:bg-amber-950/20')}>
                  <td className="num px-3 py-1.5 text-ink-500">{r.sno}</td><td className="px-3">{r.name}</td><td className="px-3 text-[11px] text-ink-500">{r.group}</td><td className="num px-3 text-right text-rose-600">{r.dr ? amount(r.dr) : ''}</td><td className="num px-3 text-right text-emerald-700">{r.cr ? amount(r.cr) : ''}</td></tr>
              ))}
              {!tbRows.length && <tr><td colSpan={5} className="py-12 text-center text-ink-400">No accounts</td></tr>}</tbody>
              <tfoot className={tfoot}><tr><td colSpan={3} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total · {tbRows.length} accounts</td><td className="num px-3 text-right">{amount(tb.data?.totalDebit || 0)}</td><td className="num px-3 text-right">{amount(tb.data?.totalCredit || 0)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}
      {tab === 'pl' && (
        <div className="grid gap-2 xl:min-h-0 xl:flex-1 lg:grid-cols-2">
          <TSide title="Expenses (Nave)" rows={p?.expense || []} total={Math.max(n(p?.totalExpense) + Math.max(0, n(p?.netProfit)), n(p?.totalIncome))} extra={n(p?.netProfit) > 0 ? ['Net Profit (to Balance Sheet)', p.netProfit] : null} />
          <TSide title="Income (Jama)" rows={p?.income || []} total={Math.max(n(p?.totalIncome) + Math.max(0, -n(p?.netProfit)), n(p?.totalExpense))} extra={n(p?.netProfit) < 0 ? ['Net Loss (to Balance Sheet)', -p.netProfit] : null} />
        </div>
      )}
      {tab === 'bs' && (
        <div className="grid gap-2 xl:min-h-0 xl:flex-1 lg:grid-cols-2">
          <TSide title="Capital & Liabilities" rows={(b?.liabilities || []).map((r) => (mb ? { ...r, group_name: '' } : r))} total={b?.totalLiabilities || 0} />
          <TSide title="Assets" rows={(b?.assets || []).filter((r) => !(q.hideZero && r.zero)).map((r) => (mb ? { ...r, group_name: '' } : r))} total={b?.totalAssets || 0} />
        </div>
      )}

      <Actions hint={`${note} · ← / → change report · F5 show · F6 refresh · F9 preview · Ctrl+E Excel`}>
        <Button variant="outline" icon={RefreshCw} onClick={() => { tb.refetch?.(); pl.refetch?.(); bs.refetch?.(); }}>Refresh (F6)</Button>
        <Button variant="outline" icon={BookOpen} onClick={() => navigate('/accounts/ledger')}>Open Ledger</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => { const [rows, columns] = exportRows(); exportCsv(title, columns, rows); }}>Excel</Button>
        <Button variant="outline" icon={Eye} onClick={print}>Print Preview (F9)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </Actions>
    </div>
  );
}
