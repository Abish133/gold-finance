import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Printer, Tag, CheckCircle2, AlertTriangle, UserPlus, ListChecks, FileText } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer, ConfirmDrawer, Field, Input, Select, Spinner, Avatar, Badge, DataTable } from '@/components/ui';
import { LoanEstimate } from '@/features/print/LoanEstimate';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { CustomerFormDrawer } from '@/features/customers/CustomerFormDrawer';
import { useLookups, useSettings, useFetch, useList } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { printElement } from '@/lib/print';
import { Stickers } from '@/features/print/Sticker';
import { api } from '@/lib/api';
import { money, amount, n, round2, today, weight, date } from '@/lib/format';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, ItemPhotoPanel, ItemEntry, ItemsTable, LtvBar, CustomerCard, CustomerLedgerDrawer, computeItem } from './desk';

const parseSlabs = (s) => (typeof s === 'string' ? JSON.parse(s) : s) || [];

/* customer search with Mobile / Name / A-c No / Loan No tabs */
function CustomerSearch({ value, onChange, onNew }) {
  const [by, setBy] = useState('name');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const list = useList('/customers', { search: dq, pageSize: 8 }, { enabled: !value && dq.length >= 1 && by !== 'loan' });
  const summary = useFetch(value ? `/customers/${value.id}/summary` : null);
  const [ledger, setLedger] = useState(false);
  const findByLoan = async () => {
    try {
      const r = await api.get('/loans/find', { q });
      if (!r.data.length) return toast.error('No loan found');
      const l = (await api.get(`/loans/${r.data[0].id}`)).data.loan;
      onChange((await api.get(`/customers/${l.customer_id}`)).data);
    } catch (e) { toast.error(e.message); }
  };
  useKeys({ f5: () => value && setLedger(true) }, [value]);
  const t = summary.data?.totals;
  const last = summary.data?.loans?.[0];
  return (
    <Panel title="Customer" actions={<button type="button" onClick={onNew} className="text-xs font-semibold normal-case hover:underline">F1 New</button>}>
      {!value ? (
        <>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {[['mobile', 'Mobile'], ['name', 'Name'], ['acno', 'A/c No'], ['loan', 'Loan No']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setBy(k)} className={clsx('rounded-md border px-1 py-1.5 text-xs font-semibold', by === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 text-ink-600')}>{l}</button>
            ))}
          </div>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && by === 'loan') findByLoan(); if (e.key === 'Enter' && list.data?.data?.length === 1) onChange(list.data.data[0]); }}
            className="h-11 bg-gold-50 font-semibold" placeholder={by === 'loan' ? 'Loan no + Enter' : 'Type to search'} />
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {(list.data?.data || []).map((c) => (
              <button key={c.id} type="button" onClick={() => onChange(c)} className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-navy-50">
                <Avatar src={c.photo} name={c.name} size="sm" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.name} <span className="text-xs text-ink-400">#{c.customer_no}</span></span><span className="text-xs text-ink-500">{c.phone} · {c.area || '-'}</span></span>
                {c.status === 'BLOCKED' && <Badge tone="red">Blocked</Badge>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <CustomerCard customer={value} onLedger={() => setLedger(true)} extra={(
          <div className="mt-3 border-t border-ink-200 pt-2">
            <Line label="Open loans" value={t?.open_loans ?? '-'} />
            <Line label="Outstanding" value={t ? amount(t.outstanding) : '-'} />
            <Line label="Last loan" value={last ? `#${last.bill_no} · ${date(last.loan_date)}` : '-'} />
            <button type="button" onClick={() => onChange(null)} className="mt-1 text-xs font-semibold text-navy-700 hover:underline">Change customer</button>
          </div>
        )} />
      )}
      <CustomerLedgerDrawer customerId={ledger ? value?.id : null} onClose={() => setLedger(false)} />
    </Panel>
  );
}

