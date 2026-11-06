import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Undo2, UserCog, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Drawer, Field, Input, Select, StatusBadge } from '@/components/ui';
import { CustomerPicker } from '@/components/common/CustomerPicker';
import { useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { amount, n, round2 } from '@/lib/format';
import { Panel, ExitButton, useKeys, ItemEntry, ItemsTable, CustomerCard, ItemPhotoPanel, useLoan, computeItem, INTEREST_TYPES, loanCustomer, fineRate } from './desk';

/** Edit Pledged Record (desktop: frmPledgeBookEdit) - customer, date, bill book no, amount, interest and items. */
export default function EditLoanPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: lk } = useLookups();
  const { full, refresh } = useLoan(sp.get('loan'));
  const [q, setQ] = useState('');
  const [f, setF] = useState({});
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [changeCust, setChangeCust] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const l = full?.loan;
  const locked = full ? full.transactions.filter((t) => !t.is_void).length > 1 : false;

  const reset = () => {
    if (!full) return;
    setF({ loan_date: l.loan_date, manual_bill_no: l.manual_bill_no || '', principal: l.principal, interest_rate: l.interest_rate, interest_type: l.interest_type, due_date: l.due_date, remarks: l.remarks || '', item_photo: l.item_photo });
    setItems(full.items.map((i) => ({ ...i, key: String(i.id), metal: i.metal_code || 'GOLD' })));
    setCustomer({ id: l.customer_id, name: l.customer_name, customer_no: l.customer_no, phone: l.customer_phone, relation_type: l.relation_type, relation_name: l.relation_name, door_no: l.door_no, street: l.street, area: l.area, city: l.city, photo: l.customer_photo_master });
  };
  useEffect(reset, [full]); // eslint-disable-line react-hooks/exhaustive-deps

  const find = async () => {
    try { const r = await api.get('/loans/find', { q: q.trim() }); if (!r.data.length) toast.error('No loan found'); else setSp({ loan: r.data[0].id }); } catch (e) { toast.error(e.message); }
  };
  // edited / added items are valued at today's 100% rate (desktop behaviour)
  const rateOf = (code) => fineRate(lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === code)?.id));
  const rates = { gold: rateOf('GOLD') || l?.rate_per_gram, silver: rateOf('SILVER') || l?.silver_rate };
  const value = round2(items.reduce((s, i) => s + n(i.value), 0));
  const net = items.reduce((s, i) => s + n(i.net_wt), 0);
  const save = async () => {
    if (!l) return;
    setSaving(true);
    try {
      await api.put(`/loans/${l.id}`, { ...f, customer_id: customer?.id, items: items.map(({ key, metal, id, loan_id, ...i }) => i), ...(locked ? { principal: undefined, interest_rate: undefined, loan_date: undefined } : {}) });
      toast.success('All changes saved'); qc.invalidateQueries({ queryKey: ['/loans'] }); refresh();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: save, 'ctrl+s': save, 'ctrl+z': reset, f4: () => l && setChangeCust(true), insert: () => document.querySelector('[data-item-entry] select')?.focus(), escape: () => navigate('/') }, [f, items, customer, l]);

  const ro = (v) => <Input readOnly value={v} className="bg-ink-50" />;
  // what changed compared to the saved loan (desktop shows this above the buttons)
  const changes = !l ? [] : [
    ['loan date', String(f.loan_date || '').slice(0, 10), String(l.loan_date).slice(0, 10)], ['bill book no', f.manual_bill_no || '', l.manual_bill_no || ''], ['loan amount', n(f.principal), n(l.principal)],
    ['interest', n(f.interest_rate), n(l.interest_rate)], ['interest type', f.interest_type, l.interest_type], ['settle before', String(f.due_date || '').slice(0, 10), String(l.due_date || '').slice(0, 10)],
    ['customer', customer?.id, l.customer_id], ['items', JSON.stringify(items.map((i) => [i.item_name, n(i.gross_wt), n(i.stone_wt), n(i.purity), n(i.pcs)])), JSON.stringify((full?.items || []).map((i) => [i.item_name, n(i.gross_wt), n(i.stone_wt), n(i.purity), n(i.pcs)]))],
  ].filter(([, a, b]) => String(a) !== String(b)).map(([k]) => k);
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Edit Pledged Record</h1><p className="text-sm text-navy-100">Correct an open loan - customer, date, bill book no, amount, interest and items</p></div>
        <div className="rounded-md bg-white px-5 py-1.5 text-center text-ink-900"><p className="text-xs font-bold">LOAN</p><p className="font-bold">{l ? `#${l.bill_no}` : '-'}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Loan no / bill book no"><Input autoFocus className="w-56 bg-gold-50 font-bold" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} /></Field>
        <Button onClick={find}>Find (Enter)</Button>
        <div className="ml-4"><p className="label">Status</p>{l ? <StatusBadge status={l.status} /> : '-'}</div>
        {locked && <p className="text-sm text-gold-700">Receipts exist - amount, interest and date are locked</p>}
      </div>
      <div className="grid gap-3 xl:grid-cols-[380px_1fr]">
        <Panel title="Customer" actions={l && <button type="button" onClick={() => setChangeCust(true)} className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-navy-800 normal-case">Change Customer (F4)</button>}>
          <CustomerCard customer={customer ? { ...loanCustomer(l), ...customer } : null} />
          <div className="mt-3"><ItemPhotoPanel value={f.item_photo} onChange={(v) => setF({ ...f, item_photo: v })} customerId={customer?.id} /></div>
        </Panel>
        <Panel title="Loan">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Loan date"><Input type="date" disabled={locked} value={f.loan_date || ''} onChange={(e) => setF({ ...f, loan_date: e.target.value })} /></Field>
            <Field label="Bill book no"><Input value={f.manual_bill_no || ''} onChange={(e) => setF({ ...f, manual_bill_no: e.target.value })} /></Field>
            <Field label="Loan amount"><Input type="number" disabled={locked} value={f.principal ?? ''} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
            <Field label={`ROI % ${l?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input type="number" disabled={locked} value={f.interest_rate ?? ''} onChange={(e) => setF({ ...f, interest_rate: e.target.value })} /></Field>
            <Field label="Interest type"><Select value={f.interest_type || 'SIMPLE'} onChange={(e) => setF({ ...f, interest_type: e.target.value })} options={INTEREST_TYPES} /></Field>
            <Field label="Adv. interest (auto)">{ro(l ? amount(l.advance_interest) : '')}</Field>
            <Field label="Doc. charges">{ro(l ? amount(l.doc_charges) : '')}</Field>
            <Field label="Settle before"><Input type="date" value={f.due_date || ''} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
            <Field label="Loan / gram (auto)">{ro(net ? amount(n(f.principal) / net) : '')}</Field>
            <Field label="Item value (auto)">{ro(amount(value))}</Field>
            <Field label="Part payments" className="sm:col-span-2">{ro(full ? amount(full.transactions.filter((t) => t.txn_type === 'PART_PAYMENT' && !t.is_void).reduce((s, t) => s - n(t.principal_amount), 0)) : '')}</Field>
            <Field label="Remarks" className="sm:col-span-4"><Input value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
          </div>
        </Panel>
      </div>
      <Panel title={`Pledged items (${items.length})`}>
        <ItemsTable items={items} onEdit={(i) => setEditing(i)} onRemove={(i) => setItems(items.filter((x) => x.key !== i.key))} valueLabel="Item value" />
        <div className="mt-3 border-t border-ink-200 pt-3" data-item-entry>
          <ItemEntry loanOn={l?.loan_on === 'MIX' ? 'MIX' : l?.loan_on || 'GOLD'} rates={rates} lookups={lk} editing={editing}
            onAdd={(it) => { const c = computeItem(it, rates); setItems(editing ? items.map((x) => (x.key === editing.key ? c : x)) : [...items, c]); setEditing(null); }} />
        </div>
      </Panel>
      <div className="card flex flex-wrap items-center justify-end gap-2 px-3 py-2">
        <p className="mr-auto text-sm text-ink-600">{!l ? '' : changes.length ? `Changed: ${changes.join(', ')}` : 'No changes yet'}</p>
        <Button variant="outline" icon={Undo2} onClick={reset}>Cancel Changes (Ctrl+Z)</Button>
        <Button variant="gold" icon={Save} loading={saving} disabled={!l} onClick={save}>Save All Changes (F2)</Button>
        <ExitButton />
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = find loan · F4 = change customer · Ins = add item · double-click item = edit · F2 / Ctrl+S = save all · Ctrl+Z = cancel changes · Esc = exit</p>
      <Drawer open={changeCust} onClose={() => setChangeCust(false)} size="md" icon={UserCog} title="Change customer" footer={<Button icon={Plus} onClick={() => setChangeCust(false)}>Done</Button>}>
        <CustomerPicker value={null} onChange={(c) => { if (c) { setCustomer(c); setChangeCust(false); } }} />
      </Drawer>
    </div>
  );
}
