import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, CheckSquare, Square, Gavel, FileSpreadsheet, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, DataTable, Field, Input } from '@/components/ui';
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
  { key: 'current_principal', label: 'Loan Amount', type: 'money' },
  { key: 'total_due', label: 'Total Due', type: 'money' },
  { key: 'notices', label: 'Notice Sent', render: (r) => (r.notices ? `Yes (${r.notices})` : 'No') },
];

/** Auction Release (desktop: frmAuctionRelease) - close unredeemed loans as AUCTION and record what the items sold for. */
export function AuctionReleaseTab() {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [f, setF] = useState({ from: dayjs().subtract(5, 'year').format('YYYY-MM-DD'), to: dayjs().subtract(12, 'month').format('YYYY-MM-DD'), older: 12, metal: '', notice: '' });
  const [query, setQuery] = useState(f);
  const { data: settings } = useSettings();
  useEffect(() => {
    const m = n(settings?.AUCTION_OVERDUE_MONTHS);
    if (!m) return;
    const next = { ...f, older: m, to: dayjs().subtract(m, 'month').format('YYYY-MM-DD') };
    setF(next); setQuery(next);
  }, [settings?.AUCTION_OVERDUE_MONTHS]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data = [], isLoading, refetch } = useFetch('/auction/list', { older_than: query.older, from: query.from, to: query.to, loan_on: query.metal, notice: query.notice });
  const [sel, setSel] = useState([]);
  const [sale, setSale] = useState({});
  const [tick, setTick] = useState('');
  const [d, setD] = useState(today());
  const [busy, setBusy] = useState(false);
  const chosen = data.filter((r) => sel.includes(r.id));
  const tot = useMemo(() => chosen.reduce((s, r) => ({ gold: s.gold + (r.loan_on === 'SILVER' ? 0 : n(r.net_wt)), silver: s.silver + (r.loan_on === 'SILVER' ? n(r.net_wt) : 0), amt: s.amt + n(r.current_principal), sale: s.sale + n(sale[r.id] ?? r.total_due) }), { gold: 0, silver: 0, amt: 0, sale: 0 }), [chosen, sale]);

  const tickBy = () => {
    const r = data.find((x) => x.bill_no === tick.trim() || x.barcode === tick.trim());
    if (!r) return toast.error('Loan not in the list');
    setSel((s) => (s.includes(r.id) ? s : [...s, r.id])); setTick('');
  };
  const mark = async () => {
    if (!chosen.length) return toast.error('Tick loans first');
    setBusy(true);
    try {
      const r = await api.post('/auction/mark-auctioned', { auction_date: d, loans: chosen.map((x) => ({ loan_id: x.id, sale_amount: sale[x.id] ?? undefined })) });
      toast.success(`${r.data.count} loans marked as auctioned`);
      setSel([]); setSale({}); refetch(); qc.invalidateQueries({ queryKey: ['/loans'] });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  useKeys({ f5: () => setQuery(f), 'ctrl+a': () => setSel(data.map((r) => r.id)), 'ctrl+n': () => setSel(data.filter((r) => r.notices).map((r) => r.id)), 'ctrl+d': () => setSel([]), f10: mark,
    'ctrl+e': () => exportCsv('auction-due', cols, data), 'ctrl+p': () => printTable({ title: 'Due for Auction', company, columns: cols, rows: data }) }, [f, data, chosen, sale, d]);

  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, [k]: v })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{l}</button>)}</div>;
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <Field label="Pledged from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Older than</p>{seg('older', [[6, '6 months'], [9, '9 months'], [12, '12 months']])}</div>
        <div><p className="label">Metal</p>{seg('metal', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Notice</p>{seg('notice', [['', 'All'], ['sent', 'Notice sent'], ['not_sent', 'Not sent']])}</div>
        <Button className="ml-auto" icon={Search} onClick={() => setQuery(f)}>Show (F5)</Button>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <div className="card flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="label mb-0">Tick by</span>
            <Input className="w-56" value={tick} onChange={(e) => setTick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tickBy()} placeholder="Loan no / scan" />
            <Button size="sm" variant="outline" onClick={tickBy}>Tick (Enter)</Button>
            <Button size="sm" variant="outline" icon={CheckSquare} onClick={() => setSel(data.map((r) => r.id))}>Tick All (Ctrl+A)</Button>
            <Button size="sm" variant="outline" onClick={() => setSel(data.filter((r) => r.notices).map((r) => r.id))}>Tick With Notice (Ctrl+N)</Button>
            <Button size="sm" variant="outline" icon={Square} onClick={() => setSel([])}>Untick All (Ctrl+D)</Button>
          </div>
          <DataTable dense selectable selected={sel} onSelect={setSel} rows={data} loading={isLoading} columns={[...cols, {
            key: 'sale', label: 'Sold for', align: 'right',
            render: (r) => sel.includes(r.id) ? <Input type="number" className="h-8 w-28 text-right" value={sale[r.id] ?? r.total_due} onClick={(e) => e.stopPropagation()} onChange={(e) => setSale({ ...sale, [r.id]: e.target.value })} /> : '',
          }]} />
        </div>
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Mark as auctioned</p>
          <div className="space-y-2 p-4 text-sm">
            <Field label="Auction date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
            <div className="flex justify-between"><span>Ticked loans</span><b>{chosen.length}</b></div>
            <div className="flex justify-between"><span>Gold net wt</span><b className="num">{weight(tot.gold)} g</b></div>
            <div className="flex justify-between"><span>Silver net wt</span><b className="num">{weight(tot.silver)} g</b></div>
            <div className="flex justify-between"><span>Total sale amount</span><b className="num">{amount(tot.sale)}</b></div>
            <p className="label pt-2">Loan amount closed</p>
            <p className="num text-2xl font-extrabold text-navy-900">{money(tot.amt)}</p>
            <Button variant="danger" size="lg" className="h-12 w-full" icon={Gavel} loading={busy} onClick={mark}>Mark as Auctioned (F10)</Button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auction-due', cols, data)}>Excel (Ctrl+E)</Button>
              <Button variant="outline" icon={FileDown} onClick={() => printTable({ title: 'Due for Auction', company, columns: cols, rows: data })}>PDF (Ctrl+P)</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
