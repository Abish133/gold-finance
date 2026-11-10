import { useEffect, useState } from 'react';
import { Search, Send, FileSpreadsheet, Printer, FileDown, Save, Plug } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input, Select, Tabs } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, dateTime, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';

/**
 * Tally Export (desktop): Day End rows of closed days, old loan journals and auction sales, with the desktop
 * ledger names (Girvi, Interest, Ashal Jama ...) - rename them for your Tally company in the Ledgers tab.
 */
export default function TallyExportPage() {
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today(), company: '' });
  const [q, setQ] = useState(f);
  const [tab, setTab] = useState('vouchers');
  const { data, isLoading, refetch } = useFetch('/tools/tally/preview', { from: q.from, to: q.to });
  const history = useFetch(tab === 'history' ? '/tools/tally/history' : null);
  const [led, setLed] = useState(null);
  const [addr, setAddr] = useState({ host: 'localhost', port: '9000' });
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!data) return;
    setLed(null);
    setAddr({ host: data.tally?.host || 'localhost', port: data.tally?.port || '9000' });
    if (!f.company && data.tally?.company) setF((x) => ({ ...x, company: data.tally.company }));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (data?.vouchers || []).map((v, i) => ({ ...v, id: i }));
  const ledgers = led || data?.ledgers || [];
  const work = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { toast.error(e.message); } setBusy(''); };
  const saveXml = () => work('xml', async () => {
    await api.download('/tools/tally/xml', { from: q.from, to: q.to, company: f.company || company?.name }, `tally-${q.from}-to-${q.to}.xml`);
    toast.success('XML saved - import it in Tally: Gateway → Import Data → Vouchers'); refetch(); history.refetch?.();
  });
  const send = () => work('send', async () => {
    const r = await api.post('/tools/tally/send', { from: q.from, to: q.to, company: f.company || company?.name });
    toast.success(`Sent ${r.data.sent} vouchers to Tally (${r.data.created} created)`); refetch();
  });
  const saveLedgers = () => work('led', async () => {
    await api.put('/tools/tally/settings', { ledgers, host: addr.host, port: addr.port, company: f.company });
    toast.success('Tally ledger names saved'); refetch();
  });
  const test = () => work('test', async () => {
    const r = await api.post('/tools/tally/test', addr);
    (r.data.ok ? toast.success : toast.error)(r.data.message);
  });
  const quick = (k) => {
    const m = { today: [today(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')],
      year: [(dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD'), today()] }[k];
    setF({ ...f, from: m[0], to: m[1] });
  };
  const cols = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'type', label: 'Type', render: (r) => <span className={r.type === 'Payment' ? 'text-rose-600' : r.type === 'Receipt' ? 'text-emerald-700' : ''}>{r.type}</span>, print: (r) => r.type },
    { key: 'no', label: 'Vch No' }, { key: 'debit', label: 'Debit ledger' }, { key: 'credit', label: 'Credit ledger' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'narration', label: 'Narration' }];
  useKeys({ f5: () => setQ(f), f8: () => refetch(), f2: send, f6: saveXml }, [f, q, ledgers, addr]);
  const t = data?.totals;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Tally Export</h1><p className="text-sm text-navy-100">Accounts to Tally / TallyPrime - ledgers + vouchers</p></div>
        <div className="rounded-md bg-white/10 px-4 py-1.5 text-center"><p className="text-[11px] font-bold uppercase">Vouchers</p><p className="text-sm font-bold">{rows.length}</p></div>
        <div className="rounded-md bg-white px-4 py-1.5 text-center text-ink-900"><p className="text-[11px] font-bold uppercase">Last sent</p><p className="text-sm font-bold">{data?.lastSent ? dateTime(data.lastSent.created_at) : 'never'}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="flex gap-1">{[['today', 'Today'], ['month', 'This month'], ['last', 'Last month'], ['year', 'A/c year']].map(([k, l]) => <button key={k} type="button" onClick={() => quick(k)} className="h-10 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 dark:bg-ink-900 dark:text-white">{l}</button>)}</div>
        <Field label="Tally company name (as in Tally)"><Input className="w-72" placeholder={company?.name} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
        <Button className="ml-auto" icon={Search} onClick={() => setQ(f)}>Load (F5)</Button>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'vouchers', label: 'Vouchers', count: rows.length }, { value: 'ledgers', label: 'Ledgers', count: ledgers.filter((l) => l.entries || l.code).length }, { value: 'history', label: 'Export History' }]} />
      <div className="grid gap-3 sm:grid-cols-5">
        {[['Receipts', t?.receipts], ['Payments', t?.payments], ['Contra (cash / bank)', t?.contra], ['Journal', t?.journal], ['Dr = Cr', t ? `OK · ${amount(t.amount)}` : '-']].map(([l, v]) => (
          <div key={l} className="card px-4 py-2"><p className="text-[11px] font-bold text-ink-600 uppercase">{l}</p><p className={clsx('num font-bold', l === 'Dr = Cr' ? 'text-emerald-700' : 'text-navy-900')}>{v ?? '-'}</p></div>
        ))}
      </div>
      {data && !data.closedDays && tab === 'vouchers' && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Day entries go to Tally after Day End. No day is closed in these dates - only old loan entries and auction sales are listed.</p>}
      {tab === 'vouchers' && <DataTable dense loading={isLoading} rows={rows} columns={cols} />}
      {tab === 'ledgers' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr><th className="px-2 py-2 text-left">Code</th><th className="px-2 text-left">Book account</th><th className="px-2 text-left">Tally ledger name</th><th className="px-2 text-left">Tally group</th><th className="px-2 text-right">Entries</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {ledgers.map((l, i) => (
                <tr key={l.key}><td className="px-2 py-1">{l.code || '-'}</td><td className="px-2">{l.account}</td>
                  <td className="px-2 py-1"><Input className="h-8" value={l.name} onChange={(e) => setLed(ledgers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                  <td className="px-2 py-1"><Select className="h-8" value={l.group} onChange={(e) => setLed(ledgers.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))} options={[...new Set([...(data?.groups || []), l.group])].map((g) => ({ value: g, label: g }))} /></td>
                  <td className="num px-2 text-right">{l.entries || ''}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-200 px-3 py-2 dark:border-ink-700">
            <Field label="Tally address"><Input className="w-48" value={addr.host} onChange={(e) => setAddr({ ...addr, host: e.target.value })} /></Field>
            <Field label="Port"><Input className="w-24" value={addr.port} onChange={(e) => setAddr({ ...addr, port: e.target.value })} /></Field>
            <Button variant="outline" icon={Plug} loading={busy === 'test'} onClick={test}>Test Tally</Button>
            <Button className="ml-auto" variant="gold" icon={Save} loading={busy === 'led'} onClick={saveLedgers}>Save Ledger Names</Button>
          </div>
        </div>
      )}
      {tab === 'history' && <DataTable dense rows={history.data || []} columns={[{ key: 'created_at', label: 'Sent on', render: (r) => dateTime(r.created_at) }, { key: 'from_date', label: 'From', type: 'date' }, { key: 'to_date', label: 'To', type: 'date' }, { key: 'records', label: 'Vouchers', type: 'number' }, { key: 'full_name', label: 'By' }]} />}
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: `Tally vouchers ${q.from} to ${q.to}`, company, columns: cols, rows })}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('tally-vouchers', cols, rows)}>Excel (Ctrl+E)</Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" icon={FileDown} loading={busy === 'xml'} onClick={saveXml}>Save XML Files (F6)</Button>
          <Button variant="gold" icon={Send} loading={busy === 'send'} onClick={send}>Send to Tally (F2)</Button>
          <ExitButton />
        </div>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 Load · F8 Refresh · F2 Send to Tally · F6 Save XML files · Ctrl+P Print · Ctrl+E Excel · Esc Exit</p>
    </div>
  );
}
