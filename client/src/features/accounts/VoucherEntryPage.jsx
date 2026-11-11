import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Save, Eraser, Pencil, Trash2, Printer, ArrowDownCircle, ArrowUpCircle, BookOpen, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Input, Select } from '@/components/ui';
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
  const navigate = useNavigate();
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

  const toggle = (on, tone = 'emerald') => clsx('-ml-px flex h-9 flex-1 items-center justify-center gap-1.5 border px-2.5 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md',
    on ? (tone === 'rose' ? 'relative z-10 border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200') : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300');
  const dot = (c = 'emerald') => <span className="relative flex size-1.5"><span className={clsx('absolute inline-flex size-full animate-ping rounded-full opacity-75', c === 'rose' ? 'bg-rose-500' : 'bg-emerald-500')} /><span className={clsx('relative inline-flex size-1.5 rounded-full', c === 'rose' ? 'bg-rose-600' : 'bg-emerald-600')} /></span>;
  const typeBtn = (t, label, Icon, tone) => (
    <button type="button" onClick={() => setF({ ...f, type: t })} className={toggle(f.type === t, tone)}>
      {f.type === t ? dot(tone) : <Icon className="size-3.5" />}{label}
    </button>
  );
  return (
    /* fit-screen: form on the left, the day's vouchers scroll on the right */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <Receipt className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Voucher Entry</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Money received (Jama) or paid (Nave) other than loans - rent, salary, bills, capital, bank</p></div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-md border border-white/15 px-3 py-1"><span className="mr-2 text-[10px] font-bold tracking-wider text-white/60 uppercase">V. No</span><b className="num text-[13px]">{editing ? editing.voucher_no : nextNo.data?.next || '-'}</b></div>
          <div className="rounded-md border border-white/15 px-3 py-1"><span className="mr-2 text-[10px] font-bold tracking-wider text-white/60 uppercase">Date</span><b className="num text-[13px]">{dayjs(d).format('DD/MM/YYYY')}</b></div>
          <div className={clsx('flex items-center gap-2 rounded-md border px-3 py-1', isClosed ? 'border-rose-400 bg-rose-600' : 'border-white/15')}><span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Day</span><b className="text-[13px]">{isClosed ? 'Closed' : 'Open'}</b></div>
        </div>
      </section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[360px_1fr]">
        {/* entry form */}
        <div className="card flex flex-col overflow-hidden xl:min-h-0">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
            <span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />
            <p className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{editing ? `Edit voucher ${editing.voucher_no}` : 'New voucher'}</p>
            {editing && <span className="ml-auto rounded-sm bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800 uppercase">editing</span>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            <div>
              <p className="label">Date <span className="font-normal normal-case text-ink-400">· {settings?.ALLOW_BACKDATE_BILLING === '1' ? 'back date allowed' : 'back date not allowed'}</span></p>
              <Input type="date" className="!h-8 text-[13px]" max={today()} disabled={settings?.ALLOW_BACKDATE_BILLING !== '1'} value={d} onChange={(e) => setD(e.target.value)} />
            </div>
            <div><p className="label">Type</p><div className="flex">
              {typeBtn('RECEIPT', 'Jama - Received', ArrowDownCircle, 'emerald')}
              {typeBtn('PAYMENT', 'Nave - Paid', ArrowUpCircle, 'rose')}
            </div></div>
            <div className="relative">
              <p className="label">Account (type A/c no or name)</p>
              <Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" value={acq} placeholder="Search account…" onChange={(e) => { setAcq(e.target.value); setF({ ...f, ledger_id: '' }); }} onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { setF({ ...f, ledger_id: String(matches[0].id) }); setAcq(matches[0].name); amt.current?.focus(); } }} />
              {!f.ledger_id && matches.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
                  {matches.map((l, i) => <button key={l.id} type="button" onClick={() => { setF({ ...f, ledger_id: String(l.id) }); setAcq(l.name); amt.current?.focus(); }} className={clsx('flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-ink-50 dark:hover:bg-ink-800', i === 0 && 'bg-emerald-50/60 dark:bg-emerald-950/20')}><span className="truncate"><b className="num mr-1.5 text-ink-500">{l.id}</b>{l.name}</span><span className="shrink-0 text-[10px] text-ink-400">{l.group_name}</span></button>)}
                </div>
              )}
            </div>
            <div className={clsx('rounded-md border px-2.5 py-1.5 text-[12px]', chosen ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-dashed border-ink-200 text-ink-400 dark:border-ink-700')}>
              {chosen ? <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate"><b>{chosen.name}</b> <span className="text-ink-500">· {chosen.group_name}</span></span><b className="num shrink-0">{amount(Math.abs(chosen.balance))} {chosen.balance >= 0 ? 'Dr' : 'Cr'}</b></div> : 'No account selected'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="label">Amount</p><Input ref={amt} type="number" className="!h-10 text-right text-[17px] font-bold" value={f.amount} placeholder="0.00" onChange={(e) => setF({ ...f, amount: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
              <div><p className="label">{f.type === 'RECEIPT' ? 'Received in' : 'Paid from'}</p><div className="flex [&>button]:!h-10">
                {['CASH', 'BANK'].map((m) => <button key={m} type="button" onClick={() => setF({ ...f, mode: m })} className={toggle(f.mode === m)}>{f.mode === m && dot()}{m === 'CASH' ? 'Cash' : 'Bank'}</button>)}
              </div></div>
            </div>
            {f.mode === 'BANK' && <div><p className="label">Bank</p><Select className="!h-8 text-[13px]" value={f.bank_ledger_id} onChange={(e) => setF({ ...f, bank_ledger_id: e.target.value })} placeholder={banks.length ? 'Select bank' : 'Add a bank account first'} options={banks.map((b) => ({ value: b.id, label: b.name }))} /></div>}
            <div><p className="label">Narration</p><Input className="!h-8 text-[13px]" value={f.narration} placeholder="optional" onChange={(e) => setF({ ...f, narration: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
            <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-1">
              <Button variant="gold" className="h-10" icon={Save} disabled={isClosed || !can('acc_voucher', 'add')} onClick={save}>{editing ? 'Update' : 'Save'} Voucher (F10)</Button>
              <Button variant="soft-danger" className="h-10" icon={Eraser} onClick={clear}>Clear</Button>
            </div>
            <button type="button" onClick={() => setJournal(true)} className="self-start text-[12px] font-semibold text-navy-700 hover:underline dark:text-ink-300">Journal / Contra voucher →</button>
          </div>
        </div>
        {/* the day's vouchers */}
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
            {[['Vouchers', rows.length, 'bg-navy-900 dark:bg-white', 'text-navy-900 dark:text-white'], ['Jama (received)', amount(jama), 'bg-emerald-600', 'text-emerald-700'], ['Nave (paid)', amount(nave), 'bg-rose-600', 'text-rose-600'], ['Cash effect', amount(jama - nave), 'bg-amber-500', 'text-navy-900 dark:text-white']].map(([l, v, bar, c]) => (
              <div key={l} className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800"><span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className={clsx('num truncate text-[15px] leading-tight font-bold', c)}>{v}</p></div>
            ))}
          </div>
          <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" /><p className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Vouchers - {dayjs(d).format('DD/MM/YYYY')}</p><span className="ml-auto text-[11px] text-ink-500">Click = select · double-click = edit</span></div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="px-3 py-2 text-left">V. No</th><th className="px-3 text-left">Type</th><th className="px-3 text-left">Account</th><th className="px-3 text-left">Narration</th><th className="px-3 text-left">Mode</th><th className="px-3 text-right">Jama</th><th className="px-3 text-right">Nave</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {rows.map((v) => (
                    <tr key={v.id} onClick={() => setSel(v.source_type ? null : v)} onDoubleClick={() => !v.source_type && edit(v)} title={v.source_type ? 'Posted by Auction Release - change it there' : undefined} className={clsx('cursor-pointer', sel?.id === v.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                      <td className="px-3 py-1.5 font-semibold"><span className="flex items-center gap-1.5">{sel?.id === v.id && dot()}{v.voucher_no}</span></td>
                      <td className="px-3"><span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase', v.voucher_type === 'RECEIPT' ? 'bg-emerald-100 text-emerald-800' : v.voucher_type === 'PAYMENT' ? 'bg-rose-100 text-rose-700' : 'bg-ink-100 text-ink-700')}>{v.voucher_type === 'RECEIPT' ? 'Jama' : v.voucher_type === 'PAYMENT' ? 'Nave' : v.voucher_type}</span></td>
                      <td className="max-w-64 truncate px-3">{v.source_type ? 'Auction' : v.account || v.lines_text}</td><td className="max-w-64 truncate px-3 text-ink-600 dark:text-ink-300">{v.narration}</td><td className="px-3 text-[11px]">{v.mode || (/Cash/.test(v.lines_text) ? 'Cash' : 'Bank')}</td>
                      <td className="num px-3 text-right text-emerald-700">{v.voucher_type === 'RECEIPT' ? amount(v.amount) : ''}</td><td className="num px-3 text-right text-rose-600">{v.voucher_type === 'PAYMENT' ? amount(v.amount) : ''}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={7} className="py-12 text-center text-ink-400">No vouchers for this date</td></tr>}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"><tr><td colSpan={5} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total (vouchers)</td><td className="num px-3 text-right text-emerald-700">{amount(jama)}</td><td className="num px-3 text-right text-rose-600">{amount(nave)}</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
            <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => edit(sel)}>Edit (F3)</Button>
            <Button variant="soft-danger" icon={Trash2} disabled={!sel || !can('acc_voucher', 'delete')} onClick={() => setDel(sel)}>Delete (Del)</Button>
            <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
            <Button variant="outline" icon={BookOpen} onClick={() => navigate('/accounts/ledger')}>Account Ledger</Button>
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
