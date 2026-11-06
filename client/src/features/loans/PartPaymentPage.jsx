import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, RefreshCw, Save, Printer, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Avatar, Button, Field, Input, Select } from '@/components/ui';
import { useLookups } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, money, date, n, round2, today, weight } from '@/lib/format';
import { Panel, Line, useKeys, PaymentsGrid, useLoan, useApproval, CustomerLedgerDrawer } from './desk';

const MODES = [['CASH', 'Cash'], ['UPI', 'UPI'], ['BANK', 'Bank / NEFT'], ['CARD', 'Card'], ['CHEQUE', 'Cheque']];

/** Part Payment & Interest (desktop: frmPartPayments) - months strip, months stepper, multi-mode payment. */
export default function PartPaymentPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loanId = sp.get('loan');
  const { full, refresh } = useLoan(loanId);
  const { data: lk } = useLookups();
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

  const monthly = c?.monthlyInterest || 0;
  const paidMonths = c?.monthsPaid || 0;
  const dueMonths = Math.max(0, (c?.monthsDue || 0) - paidMonths);
  const interest = tab === 'INTEREST' ? round2(months * monthly) : round2(Math.min(c?.interestDue || 0, months * monthly));
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
    if (!l || total <= 0) return toast.error('Choose months or part amount');
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
      if (print) { const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); if (last) printTxn(r.data.loan, last); }
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({
    f2: () => setTab('INTEREST'), f3: () => setTab('PART'), '+': () => setMonths((m) => m + 1), '-': () => setMonths((m) => Math.max(0, m - 1)),
    f4: addLine, f5: () => { setSp({}); setQ(''); }, f10: () => save(true), escape: () => navigate('/'),
  }, [l, months, tab, partAmt, lines, pay, total]);

  const banks = (lk?.banks || []).map((b) => ({ value: b.id, label: b.bank_name }));
  const cell = { adv: 'bg-violet-200 text-violet-900', paid: 'bg-emerald-200 text-emerald-900', now: 'bg-gold-400 text-navy-950', due: 'bg-rose-100 text-rose-800', not: 'bg-ink-100 text-ink-400' };

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
        <Panel title="Customer">
          <div className="flex gap-3">
            <Avatar src={l?.customer_photo || l?.customer_photo_master} name={l?.customer_name || '?'} size="xl" />
            <div className="text-sm"><p className="font-bold text-navy-900">{l?.customer_name || '-'}</p><p>A/c No {l?.customer_no || '-'}</p><p>{l?.customer_phone || ''}</p></div>
          </div>
          <p className="mt-2 text-xs text-ink-600">{l && [l.door_no, l.street, l.area, l.city].filter(Boolean).join(', ')}</p>
          {l && <Button size="sm" variant="outline" className="mt-3" onClick={() => setLedger(true)}>Customer ledger</Button>}
          <div className="mt-3 grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-ink-200 bg-ink-50">
            {l?.item_photo ? <img src={l.item_photo} alt="" className="size-full object-cover" /> : <span className="text-sm text-ink-400">Image not available</span>}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title={`Loan #${l?.bill_no || ''}`}>
            <div className="grid grid-cols-3 gap-2">
              {[['Pledge date', l ? date(l.loan_date) : '-'], ['Loan amount', c ? amount(c.principalOutstanding) : '-'], ['Rate / month', l ? `${c?.rateType === 'MONTHLY' ? c.rate : round2(c?.rate / 12)}% · ${amount(monthly)}` : '-']].map(([k, v]) => (
                <div key={k} className="rounded-md border border-ink-200 bg-cream-50 px-3 py-2"><p className="label">{k}</p><p className="num font-bold text-navy-900">{v}</p></div>
              ))}
            </div>
            <p className="label mt-4">Interest months</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {strip.map((st, i) => <div key={i} className={clsx('rounded py-1.5 text-center text-xs font-bold', cell[st])}>{i + 1}</div>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-600">
              {[['adv', 'Advance'], ['paid', 'Paid'], ['now', 'Paying now'], ['due', 'Due'], ['not', 'Not yet']].map(([k, t]) => <span key={k} className="flex items-center gap-1"><span className={clsx('size-3 rounded', cell[k])} />{t}</span>)}
            </div>
            {c && <p className="mt-2 text-xs text-ink-500">Running {c.elapsedDays} days · interest due {money(c.interestDue)} · {l.interest_type === 'COMPOUND' ? 'compound' : 'simple'} interest</p>}
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
          {tab === 'PART' && <Field label="Part amount (principal)"><Input type="number" className="h-11 text-lg font-bold" value={partAmt} onChange={(e) => setPartAmt(e.target.value)} /></Field>}
          <div className="rounded-md bg-cream-100 p-3">
            <Line label="Interest / month" value={amount(monthly)} />
            <Line label="Months" value={months} />
            <Line label="Paid up to (after save)" value={paidUpTo ? date(paidUpTo) : '-'} />
            {tab === 'PART' && <Line label="Part amount" value={amount(partAmt)} />}
            <Line bold label="Total" value={amount(total)} />
          </div>
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
