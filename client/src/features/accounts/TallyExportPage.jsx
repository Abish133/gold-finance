import { useState } from 'react';
import { Search, Send, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input, Tabs } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, dateTime, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';

/** Tally Export (desktop: frmTallyExport) - vouchers + ledgers to Tally / TallyPrime as XML. */
export default function TallyExportPage() {
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today(), company: '' });
  const [q, setQ] = useState(f);
  const [tab, setTab] = useState('vouchers');
  const { data, isLoading, refetch } = useFetch('/tools/tally/preview', { from: q.from, to: q.to });
  const history = useFetch(tab === 'history' ? '/tools/tally/history' : null);
  const rows = (data?.vouchers || []).flatMap((v) => {
    const dr = v.lines.filter((l) => Number(l.debit) > 0); const cr = v.lines.filter((l) => Number(l.credit) > 0);
    return [{ id: v.id, date: v.voucher_date, type: v.voucher_type, no: v.voucher_no, debit: dr.map((l) => l.ledger_name).join(', '), credit: cr.map((l) => l.ledger_name).join(', '), amount: dr.reduce((s, l) => s + Number(l.debit), 0), narration: v.narration }];
  });
  const send = async () => {
    try { await api.download('/tools/tally/xml', { from: q.from, to: q.to, company: f.company || company?.name }, `tally-${q.from}-to-${q.to}.xml`); toast.success('XML saved - import it in Tally: Gateway → Import Data → Vouchers'); refetch(); } catch (e) { toast.error(e.message); }
  };
  const quick = (k) => {
    const m = { today: [today(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')],
      year: [(dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD'), today()] }[k];
    setF({ ...f, from: m[0], to: m[1] });
  };
  const cols = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'type', label: 'Type' }, { key: 'no', label: 'Vch No' }, { key: 'debit', label: 'Debit ledger' }, { key: 'credit', label: 'Credit ledger' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'narration', label: 'Narration' }];
  useKeys({ f5: () => setQ(f), f2: send, f6: send }, [f, q]);
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Tally Export</h1><p className="text-sm text-navy-100">MyBook accounts to Tally / TallyPrime - ledgers + vouchers</p></div>
        <div className="rounded-md bg-white px-4 py-1.5 text-center text-ink-900"><p className="text-[11px] font-bold uppercase">Last sent</p><p className="text-sm font-bold">{data?.lastSent ? dateTime(data.lastSent.created_at) : 'never'}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex gap-1">{[['today', 'Today'], ['month', 'This month'], ['last', 'Last month'], ['year', 'A/c year']].map(([k, l]) => <button key={k} type="button" onClick={() => quick(k)} className="h-10 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">{l}</button>)}</div>
        <Field label="Tally company name (as in Tally)"><Input className="w-72" placeholder={company?.name} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
        <Button className="ml-auto" icon={Search} onClick={() => setQ(f)}>Load (F5)</Button>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'vouchers', label: 'Vouchers', count: rows.length }, { value: 'ledgers', label: 'Ledgers', count: data?.ledgers?.length }, { value: 'history', label: 'Export History' }]} />
      <div className="grid gap-3 sm:grid-cols-5">
        {[['Receipts', data?.totals.receipts], ['Payments', data?.totals.payments], ['Contra (cash / bank)', data?.totals.contra], ['Journal', data?.totals.journal], ['Dr = Cr', data ? 'Balanced' : '-']].map(([l, v]) => (
          <div key={l} className="card px-4 py-2"><p className="text-[11px] font-bold text-ink-600 uppercase">{l}</p><p className={clsx('num font-bold', l === 'Dr = Cr' ? 'text-emerald-700' : 'text-navy-900')}>{typeof v === 'number' ? amount(v) : v ?? '-'}</p></div>
        ))}
      </div>
      {tab === 'vouchers' && <DataTable dense loading={isLoading} rows={rows} columns={cols} />}
      {tab === 'ledgers' && <DataTable dense rows={(data?.ledgers || []).map((l, i) => ({ ...l, id: i }))} columns={[{ key: 'name', label: 'Ledger' }, { key: 'group_name', label: 'Group' }]} />}
      {tab === 'history' && <DataTable dense rows={history.data || []} columns={[{ key: 'created_at', label: 'Sent on', render: (r) => dateTime(r.created_at) }, { key: 'from_date', label: 'From', type: 'date' }, { key: 'to_date', label: 'To', type: 'date' }, { key: 'records', label: 'Vouchers', type: 'number' }, { key: 'full_name', label: 'By' }]} />}
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: `Tally vouchers ${q.from} to ${q.to}`, company, columns: cols, rows })}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('tally-vouchers', cols, rows)}>Excel (Ctrl+E)</Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={send}>Save XML Files (F6)</Button>
          <Button variant="gold" icon={Send} onClick={send}>Send to Tally (F2)</Button>
          <ExitButton />
        </div>
      </div>
    </div>
  );
}
