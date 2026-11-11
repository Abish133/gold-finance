import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, LogOut, ListChecks, Eraser, CheckSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, DataTable, Drawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { amount, date, n, round2, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const blank = () => ({ bank_account_id: '', pledge_no: '', pledge_date: today(), amount: '', interest_rate: '', rate_monthly: '', charges: '', min_days: '', received_mode: 'BANK' });

/** Bank Loan (desktop: Pledge to Bank) - pledge our customers' loans with a bank. */
export default function BankLoanPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAllBranches } = useAuth();
  const { data: lk } = useLookups();
  const avail = useFetch(isAllBranches ? null : '/bank/pledges/available-loans');
  const [f, setF] = useState(blank());
  const [sel, setSel] = useState([]);
  const [cur, setCur] = useState(null);
  const [code, setCode] = useState('');
  const [pick, setPick] = useState(false);
  const [pickSel, setPickSel] = useState([]);
  const [pf, setPf] = useState({ metal: '', from: '', to: today(), search: '' });
  const curFull = useFetch(cur ? `/loans/${cur.id}` : null);
  const curItems = curFull.data?.items || [];
  const [saving, setSaving] = useState(false);
  const scan = useRef(null);
  const banks = (lk?.banks || []).filter((b) => b.used_for !== 'OPERATING');
  const loans = avail.data || [];
  const added = useMemo(() => sel.map((id) => loans.find((l) => l.id === id)).filter(Boolean), [sel, loans]);
  const goldRate = (lk?.rates || []).filter((r) => r.metal_id === lk.metals.find((m) => m.code === 'GOLD')?.id).sort((x, y) => n(y.purity) - n(x.purity))[0];
  // desktop: value at today's board rate = fine weight x 100% rate (rupees, not rounded to 100)
  const fine100 = goldRate ? n(goldRate.market_rate) * 100 / (n(goldRate.purity) || 100) : 0;
  const valueOf = (l) => Math.round(n(l.net_wt) * n(l.avg_purity || 91.6) / 100 * 1000) / 1000 * fine100;
  const sum = (k) => added.reduce((s, l) => s + n(l[k]), 0);
  const metalWt = (rows, silver) => rows.filter((l) => (l.loan_on === 'SILVER') === silver).reduce((s, l) => s + n(l.net_wt), 0);
  const firstDate = loans.reduce((m, l) => (!m || String(l.loan_date).slice(0, 10) < m ? String(l.loan_date).slice(0, 10) : m), '');
  const pickRows = loans.filter((l) => !sel.includes(l.id)).filter((l) => {
    const d = String(l.loan_date).slice(0, 10);
    const q = pf.search.trim().toLowerCase();
    return (!pf.metal || l.loan_on === pf.metal) && (!pf.from || d >= pf.from) && (!pf.to || d <= pf.to)
      && (!q || `${l.bill_no} ${l.manual_bill_no || ''} ${l.customer_name} ${l.item_summary || ''}`.toLowerCase().includes(q));
  });
  const ticked = loans.filter((l) => pickSel.includes(l.id));
  const openPick = () => { setPickSel([]); setPf({ metal: '', from: firstDate, to: today(), search: '' }); setPick(true); };
  const market = Math.floor(added.reduce((s, l) => s + valueOf(l), 0));
  const cash = round2(n(f.amount) - n(f.charges));
  const add = () => {
    const v = code.trim(); if (!v) return;
    const hit = loans.find((l) => l.bill_no === v || l.manual_bill_no === v);
    if (!hit) toast.error(`Loan ${v} is not available (released, or already at bank)`);
    else if (sel.includes(hit.id)) toast.info(`Loan ${v} is already added`);
    else { setSel([...sel, hit.id]); setCur(hit); }
    setCode(''); scan.current?.focus();
  };
  const remove = () => { if (cur) { setSel(sel.filter((x) => x !== cur.id)); setCur(null); } };
  const [ask, setAsk] = useState(false);
  // desktop asks first: "Save bank loan 1 with TEST BANK? Customer loans, bank loan amount, cash received"
  const save = async (sure) => {
    if (!f.bank_account_id || !f.pledge_no || !n(f.amount)) return toast.error('Enter bank, bank loan no and amount');
    if (!sel.length) return toast.error('Add the loans pledged with the bank');
    if (sure !== true) return setAsk(true);
    setAsk(false);
    setSaving(true);
    try { await api.post('/bank/pledges', { ...f, loan_ids: sel }); toast.success(`Bank loan ${f.pledge_no} saved · ${sel.length} loans`); qc.invalidateQueries({ queryKey: ['/bank/pledges'] }); avail.refetch(); setF(blank()); setSel([]); setCur(null); } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: () => save(), f4: openPick, 'ctrl+n': () => { setF(blank()); setSel([]); setCur(null); }, delete: remove, escape: () => navigate('/') }, [f, sel, cur, firstDate]);
  if (isAllBranches) return <div className="card p-6 text-sm">Select a branch to make a bank loan.</div>;
  if (lk && !banks.length) return <div className="card space-y-3 p-6 text-sm"><p>No bank for bank loans (potali) found. Add the bank in Bank Accounts, or set its Used For to Pledge or Both.</p><Button onClick={() => navigate('/bank/accounts')}>Open Bank Accounts</Button></div>;

  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Bank Loan</h1><p className="text-sm text-navy-100">Pledge customer loans with a bank</p></div>
        <div className="rounded-md bg-white/10 px-4 py-1.5 text-center"><p className="text-[11px] font-bold uppercase">Billing date</p><p className="font-bold">{dayjs().format('DD/MM/YYYY')}</p></div>
        <div className="rounded-md bg-white px-4 py-1.5 text-center text-ink-900"><p className="text-[11px] font-bold uppercase">Gold rate</p><p className="font-bold">{goldRate ? amount(goldRate.market_rate) : 'not set'}</p></div>
      </section>
      <div className="card grid gap-3 px-4 py-3 sm:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]">
        <Field label="Bank / branch"><Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })} placeholder="Select bank" options={banks.map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))} /></Field>
        <Field label="Bank loan no"><Input value={f.pledge_no} onChange={(e) => setF({ ...f, pledge_no: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" max={today()} value={f.pledge_date} onChange={(e) => setF({ ...f, pledge_date: e.target.value })} /></Field>
        <Field label="Bank loan amount"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Interest % / year"><Input type="number" value={f.interest_rate} onChange={(e) => setF({ ...f, interest_rate: e.target.value, rate_monthly: e.target.value ? (n(e.target.value) / 12).toFixed(3) : '' })} /></Field>
        <Field label="% / month"><Input type="number" value={f.rate_monthly} onChange={(e) => setF({ ...f, rate_monthly: e.target.value, interest_rate: e.target.value ? (n(e.target.value) * 12).toFixed(2) : '' })} /></Field>
        <Field label="Bank charges"><Input type="number" value={f.charges} onChange={(e) => setF({ ...f, charges: e.target.value })} /></Field>
        <Field label="Cash received"><Input readOnly className="bg-ink-50" value={amount(cash)} /></Field>
        <div className="flex items-end gap-2 sm:col-span-4 xl:col-span-8">
          <Field label="Scan barcode / type loan no" className="w-72"><Input ref={scan} autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /></Field>
          <Button variant="outline" icon={Plus} onClick={add}>Add Loan (Enter)</Button>
          <Button variant="outline" icon={ListChecks} onClick={openPick}>Pick from List (F4)</Button>
          <Field label="Amount received in" className="ml-auto w-56"><Select value={f.received_mode} onChange={(e) => setF({ ...f, received_mode: e.target.value })} options={[{ value: 'BANK', label: 'Same bank account' }, { value: 'CASH', label: 'Cash' }]} /></Field>
          <Field label="Minimum days" className="w-36"><Input type="number" value={f.min_days} onChange={(e) => setF({ ...f, min_days: e.target.value })} /></Field>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {tile('Loans added', added.length, `${new Set(added.map((l) => l.customer_name)).size} customers`, 'border-t-navy-800')}
        {tile('Our loan amount', `Rs. ${amount(sum('principal'))}`, 'given to customers', 'border-t-blue-600')}
        {tile('Weight', `${weight(sum('net_wt'))} g`, `Gold · Silver ${weight(metalWt(added, true))} g`, 'border-t-amber-500')}
        {tile('Market value', `Rs. ${amount(market)}`, goldRate ? `board rate ${dayjs().format('DD/MM/YYYY')}` : 'rate not set', 'border-t-lime-700')}
        {tile('Bank amount', `Rs. ${amount(f.amount || 0)}`, sum('principal') ? `${Math.round((n(f.amount) / sum('principal')) * 100)}% of our loan · ${market ? Math.round((n(f.amount) / market) * 100) : 0}% of value` : '', 'border-t-fuchsia-600')}
      </div>
      <div className="grid items-stretch gap-3 xl:grid-cols-[1fr_380px]">
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr>{['S.No', 'Loan No', 'Pledge Date', 'Customer', 'Metal', 'Items', 'Net Wt', 'Loan Amount'].map((h, i) => <th key={h} className={clsx('px-2 py-2', i > 5 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {!added.length && <tr><td colSpan={8} className="py-16 text-center text-ink-400">Scan or type the loans going to the bank, or pick from the list (F4)</td></tr>}
              {added.map((l, i) => (
                <tr key={l.id} onClick={() => setCur(l)} className={clsx('cursor-pointer', cur?.id === l.id && 'bg-navy-50 dark:bg-ink-800')}>
                  <td className="px-2 py-1.5">{i + 1}</td><td className="px-2 font-semibold">{l.bill_no}</td><td className="px-2">{date(l.loan_date)}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.loan_on}</td><td className="px-2">{l.item_summary}</td>
                  <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right">{amount(l.principal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <p className="text-xs font-bold text-navy-900 uppercase dark:text-white">Selected loan</p>
          <div className="grid h-40 place-items-center overflow-hidden rounded border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">{cur?.item_photo ? <img src={cur.item_photo} alt="" className="size-full object-cover" /> : <span className="text-xs text-ink-400">No photo</span>}</div>
          <p className="label pt-1">Items</p>
          <table className="w-full text-xs">
            <thead className="bg-navy-800 text-white"><tr><th className="px-2 py-1 text-left">Item</th><th className="px-2 text-right">Pcs</th><th className="px-2 text-right">Net Wt</th><th className="px-2 text-right">Purity</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {!curItems.length && <tr><td colSpan={4} className="py-4 text-center text-ink-400">{cur ? (curFull.isLoading ? 'Loading...' : cur.item_summary || '-') : '-'}</td></tr>}
              {curItems.map((i) => <tr key={i.id}><td className="px-2 py-1">{i.item_name}</td><td className="num px-2 text-right">{i.pcs}</td><td className="num px-2 text-right">{weight(i.net_wt)}</td><td className="num px-2 text-right">{n(i.purity)}</td></tr>)}
            </tbody>
          </table>
          {[['Loan amount', cur ? amount(cur.current_principal) : '-'], ['Pending loans', loans.length - sel.length], ['Customer', cur ? `${cur.customer_name}${cur.relation_name ? ` ${cur.relation_type || ''} ${cur.relation_name}` : ''}` : '-']].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><span className="text-ink-500">{k}</span><b className="text-right">{v}</b></div>
          ))}
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Plus} onClick={() => { setF(blank()); setSel([]); setCur(null); }}>New (Ctrl+N)</Button>
        <Button variant="soft-danger" icon={Trash2} disabled={!cur} onClick={remove}>Remove Loan (Del)</Button>
        <span className="flex-1" />
        <Button variant="gold" icon={Save} loading={saving} onClick={() => save()}>Save Bank Loan (F2)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <Drawer open={pick} onClose={() => setPick(false)} size="xl" icon={ListChecks} title="Pick Loans for Bank" subtitle={`${loans.length - sel.length} loans in hand (not released, not in a bank)`}
        footer={<>
          <Button variant="outline" icon={CheckSquare} onClick={() => setPickSel([...new Set([...pickSel, ...pickRows.map((l) => l.id)])])}>Tick All</Button>
          <Button variant="outline" icon={Eraser} onClick={() => setPickSel([])}>Clear</Button>
          <span className="flex-1" />
          <Button variant="gold" icon={Plus} disabled={!pickSel.length} onClick={() => { setSel([...new Set([...sel, ...pickSel])]); setPick(false); }}>Add Ticked Loans</Button>
          <Button variant="outline" icon={X} onClick={() => setPick(false)}>Cancel (Esc)</Button>
        </>}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div><p className="label">Metal</p><div className="flex gap-1">{[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setPf({ ...pf, metal: v })} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', pf.metal === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{t}</button>
          ))}</div></div>
          <Field label="Pledged from"><Input type="date" value={pf.from} onChange={(e) => setPf({ ...pf, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={pf.to} onChange={(e) => setPf({ ...pf, to: e.target.value })} /></Field>
          <Field label="Search" className="w-56"><Input value={pf.search} onChange={(e) => setPf({ ...pf, search: e.target.value })} placeholder="Loan no / customer / item" /></Field>
          <p className="ml-auto pb-2 text-sm font-bold text-navy-900 dark:text-white">Ticked: {ticked.length} loans · Rs. {amount(ticked.reduce((t, l) => t + n(l.current_principal), 0))} · {weight(ticked.reduce((t, l) => t + n(l.net_wt), 0))} g</p>
        </div>
        <DataTable dense selectable selected={pickSel} onSelect={setPickSel} rows={pickRows} columns={[
          { key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Pledge Date', type: 'date' }, { key: 'customer_name', label: 'Customer' }, { key: 'loan_on', label: 'Metal' }, { key: 'item_summary', label: 'Items' },
          { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'current_principal', label: 'Amount', type: 'money' },
        ]} />
      </Drawer>
      <ConfirmDrawer open={ask} onClose={() => setAsk(false)} onConfirm={() => save(true)} tone="primary" loading={saving} confirmText="Yes, save"
        title={`Save bank loan ${f.pledge_no} with ${banks.find((b) => String(b.id) === String(f.bank_account_id))?.bank_name || 'the bank'}?`}>
        <div className="space-y-1 text-sm">
          <p>Customer loans: <b>{sel.length}</b> (Rs. {amount(sum('principal'))}, {weight(sum('net_wt'))} g)</p>
          <p>Bank loan amount: <b>Rs. {amount(f.amount || 0)}</b></p>
          <p>Cash received: <b>Rs. {amount(n(f.amount) - n(f.charges))}</b></p>
        </div>
      </ConfirmDrawer>
    </div>
  );
}
