import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input, Select } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, money, n, round2, today, weight } from '@/lib/format';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, ItemEntry, LtvBar, useLoan, useApproval, PayDrawer, LoanHead, Chip, loanCustomer, INTEREST_TYPES, fineRate, valueOf } from './desk';

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
  const [payOpen, setPayOpen] = useState(false);
  const others = useFetch(full?.loan ? '/loans' : null, { customer_id: full?.loan?.customer_id, status: 'OPEN', pageSize: 50 });
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const l = full?.loan;
  const c = full?.calc;

  useEffect(() => {
    if (!l) return;
    setF((s) => ({ ...s, scheme_id: String(l.scheme_id), interest_rate: String(n(l.interest_rate)), interest_type: l.interest_type || 'COMPOUND', new_principal: String(n(l.current_principal)), discount: '' }));
    setExtra([]); setPhoto(l.item_photo); setPayOpen(false);
  }, [l?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheme = (lk?.schemes || []).find((s) => String(s.id) === String(f.scheme_id));
  const metalRate = (code) => fineRate(lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === code)?.id));
  const goldRate = metalRate('GOLD');
  const silverRate = metalRate('SILVER');
  const itemRate = (i) => (i.metal_code === 'SILVER' ? silverRate : goldRate);
  const oldTotal = c ? round2(c.principalOutstanding + c.interestDue + c.penalDue) : 0;
  const valueToday = useMemo(() => round2((full?.items || []).reduce((s, i) => s + valueOf(n(i.net_wt) * n(i.purity) / 100, itemRate(i)), 0) + extra.reduce((s, i) => s + n(i.value), 0)), [full, extra, goldRate, silverRate]);
  const np = n(f.new_principal);
  const monthly = scheme?.rate_type === 'MONTHLY' ? n(f.interest_rate) / 100 : n(f.interest_rate) / 1200;
  const adv = f.advance ? Math.round(np * monthly * (n(scheme?.advance_interest_months) || 1)) : 0;
  const deductions = round2(adv + n(f.doc_charges));
  const payToCustomer = round2(np - oldTotal + n(f.discount) - n(f.doc_charges) - adv);
  const rateOf = (code) => lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === code)?.id);
  const otherOpen = (others.data || []).filter((x) => x.id !== l?.id);
  const start = () => { if (!l || np <= 0) return toast.error('Enter new loan amount'); if (Math.abs(payToCustomer) > 0) setPayOpen(true); else save([]); };

  const save = async (payments) => {
    if (!l || np <= 0) return toast.error('Enter new loan amount');
    setSaving(true);
    try {
      const r = await approval.run((ap) => api.post(`/loans/${l.id}/renew`, {
        date: today(), new_principal: np, scheme_id: f.scheme_id, interest_rate: f.interest_rate, interest_type: f.interest_type, doc_charges: f.doc_charges, advance_interest: adv,
        discount: f.discount, add_items: extra.map(({ key, metal, ...i }) => i), item_photo: photo, payments, rate_per_gram: goldRate, silver_rate: silverRate, rate_basis: 100, approval: ap,
      }));
      setPayOpen(false);
      toast.success(`Re-loan saved as #${r.data.loan.bill_no}`);
      qc.invalidateQueries({ queryKey: ['/loans'] });
      if (settings?.PRINT_AFTER_LOAN !== '0') printLoan(r.data);
      setSp({ loan: r.data.loan.id });
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: start, f5: () => l && setLedger(true), f6: () => set({ advance: !f.advance }), 'ctrl+n': () => setSp({}), escape: () => navigate('/') }, [l, f, extra, photo, payToCustomer]);

  return (
    <>
      <DeskScreen title="Re-loan" subtitle="Release the old loan and make a new loan in one step"
        tiles={[{ label: 'New loan no', value: next.data?.bill_no }, { label: 'Bill book', value: next.data?.bill_book_next || '-' }, { label: 'Billing date', value: dayjs().format('DD/MM/YYYY') },
          { label: 'Gold · Silver', value: `${rateOf('GOLD') ? amount(fineRate(rateOf('GOLD'))) : '-'} · ${rateOf('SILVER') ? amount(fineRate(rateOf('SILVER'))) : '-'}`, gold: true }]}
        left={<>
          <LoanFinder label="Find old loan" onLoad={(id) => setSp({ loan: id })} loading={isLoading} />
          <Panel title="Customer · F5 ledger"><CustomerCard customer={loanCustomer(l)} onLedger={l ? () => setLedger(true) : null} rows={[['Other open loans', otherOpen.length ? otherOpen.map((x) => `#${x.bill_no}`).join(', ') : 'none']]} /></Panel>
          <ItemPhotoPanel value={photo} onChange={setPhoto} customerId={l?.customer_id} />
        </>}
        center={<>
          <Panel title="Old loan" bodyClassName="flex flex-col p-0" className="[&>header]:hidden">
            <LoanHead loan={l} prefix="Old loan" chips={<Chip tone="gold">{c ? `${Math.max(1, c.monthsDue)} month${c.monthsDue > 1 ? 's' : ''}` : ''}</Chip>}
              cells={[['Loan date', l && date(l.loan_date)], ['Loan amount', c && amount(c.principalOutstanding)], [`Interest · ${c ? `${Math.max(1, c.monthsDue)} M` : ''}`, c && amount(c.totalInterest + c.penalDue)], ['Paid before', c && amount(c.interestPaid)], ['Old loan total', amount(oldTotal)]]} />
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 text-left">Item</th><th className="px-3 text-center">Metal</th><th className="px-3 text-right">Pcs</th><th className="px-3 text-right">Gross</th><th className="px-3 text-right">Less</th><th className="px-3 text-right">Net wt</th><th className="px-3 text-right">Purity</th><th className="px-3 text-right">Value today</th><th className="w-20" /></tr></thead>
              <tbody className="divide-y divide-ink-200">
                {(full?.items || []).map((i, k) => <tr key={i.id}><td className="px-3 py-1.5">{k + 1}</td><td className="px-3 font-semibold">{i.item_name}</td><td className="px-3 text-center"><Chip tone={i.metal_code === 'SILVER' ? 'ink' : 'gold'}>{i.metal_code || 'GOLD'}</Chip></td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(valueOf(n(i.net_wt) * n(i.purity) / 100, itemRate(i)))}</td><td className="px-3 text-center"><Chip tone="green">Keep</Chip></td></tr>)}
                {extra.map((i, k) => <tr key={i.key} className="bg-emerald-50"><td className="px-3 py-1.5">+{k + 1}</td><td className="px-3 font-semibold">{i.item_name} <span className="text-xs text-emerald-700">(new)</span></td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(i.value)}</td><td className="px-3 text-center"><button type="button" className="text-xs font-bold text-rose-600" onClick={() => setExtra(extra.filter((x) => x.key !== i.key))}>Remove</button></td></tr>)}
              </tbody></table>
            <div className="flex-1" />
            <p className="border-t border-ink-200 px-4 py-2 text-sm font-semibold">New loan · {(full?.items?.length || 0) + extra.length} items · {(full?.items || []).concat(extra).reduce((t, i) => t + n(i.pcs), 0)} pcs · net {weight((full?.items || []).concat(extra).reduce((t, i) => t + n(i.net_wt), 0))} g · value today {money(valueToday)}</p>
          </Panel>
          <Panel title="Add item (F4)"><ItemEntry loanOn={l?.loan_on || 'GOLD'} rates={{ gold: goldRate, silver: silverRate }} lookups={lk} onAdd={(it) => setExtra([...extra, it])} /></Panel>
        </>}
        right={(
          <Panel title="New loan">
            <div className="space-y-2">
              <Field label="New loan amount"><Input type="number" className="h-12 bg-gold-50 text-right text-xl font-bold" value={f.new_principal} onChange={(e) => set({ new_principal: e.target.value })} onFocus={(e) => e.target.select()} /></Field>
              <Field label="Scheme"><Select value={f.scheme_id} onChange={(e) => { const s = lk.schemes.find((x) => String(x.id) === e.target.value); set({ scheme_id: e.target.value, interest_rate: parseSlabs(s?.slabs)[0]?.rate ?? f.interest_rate }); }} options={(lk?.schemes || []).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Interest % ${scheme?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input type="number" value={f.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>
                <Field label="Calculation"><Select value={f.interest_type} onChange={(e) => set({ interest_type: e.target.value })} options={INTEREST_TYPES} /></Field>
                <Field label="Doc charges"><Input type="number" value={f.doc_charges} onChange={(e) => set({ doc_charges: e.target.value })} /></Field>
                <Field label="Advance interest (F6)">
                  <div className="flex gap-1"><button type="button" onClick={() => set({ advance: !f.advance })} className={clsx('h-10 w-14 rounded-md text-sm font-bold', f.advance ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100')}>{f.advance ? 'Yes' : 'No'}</button>
                    <Input readOnly className="bg-ink-50 text-right" value={amount(adv)} /></div>
                </Field>
              </div>
              <LtvBar value={valueToday ? (np / valueToday) * 100 : 0} max={n(scheme?.ltv_percent || 75)} safe={settings?.LTV_SAFE_PERCENT} warn={settings?.LTV_WARN_PERCENT} suffix="(value today)" />
              <Line label="Old loan total" value={amount(oldTotal)} />
              <div className="grid grid-cols-[1fr_110px] items-center gap-2 text-sm"><span>Less: discount on interest</span><Input type="number" value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></div>
              <Line label="Less: advance interest + charges" value={amount(deductions)} />
              <BigTotal label={payToCustomer > 0 ? 'Pay to customer' : 'Receive from customer'} value={Math.abs(payToCustomer)} tone={payToCustomer > 0 ? 'navy' : 'green'} />
              <GoldButton disabled={!l || l.status !== 'OPEN' || saving} loading={saving && !payOpen} onClick={start}>Save Re-loan (F2)</GoldButton>
              {settings?.DISCOUNT_APPROVAL_LIMIT && <p className="text-xs text-ink-500">Discount above ₹{settings.DISCOUNT_APPROVAL_LIMIT} needs admin approval.</p>}
            </div>
          </Panel>
        )}
        footerLeft={<Button variant="outline" icon={Plus} onClick={() => setSp({})}>New / Clear (Ctrl+N)</Button>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F3', 'Bill book no'], ['F4', 'Add item'], ['F5', 'Customer ledger'], ['F6', 'Advance interest'], ['F2', 'Save'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      <PayDrawer open={payOpen} onClose={() => setPayOpen(false)} direction={payToCustomer > 0 ? 'pay' : 'receive'} total={Math.abs(payToCustomer)} loading={saving} onConfirm={save}
        title={`${payToCustomer > 0 ? 'Pay Customer' : 'Receive from Customer'} · Re-loan #${l?.bill_no || ''}`} subtitle={l && `${l.customer_name} · new loan ${money(np)}`} />
      {approval.ui}
      {printerUi}
    </>
  );
}
