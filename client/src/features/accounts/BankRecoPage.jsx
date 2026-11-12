import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Save, Printer, FileSpreadsheet, RefreshCw, Landmark, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, n, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { LedgerSelect } from './shared';
import { SHELL, Head, HeadTabs, Chip, Toggle, Bar, Actions, Strip, F, thead, tfoot, inp, RunButton } from './compact';

/** Bank Reconciliation (desktop: frmBankReco) - match book entries with the bank statement. */
export default function BankRecoPage() {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [f, setF] = useState({ ledger_id: '', from: dayjs().subtract(1, 'month').format('YYYY-MM-DD'), to: today(), show: 'pending' });
  const [q, setQ] = useState(null);
  const { data, isLoading, refetch } = useFetch(q?.ledger_id ? '/tools/bank-reco' : null, q);
  const [sel, setSel] = useState([]);
  const [bankDate, setBankDate] = useState(today());
  const [stmt, setStmt] = useState('');
  const st = data?.statement;
  const setDate = async (d) => {
    if (!sel.length) return toast.error('Tick entries first');
    try { await api.put('/tools/bank-reco', { ids: sel, bank_date: d }); toast.success(d ? 'Bank date set' : 'Cleared'); setSel([]); refetch(); qc.invalidateQueries({ queryKey: ['/tools/bank-reco'] }); } catch (e) { toast.error(e.message); }
  };
  const cols = [
    { key: 'bank_date', label: 'Cleared', render: (r) => (r.bank_date ? '✓' : '') },
    { key: 'entry_date', label: 'Book date', type: 'date' }, { key: 'narration', label: 'Particulars' }, { key: 'voucher_no', label: 'Mode / Ref', render: (r) => `${r.voucher_type} ${r.voucher_no}` },
    { key: 'debit', label: 'Deposit', type: 'money' }, { key: 'credit', label: 'Withdrawal', type: 'money' }, { key: 'bank_date2', label: 'Bank date', render: (r) => r.bank_date ? dayjs(r.bank_date).format('DD/MM/YYYY') : '' },
  ];
  useKeys({ f5: () => setQ(f), f6: () => setDate(bankDate), f2: () => setDate(bankDate) }, [f, sel, bankDate]);
  const diff = stmt ? n(stmt) - n(st?.shouldBeInBank) : null;
  const ok = diff != null && Math.abs(diff) < 0.01;
  const line = (l, v, cls) => <div className={clsx('flex justify-between gap-2 border-b border-dashed border-ink-200 py-1 last:border-0 dark:border-ink-700', cls)}><span className="text-ink-500">{l}</span><b className="num">{v}</b></div>;
  return (
    /* fit-screen: the entries table and the statement panel each fill the height */
    <div className={SHELL}>
      <Head icon={Landmark} title="Bank Reconciliation" sub="Match book entries with the bank statement">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip label="As per books" value={amount(st?.asPerBooks || 0)} />
          <Chip label="Not in bank yet" value={amount(st ? n(st.depositsNotInBank) - n(st.withdrawalsNotInBank) : 0)} />
          <Chip strong label="Should be in bank" value={amount(st?.shouldBeInBank || 0)} />
        </div>
      </Head>
      <Bar>
        <F label="Bank A/c"><LedgerSelect className={`${inp} w-64`} value={f.ledger_id} onChange={(v) => setF({ ...f, ledger_id: v })} filter={(l) => l.group_name === 'Bank Accounts'} placeholder="Select bank" /></F>
        <F label="From"><Input type="date" className={`${inp} w-36`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></F>
        <F label="Up to"><Input type="date" className={`${inp} w-36`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></F>
        <F label="Show"><Toggle value={f.show} onChange={(v) => setF({ ...f, show: v })} options={[['pending', 'Not cleared'], ['cleared', 'Cleared'], ['all', 'All']]} /></F>
        <RunButton className="ml-auto" icon={Search} label="Show" keyHint="F5" onClick={() => (f.ledger_id ? setQ(f) : toast.error('Select bank account'))} />
      </Bar>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
        <div className="flex min-h-64 min-w-0 flex-col xl:min-h-0">
          <DataTable fill selectable selected={sel} onSelect={setSel} rows={data?.entries || []} loading={isLoading} columns={cols}
            empty={<p className="py-10 text-center text-[12px] text-ink-400">{q ? 'No entries' : 'Select a bank account and press Show'}</p>} />
        </div>
        <div className="card flex flex-col overflow-hidden xl:min-h-0">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" /><p className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Statement</p>{!!sel.length && <span className="ml-auto rounded-sm bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">{sel.length} ticked</span>}</div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-[12px]">
            <div className="rounded-md border border-ink-200 px-2.5 py-0.5 dark:border-ink-800">
              {line('As per books', amount(st?.asPerBooks || 0))}
              {line('Deposits not in bank yet', amount(st?.depositsNotInBank || 0))}
              {line('Withdrawals not in bank yet', amount(st?.withdrawalsNotInBank || 0))}
              {line('Should be in bank', amount(st?.shouldBeInBank || 0), 'font-bold text-navy-900 dark:text-white')}
            </div>
            <F label="Bank statement balance"><Input type="number" className={`${inp} text-right font-semibold`} placeholder="0.00" value={stmt} onChange={(e) => setStmt(e.target.value)} /></F>
            <div className={clsx('rounded-md border px-3 py-1.5 text-center', diff == null ? 'border-dashed border-ink-200 text-ink-400 dark:border-ink-700' : ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200')}>
              <p className="text-[10px] font-bold tracking-wider uppercase opacity-80">Difference</p>
              <p className="num text-[16px] font-extrabold">{diff == null ? '-' : ok ? 'Tallied' : amount(diff)}</p>
            </div>
            <F label="Bank date for the ticked entries">
              <div className="flex gap-1"><Input type="date" className={inp} value={bankDate} onChange={(e) => setBankDate(e.target.value)} /><RunButton icon={CalendarCheck} label="Set" keyHint="F6" disabled={!sel.length} title={sel.length ? '' : 'Tick entries first'} onClick={() => setDate(bankDate)} /></div>
            </F>
            <div className="mt-auto grid grid-cols-2 gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
              <Button variant="outline" onClick={() => setSel((data?.entries || []).map((e) => e.id))}>Tick All Shown</Button>
              <Button variant="soft-danger" onClick={() => setDate(null)}>Untick (clear)</Button>
            </div>
          </div>
        </div>
      </div>
      <Actions hint="F5 Show · F6 / F2 set bank date for the ticked entries · tick rows in the table first">
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F8)</Button>
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: 'Bank Reconciliation', company, columns: cols, rows: data?.entries || [] })}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('bank-reco', cols, data?.entries || [])}>Excel (Ctrl+E)</Button>
        <Button variant="gold" icon={Save} onClick={() => setDate(bankDate)}>Save (F2)</Button>
        <ExitButton />
      </Actions>
    </div>
  );
}
