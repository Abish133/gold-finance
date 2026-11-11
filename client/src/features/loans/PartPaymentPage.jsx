import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, RefreshCw, Save, Printer, X, Trash2, ScanLine, UserRound, ImagePlus } from 'lucide-react';
import { ImagePreview } from '@/components/common/ImagePreview';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input, Select } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, money, date, n, round2, today, weight } from '@/lib/format';
import { whatsappAfterSave } from '@/lib/whatsapp';
import { Panel, Line, useKeys, PaymentsGrid, useLoan, useApproval, CustomerLedgerDrawer, Chip, GoldButton } from './desk';

const MODES = [['CASH', 'Cash'], ['UPI', 'UPI'], ['BANK', 'Bank / NEFT'], ['CARD', 'Card'], ['CHEQUE', 'Cheque']];

/** Part Payment & Interest (desktop: frmPartPayments) - months strip, months stepper, multi-mode payment. */
export default function PartPaymentPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loanId = sp.get('loan');
  const { full, refresh } = useLoan(loanId);
  const { data: lk } = useLookups();
  const { data: settings } = useFetch('/admin/settings');
  const { printTxn, printerUi } = usePrinter();
  const approval = useApproval();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('INTEREST');
  const [months, setMonths] = useState(0);
  const [partAmt, setPartAmt] = useState('');
  const [pay, setPay] = useState({ mode: 'CASH', amount: '', reference: '', bank_account_id: '' });
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ledger, setLedger] = useState(false);
  const l = full?.loan;
  const c = full?.calc;

  useEffect(() => { setMonths(0); setPartAmt(''); setLines([]); }, [loanId]);
  // nothing due yet -> desktop opens on Part Amount
  // desktop: opens with all due months ready to pay
  useEffect(() => { if (c) { setTab(c.interestDue > 0 ? 'INTEREST' : 'PART'); setMonths(Math.max(0, (c.monthsDue || 0) - (c.monthsPaid || 0))); } }, [loanId, !!c]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useFetch(l ? '/loans' : null, { customer_id: l?.customer_id, status: 'OPEN', pageSize: 50 });
  const openCount = others.data?.length || 0;

  const monthly = c?.monthlyInterest || 0;
  const topupsAmt = round2((full?.transactions || []).filter((t) => !t.is_void && t.txn_type === 'TOPUP').reduce((s, t) => s + n(t.principal_amount), 0));
  const paidMonths = c?.monthsPaid || 0;
  const dueMonths = Math.max(0, (c?.monthsDue || 0) - paidMonths);
  const interest = tab === 'INTEREST' ? round2(months * monthly) : 0;
  const total = round2(interest + (tab === 'PART' ? n(partAmt) : 0));
  const received = round2(lines.reduce((s, x) => s + n(x.amount), 0));
  const balance = round2(total - received);
  const paidUpTo = l ? dayjs(l.loan_date).add(paidMonths + months, 'month').format('YYYY-MM-DD') : null;
  const strip = useMemo(() => Array.from({ length: Math.max(12, paidMonths + months + 1, c?.monthsDue || 0) }, (_, i) => {
    const m = i + 1;
    const advM = l && n(l.advance_interest) && monthly ? Math.round(n(l.advance_interest) / monthly) : 0;
    if (m <= advM) return 'adv';
    if (m <= paidMonths) return 'paid';
    if (m <= paidMonths + months) return 'now';
    if (m <= (c?.monthsDue || 0)) return 'due';
    return 'not';
  }), [paidMonths, months, c, l, monthly]);

  const load = async () => {
    if (!q.trim()) return;
    try { const r = await api.get('/loans/find', { q: q.trim() }); if (!r.data.length) toast.error('No loan found'); else setSp({ loan: r.data[0].id }); } catch (e) { toast.error(e.message); }
  };
  const addLine = () => {
    const a = n(pay.amount) || balance;
    if (a <= 0) return;
    if (pay.mode !== 'CASH' && !pay.bank_account_id) return toast.error('Select bank account');
    setLines([...lines, { ...pay, amount: a }]); setPay({ ...pay, amount: '', reference: '' });
  };
  const save = async (print) => {
    if (!l || total <= 0) return toast.error(tab === 'PART' ? 'Enter amount received' : 'Choose months to pay');
    if (tab === 'PART' && c && n(partAmt) > c.principalOutstanding) return toast.error('Amount is more than the outstanding - use Release');
    const payments = lines.length ? lines : [{ mode: 'CASH', amount: total }];
    if (Math.abs(payments.reduce((s, x) => s + n(x.amount), 0) - total) > 0.009) return toast.error('Payment amounts do not match total');
    setSaving(true);
    try {
      const r = await approval.run((ap) => (tab === 'INTEREST'
        ? api.post(`/loans/${l.id}/interest`, { date: today(), interest_amount: interest, months_paid: months, interest_upto: paidUpTo, payments, approval: ap })
        : api.post(`/loans/${l.id}/part-payment`, { date: today(), principal_amount: n(partAmt), interest_amount: interest, months_paid: months, payments, approval: ap })));
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['/loans'] }); qc.invalidateQueries({ queryKey: ['/dashboard'] });
      refresh(); setMonths(0); setPartAmt(''); setLines([]);
      { const lastT = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); whatsappAfterSave(settings, tab === 'INTEREST' ? 'INTEREST' : 'PART', r.data.loan, lastT); }
      if (print && settings?.PRINT_PART_RECEIPT !== '0') { const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); if (last) printTxn(r.data.loan, last); }
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({
    f2: () => setTab('INTEREST'), f3: () => setTab('PART'), '+': () => setMonths((m) => m + 1), '-': () => setMonths((m) => Math.max(0, m - 1)),
    f4: addLine, f5: () => { setSp({}); setQ(''); }, f10: () => save(true), escape: () => navigate('/'),
  }, [l, months, tab, partAmt, lines, pay, total]);

  const banks = (lk?.banks || []).map((b) => ({ value: b.id, label: b.bank_name }));
  const cell = { adv: 'bg-violet-200 text-violet-900', paid: 'bg-emerald-200 text-emerald-900', now: 'bg-ink-900 text-white', due: 'bg-rose-100 text-rose-800', not: 'bg-ink-100 text-ink-400' };

  return (
    /* fit-screen: on desktop the page fits the window; each column scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Part Payment &amp; Interest</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">Received from customer</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-white p-1">
          <Input autoFocus prefix={<ScanLine className="size-4" />} placeholder="Loan no / barcode" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="!h-8 w-64 text-[13px] font-bold" />
          <Button size="sm" onClick={load}>Load</Button>
        </div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1">
          <span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Date</span>
          <span className="num text-[13px] font-bold">{dayjs().format('DD/MM/YYYY')}</span>
        </div>
      </section>

      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[300px_1fr_400px]">
        <div className="desk-col">
        <Panel title="Customer" bodyClassName="flex flex-col gap-2 p-3">
          <div className="flex flex-col gap-2">
            <ImagePreview src={l?.customer_photo || l?.customer_photo_master} title={l ? `Customer · ${l.customer_name}` : 'Customer photo'}
              className="aspect-[4/3] w-full shrink-0 rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
              {(l?.customer_photo || l?.customer_photo_master)
                ? <img src={l.customer_photo || l.customer_photo_master} alt="" className="size-full object-contain" />
                : <span className="grid size-full place-items-center text-center text-ink-400"><span><UserRound className="mx-auto size-12" strokeWidth={1.25} /><span className="mt-1 block px-1 text-[10px] leading-tight font-bold uppercase">Photo not available</span></span></span>}
            </ImagePreview>
            <div className="min-w-0 text-[13px]">
              <p className="truncate text-[15px] font-bold text-navy-900 dark:text-white">{l ? `${l.customer_title || ''} ${l.customer_name}` : ''}</p>
              {l?.relation_name && <p className="text-ink-600">{l.relation_type} {l.relation_name}</p>}
              {l && <div className="mt-2 flex flex-wrap gap-2"><Chip tone="green">{l.customer_status || 'Active'}</Chip><Chip tone="gold">{openCount} open loan{openCount === 1 ? '' : 's'}</Chip></div>}
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-ink-200 text-[13px] dark:border-ink-800">
            {[['A/c No', l?.customer_no], ['Phone', l?.customer_phone], ['Address', l && [l.door_no, l.street, l.area, l.city].filter(Boolean).join(', ')], ['ID Proof', l?.id_proof_type]].map(([k, v]) => (
              <p key={k} className="grid grid-cols-[72px_1fr] gap-2 border-ink-100 px-2.5 py-1 not-last:border-b dark:border-ink-800"><span className="text-ink-500">{k}</span><span className="truncate font-semibold">{v || '-'}</span></p>
            ))}
          </div>
          {l && <Button size="sm" variant="outline" className="w-full" onClick={() => setLedger(true)}>Customer ledger</Button>}
          <p className="label -mb-1">Item photo</p>
          <ImagePreview src={l?.item_photo} title={l ? `Item photo · Loan #${l.bill_no}` : 'Item photo'}
            className="grid min-h-32 w-full flex-1 place-items-center rounded-md border border-dashed border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
            {l?.item_photo ? <img src={l.item_photo} alt="" className="size-full object-contain" /> : <span className="flex flex-col items-center gap-1 text-[12px] text-ink-400"><ImagePlus className="size-6" strokeWidth={1.5} />No item photo</span>}
          </ImagePreview>
        </Panel>
        </div>

        <div className="desk-col min-w-0">
          <Panel title="Loan" className="[&>header]:hidden">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <p className="text-xl font-extrabold text-navy-900 dark:text-white">Loan #{l?.bill_no || ''}</p>
              {l && <span className="text-sm text-ink-600">{[l.manual_bill_no && `Bill Book ${l.manual_bill_no}`, l.loan_on].filter(Boolean).join(' · ')}</span>}
              {l && <span className="ml-auto">{l.bank_pledge_id ? <Chip tone="violet">At bank</Chip> : <Chip tone="green">In hand</Chip>}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['Pledge date', l ? date(l.loan_date) : '-'], ['Loan amount', l ? money(n(l.principal) + topupsAmt) : '-'], ['Rate / month', l ? `${n(c?.rateType === 'MONTHLY' ? c.rate : round2(c?.rate / 12)).toFixed(2)}%` : '-']].map(([k, v]) => (
                <div key={k} className="rounded-md border border-ink-200 px-3 py-1.5 dark:border-ink-800"><p className="label">{k}</p><p className="num text-[13px] font-bold text-navy-900 dark:text-white">{v}</p></div>
              ))}
            </div>
            <p className="label mt-2.5">Interest months {c && <span className="ml-2 normal-case">Total {c.monthsDue} · Paid {paidMonths} · Due {dueMonths}</span>}</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {strip.map((st, i) => (
                <div key={i} className={clsx('rounded py-1 text-center text-xs font-bold leading-tight', cell[st])}>{i + 1}
                  {l && <span className="block text-[10px] font-medium opacity-80">{dayjs(l.loan_date).add(i, 'month').format('MMM')}</span>}</div>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-ink-600">
              {[['adv', 'Advance'], ['paid', 'Paid'], ['now', 'Paying now'], ['due', 'Due'], ['not', 'Not yet']].map(([k, t]) => <span key={k} className="flex items-center gap-1"><span className={clsx('size-3 rounded', cell[k])} />{t}</span>)}
            </div>
            {c && (() => { const paidP = round2(n(l.principal) + topupsAmt - c.principalOutstanding); const pct = Math.min(100, (paidP / Math.max(1, n(l.principal) + topupsAmt)) * 100); return (
              <div className="mt-2.5">
                <div className="flex justify-between text-[12px]"><span className="font-semibold text-emerald-700">PRINCIPAL &nbsp; Paid {money(paidP)}</span><span className="font-semibold text-rose-600">Outstanding {money(c.principalOutstanding)}</span></div>
                <div className="mt-1 h-2 rounded-sm bg-ink-100 dark:bg-ink-700"><div className="h-2 rounded-sm bg-emerald-600" style={{ width: `${pct}%` }} /></div>
              </div>); })()}
          </Panel>
          <Panel title="Pledged items" bodyClassName="p-0">
            <table className="w-full text-[13px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[11px] tracking-wider text-white uppercase"><tr><th className="w-8 px-3 py-1.5 text-left font-semibold">#</th><th className="px-3 text-left font-semibold">Item</th><th className="px-3 text-right font-semibold">Pcs</th><th className="px-3 text-right font-semibold">Gross</th><th className="px-3 text-right font-semibold">Less</th><th className="px-3 text-right font-semibold">Net</th><th className="px-3 text-right font-semibold">Purity</th><th className="px-3 text-left font-semibold">Remark</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{!full && <tr><td colSpan={8} className="py-5 text-center text-[12px] text-ink-400">Load a loan to see its items</td></tr>}{(full?.items || []).map((i, k) => <tr key={i.id}><td className="px-3 py-1">{k + 1}</td><td className="px-3 uppercase">{i.item_name}</td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity).toFixed(2)}</td><td className="px-3 text-xs">{i.remarks}</td></tr>)}</tbody>
            </table>
          </Panel>
          <Panel title="Payment history" bodyClassName="flex min-h-36 flex-col p-2"><PaymentsGrid className="min-h-0 flex-1" transactions={full?.transactions} loan={l} advanceMode="At loan time" /></Panel>
        </div>

        <div className="desk-col">
        <Panel title="Receive" bodyClassName="flex flex-col gap-2 p-3">
          <div className="grid grid-cols-2">
            {[['INTEREST', 'Interest (F2)'], ['PART', 'Part Amount (F3)']].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={clsx('-ml-px flex h-9 items-center justify-center gap-1.5 border text-[13px] font-bold first:ml-0 first:rounded-l-md last:rounded-r-md',
                  tab === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>
                {tab === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{t}
              </button>
            ))}
          </div>
          {tab === 'INTEREST' && <>
          <div className="flex items-center gap-2 rounded-md border border-ink-200 p-1.5 dark:border-ink-800">
            <span className="flex-1 pl-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Months to pay</span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setMonths((m) => Math.max(0, m - 1))}><Minus className="size-4" /></Button>
            <input type="number" min="0" inputMode="numeric" aria-label="Months to pay" value={months}
              onChange={(e) => setMonths(Math.max(0, Math.floor(Number(e.target.value) || 0)))} onFocus={(e) => e.target.select()}
              className="num h-8 w-14 rounded-md border border-ink-200 bg-white text-center text-xl font-extrabold text-navy-900 outline-none [appearance:textfield] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <Button variant="outline" size="icon" className="size-8" onClick={() => setMonths((m) => m + 1)}><Plus className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
            <Button variant="outline" onClick={() => setMonths(1)}>1 month</Button>
            <Button variant="outline" onClick={() => setMonths(3)}>3 months</Button>
            <Button variant="outline" onClick={() => setMonths(dueMonths)}>All due ({dueMonths})</Button>
          </div>
          <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[13px]">
            <Line label="Interest / month" value={amount(monthly)} />
            <Line label="Months" value={months} />
            <Line label="Paid up to (after save)" value={paidUpTo ? date(paidUpTo) : '-'} />
            <Line bold label="Total" value={amount(total)} />
          </div>
          </>}
          {tab === 'PART' && <>
            <Field label="Amount received"><Input type="number" autoFocus className="!h-11 text-right text-xl font-bold" value={partAmt} onChange={(e) => setPartAmt(e.target.value)} /></Field>
            <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[13px]">
              <Line label="Outstanding now" value={c ? money(c.principalOutstanding) : '-'} />
              <Line label="Paying" value={`− ${money(partAmt)}`} />
              <Line bold label="New outstanding" value={c ? money(Math.max(0, c.principalOutstanding - n(partAmt))) : '-'} />
            </div>
            <p className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{c?.mode === 'MYBOOK' ? 'Interest is calculated on the original loan amount (as per current system).' : 'Interest from today is calculated on the new outstanding amount.'}</p>
            {c?.interestDue > 0 && <p className="text-xs text-amber-700">Interest due {money(c.interestDue)} - collect it in the Interest (F2) tab.</p>}
          </>}
          <div className="navy-gradient flex items-baseline justify-between rounded-md px-3 py-2 text-white">
            <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Total to receive</span>
            <span className="num text-2xl font-extrabold">{money(total)}</span>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-1.5">
            <Field label="Payment mode"><Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })} options={MODES.map(([v, t]) => ({ value: v, label: t }))} /></Field>
            <Field label="Amount"><Input type="number" placeholder={String(balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Reference / UTR"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <Button className="h-9" onClick={addLine}>Add</Button>
          </div>
          {pay.mode !== 'CASH' && <Select value={pay.bank_account_id} onChange={(e) => setPay({ ...pay, bank_account_id: e.target.value })} placeholder="Bank account" options={banks} />}
          <div className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]"><thead className="bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="px-3 py-1 text-left font-semibold">Mode</th><th className="px-3 text-right font-semibold">Amount</th><th className="px-3 text-left font-semibold">Reference</th><th /></tr></thead>
              <tbody>{lines.map((x, i) => <tr key={i}><td className="px-3 py-1">{x.mode}</td><td className="num px-3 text-right">{amount(x.amount)}</td><td className="px-3">{x.reference}</td><td><button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="size-4 text-rose-500" /></button></td></tr>)}
                {!lines.length && <tr><td colSpan={4} className="px-3 py-2 text-xs text-ink-400">No lines - full amount taken as cash</td></tr>}</tbody></table>
          </div>
          <div className="flex items-center justify-between text-[13px] font-bold"><span>Balance</span><span className={clsx('num', lines.length && balance !== 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(lines.length ? balance : 0)} {(!lines.length || balance === 0) && '✓'}</span></div>
          <div className="mt-auto space-y-1.5 pt-1">
            <GoldButton icon={Printer} loading={saving} onClick={() => save(true)}>Save &amp; Print Receipt (F10)</GoldButton>
            <div className="grid grid-cols-3 gap-1.5 [&_button]:h-8 [&_button]:px-2 [&_button]:text-[12px]">
              <Button variant="outline" icon={RefreshCw} onClick={() => { setSp({}); setQ(''); }}>Refresh (F5)</Button>
              <Button variant="outline" icon={Save} loading={saving} onClick={() => save(false)}>Save only</Button>
              <Button variant="soft-danger" icon={X} onClick={() => navigate('/')}>Close (Esc)</Button>
            </div>
          </div>
        </Panel>
        </div>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">Enter = load · F2 Interest · F3 Part amount · + / − months · F4 Add payment · F5 Refresh · F10 Save · Esc Close</p>
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {approval.ui}
      {printerUi}
    </div>
  );
}
