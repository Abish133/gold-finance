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
import { useKeys, GoldButton } from './desk';

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
    /* fit-screen: the page fits the window; only the list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Jewel Packet Sticker</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Print stickers for pledged packets</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Date</span><span className="num text-[13px] font-bold">{dayjs().format('DD/MM/YYYY')}</span></div>
      </section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[280px_1fr_340px]">
        <div className="flex flex-col gap-2.5 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Find loans</p>
          <div className="grid grid-cols-2">
            {[['date', 'By Pledge Date'], ['no', 'By Loan No']].map(([k, l]) => <button key={k} type="button" onClick={() => setBy(k)} className={clsx('-ml-px flex h-8 items-center justify-center gap-1.5 border text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md', by === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{by === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}
          </div>
          {by === 'date' ? (<>
            <div className="grid grid-cols-2 gap-2"><Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
            <div className="grid grid-cols-4 gap-1 [&_button]:h-7 [&_button]:px-1 [&_button]:text-[11px]">{Object.keys(QUICK).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => quick(k)}>{k}</Button>)}</div>
          </>) : (
            <div className="grid grid-cols-2 gap-2"><Field label="Loan no from"><Input type="number" value={f.noFrom} onChange={(e) => setF({ ...f, noFrom: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field><Field label="To"><Input type="number" value={f.noTo} onChange={(e) => setF({ ...f, noTo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} /></Field></div>
          )}
          <Button variant="gold" className="h-9 w-full" icon={Search} loading={busy} onClick={search}>Search (Enter)</Button>
          <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Options</p>
          <div className="grid gap-1.5 rounded-md border border-ink-200 p-2 text-[13px] dark:border-ink-800">
            <Checkbox checked={f.notPrinted} onChange={(v) => setF({ ...f, notPrinted: v })} label="Only not printed yet" />
            <Checkbox checked={f.bank} onChange={(v) => setF({ ...f, bank: v })} label="Include items at Bank" />
            <Checkbox checked={f.showBook} onChange={(v) => setF({ ...f, showBook: v })} label="Show Bill Book No on sticker" />
          </div>
          <Field label="Metal"><Select value={f.metal} onChange={(e) => setF({ ...f, metal: e.target.value })} options={[{ value: '', label: 'All' }, { value: 'GOLD', label: 'Gold' }, { value: 'SILVER', label: 'Silver' }, { value: 'MIX', label: 'Mix' }]} /></Field>
        </div>

        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-ink-200 bg-white p-2 xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:h-7 [&_button]:text-[12px]">
            <p className="text-[13px] font-bold"><span className="num text-base">{sel.length}</span> <span className="text-ink-400">/ {rows.length} selected</span></p>
            <div className="w-44"><Input id="st-filter" prefix={<Search className="size-3.5" />} placeholder="Filter (F3)" className="!h-7 text-[12px]" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
            <span className="flex-1" />
            <Button variant="outline" onClick={() => setSel(shown.map((r) => r.id))}>Select all (Ctrl+A)</Button>
            <Button variant="soft-danger" onClick={() => setSel([])}>Clear (Ctrl+U)</Button>
          </div>
          <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 xl:min-h-0 dark:border-ink-800">
            <table className="w-full text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-10 px-2 py-2" /><th className="px-2 text-left">Loan</th><th className="px-2 text-left">Date</th><th className="px-2 text-left">Customer</th><th className="px-2 text-left">Metal</th><th className="px-2 text-left">Item</th><th className="px-2 text-right">Net Wt</th><th className="px-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!shown.length && <tr><td colSpan={8} className="py-12 text-center text-[12px] text-ink-400">Search loans on the left to print stickers</td></tr>}
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => setCur(r)} className={clsx('cursor-pointer', cur?.id === r.id ? 'bg-sky-50 dark:bg-sky-950/30' : sel.includes(r.id) ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                    <td className={clsx('border-l-2 px-2 py-1 text-center', sel.includes(r.id) ? 'border-emerald-600' : 'border-transparent')}><input type="checkbox" className="size-3.5 accent-emerald-600" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="px-2 font-semibold">{r.bill_no}</td><td className="px-2">{date(r.loan_date)}</td><td className="px-2">{r.customer_name}</td><td className="px-2">{r.loan_on}</td>
                    <td className="max-w-56 truncate px-2" title={r.item_summary}>{r.item_summary}</td><td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.principal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid shrink-0 grid-cols-4 overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
            {[['Stickers', chosen.length], ['Gold net wt', `${weight(sum('net_wt', 'GOLD') + sum('net_wt', 'MIX'))} g`], ['Silver net wt', `${weight(sum('net_wt', 'SILVER'))} g`], ['Loan amount', `₹${amount(sum('principal'))}`]].map(([k, v]) => (
              <div key={k} className="border-ink-200 px-3 py-1 not-last:border-r dark:border-ink-800"><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{k}</p><p className="num text-[15px] font-bold">{v}</p></div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Sticker preview</p>
          <div className="grid min-h-36 flex-1 place-items-center overflow-auto rounded-md border border-dashed border-ink-300 bg-white p-3 dark:border-ink-700">
            {cur ? <Stickers loans={[{ ...cur, bill_no: f.showBook && cur.manual_bill_no ? `${cur.bill_no}/${cur.manual_bill_no}` : cur.bill_no }]} settings={{ ...cfg, STICKER_COLUMNS: '1' }} company={company} /> : <p className="text-xs text-ink-500">Search loans to see sticker preview</p>}
          </div>
          <p className="-mt-1 text-[11px] text-ink-400">Click a row to see its sticker here.</p>
          <div className="rounded-md border border-ink-200 px-2.5 py-1.5 text-[13px] dark:border-ink-800">
            <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{sheet === 'A4' ? `A4 sheet · ${per} stickers per row` : 'Thermal label · one per label'}</p>
            <p className="mt-1 font-bold">{chosen.length ? `${chosen.length} sticker${chosen.length > 1 ? 's' : ''} · ${sheet === 'A4' ? `${Math.ceil(chosen.length / per)} row(s)` : `${chosen.length} label(s)`}` : 'No sticker selected'}</p>
            <p className="text-[11px] text-ink-400">Size {settings?.STICKER_WIDTH_MM || 50} × {settings?.STICKER_HEIGHT_MM || 25} mm · change in Printer Setup → Label designer</p>
          </div>
          <div className="grid grid-cols-2">
            {[['A4', 'A4 Sheet'], ['THERMAL', 'Thermal Label']].map(([k, l]) => <button key={k} type="button" onClick={() => setSheet(k)} className={clsx('-ml-px flex h-8 items-center justify-center gap-1.5 border text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md', sheet === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{sheet === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}
          </div>
          <div className="space-y-1.5">
            <GoldButton icon={Printer} disabled={!chosen.length} onClick={print}>Print Stickers (F10)</GoldButton>
            <div className="grid grid-cols-2 gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
              <Button variant="outline" icon={RefreshCw} onClick={search}>Refresh (Ctrl+R)</Button>
              <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
            </div>
          </div>
        </div>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">Enter = search / next · F3 = filter · click = preview · Ctrl+A = all · Ctrl+U = clear · Ctrl+R = refresh · F10 = Print · Esc = close</p>
    </div>
  );
}
