import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Save, Printer, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, n, today } from '@/lib/format';
import { ExitButton, Line, useKeys } from '@/features/loans/desk';
import { LedgerSelect } from './shared';

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
  const seg = (v, l) => <button key={v} type="button" onClick={() => setF({ ...f, show: v })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', f.show === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{l}</button>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Bank Reconciliation</h1><p className="text-sm text-navy-100">Match book entries with the bank statement</p></div>
        {[['As per books', st?.asPerBooks], ['Not in bank yet', st ? n(st.depositsNotInBank) - n(st.withdrawalsNotInBank) : null], ['Should be in bank', st?.shouldBeInBank]].map(([l, v], i) => (
          <div key={l} className={clsx('rounded-md px-4 py-1.5 text-center', i === 2 ? 'bg-white text-ink-900' : 'bg-white/10')}><p className="text-[11px] font-bold uppercase">{l}</p><p className="num font-bold">{v != null ? amount(v) : '0.00'}</p></div>
        ))}
      </section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <Field label="Bank A/c"><LedgerSelect className="w-72" value={f.ledger_id} onChange={(v) => setF({ ...f, ledger_id: v })} filter={(l) => l.group_name === 'Bank Accounts'} placeholder="Select bank" /></Field>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Up to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Show</p><div className="flex gap-1">{seg('pending', 'Not cleared')}{seg('cleared', 'Cleared')}{seg('all', 'All')}</div></div>
        <Button className="ml-auto" icon={Search} onClick={() => (f.ledger_id ? setQ(f) : toast.error('Select bank account'))}>Show (F5)</Button>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_330px]">
        <DataTable dense selectable selected={sel} onSelect={setSel} rows={data?.entries || []} loading={isLoading} columns={cols}
          empty={<p className="py-10 text-center text-sm text-ink-400">{q ? 'No entries' : 'Select a bank account and press Show'}</p>} />
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Statement</p>
          <div className="space-y-1 p-4">
            <Line label="As per books" value={amount(st?.asPerBooks || 0)} />
            <Line label="Deposits not in bank yet" value={amount(st?.depositsNotInBank || 0)} />
            <Line label="Withdrawals not in bank yet" value={amount(st?.withdrawalsNotInBank || 0)} />
            <Line bold label="Should be in bank" value={amount(st?.shouldBeInBank || 0)} />
            <Field label="Bank statement balance" className="pt-2"><Input type="number" value={stmt} onChange={(e) => setStmt(e.target.value)} /></Field>
            <Line label="Difference" value={stmt ? amount(n(stmt) - n(st?.shouldBeInBank)) : '-'} tone={stmt && Math.abs(n(stmt) - n(st?.shouldBeInBank)) > 0.009 ? 'text-rose-600' : 'text-emerald-700'} />
            <Field label="Bank date for the selected entry" className="pt-2">
              <div className="flex gap-1"><Input type="date" value={bankDate} onChange={(e) => setBankDate(e.target.value)} /><Button onClick={() => setDate(bankDate)}>Set (F6)</Button></div>
            </Field>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={() => setSel((data?.entries || []).map((e) => e.id))}>Tick All Shown</Button>
              <Button variant="outline" onClick={() => setDate(null)}>Untick (clear date)</Button>
            </div>
          </div>
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: 'Bank Reconciliation', company, columns: cols, rows: data?.entries || [] })}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('bank-reco', cols, data?.entries || [])}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F8)</Button>
        <div className="ml-auto flex gap-2"><Button variant="gold" icon={Save} onClick={() => setDate(bankDate)}>Save (F2)</Button><ExitButton /></div>
      </div>
    </div>
  );
}
