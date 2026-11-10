import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Undo2, Unlock, SearchX, RefreshCw, Printer, FileDown, FileSpreadsheet, LogOut, StickyNote } from 'lucide-react';
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
  const scannedToday = inHand.filter((r) => isChecked(r) && dayjs(r.checked_at).isSame(dayjs(), 'day'));
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
  const markMissing = async () => {
    if (!sel) return toast.error('Select a loan');
    try { await api.post('/auction/stock-check/missing', { date: d, loan_id: sel.id, missing: !n(sel.missing) }); toast.success(n(sel.missing) ? 'Missing mark removed' : `Loan ${sel.bill_no} marked missing`); refresh(); } catch (e) { toast.error(e.message); }
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
  const seg = (val, cur, set, label) => <button key={val} type="button" onClick={() => set(val)} className={clsx('h-9 rounded-md border px-4 text-sm font-semibold', cur === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{label}</button>;
  const tile = (label, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{label}</p><p className="num text-2xl font-bold text-navy-900 dark:text-white">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Current Stock Check</h1><p className="text-sm text-navy-100">Physical check of pledged items in hand - scan or type each loan</p></div>
        <div className="rounded-md bg-white/10 px-5 py-1.5 text-center"><p className="font-bold uppercase">{started ? `Check of ${date(d)}` : 'Check not started'}</p><p className="text-sm">{started ? `${checked.length} of ${inHand.length} checked` : 'first scan starts it'}</p></div>
      </section>
      <div className="grid gap-3 xl:grid-cols-[1fr_460px]">
        <form onSubmit={scan} className="card space-y-2 p-4">
          <p className="label">Scan barcode or type loan no</p>
          <Input ref={input} autoFocus className="h-12 bg-gold-50 text-xl font-bold" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="relative h-5 rounded bg-ink-100 dark:bg-ink-800"><div className="h-5 rounded bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
            <span className="absolute inset-0 grid place-items-center text-xs font-bold">{checked.length} of {inHand.length} checked ({pct.toFixed(1)}%)</span></div>
        </form>
        <div className={clsx('card grid place-items-center p-4 text-center', last ? (last.ok ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30') : '')}>
          <p className={clsx('text-2xl font-extrabold', last ? (last.ok ? 'text-emerald-700' : 'text-rose-600') : 'text-ink-500')}>{last ? (last.ok ? 'OK' : 'NOT FOUND') : 'READY'}</p>
          {last && <p className="text-sm font-semibold">{last.text}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="label mb-0">Show</span><div className="flex gap-1">{seg('all', show, setShow, 'All')}{seg('checked', show, setShow, 'Checked')}{seg('not', show, setShow, 'Not checked')}</div>
        <span className="label mb-0 ml-3">Metal</span><div className="flex gap-1">{[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => seg(k, metal, setMetal, l))}</div>
        <Input id="sc-search" className="max-w-sm" placeholder="Search (F4)" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto text-xs text-ink-500">Rows shown: {rows.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tile('In stock (to check)', inHand.length, tag(inHand), 'border-t-navy-800 bg-cream-100')}
        {tile('Checked', checked.length, tag(checked), 'border-t-emerald-700')}
        {tile('Not checked yet', notChecked.length, tag(notChecked), 'border-t-rose-600')}
        {tile('In bank (not in hand)', bank.length, `Rs. ${amount(sum(bank, 'loan_amount'))} · not in the list`, 'border-t-violet-600')}
        {tile('Scanned today', scannedToday.length, date(new Date()), 'border-t-amber-500')}
        {tile('Marked missing', missing.length, missing.length ? missing.map((m) => m.bill_no).join(', ') : 'none', 'border-t-orange-600')}
      </div>
      <div className="card overflow-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="navy-gradient sticky top-0 text-white"><tr><th className="w-10 px-2 py-2">✓</th>{cols.map((c) => <th key={c.key} className={clsx('px-2 py-2', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label === 'Checked' ? 'Checked At' : c.label}</th>)}<th /></tr></thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {!rows.length && <tr><td colSpan={13} className="py-12 text-center text-ink-400">{isLoading ? 'Loading…' : 'No packets'}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => open(r)} className={clsx('cursor-pointer', sel?.id === r.id ? 'bg-navy-50 dark:bg-ink-800' : n(r.missing) ? 'bg-orange-50 dark:bg-orange-950/30' : isChecked(r) && 'bg-emerald-50/60 dark:bg-emerald-950/20')}>
                <td className="px-2 py-1.5 text-center font-bold text-emerald-700">{isChecked(r) ? '✓' : n(r.missing) ? <span className="text-orange-600">!</span> : ''}</td>
                <td className="px-2">{r.sno}</td><td className="px-2 font-semibold">{r.bill_no}</td><td className="px-2">{r.manual_bill_no || '-'}</td><td className="px-2">{date(r.loan_date)}</td>
                <td className="px-2"><b>{r.customer_name}</b>{r.relation_name ? <span className="text-ink-500"> {r.relation_type} {r.relation_name}</span> : ''}<span className="block text-[11px] text-ink-500">{r.customer_phone}</span></td>
                <td className="px-2"><span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{r.loan_on}</span></td><td className="px-2 uppercase">{r.items_text || r.item_summary}{r.remarks ? <span className="block text-[11px] text-amber-700">{r.remarks}</span> : ''}</td>
                <td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.loan_amount)}</td>
                <td className={clsx('px-2', n(r.missing) && 'font-bold text-orange-600')}>{r.state}</td><td className="px-2">{r.checked_by_name || '-'}</td>
                <td className="px-2"><button type="button" title="Correction note" onClick={(e) => { e.stopPropagation(); setNote({ id: r.id, bill_no: r.bill_no, remarks: r.remarks || '' }); }}><StickyNote className="size-4 text-ink-500" /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="navy-gradient text-white"><tr className="font-bold">
            <td colSpan={5} /><td className="px-2 py-2">Total - {rows.length} loan{rows.length === 1 ? '' : 's'}</td><td /><td className="px-2">Checked {rows.filter(isChecked).length} · not checked {rows.filter((r) => !isChecked(r)).length}</td>
            <td className="num px-2 text-right">{weight(sum(rows, 'net_wt'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'loan_amount'))}</td><td colSpan={3} />
          </tr></tfoot>
        </table>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        {can('stock', 'delete') && <Button variant="outline" icon={Plus} className="text-rose-700" onClick={() => setAsk(true)}>New Check (Ctrl+N)</Button>}
        <Button variant="outline" icon={Undo2} disabled={!sel?.checked_at} onClick={uncheck}>Un-check (Del)</Button>
        <Button variant="outline" icon={Unlock} disabled={!sel} onClick={() => navigate(`/loans/release?loan=${sel.id}`)}>Correction Release (F7)</Button>
        <Button variant="outline" icon={SearchX} disabled={!sel} onClick={markMissing}>{n(sel?.missing) ? 'Not Missing (F6)' : 'Mark Missing (F6)'}</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F5)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F8)</Button>
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('stock-check', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = check loan · F3 = scan box · F4 = search · double-click = loan details · Del = un-check · F6 = mark missing · F7 = correction release · F8 = print preview · F9 = old loan entry · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
      <ConfirmDrawer open={!!ask} onClose={() => setAsk(null)} onConfirm={newCheck} title="Start a new stock check?" confirmText="Start new check"
        message={`All ${checked.length + missing.length} scans of ${date(d)} will be cleared and the check starts again.`} />
      <Drawer open={!!note} onClose={() => setNote(null)} title={`Correction note · Loan #${note?.bill_no}`} icon={StickyNote} size="sm" footer={<Button variant="gold" onClick={saveNote}>Save note</Button>}>
        {note && <Field label="What was found / corrected" hint="e.g. seal broken - repacked, item count differs"><Textarea rows={4} value={note.remarks} onChange={(e) => setNote({ ...note, remarks: e.target.value })} /></Field>}
      </Drawer>
      <LoanDetailsDrawer full={details} onClose={() => setDetails(null)} />
    </div>
  );
}
