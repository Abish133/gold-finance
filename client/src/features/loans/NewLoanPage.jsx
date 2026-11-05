import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, History, Plus, Trash2, Printer, Tag, CheckCircle2, Sparkles, Gem } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, Drawer, Field, ImageCapture, Input, PageHeader, Select, Textarea, Spinner } from '@/components/ui';
import { CustomerPicker } from '@/components/common/CustomerPicker';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useLookups, useSettings, useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { printElement } from '@/lib/print';
import { Stickers } from '@/features/print/Sticker';
import { api } from '@/lib/api';
import { money, n, round2, round3, today, grams } from '@/lib/format';
import dayjs from 'dayjs';

const blankItem = () => ({ key: crypto.randomUUID(), item_name: '', item_id: null, pcs: 1, gross_wt: '', stone_wt: '', purity: 91.6 });
const parseSlabs = (s) => (typeof s === 'string' ? JSON.parse(s) : s) || [];

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
  const [items, setItems] = useState([blankItem()]);
  const [schemeId, setSchemeId] = useState('');
  const [rate, setRate] = useState('');
  const [f, setF] = useState({ principal: '', interest_rate: '', doc_charges: '', advance_interest: '', other_charges: '', loan_date: today(), due_date: '', manual_bill_no: '', remarks: '', loan_no: '' });
  const [itemPhoto, setItemPhoto] = useState(null);
  const [payments, setPayments] = useState([]);
  const [done, setDone] = useState(null);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  // preselect customer from ?customer=
  useEffect(() => {
    const id = params.get('customer');
    if (id) api.get(`/customers/${id}`).then((r) => setCustomer(r.data)).catch(() => {});
  }, [params]);

  const schemes = lk?.schemes || [];
  const scheme = schemes.find((s) => String(s.id) === String(schemeId));
  useEffect(() => { if (!schemeId && schemes.length) setSchemeId(String(schemes[0].id)); }, [schemes, schemeId]);

  // scheme change -> default rate per gram, interest, due date
  useEffect(() => {
    if (!scheme) return;
    const r = lk.rates.find((x) => x.metal_id === scheme.metal_id);
    if (r) setRate(String(r.loan_rate));
    const slabs = parseSlabs(scheme.slabs);
    set({ interest_rate: slabs[0]?.rate ?? '', due_date: dayjs(f.loan_date).add(scheme.tenure_months || 12, 'month').format('YYYY-MM-DD') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemeId, lk]);

  const metalPurities = (lk?.purities || []).filter((p) => !scheme || p.metal_id === scheme.metal_id);
  const step = n(settings?.ROUND_LOAN_TO) || 100;

  const calc = useMemo(() => {
    let gross = 0, stone = 0, net = 0, pcs = 0, value = 0;
    const rows = items.map((it) => {
      const g = n(it.gross_wt), s = n(it.stone_wt), nw = round3(Math.max(0, g - s));
      const v = round2(nw * n(rate) * (n(it.purity || 91.6) / 91.6));
      gross += g; stone += s; net += nw; pcs += n(it.pcs); value += v;
      return { ...it, net_wt: nw, value: v };
    });
    const eligible = Math.floor((value * n(scheme?.ltv_percent || 75)) / 100 / step) * step;
    return { rows, gross: round3(gross), stone: round3(stone), net: round3(net), pcs, value: round2(value), eligible };
  }, [items, rate, scheme, step]);

  const principal = n(f.principal);
  const docAuto = scheme ? round2((principal * n(scheme.doc_charge_percent)) / 100 + n(scheme.doc_charge_fixed)) : 0;
  const monthly = scheme?.rate_type === 'MONTHLY' ? n(f.interest_rate) / 100 : n(f.interest_rate) / 100 / 12;
  const advAuto = scheme ? Math.round(principal * monthly * n(scheme.advance_interest_months)) : 0;
  const doc = f.doc_charges === '' ? docAuto : n(f.doc_charges);
  const adv = f.advance_interest === '' ? advAuto : n(f.advance_interest);
  const netPay = round2(principal - doc - adv - n(f.other_charges));
  const overLimit = principal > calc.eligible;

  const updateItem = (key, patch) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const save = useMutation({
    mutationFn: () => api.post(isOld ? '/loans/old' : '/loans', {
      customer_id: customer?.id, scheme_id: Number(schemeId), metal_id: scheme?.metal_id, rate_per_gram: n(rate),
      items: calc.rows.filter((r) => r.item_name).map(({ key, ...r }) => ({ ...r, rate_per_gram: n(rate) })),
      principal, interest_rate: n(f.interest_rate), doc_charges: f.doc_charges === '' ? undefined : doc, advance_interest: f.advance_interest === '' ? undefined : adv,
      other_charges: n(f.other_charges), loan_date: f.loan_date, due_date: f.due_date, manual_bill_no: f.manual_bill_no, remarks: f.remarks,
      item_photo: itemPhoto, loan_no: f.loan_no, payments: isOld ? [] : payments,
    }),
    onSuccess: (r) => {
      setDone(r.data);
      qc.invalidateQueries({ queryKey: ['/loans'] });
      qc.invalidateQueries({ queryKey: ['/loans/next-number'] });
      qc.invalidateQueries({ queryKey: ['/customers'] });
      toast.success(`Loan #${r.data.loan.bill_no} created`);
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = () => { setDone(null); setCustomer(null); setItems([blankItem()]); setItemPhoto(null); setPayments([]); set({ principal: '', doc_charges: '', advance_interest: '', other_charges: '', manual_bill_no: '', remarks: '', loan_no: '' }); };

  if (isLoading) return <Spinner />;
  if (isAllBranches) return <Card><p className="text-sm text-ink-600">Select a single branch from the top bar to create loans.</p></Card>;

  const canSave = customer && schemeId && principal > 0 && calc.rows.some((r) => r.item_name && r.net_wt > 0) && (!isOld || n(f.loan_no) > 0);

  return (
    <div className="animate-rise">
      <PageHeader icon={isOld ? History : FilePlus2} title={isOld ? 'Old Loan Entry' : 'New Gold Loan'}
        subtitle={isOld ? 'Enter loans given before using this software (no cash entry)' : 'Press F2 anywhere to open this screen'}
        actions={!isOld && next.data && <Badge tone="gold" className="px-3 py-1 text-sm">Next Loan No: {next.data.bill_no}</Badge>} />

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card title="1. Customer" icon={Sparkles}><CustomerPicker value={customer} onChange={setCustomer} /></Card>

          <Card title="2. Jewel details" icon={Gem} actions={<Button size="sm" variant="soft" icon={Plus} onClick={() => setItems((l) => [...l, blankItem()])}>Add item</Button>}>
            <datalist id="items-list">{(lk?.items || []).map((i) => <option key={i.id} value={i.name} />)}</datalist>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs font-semibold text-ink-500 uppercase">
                  <th className="pb-2">Item</th><th className="w-16 pb-2">Pcs</th><th className="w-28 pb-2">Gross wt</th><th className="w-28 pb-2">Stone wt</th><th className="w-24 pb-2 text-right">Net wt</th><th className="w-32 pb-2">Purity</th><th className="w-28 pb-2 text-right">Value</th><th className="w-10" />
                </tr></thead>
                <tbody>
                  {calc.rows.map((it) => (
                    <tr key={it.key} className="align-top">
                      <td className="pr-2 pb-2"><Input list="items-list" value={it.item_name} placeholder="Chain, Ring…" onChange={(e) => {
                        const m = lk.items.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase());
                        updateItem(it.key, { item_name: e.target.value, item_id: m?.id || null });
                      }} /></td>
                      <td className="pr-2"><Input type="number" min="1" value={it.pcs} onChange={(e) => updateItem(it.key, { pcs: e.target.value })} /></td>
                      <td className="pr-2"><Input type="number" step="0.001" value={it.gross_wt} suffix="g" onChange={(e) => updateItem(it.key, { gross_wt: e.target.value })} /></td>
                      <td className="pr-2"><Input type="number" step="0.001" value={it.stone_wt} suffix="g" onChange={(e) => updateItem(it.key, { stone_wt: e.target.value })} /></td>
                      <td className="num pt-2.5 pr-2 text-right font-semibold">{it.net_wt.toFixed(3)}</td>
                      <td className="pr-2"><Select value={it.purity} onChange={(e) => updateItem(it.key, { purity: e.target.value })} options={metalPurities.map((p) => ({ value: p.purity, label: p.name }))} /></td>
                      <td className="num pt-2.5 pr-2 text-right">{money(it.value)}</td>
                      <td>{items.length > 1 && <Button size="icon" variant="ghost" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}><Trash2 className="size-4 text-rose-500" /></Button>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-ink-200 font-bold dark:border-ink-700">
                  <td className="pt-2">Total</td><td className="num pt-2">{calc.pcs}</td><td className="num pt-2">{calc.gross.toFixed(3)}</td><td className="num pt-2">{calc.stone.toFixed(3)}</td>
                  <td className="num pt-2 text-right">{calc.net.toFixed(3)}</td><td /><td className="num pt-2 text-right">{money(calc.value)}</td><td />
                </tr></tfoot>
              </table>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <ImageCapture label="Jewel photo" value={itemPhoto} onChange={setItemPhoto} aspect="aspect-[4/3]"
                upload={async (file) => (await api.upload('/loans/upload/temp', file)).data.path} />
              <div className="sm:col-span-2 space-y-4">
                <Field label="Remarks"><Textarea rows={2} value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Hallmark, damage, seal no…" /></Field>
                <Field label="Manual bill no" hint="Optional - printed bill book number"><Input value={f.manual_bill_no} onChange={(e) => set({ manual_bill_no: e.target.value })} /></Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="3. Loan" className="xl:sticky xl:top-24">
            <div className="space-y-4">
              {isOld && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Old loan no" required><Input type="number" value={f.loan_no} onChange={(e) => set({ loan_no: e.target.value })} /></Field>
                  <Field label="Loan date" required><Input type="date" value={f.loan_date} onChange={(e) => set({ loan_date: e.target.value })} /></Field>
                </div>
              )}
              <Field label="Scheme"><Select value={schemeId} onChange={(e) => setSchemeId(e.target.value)} options={schemes.map((s) => ({ value: s.id, label: `${s.code} · ${s.name} (${n(s.ltv_percent)}%)` }))} /></Field>
              {scheme && (
                <div className="flex flex-wrap gap-1.5">
                  {parseSlabs(scheme.slabs).map((s, i) => <Badge key={i} tone="blue">{s.upto_months ? `≤${s.upto_months}m` : 'after'} · {s.rate}%</Badge>)}
                  <Badge tone="gray">min {scheme.min_days} days</Badge>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loan rate / gram"><Input type="number" prefix="₹" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
                <Field label={`Interest % ${scheme?.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'}`}><Input type="number" step="0.01" value={f.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>
              </div>
              {!isOld && <Field label="Loan date"><Input type="date" value={f.loan_date} max={today()} onChange={(e) => set({ loan_date: e.target.value })} /></Field>}

              <div className="rounded-2xl bg-ink-900 p-4 text-white dark:bg-ink-950">
                <div className="flex items-center justify-between text-sm text-ink-300"><span>Eligible amount ({n(scheme?.ltv_percent)}%)</span><span>{grams(calc.net)}</span></div>
                <div className="mt-1 flex items-end justify-between">
                  <p className="num text-3xl font-extrabold text-gold-300">{money(calc.eligible)}</p>
                  <Button size="sm" variant="gold" onClick={() => set({ principal: String(calc.eligible) })}>Use max</Button>
                </div>
              </div>

              <Field label="Loan amount" required error={overLimit && settings?.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' ? 'Exceeds eligible amount' : null}>
                <Input type="number" prefix="₹" className="h-12 text-lg font-bold" value={f.principal} onChange={(e) => set({ principal: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Doc charges"><Input type="number" value={f.doc_charges} placeholder={String(docAuto)} onChange={(e) => set({ doc_charges: e.target.value })} /></Field>
                <Field label="Adv. interest"><Input type="number" value={f.advance_interest} placeholder={String(advAuto)} onChange={(e) => set({ advance_interest: e.target.value })} /></Field>
                <Field label="Other"><Input type="number" value={f.other_charges} onChange={(e) => set({ other_charges: e.target.value })} /></Field>
              </div>
              <Field label="Due date"><Input type="date" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} /></Field>

              {!isOld && (
                <>
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Net cash to customer</span>
                    <span className="num text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{money(netPay)}</span>
                  </div>
                  <PaymentSplit total={netPay} value={payments} onChange={setPayments} label="Paid by" direction="paid" />
                </>
              )}
              <Button variant="gold" size="lg" className="w-full" icon={CheckCircle2} disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
                {isOld ? 'Save old loan' : 'Save loan'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {printerUi}
      <Drawer open={!!done} onClose={reset} title={`Loan #${done?.loan.bill_no} saved`} subtitle={done && `${done.loan.customer_name} · ${money(done.loan.principal)}`} icon={CheckCircle2} size="sm"
        footer={<Button variant="gold" icon={Plus} onClick={reset}>Next loan</Button>}>
        {done && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" icon={Printer} loading={busy} onClick={() => printLoan(done)}>Print loan bill</Button>
            <Button className="w-full" size="lg" variant="outline" icon={Tag}
              onClick={() => printElement(<Stickers loans={[done.loan]} settings={settings || {}} company={company} />, { title: 'Sticker' })}>Print packet sticker</Button>
            <Button className="w-full" variant="ghost" onClick={() => navigate(`/loans/counter?loan=${done.loan.id}`)}>Open in loan counter</Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