/* Mark old loans (Ctrl+M) */
function MarkOldDrawer({ open, onClose }) {
  const list = useList('/loans', { status: 'OPEN', entry_type: 'NEW', pageSize: 200 }, { enabled: open });
  const [sel, setSel] = useState([]);
  const qc = useQueryClient();
  const run = async () => {
    try { const r = await api.post('/loans/mark-old', { ids: sel }); toast.success(`${r.data.marked.length} loans marked as old (opening)`); setSel([]); qc.invalidateQueries({ queryKey: ['/loans'] }); onClose(); } catch (e) { toast.error(e.message); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={ListChecks} title="Mark old loans" subtitle="Turn loans typed as NEW into opening entries - removes them from today's cash. Only loans without receipts."
      footer={<Button variant="gold" disabled={!sel.length} onClick={run}>Mark {sel.length || ''} as old</Button>}>
      <DataTable dense selectable selected={sel} onSelect={setSel} rows={list.data?.data} loading={list.isLoading} columns={[
        { key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'principal', label: 'Amount', type: 'money' },
      ]} />
    </Drawer>
  );
}

export default function NewLoanPage({ mode = 'NEW' }) {
  const isOld = mode === 'OLD';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { isAllBranches } = useAuth();
  const { data: lk, isLoading } = useLookups();
  const { data: settings } = useSettings();
  const next = useFetch(isAllBranches ? null : '/loans/next-number');
  const { printLoan, busy, company, printerUi } = usePrinter();

  const [customer, setCustomer] = useState(null);
  const [loanOn, setLoanOn] = useState('GOLD');
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [schemeId, setSchemeId] = useState('');
  const [f, setF] = useState({ principal: '', interest_rate: '', interest_type: '', doc_charges: '0', advance: true, other_charges: '', loan_date: today(), due_date: '', manual_bill_no: '', remarks: '', loan_no: '', gold_rate: '', silver_rate: '' });
  const [photo, setPhoto] = useState(null);
  const [payments, setPayments] = useState([]);
  const [done, setDone] = useState(null);
  const [newCust, setNewCust] = useState(false);
  const [markOld, setMarkOld] = useState(false);
  const [ltvAsk, setLtvAsk] = useState(false);
  const set = (p) => setF((s) => ({ ...s, ...p }));
  // default for the advance interest switch (Settings > Loan)
  useEffect(() => { if (settings?.DEFAULT_ADVANCE_INTEREST != null) set({ advance: settings.DEFAULT_ADVANCE_INTEREST !== '0' }); }, [settings?.DEFAULT_ADVANCE_INTEREST]);
  // customer already has old open loans (Settings > OLD_LOAN_WARN_MONTHS)
  const custLoans = useFetch(customer && !isOld ? '/loans' : null, { customer_id: customer?.id, status: 'OPEN', pageSize: 50 });
  const warnMonths = n(settings?.OLD_LOAN_WARN_MONTHS) || 12;
  const oldOpen = (custLoans.data?.data || []).filter((l) => dayjs().diff(dayjs(l.loan_date), 'month') >= warnMonths);

  useEffect(() => { const id = params.get('customer'); if (id) api.get(`/customers/${id}`).then((r) => setCustomer(r.data)).catch(() => {}); }, [params]);

  const metals = lk?.metals || [];
  const goldM = metals.find((m) => m.code === 'GOLD');
  const silverM = metals.find((m) => m.code === 'SILVER');
  const rateOf = (m) => lk?.rates.find((r) => r.metal_id === m?.id);
  const todayGold = rateOf(goldM);
  const todaySilver = rateOf(silverM);
  const rateMissing = !isOld && [loanOn !== 'SILVER' && todayGold, loanOn !== 'GOLD' && todaySilver].some((r) => r === undefined || (r && !dayjs(r.rate_date).isSame(dayjs(), 'day')));
  const rates = { gold: isOld ? f.gold_rate : todayGold?.loan_rate, silver: isOld ? f.silver_rate : todaySilver?.loan_rate };

  const schemes = (lk?.schemes || []).filter((s) => loanOn === 'MIX' || !s.metal_id || s.metal_id === (loanOn === 'SILVER' ? silverM?.id : goldM?.id));
  const scheme = schemes.find((s) => String(s.id) === String(schemeId)) || schemes[0];
  useEffect(() => {
    if (!scheme) return;
    setSchemeId(String(scheme.id));
    set({ interest_rate: parseSlabs(scheme.slabs)[0]?.rate ?? '', interest_type: f.interest_type || settings?.DEFAULT_INTEREST_TYPE || 'SIMPLE',
      due_date: dayjs(f.loan_date).add(scheme.tenure_months || 12, 'month').format('YYYY-MM-DD') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme?.id, settings?.DEFAULT_INTEREST_TYPE]);

  // recompute values when rates change
  const rows = useMemo(() => items.map((i) => computeItem(i, rates)), [items, rates.gold, rates.silver]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = rows.reduce((s, i) => ({ net: s.net + i.net_wt, fineG: s.fineG + (i.metal === 'SILVER' ? 0 : i.fine_wt), fineS: s.fineS + (i.metal === 'SILVER' ? i.fine_wt : 0), value: s.value + i.value }), { net: 0, fineG: 0, fineS: 0, value: 0 });
  const step = n(settings?.ROUND_LOAN_TO) || 100;
  const ltvMax = n(scheme?.ltv_percent || 75);
  const eligible = Math.floor((tot.value * ltvMax) / 100 / step) * step;
  const principal = n(f.principal);
  const ltv = tot.value ? (principal / tot.value) * 100 : 0;
  const monthlyRate = scheme?.rate_type === 'MONTHLY' ? n(f.interest_rate) / 100 : n(f.interest_rate) / 100 / 12;
  const perMonth = round2(principal * monthlyRate);
  const advMonths = n(scheme?.advance_interest_months) || 1;
  const advance = f.advance ? Math.round(perMonth * advMonths) : 0;
  const doc = n(f.doc_charges);
  const netPay = round2(principal - doc - advance - n(f.other_charges));

  // live "till today" for old loans
  const [till, setTill] = useState(null);
  useEffect(() => {
    if (!isOld || !principal || !scheme) return setTill(null);
    const t = setTimeout(() => api.post('/loans/calculate', { principal, loan_date: f.loan_date, as_of: today(), scheme_id: scheme.id, rate: f.interest_rate, interest_type: f.interest_type })
      .then((r) => setTill(r.data[0])).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [isOld, principal, f.loan_date, scheme?.id, f.interest_rate, f.interest_type]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.post(isOld ? '/loans/old' : '/loans', {
      customer_id: customer?.id, scheme_id: Number(schemeId), loan_on: loanOn, interest_type: f.interest_type,
      rate_per_gram: n(rates.gold), silver_rate: n(rates.silver),
      items: rows.map(({ key, metal, ...r }) => ({ ...r, metal_id: metal === 'SILVER' ? silverM?.id : goldM?.id, rate_basis: metal === 'SILVER' ? 92.5 : 91.6 })),
      principal, interest_rate: n(f.interest_rate), doc_charges: doc, advance_interest: advance, other_charges: n(f.other_charges),
      loan_date: f.loan_date, due_date: f.due_date, manual_bill_no: f.manual_bill_no, remarks: f.remarks, item_photo: photo, loan_no: f.loan_no, payments: isOld ? [] : payments,
    }),
    onSuccess: (r) => {
      setDone(r.data);
      ['/loans', '/loans/next-number', '/customers', '/dashboard', '/dashboard/status'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Loan #${r.data.loan.bill_no} saved`);
    },
    onError: (e) => toast.error(e.message),
  });

  const clear = () => { setDone(null); setCustomer(null); setItems([]); setPhoto(null); setPayments([]); setEditing(null); set({ principal: '', other_charges: '', manual_bill_no: '', remarks: '', loan_no: '' }); };
  const canSave = customer && scheme && principal > 0 && rows.length && (!isOld || f.manual_bill_no) && !save.isPending;
  const ltvWarn = n(settings?.LTV_WARN_PERCENT) || 0;
  const trySave = () => { if (!canSave) return; if (ltvWarn && ltv > ltvWarn) setLtvAsk(true); else save.mutate(); };
  const printEstimate = () => printElement(<LoanEstimate company={company} customer={customer} scheme={scheme} items={rows} rates={rates}
    values={{ principal, eligible, value: tot.value, ltv, rate: f.interest_rate, perMonth, advance, doc, netPay, due: f.due_date, loanOn }} />, { title: 'Loan estimate' });
  useKeys({
    f1: () => setNewCust(true), f2: trySave, 'ctrl+e': () => rows.length && printEstimate(), f6: () => set({ advance: !f.advance }), 'ctrl+n': clear,
    f4: () => isOld && document.getElementById('pledge-date')?.focus(), 'ctrl+m': () => isOld && setMarkOld(true), escape: () => navigate('/'),
  }, [canSave, f.advance, isOld, ltv, ltvWarn]);

  if (isLoading) return <Spinner />;
  if (isAllBranches) return <div className="card p-6 text-sm">Select a single branch from the header to create loans.</div>;

  const right = (
    <Panel title="Loan">
      <div className="space-y-3">
        <Field label="Scheme"><Select value={schemeId} onChange={(e) => setSchemeId(e.target.value)} options={schemes.map((s) => ({ value: s.id, label: `${s.code} · ${s.name} (${n(s.ltv_percent)}%)` }))} /></Field>
        <Field label="Loan amount (₹)" error={principal > eligible && settings?.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' ? `Above eligible ${money(eligible)}` : null}>
          <div className="flex gap-1"><Input type="number" className="h-12 text-xl font-bold" value={f.principal} onChange={(e) => set({ principal: e.target.value })} />
            <Button variant="soft" className="h-12" onClick={() => set({ principal: String(eligible) })} title="Use eligible amount">Max</Button></div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Int. % ${scheme?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input type="number" step="0.01" value={f.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>
          <Field label="Interest type"><Select value={f.interest_type} onChange={(e) => set({ interest_type: e.target.value })} options={[{ value: 'COMPOUND', label: 'Compound Interest' }, { value: 'SIMPLE', label: 'Simple Interest' }]} /></Field>
          <Field label="Doc. charges"><Input type="number" value={f.doc_charges} onChange={(e) => set({ doc_charges: e.target.value })} /></Field>
          <Field label="Advance interest (F6)">
            <div className="flex gap-1">
              <button type="button" onClick={() => set({ advance: !f.advance })} className={clsx('h-10 w-14 rounded-md text-sm font-bold', f.advance ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100 text-ink-500')}>{f.advance ? 'Yes' : 'No'}</button>
              <Input readOnly className="bg-ink-50 text-right" value={amount(advance)} />
            </div>
          </Field>
        </div>
        <LtvBar value={ltv} max={ltvMax} safe={settings?.LTV_SAFE_PERCENT} warn={settings?.LTV_WARN_PERCENT} />
        <Line label="Eligible amount" value={money(eligible)} />
        <div className="flex items-center justify-between text-sm"><span>Due date</span><Input type="date" className="h-8 w-40" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} /></div>
        <Line label="Interest / month" value={perMonth ? amount(perMonth) : '-'} />
        {isOld && (
          <div className="rounded-md bg-cream-100 p-2">
            <p className="text-xs font-bold text-gold-700 uppercase">Till today</p>
            <Line label="Running" value={till ? `${till.elapsedDays} days` : '-'} />
            <Line label="Interest due" value={till ? amount(till.interestDue) : '-'} tone="text-rose-600" />
          </div>
        )}
        {!isOld && netPay > 0 && <PaymentSplit total={netPay} value={payments} onChange={setPayments} label="Paid by" direction="paid" />}
        <BigTotal label={isOld ? 'Opening entry · not in today\'s cash' : 'Amount to pay customer'} value={isOld ? principal : netPay} />
        <GoldButton disabled={!canSave} loading={save.isPending} onClick={trySave}>{isOld ? 'Save Old Loan (F2)' : 'Save Loan (F2)'}</GoldButton>
      </div>
    </Panel>
  );

  return (
    <>
      <DeskScreen
        title={isOld ? 'Old Loan Entry' : 'New Loan'}
        subtitle={isOld ? 'Old bill book loans - opening entry, not in today\'s cash' : 'Customer, pledge items and loan amount'}
        tiles={isOld
          ? [{ label: 'Opening entry', value: '', gold: true }, { label: 'Loan no (auto)', value: next.data?.loan_no }, { label: 'Billing date', value: dayjs().format('DD/MM/YYYY') }, { label: 'Last date', value: next.data?.last_date ? date(next.data.last_date) : '-' }]
          : [{ label: 'Loan no', value: next.data?.bill_no }, { label: 'Bill book', value: f.manual_bill_no || '-' }, { label: 'Billing date', value: dayjs().format('DD/MM/YYYY') },
            { label: 'Gold · Silver', value: `${todayGold ? amount(todayGold.loan_rate) : '-'} · ${todaySilver ? amount(todaySilver.loan_rate) : '-'}`, gold: true }]}
        left={<>
          <CustomerSearch value={customer} onChange={setCustomer} onNew={() => setNewCust(true)} />
          <ItemPhotoPanel value={photo} onChange={setPhoto} customerId={customer?.id} />
        </>}
        center={<>
          {oldOpen.length > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="size-5" /> {customer.name} has {oldOpen.length} open loan(s) older than {warnMonths} months: {oldOpen.map((l) => `#${l.bill_no} (${date(l.loan_date)})`).join(', ')}. Collect interest before giving a new loan.
            </div>
          )}
          {rateMissing && (
            <div className="flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
              <AlertTriangle className="size-5" /> Today's gold / silver rate is not entered for {dayjs().format('DD/MM/YYYY')}. Please enter the rate first.
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate('/masters/rates')}>Enter rate</Button>
            </div>
          )}
          <Panel title={`Pledge items · ${loanOn}`}>
            {isOld && (
              <div className="mb-3 grid gap-2 border-b border-ink-200 pb-3 sm:grid-cols-4">
                <Field label="Bill book no (required)" required><Input value={f.manual_bill_no} onChange={(e) => set({ manual_bill_no: e.target.value })} /></Field>
                <Field label="Pledge date (F4)" hint={`not after ${dayjs().format('DD/MM/YYYY')}`}><Input id="pledge-date" type="date" max={today()} value={f.loan_date} onChange={(e) => set({ loan_date: e.target.value, due_date: dayjs(e.target.value).add(scheme?.tenure_months || 12, 'month').format('YYYY-MM-DD') })} /></Field>
                <Field label="Gold rate (₹/g)" error={!f.gold_rate && loanOn !== 'SILVER' ? 'enter rate' : null}><Input type="number" value={f.gold_rate} onChange={(e) => set({ gold_rate: e.target.value })} /></Field>
                <Field label="Silver rate (₹/g)" error={!f.silver_rate && loanOn !== 'GOLD' ? 'enter rate' : null}><Input type="number" value={f.silver_rate} onChange={(e) => set({ silver_rate: e.target.value })} /></Field>
              </div>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gold-700">LOAN ON</span>
              {['GOLD', 'SILVER', 'MIX'].map((m) => (
                <button key={m} type="button" onClick={() => setLoanOn(m)} className={clsx('h-9 min-w-24 rounded-md border px-4 text-sm font-bold', loanOn === m ? 'border-navy-800 bg-navy-800 text-white' : 'border-ink-300 bg-white text-navy-800')}>{m.charAt(0) + m.slice(1).toLowerCase()}</button>
              ))}
              <span className="text-xs text-ink-500">Mix = gold + silver items in one loan</span>
            </div>
            <ItemEntry loanOn={loanOn} rates={rates} lookups={lk} editing={editing}
              onAdd={(it) => { setItems((l) => (editing ? l.map((x) => (x.key === editing.key ? it : x)) : [...l, it])); setEditing(null); }} />
            <div className="mt-3"><ItemsTable items={rows} onRemove={(i) => setItems((l) => l.filter((x) => x.key !== i.key))} onEdit={(i) => setEditing(i)} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="label">Gold fine</p><p className="num font-bold">{weight(tot.fineG)} g @ {rates.gold ? amount(rates.gold) : '-'}</p></div>
              <div><p className="label">Silver fine</p><p className="num font-bold">{weight(tot.fineS)} g @ {rates.silver ? amount(rates.silver) : '-'}</p></div>
              <div><p className="label">Item value</p><p className="num font-bold">{amount(tot.value)}</p></div>
              <div><p className="label">Loan / gram</p><p className="num font-bold">{tot.net ? amount(principal / tot.net) : '0.00'}</p></div>
            </div>
            <Field label="Remarks" className="mt-3"><Input value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
            {!isOld && <Field label="Bill book no (optional)" className="mt-2"><Input value={f.manual_bill_no} onChange={(e) => set({ manual_bill_no: e.target.value })} /></Field>}
          </Panel>
        </>}
        right={right}
        footerLeft={<>
          <Button variant="outline" icon={Plus} onClick={clear}>New / Clear (Ctrl+N)</Button>
          {!isOld && <Button variant="outline" icon={FileText} disabled={!rows.length} onClick={printEstimate}>Estimate (Ctrl+E)</Button>}
          {isOld && <Button variant="outline" icon={ListChecks} onClick={() => setMarkOld(true)}>Mark Old Loans (Ctrl+M)</Button>}
          {!customer && <Button variant="outline" icon={UserPlus} onClick={() => setNewCust(true)}>New customer (F1)</Button>}
        </>}
        footerRight={<ExitButton />}
        hints={[['F1', 'New customer'], ['F2', 'Save'], ['F3', 'New item name'], ...(isOld ? [['F4', 'Pledge date'], ['Ctrl+M', 'Mark old loans']] : []), ['F5', 'Customer ledger'], ['F6', 'Advance interest'], ['F7', 'Camera'], ['F8', 'Old image'], ['Ctrl+E', 'Estimate'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerFormDrawer open={newCust} onClose={() => setNewCust(false)} onSaved={(c) => setCustomer(c)} />
      <MarkOldDrawer open={markOld} onClose={() => setMarkOld(false)} />
      <ConfirmDrawer open={ltvAsk} onClose={() => setLtvAsk(false)} tone="primary" confirmText="Yes, save loan" loading={save.isPending}
        title={`Loan to value is ${ltv.toFixed(1)}%`} message={`This is above the warning limit of ${ltvWarn}% set in Settings. The gold value leaves a small margin. Save this loan anyway?`}
        onConfirm={() => { setLtvAsk(false); save.mutate(); }} />
      {printerUi}
      <Drawer open={!!done} onClose={clear} title={`Loan #${done?.loan.bill_no} saved`} subtitle={done && `${done.loan.customer_name} · ${money(done.loan.principal)}`} icon={CheckCircle2} size="sm"
        footer={<Button variant="gold" icon={Plus} onClick={clear}>Next loan (Ctrl+N)</Button>}>
        {done && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" icon={Printer} loading={busy} onClick={() => printLoan(done)}>Print loan bill</Button>
            <Button className="w-full" size="lg" variant="outline" icon={Tag} onClick={() => printElement(<Stickers loans={[done.loan]} settings={settings || {}} company={company} />, { title: 'Sticker' })}>Print packet sticker</Button>
            <Button className="w-full" variant="ghost" onClick={() => navigate(`/loans/counter?loan=${done.loan.id}`)}>Open loan details</Button>
          </div>
        )}
      </Drawer>
    </>
  );
}
