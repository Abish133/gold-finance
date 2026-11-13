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
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, money, date, n, round2, today, weight } from '@/lib/format';
import { whatsappAfterSave } from '@/lib/whatsapp';
import { Panel, Line, useKeys, PaymentsGrid, useLoan, useApproval, CustomerLedgerDrawer, Chip, GoldButton } from './desk';
import { PageActions } from '@/components/common/PageActions';

const numBox = 'num h-9 w-full min-w-0 rounded-md border border-ink-200 bg-white px-2 text-center text-lg font-extrabold text-navy-900 outline-none [appearance:textfield] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const MODES = [['CASH', 'Cash'], ['UPI', 'UPI'], ['BANK', 'Bank / NEFT'], ['CARD', 'Card'], ['CHEQUE', 'Cheque']];

/** Part Payment & Interest (desktop: frmPartPayments) - months strip, months stepper, multi-mode payment. */
export default function PartPaymentPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loanId = sp.get('loan');
  const { full, refresh, error: loadError } = useLoan(loanId);
  const { data: lk } = useLookups();
  const { data: settings } = useFetch('/admin/settings');
  const { printTxn, printerUi } = usePrinter();
  const approval = useApproval();
  const { can, isAllBranches, setBranch, user } = useAuth();
  const canInt = can('loan_interest', 'add');
  const canPart = can('loan_part_payment', 'add');
  const [q, setQ] = useState('');
  // interest is charged by whole months, by days (7, 15 …) or as a typed amount; part amount can go on the same receipt
  const [mode, setMode] = useState('MONTHS');
  const [months, setMonths] = useState(0);
  const [days, setDays] = useState('');
  const [intAmt, setIntAmt] = useState('');
  const [partAmt, setPartAmt] = useState('');
  const [rateText, setRateText] = useState('');
  const [pay, setPay] = useState({ mode: 'CASH', amount: '', reference: '', bank_account_id: '' });
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ledger, setLedger] = useState(false);
  const l = full?.loan;
  const c = full?.calc;

  const reset = () => { setMode('MONTHS'); setMonths(0); setDays(''); setIntAmt(''); setPartAmt(''); setRateText(''); setLines([]); setPay({ mode: 'CASH', amount: '', reference: '', bank_account_id: '' }); };
  useEffect(reset, [loanId]);
  // desktop: opens with all due months ready to pay
  useEffect(() => { if (c) { setMonths(Math.max(0, (c.monthsDue || 0) - (c.monthsPaid || 0))); setRateText(String(round2(c.rateType === 'MONTHLY' ? n(c.rate) : n(c.rate) / 12))); } }, [loanId, !!c]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useFetch(l ? '/loans' : null, { customer_id: l?.customer_id, status: 'OPEN', pageSize: 50 });
  const openCount = others.data?.length || 0;

  const sysMonthly = c?.monthlyInterest || 0;                        // the loan's own interest per month
  const sysPerDay = sysMonthly / 30;
  const minDays = n(settings?.INTEREST_MIN_DAYS);
  const topupsAmt = round2((full?.transactions || []).filter((t) => !t.is_void && t.txn_type === 'TOPUP').reduce((s, t) => s + n(t.principal_amount), 0));
  // rate % per month for this payment: the loan's rate, or typed by the shop (e.g. 1.25 instead of 1.5)
  const loanRate = c ? round2(c.rateType === 'MONTHLY' ? n(c.rate) : n(c.rate) / 12) : 0;
  const rateTyped = rateText !== '' && n(rateText) >= 0 && round2(n(rateText)) !== loanRate;
  const ratePct = rateTyped ? n(rateText) : loanRate;
  const rateBase = c ? (c.mode === 'MYBOOK' ? n(l.principal) + topupsAmt : n(c.principalOutstanding)) : 0;
  const monthly = rateTyped ? Math.round((rateBase * ratePct) / 100) : sysMonthly;
  const perDay = monthly / 30;
  const paidMonths = c?.monthsPaid || 0;
  const dueMonths = Math.max(0, (c?.monthsDue || 0) - paidMonths);
  // interest already paid, as whole months + the days left over (when earlier interest was taken by days)
  // part of a month already paid (earlier interest by days / amount): counted when paying by months, so nothing is charged twice
  const credit = c ? round2(Math.max(0, n(c.interestPaid) - paidMonths * sysMonthly)) : 0;
  // days that part covers: from the last receipt's paid-up date (exact even when a typed rate was used), else by amount
  // exact only when the latest interest receipt was taken by days; otherwise worked out from the amount
  const lastInt = (full?.transactions || []).filter((t) => !t.is_void && n(t.interest_amount) > 0).at(-1);
  const lastUpto = lastInt && n(lastInt.interest_days) > 0 && lastInt.interest_upto ? dayjs(lastInt.interest_upto) : null;
  const monthsEnd = l ? dayjs(l.loan_date).add(paidMonths, 'month') : null;
  const leftDays = credit <= 0 ? 0 : lastUpto && monthsEnd && lastUpto.isAfter(monthsEnd) ? lastUpto.diff(monthsEnd, 'day') : sysPerDay > 0 ? Math.round(credit / sysPerDay) : 0;
  const paidBase = l ? dayjs(l.loan_date).add(paidMonths, 'month').add(leftDays, 'day') : null;
  const dayCount = Math.max(0, Math.floor(n(days)));
  const monthsCredit = mode === 'MONTHS' && months > 0 ? Math.min(credit, round2(months * monthly)) : 0;
  const interest = !canInt ? 0 : mode === 'MONTHS' ? round2(months * monthly - monthsCredit) : mode === 'DAYS' ? Math.round(perDay * dayCount) : round2(Math.max(0, n(intAmt)));
  const part = canPart ? round2(Math.max(0, n(partAmt))) : 0;
  // why this loan cannot take an entry here (closed loan, All Branches selected)
  const loanBranchName = l ? (user?.branches || []).find((b) => String(b.id) === String(l.branch_id))?.name || l.branch_name : '';
  const blocked = !l ? null : l.status !== 'OPEN' ? `This loan is ${String(l.status).toLowerCase()} - nothing can be received on it.` : isAllBranches ? `You are viewing All Branches. Switch to ${loanBranchName || 'the loan\'s branch'} to receive on this loan.` : null;
  const total = round2(interest + part);
  const received = round2(lines.reduce((s, x) => s + n(x.amount), 0));
  const balance = round2(total - received);
  const paidUpTo = !paidBase || (interest <= 0 && !(mode === 'MONTHS' && months > 0)) ? null
    : (mode === 'MONTHS' ? dayjs(l.loan_date).add(paidMonths + months, 'month') : paidBase.add(mode === 'DAYS' ? dayCount : (sysPerDay > 0 ? Math.round(interest / sysPerDay) : 0), 'day')).format('YYYY-MM-DD');
  const daysTooFew = mode === 'DAYS' && dayCount > 0 && minDays > 0 && dayCount < minDays;
  const strip = useMemo(() => Array.from({ length: Math.max(12, paidMonths + months + 1, c?.monthsDue || 0) }, (_, i) => {
    const m = i + 1;
    const advM = l && n(l.advance_interest) && sysMonthly ? Math.round(n(l.advance_interest) / sysMonthly) : 0;
    if (m <= advM) return 'adv';
    if (m <= paidMonths) return 'paid';
    if (m <= paidMonths + months) return 'now';
    if (m <= (c?.monthsDue || 0)) return 'due';
    return 'not';
  }), [paidMonths, months, c, l, sysMonthly]);

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
    if (blocked) return toast.error(blocked);
    if (!l || total <= 0) return toast.error(canInt && canPart ? 'Enter interest (months / days / amount) or a part amount' : canInt ? 'Enter the interest' : 'Enter the part amount');
    if (daysTooFew) return toast.error(`Interest must be charged for at least ${minDays} days`);
    if (c && part >= c.principalOutstanding) return toast.error('Part amount is the full outstanding or more - use Release');
    const payments = lines.length ? lines : [{ mode: 'CASH', amount: total }];
    if (Math.abs(payments.reduce((s, x) => s + n(x.amount), 0) - total) > 0.009) return toast.error('Payment amounts do not match total');
    const how = {
      interest_amount: interest, interest_upto: paidUpTo,
      months_paid: mode === 'MONTHS' && interest > 0 ? months : 0,
      interest_days: mode === 'DAYS' && interest > 0 ? dayCount : undefined,
      interest_rate: mode !== 'AMOUNT' && interest > 0 && rateTyped ? ratePct : undefined,
    };
    setSaving(true);
    try {
      // part amount (with or without interest) = one Part Payment receipt; interest only = Interest receipt
      const r = await approval.run((ap) => (part > 0
        ? api.post(`/loans/${l.id}/part-payment`, { date: today(), principal_amount: part, ...how, payments, approval: ap })
        : api.post(`/loans/${l.id}/interest`, { date: today(), ...how, payments, approval: ap })));
      toast.success(part > 0 && interest > 0 ? 'Interest and part amount saved on one receipt' : 'Saved');
      qc.invalidateQueries({ queryKey: ['/loans'] }); qc.invalidateQueries({ queryKey: ['/dashboard'] });
      refresh(); reset();
      { const lastT = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); whatsappAfterSave(settings, part > 0 ? 'PART' : 'INTEREST', r.data.loan, lastT); }
      if (print && settings?.PRINT_PART_RECEIPT !== '0') { const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); if (last) printTxn(r.data.loan, last); }
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  const MODES_INT = ['MONTHS', 'DAYS', 'AMOUNT'];
  useKeys({
    f2: () => canInt && setMode((m) => MODES_INT[(MODES_INT.indexOf(m) + 1) % MODES_INT.length]), f3: () => document.getElementById('part-amount')?.focus(),
    '+': () => mode === 'MONTHS' && setMonths((m) => m + 1), '-': () => mode === 'MONTHS' && setMonths((m) => Math.max(0, m - 1)),
    f4: addLine, f5: () => { setSp({}); setQ(''); }, f10: () => save(true), escape: () => navigate('/'),
  }, [l, months, mode, days, intAmt, partAmt, rateText, lines, pay, total]);

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
          {loanId && loadError && !l && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[12px] font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              Loan not found in {isAllBranches ? 'your branches' : 'this branch'}. Check the loan no, or switch to the loan's branch.
            </p>
          )}
          {blocked && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[12px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="flex-1">{blocked}</span>
              {l?.status === 'OPEN' && isAllBranches && <Button size="sm" variant="outline" onClick={() => { setBranch(l.branch_id); setSp({ loan: l.id }); }}>Switch to {loanBranchName || 'branch'}</Button>}
            </div>
          )}
          {/* ---------- interest: by months, days or a typed amount, at the loan rate or a typed rate */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">Interest</span>
            {c?.interestDue > 0 && <span className="truncate text-[11px] text-amber-700 dark:text-amber-300">due {money(c.interestDue)}</span>}
            <span className="flex-1" />
            {canInt && <div className="grid shrink-0 grid-cols-3" role="tablist" aria-label="Charge interest by" title="F2 changes">
              {[['MONTHS', 'Months'], ['DAYS', 'Days'], ['AMOUNT', 'Amount']].map(([k, t]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                  className={clsx('-ml-px h-7 border px-2.5 text-[12px] font-bold first:ml-0 first:rounded-l-md last:rounded-r-md',
                    mode === k ? 'relative z-10 border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{t}</button>
              ))}
            </div>}
          </div>
          {!canInt && <p className="rounded-md bg-ink-50 px-2.5 py-1.5 text-[12px] text-ink-500 dark:bg-ink-800">You can take the part amount only - your role cannot receive interest.</p>}
          {canInt && <>
          {/* one row: count (months / days) or amount + rate % per month */}
          <div className={clsx('grid gap-2', mode === 'AMOUNT' ? 'grid-cols-1' : 'grid-cols-[1fr_108px]')}>
            {mode === 'MONTHS' && (
              <div>
                <p className="label">Months</p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setMonths((m) => Math.max(0, m - 1))} aria-label="One month less"><Minus className="size-4" /></Button>
                  <input type="number" min="0" inputMode="numeric" aria-label="Months to pay" value={months}
                    onChange={(e) => setMonths(Math.max(0, Math.floor(Number(e.target.value) || 0)))} onFocus={(e) => e.target.select()}
                    className={numBox} />
                  <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setMonths((m) => m + 1)} aria-label="One month more"><Plus className="size-4" /></Button>
                </div>
              </div>
            )}
            {mode === 'DAYS' && (
              <div>
                <p className="label">Days</p>
                <input type="number" min="0" inputMode="numeric" aria-label="Days to charge" value={days} placeholder="0" autoFocus
                  onChange={(e) => setDays(e.target.value)} onFocus={(e) => e.target.select()} className={numBox} />
              </div>
            )}
            {mode === 'AMOUNT' && (
              <div>
                <p className="label">Interest amount (₹)</p>
                <input type="number" min="0" aria-label="Interest amount" value={intAmt} placeholder="0" autoFocus
                  onChange={(e) => setIntAmt(e.target.value)} onFocus={(e) => e.target.select()} className={clsx(numBox, '!text-right')} />
              </div>
            )}
            {mode !== 'AMOUNT' && (
              <div>
                <p className="label">Rate % / month</p>
                <input type="number" min="0" step="0.01" inputMode="decimal" aria-label="Interest rate percent per month" value={rateText} placeholder={l ? String(loanRate) : '0'}
                  onChange={(e) => setRateText(e.target.value)} onFocus={(e) => e.target.select()}
                  className={clsx(numBox, rateTyped && '!border-amber-400 !bg-amber-50 dark:!bg-amber-950/30')} />
              </div>
            )}
          </div>
          {mode === 'MONTHS' && (
            <div className="grid grid-cols-4 gap-1 [&_button]:h-7 [&_button]:px-1 [&_button]:text-[12px]">
              <Button variant="outline" onClick={() => setMonths(0)}>None</Button>
              <Button variant="outline" onClick={() => setMonths(1)}>1 month</Button>
              <Button variant="outline" onClick={() => setMonths(3)}>3 months</Button>
              <Button variant="outline" onClick={() => setMonths(dueMonths)}>All due ({dueMonths})</Button>
            </div>
          )}
          {mode === 'DAYS' && (
            <div className="grid grid-cols-4 gap-1 [&_button]:h-7 [&_button]:px-1 [&_button]:text-[12px]">
              {[7, 15, 21, 30].map((x) => <Button key={x} variant="outline" disabled={minDays > 0 && x < minDays} onClick={() => setDays(String(x))}>{x} days</Button>)}
            </div>
          )}
          {daysTooFew && <p className="text-[12px] font-semibold text-rose-600">At least {minDays} days must be charged.</p>}
          {rateTyped && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              <span>Rate {ratePct}% for this payment only (loan rate {loanRate}%).</span>
              <button type="button" className="font-bold underline" onClick={() => setRateText('')}>Use loan rate</button>
            </p>
          )}
          <div className="rounded-md border border-ink-200 px-2.5 py-0.5 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[13px]">
            {monthsCredit > 0 && <Line label={`${months} × ₹${amount(monthly)} a month`} value={amount(round2(months * monthly))} tone="text-ink-500" />}
            {monthsCredit > 0 && <Line label={`Less part of a month already paid (${leftDays} days)`} value={`− ${amount(monthsCredit)}`} tone="text-ink-500" />}
            <Line label={monthsCredit > 0 ? 'Interest now' : mode === 'AMOUNT' ? 'Interest' : mode === 'DAYS' ? `${dayCount} days × ₹${amount(perDay)} a day` : `${months} × ₹${amount(monthly)} a month`} value={amount(interest)} bold />
            <Line label="Paid up to (after save)" value={paidUpTo ? date(paidUpTo) : '-'} tone="text-ink-500" />
          </div>
          </>}

          {/* ---------- part amount: optional, on the same receipt */}
          <div className="mt-0.5 grid grid-cols-[1fr_140px] items-center gap-2">
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">Part amount <span className="font-normal normal-case text-ink-400">· F3</span></p>
              <p className="truncate text-[11px] text-ink-500">{!canPart ? 'your role cannot take part amounts' : part > 0 && c ? <>Outstanding {money(c.principalOutstanding)} → <b className="text-navy-900 dark:text-white">{money(Math.max(0, c.principalOutstanding - part))}</b></> : 'optional · same receipt'}</p>
            </div>
            <Input id="part-amount" type="number" min="0" aria-label="Part amount received" disabled={!canPart} className="!h-9 text-right text-[15px] font-bold" value={partAmt} onChange={(e) => setPartAmt(e.target.value)} placeholder="0" />
          </div>
          <div className="navy-gradient rounded-md px-3 py-2 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Total to receive</span>
              <span className="num text-2xl font-extrabold">{money(total)}</span>
            </div>
            {interest > 0 && part > 0 && <p className="num text-right text-[11px] text-white/70">Interest {amount(interest)} + Part amount {amount(part)}</p>}
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-1.5">
            <Field label="Payment mode"><Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })} options={MODES.map(([v, t]) => ({ value: v, label: t }))} /></Field>
            <Field label="Amount"><Input type="number" placeholder={String(balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Reference / UTR"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <Button className="h-9" onClick={addLine}>Add</Button>
          </div>
          {pay.mode !== 'CASH' && (banks.length
            ? <Select value={pay.bank_account_id} onChange={(e) => setPay({ ...pay, bank_account_id: e.target.value })} placeholder="Bank account" aria-label="Bank account" options={banks} />
            : <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">No bank account in this branch. Add one in <b>Bank → Bank Accounts</b> to take {MODES.find(([v]) => v === pay.mode)?.[1]} payments.</p>)}
          <div className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]"><thead className="bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="px-3 py-1 text-left font-semibold">Mode</th><th className="px-3 text-right font-semibold">Amount</th><th className="px-3 text-left font-semibold">Reference</th><th /></tr></thead>
              <tbody>{lines.map((x, i) => <tr key={i}><td className="px-3 py-1">{x.mode}</td><td className="num px-3 text-right">{amount(x.amount)}</td><td className="px-3">{x.reference}</td><td><button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="size-4 text-rose-500" /></button></td></tr>)}
                {!lines.length && <tr><td colSpan={4} className="px-3 py-2 text-xs text-ink-400">No lines - full amount taken as cash</td></tr>}</tbody></table>
          </div>
          <div className="flex items-center justify-between text-[13px] font-bold"><span>Balance</span><span className={clsx('num', lines.length && balance !== 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(lines.length ? balance : 0)} {(!lines.length || balance === 0) && '✓'}</span></div>
          <div className="mt-auto space-y-1.5 pt-1">
            <GoldButton icon={Printer} loading={saving} disabled={!!blocked} onClick={() => save(true)}>Save &amp; Print Receipt (F10)</GoldButton>
            <div className="grid grid-cols-3 gap-1.5 [&_button]:h-8 [&_button]:px-2 [&_button]:text-[12px]">
              <Button variant="outline" icon={RefreshCw} onClick={() => { setSp({}); setQ(''); }}>Refresh (F5)</Button>
              <Button variant="outline" icon={Save} loading={saving} disabled={!!blocked} onClick={() => save(false)}>Save only</Button>
              <Button variant="soft-danger" icon={X} onClick={() => navigate('/')}>Close (Esc)</Button>
            </div>
          </div>
        </Panel>
        </div>
      </div>
      <PageActions keys={`Enter = load · F2 Interest by months / days / amount · F3 Part amount · + / − months · F4 Add payment · F5 Refresh · F10 Save · Esc Close`} />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {approval.ui}
      {printerUi}
    </div>
  );
}
