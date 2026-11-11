import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, CheckSquare, Square, Gavel, FileSpreadsheet, FileDown, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, DataTable, Field, Input } from '@/components/ui';
import { useFetch, useCompany, useSettings } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, money, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const cols = [
  { key: 'bill_no', label: 'Loan No', render: (r) => <b>{r.bill_no}</b> },
  { key: 'loan_date', label: 'Pledged', type: 'date' },
  { key: 'age_months', label: 'Age', render: (r) => `${r.age_months} m` },
  { key: 'customer_name', label: 'Customer' },
  { key: 'item_summary', label: 'Items', className: 'max-w-48 truncate' },
  { key: 'loan_on', label: 'Metal' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight' },
  { key: 'principal', label: 'Loan Amount', type: 'money' },
  { key: 'notices', label: 'Notice Sent', render: (r) => (r.notices ? <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-bold text-emerald-700">SENT ({r.notices})</span> : <span className="rounded bg-rose-50 px-1.5 text-[10px] font-bold text-rose-700">NO NOTICE</span>), print: (r) => (r.notices ? 'Sent' : 'No notice') },
];

/** Auction Release (desktop: frmAuctionRelease) - close unredeemed loans as AUCTION and record what the items sold for. */
export function AuctionReleaseTab({ onCount, onDone }) {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: dayjs(today()).subtract(5, 'year').format('YYYY-MM-DD'), to: dayjs(today()).subtract(12, 'month').format('YYYY-MM-DD'), older: 12, metal: '', notice: '' });
  const [query, setQuery] = useState(f);
  const { data: settings } = useSettings();
  // desktop: from the oldest open loan up to (billing date - N months); auction date = billing date
  const { data: billing } = useFetch('/desk/billing-date');
  const bd = billing?.billingDate;
  useEffect(() => {
    if (!bd) return;
    const m = n(settings?.AUCTION_OVERDUE_MONTHS) || 12;
    const next = { ...f, older: m, from: billing.oldestOpen || f.from, to: dayjs(bd).subtract(m, 'month').format('YYYY-MM-DD') };
    setF(next); setQuery(next); setD(bd);
  }, [bd, settings?.AUCTION_OVERDUE_MONTHS]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data = [], isLoading, refetch } = useFetch('/auction/list', { asOn: bd, older_than: query.older, from: query.from, to: query.to, loan_on: query.metal, notice: query.notice });
  useEffect(() => { onCount?.(data.length); }, [data.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ask, setAsk] = useState(null);
  const [sel, setSel] = useState([]);
  const [sale, setSale] = useState({});
  const [tick, setTick] = useState('');
  const [d, setD] = useState(today());
  const [busy, setBusy] = useState(false);
  const chosen = data.filter((r) => sel.includes(r.id));
  const tot = useMemo(() => chosen.reduce((s, r) => ({ gold: s.gold + (r.loan_on === 'SILVER' ? 0 : n(r.net_wt)), silver: s.silver + (r.loan_on === 'SILVER' ? n(r.net_wt) : 0), amt: s.amt + n(r.principal), sale: s.sale + n(sale[r.id] ?? r.total_due) }), { gold: 0, silver: 0, amt: 0, sale: 0 }), [chosen, sale]);

  const tickBy = () => {
    const r = data.find((x) => x.bill_no === tick.trim() || x.barcode === tick.trim());
    if (!r) return toast.error('Loan not in the list');
    setSel((s) => (s.includes(r.id) ? s : [...s, r.id])); setTick('');
  };
  const noNotice = chosen.filter((r) => !r.notices).length;
  const doMark = async () => {
    setBusy(true);
    try {
      const r = await api.post('/auction/mark-auctioned', { auction_date: d, loans: chosen.map((x) => ({ loan_id: x.id })) });
      toast.success(`${r.data.count} loan${r.data.count > 1 ? 's' : ''} marked as auctioned - enter the sale in the Auctioned tab`);
      setSel([]); setSale({}); setAsk(null); refetch(); qc.invalidateQueries({ queryKey: ['/loans'] }); onDone?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const confirmMark = () => setAsk({ title: `Mark ${chosen.length} loan${chosen.length > 1 ? 's' : ''} (Rs ${amount(tot.amt)}) as AUCTIONED on ${dayjs(d).format('DD/MM/YYYY')}?`, message: 'These loans will be closed. Only an Admin can undo it.', go: doMark });
  const mark = () => {
    if (!chosen.length) return toast.error('Tick loans first');
    if (noNotice) return setAsk({ title: `${noNotice} of the ticked loans never got a notice.`, message: 'Auction them anyway?', go: confirmMark });
    return confirmMark();
  };
  useKeys({ f5: () => setQuery(f), 'ctrl+a': () => setSel(data.map((r) => r.id)), 'ctrl+n': () => setSel(data.filter((r) => r.notices).map((r) => r.id)), 'ctrl+d': () => setSel([]), f10: mark,
    'ctrl+e': () => exportCsv('auction-due', cols, data), 'ctrl+p': () => printTable({ title: 'Due for Auction', company, columns: cols, rows: data }) }, [f, data, chosen, sale, d]);

  const seg = (k, opts) => <div className="flex">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{f[k] === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div>;
  return (
    <div className="flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Pledged from"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Older than</p>{seg('older', [[6, '6 months'], [9, '9 months'], [12, '12 months']])}</div>
        <div><p className="label">Metal</p>{seg('metal', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Notice</p>{seg('notice', [['', 'All'], ['sent', 'Notice sent'], ['not_sent', 'Not sent']])}</div>
        <Button className="ml-auto h-8" icon={Search} onClick={() => setQuery(f)}>Show (F5)</Button>
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-7 [&_button]:text-[12px]">
            <div className="w-52"><Input prefix={<ScanLine className="size-3.5" />} className="!h-7 text-[12px]" value={tick} onChange={(e) => setTick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tickBy()} placeholder="Tick by loan no / scan" /></div>
            <Button size="sm" variant="outline" onClick={tickBy}>Tick (Enter)</Button>
            <Button size="sm" variant="outline" icon={CheckSquare} onClick={() => setSel(data.map((r) => r.id))}>Tick All (Ctrl+A)</Button>
            <Button size="sm" variant="outline" onClick={() => setSel(data.filter((r) => r.notices).map((r) => r.id))}>Tick With Notice (Ctrl+N)</Button>
            <Button size="sm" variant="soft-danger" icon={Square} onClick={() => setSel([])}>Untick All (Ctrl+D)</Button>
          </div>
          <DataTable fill selectable selected={sel} onSelect={setSel} rows={data} loading={isLoading} columns={cols} />
        </div>
        <div className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-rose-600" />Mark as auctioned</p>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-[13px]">
            <Field label="Auction date"><Input type="date" max={bd || today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
            <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800">
              <div className="flex justify-between py-0.5"><span className="text-ink-500">Ticked loans</span><b className="num">{chosen.length}</b></div>
              <div className="flex justify-between py-0.5"><span className="text-ink-500">Gold net wt</span><b className="num">{weight(tot.gold)} g</b></div>
              <div className="flex justify-between py-0.5"><span className="text-ink-500">Silver net wt</span><b className="num">{weight(tot.silver)} g</b></div>
            </div>
            <div className="navy-gradient flex items-baseline justify-between rounded-md px-3 py-2 text-white"><span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Loan amount closed</span><span className="num text-xl font-extrabold">{money(tot.amt)}</span></div>
            {noNotice > 0 && <p className="rounded-md border-l-2 border-rose-600 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">{noNotice} ticked loan{noNotice > 1 ? 's have' : ' has'} no notice sent.</p>}
            <Button variant="danger" className="mt-auto h-10 w-full" icon={Gavel} loading={busy} onClick={mark}>{chosen.length ? `Mark ${chosen.length} Loan${chosen.length > 1 ? 's' : ''} as Auctioned (F10)` : 'Mark as Auctioned (F10)'}</Button>
            <div className="grid grid-cols-2 gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
              <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auction-due', cols, data)}>Excel (Ctrl+E)</Button>
              <Button variant="outline" icon={FileDown} onClick={() => printTable({ title: 'Due for Auction', company, columns: cols, rows: data })}>PDF (Ctrl+P)</Button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDrawer open={!!ask} onClose={() => setAsk(null)} title={ask?.title} message={ask?.message} confirmText="Yes" tone="danger" onConfirm={() => ask?.go()} />
    </div>
  );
}
