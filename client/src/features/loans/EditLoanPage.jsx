import { bookStatus } from '@/lib/loanStatus';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Undo2, UserCog, Plus, ScanLine, BookOpen, IndianRupee, Percent, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Drawer, Field, Input, Select } from '@/components/ui';
import { CustomerPicker } from '@/components/common/CustomerPicker';
import { useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { amount, n, round2 } from '@/lib/format';
import { Panel, ExitButton, useKeys, ItemEntry, ItemsTable, CustomerCard, ItemPhotoPanel, useLoan, computeItem, INTEREST_TYPES, loanCustomer, fineRate, Line, GoldButton, useAutoMode, AutoManualSwitch } from './desk';
import { PageActions } from '@/components/common/PageActions';

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

  const [auto, setAuto] = useAutoMode('editLoanFind');
  const [miss, setMiss] = useState(false);
  // quiet = typed (auto) lookup: no toast, and never jumps to the loan already open
  const find = async (quiet = false) => {
    const v = q.trim();
    if (!v) return;
    try {
      const r = await api.get('/loans/find', { q: v });
      setMiss(!r.data.length);
      if (!r.data.length) { if (!quiet) toast.error('No loan found'); } else if (!quiet || String(r.data[0].id) !== String(sp.get('loan'))) setSp({ loan: r.data[0].id });
    } catch (e) { if (!quiet) toast.error(e.message); }
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

  // what changed compared to the saved loan (desktop shows this above the buttons)
  const changes = !l ? [] : [
    ['loan date', String(f.loan_date || '').slice(0, 10), String(l.loan_date).slice(0, 10)], ['bill book no', f.manual_bill_no || '', l.manual_bill_no || ''], ['loan amount', n(f.principal), n(l.principal)],
    ['interest', n(f.interest_rate), n(l.interest_rate)], ['interest type', f.interest_type, l.interest_type], ['settle before', String(f.due_date || '').slice(0, 10), String(l.due_date || '').slice(0, 10)],
    ['customer', customer?.id, l.customer_id], ['items', JSON.stringify(items.map((i) => [i.item_name, n(i.gross_wt), n(i.stone_wt), n(i.purity), n(i.pcs)])), JSON.stringify((full?.items || []).map((i) => [i.item_name, n(i.gross_wt), n(i.stone_wt), n(i.purity), n(i.pcs)]))],
  ].filter(([, a, b]) => String(a) !== String(b)).map(([k]) => k);
  // auto: look the number up once typing pauses - but never throw away unsaved edits
  const unsaved = !!l && changes.length > 0;
  useEffect(() => {
    setMiss(false);
    if (!auto || !q.trim() || unsaved) return undefined;
    const t = setTimeout(() => find(true), 550);
    return () => clearTimeout(t);
  }, [q, auto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    /* fit-screen: on desktop the page fits the window; each column scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Edit Pledged Record</h1>
          <p className="hidden truncate text-[12px] text-white/60 xl:block">Correct an open loan - customer, date, bill book no, amount, interest and items</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-white p-1">
          <AutoManualSwitch value={auto} onChange={setAuto} className="h-8 [&_button]:px-2" />
          <Input autoFocus prefix={<ScanLine className="size-4" />} placeholder={auto ? (unsaved ? 'Save or cancel changes first' : 'Loan no - loads as you type') : 'Loan no / bill book no'} className={clsx('!h-8 w-56 text-[13px] font-bold', miss && '!border-rose-300')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} title={miss ? `No loan "${q.trim()}"` : undefined} />
          <Button size="sm" onClick={() => find()}>Find (Enter)</Button>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/15">
          <div className="flex items-baseline gap-2 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Loan</span><span className="num text-[13px] font-bold">{l ? `#${l.bill_no}` : '-'}</span></div>
          <div className="flex items-center border-l border-white/15 px-2">
            {l ? <span className={clsx('rounded-sm px-2 py-0.5 text-[10px] font-bold text-white uppercase', { Pending: 'bg-blue-600', 'In Bank': 'bg-violet-600', Released: 'bg-rose-600', Auctioned: 'bg-amber-600', Cancelled: 'bg-ink-500' }[bookStatus(l)])}>{bookStatus(l)}</span> : <span className="text-[11px] text-white/50">no loan</span>}
          </div>
        </div>
      </section>
      {locked && <p className="shrink-0 rounded-md border-l-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Receipts exist on this loan - amount, interest and loan date are locked.</p>}

      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[320px_1fr_360px]">
        {/* customer + photo */}
        <div className="desk-col">
          <Panel title="Customer" actions={l && <Button size="sm" variant="outline" icon={UserCog} className="h-6 px-2 text-[11px] normal-case" onClick={() => setChangeCust(true)}>Change (F4)</Button>}>
            <CustomerCard customer={customer ? { ...loanCustomer(l), ...customer } : null} emptyText="Find a loan to edit" />
          </Panel>
          <ItemPhotoPanel value={f.item_photo} onChange={(v) => setF({ ...f, item_photo: v })} customerId={customer?.id} />
        </div>

        {/* items */}
        <div className="desk-col min-w-0">
          <Panel title={`Pledged items · ${items.length}`} bodyClassName="flex flex-col gap-2.5">
            <div data-item-entry>
              <ItemEntry loanOn={l?.loan_on === 'MIX' ? 'MIX' : l?.loan_on || 'GOLD'} rates={rates} lookups={lk} editing={editing}
                onAdd={(it) => { const c = computeItem(it, rates); setItems(editing ? items.map((x) => (x.key === editing.key ? c : x)) : [...items, c]); setEditing(null); }} />
            </div>
            <ItemsTable items={items} onEdit={(i) => setEditing(i)} onRemove={(i) => setItems(items.filter((x) => x.key !== i.key))} valueLabel="Item value" />
            <p className="text-[11px] text-ink-400">Double-click an item to change it · Ins = add item</p>
          </Panel>
        </div>

        {/* loan details + save */}
        <div className="desk-col">
          <Panel title="Loan" bodyClassName="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Loan date"><Input type="date" disabled={locked} value={f.loan_date || ''} onChange={(e) => setF({ ...f, loan_date: e.target.value })} /></Field>
              <Field label="Settle before"><Input type="date" value={f.due_date || ''} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
              <Field label="Bill book no"><Input prefix={<BookOpen className="size-3.5" />} value={f.manual_bill_no || ''} onChange={(e) => setF({ ...f, manual_bill_no: e.target.value })} /></Field>
              <Field label="Loan amount"><Input type="number" prefix={<IndianRupee className="size-3.5" />} disabled={locked} value={f.principal ?? ''} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
              <Field label={`ROI % ${l?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input type="number" prefix={<Percent className="size-3.5" />} disabled={locked} value={f.interest_rate ?? ''} onChange={(e) => setF({ ...f, interest_rate: e.target.value })} /></Field>
              <Field label="Interest type"><Select value={f.interest_type || 'SIMPLE'} onChange={(e) => setF({ ...f, interest_type: e.target.value })} options={INTEREST_TYPES} /></Field>
            </div>
            {/* figures worked out by the system */}
            <div className="flex min-h-28 flex-1 flex-col justify-evenly rounded-md border border-ink-200 bg-ink-50/50 px-2.5 py-1 dark:border-ink-800 dark:bg-ink-800/30 [&>div]:py-0.5 [&>div]:text-[12px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700">
              <Line label="Advance interest (auto)" value={l ? amount(l.advance_interest) : '-'} />
              <Line label="Doc. charges" value={l ? amount(l.doc_charges) : '-'} />
              <Line label="Loan / gram (auto)" value={net ? amount(n(f.principal) / net) : '-'} />
              <Line label="Item value (auto)" value={amount(value)} />
              <Line label="Part payments" value={full ? amount(full.transactions.filter((t) => t.txn_type === 'PART_PAYMENT' && !t.is_void).reduce((acc, t) => acc - n(t.principal_amount), 0)) : '-'} />
            </div>
            <Field label="Remarks"><Input prefix={<StickyNote className="size-3.5" />} value={f.remarks || ''} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
            {/* pinned to the bottom */}
            <div className="mt-auto space-y-2 pt-1">
              <div className={clsx('rounded-md border px-2.5 py-1.5 text-[12px]', changes.length ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200' : 'border-ink-200 text-ink-500 dark:border-ink-800')}>
                {!l ? 'Find a loan to start' : changes.length ? <><b>Changed:</b> {changes.join(', ')}</> : 'No changes yet'}
              </div>
              <GoldButton icon={Save} loading={saving} disabled={!l} onClick={save}>Save All Changes (F2)</GoldButton>
            </div>
          </Panel>
        </div>
      </div>

      <PageActions keys="Enter = find loan · F4 = change customer · Ins = add item · double-click item = edit · F2 / Ctrl+S = save all · Ctrl+Z = cancel changes · Esc = exit">
        <Button variant="soft-danger" icon={Undo2} onClick={reset}>Cancel Changes (Ctrl+Z)</Button>
        
        <div className="ml-auto"><ExitButton /></div>
      </PageActions>
      <Drawer open={changeCust} onClose={() => setChangeCust(false)} size="md" icon={UserCog} title="Change customer" footer={<Button icon={Plus} onClick={() => setChangeCust(false)}>Done</Button>}>
        <CustomerPicker value={null} onChange={(c) => { if (c) { setCustomer(c); setChangeCust(false); } }} />
      </Drawer>
    </div>
  );
}
