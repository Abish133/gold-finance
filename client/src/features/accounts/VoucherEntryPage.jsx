import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Eraser, Pencil, Trash2, Printer, ArrowDownCircle, ArrowUpCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { amount, n, today } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { VoucherDrawer } from './VouchersPage';

/** Voucher Entry (desktop: frmVoucherEntry) - money received (Jama) or paid (Nave) other than loans. */
export default function VoucherEntryPage() {
  const qc = useQueryClient();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data: settings } = useFetch('/admin/settings');
  const [d, setD] = useState(today());
  const [f, setF] = useState({ type: 'PAYMENT', ledger_id: '', amount: '', mode: 'CASH', bank_ledger_id: '', narration: '' });
  const [acq, setAcq] = useState('');
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const [journal, setJournal] = useState(false);
  const [sel, setSel] = useState(null);
  const amt = useRef(null);
  const ledgers = useFetch('/desk/ledger-balances');
  const list = useFetch('/accounts/vouchers', { from: d, to: d, manual: '1', pageSize: 200 });
  const nextNo = useFetch(isAllBranches ? null : '/accounts/vouchers/next-no');
  const closed = useFetch(isAllBranches ? null : '/accounts/day-close');
  const isClosed = closed.data?.lastClosed && !dayjs(d).isAfter(dayjs(closed.data.lastClosed));
  const accounts = (ledgers.data || []).filter((l) => l.is_active && l.system_key !== 'CASH');
  const banks = accounts.filter((l) => l.group_name === 'Bank Accounts');
  const matches = useMemo(() => {
    const q = acq.trim().toLowerCase();
    if (!q) return [];
    return accounts.filter((l) => String(l.id) === q || (l.code || '').toLowerCase() === q || l.name.toLowerCase().includes(q)).slice(0, 8);
  }, [acq, accounts]);
  const chosen = accounts.find((l) => String(l.id) === String(f.ledger_id));
  const rows = list.data || [];
  const jama = rows.filter((v) => v.voucher_type === 'RECEIPT').reduce((s, v) => s + n(v.amount), 0);
  const nave = rows.filter((v) => v.voucher_type === 'PAYMENT').reduce((s, v) => s + n(v.amount), 0);

  const clear = () => { setF({ type: f.type, ledger_id: '', amount: '', mode: 'CASH', bank_ledger_id: '', narration: '' }); setAcq(''); setEditing(null); };
  const save = async () => {
    if (!f.ledger_id || !(n(f.amount) > 0)) return toast.error('Select account and enter amount');
    try {
      if (editing) await api.del(`/accounts/vouchers/${editing.id}`);
      await api.post('/accounts/vouchers', { voucher_type: f.type, date: d, ledger_id: f.ledger_id, amount: f.amount, mode: f.mode, bank_ledger_id: f.bank_ledger_id, narration: f.narration });
      toast.success(editing ? 'Voucher updated' : 'Voucher saved');
      clear(); list.refetch(); ledgers.refetch(); nextNo.refetch?.(); qc.invalidateQueries({ queryKey: ['/accounts/vouchers'] });
    } catch (e) { toast.error(e.message); }
  };
  const edit = async (v) => {
    const r = (await api.get(`/accounts/vouchers/${v.id}`)).data;
    const other = r.lines.find((l) => !['Cash'].includes(l.ledger_name) && !banks.some((b) => b.id === l.ledger_id)) || r.lines[0];
    const bankLine = r.lines.find((l) => banks.some((b) => b.id === l.ledger_id));
    setEditing(v);
    setF({ type: v.voucher_type, ledger_id: String(other.ledger_id), amount: String(Math.max(n(other.debit), n(other.credit))), mode: bankLine ? 'BANK' : 'CASH', bank_ledger_id: bankLine ? String(bankLine.ledger_id) : '', narration: v.narration || '' });
    setAcq(other.ledger_name);
  };
  const print = () => printTable({ title: `Vouchers - ${dayjs(d).format('DD/MM/YYYY')}`, company, rows, columns: [
    { key: 'voucher_no', label: 'V.No' }, { key: 'voucher_type', label: 'Type', print: (r) => (r.voucher_type === 'RECEIPT' ? 'Jama' : 'Nave') }, { key: 'account', label: 'Account', print: (r) => (r.source_type ? 'Auction' : r.account || r.lines_text) },
    { key: 'narration', label: 'Narration' }, { key: 'amount', label: 'Amount', type: 'money' }] });
  useKeys({ f10: save, f3: () => sel && edit(sel), delete: () => sel && setDel(sel), f9: print }, [f, d, sel, editing]);

  const typeBtn = (t, label, Icon, on) => (
    <button type="button" onClick={() => setF({ ...f, type: t })} className={clsx('flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold', f.type === t ? on : 'border-ink-300 bg-white text-ink-600')}>
      <Icon className="size-4" />{label}
    </button>
  );
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Voucher Entry</h1><p className="text-sm text-navy-100">Money received (Jama) or paid (Nave) other than loans - rent, salary, bills, capital, bank</p></div>
        <div className="rounded-md bg-white/10 px-4 py-1.5 text-center"><p className="text-[11px] font-bold uppercase">Date</p><p className="font-bold">{dayjs(d).format('DD/MM/YYYY')}</p></div>
        <div className={clsx('rounded-md px-4 py-1.5 text-center', isClosed ? 'bg-rose-600' : 'bg-white/10')}><p className="text-[11px] font-bold uppercase">Day</p><p className="font-bold">{isClosed ? 'Closed' : 'Open'}</p></div>
      </section>
      <div className="grid items-start gap-3 xl:grid-cols-[400px_1fr]">
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-bold text-ink-600 uppercase">{editing ? `Edit voucher ${editing.voucher_no}` : 'New voucher'}</p><span className="text-xs text-ink-500">V. No {editing ? editing.voucher_no : nextNo.data?.next || '-'}</span></div>
          <Field label="Date" hint={settings?.ALLOW_BACKDATE_BILLING === '1' ? 'Back date allowed (setting)' : 'Back date not allowed'}>
            <Input type="date" max={today()} disabled={settings?.ALLOW_BACKDATE_BILLING !== '1'} value={d} onChange={(e) => setD(e.target.value)} />
          </Field>
          <div><p className="label">Type</p><div className="grid grid-cols-2 gap-2">
            {typeBtn('RECEIPT', 'Jama - Received', ArrowDownCircle, 'border-emerald-300 bg-emerald-50 text-emerald-800')}
            {typeBtn('PAYMENT', 'Nave - Paid', ArrowUpCircle, 'border-rose-300 bg-rose-50 text-rose-700')}
          </div></div>
          <Field label="Account (type A/c no or name)">
            <Input value={acq} onChange={(e) => { setAcq(e.target.value); setF({ ...f, ledger_id: '' }); }} onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { setF({ ...f, ledger_id: String(matches[0].id) }); setAcq(matches[0].name); amt.current?.focus(); } }} />
          </Field>
          {!f.ledger_id && matches.length > 0 && (
            <div className="-mt-2 max-h-48 overflow-y-auto rounded-md border border-ink-200">
              {matches.map((l) => <button key={l.id} type="button" onClick={() => { setF({ ...f, ledger_id: String(l.id) }); setAcq(l.name); amt.current?.focus(); }} className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-navy-50"><span>{l.id} · {l.name}</span><span className="text-xs text-ink-400">{l.group_name}</span></button>)}
            </div>
          )}
          <div className="rounded-md bg-cream-100 px-3 py-2 text-sm">{chosen ? <span><b>{chosen.name}</b> · {chosen.group_name} · balance {amount(Math.abs(chosen.balance))} {chosen.balance >= 0 ? 'Dr' : 'Cr'}</span> : 'No account selected'}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><Input ref={amt} type="number" className="h-11 text-lg font-bold" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
            <div><p className="label">{f.type === 'RECEIPT' ? 'Received in' : 'Paid from'}</p><div className="grid grid-cols-2 gap-1">
              {['CASH', 'BANK'].map((m) => <button key={m} type="button" onClick={() => setF({ ...f, mode: m })} className={clsx('h-11 rounded-md border text-sm font-bold', f.mode === m ? 'border-navy-800 bg-navy-800 text-white' : 'border-ink-300')}>{m === 'CASH' ? 'Cash' : 'Bank'}</button>)}
            </div></div>
          </div>
          {f.mode === 'BANK' && <Field label="Bank"><Select value={f.bank_ledger_id} onChange={(e) => setF({ ...f, bank_ledger_id: e.target.value })} placeholder={banks.length ? 'Select bank' : 'Add a bank account first'} options={banks.map((b) => ({ value: b.id, label: b.name }))} /></Field>}
          <Field label="Narration"><Input value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
          <div className="grid grid-cols-[1fr_auto] gap-2 pt-2">
            <Button variant="outline" size="lg" icon={Save} disabled={isClosed || !can('acc_voucher', 'add')} onClick={save}>Save Voucher (F10)</Button>
            <Button variant="outline" size="lg" icon={Eraser} onClick={clear}>Clear</Button>
          </div>
          <button type="button" onClick={() => setJournal(true)} className="text-xs font-semibold text-navy-700 hover:underline">Journal / Contra voucher →</button>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            {[['Vouchers', rows.length, 'text-navy-900'], ['Jama (received)', amount(jama), 'text-emerald-700'], ['Nave (paid)', amount(nave), 'text-rose-600']].map(([l, v, c]) => (
              <div key={l} className="card px-4 py-3"><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className={clsx('num text-2xl font-bold', c)}>{v}</p></div>
            ))}
            <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Cash effect</p><p className="num text-2xl font-bold">{amount(jama - nave)}</p></div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2"><p className="font-bold text-navy-900">Vouchers - {dayjs(d).format('DD/MM/YYYY')}</p><span className="text-xs text-ink-500">Click = select · double-click = edit</span></div>
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">V. No</th><th className="px-3 text-left">Type</th><th className="px-3 text-left">Account</th><th className="px-3 text-left">Narration</th><th className="px-3 text-left">Mode</th><th className="px-3 text-right">Jama</th><th className="px-3 text-right">Nave</th></tr></thead>
              <tbody className="divide-y divide-ink-200">
                {rows.map((v) => (
                  <tr key={v.id} onClick={() => setSel(v.source_type ? null : v)} onDoubleClick={() => !v.source_type && edit(v)} title={v.source_type ? 'Posted by Auction Release - change it there' : undefined} className={clsx('cursor-pointer hover:bg-navy-50/60', sel?.id === v.id && 'bg-cream-200')}>
                    <td className="px-3 py-1.5 font-semibold">{v.voucher_no}</td><td className="px-3">{v.voucher_type === 'RECEIPT' ? 'Jama' : v.voucher_type === 'PAYMENT' ? 'Nave' : v.voucher_type}</td>
                    <td className="max-w-72 truncate px-3">{v.source_type ? 'Auction' : v.account || v.lines_text}</td><td className="px-3">{v.narration}</td><td className="px-3 text-xs">{v.mode || (/Cash/.test(v.lines_text) ? 'Cash' : 'Bank')}</td>
                    <td className="num px-3 text-right text-emerald-700">{v.voucher_type === 'RECEIPT' ? amount(v.amount) : ''}</td><td className="num px-3 text-right text-rose-600">{v.voucher_type === 'PAYMENT' ? amount(v.amount) : ''}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="py-16 text-center text-ink-400">No vouchers for this date</td></tr>}
              </tbody>
              <tfoot className="bg-cream-100 font-bold"><tr><td colSpan={5} className="px-3 py-2">Total (vouchers)</td><td className="num px-3 text-right text-emerald-700">{amount(jama)}</td><td className="num px-3 text-right text-rose-600">{amount(nave)}</td></tr></tfoot>
            </table>
          </div>
          <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
            <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => edit(sel)}>Edit (F3)</Button>
            <Button variant="outline" icon={Trash2} disabled={!sel || !can('acc_voucher', 'delete')} onClick={() => setDel(sel)}>Delete (Del)</Button>
            <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
            <Button variant="outline" icon={BookOpen} onClick={() => window.location.assign('/accounts/ledger')}>Account Ledger</Button>
            <ExitButton />
          </div>
        </div>
      </div>
      <VoucherDrawer open={journal} onClose={() => { setJournal(false); list.refetch(); }} />
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} title={`Delete voucher ${del?.voucher_no}?`}
        onConfirm={async () => { try { await api.del(`/accounts/vouchers/${del.id}`); toast.success('Deleted'); setDel(null); setSel(null); list.refetch(); ledgers.refetch(); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
