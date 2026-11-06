import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, FileDown, FileSpreadsheet, Printer, FolderOpen, Lock } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Badge, Button, Checkbox, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';

const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
export const NATURE_TONE = { ASSET: 'green', LIABILITY: 'red', INCOME: 'blue', EXPENSE: 'gold', EQUITY: 'violet' };
export const jn = (v) => `${amount(Math.abs(n(v)))} ${n(v) >= 0 ? 'Nave' : 'Jama'}`;

/** Account Ledger (desktop: frmAccountLedger) - every entry of one account with running balance. */
export default function LedgerReportPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: ledgers = [] } = useFetch('/desk/ledger-balances');
  const [q, setQ] = useState('');
  const [ledger, setLedger] = useState(null);
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const [run, setRun] = useState(null);
  const [showSys, setShowSys] = useState(true);
  const { data, refetch } = useFetch(run ? '/accounts/ledger-statement' : null, run);
  const list = useMemo(() => ledgers.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || String(l.id) === q), [ledgers, q]);
  const entries = (data?.entries || []).filter((e) => showSys || !e.source_type);
  const pick = (l) => { setLedger(l); setRun({ ledger_id: l.id, ...range }); };
  const quick = (k) => {
    const r = { year: [fyStart(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')], today: [today(), today()] }[k];
    setRange({ from: r[0], to: r[1] }); if (ledger) setRun({ ledger_id: ledger.id, from: r[0], to: r[1] });
  };
  const cols = [{ key: 'entry_date', label: 'Date', type: 'date' }, { key: 'voucher_no', label: 'V. No' }, { key: 'narration', label: 'Narration' }, { key: 'voucher_type', label: 'Type' },
    { key: 'credit', label: 'Jama', type: 'money' }, { key: 'debit', label: 'Nave', type: 'money' }, { key: 'balance', label: 'Balance', print: (r) => jn(r.balance) }];
  const doPrint = () => printTable({ title: `Ledger - ${ledger?.name}`, subtitle: `${date(range.from)} to ${date(range.to)}`, company, columns: cols, rows: entries });
  useKeys({ f5: () => ledger && setRun({ ledger_id: ledger.id, ...range }), f6: () => refetch(), 'ctrl+p': doPrint, f9: doPrint, 'ctrl+e': () => exportCsv('ledger', cols, entries), escape: () => navigate('/') }, [ledger, range, entries]);

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Account Ledger</h1><p className="text-sm text-navy-100">Every entry of one account with running balance</p></section>
      <div className="grid items-start gap-3 xl:grid-cols-[330px_1fr]">
        <div className="card overflow-hidden">
          <div className="p-3"><p className="label">Accounts</p><Input autoFocus className="bg-gold-50" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or A/c no" /></div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {list.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => pick(l)} className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-navy-50', ledger?.id === l.id && 'bg-cream-200')}>
                  <span className="w-7 text-ink-500">{l.id}</span><span className="flex-1 truncate">{l.name}</span>
                  {l.is_system ? <Lock className="size-3 text-gold-600" /> : null}<Badge tone={NATURE_TONE[l.nature]} className="px-1.5 text-[9px]">{l.nature === 'EXPENSE' ? 'Expense' : l.nature.charAt(0) + l.nature.slice(1).toLowerCase()}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
            <div className="min-w-64 flex-1"><p className="label">Account</p><p className="text-lg font-bold text-navy-900">{ledger ? `${ledger.id} · ${ledger.name}` : 'Choose an account on the left'}</p></div>
            <Field label="From"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
            <div className="flex gap-1">{[['year', 'This A/c year'], ['month', 'This month'], ['last', 'Last month'], ['today', 'Today']].map(([k, l]) => <button key={k} type="button" onClick={() => quick(k)} className="h-10 rounded-md border border-ink-300 bg-white px-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50">{l}</button>)}</div>
            <Button onClick={() => ledger && setRun({ ledger_id: ledger.id, ...range })}>Show (F5)</Button>
            <Checkbox checked={showSys} onChange={setShowSys} label="Show loan / Day End entries" className="w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[['Opening', data ? jn(data.opening) : '0.00'], ['Jama (received)', amount(data?.credit || 0)], ['Nave (paid)', amount(data?.debit || 0)]].map(([l, v], i) => (
              <div key={l} className="card px-4 py-3"><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className={clsx('num text-xl font-bold', i === 1 ? 'text-emerald-700' : i === 2 ? 'text-rose-600' : 'text-navy-900')}>{v}</p></div>
            ))}
            <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Closing</p><p className="num text-xl font-bold">{data ? jn(data.closing) : '0.00'}</p></div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 text-left">V. No</th><th className="px-3 text-left">Narration</th><th className="px-3 text-left">Type</th><th className="px-3 text-right">Jama</th><th className="px-3 text-right">Nave</th><th className="px-3 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-ink-200">
                {data && <tr className="bg-cream-100"><td className="px-3 py-1.5">{date(range.from)}</td><td /><td className="px-3 font-semibold">Opening balance</td><td /><td /><td /><td className="num px-3 text-right font-semibold">{jn(data.opening)}</td></tr>}
                {entries.map((e, i) => (
                  <tr key={i} className="hover:bg-navy-50/50"><td className="px-3 py-1.5">{date(e.entry_date)}</td><td className="px-3">{e.voucher_no}</td><td className="px-3">{e.narration}</td><td className="px-3 text-xs">{e.voucher_type}</td>
                    <td className="num px-3 text-right text-emerald-700">{n(e.credit) ? amount(e.credit) : ''}</td><td className="num px-3 text-right text-rose-600">{n(e.debit) ? amount(e.debit) : ''}</td><td className="num px-3 text-right font-semibold">{jn(e.balance)}</td></tr>
                ))}
                {!data && <tr><td colSpan={7} className="py-16 text-center text-ink-400">Choose an account</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
            <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
            <Button variant="outline" icon={FolderOpen} disabled>Open Voucher (Enter)</Button>
            <Button variant="outline" icon={FileDown} onClick={doPrint}>PDF (Ctrl+P)</Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('ledger', cols, entries)}>Excel (Ctrl+E)</Button>
            <Button variant="outline" icon={Printer} onClick={doPrint}>Print (F9)</Button>
            <ExitButton />
          </div>
        </div>
      </div>
    </div>
  );
}
