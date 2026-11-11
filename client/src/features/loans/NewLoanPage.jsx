import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Printer, Tag, CheckCircle2, AlertTriangle, UserPlus, ListChecks, FileText, Search, BookOpen, Layers, IndianRupee, Percent, TrendingUp, Receipt, Wallet, Coins, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer, ConfirmDrawer, Field, Input, Select, Spinner, Avatar, Badge } from '@/components/ui';
import { LoanEstimate } from '@/features/print/LoanEstimate';
import { CustomerFormDrawer } from '@/features/customers/CustomerFormDrawer';
import { useLookups, useSettings, useFetch, useList } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { printElement } from '@/lib/print';
import { Stickers } from '@/features/print/Sticker';
import { api } from '@/lib/api';
import { money, amount, n, round2, today, weight, date } from '@/lib/format';
import { whatsappAfterSave } from '@/lib/whatsapp';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, ItemPhotoPanel, ItemEntry, ItemsTable, LtvBar, CustomerCard, CustomerLedgerDrawer, computeItem, PayDrawer, INTEREST_TYPES, fineRate } from './desk';
import { NeedBranch } from '@/components/common/NeedBranch';

const parseSlabs = (s) => (typeof s === 'string' ? JSON.parse(s) : s) || [];

/* Find Customer (desktop dialog): Name / Mobile / A/c No / Area, Down = list, Enter = select, F1 = new */
function FindCustomerDrawer({ open, initial, by: by0, onClose, onPick, onNew }) {
  const [by, setBy] = useState(by0 || 'name');
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);
  const tableBox = useRef(null);
  useEffect(() => { tableBox.current?.querySelector('tbody')?.children[idx]?.scrollIntoView({ block: 'nearest' }); }, [idx]);
  useEffect(() => { if (open) { setQ(initial || ''); setBy(by0 === 'mobile' || by0 === 'acno' ? by0 : 'name'); setIdx(0); setTimeout(() => input.current?.focus(), 60); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const dq = useDebounce(q, 200);
  const list = useList('/customers', { search: dq, by, pageSize: 50, sort: 'name', order: 'asc' }, { enabled: open && dq.length >= 1 });
  const rows = list.data?.data || [];
  const pick = (c) => { if (!c) return; if (c.status === 'BLOCKED') return toast.error(`${c.name} is blocked: ${c.block_reason || ''}`); onPick(c); };
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(rows.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(rows[idx]); }
    if (e.key === 'F1') { e.preventDefault(); onNew(); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={Search} bodyClassName="!px-4 !py-3 !overflow-hidden" title="Find Customer" subtitle="Type name, mobile, A/c no or area - Down = list, Enter = select, F1 = new customer"
      footer={<><Button variant="outline" icon={UserPlus} onClick={onNew}>New Customer (F1)</Button><span className="flex-1" /><Button variant="soft-danger" onClick={onClose}>Cancel (Esc)</Button><Button variant="gold" disabled={!rows[idx]} onClick={() => pick(rows[idx])}>Select (Enter)</Button></>}>
      <div className="flex h-full min-h-0 flex-col gap-2" onKeyDown={keys}>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Input ref={input} prefix={<Search className="size-4" />} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Type to search…"
            className="!h-10 min-w-64 flex-1 text-base font-bold" />
          <div className="flex">
            {[['name', 'Name'], ['mobile', 'Mobile'], ['acno', 'A/c No'], ['area', 'Area']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setBy(k); input.current?.focus(); }}
                className={clsx('-ml-px flex h-10 min-w-20 items-center justify-center gap-1.5 border px-3 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md',
                  by === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>
                {by === k && (
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
                  </span>
                )}
                {l}
              </button>
            ))}
          </div>
        </div>
        {/* the table fills the drawer; only its rows scroll, the header stays */}
        <div ref={tableBox} className="min-h-0 flex-1 overflow-auto rounded-md border border-ink-200 dark:border-ink-700">
          <table className="w-full text-[13px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[11px] tracking-wider text-white uppercase">
              <tr><th className="w-14 px-2 py-1.5 font-semibold">A/c</th><th className="px-2 text-left font-semibold">Name</th><th className="px-2 text-left font-semibold">Address</th><th className="px-2 text-left font-semibold">Mobile</th><th className="w-20 px-2 font-semibold">Loans</th><th className="w-20 px-2 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!rows.length && (
                <tr><td colSpan={6} className="py-10 text-center text-[13px] text-ink-400">
                  <Search className="mx-auto mb-1.5 size-5" />
                  {dq ? (list.isFetching ? 'Searching…' : 'No customer found - press F1 to add') : 'Start typing to search'}
                </td></tr>
              )}
              {rows.map((c, i) => (
                <tr key={c.id} onMouseEnter={() => setIdx(i)} onClick={() => pick(c)}
                  className={clsx('cursor-pointer', i === idx ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  <td className={clsx('num border-l-2 px-2 py-1.5 text-center', i === idx ? 'border-emerald-600' : 'border-transparent')}>{c.customer_no}</td>
                  <td className="px-2 font-semibold">{c.title} {c.name}{c.relation_name ? <span className="font-normal text-ink-500"> {c.relation_type || ''} {c.relation_name}</span> : ''}</td>
                  <td className="max-w-64 truncate px-2 text-ink-600 dark:text-ink-400">{[c.street, c.area, c.city].filter(Boolean).join(', ')}</td>
                  <td className="num px-2">{c.phone}</td>
                  <td className="num px-2 text-center">{n(c.open_loans) || '-'}</td>
                  <td className="px-2 text-center"><span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold', c.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="shrink-0 text-[11px] text-ink-500">{rows.length} customer{rows.length === 1 ? '' : 's'} found{rows.length ? ' · ↑ ↓ to move, Enter to select' : ''}</p>
      </div>
    </Drawer>
  );
}

/* Customer panel: Mobile / Name / A-c No / Loan No + card with open loans, interest due today, last loan */
function CustomerSearch({ value, onChange, onNew, nameFirst = true }) {
  const [by, setBy] = useState(nameFirst ? 'name' : 'mobile');
  const [q, setQ] = useState('');
  const [find, setFind] = useState(false);
  const [ledger, setLedger] = useState(false);
  const summary = useFetch(value ? `/customers/${value.id}/summary` : null);
  useEffect(() => { setQ(value ? value.name : ''); }, [value]);
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
  const placeholder = { mobile: 'Type mobile number', name: 'Type customer name', acno: 'Type A/c no', loan: 'Loan no + Enter' }[by];
  return (
    <Panel title="Customer">
      <div className="mb-2 grid grid-cols-4 gap-1">
        {[['mobile', 'Mobile'], ['name', 'Name'], ['acno', 'A/c No'], ['loan', 'Loan No']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setBy(k)}
            className={clsx('flex items-center justify-center gap-1.5 rounded-md border px-1 py-1 text-[12px] font-semibold transition',
              by === k ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-300 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>
            {by === k && (
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
              </span>
            )}
            {l}
          </button>
        ))}
      </div>
      <div className="mb-3"><Input prefix={<Search className="size-3.5" />} autoFocus value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); if (by !== 'loan' && e.target.value) { if (value) onChange(null); setFind(true); } }}
        onKeyDown={(e) => { if (e.key === 'Enter' && by === 'loan') findByLoan(); if ((e.key === 'Enter' || e.key === 'ArrowDown') && by !== 'loan') setFind(true); }}
        className="h-10 font-semibold" /></div>
      <CustomerCard customer={value} onNew={onNew} onLedger={value ? () => setLedger(true) : null}
        rows={[['Open loans', value ? (t ? (n(t.open_loans) ? `${t.open_loans} · ${money(t.outstanding)}` : 'none') : '…') : '-'], ['Interest due today', t && n(t.interest_due) ? money(t.interest_due) : '-'], ['Last loan', value ? (last ? `#${last.bill_no} · ${date(last.loan_date)}` : 'first loan') : '-']]} />
      <FindCustomerDrawer open={find} initial={q} by={by} onClose={() => setFind(false)} onPick={(c) => { setFind(false); onChange(c); }} onNew={() => { setFind(false); onNew(); }} />
      <CustomerLedgerDrawer customerId={ledger ? value?.id : null} onClose={() => setLedger(false)} />
    </Panel>
  );
}

/* Paper bill book number (desktop: Manual Bill Book No) - checked as free before saving */
function BillBookDrawer({ open, first, initial, onClose, onOk }) {
  const [no, setNo] = useState('');
  const [chk, setChk] = useState(null);
  const dno = useDebounce(no, 250);
  useEffect(() => { if (open) setNo(String(initial || 1)); }, [open, initial]);
  useEffect(() => { if (!open || !dno) return setChk(null); api.get('/loans/bill-book-free', { no: dno }).then((r) => setChk(r.data)).catch(() => setChk(null)); }, [dno, open]);
  const ok = () => { if (!no.trim()) return toast.error('Enter bill book number'); if (chk && !chk.free) return toast.error(`Already used on loan ${chk.used_by}`); onOk(no.trim()); };
  return (
    <Drawer open={open} onClose={onClose} size="sm" icon={BookOpen} title="Manual Bill Book No" subtitle={first ? 'First loan - enter the starting number of your paper bill book' : 'Paper bill book number for this loan'}
      footer={<><Button variant="soft-danger" onClick={onClose}>Cancel (Esc)</Button><Button variant="gold" onClick={ok}>OK (Enter)</Button></>}>
      <Field label={first ? 'Bill book starting no.' : 'Bill book no.'}>
        <Input autoFocus className="h-14 bg-gold-50 text-center text-2xl font-bold" value={no} onChange={(e) => setNo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} />
      </Field>
      {chk && <p className={clsx('mt-2 text-sm font-semibold', chk.free ? 'text-emerald-700' : 'text-rose-600')}>{chk.free ? 'Free - can be used' : `Already used on loan ${chk.used_by}`}</p>}
      {first && <p className="mt-1 text-xs text-ink-500">No bill book number used yet. Next loans continue from this number automatically.</p>}
    </Drawer>
  );
}

/* Mark old loans (Ctrl+M) */
function MarkOldDrawer({ open, onClose }) {
  const list = useList('/loans', { status: 'OPEN', entry_type: 'NEW', pageSize: 200 }, { enabled: open });
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState('');
  const qc = useQueryClient();
  useEffect(() => { if (open) { setSel([]); setQ(''); } }, [open]);
  const all = list.data?.data || [];
  const term = q.trim().toLowerCase();
  const rows = term ? all.filter((l) => `${l.bill_no} ${l.manual_bill_no || ''} ${l.customer_name} ${l.customer_phone || ''}`.toLowerCase().includes(term)) : all;
  const allOn = rows.length > 0 && rows.every((l) => sel.includes(l.id));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const toggleAll = () => setSel((x) => (allOn ? x.filter((id) => !rows.some((l) => l.id === id)) : [...new Set([...x, ...rows.map((l) => l.id)])]));
  const picked = all.filter((l) => sel.includes(l.id));
  const run = async () => {
    try { const r = await api.post('/loans/mark-old', { ids: sel }); toast.success(`${r.data.marked.length} loans marked as old (opening)`); setSel([]); qc.invalidateQueries({ queryKey: ['/loans'] }); onClose(); } catch (e) { toast.error(e.message); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={ListChecks} title="Mark old loans" subtitle="Turn loans typed as NEW into opening entries - removes them from today's cash. Only loans without receipts."
      bodyClassName="flex !px-4 !py-3 !overflow-hidden"
      footer={<>
        <p className="mr-auto text-[12px] text-ink-500">{picked.length ? <><b className="text-navy-900 dark:text-white">{picked.length}</b> selected · ₹{amount(picked.reduce((t, l) => t + n(l.principal), 0))}</> : 'Tick the loans that are really old paper loans'}</p>
        <Button variant="soft-danger" onClick={onClose}>Cancel (Esc)</Button>
        <Button variant="gold" disabled={!sel.length} onClick={run}>Mark {sel.length || ''} as old</Button>
      </>}>
      <div className="flex min-h-0 w-full flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex-1"><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Search loan no, bill book, customer or mobile…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <span className="text-[11px] whitespace-nowrap text-ink-500">{rows.length} of {all.length} loans</span>
        </div>
        {/* rows scroll, header stays */}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-ink-200 dark:border-ink-800">
          <table className="w-full text-[13px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase">
              <tr>
                <th className="w-10 px-3 py-1.5"><input type="checkbox" className="size-3.5 accent-emerald-600" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
                <th className="px-2 text-left font-semibold">Loan</th><th className="px-2 text-left font-semibold">Bill book</th><th className="px-2 text-left font-semibold">Date</th>
                <th className="px-2 text-left font-semibold">Customer</th><th className="px-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {list.isLoading && <tr><td colSpan={6} className="py-10 text-center text-ink-400">Loading…</td></tr>}
              {!list.isLoading && !rows.length && <tr><td colSpan={6} className="py-10 text-center text-[12px] text-ink-400">{all.length ? 'No loan matches the search' : 'No new loans without receipts'}</td></tr>}
              {rows.map((l) => {
                const on = sel.includes(l.id);
                return (
                  <tr key={l.id} onClick={() => toggle(l.id)} className={clsx('cursor-pointer', on ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                    <td className={clsx('border-l-2 px-3 py-1', on ? 'border-emerald-600' : 'border-transparent')}><input type="checkbox" className="size-3.5 accent-emerald-600" checked={on} onChange={() => toggle(l.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="num px-2 font-bold">{l.bill_no}</td>
                    <td className="num px-2 text-ink-500">{l.manual_bill_no || '-'}</td>
                    <td className="num px-2">{date(l.loan_date)}</td>
                    <td className="max-w-64 truncate px-2 font-medium">{l.customer_name}</td>
                    <td className="num px-2 text-right font-semibold">{amount(l.principal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
  const [step, setStep] = useState(null); // 'book' | 'pay'
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
  const oldOpen = (custLoans.data || []).filter((l) => dayjs().diff(dayjs(l.loan_date), 'month') >= warnMonths);

  // old loans: rates come from the Rate Master, can be changed
  useEffect(() => { if (isOld && lk && !f.gold_rate && !f.silver_rate) set({ gold_rate: fineRate(todayGold) ? String(fineRate(todayGold)) : '', silver_rate: fineRate(todaySilver) ? String(fineRate(todaySilver)) : '' }); }, [isOld, lk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = params.get('customer'); if (id) api.get(`/customers/${id}`).then((r) => setCustomer(r.data)).catch(() => {}); }, [params]);

  const metals = lk?.metals || [];
  const goldM = metals.find((m) => m.code === 'GOLD');
  const silverM = metals.find((m) => m.code === 'SILVER');
  const rateOf = (m) => lk?.rates.find((r) => r.metal_id === m?.id);
  const todayGold = rateOf(goldM);
  const todaySilver = rateOf(silverM);
  const rateMissing = !isOld && [loanOn !== 'SILVER' && todayGold, loanOn !== 'GOLD' && todaySilver].some((r) => r === undefined || (r && !dayjs(r.rate_date).isSame(dayjs(), 'day')));
  // 100% (fine) rates, like the desktop Rate Master top row
  const rates = { gold: isOld ? f.gold_rate : fineRate(todayGold), silver: isOld ? f.silver_rate : fineRate(todaySilver) };

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
  const roundTo = n(settings?.ROUND_LOAN_TO) || 100;
  const ltvMax = n(scheme?.ltv_percent || 75);
  const eligible = Math.floor((tot.value * ltvMax) / 100 / roundTo) * roundTo;
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
    mutationFn: ({ payments = [], book } = {}) => api.post(isOld ? '/loans/old' : '/loans', {
      customer_id: customer?.id, scheme_id: Number(schemeId), loan_on: loanOn, interest_type: f.interest_type,
      rate_per_gram: n(rates.gold), silver_rate: n(rates.silver),
      items: rows.map(({ key, metal, ...r }) => ({ ...r, metal_id: metal === 'SILVER' ? silverM?.id : goldM?.id, rate_basis: 100 })),
      principal, interest_rate: n(f.interest_rate), doc_charges: doc, advance_interest: advance, other_charges: n(f.other_charges),
      loan_date: f.loan_date, due_date: f.due_date, manual_bill_no: book ?? f.manual_bill_no, remarks: f.remarks, item_photo: photo, loan_no: f.loan_no, payments: isOld ? [] : payments,
    }),
    onSuccess: (r) => {
      setStep(null);
      ['/loans', '/loans/next-number', '/customers', '/dashboard', '/dashboard/status'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Loan details saved · Loan No ${r.data.loan.bill_no}${r.data.loan.manual_bill_no ? ` · Bill Book No ${r.data.loan.manual_bill_no}` : ''}`);
      reset();
      setDone(r.data);
      if (settings?.PRINT_AFTER_LOAN !== '0') printLoan(r.data);
      if (!isOld) whatsappAfterSave(settings, 'LOAN', r.data);   // desktop: receipt opens straight after saving (System Control PLR)
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = () => { setCustomer(null); setItems([]); setPhoto(null); setEditing(null); set({ principal: '', other_charges: '', manual_bill_no: '', remarks: '', loan_no: '' }); };
  const clear = () => { setDone(null); setStep(null); setCustomer(null); setItems([]); setPhoto(null); setEditing(null); set({ principal: '', other_charges: '', manual_bill_no: '', remarks: '', loan_no: '' }); };
  const canSave = customer && scheme && principal > 0 && rows.length && (!isOld || f.manual_bill_no) && !save.isPending;
  const ltvWarn = n(settings?.LTV_WARN_PERCENT) || 0;
  // after the LTV check: bill book number (new loans) -> pay customer -> save
  const proceed = () => {
    if (isOld) return save.mutate({});
    // desktop MBLN: ask for the hand-written bill book no (off = the next number is given by itself)
    if (!f.manual_bill_no && settings?.BILL_BOOK_ASK === '1') return setStep('book');
    return netPay > 0 ? setStep('pay') : save.mutate({});
  };
  const trySave = () => {
    if (!canSave) return;
    if (!isOld && principal > eligible && settings?.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' && scheme?.calc_mode !== 'MYBOOK') return toast.error(`Loan amount is above the eligible amount ${money(eligible)}`);
    if (ltvWarn && ltv > ltvWarn) setLtvAsk(true); else proceed();
  };
  const printEstimate = () => printElement(<LoanEstimate company={company} customer={customer} scheme={scheme} items={rows} rates={rates}
    values={{ principal, eligible, value: tot.value, ltv, rate: f.interest_rate, perMonth, advance, doc, netPay, due: f.due_date, loanOn }} />, { title: 'Loan estimate' });
  useKeys({
    f1: () => setNewCust(true), f2: trySave, 'ctrl+e': () => rows.length && printEstimate(), f6: () => set({ advance: !f.advance }), 'ctrl+n': clear,
    f4: () => isOld && document.getElementById('pledge-date')?.focus(), 'ctrl+m': () => isOld && setMarkOld(true), escape: () => navigate('/'),
  }, [canSave, f.advance, isOld, ltv, ltvWarn]);

  if (isLoading) return <Spinner />;
  if (isAllBranches) return <NeedBranch action="create loans" />;

  const right = (
    <Panel title="Loan" bodyClassName="flex flex-col gap-2">
      <div className="space-y-2">
        <Field label="Scheme"><Select prefix={<Layers className="size-3.5" />} value={schemeId} onChange={(e) => setSchemeId(e.target.value)} options={schemes.map((s) => ({ value: s.id, label: `${s.code} · ${s.name} (${n(s.ltv_percent)}%)` }))} /></Field>
        <Field label="Loan amount (₹)" error={principal > eligible && settings?.ALLOW_LOAN_ABOVE_ELIGIBLE !== '1' && scheme?.calc_mode !== 'MYBOOK' ? `Above eligible ${money(eligible)}` : null}>
          <div className="flex gap-1"><Input prefix={<IndianRupee className="size-4" />} type="number" className="h-12 text-xl font-bold" value={f.principal} onChange={(e) => set({ principal: e.target.value })} />
            <Button variant="soft" className="h-12" onClick={() => set({ principal: String(eligible) })} title="Use eligible amount">Max</Button></div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Int. % ${scheme?.rate_type === 'MONTHLY' ? 'P.M.' : 'P.A.'}`}><Input prefix={<Percent className="size-3.5" />} type="number" step="0.01" value={f.interest_rate} onChange={(e) => set({ interest_rate: e.target.value })} /></Field>
          <Field label="Interest type"><Select prefix={<TrendingUp className="size-3.5" />} value={f.interest_type} onChange={(e) => set({ interest_type: e.target.value })} options={INTEREST_TYPES} /></Field>
          <Field label="Doc. charges"><Input prefix={<Receipt className="size-3.5" />} type="number" value={f.doc_charges} onChange={(e) => set({ doc_charges: e.target.value })} /></Field>
          <Field label="Advance interest (F6)">
            <div className="flex gap-1">
              <button type="button" onClick={() => set({ advance: !f.advance })} className={clsx('h-9 w-14 shrink-0 rounded-md border text-sm font-bold', f.advance ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300')}>{f.advance ? 'Yes' : 'No'}</button>
              <Input prefix={<Wallet className="size-3.5" />} readOnly className="bg-ink-50 text-right" value={amount(advance)} />
            </div>
          </Field>
        </div>
        <LtvBar value={ltv} max={ltvMax} safe={settings?.LTV_SAFE_PERCENT} warn={settings?.LTV_WARN_PERCENT} suffix="of value" />
        <div className="overflow-hidden rounded-md border border-ink-200 text-[13px] dark:border-ink-800 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&>div]:px-2.5 [&>div:not(:last-child)]:border-b [&>div]:border-ink-100 dark:[&>div]:border-ink-800">
          <div className="py-1.5"><span className="text-ink-500">Eligible amount</span><span className="num font-bold text-navy-900 dark:text-white">{money(eligible)}</span></div>
          <div className="py-1"><span className="text-ink-500">Due date</span><Input type="date" className="!h-7 w-36 text-[13px]" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} /></div>
          <div className="py-1.5"><span className="text-ink-500">Interest / month</span><span className="num font-bold text-navy-900 dark:text-white">{perMonth ? amount(perMonth) : '-'}</span></div>
        </div>
        {isOld && (
          <div className="rounded-md bg-cream-100 p-2">
            <p className="text-xs font-bold text-gold-700 uppercase">Till today</p>
            <Line label="Running" value={till ? `${till.elapsedDays} days` : '-'} />
            <Line label="Interest due" value={till ? amount(till.interestDue) : '-'} tone="text-rose-600" />
          </div>
        )}
      </div>
      {/* pinned to the bottom of the panel */}
      <div className="mt-auto space-y-2 pt-1">
        <BigTotal label={isOld ? 'Opening entry · not in today\'s cash' : 'Amount to pay customer'} value={isOld ? principal : netPay} words={!isOld} />
        <GoldButton disabled={!canSave} loading={save.isPending && !step} onClick={trySave}>{isOld ? 'Save Old Loan (F2)' : 'Save Loan (F2)'}</GoldButton>
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
          : [{ label: 'Loan no', value: next.data?.bill_no }, { label: 'Bill book', value: f.manual_bill_no || next.data?.bill_book_next || '-' }, { label: 'Billing date', value: dayjs().format('DD/MM/YYYY') },
            { label: 'Gold · Silver', value: `${rates.gold ? amount(rates.gold) : '-'} · ${rates.silver ? amount(rates.silver) : '-'}`, gold: true }]}
        left={<>
          <CustomerSearch nameFirst={settings?.NEWLOAN_SEARCH_NAME !== '0'} value={customer} onChange={setCustomer} onNew={() => setNewCust(true)} />
          <ItemPhotoPanel value={photo} onChange={setPhoto} customerId={customer?.id} />
        </>}
        center={<>
          {oldOpen.length > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900">
              <AlertTriangle className="size-5" /> {customer.name} has {oldOpen.length} open loan(s) older than {warnMonths} months: {oldOpen.map((l) => `#${l.bill_no} (${date(l.loan_date)})`).join(', ')}. Collect interest before giving a new loan.
            </div>
          )}
          {rateMissing && (
            <div className="flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[13px] text-rose-800">
              <AlertTriangle className="size-5" /> Today's gold / silver rate is not entered for {dayjs().format('DD/MM/YYYY')}. Please enter the rate first.
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate('/masters?tab=rates')}>Enter rate</Button>
            </div>
          )}
          <Panel title={`Pledge items · ${loanOn}`}>
            {isOld && (
              <div className="mb-3 grid gap-2 border-b border-ink-200 pb-3 sm:grid-cols-4">
                <Field label="Bill book no (required)" required><Input prefix={<BookOpen className="size-3.5" />} value={f.manual_bill_no} onChange={(e) => set({ manual_bill_no: e.target.value })} /></Field>
                <Field label="Pledge date (F4)" hint={`not after ${dayjs().format('DD/MM/YYYY')}`}><Input id="pledge-date" type="date" max={today()} value={f.loan_date} onChange={(e) => set({ loan_date: e.target.value, due_date: dayjs(e.target.value).add(scheme?.tenure_months || 12, 'month').format('YYYY-MM-DD') })} /></Field>
                <Field label="Gold rate (₹/g)" error={!f.gold_rate && loanOn !== 'SILVER' ? 'enter rate' : null}><Input prefix={<Coins className="size-3.5" />} type="number" value={f.gold_rate} onChange={(e) => set({ gold_rate: e.target.value })} /></Field>
                <Field label="Silver rate (₹/g)" error={!f.silver_rate && loanOn !== 'GOLD' ? 'enter rate' : null}><Input prefix={<Coins className="size-3.5" />} type="number" value={f.silver_rate} onChange={(e) => set({ silver_rate: e.target.value })} /></Field>
              </div>
            )}
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-ink-500">LOAN ON</span>
              {['GOLD', 'SILVER', 'MIX'].map((m) => (
                <button key={m} type="button" onClick={() => setLoanOn(m)} className={clsx('h-7 min-w-16 border px-3 text-[12px] font-bold first-of-type:rounded-l-md last-of-type:rounded-r-md -ml-px', loanOn === m ? 'relative z-10 flex items-center justify-center gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
                  {loanOn === m && (
                    <span className="relative flex size-1.5" aria-hidden>
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
                    </span>
                  )}
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-ink-400">Mix = gold + silver items in one loan</span>
            </div>
            <ItemEntry loanOn={loanOn} rates={rates} lookups={lk} editing={editing}
              onAdd={(it) => { setItems((l) => (editing ? l.map((x) => (x.key === editing.key ? it : x)) : [...l, it])); setEditing(null); }} />
            <div className="mt-2.5"><ItemsTable items={rows} onRemove={(i) => setItems((l) => l.filter((x) => x.key !== i.key))} onEdit={(i) => setEditing(i)} /></div>
            <div className="mt-2.5 grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 text-[13px] sm:grid-cols-4 dark:border-ink-800 [&>div]:border-ink-200 [&>div]:px-3 [&>div]:py-1.5 [&>div:not(:last-child)]:border-r dark:[&>div]:border-ink-800">
              <div><p className="label">Gold fine</p><p className="num font-bold">{weight(tot.fineG)} g @ {rates.gold ? amount(rates.gold) : '-'}</p></div>
              <div><p className="label">Silver fine</p><p className="num font-bold">{weight(tot.fineS)} g @ {rates.silver ? amount(rates.silver) : '-'}</p></div>
              <div><p className="label">Item value</p><p className="num font-bold">{amount(tot.value)}</p></div>
              <div><p className="label">Loan / gram</p><p className="num font-bold">{tot.net ? amount(principal / tot.net) : '0.00'}</p></div>
            </div>
            <div className={clsx('mt-2.5 grid gap-2', !isOld && 'sm:grid-cols-[1fr_200px]')}>
              <Field label="Remarks"><Input prefix={<StickyNote className="size-3.5" />} value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
              {!isOld && <Field label="Bill book no (optional)"><Input prefix={<BookOpen className="size-3.5" />} value={f.manual_bill_no} onChange={(e) => set({ manual_bill_no: e.target.value })} /></Field>}
            </div>
          </Panel>
        </>}
        right={right}
        footerLeft={<>
          <Button variant="soft-danger" icon={Plus} onClick={clear}>New / Clear (Ctrl+N)</Button>
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
        title={`Loan is ${ltv.toFixed(1)}% of item value (limit ${ltvWarn}%)`} message="Continue?"
        onConfirm={() => { setLtvAsk(false); proceed(); }} />
      {printerUi}
      <BillBookDrawer open={step === 'book'} first={!next.data?.bill_book_next} initial={next.data?.bill_book_next} onClose={() => setStep(null)}
        onOk={(no) => { set({ manual_bill_no: no }); if (netPay > 0) setStep('pay'); else save.mutate({ book: no }); }} />
      <PayDrawer open={step === 'pay'} onClose={() => setStep(null)} direction="pay" total={netPay} loading={save.isPending}
        title="Pay Customer · New Loan" subtitle={customer && `${customer.title || ''} ${customer.name}${customer.relation_name ? ` ${customer.relation_type || ''} ${customer.relation_name}` : ''} · loan ${money(principal)}`}
        onConfirm={(lines) => save.mutate({ payments: lines })} />
      {done && (
        <div className="fixed right-4 bottom-16 z-40 flex items-center gap-2 rounded-md border border-ink-300 bg-white p-2 shadow-lg dark:border-ink-700 dark:bg-ink-900">
          <CheckCircle2 className="size-5 text-emerald-600" /><span className="text-sm font-semibold">Loan #{done.loan.bill_no} saved</span>
          <Button size="sm" variant="outline" icon={Printer} loading={busy} onClick={() => printLoan(done)}>Bill</Button>
          <Button size="sm" variant="outline" icon={Tag} onClick={() => printElement(<Stickers loans={[done.loan]} settings={settings || {}} company={company} />, { title: 'Sticker' })}>Sticker</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/loans/counter?loan=${done.loan.id}`)}>Details</Button>
          <Button size="sm" variant="ghost" onClick={() => setDone(null)}>×</Button>
        </div>
      )}
    </>
  );
}
