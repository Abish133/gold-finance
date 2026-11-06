import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Printer, RefreshCw, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { useCompany, useSettings } from '@/hooks/useApi';
import { printElement } from '@/lib/print';
import { Stickers } from '@/features/print/Sticker';
import { api } from '@/lib/api';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from './desk';

const QUICK = { Today: [0, 0], Yesterday: [1, 1], Week: [6, 0], Month: [29, 0] };

/** Jewel Packet Sticker (desktop): find loans, tick, preview and print on an A4 sheet or a thermal label. */
export default function StickersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const { data: settings } = useSettings();
  const [by, setBy] = useState('date');
  const [f, setF] = useState({ from: today(), to: today(), noFrom: '', noTo: '', notPrinted: false, bank: true, showBook: false, metal: '' });
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState([]);
  const [cur, setCur] = useState(null);
  const [filter, setFilter] = useState('');
  const [sheet, setSheet] = useState('A4');
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    try {
      const p = by === 'date' ? { from: f.from, to: f.to } : { loan_no_from: f.noFrom, loan_no_to: f.noTo || f.noFrom };
      const r = await api.get('/loans', { ...p, status: 'OPEN', pageSize: 200, sort: 'loan_no', order: 'asc', loan_on: f.metal, not_printed: f.notPrinted ? '1' : '', bank: f.bank ? '' : '0' });
      setRows(r.data); setSel(r.data.map((x) => x.id)); setCur(r.data[0] || null);
      if (!r.data.length) toast.info('No loans found');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const shown = useMemo(() => rows.filter((r) => !filter || `${r.bill_no} ${r.customer_name} ${r.item_summary}`.toLowerCase().includes(filter.toLowerCase())), [rows, filter]);
  const chosen = rows.filter((r) => sel.includes(r.id)).map((r) => ({ ...r, bill_no: f.showBook && r.manual_bill_no ? `${r.bill_no}/${r.manual_bill_no}` : r.bill_no }));
  const cfg = useMemo(() => (sheet === 'A4' ? settings || {} : { ...(settings || {}), STICKER_COLUMNS: '1', STICKER_GAP_MM: '0' }), [settings, sheet]);
  const sum = (k, m) => chosen.filter((r) => !m || r.loan_on === m).reduce((s, r) => s + n(r[k]), 0);
  const print = async () => {
    if (!chosen.length) return toast.error('Tick the loans to print');
    await printElement(<div className={sheet === 'THERMAL' ? '[&>div>div]:break-after-page' : ''}><Stickers loans={chosen} settings={cfg} company={company} /></div>, { title: 'Stickers' });
    await api.post('/loans/stickers/printed', { ids: sel });
    qc.invalidateQueries({ queryKey: ['/loans'] });
  };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  useKeys({ f10: print, 'ctrl+a': () => setSel(shown.map((r) => r.id)), 'ctrl+u': () => setSel([]), 'ctrl+r': search, f3: () => document.getElementById('st-filter')?.focus(), escape: () => navigate('/') }, [chosen, shown, f, by]);

  const quick = (k) => { const [a, b] = QUICK[k]; setF({ ...f, from: dayjs().subtract(a, 'day').format('YYYY-MM-DD'), to: dayjs().subtract(b, 'day').format('YYYY-MM-DD') }); };
  const per = sheet === 'A4' ? n(settings?.STICKER_COLUMNS) || 3 : 1;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Jewel Packet Sticker</h1><p className="text-sm text-navy-100">Print stickers for pledged packets</p></div>
        <div className="rounded-md bg-white/10 px-4 py-2 text-lg font-bold">{dayjs().format('DD/MM/YYYY')}</div>
      </section>
      <div className="grid items-stretch gap-3 xl:min-h-[calc(100vh-17rem)] xl:grid-cols-[340px_1fr_420px]">
        <div className="card space-y-4 p-4">
          <p className="text-sm font-bold text-navy-900 uppercase dark:text-white">Find loans</p>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-cream-100 p-1 dark:bg-ink-800">
            {[['date', 'By Pledge Date'], ['no', 'By Loan No']].map(([k, l]) => <button key={k} type="button" onClick={() => setBy(k)} className={clsx('rounded py-2 text-sm font-bold', by === k ? 'bg-navy-800 text-white' : 'text-navy-800 dark:text-white')}>{l}</button>)}
          </div>
          {by === 'date' ? (<>
            <div className="grid grid-cols-2 gap-2"><Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
            <div className="grid grid-cols-4 gap-1">{Object.keys(QUICK).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => quick(k)}>{k}</Button>)}</div>
          </>) : (
            <div className="grid grid-cols-2 gap-2"><Field label="Loan no from"><Input type="number" value={f.noFrom} onChange={(e) => setF({ ...f, noFrom: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field><Field label="To"><Input type="number" value={f.noTo} onChange={(e) => setF({ ...f, noTo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field></div>
          )}
          <Button size="lg" variant="outline" className="w-full" icon={Search} loading={busy} onClick={search}>Search (Enter)</Button>
          <p className="text-xs font-bold text-ink-600 uppercase">Options</p>
          <div className="grid gap-2">
            <Checkbox checked={f.notPrinted} onChange={(v) => setF({ ...f, notPrinted: v })} label="Only not printed yet" />
            <Checkbox checked={f.bank} onChange={(v) => setF({ ...f, bank: v })} label="Include items at Bank" />
            <Checkbox checked={f.showBook} onChange={(v) => setF({ ...f, showBook: v })} label="Show Bill Book No on sticker" />
          </div>
          <Field label="Metal"><Select value={f.metal} onChange={(e) => setF({ ...f, metal: e.target.value })} options={[{ value: '', label: 'All' }, { value: 'GOLD', label: 'Gold' }, { value: 'SILVER', label: 'Silver' }, { value: 'MIX', label: 'Mix' }]} /></Field>
        </div>

        <div className="card flex min-w-0 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold">{sel.length} / {rows.length} selected</p>
            <span className="ml-4 text-sm font-semibold text-ink-600">FILTER (F3)</span>
            <Input id="st-filter" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <span className="flex-1" />
            <Button variant="outline" onClick={() => setSel(shown.map((r) => r.id))}>Select all (Ctrl+A)</Button>
            <Button variant="outline" onClick={() => setSel([])}>Clear (Ctrl+U)</Button>
          </div>
          <div className="flex-1 overflow-auto rounded-md border border-ink-300 dark:border-ink-700">
            <table className="w-full text-sm">
              <thead className="navy-gradient sticky top-0 text-white"><tr><th className="w-10 px-2 py-2" /><th className="px-2 text-left">Loan</th><th className="px-2 text-left">Date</th><th className="px-2 text-left">Customer</th><th className="px-2 text-left">Metal</th><th className="px-2 text-left">Item</th><th className="px-2 text-right">Net Wt</th><th className="px-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!shown.length && <tr><td colSpan={8} className="py-16 text-center text-ink-400">Search loans to print stickers</td></tr>}
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => setCur(r)} className={clsx('cursor-pointer', cur?.id === r.id && 'bg-navy-50 dark:bg-ink-800')}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="px-2 font-semibold">{r.bill_no}</td><td className="px-2">{date(r.loan_date)}</td><td className="px-2">{r.customer_name}</td><td className="px-2">{r.loan_on}</td>
                    <td className="px-2">{r.item_summary}</td><td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.principal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[['Stickers', chosen.length], ['Gold net wt', `${weight(sum('net_wt', 'GOLD') + sum('net_wt', 'MIX'))} g`], ['Silver net wt', `${weight(sum('net_wt', 'SILVER'))} g`], ['Loan amount', `₹${amount(sum('principal'))}`]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-cream-100 px-3 py-2 dark:bg-ink-800"><p className="label">{k}</p><p className="num text-xl font-bold">{v}</p></div>
            ))}
          </div>
        </div>

        <div className="card flex flex-col gap-3 p-4">
          <p className="text-sm font-bold text-navy-900 uppercase dark:text-white">Sticker preview</p>
          <div className="grid min-h-48 place-items-center overflow-auto rounded-md border border-ink-200 bg-white p-3">
            {cur ? <Stickers loans={[{ ...cur, bill_no: f.showBook && cur.manual_bill_no ? `${cur.bill_no}/${cur.manual_bill_no}` : cur.bill_no }]} settings={{ ...cfg, STICKER_COLUMNS: '1' }} company={company} /> : <p className="text-xs text-ink-500">Search loans to see sticker preview</p>}
          </div>
          <p className="text-xs text-ink-500">Selected row's sticker is shown here.</p>
          <div className="rounded-md bg-cream-100 p-3 text-sm dark:bg-ink-800">
            <p className="text-xs font-bold text-ink-600 uppercase">{sheet === 'A4' ? `A4 sheet · ${per} stickers per row` : 'Thermal label · one per label'}</p>
            <p className="mt-1 font-bold">{chosen.length ? `${chosen.length} sticker${chosen.length > 1 ? 's' : ''} · ${sheet === 'A4' ? `${Math.ceil(chosen.length / per)} row(s)` : `${chosen.length} label(s)`}` : 'No sticker selected'}</p>
            <p className="text-xs text-ink-500">Size {settings?.STICKER_WIDTH_MM || 50} × {settings?.STICKER_HEIGHT_MM || 25} mm · change in Printer Setup → Label designer</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-cream-100 p-1 dark:bg-ink-800">
            {[['A4', 'A4 Sheet'], ['THERMAL', 'Thermal Label']].map(([k, l]) => <button key={k} type="button" onClick={() => setSheet(k)} className={clsx('rounded py-2 text-sm font-bold', sheet === k ? 'bg-navy-800 text-white' : 'text-navy-800 dark:text-white')}>{l}</button>)}
          </div>
          <Button size="lg" variant="outline" className="h-14 text-lg" icon={Printer} disabled={!chosen.length} onClick={print}>Print Stickers (F10)</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" icon={RefreshCw} onClick={search}>Refresh (Ctrl+R)</Button>
            <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
          </div>
        </div>
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = search / next · F3 = filter · click = preview · Ctrl+A = all · Ctrl+U = clear · Ctrl+R = refresh · F10 = Print · Esc = close</p>
    </div>
  );
}
