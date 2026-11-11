import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowLeft, HandCoins, ScanLine, Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Unlock, History, Printer, Ban, Pencil, Undo2, Phone, Landmark, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  Badge, Button, ConfirmDrawer, Empty, Field, Input, Select, Spinner, StatusBadge, Tabs, Textarea, Checkbox,
} from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { money, date, grams, n, round2, today } from '@/lib/format';
import { EditLoanDrawer } from './EditLoanDrawer';
import { Panel } from './desk';
import { ImagePreview } from '@/components/common/ImagePreview';

function LoanFinder({ onFound }) {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState(null);
  const find = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await api.get('/loans/find', { q: q.trim() });
      if (r.data.length === 1) { onFound(r.data[0].id); setQ(''); setMatches(null); } else if (!r.data.length) toast.error('No loan found'); else setMatches(r.data);
    } catch (err) { toast.error(err.message); }
  };
  return (
    <form onSubmit={find} className="relative w-full sm:w-80">
      <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400" />
      <input className="input !h-8 bg-white pl-8 text-[13px] font-semibold text-ink-900" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan barcode / loan no + Enter" autoFocus />
      {matches && (
        <div className="absolute right-0 z-30 mt-1 w-full rounded-md border border-ink-200 bg-white p-1 text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-white">
          {matches.map((m) => (
            <button key={m.id} type="button" onClick={() => { onFound(m.id); setMatches(null); setQ(''); }} className="flex w-full items-center justify-between rounded-lg p-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
              <span>#{m.bill_no} · {m.customer_name} · {date(m.loan_date)}</span><StatusBadge status={m.status} />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

/* history: readable name + colour per entry type */
const TXN_KIND = {
  DISBURSE: ['New loan', 'bg-slate-500'], INTEREST: ['Interest', 'bg-emerald-500'], PART_PAYMENT: ['Part payment', 'bg-amber-500'],
  TOPUP: ['Top-up', 'bg-violet-500'], RELEASE: ['Release', 'bg-sky-500'], RENEWAL: ['Renewal', 'bg-indigo-500'], AUCTION: ['Auction', 'bg-rose-500'],
};

/** Shared action form: date + amounts + payment split + submit. */
function ActionForm({ full, kind, onDone }) {
  const qc = useQueryClient();
  const c = full.calc;
  const [d, setD] = useState(today());
  const [v, setV] = useState({});
  const [payments, setPayments] = useState([]);
  const [other, setOther] = useState({ enabled: false });
  const { data: lk } = useLookups();
  const calc = useFetch(d !== today() ? `/loans/${full.loan.id}/calc` : null, { date: d });
  const cc = calc.data || c;
  const postage = full.notices?.reduce((s, x) => s + n(x.postage), 0) || 0;

  useEffect(() => {
    setV({
      interest: kind === 'INTEREST' ? cc.interestDue : kind === 'PART' ? cc.interestDue : kind === 'RENEW' ? round2(cc.interestDue + cc.penalDue) : cc.interestDue,
      penal: cc.penalDue, discount: 0, charges: kind === 'RELEASE' ? postage : 0, principal: '', amount: '',
      new_principal: cc.principalOutstanding, scheme_id: full.loan.scheme_id, add_interest: false,
    });
    setPayments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, cc.interestDue, cc.principalOutstanding]);
  const s = (patch) => setV((x) => ({ ...x, ...patch }));

  const totals = useMemo(() => {
    switch (kind) {
      case 'INTEREST': return round2(n(v.interest) + n(v.penal) + n(v.charges) - n(v.discount));
      case 'PART': return round2(n(v.principal) + n(v.interest) - n(v.discount));
      case 'TOPUP': return round2(n(v.amount) - n(v.interest) - n(v.charges));
      case 'RELEASE': return round2(cc.principalOutstanding + n(v.interest) + n(v.penal) + n(v.charges) - n(v.discount));
      case 'RENEW': {
        const np = v.add_interest ? round2(cc.principalOutstanding + n(v.interest) - n(v.discount)) : n(v.new_principal);
        return round2(np - cc.principalOutstanding - n(v.interest) + n(v.discount));
      }
      default: return 0;
    }
  }, [kind, v, cc]);

  const submit = useMutation({
    mutationFn: () => {
      const id = full.loan.id;
      const base = { date: d, payments, remarks: v.remarks };
      if (kind === 'INTEREST') return api.post(`/loans/${id}/interest`, { ...base, interest_amount: v.interest, penal_amount: v.penal, charges: v.charges, discount: v.discount });
      if (kind === 'PART') return api.post(`/loans/${id}/part-payment`, { ...base, principal_amount: v.principal, interest_amount: v.interest, discount: v.discount });
      if (kind === 'TOPUP') return api.post(`/loans/${id}/topup`, { ...base, amount: v.amount, interest_amount: v.interest, charges: v.charges });
      if (kind === 'RELEASE') return api.post(`/loans/${id}/release`, { ...base, interest_amount: v.interest, penal_amount: v.penal, charges: v.charges, discount: v.discount, released_by_other: other.enabled ? other : null });
      return api.post(`/loans/${id}/renew`, { ...base, interest_amount: v.interest, discount: v.discount, add_interest: v.add_interest, new_principal: v.add_interest ? undefined : v.new_principal, scheme_id: v.scheme_id });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['/loans'] });
      qc.invalidateQueries({ queryKey: ['/dashboard'] });
      toast.success(kind === 'RENEW' ? `Renewed as loan #${r.data.loan.bill_no}` : 'Saved');
      onDone(r.data, kind);
    },
    onError: (e) => toast.error(e.message),
  });

  const label = { INTEREST: 'Receive interest', PART: 'Receive part payment', TOPUP: 'Pay top-up', RELEASE: 'Release loan', RENEW: 'Renew loan' }[kind];
  const cashOut = kind === 'TOPUP' || (kind === 'RENEW' && totals > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2.5">
        <Field label="Date"><Input type="date" value={d} max={today()} onChange={(e) => setD(e.target.value)} /></Field>
        {calc.isFetching && <Spinner className="py-2" />}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-ink-200 bg-ink-50/50 px-3 py-2 text-[13px] dark:border-ink-800 dark:bg-ink-800/30">
          <span className="text-ink-500">Days</span><span className="num text-right font-semibold">{cc.elapsedDays} (charged {cc.chargeDays})</span>
          <span className="text-ink-500">Current rate</span><span className="num text-right font-semibold">{cc.rate}% {cc.rateType === 'MONTHLY' ? 'p.m.' : 'p.a.'}</span>
          <span className="text-ink-500">Interest till date</span><span className="num text-right font-semibold">{money(cc.totalInterest)}</span>
          <span className="text-ink-500">Already paid</span><span className="num text-right font-semibold">{money(cc.interestPaid)}</span>
          <span className="text-ink-500">Interest due</span><span className="num text-right font-bold text-rose-600">{money(cc.interestDue)}</span>
          {cc.penalDue > 0 && <><span className="text-ink-500">Penal ({cc.overdueDays} days)</span><span className="num text-right font-bold text-rose-600">{money(cc.penalDue)}</span></>}
        </div>
        {kind === 'PART' && <Field label="Principal paying"><Input type="number" prefix="₹" value={v.principal} onChange={(e) => s({ principal: e.target.value })} /></Field>}
        {kind === 'TOPUP' && <Field label="Top-up amount" hint={`Eligible ${money(full.loan.eligible_amount)} · current ${money(cc.principalOutstanding)} · headroom ${money(n(full.loan.eligible_amount) - cc.principalOutstanding)}`}><Input type="number" prefix="₹" value={v.amount} onChange={(e) => s({ amount: e.target.value })} /></Field>}
        {kind === 'RENEW' && (
          <>
            <Checkbox checked={v.add_interest} onChange={(x) => s({ add_interest: x })} label="Add interest to new loan amount (customer pays nothing now)" />
            {!v.add_interest && <Field label="New loan amount"><Input type="number" prefix="₹" value={v.new_principal} onChange={(e) => s({ new_principal: e.target.value })} /></Field>}
            <Field label="New scheme"><Select value={v.scheme_id} onChange={(e) => s({ scheme_id: e.target.value })} options={(lk?.schemes || []).map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))} /></Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label={kind === 'TOPUP' ? 'Interest deducted' : 'Interest'}><Input type="number" value={v.interest ?? ''} onChange={(e) => s({ interest: e.target.value })} /></Field>
          {['INTEREST', 'RELEASE'].includes(kind) && <Field label="Penal"><Input type="number" value={v.penal ?? ''} onChange={(e) => s({ penal: e.target.value })} /></Field>}
          {['INTEREST', 'RELEASE', 'TOPUP'].includes(kind) && <Field label={kind === 'RELEASE' && postage ? `Charges (notice ₹${postage})` : 'Charges'}><Input type="number" value={v.charges ?? ''} onChange={(e) => s({ charges: e.target.value })} /></Field>}
          {kind !== 'TOPUP' && <Field label="Discount"><Input type="number" value={v.discount ?? ''} onChange={(e) => s({ discount: e.target.value })} /></Field>}
        </div>
        <Field label="Remarks"><Textarea rows={1} value={v.remarks || ''} onChange={(e) => s({ remarks: e.target.value })} /></Field>
        {kind === 'RELEASE' && (
          <div className="rounded-md border border-ink-200 p-3 dark:border-ink-700">
            <Checkbox checked={other.enabled} onChange={(x) => setOther((o) => ({ ...o, enabled: x }))} label="Jewels collected by another person" />
            {other.enabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Name"><Input value={other.name || ''} onChange={(e) => setOther((o) => ({ ...o, name: e.target.value }))} /></Field>
                <Field label="Mobile"><Input value={other.phone || ''} onChange={(e) => setOther((o) => ({ ...o, phone: e.target.value }))} /></Field>
                <Field label="Relation to customer"><Input value={other.relation_name || ''} onChange={(e) => setOther((o) => ({ ...o, relation_name: e.target.value }))} /></Field>
                <Field label="ID proof"><Input value={other.id_proof || ''} onChange={(e) => setOther((o) => ({ ...o, id_proof: e.target.value }))} /></Field>
                <Field label="Address" className="sm:col-span-2"><Input value={other.address || ''} onChange={(e) => setOther((o) => ({ ...o, address: e.target.value }))} /></Field>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2.5">
        <div className={clsx('rounded-md px-4 py-3 text-white', cashOut ? 'bg-emerald-700' : 'bg-ink-900')}>
          <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">{cashOut ? 'Pay to customer' : kind === 'RENEW' && totals < 0 ? 'Collect from customer' : 'Collect from customer'}</p>
          <p className="num mt-0.5 text-3xl font-extrabold">{money(Math.abs(totals))}</p>
          {kind === 'RELEASE' && <p className="mt-2 text-xs opacity-80">Principal {money(cc.principalOutstanding)} + interest {money(v.interest)} + penal {money(v.penal)} + charges {money(v.charges)} − discount {money(v.discount)}</p>}
        </div>
        {Math.abs(totals) > 0 && <PaymentSplit total={Math.abs(totals)} value={payments} onChange={setPayments} direction={cashOut ? 'paid' : 'received'} />}
        <Button variant="gold" size="lg" className="h-11 w-full" loading={submit.isPending} onClick={() => submit.mutate()}>{label}</Button>
      </div>
    </div>
  );
}

export default function LoanCounterPage() {
  const [params, setParams] = useSearchParams();
  const loanId = params.get('loan');
  const navigate = useNavigate();
  // back to wherever the counter was opened from (ledger, pledge book, dashboard…); a fresh tab goes home
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: full, isLoading } = useFetch(loanId ? `/loans/${loanId}` : null);
  const { printLoan, printTxn, busy, printerUi } = usePrinter();
  const [tab, setTab] = useState(params.get('tab') || 'INTEREST');
  useEffect(() => { if (params.get('tab')) setTab(params.get('tab')); }, [params]);
  const [cancel, setCancel] = useState(false);
  const [voidTxn, setVoidTxn] = useState(null);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);

  const tabs = [
    can('loan_interest', 'add') && { value: 'INTEREST', label: 'Interest', icon: Wallet },
    can('loan_part_payment', 'add') && { value: 'PART', label: 'Part payment', icon: ArrowDownCircle },
    can('loan_topup', 'add') && { value: 'TOPUP', label: 'Top-up', icon: ArrowUpCircle },
    can('loan_renewal', 'add') && { value: 'RENEW', label: 'Renew', icon: RefreshCcw },
    can('loan_release', 'add') && { value: 'RELEASE', label: 'Release', icon: Unlock },
    { value: 'HISTORY', label: 'History', icon: History, count: full?.transactions.length },
  ].filter(Boolean);
  useEffect(() => { if (tabs.length && !tabs.some((t) => t.value === tab)) setTab(tabs[0].value); }, [tabs, tab]);

  const refresh = () => qc.invalidateQueries({ queryKey: [`/loans/${loanId}`] });
  const act = async (url, body, msg) => {
    try { await api.post(url, body); toast.success(msg); refresh(); qc.invalidateQueries({ queryKey: ['/loans'] }); } catch (e) { toast.error(e.message); }
  };

  const onDone = (res, kind) => {
    if (kind === 'RENEW') { setParams({ loan: res.loan.id }); printLoan(res); return; }
    refresh();
    const last = res.loan.transactions.filter((t) => !t.is_void).at(-1);
    if (last) printTxn(res.loan, last);
  };

  const l = full?.loan;
  const open = l?.status === 'OPEN';

  return (
    /* fit-screen: on desktop the counter fits the window; the left column and the tab content scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-3 py-2 text-white">
        <button type="button" onClick={goBack} title="Back"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-[12px] font-semibold text-white/85 transition hover:bg-white hover:text-navy-900">
          <ArrowLeft className="size-4" />Back
        </button>
        <HandCoins className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Loan Counter</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">Interest · Part payment · Top-up · Renewal · Release</p>
        </div>
        <LoanFinder onFound={(id) => setParams({ loan: id, tab })} />
      </section>
      {!loanId && (
        <div className="grid flex-1 place-items-center rounded-md border border-dashed border-ink-300 bg-white py-16 dark:border-ink-700 dark:bg-ink-900">
          <Empty icon={ScanLine} title="Scan or enter a loan number" message="Use a barcode scanner on the packet sticker, or type the loan number above and press Enter." />
        </div>
      )}
      {loanId && (isLoading || !full) && <Spinner />}
      {full && (
        <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[340px_1fr]">
          <div className="desk-col">
            <Panel title={`Loan #${l.bill_no}`} actions={<StatusBadge status={l.status} />} bodyClassName="p-3">
              <div className="flex items-stretch gap-3">
                <ImagePreview src={l.customer_photo || l.customer_photo_master} title={l.customer_name}
                  className="h-20 w-16 shrink-0 rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
                  {(l.customer_photo || l.customer_photo_master)
                    ? <img src={l.customer_photo || l.customer_photo_master} alt="" className="size-full object-cover" />
                    : <span className="grid size-full place-items-center text-lg font-bold text-ink-400">{(l.customer_name || '?').slice(0, 2).toUpperCase()}</span>}
                </ImagePreview>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="truncate text-[15px] font-bold text-navy-900 dark:text-white">{l.customer_name}</p>
                  <a href={`tel:${l.customer_phone}`} className="num inline-flex items-center gap-1 text-[13px] text-ink-500"><Phone className="size-3.5" />{l.customer_phone}</a>
                  <p className="mt-0.5 text-[11px] text-ink-400">{l.scheme_code} · {l.loan_on || ''}</p>
                </div>
              </div>
              {l.bank_pledge_id && <Badge tone="violet" className="mt-2"><Landmark className="size-3" /> Pledged in bank</Badge>}
              {l.customer_status === 'BLOCKED' && <Badge tone="red" className="mt-2">Customer blocked</Badge>}
              {open && full.calc.isOverdue && <div className="mt-2 flex items-center gap-2 rounded-md border-l-2 border-rose-600 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="size-4" />Overdue since {date(l.due_date)}</div>}
              <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">{[
                ['Loan date', date(l.loan_date)], ['Due date', date(l.due_date)], ['Loan amount', money(l.principal)], ['Outstanding', money(full.calc.principalOutstanding)],
                ['Scheme', l.scheme_code], ['Rate now', `${full.calc.rate}%`], ['Net weight', grams(l.net_wt)], ['Items', `${l.total_items} (${l.total_pcs} pcs)`],
                ['Interest due', money(full.calc.interestDue)], ['Total payable', money(full.calc.totalPayable)],
              ].map(([k, v], i) => (
                <div key={k} className={clsx('border-b border-ink-100 px-2.5 py-1 dark:border-ink-800', i % 2 === 0 && 'border-r', i >= 8 && 'bg-ink-50/70 dark:bg-ink-800/40')}>
                  <p className="text-[10px] font-semibold tracking-wider text-ink-400 uppercase">{k}</p>
                  <p className={clsx('num truncate text-[13px] font-bold', k === 'Interest due' ? 'text-rose-600' : 'text-navy-900 dark:text-white')}>{v}</p>
                </div>
              ))}</div>
              {full.calc.currentSlabEndsOn && open && (
                <p className="mt-2 rounded-md border-l-2 border-amber-500 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  Current rate {full.calc.rate}% applies till <b>{date(full.calc.currentSlabEndsOn)}</b>{full.calc.nextSlabRate ? `, then ${full.calc.nextSlabRate}%` : ''}. Tell the customer to save interest!
                </p>
              )}
              {(full.parent || full.child) && <p className="mt-2 text-[11px] text-ink-500">{full.parent && <>Renewed from <button type="button" className="font-semibold text-gold-700" onClick={() => setParams({ loan: full.parent.id })}>#{full.parent.bill_no}</button>. </>}{full.child && <>Renewed as <button type="button" className="font-semibold text-gold-700" onClick={() => setParams({ loan: full.child.id })}>#{full.child.bill_no}</button>.</>}</p>}
              <div className="mt-2 grid grid-cols-3 gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
                {can('loan_print', 'print') && <Button size="sm" variant="outline" icon={Printer} loading={busy} onClick={() => printLoan(full)}>Bill</Button>}
                {open && can('loan_edit', 'edit') && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
                {open && can('loan_cancel', 'delete') && <Button size="sm" variant="soft-danger" icon={Ban} onClick={() => { setReason(''); setCancel(true); }}>Cancel</Button>}
              </div>
            </Panel>
            <Panel title={`Jewels · ${full.items.length}`} bodyClassName="flex flex-col p-0">
              <table className="w-full text-[13px]">
                <thead className="bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="px-3 py-1 text-left font-semibold">Item</th><th className="px-3 text-right font-semibold">Net wt</th><th className="px-3 text-right font-semibold">Purity</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {full.items.map((i) => (
                    <tr key={i.id}><td className="px-3 py-1 font-medium uppercase">{i.item_name} {i.pcs > 1 && <span className="text-ink-400">×{i.pcs}</span>}</td><td className="num px-3 text-right">{grams(i.net_wt)}</td><td className="num px-3 text-right text-ink-500">{i.purity}</td></tr>
                  ))}
                </tbody>
              </table>
              <ImagePreview src={l.item_photo} title={`Item photo · Loan #${l.bill_no}`}
                className="m-2 grid min-h-28 flex-1 place-items-center rounded-md border border-dashed border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
                {l.item_photo ? <img src={l.item_photo} alt="Jewels" className="size-full object-contain" /> : <span className="text-[12px] text-ink-400">No item photo</span>}
              </ImagePreview>
            </Panel>
          </div>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
            <Tabs tabs={tabs} value={tab} onChange={setTab} className="shrink-0 px-2" />
            <div className={clsx('min-h-0 flex-1 p-3', tab === 'HISTORY' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto')}>
              {tab === 'HISTORY' ? (
                /* fills the tab; rows scroll, header and total stay */
                <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ink-200 dark:border-ink-800">
                  <table className="w-full min-w-[760px] text-[13px]">
                    <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Date</th><th className="px-3 text-left font-semibold">Receipt</th><th className="px-3 text-left font-semibold">Type</th>
                        <th className="px-3 text-right font-semibold">Principal</th><th className="px-3 text-right font-semibold">Interest</th><th className="px-3 text-right font-semibold">Total</th>
                        <th className="px-3 text-left font-semibold">By</th><th className="w-44 px-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {!full.transactions.length && <tr><td colSpan={8} className="py-8 text-center text-[12px] text-ink-400">No entries yet</td></tr>}
                      {full.transactions.map((t) => {
                        const last = t.id === full.transactions.filter((x) => !x.is_void).at(-1)?.id;
                        return (
                          <tr key={t.id} className={clsx('hover:bg-ink-50 dark:hover:bg-ink-800/50', t.is_void && 'bg-rose-50/40 text-ink-400 dark:bg-rose-950/10')}>
                            <td className="num px-3 py-1.5">{date(t.txn_date)}</td>
                            <td className="num px-3">{t.receipt_no || '-'}</td>
                            <td className="px-3">
                              <span className={clsx('inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap dark:border-ink-700 dark:bg-ink-900', t.is_void ? 'text-ink-400 line-through' : 'text-navy-900 dark:text-white')}>
                                <span className={clsx('size-2 shrink-0 rounded-full', t.is_void ? 'bg-ink-300' : TXN_KIND[t.txn_type]?.[1] || 'bg-ink-400')} />
                                {TXN_KIND[t.txn_type]?.[0] || t.txn_type.replace('_', ' ').toLowerCase()}
                              </span>
                              {!!t.is_void && <span className="ml-1.5 rounded-sm bg-rose-50 px-1 text-[10px] font-bold text-rose-600">VOID</span>}
                            </td>
                            <td className="num px-3 text-right">{money(t.principal_amount)}</td>
                            <td className="num px-3 text-right">{money(t.interest_amount)}</td>
                            <td className="num px-3 text-right font-bold">{money(t.total_amount)}</td>
                            <td className="truncate px-3 text-ink-500">{t.created_by_name}</td>
                            <td className="px-3 py-1">
                              {!t.is_void && (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="outline" icon={Printer} className="h-7 px-2 text-[11px]" title="Print this receipt" onClick={() => printTxn(full, t, { direct: true })}>Print</Button>
                                  {can('loan_cancel', 'delete') && t.txn_type !== 'DISBURSE' && last && (
                                    <Button size="sm" variant="soft-danger" icon={Undo2} className="h-7 px-2 text-[11px]" title="Undo (void) this receipt" onClick={() => { setReason(''); setVoidTxn(t); }}>Undo</Button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                      {(() => { const ok = full.transactions.filter((x) => !x.is_void); const t = (k) => ok.reduce((acc, x) => acc + n(x[k]), 0); return (
                        <tr><td colSpan={3} className="px-3 py-1.5">Total · {ok.length} entr{ok.length === 1 ? 'y' : 'ies'}</td>
                          <td className="num px-3 text-right">{money(t('principal_amount'))}</td><td className="num px-3 text-right">{money(t('interest_amount'))}</td><td className="num px-3 text-right">{money(t('total_amount'))}</td><td colSpan={2} /></tr>
                      ); })()}
                    </tfoot>
                  </table>
                </div>
              ) : open ? <ActionForm key={`${tab}-${l.id}`} full={full} kind={tab} onDone={onDone} /> : (
                <Empty title={`Loan is ${l.status.toLowerCase()}`} message={l.close_date ? `Closed on ${date(l.close_date)}` : l.cancel_reason} />
              )}
            </div>
          </section>
        </div>
      )}
      <ConfirmDrawer open={cancel} onClose={() => setCancel(false)} title="Cancel this loan?" confirmText="Cancel loan"
        onConfirm={() => { act(`/loans/${loanId}/cancel`, { reason }, 'Loan cancelled'); setCancel(false); }}
        message="Cash entries will be reversed. Only loans without receipts can be cancelled.">
        <Field label="Reason" required className="mt-4"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </ConfirmDrawer>
      <ConfirmDrawer open={!!voidTxn} onClose={() => setVoidTxn(null)} title={`Void receipt ${voidTxn?.receipt_no}?`} confirmText="Void receipt"
        onConfirm={() => { act(`/loans/${loanId}/transactions/${voidTxn.id}/void`, { reason }, 'Receipt voided'); setVoidTxn(null); }}
        message="The receipt and its accounting entry will be reversed. A released loan will be re-opened.">
        <Field label="Reason" required className="mt-4"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </ConfirmDrawer>
      {printerUi}
      {full && <EditLoanDrawer open={editing} onClose={() => setEditing(false)} full={full} onSaved={refresh} />}
    </div>
  );
}
