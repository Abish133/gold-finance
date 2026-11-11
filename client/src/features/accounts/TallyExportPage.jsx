import { useEffect, useState } from 'react';
import { Search, Send, FileSpreadsheet, Printer, FileDown, Save, Plug } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Input, Select } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, dateTime, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { SHELL, Head, HeadTabs, Chip, Toggle, Bar, Actions, Strip, F, thead, tfoot, inp, RunButton } from './compact';

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
  const QK = [['today', 'Today'], ['month', 'This month'], ['last', 'Last month'], ['year', 'A/c year']];
  const isQ = (k) => {
    const m = { today: [today(), today()], month: [dayjs().startOf('month').format('YYYY-MM-DD'), today()], last: [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')],
      year: [(dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD'), today()] }[k];
    return f.from === m[0] && f.to === m[1];
  };
  return (
    /* fit-screen: the active tab's table fills the rest and scrolls on its own */
    <div className={SHELL}>
      <Head icon={Send} title="Tally Export" sub="Accounts to Tally / TallyPrime - ledgers + vouchers">
        <HeadTabs value={tab} onChange={setTab} tabs={[['vouchers', 'Vouchers', null, rows.length], ['ledgers', 'Ledgers', null, ledgers.filter((l) => l.entries || l.code).length], ['history', 'Export History']]} />
        <Chip strong label="Last sent" value={data?.lastSent ? dateTime(data.lastSent.created_at) : 'never'} />
      </Head>
      <Bar>
        <F label="From"><Input type="date" className={`${inp} w-36`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></F>
        <F label="To"><Input type="date" className={`${inp} w-36`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></F>
        <Toggle options={QK} isOn={isQ} onChange={quick} />
        <F label="Tally company name (as in Tally)" className="w-64"><Input className={inp} placeholder={company?.name} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></F>
        <RunButton className="ml-auto" icon={Search} label="Load" keyHint="F5" onClick={() => setQ(f)} />
      </Bar>
      <Strip items={[{ label: 'Receipts', value: t?.receipts ?? '-', bar: 'bg-emerald-600' }, { label: 'Payments', value: t?.payments ?? '-', bar: 'bg-rose-600' }, { label: 'Contra (cash / bank)', value: t?.contra ?? '-', bar: 'bg-sky-600' },
        { label: 'Journal', value: t?.journal ?? '-', bar: 'bg-violet-600' }, { label: 'Dr = Cr', value: t ? amount(t.amount) : '-', hint: t ? 'OK' : '', bar: 'bg-amber-500', tone: 'text-emerald-700' }]} />
      {data && !data.closedDays && tab === 'vouchers' && <p className="flex shrink-0 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span className="size-1.5 shrink-0 rounded-full bg-amber-500" />Day entries go to Tally after Day End. No day is closed in these dates - only old loan entries and auction sales are listed.</p>}
      {tab === 'vouchers' && <div className="flex min-h-64 flex-col xl:min-h-0 xl:flex-1"><DataTable fill loading={isLoading} rows={rows} columns={cols} /></div>}
      {tab === 'ledgers' && (
        <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-[12px]">
              <thead className={thead}><tr><th className="px-3 py-2 text-left">Code</th><th className="px-3 text-left">Book account</th><th className="px-3 text-left">Tally ledger name</th><th className="px-3 text-left">Tally group</th><th className="px-3 text-right">Entries</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {ledgers.map((l, i) => (
                  <tr key={l.key} className={clsx(l.entries ? '' : 'text-ink-500')}><td className="num px-3 py-1">{l.code || '-'}</td><td className="px-3">{l.account}</td>
                    <td className="px-2 py-1"><Input className="!h-7 text-[12px]" value={l.name} onChange={(e) => setLed(ledgers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                    <td className="px-2 py-1"><Select className="!h-7 text-[12px]" value={l.group} onChange={(e) => setLed(ledgers.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))} options={[...new Set([...(data?.groups || []), l.group])].map((g) => ({ value: g, label: g }))} /></td>
                    <td className="num px-3 text-right">{l.entries || ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2 border-t border-ink-200 px-3 py-2 dark:border-ink-800">
            <F label="Tally address"><Input className={`${inp} w-44`} value={addr.host} onChange={(e) => setAddr({ ...addr, host: e.target.value })} /></F>
            <F label="Port"><Input className={`${inp} w-20`} value={addr.port} onChange={(e) => setAddr({ ...addr, port: e.target.value })} /></F>
            <Button variant="outline" className="h-8 text-[12px]" icon={Plug} loading={busy === 'test'} onClick={test}>Test Tally</Button>
            <Button className="ml-auto h-8 text-[12px]" variant="gold" icon={Save} loading={busy === 'led'} onClick={saveLedgers}>Save Ledger Names</Button>
          </div>
        </div>
      )}
      {tab === 'history' && <div className="flex min-h-64 flex-col xl:min-h-0 xl:flex-1"><DataTable fill rows={history.data || []} columns={[{ key: 'created_at', label: 'Sent on', render: (r) => dateTime(r.created_at) }, { key: 'from_date', label: 'From', type: 'date' }, { key: 'to_date', label: 'To', type: 'date' }, { key: 'records', label: 'Vouchers', type: 'number' }, { key: 'full_name', label: 'By' }]} /></div>}
      <Actions hint="F5 Load · F8 Refresh · F2 Send to Tally · F6 Save XML files · Ctrl+P Print · Ctrl+E Excel · Esc Exit">
        <Button variant="outline" icon={Printer} onClick={() => printTable({ title: `Tally vouchers ${q.from} to ${q.to}`, company, columns: cols, rows })}>Print (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('tally-vouchers', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={FileDown} loading={busy === 'xml'} onClick={saveXml}>Save XML Files (F6)</Button>
        <Button variant="gold" icon={Send} loading={busy === 'send'} onClick={send}>Send to Tally (F2)</Button>
        <ExitButton />
      </Actions>
    </div>
  );
}
