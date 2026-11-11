import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Undo2, Unlock, RefreshCw, Printer, FileDown, FileSpreadsheet, LogOut, StickyNote, ScanLine, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Drawer, Field, Input, Textarea } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { LoanDetailsDrawer } from '@/features/loans/LoanDetailsDrawer';

const cols = [
  { key: 'sno', label: 'S.No' }, { key: 'bill_no', label: 'Loan No' }, { key: 'manual_bill_no', label: 'Bill Book No' }, { key: 'loan_date', label: 'Pledge Date', type: 'date' },
  { key: 'customer_name', label: 'Customer' }, { key: 'loan_on', label: 'Metal' }, { key: 'items_text', label: 'Pledged Items', print: (r) => (r.items_text || r.item_summary || '').toUpperCase() }, { key: 'net_wt', label: 'Net Wt', type: 'weight' },
  { key: 'loan_amount', label: 'Amount', type: 'money' }, { key: 'state', label: 'Checked' }, { key: 'checked_by_name', label: 'Checked By' },
];

/** Current Stock Check (desktop): physical check of pledged items in hand - scan or type each loan. */
export default function StockCheckPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAllBranches, can } = useAuth();
  const { data: company } = useCompany();
  const [d] = useState(today());
  const [code, setCode] = useState('');
  const [show, setShow] = useState('all');
  const [metal, setMetal] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [last, setLast] = useState(null);
  const [ask, setAsk] = useState(null);
  const [note, setNote] = useState(null);
  const [details, setDetails] = useState(null);
  const input = useRef(null);
  const { data = [], isLoading, refetch } = useFetch(isAllBranches ? null : '/auction/stock-check', { date: d });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['/auction/stock-check'] }); qc.invalidateQueries({ queryKey: ['/desk/stock-notes'] }); };

  const inHand = data.filter((r) => !r.bank_pledge_id);
  const bank = data.filter((r) => r.bank_pledge_id);
  const isChecked = (r) => r.checked_at && !n(r.missing);
  const checked = inHand.filter(isChecked);
  const missing = inHand.filter((r) => n(r.missing));
  const notChecked = inHand.filter((r) => !isChecked(r) && !n(r.missing));
  const scannedToday = inHand.filter((r) => isChecked(r) && dayjs(r.checked_at).isSame(dayjs(today()), 'day'));
  const pct = inHand.length ? (checked.length / inHand.length) * 100 : 0;
  const rows = useMemo(() => inHand
    .filter((r) => show === 'all' || (show === 'checked' ? isChecked(r) : !isChecked(r)))
    .filter((r) => !metal || r.loan_on === metal)
    .filter((r) => !q || `${r.bill_no} ${r.manual_bill_no || ''} ${r.customer_name} ${r.item_summary}`.toLowerCase().includes(q.toLowerCase()))
    .map((r, i) => ({ ...r, sno: i + 1, state: isChecked(r) ? dayjs(r.checked_at).format('DD/MM HH:mm') : n(r.missing) ? 'MISSING' : '-' })), [inHand, show, metal, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (list, k) => list.reduce((s, r) => s + n(r[k]), 0);
  const tag = (list) => `Rs. ${amount(sum(list, 'loan_amount'))} · ${weight(sum(list, 'net_wt'))} g`;

  const scan = async (e) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    try {
      const r = await api.post('/auction/stock-check', { date: d, code: c });
      setLast({ ok: true, text: `Loan ${r.data.bill_no} checked` });
      refresh();
    } catch (err) { setLast({ ok: false, text: err.message }); toast.error(err.message); }
    setCode('');
    input.current?.focus();
  };
  const uncheck = async () => { if (!sel || !sel.checked_at) return; try { await api.del(`/auction/stock-check/${sel.id}?date=${d}`); refresh(); } catch (e) { toast.error(e.message); } };
  const [flipping, setFlipping] = useState(null);
  // row = the switch in the table; without one (F6) it works on the selected row
  const markMissing = async (row) => {
    const r = row && row.id ? row : sel;
    if (!r) return toast.error('Select a loan');
    setFlipping(r.id);
    try { await api.post('/auction/stock-check/missing', { date: d, loan_id: r.id, missing: !n(r.missing) }); toast.success(n(r.missing) ? `Loan ${r.bill_no} is not missing` : `Loan ${r.bill_no} marked missing`); refresh(); } catch (e) { toast.error(e.message); } finally { setFlipping(null); }
  };
  const newCheck = async () => { try { await api.del(`/auction/stock-check?date=${d}`); setAsk(null); setLast(null); refresh(); toast.success('New stock check started'); } catch (e) { toast.error(e.message); } };
  const saveNote = async () => { try { await api.put(`/desk/stock-note/${note.id}`, { date: d, remarks: note.remarks }); setNote(null); refresh(); toast.success('Correction note saved'); } catch (e) { toast.error(e.message); } };
  const open = async (r) => { if (r) setDetails((await api.get(`/loans/${r.id}`)).data); };
  const print = () => printTable({ title: `Current Stock Check · ${date(d)} · ${checked.length} of ${inHand.length} checked`, company, columns: cols, rows, totals: { net_wt: sum(rows, 'net_wt'), loan_amount: sum(rows, 'loan_amount') } });
  useKeys({
    'ctrl+n': () => setAsk(true), delete: uncheck, f7: () => sel && navigate(`/loans/release?loan=${sel.id}`), f6: markMissing, f5: () => refetch(), f8: print, 'ctrl+p': print,
    'ctrl+e': () => exportCsv('stock-check', cols, rows), f3: () => input.current?.focus(), f4: () => document.getElementById('sc-search')?.focus(), f9: () => navigate('/loans/old'), escape: () => navigate('/'),
  }, [sel, rows, d]);

  if (isAllBranches) return <div className="card p-6 text-sm">Select a branch to do stock check.</div>;
  const started = checked.length + missing.length > 0;
  const seg = (val, cur, set, label) => <button key={val} type="button" onClick={() => set(val)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', cur === val ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{cur === val && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{label}</button>;
  const tile = (label, v, h, cls) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', cls)} />
      <p className="flex items-center gap-1.5 truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="num truncate text-lg leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );

  return (
    /* fit-screen: the page fits the window; only the packet list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Current Stock Check</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Physical check of pledged items in hand - scan or type each loan</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1">
          <span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">{started ? `Check of ${date(d)}` : 'Not started'}</span>
          <span className="num text-[13px] font-bold">{started ? `${checked.length} / ${inHand.length}` : 'first scan starts it'}</span>
        </div>
      </section>
      {/* scan bar: scan box · progress · last result */}
      <form onSubmit={scan} className="grid shrink-0 items-center gap-3 rounded-md border border-ink-200 bg-white p-2 md:grid-cols-[minmax(260px,360px)_1fr_minmax(220px,300px)] dark:border-ink-800 dark:bg-ink-900">
        <Input ref={input} autoFocus prefix={<ScanLine className="size-4 text-emerald-600" />} placeholder="Scan barcode / loan no + Enter" className="!h-11 text-base font-bold" value={code} onChange={(e) => setCode(e.target.value)} />

        <div className="min-w-0 px-1">
          <div className="flex items-baseline gap-2 text-[12px]">
            <span className="font-semibold text-ink-500">Checked</span>
            <span className="num text-lg leading-none font-extrabold text-emerald-700">{checked.length}</span>
            <span className="num text-ink-400">of {inHand.length}</span>
            {missing.length > 0 && <span className="num rounded-sm bg-orange-50 px-1.5 text-[11px] font-bold text-orange-700">{missing.length} missing</span>}
            <span className="num ml-auto text-[11px] text-ink-500">{Math.max(0, inHand.length - checked.length)} left</span>
            <span className="num text-sm font-bold text-navy-900 dark:text-white">{pct.toFixed(0)}%</span>
          </div>
          {/* checked (green) + missing (orange) + still to scan (grey) */}
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-sm bg-ink-100 dark:bg-ink-800">
            <div className="bg-emerald-600 transition-all duration-300" style={{ width: `${pct}%` }} />
            <div className="bg-orange-500 transition-all duration-300" style={{ width: `${inHand.length ? (missing.length / inHand.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className={clsx('flex h-11 items-center gap-2.5 rounded-md border px-3 transition-colors',
          last ? (last.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30') : 'border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/50')}>
          <span className={clsx('grid size-7 shrink-0 place-items-center rounded-full text-white', last ? (last.ok ? 'bg-emerald-600' : 'bg-rose-600') : 'bg-ink-400')}>
            {last ? (last.ok ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />) : <ScanLine className="size-4" />}
          </span>
          <div className="min-w-0 leading-tight">
            <p className={clsx('text-[13px] font-extrabold tracking-wide', last ? (last.ok ? 'text-emerald-700' : 'text-rose-600') : 'text-ink-500')}>{last ? (last.ok ? 'OK - CHECKED' : 'NOT FOUND') : 'READY TO SCAN'}</p>
            <p className="truncate text-[11px] text-ink-500">{last ? last.text : 'Scan the packet sticker or type its loan no'}</p>
          </div>
        </div>
      </form>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex">{seg('all', show, setShow, 'All')}{seg('checked', show, setShow, 'Checked')}{seg('not', show, setShow, 'Not checked')}</div>
        <div className="flex">{[['', 'All metals'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => seg(k, metal, setMetal, l))}</div>
        <div className="w-60"><Input id="sc-search" prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Search (F4)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="ml-auto text-[11px] text-ink-500">Rows shown: {rows.length}</span>
      </div>
      <div className="grid shrink-0 overflow-hidden rounded-md border border-ink-200 bg-white grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 dark:border-ink-800 dark:bg-ink-900">
        {tile('In stock (to check)', inHand.length, tag(inHand), 'bg-navy-800')}
        {tile('Checked', checked.length, tag(checked), 'bg-emerald-700')}
        {tile('Not checked yet', notChecked.length, tag(notChecked), 'bg-rose-600')}
        {tile('In bank (not in hand)', bank.length, `Rs. ${amount(sum(bank, 'loan_amount'))} · not in the list`, 'bg-violet-600')}
        {tile('Scanned today', scannedToday.length, date(new Date()), 'bg-amber-500')}
        {tile('Marked missing', missing.length, missing.length ? missing.map((m) => m.bill_no).join(', ') : 'none', 'bg-orange-600')}
      </div>
      <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full min-w-[1200px] text-[12px]">
          <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-10 px-2 py-1.5 font-semibold">✓</th>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label === 'Checked' ? 'Checked At' : c.label}</th>)}<th className="w-20 px-2 py-1.5 font-semibold">Missing</th><th className="w-40 px-2 py-1.5 text-right font-semibold">Correction</th></tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!rows.length && <tr><td colSpan={13} className="py-12 text-center text-[12px] text-ink-400">{isLoading ? 'Loading…' : 'No packets'}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => open(r)} className={clsx('cursor-pointer', sel?.id === r.id ? 'bg-sky-50 dark:bg-sky-950/30' : n(r.missing) ? 'bg-orange-50 dark:bg-orange-950/30' : isChecked(r) ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                <td className={clsx('border-l-2 px-2 py-1 text-center font-bold text-emerald-700', sel?.id === r.id ? 'border-sky-600' : 'border-transparent')}>{isChecked(r) ? '✓' : n(r.missing) ? <span className="text-orange-600">!</span> : ''}</td>
                <td className="px-2">{r.sno}</td><td className="px-2 font-semibold">{r.bill_no}</td><td className="px-2">{r.manual_bill_no || '-'}</td><td className="px-2">{date(r.loan_date)}</td>
                <td className="px-2"><b>{r.customer_name}</b>{r.relation_name ? <span className="text-ink-500"> {r.relation_type} {r.relation_name}</span> : ''}<span className="block text-[11px] text-ink-500">{r.customer_phone}</span></td>
                <td className="px-2"><span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{r.loan_on}</span></td><td className="max-w-64 px-2 uppercase"><span className="block truncate" title={r.items_text || r.item_summary}>{r.items_text || r.item_summary}</span>{r.remarks ? <span className="block truncate text-[11px] text-amber-700 normal-case">{r.remarks}</span> : ''}</td>
                <td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.loan_amount)}</td>
                <td className={clsx('px-2', n(r.missing) && 'font-bold text-orange-600')}>{r.state}</td><td className="px-2">{r.checked_by_name || '-'}</td>
                <td className="px-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" role="switch" aria-checked={!!n(r.missing)} disabled={flipping === r.id} onClick={() => markMissing(r)}
                    title={n(r.missing) ? 'Missing - switch off when found' : 'Switch on if the packet is missing'}
                    className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', n(r.missing) ? 'bg-orange-500' : 'bg-ink-200 dark:bg-ink-700')}>
                    <span className={clsx('inline-block size-4 rounded-full bg-white shadow-sm transition-transform', n(r.missing) ? 'translate-x-4.5' : 'translate-x-0.5')} />
                  </button>
                </td>
                <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 [&_button]:h-6 [&_button]:px-2 [&_button]:text-[11px]">
                    <Button size="sm" variant="outline" icon={StickyNote} title="Write a correction note for this packet" className={clsx(r.remarks && '!border-amber-300 !bg-amber-50 !text-amber-800')}
                      onClick={() => setNote({ id: r.id, bill_no: r.bill_no, remarks: r.remarks || '' })}>Note</Button>
                    <Button size="sm" variant="outline" icon={Unlock} title="Correction release of this loan (F7 on the selected row)" onClick={() => navigate(`/loans/release?loan=${r.id}`)}>Release</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr className="font-bold">
            <td colSpan={5} /><td className="px-2 py-1.5">Total - {rows.length} loan{rows.length === 1 ? '' : 's'}</td><td /><td className="px-2">Checked {rows.filter(isChecked).length} · not checked {rows.filter((r) => !isChecked(r)).length}</td>
            <td className="num px-2 text-right">{weight(sum(rows, 'net_wt'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'loan_amount'))}</td><td colSpan={4} />
          </tr></tfoot>
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        {can('stock', 'delete') && <Button variant="soft-danger" icon={Plus} onClick={() => setAsk(true)}>New Check (Ctrl+N)</Button>}
        <Button variant="outline" icon={Undo2} disabled={!sel?.checked_at} onClick={uncheck}>Un-check (Del)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F5)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F8)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('stock-check', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">Enter = check loan · F3 = scan box · F4 = search · double-click = loan details · Del = un-check · F6 = mark missing · F7 = correction release · F8 = print preview · F9 = old loan entry · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <ConfirmDrawer open={!!ask} onClose={() => setAsk(null)} onConfirm={newCheck} title="Start a new stock check?" confirmText="Start new check"
        message={`All ${checked.length + missing.length} scans of ${date(d)} will be cleared and the check starts again.`} />
      <Drawer open={!!note} onClose={() => setNote(null)} title={`Correction note · Loan #${note?.bill_no}`} icon={StickyNote} size="sm" footer={<Button variant="gold" onClick={saveNote}>Save note</Button>}>
        {note && <Field label="What was found / corrected" hint="e.g. seal broken - repacked, item count differs"><Textarea rows={4} value={note.remarks} onChange={(e) => setNote({ ...note, remarks: e.target.value })} /></Field>}
      </Drawer>
      <LoanDetailsDrawer full={details} onClose={() => setDetails(null)} />
    </div>
  );
}
