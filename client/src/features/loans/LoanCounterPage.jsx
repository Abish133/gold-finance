import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { HandCoins, ScanLine, Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Unlock, History, Printer, Ban, Pencil, Undo2, Phone, Landmark, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  Avatar, Badge, Button, Card, ConfirmDrawer, DataTable, Empty, Field, Input, KeyValue, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea, Checkbox,
} from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { money, date, grams, n, round2, today } from '@/lib/format';
import { EditLoanDrawer } from './EditLoanDrawer';

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
    <form onSubmit={find} className="relative w-full sm:w-96">
      <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gold-600" />
      <input className="input h-12 pl-10 text-base font-semibold" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan barcode / enter loan no + Enter" autoFocus />
      {matches && (
        <div className="card absolute z-20 mt-1 w-full p-1">
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Date"><Input type="date" value={d} max={today()} onChange={(e) => setD(e.target.value)} /></Field>
        {calc.isFetching && <Spinner className="py-2" />}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-ink-50 p-4 text-sm dark:bg-ink-800/50">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'TOPUP' ? 'Interest deducted' : 'Interest'}><Input type="number" value={v.interest ?? ''} onChange={(e) => s({ interest: e.target.value })} /></Field>
          {['INTEREST', 'RELEASE'].includes(kind) && <Field label="Penal"><Input type="number" value={v.penal ?? ''} onChange={(e) => s({ penal: e.target.value })} /></Field>}
          {['INTEREST', 'RELEASE', 'TOPUP'].includes(kind) && <Field label={kind === 'RELEASE' && postage ? `Charges (notice ₹${postage})` : 'Charges'}><Input type="number" value={v.charges ?? ''} onChange={(e) => s({ charges: e.target.value })} /></Field>}
          {kind !== 'TOPUP' && <Field label="Discount"><Input type="number" value={v.discount ?? ''} onChange={(e) => s({ discount: e.target.value })} /></Field>}
        </div>
        <Field label="Remarks"><Textarea rows={2} value={v.remarks || ''} onChange={(e) => s({ remarks: e.target.value })} /></Field>
        {kind === 'RELEASE' && (
          <div className="rounded-2xl border border-ink-200 p-4 dark:border-ink-700">
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
      <div className="space-y-4">
        <div className={clsx('rounded-2xl p-5 text-white', cashOut ? 'bg-emerald-700' : 'bg-ink-900')}>
          <p className="text-sm opacity-80">{cashOut ? 'Pay to customer' : kind === 'RENEW' && totals < 0 ? 'Collect from customer' : 'Collect from customer'}</p>
          <p className="num mt-1 text-4xl font-extrabold">{money(Math.abs(totals))}</p>
          {kind === 'RELEASE' && <p className="mt-2 text-xs opacity-80">Principal {money(cc.principalOutstanding)} + interest {money(v.interest)} + penal {money(v.penal)} + charges {money(v.charges)} − discount {money(v.discount)}</p>}
        </div>
        {Math.abs(totals) > 0 && <PaymentSplit total={Math.abs(totals)} value={payments} onChange={setPayments} direction={cashOut ? 'paid' : 'received'} />}
        <Button variant="gold" size="lg" className="w-full" loading={submit.isPending} onClick={() => submit.mutate()}>{label}</Button>
      </div>
    </div>
  );
}

export default function LoanCounterPage() {
  const [params, setParams] = useSearchParams();
  const loanId = params.get('loan');
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: full, isLoading } = useFetch(loanId ? `/loans/${loanId}` : null);
  const { printLoan, printTxn, busy, printerUi } = usePrinter();
  const [tab, setTab] = useState('INTEREST');
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
    <div className="animate-rise">
      <PageHeader icon={HandCoins} title="Loan Counter" subtitle="Interest · Part payment · Top-up · Renewal · Release" actions={<LoanFinder onFound={(id) => setParams({ loan: id })} />} />
      {!loanId && <Card><Empty icon={ScanLine} title="Scan or enter a loan number" message="Use a barcode scanner on the packet sticker, or type the loan number and press Enter." /></Card>}
      {loanId && (isLoading || !full) && <Spinner />}
      {full && (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <div className="flex items-start gap-4">
                <Avatar src={l.customer_photo || l.customer_photo_master} name={l.customer_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-lg font-bold">#{l.bill_no}</p><StatusBadge status={l.status} /></div>
                  <p className="truncate font-semibold">{l.customer_name}</p>
                  <a href={`tel:${l.customer_phone}`} className="inline-flex items-center gap-1 text-sm text-ink-500"><Phone className="size-3.5" />{l.customer_phone}</a>
                </div>
              </div>
              {l.bank_pledge_id && <Badge tone="violet" className="mt-3"><Landmark className="size-3" /> Pledged in bank</Badge>}
              {l.customer_status === 'BLOCKED' && <Badge tone="red" className="mt-3">Customer blocked</Badge>}
              {open && full.calc.isOverdue && <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="size-4" />Overdue since {date(l.due_date)}</div>}
              <div className="mt-4"><KeyValue items={[
                ['Loan date', date(l.loan_date)], ['Due date', date(l.due_date)], ['Loan amount', money(l.principal)], ['Outstanding', money(full.calc.principalOutstanding)],
                ['Scheme', l.scheme_code], ['Rate now', `${full.calc.rate}%`], ['Net weight', grams(l.net_wt)], ['Items', `${l.total_items} (${l.total_pcs} pcs)`],
                ['Interest due', money(full.calc.interestDue)], ['Total payable', money(full.calc.totalPayable)],
              ]} /></div>
              {full.calc.currentSlabEndsOn && open && (
                <p className="mt-4 rounded-xl bg-gold-50 p-3 text-xs text-gold-800 dark:bg-gold-500/10 dark:text-gold-300">
                  Current rate {full.calc.rate}% applies till <b>{date(full.calc.currentSlabEndsOn)}</b>{full.calc.nextSlabRate ? `, then ${full.calc.nextSlabRate}%` : ''}. Tell the customer to save interest!
                </p>
              )}
              {(full.parent || full.child) && <p className="mt-3 text-xs text-ink-500">{full.parent && <>Renewed from <button type="button" className="font-semibold text-gold-700" onClick={() => setParams({ loan: full.parent.id })}>#{full.parent.bill_no}</button>. </>}{full.child && <>Renewed as <button type="button" className="font-semibold text-gold-700" onClick={() => setParams({ loan: full.child.id })}>#{full.child.bill_no}</button>.</>}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {can('loan_print', 'print') && <Button size="sm" variant="outline" icon={Printer} loading={busy} onClick={() => printLoan(full)}>Bill</Button>}
                {open && can('loan_edit', 'edit') && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
                {open && can('loan_cancel', 'delete') && <Button size="sm" variant="outline" icon={Ban} onClick={() => { setReason(''); setCancel(true); }}>Cancel</Button>}
              </div>
            </Card>
            <Card title="Jewels" bodyClassName="p-0">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {full.items.map((i) => (
                    <tr key={i.id}><td className="px-5 py-2 font-medium">{i.item_name} {i.pcs > 1 && <span className="text-ink-400">×{i.pcs}</span>}</td><td className="num px-5 py-2 text-right">{grams(i.net_wt)}</td><td className="px-5 py-2 text-right text-xs text-ink-400">{i.purity}</td></tr>
                  ))}
                </tbody>
              </table>
              {l.item_photo && <img src={l.item_photo} alt="Jewels" className="aspect-[4/3] w-full rounded-b-2xl object-cover" />}
            </Card>
          </div>
          <Card bodyClassName="p-0">
            <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-3" />
            <div className="p-5">
              {tab === 'HISTORY' ? (
                <DataTable dense columns={[
                  { key: 'txn_date', label: 'Date', type: 'date' },
                  { key: 'receipt_no', label: 'Receipt' },
                  { key: 'txn_type', label: 'Type', render: (t) => <span className={clsx(t.is_void && 'line-through opacity-60')}>{t.txn_type.replace('_', ' ')}</span> },
                  { key: 'principal_amount', label: 'Principal', type: 'money' },
                  { key: 'interest_amount', label: 'Interest', type: 'money' },
                  { key: 'total_amount', label: 'Total', type: 'money' },
                  { key: 'created_by_name', label: 'By' },
                  { key: 'a', label: '', align: 'right', render: (t) => !t.is_void && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => printTxn(full, t)}><Printer className="size-4" /></Button>
                      {can('loan_cancel', 'delete') && t.txn_type !== 'DISBURSE' && t.id === full.transactions.filter((x) => !x.is_void).at(-1)?.id && (
                        <Button size="icon" variant="ghost" onClick={() => { setReason(''); setVoidTxn(t); }}><Undo2 className="size-4 text-rose-500" /></Button>
                      )}
                    </div>
                  ) },
                ]} rows={full.transactions} />
              ) : open ? <ActionForm key={`${tab}-${l.id}`} full={full} kind={tab} onDone={onDone} /> : (
                <Empty title={`Loan is ${l.status.toLowerCase()}`} message={l.close_date ? `Closed on ${date(l.close_date)}` : l.cancel_reason} />
              )}
            </div>
          </Card>
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
