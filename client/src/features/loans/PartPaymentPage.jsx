import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, RefreshCw, Save, Printer, X, Trash2 } from 'lucide-react';
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
import { Panel, Line, useKeys, PaymentsGrid, useLoan, useApproval, CustomerLedgerDrawer, PhotoBox, Chip } from './desk';

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
  useEffect(() => { if (c) setTab(c.interestDue > 0 ? 'INTEREST' : 'PART'); }, [loanId, !!c]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useFetch(l ? '/loans' : null, { customer_id: l?.customer_id, status: 'OPEN', pageSize: 50 });
  const openCount = others.data?.data?.length || 0;

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
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Part Payment &amp; Interest</h1><p className="text-sm text-navy-100">Received from customer</p></div>
        <div className="flex items-center gap-2 rounded-md bg-white p-1.5">
          <span className="px-2 text-sm text-ink-600">Loan No / Barcode</span>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="h-10 w-72 bg-gold-50 text-base font-bold" />
          <Button onClick={load}>Load</Button>
        </div>
        <div className="rounded-md bg-white/10 px-4 py-2 text-lg font-bold">{dayjs().format('DD/MM/YYYY')}</div>
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-[320px_1fr_420px]">
        <Panel title="Customer" bodyClassName="flex flex-col gap-3 p-4">
          <div className="flex gap-3">
            <PhotoBox src={l?.customer_photo || l?.customer_photo_master} className="h-28 w-24" />
            <div className="min-w-0 text-sm">
              <p className="text-lg font-bold text-navy-900 dark:text-white">{l ? `${l.customer_title || ''} ${l.customer_name}` : ''}</p>
              {l?.relation_name && <p className="text-ink-600">{l.relation_type} {l.relation_name}</p>}
              {l && <div className="mt-2 flex flex-wrap gap-2"><Chip tone="green">{l.customer_status || 'Active'}</Chip><Chip tone="gold">{openCount} open loan{openCount === 1 ? '' : 's'}</Chip></div>}
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            {[['A/c No', l?.customer_no], ['Phone', l?.customer_phone], ['Address', l && [l.door_no, l.street, l.area, l.city].filter(Boolean).join(', ')], ['ID Proof', l?.id_proof_type]].map(([k, v]) => (
              <p key={k} className="grid grid-cols-[90px_1fr]"><span className="text-ink-500">{k}</span><span className="font-semibold">{v || ''}</span></p>
            ))}
          </div>
          {l && <Button size="sm" variant="outline" className="self-start" onClick={() => setLedger(true)}>Customer ledger</Button>}
          <div className="grid min-h-56 flex-1 place-items-center overflow-hidden rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
            {l?.item_photo ? <img src={l.item_photo} alt="" className="size-full object-cover" /> : <span className="text-2xl font-bold text-ink-300">Image not available</span>}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Loan" className="[&>header]:hidden">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-3xl font-extrabold text-navy-900 dark:text-white">Loan #{l?.bill_no || ''}</p>
              {l && <span className="text-sm text-ink-600">{[l.manual_bill_no && `Bill Book ${l.manual_bill_no}`, l.loan_on].filter(Boolean).join(' · ')}</span>}
              {l && <span className="ml-auto">{l.bank_pledge_id ? <Chip tone="violet">At bank</Chip> : <Chip tone="green">In hand</Chip>}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['Pledge date', l ? date(l.loan_date) : '-'], ['Loan amount', c ? amount(c.principalOutstanding) : '-'], ['Rate / month', l ? `${c?.rateType === 'MONTHLY' ? c.rate : round2(c?.rate / 12)}% · ${amount(monthly)}` : '-']].map(([k, v]) => (
                <div key={k} className="rounded-md border border-ink-200 bg-cream-50 px-3 py-2"><p className="label">{k}</p><p className="num font-bold text-navy-900">{v}</p></div>
              ))}
            </div>
            <p className="label mt-4">Interest months {c && <span className="ml-2 normal-case">Total {c.monthsDue} · Paid {paidMonths} · Due {dueMonths}</span>}</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {strip.map((st, i) => (
                <div key={i} className={clsx('rounded py-1 text-center text-xs font-bold leading-tight', cell[st])}>{i + 1}
                  {l && <span className="block text-[10px] font-medium opacity-80">{dayjs(l.loan_date).add(i, 'month').format('MMM')}</span>}</div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-600">
              {[['adv', 'Advance'], ['paid', 'Paid'], ['now', 'Paying now'], ['due', 'Due'], ['not', 'Not yet']].map(([k, t]) => <span key={k} className="flex items-center gap-1"><span className={clsx('size-3 rounded', cell[k])} />{t}</span>)}
            </div>
            {c && <p className="mt-2 text-xs text-ink-500">Running {c.elapsedDays} days · interest due {money(c.interestDue)} · {l.interest_type === 'COMPOUND' ? 'compound' : 'flat'} interest</p>}
            {c && (() => { const paidP = round2(n(l.principal) + topupsAmt - c.principalOutstanding); const pct = Math.min(100, (paidP / Math.max(1, n(l.principal) + topupsAmt)) * 100); return (
              <div className="mt-4">
                <div className="flex justify-between text-sm"><span className="font-semibold text-emerald-700">PRINCIPAL &nbsp; Paid {money(paidP)}</span><span className="font-semibold text-rose-600">Outstanding {money(c.principalOutstanding)}</span></div>
                <div className="mt-1 h-3 rounded bg-navy-100 dark:bg-ink-700"><div className="h-3 rounded bg-emerald-600" style={{ width: `${pct}%` }} /></div>
              </div>); })()}
          </Panel>
          <Panel title="Payment history" bodyClassName="p-0"><PaymentsGrid transactions={full?.transactions} /></Panel>
          <Panel title="Pledged items" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr><th className="px-3 py-1.5 text-left">#</th><th className="px-3 text-left">Item</th><th className="px-3 text-right">Pcs</th><th className="px-3 text-right">Gross</th><th className="px-3 text-right">Less</th><th className="px-3 text-right">Net</th><th className="px-3 text-right">Purity</th><th className="px-3 text-left">Remark</th></tr></thead>
              <tbody className="divide-y divide-ink-200">{(full?.items || []).map((i, k) => <tr key={i.id}><td className="px-3 py-1">{k + 1}</td><td className="px-3">{i.item_name}</td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="px-3 text-xs">{i.remarks}</td></tr>)}</tbody>
            </table>
          </Panel>
        </div>

        <Panel title="Receive" bodyClassName="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-cream-100 p-1">
            {[['INTEREST', 'Interest (F2)'], ['PART', 'Part Amount (F3)']].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={clsx('rounded-md py-2.5 font-bold', tab === k ? 'bg-navy-800 text-white' : 'text-navy-800')}>{t}</button>
            ))}
          </div>
          {tab === 'INTEREST' && <>
          <p className="text-center text-xs font-bold text-ink-600 uppercase">Months to pay</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="lg" className="w-16" onClick={() => setMonths((m) => Math.max(0, m - 1))}><Minus /></Button>
            <span className="num w-16 text-center text-4xl font-extrabold text-navy-900">{months}</span>
            <Button variant="outline" size="lg" className="w-16" onClick={() => setMonths((m) => m + 1)}><Plus /></Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setMonths(1)}>1 month</Button>
            <Button variant="outline" onClick={() => setMonths(3)}>3 months</Button>
            <Button variant="outline" onClick={() => setMonths(dueMonths)}>All due ({dueMonths})</Button>
          </div>
          <div className="rounded-md bg-cream-100 p-3 dark:bg-ink-800">
            <Line label="Interest / month" value={amount(monthly)} />
            <Line label="Months" value={months} />
            <Line label="Paid up to (after save)" value={paidUpTo ? date(paidUpTo) : '-'} />
            <Line bold label="Total" value={amount(total)} />
          </div>
          </>}
          {tab === 'PART' && <>
            <Field label="Amount received"><Input type="number" autoFocus className="h-14 bg-gold-50 text-right text-2xl font-bold" value={partAmt} onChange={(e) => setPartAmt(e.target.value)} /></Field>
            <div className="rounded-md bg-cream-100 p-3 dark:bg-ink-800">
              <Line label="Outstanding now" value={c ? money(c.principalOutstanding) : '-'} />
              <Line label="Paying" value={`− ${money(partAmt)}`} />
              <Line bold label="New outstanding" value={c ? money(Math.max(0, c.principalOutstanding - n(partAmt))) : '-'} />
            </div>
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{settings?.PART_PAYMENT_REDUCES_INTEREST === '0' ? 'Interest is calculated on the original loan amount (as per current system).' : 'Interest from today is calculated on the new outstanding amount.'}</p>
            {c?.interestDue > 0 && <p className="text-xs text-amber-700">Interest due {money(c.interestDue)} - collect it in the Interest (F2) tab.</p>}
          </>}
          <p className="num text-center text-3xl font-extrabold text-navy-900">{money(total)}</p>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <Field label="Payment mode"><Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })} options={MODES.map(([v, t]) => ({ value: v, label: t }))} /></Field>
            <Field label="Amount"><Input type="number" placeholder={String(balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Reference / UTR"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <Button onClick={addLine}>Add</Button>
          </div>
          {pay.mode !== 'CASH' && <Select value={pay.bank_account_id} onChange={(e) => setPay({ ...pay, bank_account_id: e.target.value })} placeholder="Bank account" options={banks} />}
          <div className="overflow-hidden rounded-md border border-ink-300">
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="px-3 py-1.5 text-left">Mode</th><th className="px-3 text-right">Amount</th><th className="px-3 text-left">Reference</th><th /></tr></thead>
              <tbody>{lines.map((x, i) => <tr key={i}><td className="px-3 py-1">{x.mode}</td><td className="num px-3 text-right">{amount(x.amount)}</td><td className="px-3">{x.reference}</td><td><button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="size-4 text-rose-500" /></button></td></tr>)}
                {!lines.length && <tr><td colSpan={4} className="px-3 py-2 text-xs text-ink-400">No lines - full amount taken as cash</td></tr>}</tbody></table>
          </div>
          <div className="flex items-center justify-between text-sm font-bold"><span>Balance</span><span className={clsx('num', lines.length && balance !== 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(lines.length ? balance : 0)} {(!lines.length || balance === 0) && '✓'}</span></div>
          <Button size="lg" variant="outline" className="h-12 w-full text-base" icon={Printer} loading={saving} onClick={() => save(true)}>Save &amp; Print Receipt (F10)</Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" icon={RefreshCw} onClick={() => { setSp({}); setQ(''); }}>Refresh (F5)</Button>
            <Button variant="outline" icon={Save} loading={saving} onClick={() => save(false)}>Save only</Button>
            <Button variant="outline" icon={X} onClick={() => navigate('/')}>Close (Esc)</Button>
          </div>
        </Panel>
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = load · F2 Interest · F3 Part amount · + / − months · F4 Add payment · F5 Refresh · F10 Save · Esc Close</p>
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {approval.ui}
      {printerUi}
    </div>
  );
}
