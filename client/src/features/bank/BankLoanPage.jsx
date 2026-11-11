import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, LogOut, ListChecks, Eraser, CheckSquare, X, ScanLine } from 'lucide-react';
import { ImagePreview } from '@/components/common/ImagePreview';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, DataTable, Drawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { amount, date, n, round2, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { NeedBranch } from '@/components/common/NeedBranch';

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
  if (isAllBranches) return <NeedBranch action="make a bank loan" />;
  if (lk && !banks.length) return <div className="card space-y-3 p-6 text-sm"><p>No bank for bank loans (potali) found. Add the bank in Bank Accounts, or set its Used For to Pledge or Both.</p><Button onClick={() => navigate('/bank/accounts')}>Open Bank Accounts</Button></div>;

  const tile = (l, v, h, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );
  return (
    /* fit-screen: the page fits the window; tables and panels scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Bank Loan</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Pledge customer loans with a bank</p></div>
        <div className="rounded-md border border-white/15 px-3 py-1 text-center"><p className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Billing date</p><p className="font-bold">{dayjs().format('DD/MM/YYYY')}</p></div>
        <div className="rounded-md bg-white px-3 py-1 text-center text-ink-900"><p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Gold rate</p><p className="font-bold">{goldRate ? amount(goldRate.market_rate) : 'not set'}</p></div>
      </section>
      <div className="grid gap-x-2 gap-y-2 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900 sm:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr]">
        <Field label="Bank / branch"><Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })} placeholder="Select bank" options={banks.map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))} /></Field>
        <Field label="Bank loan no"><Input value={f.pledge_no} onChange={(e) => setF({ ...f, pledge_no: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" max={today()} value={f.pledge_date} onChange={(e) => setF({ ...f, pledge_date: e.target.value })} /></Field>
        <Field label="Bank loan amount"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Interest % / year"><Input type="number" value={f.interest_rate} onChange={(e) => setF({ ...f, interest_rate: e.target.value, rate_monthly: e.target.value ? (n(e.target.value) / 12).toFixed(3) : '' })} /></Field>
        <Field label="% / month"><Input type="number" value={f.rate_monthly} onChange={(e) => setF({ ...f, rate_monthly: e.target.value, interest_rate: e.target.value ? (n(e.target.value) * 12).toFixed(2) : '' })} /></Field>
        <Field label="Bank charges"><Input type="number" value={f.charges} onChange={(e) => setF({ ...f, charges: e.target.value })} /></Field>
        <Field label="Cash received"><Input readOnly className="bg-ink-50" value={amount(cash)} /></Field>
        <div className="flex items-end gap-2 sm:col-span-4 xl:col-span-8">
          <Field label="Scan barcode / type loan no" className="w-72"><Input ref={scan} autoFocus prefix={<ScanLine className="size-4" />} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /></Field>
          <Button variant="outline" icon={Plus} onClick={add}>Add Loan (Enter)</Button>
          <Button variant="outline" icon={ListChecks} onClick={openPick}>Pick from List (F4)</Button>
          <Field label="Amount received in" className="ml-auto w-56"><Select value={f.received_mode} onChange={(e) => setF({ ...f, received_mode: e.target.value })} options={[{ value: 'BANK', label: 'Same bank account' }, { value: 'CASH', label: 'Cash' }]} /></Field>
          <Field label="Minimum days" className="w-36"><Input type="number" value={f.min_days} onChange={(e) => setF({ ...f, min_days: e.target.value })} /></Field>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
        {tile('Loans added', added.length, `${new Set(added.map((l) => l.customer_name)).size} customers`, 'bg-navy-800')}
        {tile('Our loan amount', `Rs. ${amount(sum('principal'))}`, 'given to customers', 'bg-blue-600')}
        {tile('Weight', `${weight(sum('net_wt'))} g`, `Gold · Silver ${weight(metalWt(added, true))} g`, 'bg-amber-500')}
        {tile('Market value', `Rs. ${amount(market)}`, goldRate ? `board rate ${dayjs().format('DD/MM/YYYY')}` : 'rate not set', 'bg-lime-700')}
        {tile('Bank amount', `Rs. ${amount(f.amount || 0)}`, sum('principal') ? `${Math.round((n(f.amount) / sum('principal')) * 100)}% of our loan · ${market ? Math.round((n(f.amount) / market) * 100) : 0}% of value` : '', 'bg-fuchsia-600')}
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
        <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full text-[12px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['S.No', 'Loan No', 'Pledge Date', 'Customer', 'Metal', 'Items', 'Net Wt', 'Loan Amount'].map((h, i) => <th key={h} className={clsx('px-2 py-1.5 font-semibold', i > 5 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!added.length && <tr><td colSpan={8} className="py-8 text-center text-[12px] text-ink-400">Scan or type the loans going to the bank, or pick from the list (F4)</td></tr>}
              {added.map((l, i) => (
                <tr key={l.id} onClick={() => setCur(l)} className={clsx('cursor-pointer', cur?.id === l.id && 'bg-emerald-50 dark:bg-emerald-950/30')}>
                  <td className="px-2 py-1.5">{i + 1}</td><td className="px-2 font-semibold">{l.bill_no}</td><td className="px-2">{date(l.loan_date)}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.loan_on}</td><td className="px-2">{l.item_summary}</td>
                  <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right">{amount(l.principal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 text-[13px] xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Selected loan</p>
          <ImagePreview src={cur?.item_photo} title={cur ? `Item photo · Loan #${cur.bill_no}` : 'Item photo'} className="grid h-32 shrink-0 place-items-center rounded-md border border-dashed border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">{cur?.item_photo ? <img src={cur.item_photo} alt="" className="size-full object-contain" /> : <span className="text-[11px] text-ink-400">No photo</span>}</ImagePreview>
          <p className="label pt-1">Items</p>
          <table className="w-full text-xs">
            <thead className="bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="px-2 py-1 text-left">Item</th><th className="px-2 text-right">Pcs</th><th className="px-2 text-right">Net Wt</th><th className="px-2 text-right">Purity</th></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!curItems.length && <tr><td colSpan={4} className="py-4 text-center text-ink-400">{cur ? (curFull.isLoading ? 'Loading...' : cur.item_summary || '-') : '-'}</td></tr>}
              {curItems.map((i) => <tr key={i.id}><td className="px-2 py-1">{i.item_name}</td><td className="num px-2 text-right">{i.pcs}</td><td className="num px-2 text-right">{weight(i.net_wt)}</td><td className="num px-2 text-right">{n(i.purity)}</td></tr>)}
            </tbody>
          </table>
          {[['Loan amount', cur ? amount(cur.current_principal) : '-'], ['Pending loans', loans.length - sel.length], ['Customer', cur ? `${cur.customer_name}${cur.relation_name ? ` ${cur.relation_type || ''} ${cur.relation_name}` : ''}` : '-']].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-ink-200 py-0.5 last:border-0 dark:border-ink-700"><span className="text-ink-500">{k}</span><b className="text-right">{v}</b></div>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="soft-danger" icon={Plus} onClick={() => { setF(blank()); setSel([]); setCur(null); }}>New (Ctrl+N)</Button>
        <Button variant="soft-danger" icon={Trash2} disabled={!cur} onClick={remove}>Remove Loan (Del)</Button>
        <span className="flex-1" />
        <Button variant="gold" icon={Save} loading={saving} onClick={() => save()}>Save Bank Loan (F2)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
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
            <button key={v} type="button" onClick={() => setPf({ ...pf, metal: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', pf.metal === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{pf.metal === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{t}</button>
          ))}</div></div>
          <Field label="Pledged from"><Input type="date" value={pf.from} onChange={(e) => setPf({ ...pf, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={pf.to} onChange={(e) => setPf({ ...pf, to: e.target.value })} /></Field>
          <Field label="Search" className="w-56"><Input value={pf.search} onChange={(e) => setPf({ ...pf, search: e.target.value })} placeholder="Loan no / customer / item" /></Field>
          <p className="ml-auto pb-2 text-sm font-bold text-navy-900 dark:text-white">Ticked: {ticked.length} loans · Rs. {amount(ticked.reduce((t, l) => t + n(l.current_principal), 0))} · {weight(ticked.reduce((t, l) => t + n(l.net_wt), 0))} g</p>
        </div>
        <DataTable fill selectable selected={pickSel} onSelect={setPickSel} rows={pickRows} columns={[
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
