import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input, Select } from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch, useLookups } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, money, n, round2, today, weight } from '@/lib/format';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, ItemEntry, LtvBar, useLoan, useApproval } from './desk';

const parseSlabs = (s) => (typeof s === 'string' ? JSON.parse(s) : s) || [];

/** Re-loan (desktop: frmReLoan) - release the old loan and make a new loan in one step. */
export default function ReLoanPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { full, isLoading } = useLoan(sp.get('loan'));
  const { data: lk } = useLookups();
  const { data: settings } = useFetch('/admin/settings');
  const next = useFetch('/loans/next-number');
  const { printLoan, printerUi } = usePrinter();
  const approval = useApproval();
  const [f, setF] = useState({ new_principal: '', interest_rate: '', interest_type: 'COMPOUND', doc_charges: '0', advance: true, discount: '', scheme_id: '' });
  const [extra, setExtra] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const l = full?.loan;
  const c = full?.calc;

  useEffect(() => {
    if (!l) return;
    setF((s) => ({ ...s, scheme_id: String(l.scheme_id), interest_rate: String(n(l.interest_rate)), interest_type: l.interest_type || 'COMPOUND', new_principal: '', discount: '' }));
    setExtra([]); setPhoto(l.item_photo); setPayments([]);
  }, [l?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheme = (lk?.schemes || []).find((s) => String(s.id) === String(f.scheme_id));
  const goldRate = lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === 'GOLD')?.id)?.loan_rate;
  const oldTotal = c ? round2(c.principalOutstanding + c.interestDue + c.penalDue) : 0;
  const valueToday = useMemo(() => round2((full?.items || []).reduce((s, i) => s + n(i.net_wt) * n(goldRate) * (n(i.purity) / 91.6), 0) + extra.reduce((s, i) => s + n(i.value), 0)), [full, extra, goldRate]);
  const np = n(f.new_principal);
  const monthly = scheme?.rate_type === 'MONTHLY' ? n(f.interest_rate) / 100 : n(f.interest_rate) / 1200;
  const adv = f.advance ? Math.round(np * monthly * (n(scheme?.advance_interest_months) || 1)) : 0;
  const deductions = round2(adv + n(f.doc_charges));
  const payToCustomer = round2(np - oldTotal + n(f.discount) - n(f.doc_charges) - adv);

  const save = async () => {
    if (!l || np <= 0) return toast.error('Enter new loan amount');
    setSaving(true);
    try {
      const r = await approval.run((ap) => api.post(`/loans/${l.id}/renew`, {
        date: today(), new_principal: np, scheme_id: f.scheme_id, interest_rate: f.interest_rate, interest_type: f.interest_type, doc_charges: f.doc_charges, advance_interest: adv,
        discount: f.discount, add_items: extra.map(({ key, metal, ...i }) => i), item_photo: photo, payments, rate_per_gram: goldRate, approval: ap,
      }));
      toast.success(`Re-loan saved as #${r.data.loan.bill_no}`);
      qc.invalidateQueries({ queryKey: ['/loans'] });
      printLoan(r.data);
      setSp({ loan: r.data.loan.id });
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: save, f5: () => l && setLedger(true), f6: () => set({ advance: !f.advance }), 'ctrl+n': () => setSp({}), escape: () => navigate('/') }, [l, f, extra, payments, photo]);

  return (
    <>
      <DeskScreen title="Re-loan" subtitle="Release the old loan and make a new loan in one step"
        tiles={[{ label: 'New loan no', value: next.data?.bill_no }, { label: 'Bill book', value: l?.manual_bill_no || '-' }, { label: 'Billing date', value: dayjs().format('DD/MM/YYYY') }, { label: 'Gold rate', value: goldRate ? amount(goldRate) : '-', gold: true }]}
        left={<>
          <LoanFinder label="Find old loan" onLoad={(id) => setSp({ loan: id })} loading={isLoading} />
          <Panel title="Customer · F5 ledger"><CustomerCard customer={l ? { ...l, name: l.customer_name, phone: l.customer_phone, photo: l.customer_photo || l.customer_photo_master } : null} onLedger={l ? () => setLedger(true) : null} /></Panel>
          <ItemPhotoPanel value={photo} onChange={setPhoto} customerId={l?.customer_id} />
        </>}
        center={<>
          <Panel title="Old loan" bodyClassName="p-0">
            <div className="grid grid-cols-5 border-b border-ink-200">
              {[['Loan date', l ? date(l.loan_date) : '-'], ['Loan amount', c ? amount(c.principalOutstanding) : '-'], ['Interest', c ? amount(c.interestDue + c.penalDue) : '-'], ['Paid before', c ? amount(c.interestPaid) : '-'], ['Old loan total', amount(oldTotal)]].map(([k, v]) => (
                <div key={k} className="border-r border-ink-200 px-3 py-2 last:border-0"><p className="label">{k}</p><p className="num font-bold">{v}</p></div>))}
            </div>
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 text-left">Item</th><th className="px-3 text-right">Pcs</th><th className="px-3 text-right">Gross</th><th className="px-3 text-right">Less</th><th className="px-3 text-right">Net wt</th><th className="px-3 text-right">Purity</th><th className="px-3 text-right">Value today</th></tr></thead>
              <tbody className="divide-y divide-ink-200">
                {(full?.items || []).map((i, k) => <tr key={i.id}><td className="px-3 py-1.5">{k + 1}</td><td className="px-3 font-semibold">{i.item_name}</td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(n(i.net_wt) * n(goldRate) * n(i.purity) / 91.6)}</td></tr>)}
                {extra.map((i, k) => <tr key={i.key} className="bg-emerald-50"><td className="px-3 py-1.5">+{k + 1}</td><td className="px-3 font-semibold">{i.item_name} <span className="text-xs text-emerald-700">(new)</span></td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(i.value)} <button type="button" className="ml-1 text-rose-500" onClick={() => setExtra(extra.filter((x) => x.key !== i.key))}>×</button></td></tr>)}
              </tbody></table>
            <p className="px-4 py-2 text-sm text-ink-600">New loan · {(full?.items?.length || 0) + extra.length} items · value today {money(valueToday)}</p>
          </Panel>
          <Panel title="Add item (F4)"><ItemEntry loanOn="GOLD" rates={{ gold: goldRate }} lookups={lk} onAdd={(it) => setExtra([...extra, it])} /></Panel>
        </>}
        right={(
          <Panel title="New loan">
            <div className="space-y-2">
              <Field label="New loan amount"><Input type="number" className="h-12 text-xl font-bold" value={f.new_principal} onChange={(e) => set({ new_principal: e.target.value })} /></Field>
              <Field label="Scheme"><Select value={f.scheme_id} onChange={(e) => { const s = lk.schemes.find((x) => String(x.id) === e.target.value); set({ scheme_id: e.target.value, interest_rate: parseSlabs(s?.slabs)[0]?.rate ?? f.interest_rate }); }} options={(lk?.schemes || []).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Interest % ${scheme?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input type="number" value={f.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>
                <Field label="Calculation"><Select value={f.interest_type} onChange={(e) => set({ interest_type: e.target.value })} options={[{ value: 'COMPOUND', label: 'Compound Interest' }, { value: 'SIMPLE', label: 'Simple Interest' }]} /></Field>
                <Field label="Doc charges"><Input type="number" value={f.doc_charges} onChange={(e) => set({ doc_charges: e.target.value })} /></Field>
                <Field label="Advance interest (F6)">
                  <div className="flex gap-1"><button type="button" onClick={() => set({ advance: !f.advance })} className={clsx('h-10 w-14 rounded-md text-sm font-bold', f.advance ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100')}>{f.advance ? 'Yes' : 'No'}</button>
                    <Input readOnly className="bg-ink-50 text-right" value={amount(adv)} /></div>
                </Field>
              </div>
              <LtvBar value={valueToday ? (np / valueToday) * 100 : 0} max={n(scheme?.ltv_percent || 75)} />
              <Line label="Old loan total" value={amount(oldTotal)} />
              <div className="grid grid-cols-[1fr_110px] items-center gap-2 text-sm"><span>Less: discount on interest</span><Input type="number" value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></div>
              <Line label="Less: advance interest + charges" value={amount(deductions)} />
              {Math.abs(payToCustomer) > 0 && <PaymentSplit total={Math.abs(payToCustomer)} value={payments} onChange={setPayments} direction={payToCustomer > 0 ? 'paid' : 'received'} />}
              <BigTotal label={payToCustomer >= 0 ? 'Pay to customer' : 'Collect from customer'} value={Math.abs(payToCustomer)} tone={payToCustomer >= 0 ? 'green' : 'navy'} />
              <GoldButton disabled={!l || l.status !== 'OPEN' || saving} loading={saving} onClick={save}>Save Re-loan (F2)</GoldButton>
              {settings?.DISCOUNT_APPROVAL_LIMIT && <p className="text-xs text-ink-500">Discount above ₹{settings.DISCOUNT_APPROVAL_LIMIT} needs admin approval.</p>}
            </div>
          </Panel>
        )}
        footerLeft={<Button variant="outline" icon={Plus} onClick={() => setSp({})}>New / Clear (Ctrl+N)</Button>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F3', 'Bill book no'], ['F4', 'Add item'], ['F5', 'Customer ledger'], ['F6', 'Advance interest'], ['F2', 'Save'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {approval.ui}
      {printerUi}
    </>
  );
}
