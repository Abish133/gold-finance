/**
 * Building blocks shared by the counter screens (New Loan, Release, Part Payment,
 * Top-up, Re-loan, Old Loan, Edit). Layout and shortcuts follow the desktop app:
 * navy title bar with info tiles, three panels, bottom action bar with key hints.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ScanLine, LogOut, Plus, BookUser, ShieldCheck, ImagePlus, Camera, History, Trash2, Expand, UserRound, X, Check, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Drawer, Field, Input, Select, Spinner, StatusBadge, DataTable } from '@/components/ui';
import { compressImage } from '@/components/ui/ImageCapture';
import { PhotoBox } from '@/components/common/PhotoBox';
import { useFetch, useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { money, amount, date, weight, n, round2, round3, inWords } from '@/lib/format';

/* ------------------------------------------------------------------ layout */
export function DeskScreen({ title, subtitle, tiles = [], left, center, right, footerLeft, footerRight, hints = [], headerExtra, cols = 'xl:grid-cols-[360px_1fr_380px]' }) {
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-navy-100">{subtitle}</p>}
        </div>
        {headerExtra}
        {tiles.map((t) => (
          <div key={t.label} className={clsx('min-w-28 rounded-md px-4 py-1.5 text-center', t.gold ? 'bg-white text-ink-900' : 'bg-white/10')}>
            <p className="text-[11px] font-bold tracking-wide uppercase opacity-90">{t.label}</p>
            <p className="num text-sm font-bold">{t.value ?? '-'}</p>
          </div>
        ))}
      </section>
      <div className={clsx('grid items-stretch gap-3 xl:min-h-[calc(100vh-20.5rem)]', cols)}>
        {left && <div className="desk-col">{left}</div>}
        <div className="desk-col min-w-0">{center}</div>
        {right && <div className="desk-col">{right}</div>}
      </div>
      <div className="card flex flex-wrap items-center gap-2 px-3 py-2">
        {footerLeft}
        <div className="ml-auto flex flex-wrap gap-2">{footerRight}</div>
      </div>
      {hints.length > 0 && <p className="px-1 text-xs text-ink-500">{hints.map(([k, l]) => <span key={k} className="mr-4 whitespace-nowrap"><kbd className="font-semibold text-navy-700">{k}</kbd> {l}</span>)}</p>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClassName }) {
  return (
    <section className={clsx('card flex flex-col overflow-hidden', className)}>
      <header className="navy-gradient flex items-center gap-2 px-4 py-2 text-sm font-bold tracking-wide text-white uppercase">
        <span className="flex-1 truncate">{title}</span>{actions}
      </header>
      <div className={clsx('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Rows of "label .... value" (settlement style). */
export const Line = ({ label, value, tone, bold, minus }) => (
  <div className={clsx('flex items-center justify-between gap-3 py-1 text-sm', bold && 'font-bold', minus && 'text-rose-600', tone)}>
    <span>{minus ? '− ' : ''}{label}</span><span className="num">{value}</span>
  </div>
);

/** "Rupees Forty Nine Thousand Two Hundred Fifty Only" */
export const rupees = (v) => (n(v) ? `Rupees ${inWords(v).replace(/ Rupees Only$/, '')} Only` : '');

export function BigTotal({ label, value, tone = 'navy', words = true }) {
  return (
    <div className={clsx('rounded-md px-4 py-3 text-white', tone === 'green' ? 'bg-emerald-700' : 'navy-gradient')}>
      <p className="text-xs font-bold tracking-wide uppercase opacity-90">{label}</p>
      <p className="num mt-1 text-3xl font-extrabold">{money(value)}</p>
      {words && n(value) > 0 && <p className="mt-1 text-xs opacity-80">{rupees(value)}</p>}
    </div>
  );
}

/** Small coloured tag used in loan headers (IN HAND, 1 MONTH, ALLOWED...). */
export const Chip = ({ children, tone = 'ink' }) => (
  <span className={clsx('rounded px-3 py-1 text-xs font-bold uppercase', {
    green: 'bg-emerald-50 text-emerald-700', gold: 'bg-amber-50 text-amber-800', red: 'bg-rose-50 text-rose-700', violet: 'bg-violet-50 text-violet-700', ink: 'bg-ink-100 text-ink-700',
  }[tone])}>{children}</span>
);

export const interestTypeLabel = (t) => (t === 'COMPOUND' ? 'Compound Interest' : 'Flat Interest Calculation');
export const INTEREST_TYPES = [{ value: 'COMPOUND', label: 'Compound Interest' }, { value: 'SIMPLE', label: 'Flat Interest Calculation' }];

/** "LOAN 1 · BILL BOOK 1 · GOLD" title row with chips, then info cells. */
export function LoanHead({ loan, prefix = 'Loan', chips, cells = [] }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-4 py-2.5">
        <p className="flex-1 text-base font-bold text-navy-900 uppercase dark:text-white">
          {loan ? [`${prefix} ${loan.bill_no}`, loan.manual_bill_no && `Bill Book ${loan.manual_bill_no}`, loan.loan_on || loan.metal_name].filter(Boolean).join(' · ') : `${prefix} -`}
        </p>
        {loan && chips}
      </div>
      <div className="grid border-b border-ink-200" style={{ gridTemplateColumns: `repeat(${cells.length || 1}, minmax(0, 1fr))` }}>
        {cells.map(([k, v]) => (
          <div key={k} className="border-r border-ink-200 px-4 py-2 last:border-r-0"><p className="label">{k}</p><p className="num font-bold text-navy-900 dark:text-white">{loan ? v : '-'}</p></div>
        ))}
      </div>
    </>
  );
}

/** "Total · 1 item · 1 pcs · gross 10.000 g · net 9.500 g · value today 68,700.00" */
export const ItemsSummary = ({ items = [], label = 'Total', valueKey = 'value' }) => (items.length ? (
  <p className="border-t border-ink-200 px-4 py-2 text-sm font-semibold text-navy-900 dark:text-white">
    {label} · {items.length} item{items.length > 1 ? 's' : ''} · {items.reduce((s, i) => s + n(i.pcs), 0)} pcs · gross {weight(items.reduce((s, i) => s + n(i.gross_wt), 0))} g
    · net {weight(items.reduce((s, i) => s + n(i.net_wt), 0))} g · value today {money(items.reduce((s, i) => s + n(i[valueKey]), 0))}
  </p>
) : null);

export const GoldButton = ({ children, ...p }) => (
  <Button {...p} size="lg" className="h-14 w-full rounded-md !bg-ink-900 text-lg !text-white hover:!bg-ink-700 border-0">{children}</Button>
);

/* ------------------------------------------------------------------ keys */
export function useKeys(map, deps = []) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const h = (e) => {
      if (document.querySelector('[data-drawer]')) return; // drawers handle their own keys
      const k = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.key.toLowerCase()}`;
      const fn = ref.current[k];
      if (fn) { e.preventDefault(); e.stopPropagation(); fn(e); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function ExitButton() {
  const navigate = useNavigate();
  return <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>;
}

/* ------------------------------------------------------------------ loan finder */
export function LoanFinder({ onLoad, loading, autoFocus = true, label = 'Find loan' }) {
  const [by, setBy] = useState('loan');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const input = useRef(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  const find = async () => {
    const v = q.trim();
    if (!v) return;
    try {
      const r = await api.get('/loans/find', { q: v, by });
      if (!r.data.length) toast.error('No loan found');
      else if (r.data.length === 1) { onLoad(r.data[0].id); setList(null); } else setList(r.data);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Panel title={`${label} · ${by === 'loan' ? 'Loan no' : 'Bill book no'}`}>
      <div className="mb-2 grid grid-cols-2 gap-1">
        {[['loan', 'Loan No'], ['bill', 'Bill Book No (F3)']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setBy(k)} className={clsx('rounded-md border px-2 py-1.5 text-sm font-semibold', by === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 text-ink-600')}>{l}</button>
        ))}
      </div>
      <Input ref={input} data-finder value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} className="h-12 bg-gold-50 text-lg font-bold" placeholder="Type or scan" />
      <p className="mt-1 text-xs text-ink-500"><ScanLine className="mr-1 inline size-3.5" />Enter = load · barcode scan works</p>
      {loading && <Spinner className="py-2" />}
      {list && (
        <div className="mt-2 space-y-1">
          {list.map((m) => (
            <button key={m.id} type="button" onClick={() => { onLoad(m.id); setList(null); }} className="flex w-full items-center justify-between rounded-md border border-ink-200 p-2 text-left text-sm hover:bg-navy-50">
              <span>#{m.bill_no} · {m.customer_name}</span><StatusBadge status={m.status} />
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ customer */
export { CustomerLedgerDrawer } from '@/features/customers/CustomerLedger';
export { PhotoBox };

/** Customer fields from a loan record. */
export const loanCustomer = (l) => (l ? { ...l, id: l.customer_id, name: l.customer_name, phone: l.customer_phone, photo: l.customer_photo || l.customer_photo_master, status: l.customer_status || 'ACTIVE' } : null);

export function CustomerCard({ customer, rows = [], extra, onLedger }) {
  const c = customer;
  const addr = c && [c.door_no, c.street, c.area, c.city, c.pincode].filter(Boolean).join(', ');
  return (
    <div>
      <div className="flex gap-3">
        <PhotoBox src={c?.photo || c?.customer_photo_master} />
        {c && (
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-base leading-snug font-bold text-navy-900 dark:text-white">{c.title ? `${c.title} ` : ''}{c.name || c.customer_name}{c.relation_name ? ` ${c.relation_type || ''} ${c.relation_name}` : ''}</p>
            {addr && <p className="mt-1 text-ink-600">{addr}</p>}
            <p className="mt-2 font-bold">{c.phone || c.customer_phone}</p>
            {c.id_proof_type && <p className="text-xs text-ink-500">{c.id_proof_type}</p>}
          </div>
        )}
      </div>
      {c && (
        <div className="mt-2 flex gap-2">
          <span className="rounded bg-navy-50 px-6 py-1 text-xs font-bold text-navy-900 dark:bg-ink-800 dark:text-white">A/C {c.customer_no}</span>
          <span className={clsx('rounded px-4 py-1 text-xs font-bold', c.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{c.status || 'ACTIVE'}</span>
        </div>
      )}
      {rows.length > 0 && <div className="mt-3 space-y-0.5">{rows.map(([k, v]) => <Line key={k} label={k} value={c ? v ?? '-' : '-'} tone="text-ink-600" />)}</div>}
      {extra}
      {onLedger && c && <Button size="sm" variant="outline" icon={BookUser} className="mt-3" onClick={onLedger}>Ledger (F5)</Button>}
    </div>
  );
}

/* ------------------------------------------------------------------ pay / receive step */
const PAY_MODES = [['CASH', '1 · Cash', 'notes'], ['UPI', '2 · Online', 'UPI / NEFT'], ['CARD', '3 · Card', 'debit / credit'], ['CHEQUE', '4 · Cheque', 'no. + bank']];

/**
 * Payment step shown after the main action (desktop: Pay Customer / Receive dialog).
 * Lines are added per mode until the balance is 0, then Confirm (F2).
 */
export function PayDrawer({ open, onClose, title, subtitle, total, direction = 'pay', onConfirm, loading }) {
  const { data: lk } = useLookups();
  const banks = (lk?.banks || []).map((b) => ({ value: b.id, label: `${b.bank_name}${b.account_no ? ` · ${String(b.account_no).slice(-4)}` : ''}` }));
  const [mode, setMode] = useState('CASH');
  const [amt, setAmt] = useState('');
  const [ref, setRef] = useState('');
  const [bank, setBank] = useState('');
  const [lines, setLines] = useState([]);
  const amtRef = useRef(null);
  const paid = round2(lines.reduce((s, x) => s + n(x.amount), 0));
  const balance = round2(n(total) - paid);
  useEffect(() => { if (open) { setLines([]); setMode('CASH'); setRef(''); setAmt(String(round2(total))); setTimeout(() => amtRef.current?.select(), 50); } }, [open, total]);
  useEffect(() => { if (!bank && banks[0]) setBank(String(banks[0].value)); }, [banks, bank]);
  const add = () => {
    const a = round2(n(amt) || balance);
    if (a <= 0) return;
    if (a > balance + 0.009) return toast.error(`Only ${money(balance)} is left`);
    if (mode !== 'CASH' && !bank) return toast.error('Add a bank account in Bank master first');
    setLines([...lines, { mode, amount: a, reference: ref, bank_account_id: mode === 'CASH' ? null : Number(bank) }]);
    setAmt(String(round2(balance - a))); setRef('');
    amtRef.current?.focus();
  };
  const confirm = () => {
    if (Math.abs(balance) > 0.009) return toast.error('Balance must be 0 to save');
    onConfirm(lines);
  };
  const onKey = (e) => {
    if (e.key === 'F2') { e.preventDefault(); confirm(); }
    if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); setMode(PAY_MODES[Number(e.key) - 1][0]); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="lg" icon={Wallet} title={title} subtitle={subtitle}
      footer={<><Button variant="outline" onClick={onClose}>Cancel (Esc)</Button><Button variant="gold" loading={loading} disabled={Math.abs(balance) > 0.009} onClick={confirm}>Confirm (F2)</Button></>}>
      <div className="space-y-4" onKeyDown={onKey}>
        <div className="flex items-end justify-between rounded-md bg-ink-50 px-4 py-3 dark:bg-ink-800">
          <span className="text-xs font-bold text-ink-600 uppercase">{direction === 'pay' ? 'Amount to pay' : 'Amount to receive'}</span>
          <span className="num text-3xl font-extrabold text-navy-900 dark:text-white">{money(total)}</span>
        </div>
        <div>
          <p className="label">Payment mode <span className="font-normal normal-case">(Ctrl+1-4)</span></p>
          <div className="grid grid-cols-4 gap-2">
            {PAY_MODES.map(([k, t, h]) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={clsx('rounded-md border px-2 py-2 text-center text-sm font-bold', mode === k ? 'border-ink-900 bg-ink-900 text-white dark:border-white dark:bg-white dark:text-ink-900' : 'border-ink-300 text-navy-900 dark:text-white')}>
                {t}<span className="block text-xs font-semibold opacity-80">{h}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="Amount (₹)"><Input ref={amtRef} type="number" className="h-11 text-right text-lg font-bold" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} /></Field>
          <Field label="Ref / UTR / cheque no"><Input disabled={mode === 'CASH'} value={ref} onChange={(e) => setRef(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} /></Field>
          <Button className="h-11" icon={Plus} onClick={add}>Add (Enter)</Button>
        </div>
        {mode !== 'CASH' && <Field label="Bank account"><Select value={bank} onChange={(e) => setBank(e.target.value)} options={banks} placeholder="Select bank" /></Field>}
        <div className="min-h-24 divide-y divide-ink-200 rounded-md border border-ink-200 dark:divide-ink-700 dark:border-ink-700">
          {!lines.length && <p className="px-3 py-6 text-center text-sm text-ink-400">Add the amount for each payment mode</p>}
          {lines.map((x, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <b className="w-20">{PAY_MODES.find((m) => m[0] === x.mode)?.[1].split(' · ')[1] || x.mode}</b>
              <span className="flex-1 text-ink-500">{x.reference || '-'}</span>
              <span className="num font-bold">{amount(x.amount)}</span>
              <button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))} className="text-rose-600"><X className="size-4" /></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-ink-200 rounded-md border border-ink-200 dark:divide-ink-700 dark:border-ink-700">
          {[['Total due', money(total), ''], ['Paid', money(paid), 'text-emerald-700'], ['Balance', money(balance), Math.abs(balance) < 0.01 ? 'text-emerald-700' : 'text-rose-600']].map(([k, v, cls]) => (
            <div key={k} className="px-3 py-2"><p className="label">{k}</p><p className={clsx('num flex items-center gap-1 text-lg font-bold', cls)}>{v}{k === 'Balance' && Math.abs(balance) < 0.01 && <Check className="size-5" />}</p></div>
          ))}
        </div>
        <p className="text-xs text-ink-500">Balance must be 0 to save.</p>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ item photo */
export function ItemPhotoPanel({ value, onChange, customerId, readOnly }) {
  const [big, setBig] = useState(false);
  const [cam, setCam] = useState(false);
  const fileRef = useRef(null);
  const upload = async (file) => {
    try {
      const small = await compressImage(file);
      onChange((await api.upload('/loans/upload/temp', small)).data.path);
    } catch (e) { toast.error(e.message); }
  };
  const oldPhoto = async () => {
    if (!customerId) return toast.error('Select customer first');
    const r = await api.get(`/loans/last-photo/${customerId}`);
    if (r.data.path) onChange(r.data.path); else toast.info('No earlier photo for this customer');
  };
  return (
    <Panel title="Item photo" actions={value && <button type="button" onClick={() => setBig(true)} title="Enlarge"><Expand className="size-4" /></button>}>
      <div className={clsx('grid gap-3', !readOnly && 'grid-cols-[1fr_130px]')}>
        <button type="button" onClick={() => value && setBig(true)} className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-ink-200 bg-ink-50">
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <span className="text-sm text-ink-400">Image not available</span>}
        </button>
        {!readOnly && (
          <div className="grid content-start gap-1.5">
            <Button size="sm" variant="outline" icon={Camera} onClick={() => setCam(true)}>Camera (F7)</Button>
            <Button size="sm" variant="outline" icon={ImagePlus} onClick={() => fileRef.current?.click()}>Browse</Button>
            <Button size="sm" variant="outline" icon={History} onClick={oldPhoto}>Old (F8)</Button>
            <Button size="sm" variant="outline" icon={Trash2} onClick={() => onChange(null)}>Remove</Button>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { e.target.files?.[0] && upload(e.target.files[0]); e.target.value = ''; }} />
      <CameraDrawer open={cam} onClose={() => setCam(false)} onCapture={upload} />
      <Drawer open={big} onClose={() => setBig(false)} size="xl" title="Item photo">{value && <img src={value} alt="" className="w-full rounded-md" />}</Drawer>
      <PhotoHotkeys enabled={!readOnly} onCamera={() => setCam(true)} onOld={oldPhoto} />
    </Panel>
  );
}

function PhotoHotkeys({ enabled, onCamera, onOld }) {
  useKeys(enabled ? { f7: onCamera, f8: onOld } : {}, [enabled]);
  return null;
}

function CameraDrawer({ open, onClose, onCapture }) {
  const video = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    let s;
    navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 } })
      .then((st) => { s = st; if (video.current) video.current.srcObject = st; })
      .catch(() => { toast.error('Camera not available'); onClose(); });
    return () => s?.getTracks().forEach((t) => t.stop());
  }, [open, onClose]);
  const snap = () => {
    const v = video.current;
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => { onCapture(new File([b], 'cam.jpg', { type: 'image/jpeg' })); onClose(); }, 'image/jpeg', 0.85);
  };
  return (
    <Drawer open={open} onClose={onClose} size="lg" title="Camera" icon={Camera} footer={<Button variant="gold" onClick={snap}>Capture (Enter)</Button>}>
      <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-md bg-ink-900" onKeyDown={(e) => e.key === 'Enter' && snap()} />
    </Drawer>
  );
}

/* ------------------------------------------------------------------ items */
export const blankItem = (metal) => ({ key: crypto.randomUUID(), item_name: '', item_id: null, pcs: 1, gross_wt: '', stone_wt: '', purity: metal === 'SILVER' ? 92.5 : 91.6, metal, remarks: '' });

/** 100% (fine) rate from a board rate row: rate at its purity x 100 / purity. */
export const fineRate = (r) => (r && n(r.market_rate) ? round2((n(r.market_rate) * 100) / (n(r.purity) || 100)) : null);

/** Desktop valuation: fine weight x 100% rate, rounded to the nearest 100. */
export const valueOf = (fine, rate) => Math.round((n(fine) * n(rate)) / 100) * 100;

/** Compute net, fine and value for a jewel row. `rates` are 100% (fine) rates per gram. */
export const computeItem = (it, rates) => {
  const net = round3(Math.max(0, n(it.gross_wt) - n(it.stone_wt)));
  const rate = it.metal === 'SILVER' ? n(rates.silver) : n(rates.gold);
  const fine = round3((net * n(it.purity)) / 100);
  return { ...it, net_wt: net, fine_wt: fine, rate_per_gram: rate, rate_basis: 100, value: valueOf(fine, rate) };
};

/** Item entry row (desktop: Item (F3 new), Pcs, Gross, Less, Net auto, Remark, Purity, Metal, Value, Add Item). */
export function ItemEntry({ loanOn, rates, lookups, onAdd, editing }) {
  const [it, setIt] = useState(blankItem(loanOn === 'SILVER' ? 'SILVER' : 'GOLD'));
  const [newName, setNewName] = useState(null);
  const first = useRef(null);
  useEffect(() => { if (editing) setIt(editing); }, [editing]);
  useEffect(() => { setIt((x) => ({ ...x, metal: loanOn === 'MIX' ? x.metal : loanOn, purity: loanOn === 'SILVER' && x.metal !== 'SILVER' ? 92.5 : x.purity })); }, [loanOn]);
  const c = computeItem(it, rates);
  const metalCode = it.metal;
  const purities = (lookups?.purities || []).filter((p) => (lookups.metals.find((m) => m.id === p.metal_id)?.code || 'GOLD') === metalCode);
  const items = lookups?.items || [];
  const add = () => {
    if (!it.item_name) return toast.error('Select item');
    if (!(n(it.gross_wt) > 0)) return toast.error('Enter gross weight');
    if (n(it.stone_wt) >= n(it.gross_wt)) return toast.error('Less weight must be below gross weight');
    onAdd(c);
    setIt(blankItem(loanOn === 'SILVER' ? 'SILVER' : loanOn === 'MIX' ? it.metal : 'GOLD'));
    first.current?.focus();
  };
  const enter = (e) => e.key === 'Enter' && (e.preventDefault(), add());
  const saveNew = async () => {
    try { const r = await api.post('/masters/items/quick', { name: newName }); lookups.items.push(r.data); setIt({ ...it, item_name: r.data.name, item_id: r.data.id }); setNewName(null); } catch (e) { toast.error(e.message); }
  };
  useKeys({ f3: () => setNewName('') }, []);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_70px_1fr_1fr_1fr]">
        <Field label="Item (F3 new)">
          <select ref={first} className="input" value={it.item_name} onChange={(e) => { const m = items.find((x) => x.name === e.target.value); setIt({ ...it, item_name: e.target.value, item_id: m?.id || null }); }}>
            <option value="" />
            {items.map((x) => <option key={x.id} value={x.name}>{x.name}{x.local_name ? ` - ${x.local_name}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Pcs"><Input type="number" min="1" value={it.pcs} onChange={(e) => setIt({ ...it, pcs: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Gross wt (g)"><Input type="number" step="0.001" value={it.gross_wt} onChange={(e) => setIt({ ...it, gross_wt: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Less wt"><Input type="number" step="0.001" value={it.stone_wt} onChange={(e) => setIt({ ...it, stone_wt: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Net wt (auto)"><Input readOnly value={c.net_wt ? weight(c.net_wt) : ''} className="bg-ink-50" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Remark"><Input value={it.remarks} onChange={(e) => setIt({ ...it, remarks: e.target.value })} onKeyDown={enter} placeholder="Hallmark, damage, seal…" /></Field>
        <Field label="Purity %">
          <Input type="number" step="0.01" list={`pur-${metalCode}`} value={it.purity} onChange={(e) => setIt({ ...it, purity: e.target.value })} onKeyDown={enter} />
          <datalist id={`pur-${metalCode}`}>{purities.map((p) => <option key={p.id} value={p.purity}>{p.name}</option>)}</datalist>
        </Field>
        <Field label="Metal">
          {loanOn === 'MIX'
            ? <Select value={it.metal} onChange={(e) => setIt({ ...it, metal: e.target.value, purity: e.target.value === 'SILVER' ? 92.5 : 91.6 })} options={['GOLD', 'SILVER']} />
            : <Input readOnly value={metalCode} className="bg-ink-50" />}
        </Field>
        <Field label="Value"><Input readOnly value={c.value ? amount(c.value) : ''} className="bg-ink-50" /></Field>
        <Button onClick={add} className="h-10">{editing ? 'Update item' : 'Add item'}</Button>
      </div>
      <Drawer open={newName !== null} onClose={() => setNewName(null)} size="sm" title="New item name" footer={<Button variant="gold" onClick={saveNew}>Save item</Button>}>
        <Field label="Item name"><Input autoFocus value={newName || ''} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNew()} /></Field>
      </Drawer>
    </div>
  );
}

/** Items grid with totals (#, Item, Metal, Pcs, Gross, Less, Net, Purity, Fine, Value). */
export function ItemsTable({ items, onRemove, onEdit, valueLabel = 'Value', showValue = true }) {
  const t = items.reduce((s, i) => ({ pcs: s.pcs + n(i.pcs), g: s.g + n(i.gross_wt), l: s.l + n(i.stone_wt), net: s.net + n(i.net_wt), f: s.f + n(i.fine_wt), v: s.v + n(i.value) }), { pcs: 0, g: 0, l: 0, net: 0, f: 0, v: 0 });
  const th = 'px-2 py-2 text-right font-bold';
  return (
    <div className="overflow-x-auto rounded-md border border-ink-300">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="navy-gradient text-white"><tr>
          <th className="w-8 px-2 py-2 text-left">#</th><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-left">Metal</th>
          <th className={th}>Pcs</th><th className={th}>Gross</th><th className={th}>Less</th><th className={th}>Net</th><th className={th}>Purity</th><th className={th}>Fine wt</th>
          {showValue && <th className={th}>{valueLabel}</th>}{(onRemove || onEdit) && <th className="w-16" />}
        </tr></thead>
        <tbody className="divide-y divide-ink-200">
          {!items.length && <tr><td colSpan={11} className="py-10 text-center text-ink-400">No items yet</td></tr>}
          {items.map((i, k) => (
            <tr key={i.key || i.id || k} className="hover:bg-navy-50/50" onDoubleClick={() => onEdit?.(i)}>
              <td className="px-2 py-1.5">{k + 1}</td><td className="px-2 py-1.5 font-semibold">{i.item_name}{i.remarks ? <span className="ml-1 text-xs font-normal text-ink-400">({i.remarks})</span> : null}</td>
              <td className="px-2 py-1.5">{i.metal || i.metal_code || ''}</td>
              <td className="num px-2 text-right">{i.pcs}</td><td className="num px-2 text-right">{weight(i.gross_wt)}</td><td className="num px-2 text-right">{weight(i.stone_wt)}</td>
              <td className="num px-2 text-right font-semibold">{weight(i.net_wt)}</td><td className="num px-2 text-right">{n(i.purity)}</td><td className="num px-2 text-right">{weight(i.fine_wt)}</td>
              {showValue && <td className="num px-2 text-right">{amount(i.value)}</td>}
              {(onRemove || onEdit) && <td className="px-1 text-right">{onRemove && <button type="button" onClick={() => onRemove(i)} className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Remove (Del)"><Trash2 className="size-4" /></button>}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-navy-800 text-white"><tr className="font-bold">
          <td colSpan={3} className="px-2 py-2">Total ({items.length})</td><td className="num px-2 text-right">{t.pcs}</td><td className="num px-2 text-right">{weight(t.g)}</td>
          <td className="num px-2 text-right">{weight(t.l)}</td><td className="num px-2 text-right">{weight(t.net)}</td><td /><td className="num px-2 text-right">{weight(t.f)}</td>
          {showValue && <td className="num px-2 text-right">{amount(t.v)}</td>}{(onRemove || onEdit) && <td />}
        </tr></tfoot>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ LTV bar */
export function LtvBar({ value, max = 75, safe, warn, suffix = '' }) {
  const pct = Math.min(100, n(value));
  const s = n(safe) || max * 0.9;
  const w = n(warn) || max;
  const tone = pct > Math.max(w, max) ? 'bg-rose-600' : pct > s ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-600"><span>Loan to value</span><b className={clsx('num', n(value) > Math.max(n(warn) || max, max) ? 'text-rose-600' : n(value) > (n(safe) || max * 0.9) ? 'text-amber-600' : 'text-emerald-700')}>{value ? `${n(value).toFixed(1)}%${suffix ? ` ${suffix}` : ''}` : '-'}</b></div>
      <div className="relative mt-1 h-2 rounded-full bg-ink-200"><div className={clsx('h-2 rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
        <div className="absolute top-[-3px] h-3.5 w-0.5 bg-navy-900" style={{ left: `${Math.min(100, max)}%` }} title={`Scheme limit ${max}%`} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ admin approval */
/**
 * Wrap a request that may need admin approval (server answers 428).
 * const run = useApproval(); run((approval) => api.post(url, { ...body, approval }))
 */
export function useApproval() {
  const [pending, setPending] = useState(null);
  const [cred, setCred] = useState({ username: '', password: '' });
  const run = (fn) => new Promise((resolve, reject) => {
    fn(undefined).then(resolve).catch((e) => {
      if (e.status === 428) { setCred({ username: '', password: '' }); setPending({ fn, resolve, reject, message: e.message }); } else reject(e);
    });
  });
  const approve = () => {
    const p = pending;
    p.fn(cred).then((r) => { setPending(null); p.resolve(r); }).catch((e) => toast.error(e.message));
  };
  const ui = (
    <Drawer open={!!pending} onClose={() => { pending?.reject(new Error('Approval cancelled')); setPending(null); }} size="sm" icon={ShieldCheck} title="Admin approval" subtitle={pending?.message}
      footer={<Button variant="gold" onClick={approve}>Approve</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-600">Ask the manager / admin to enter their login to approve.</p>
        <Field label="Approver username"><Input autoFocus value={cred.username} onChange={(e) => setCred({ ...cred, username: e.target.value })} /></Field>
        <Field label="Password"><Input type="password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && approve()} /></Field>
      </div>
    </Drawer>
  );
  return { run, ui };
}

/* ------------------------------------------------------------------ payments received grid */
const TXN_LABEL = { INTEREST: 'Interest', PART_PAYMENT: 'Part payment', TOPUP: 'Top-up', RELEASE: 'Release', RENEWAL: 'Re-loan', AUCTION: 'Auction' };
export function PaymentsGrid({ transactions = [], loan }) {
  const adv = loan && n(loan.advance_interest) ? [{ id: 'adv', txn_date: loan.loan_date, txn_type: 'ADVANCE', months_paid: loan.advance_months || 1, total_amount: loan.advance_interest, payments: [{ mode: 'at loan' }] }] : [];
  const rows = [...adv, ...transactions.filter((t) => !t.is_void && t.txn_type !== 'DISBURSE')];
  return (
    <div className="overflow-hidden rounded-md border border-ink-300">
      <table className="w-full text-sm">
        <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Months</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Mode</th></tr></thead>
        <tbody className="divide-y divide-ink-200">
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-ink-400">No payments yet</td></tr>}
          {rows.map((t) => (
            <tr key={t.id}><td className="px-3 py-1.5">{date(t.txn_date)}</td><td className="px-3">{t.txn_type === 'ADVANCE' ? 'Advance interest' : TXN_LABEL[t.txn_type] || t.txn_type.replace('_', ' ')}</td><td className="num px-3 text-right">{n(t.months_paid) ? `${n(t.months_paid)} month${n(t.months_paid) > 1 ? 's' : ''}` : ''}</td>
              <td className="num px-3 text-right">{amount(t.total_amount)}</td><td className="px-3">{(t.payments || []).map((p) => p.mode).join(', ')}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loads a loan by id with react-query and exposes refresh. */
export function useLoan(id, asOf) {
  const qc = useQueryClient();
  const q = useFetch(id ? `/loans/${id}` : null, asOf ? { as_of: asOf } : undefined);
  return { ...q, full: q.data, refresh: () => qc.invalidateQueries({ queryKey: [`/loans/${id}`] }) };
}

export { Plus };
