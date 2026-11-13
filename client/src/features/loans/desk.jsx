/**
 * Building blocks shared by the counter screens (New Loan, Release, Part Payment,
 * Top-up, Re-loan, Old Loan, Edit). Layout and shortcuts follow the desktop app:
 * navy title bar with info tiles, three panels, bottom action bar with key hints.
 */
import { rateText } from '@/lib/rateUnits';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ScanLine, LogOut, Plus, Search, ChevronDown, MessageSquare, Tag, BookUser, ShieldCheck, ImagePlus, Camera, History, Trash2, Expand, UserRound, X, Check, Wallet, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Drawer, Field, Input, Select, Spinner, StatusBadge, DataTable, Modal } from '@/components/ui';
import { compressImage } from '@/components/ui/ImageCapture';
import { PhotoBox } from '@/components/common/PhotoBox';
import { ImagePreview } from '@/components/common/ImagePreview';
import { useFetch, useLookups } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { money, amount, date, weight, n, round2, round3, inWords } from '@/lib/format';
import { PageActions } from '@/components/common/PageActions';

/* ------------------------------------------------------------------ layout */
export function DeskScreen({ title, subtitle, tiles = [], left, center, right, footerLeft, footerRight, hints = [], headerExtra, cols = 'xl:grid-cols-[360px_1fr_380px]' }) {
  return (
    /* fit-screen: on desktop the whole counter fits the window; each column scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">{title}</h1>
          {subtitle && <p className="hidden truncate text-[12px] text-white/60 lg:block">{subtitle}</p>}
        </div>
        {headerExtra}
        {tiles.length > 0 && (
          <div className="flex overflow-hidden rounded-md border border-white/15">
            {tiles.map((t) => (
              <div key={t.label} className={clsx('flex items-baseline gap-2 border-l border-white/15 px-3 py-1 first:border-l-0', t.gold && 'bg-white text-ink-900')}>
                <span className={clsx('text-[10px] font-semibold tracking-wider uppercase', t.gold ? 'text-ink-500' : 'text-white/55')}>{t.label}</span>
                <span className="num text-[13px] font-bold">{t.value ?? '-'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className={clsx('grid items-stretch gap-2 xl:min-h-0 xl:flex-1', cols)}>
        {left && <div className="desk-col">{left}</div>}
        <div className="desk-col min-w-0">{center}</div>
        {right && <div className="desk-col">{right}</div>}
      </div>
      {/* actions sit in the header bar above; shortcuts under its "Keys" button */}
      <PageActions keys={hints}>{footerLeft}{footerRight}</PageActions>
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClassName }) {
  return (
    <section className={clsx('flex flex-col overflow-clip rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900', className)}>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white">
        <span aria-hidden className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />
        <span className="flex-1 truncate">{title}</span>{actions}
      </header>
      <div className={clsx('flex-1 p-3', bodyClassName)}>{children}</div>
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
    <div className={clsx('rounded-md px-3 py-2 text-white', tone === 'green' ? 'bg-emerald-700' : 'navy-gradient')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">{label}</p>
        <p className="num text-2xl font-extrabold">{money(value)}</p>
      </div>
      {words && n(value) > 0 && <p className="mt-0.5 text-right text-[11px] opacity-70">{rupees(value)}</p>}
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

/** How a scheme counts the time for the loan's interest (Masters → Loan Schemes → "Calculate by"), in plain words. */
export const schemeCounting = (scheme, settings) => {
  if (!scheme) return null;
  const minDays = n(scheme.min_days);
  const grace = n(scheme.grace_days) || n(settings?.RELEASE_GRACE_DAYS);
  const half = settings?.MONTH_ROUND_HALF_DAYS != null ? n(settings.MONTH_ROUND_HALF_DAYS) : 15;
  const yearly = scheme.rate_type !== 'MONTHLY';
  const extra = [minDays > 0 && `minimum ${minDays} days`, grace > 0 && `${grace} grace day${grace > 1 ? 's' : ''} not charged`].filter(Boolean);
  if (scheme.calc_mode === 'MYBOOK') {
    return { mode: 'Months', text: 'by months - every started month is a full month (minimum 1 month)', example: '40 days = 2 months', extra };
  }
  if (scheme.calc_mode === 'MONTHS') {
    return { mode: 'Half / full months', text: half > 0 ? `by half and full months - up to ${half} extra days = ½ month, more = full month` : 'by full months - every started month', example: half > 0 ? `40 days = 1½ months` : '40 days = 2 months', extra };
  }
  return { mode: 'Days', text: `by exact days - a day = ${yearly ? 'yearly rate ÷ 365' : 'monthly rate ÷ 30'}`, example: '40 days = 40 days', extra };
};

/** One line under the loan's rate: how this scheme counts the interest. */
export function SchemeCounting({ scheme, settings, className }) {
  const sc = schemeCounting(scheme, settings);
  if (!sc) return null;
  return (
    <p className={clsx('flex items-start gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-[11.5px] leading-snug text-sky-900 dark:bg-sky-950/40 dark:text-sky-200', className)}
      title="Masters → Loan Schemes → Calculate by. Manual Days / Months in the Interest box can still be used for a single receipt.">
      <span aria-hidden className="mt-px font-bold">ⓘ</span>
      <span><b>{scheme.code}</b> counts interest <b>{sc.text}</b>{sc.extra.length ? ` · ${sc.extra.join(' · ')}` : ''} <span className="text-sky-700/80 dark:text-sky-300/70">(e.g. {sc.example})</span></span>
    </p>
  );
}

/** "LOAN 1 · BILL BOOK 1 · GOLD" title row with chips, then info cells. */
export function LoanHead({ loan, prefix = 'Loan', chips, cells = [] }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
        <p className="flex-1 text-[14px] font-bold text-navy-900 uppercase dark:text-white">
          {loan ? [`${prefix} ${loan.bill_no}`, loan.manual_bill_no && `Bill Book ${loan.manual_bill_no}`, loan.loan_on || loan.metal_name].filter(Boolean).join(' · ') : `${prefix} -`}
        </p>
        {loan && chips}
      </div>
      <div className="grid border-b border-ink-200" style={{ gridTemplateColumns: `repeat(${cells.length || 1}, minmax(0, 1fr))` }}>
        {cells.map(([k, v]) => (
          <div key={k} className="border-r border-ink-200 px-3 py-1.5 last:border-r-0 dark:border-ink-800"><p className="label">{k}</p><p className="num text-[13px] font-bold text-navy-900 dark:text-white">{loan ? v : '-'}</p></div>
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
  <Button {...p} variant="gold" size="lg" className="h-11 w-full rounded-md text-base font-bold disabled:opacity-50">{children}</Button>
);

/* ------------------------------------------------------------------ auto / manual search */
/** Remembered per box on this computer: true = search as you type, false = only Enter. */
export function useAutoMode(key, initial = true) {
  const [auto, setAuto] = useState(() => { try { const v = localStorage.getItem(`gf.auto.${key}`); return v == null ? initial : v === '1'; } catch { return initial; } });
  const set = (v) => { setAuto(v); try { localStorage.setItem(`gf.auto.${key}`, v ? '1' : '0'); } catch { /* private window */ } };
  return [auto, set];
}

/** Small "Auto | Manual" switch shown next to a search box. */
export function AutoManualSwitch({ value, onChange, className }) {
  return (
    <div className={clsx('flex shrink-0 overflow-hidden rounded-md border border-ink-200 text-[10px] font-bold tracking-wider dark:border-ink-700', className)} title="Auto = searches as you type · Manual = press Enter">
      {[[true, 'Auto'], [false, 'Manual']].map(([v, t]) => (
        <button key={t} type="button" onClick={() => onChange(v)}
          className={clsx('flex items-center gap-1 px-2 py-0.5 uppercase transition', value === v ? 'bg-emerald-600 text-white' : 'text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800')}>
          {value === v && v && <span className="size-1.5 animate-pulse rounded-full bg-white" />}{t}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ keys */
export function useKeys(map, deps = []) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const h = (e) => {
      if (document.querySelector('[data-drawer]')) return; // drawers handle their own keys
      // a plain character (+, -, letters) typed in a box belongs to the box, not to a shortcut
      const t = e.target;
      const typing = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
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
export function LoanFinder({ onLoad, loading, autoFocus = true, label = 'Find loan', defaultBy = 'loan' }) {
  const [by, setBy] = useState(defaultBy);
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(false);
  const lastLoaded = useRef(null);
  // Auto = loads as you type, Manual = only Enter / scan. Remembered on this computer.
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem('gf.finderAuto') !== '0'; } catch { return true; } });
  const toggleAuto = (v) => { setAuto(v); try { localStorage.setItem('gf.finderAuto', v ? '1' : '0'); } catch { /* private window */ } input.current?.focus(); };
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  // quiet = typed (auto) lookup: no "not found" toast, never re-loads the loan already shown
  const find = async (quiet = false) => {
    const v = q.trim();
    if (!v) return;
    setBusy(true);
    try {
      const r = await api.get('/loans/find', { q: v, by });
      setMiss(!r.data.length);
      if (!r.data.length) { if (!quiet) toast.error('No loan found'); setList(null); }
      else if (r.data.length === 1) {
        if (!quiet || lastLoaded.current !== r.data[0].id) { lastLoaded.current = r.data[0].id; onLoad(r.data[0].id); }
        setList(null);
      } else setList(r.data);
    } catch (e) { if (!quiet) toast.error(e.message); } finally { setBusy(false); }
  };
  // auto fetch: looks the number up once typing pauses (Enter still loads at once)
  useEffect(() => {
    setMiss(false);
    if (!q.trim()) { setList(null); return undefined; }
    if (!auto) return undefined;
    const t = setTimeout(() => find(true), 550);
    return () => clearTimeout(t);
  }, [q, by, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel title={`${label} · ${by === 'loan' ? 'Loan no' : 'Bill book no'}`}
      actions={(
        <div className="flex overflow-hidden rounded-md border border-ink-200 text-[10px] font-bold tracking-wider normal-case dark:border-ink-700" title="Auto = loads as you type · Manual = press Enter">
          {[[true, 'Auto'], [false, 'Manual']].map(([v, t]) => (
            <button key={t} type="button" onClick={() => toggleAuto(v)}
              className={clsx('flex items-center gap-1 px-2 py-0.5 uppercase transition', auto === v ? 'bg-emerald-600 text-white' : 'text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800')}>
              {auto === v && v && <span className="size-1.5 animate-pulse rounded-full bg-white" />}{t}
            </button>
          ))}
        </div>
      )}>
      <div className="mb-2 grid grid-cols-2">
        {[['loan', 'Loan No'], ['bill', 'Bill Book No (F3)']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setBy(k); input.current?.focus(); }}
            className={clsx('-ml-px flex h-8 items-center justify-center gap-1.5 border px-2 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md',
              by === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>
            {by === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}
          </button>
        ))}
      </div>
      <Input ref={input} data-finder prefix={<ScanLine className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} className={clsx('!h-10 text-base font-bold', miss && '!border-rose-300')} placeholder="Type or scan" />
      <p className={clsx('mt-1 text-[11px]', miss ? 'text-rose-600' : 'text-ink-400')}>
        {busy ? 'Looking up…' : miss ? `No loan "${q.trim()}" in this branch` : auto ? 'Loads as you type · Enter · barcode scan works' : 'Press Enter to load · barcode scan works'}
      </p>
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
export const loanCustomer = (l) => (l ? { ...l, id: l.customer_id, title: l.customer_title, name: l.customer_name, phone: l.customer_phone, photo: l.customer_photo || l.customer_photo_master, status: l.customer_status || 'ACTIVE' } : null);

export function CustomerCard({ customer, rows = [], extra, onLedger, onNew, emptyText = 'No customer selected' }) {
  const c = customer;
  // desktop: 5-43, Main Road, Kappiyarai, Nagercoil - 629157
  const addr = c && [[c.door_no, c.street, c.area, c.city].filter(Boolean).join(', '), c.pincode].filter(Boolean).join(' - ');
  if (!c) {
    /* empty state uses the full width of the panel */
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center dark:border-ink-700 dark:bg-ink-800/50">
        <span className="grid size-12 place-items-center rounded-md bg-white text-ink-400 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-700"><UserRound className="size-6" strokeWidth={1.5} /></span>
        <p className="text-[13px] font-semibold text-ink-600 dark:text-ink-300">{emptyText}</p>
        <p className="text-[11px] text-ink-400">Search by mobile, name, A/c no or loan no above</p>
        {onNew && <Button size="sm" variant="outline" icon={Plus} onClick={onNew}>New customer (F1)</Button>}
      </div>
    );
  }
  return (
    <div>
      {/* photo stretches to the full height of the details beside it; click to preview */}
      <div className="flex items-stretch gap-3">
        <ImagePreview src={c.photo || c.customer_photo_master} title={`${c.name || c.customer_name} · A/c ${c.customer_no}`}
          className="min-h-28 w-24 shrink-0 rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
          {(c.photo || c.customer_photo_master)
            ? <img src={c.photo || c.customer_photo_master} alt="" className="size-full object-cover" />
            : <span className="grid size-full place-items-center text-center text-ink-400"><span><UserRound className="mx-auto size-8" strokeWidth={1.25} /><span className="mt-1 block px-1 text-[9px] leading-tight font-bold uppercase">Photo not available</span></span></span>}
        </ImagePreview>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-bold text-navy-900 dark:text-white">{c.title ? `${c.title} ` : ''}{c.name || c.customer_name}</p>
          {c.relation_name && <p className="text-[12px] text-ink-500">{c.relation_type || ''} {c.relation_name}</p>}
          <p className="num mt-1 text-[13px] font-bold">{c.phone || c.customer_phone}</p>
          {addr && <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-600 dark:text-ink-400">{addr}</p>}
          {c.id_proof_type && <p className="text-[11px] text-ink-500">{c.id_proof_type}{c.id_proof_no ? `  ${c.id_proof_no}` : ''}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-900 dark:bg-ink-800 dark:text-white">A/C {c.customer_no}</span>
            <span className={clsx('rounded px-2 py-0.5 text-[11px] font-bold', c.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{c.status || 'ACTIVE'}</span>
          </div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="mt-2.5 grid overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-ink-100 px-2.5 py-1.5 text-[13px] not-last:border-b dark:border-ink-800">
              <span className="text-ink-500">{k}</span><span className="num font-semibold text-navy-900 dark:text-white">{v ?? '-'}</span>
            </div>
          ))}
        </div>
      )}
      {extra}
      {onLedger && <Button size="sm" variant="outline" icon={BookUser} className="mt-2 w-full" onClick={onLedger}>Customer ledger (F5)</Button>}
    </div>
  );
}


/* ------------------------------------------------------------------ pay / receive step */
const PAY_MODES = [['CASH', '1 · Cash', 'notes'], ['UPI', '2 · Online', 'UPI / NEFT'], ['CARD', '3 · Card', 'debit / credit'], ['CHEQUE', '4 · Cheque', 'no. + bank']];

/**
 * Payment step shown after the main action (desktop: Pay Customer / Receive dialog).
 * Lines are added per mode until the balance is 0, then Confirm (F2).
 */
export function PayDrawer({ open, onClose, title, subtitle, total, direction = 'pay', onConfirm, loading, confirmLabel = 'Confirm (F2)', saveWord = 'save', onF6, children }) {
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
    if (Math.abs(balance) > 0.009) return toast.error(`Balance must be 0 to ${saveWord}`);
    onConfirm(lines);
  };
  const onKey = (e) => {
    if (e.key === 'F2') { e.preventDefault(); confirm(); }
    if (e.key === 'F6' && onF6) { e.preventDefault(); onF6(); }
    if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); setMode(PAY_MODES[Number(e.key) - 1][0]); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="lg" icon={Wallet} title={title} subtitle={subtitle}
      footer={<><Button variant="soft-danger" onClick={onClose}>Cancel (Esc)</Button><Button variant="gold" loading={loading} disabled={Math.abs(balance) > 0.009} onClick={confirm}>{confirmLabel}</Button></>}>
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
          {[['Total due', money(total), ''], [direction === 'pay' ? 'Paid' : 'Received', money(paid), 'text-emerald-700'], ['Balance', money(balance), Math.abs(balance) < 0.01 ? 'text-emerald-700' : 'text-rose-600']].map(([k, v, cls]) => (
            <div key={k} className="px-3 py-2"><p className="label">{k}</p><p className={clsx('num flex items-center gap-1 text-lg font-bold', cls)}>{v}{k === 'Balance' && Math.abs(balance) < 0.01 && <Check className="size-5" />}</p></div>
          ))}
        </div>
        {children}
        <p className="text-xs text-ink-500">Balance must be 0 to {saveWord}.</p>
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
    <Panel title="Item photo" bodyClassName="flex flex-col gap-2" actions={value && <button type="button" onClick={() => setBig(true)} title="Enlarge"><Expand className="size-4" /></button>}>
      {/* the photo takes all the room the panel has; buttons sit in one row under it */}
      <button type="button" onClick={() => value && setBig(true)}
        className="grid min-h-32 flex-1 place-items-center overflow-hidden rounded-md border border-dashed border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
        {value ? <img src={value} alt="" className="size-full object-contain" /> : (
          <span className="flex flex-col items-center gap-1.5 text-[12px] text-ink-400"><ImagePlus className="size-7" strokeWidth={1.5} />No photo<span className="text-[11px]">F7 camera · F8 last photo</span></span>
        )}
      </button>
      {!readOnly && (
        <div className="grid shrink-0 grid-cols-4 gap-1 [&_button]:h-8 [&_button]:px-1 [&_button]:text-[12px]">
          <Button size="sm" variant="outline" icon={Camera} onClick={() => setCam(true)}>Camera</Button>
          <Button size="sm" variant="outline" icon={ImagePlus} onClick={() => fileRef.current?.click()}>Browse</Button>
          <Button size="sm" variant="outline" icon={History} onClick={oldPhoto}>Old</Button>
          <Button size="sm" variant="soft-danger" icon={Trash2} disabled={!value} onClick={() => onChange(null)}>Remove</Button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { e.target.files?.[0] && upload(e.target.files[0]); e.target.value = ''; }} />
      <CameraDrawer open={cam} onClose={() => setCam(false)} onCapture={upload} />
      <Drawer open={big} onClose={() => setBig(false)} size="xl" title="Item photo" bodyClassName="flex min-h-0 bg-ink-950 !p-2">{value && <img src={value} alt="" className="min-h-0 w-full flex-1 rounded-md object-contain" />}</Drawer>
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
    if (!v?.videoWidth) return;
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => { onCapture(new File([b], 'cam.jpg', { type: 'image/jpeg' })); onClose(); }, 'image/jpeg', 0.85);
  };
  // Enter captures while the camera is open (the video itself never has focus)
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Enter') { e.preventDefault(); snap(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <Drawer open={open} onClose={onClose} size="lg" title="Camera" icon={Camera} bodyClassName="flex min-h-0 bg-ink-950 !p-2"
      footer={<Button variant="gold" icon={Camera} onClick={snap}>Capture (Enter)</Button>}>
      {/* fills the drawer; contain = shows exactly the frame that will be saved */}
      <video ref={video} autoPlay playsInline muted className="min-h-0 w-full flex-1 rounded-md object-contain" />
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
/**
 * Type-to-search item box. Arrow keys + Enter pick, Esc closes.
 * No match? the last row offers to add what was typed as a new item.
 */
function ItemPicker({ items, value, onPick, onNew, inputRef, onDone }) {
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listRef = useRef(null);
  useEffect(() => { setQ(value || ''); }, [value]);
  const term = q.trim().toLowerCase();
  const list = !term || term === (value || '').toLowerCase() ? items
    : items.filter((x) => x.name.toLowerCase().includes(term) || (x.local_name || '').toLowerCase().includes(term));
  const exact = items.some((x) => x.name.toLowerCase() === term);
  const rows = term && !exact ? [...list, { add: true }] : list;
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => { listRef.current?.children[hi]?.scrollIntoView({ block: 'nearest' }); }, [hi]);
  const choose = (r) => {
    if (!r) return;
    if (r.add) { setOpen(false); onNew(q.trim()); return; }
    onPick(r); setQ(r.name); setOpen(false); onDone?.();
  };
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && rows.length) choose(rows[hi]); else if (value) onDone?.(); else setOpen(true); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQ(value || ''); }
  };
  return (
    <div className="relative flex gap-1">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-400" />
        <input ref={inputRef} className="input pr-7 pl-8" value={q} placeholder="Search item…" autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onPick(null); }}
          onFocus={(e) => { e.target.select(); setOpen(true); }}
          onBlur={() => setTimeout(() => { setOpen(false); setQ(value || ''); }, 120)}
          onKeyDown={keys} />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-ink-400" />
        {open && rows.length > 0 && (
          <ul ref={listRef} className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-200 bg-white py-1 text-[13px] dark:border-ink-700 dark:bg-ink-900">
            {rows.map((r, i) => (
              <li key={r.add ? '__add' : r.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r)} onMouseEnter={() => setHi(i)}
                  className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left', i === hi && 'bg-ink-100 dark:bg-ink-800', r.add && 'border-t border-ink-100 font-semibold text-emerald-700 dark:border-ink-800 dark:text-emerald-400')}>
                  {r.add ? <><Plus className="size-3.5" />Add “{q.trim()}” as new item</> : (
                    <><span className="flex-1 truncate font-medium">{r.name}</span>{r.local_name && <span className="truncate text-[11px] text-ink-400">{r.local_name}</span>}{r.name === value && <Check className="size-3.5 text-emerald-600" />}</>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={() => onNew('')} title="Add new item name (F3)"
        className="grid size-9 shrink-0 place-items-center rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function ItemEntry({ loanOn, rates, lookups, onAdd, editing, currentItems }) {
  const [it, setIt] = useState(blankItem(loanOn === 'SILVER' ? 'SILVER' : 'GOLD'));
  const [newName, setNewName] = useState(null);
  const first = useRef(null);
  const pcsRef = useRef(null);
  const grossRef = useRef(null);
  /* quick item templates: the rest of the chosen template waits here; each Add fills the next item */
  const tpl = useFetch('/masters/item-templates', undefined, { staleTime: 60_000 });
  const [queue, setQueue] = useState([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState(null);
  const tplBox = useRef(null);
  useEffect(() => {
    if (!tplOpen) return undefined;
    const close = (e) => { if (!tplBox.current?.contains(e.target)) setTplOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [tplOpen]);
  const fromTpl = (t) => {
    const metal = loanOn === 'MIX' ? (t.metal || 'GOLD') : loanOn === 'SILVER' ? 'SILVER' : 'GOLD';
    return { ...blankItem(metal), item_name: t.item_name, item_id: t.item_id || null, pcs: t.pcs || 1, purity: t.purity || (metal === 'SILVER' ? 92.5 : 91.6), remarks: t.remarks || '' };
  };
  const applyTemplate = (t) => {
    const [head, ...rest] = t.items;
    setIt(fromTpl(head)); setQueue(rest); setTplOpen(false);
    setTimeout(() => grossRef.current?.focus(), 30);
    toast.message(`Template "${t.name}": weigh each item and press Enter - the next one fills in by itself`);
  };
  const saveTemplate = async () => {
    const name = String(tplName || '').trim();
    if (!name) return toast.error('Enter a name');
    try { await api.post('/masters/item-templates', { name, items: (currentItems || []).map((x) => ({ item_id: x.item_id, item_name: x.item_name, pcs: x.pcs, metal: x.metal, purity: x.purity, remarks: x.remarks })) }); toast.success(`Template "${name}" saved`); setTplName(null); tpl.refetch?.(); } catch (e) { toast.error(e.message); }
  };
  const dropTemplate = async (t) => { try { await api.del(`/masters/item-templates/${t.id}`); toast.success('Template removed'); tpl.refetch?.(); } catch (e) { toast.error(e.message); } };
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
    if (queue.length) {
      const [head, ...rest] = queue;
      setIt(fromTpl(head)); setQueue(rest);
      setTimeout(() => grossRef.current?.focus(), 30);
      return;
    }
    setIt(blankItem(loanOn === 'SILVER' ? 'SILVER' : loanOn === 'MIX' ? it.metal : 'GOLD'));
    first.current?.focus();
  };
  const enter = (e) => e.key === 'Enter' && (e.preventDefault(), add());
  const saveNew = async () => {
    try { const r = await api.post('/masters/items/quick', { name: newName }); lookups.items.push(r.data); setIt({ ...it, item_name: r.data.name, item_id: r.data.id }); setNewName(null); setTimeout(() => pcsRef.current?.focus(), 50); } catch (e) { toast.error(e.message); }
  };
  useKeys({ f3: () => setNewName('') }, []);
  const tplList = tpl.data || [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div ref={tplBox} className="relative">
          <button type="button" onClick={() => setTplOpen((o) => !o)} className="flex h-7 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 text-[12px] font-semibold text-navy-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            <LayoutTemplate className="size-3.5" />Templates{tplList.length ? <span className="num rounded-sm bg-ink-100 px-1 text-[10px] dark:bg-ink-800">{tplList.length}</span> : null}<ChevronDown className="size-3 opacity-60" />
          </button>
          {tplOpen && (
            <div className="absolute top-full left-0 z-30 mt-1 w-80 animate-drop overflow-hidden rounded-md border border-ink-200 bg-white text-[12px] dark:border-ink-700 dark:bg-ink-900">
              <p className="border-b border-ink-100 px-3 py-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase dark:border-ink-800">Item templates - names, pcs, purity (weights are weighed each time)</p>
              <div className="max-h-64 overflow-y-auto py-1">
                {tplList.map((t) => (
                  <div key={t.id} className="group flex items-center gap-1 px-1">
                    <button type="button" onClick={() => applyTemplate(t)} className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800">
                      <span className="block truncate font-semibold text-navy-900 dark:text-white">{t.name}</span>
                      <span className="block truncate text-[11px] text-ink-500">{t.items.map((x) => (x.pcs > 1 ? `${x.item_name} x${x.pcs}` : x.item_name)).join(', ')}</span>
                    </button>
                    <button type="button" title="Remove template" aria-label="Remove template" onClick={() => dropTemplate(t)} className="grid size-6 shrink-0 place-items-center rounded-md text-ink-400 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"><X className="size-3.5" /></button>
                  </div>
                ))}
                {!tplList.length && <p className="px-3 py-3 text-ink-400">No templates yet. Add items to a loan, then save them as a template.</p>}
              </div>
              {currentItems?.length > 0 && (
                <button type="button" onClick={() => { setTplOpen(false); setTplName(''); }} className="flex w-full items-center gap-1.5 border-t border-ink-100 px-3 py-2 text-left font-semibold text-navy-800 hover:bg-ink-50 dark:border-ink-800 dark:text-ink-200 dark:hover:bg-ink-800">
                  <Plus className="size-3.5" />Save these {currentItems.length} item{currentItems.length === 1 ? '' : 's'} as a template
                </button>
              )}
            </div>
          )}
        </div>
        {queue.length > 0 && (
          <span className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            Next: <b className="truncate">{queue.map((x) => x.item_name).join(', ')}</b>
            <button type="button" onClick={() => setQueue([])} className="font-semibold underline">Stop</button>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.5fr)_56px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <span className="label" title="Type to search · F3 / + = new item name">Item <span className="hidden normal-case text-ink-400 2xl:inline">· type to search · F3 / + new</span></span>
          <ItemPicker items={items} value={it.item_name} inputRef={first} onDone={() => pcsRef.current?.focus()}
            onPick={(m) => setIt({ ...it, item_name: m?.name || '', item_id: m?.id || null })}
            onNew={(name) => setNewName(name)} />
        </div>
        <Field label="Pcs"><Input ref={pcsRef} type="number" min="1" value={it.pcs} onChange={(e) => setIt({ ...it, pcs: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Gross wt (g)"><Input ref={grossRef} type="number" step="0.001" value={it.gross_wt} onChange={(e) => setIt({ ...it, gross_wt: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Less wt"><Input type="number" step="0.001" value={it.stone_wt} onChange={(e) => setIt({ ...it, stone_wt: e.target.value })} onKeyDown={enter} /></Field>
        <Field label="Net wt (auto)"><Input readOnly value={c.net_wt ? weight(c.net_wt) : ''} className="bg-ink-50" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_70px_70px_minmax(110px,1.2fr)_auto] sm:items-end">
        <Field label="Remark"><Input prefix={<MessageSquare className="size-3.5" />} value={it.remarks} onChange={(e) => setIt({ ...it, remarks: e.target.value })} onKeyDown={enter} placeholder="Hallmark, damage, seal…" /></Field>
        <Field label="Purity %">
          <Input type="number" step="0.01" list={`pur-${metalCode}`} value={it.purity} onChange={(e) => setIt({ ...it, purity: e.target.value })} onKeyDown={enter} />
          <datalist id={`pur-${metalCode}`}>{purities.map((p) => <option key={p.id} value={p.purity}>{p.name}</option>)}</datalist>
        </Field>
        <Field label="Metal">
          {loanOn === 'MIX'
            ? <Select value={it.metal} onChange={(e) => setIt({ ...it, metal: e.target.value, purity: e.target.value === 'SILVER' ? 92.5 : 91.6 })} options={['GOLD', 'SILVER']} />
            : <Input readOnly value={metalCode} className="bg-ink-50" />}
        </Field>
        <Field label="Value (₹)"><Input readOnly value={c.value ? amount(c.value) : ''} className="bg-ink-50 text-right" title={c.value ? amount(c.value) : ''} /></Field>
        <Button onClick={add} className="h-10">{editing ? 'Update item' : 'Add item'}</Button>
      </div>
      <Modal open={tplName !== null} onClose={() => setTplName(null)} size="sm" icon={LayoutTemplate} title="Save as item template" subtitle={`${currentItems?.length || 0} items - names, pcs and purity (no weights)`}
        footer={<Button variant="gold" onClick={saveTemplate}>Save template</Button>}>
        <Field label="Template name"><Input autoFocus value={tplName || ''} placeholder="e.g. Chain + 2 rings" onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTemplate()} /></Field>
      </Modal>
      <Modal open={newName !== null} onClose={() => setNewName(null)} size="sm" title="New item name" footer={<Button variant="gold" onClick={saveNew}>Save item</Button>}>
        <Field label="Item name"><Input prefix={<Tag className="size-3.5" />} autoFocus value={newName || ''} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNew()} /></Field>
      </Modal>
    </div>
  );
}

/** Items grid with totals (#, Item, Metal, Pcs, Gross, Less, Net, Purity, Fine, Value). */
export function ItemsTable({ items, onRemove, onEdit, valueLabel = 'Value', showValue = true }) {
  const t = items.reduce((s, i) => ({ pcs: s.pcs + n(i.pcs), g: s.g + n(i.gross_wt), l: s.l + n(i.stone_wt), net: s.net + n(i.net_wt), f: s.f + n(i.fine_wt), v: s.v + n(i.value) }), { pcs: 0, g: 0, l: 0, net: 0, f: 0, v: 0 });
  const th = 'px-2 py-1.5 text-right font-semibold';
  return (
    <div className="overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800">
      <table className="w-full min-w-[700px] text-[13px]">
        <thead className="navy-gradient text-[11px] tracking-wider text-white uppercase"><tr>
          <th className="w-8 px-2 py-1.5 text-left font-semibold">#</th><th className="px-2 py-1.5 text-left font-semibold">Item</th><th className="px-2 py-1.5 text-left font-semibold">Metal</th>
          <th className={th}>Pcs</th><th className={th}>Gross</th><th className={th}>Less</th><th className={th}>Net</th><th className={th}>Purity</th><th className={th}>Fine wt</th>
          {showValue && <th className={th}>{valueLabel}</th>}{(onRemove || onEdit) && <th className="w-16" />}
        </tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {!items.length && <tr><td colSpan={11} className="py-6 text-center text-[12px] text-ink-400">No items yet - add one above</td></tr>}
          {items.map((i, k) => (
            <tr key={i.key || i.id || k} className="hover:bg-ink-50 dark:hover:bg-ink-800/50" onDoubleClick={() => onEdit?.(i)}>
              <td className="px-2 py-1">{k + 1}</td><td className="px-2 py-1.5 font-semibold">{i.item_name}{i.remarks ? <span className="ml-1 text-xs font-normal text-ink-400">({i.remarks})</span> : null}</td>
              <td className="px-2 py-1.5">{i.metal || i.metal_code || ''}</td>
              <td className="num px-2 text-right">{i.pcs}</td><td className="num px-2 text-right">{weight(i.gross_wt)}</td><td className="num px-2 text-right">{weight(i.stone_wt)}</td>
              <td className="num px-2 text-right font-semibold">{weight(i.net_wt)}</td><td className="num px-2 text-right">{n(i.purity)}</td><td className="num px-2 text-right">{weight(i.fine_wt)}</td>
              {showValue && <td className="num px-2 text-right">{amount(i.value)}</td>}
              {(onRemove || onEdit) && <td className="px-1 text-right">{onRemove && <button type="button" onClick={() => onRemove(i)} className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Remove (Del)"><Trash2 className="size-4" /></button>}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"><tr className="font-bold">
          <td colSpan={3} className="px-2 py-1.5">Total ({items.length})</td><td className="num px-2 text-right">{t.pcs}</td><td className="num px-2 text-right">{weight(t.g)}</td>
          <td className="num px-2 text-right">{weight(t.l)}</td><td className="num px-2 text-right">{weight(t.net)}</td><td /><td className="num px-2 text-right">{weight(t.f)}</td>
          {showValue && <td className="num px-2 text-right">{amount(t.v)}</td>}{(onRemove || onEdit) && <td />}
        </tr></tfoot>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ LTV bar */
export function LtvBar({ value, max = 75, safe, warn, suffix = '' }) {
  const v = n(value);
  const s = Math.min(n(safe) || max * 0.9, max);       // green up to here
  const limit = Math.max(n(warn) || max, max);         // amber up to here, red beyond
  const level = !v ? 'none' : v > limit ? 'over' : v > s ? 'near' : 'safe';
  const tone = {
    none: { bar: '', text: 'text-ink-400', tag: 'bg-ink-100 text-ink-500', word: 'No items' },
    safe: { bar: 'from-emerald-500 to-emerald-600', text: 'text-emerald-700', tag: 'bg-emerald-50 text-emerald-700', word: 'Safe' },
    near: { bar: 'from-amber-400 to-amber-500', text: 'text-amber-700', tag: 'bg-amber-50 text-amber-800', word: 'Near limit' },
    over: { bar: 'from-rose-500 to-rose-600', text: 'text-rose-600', tag: 'bg-rose-50 text-rose-700', word: 'Over limit' },
  }[level];
  const scale = Math.max(100, limit + 10);              // keep room to show "over"
  const at = (x) => `${Math.min(100, (x / scale) * 100)}%`;
  return (
    <div className="rounded-md border border-ink-200 px-2.5 py-2 dark:border-ink-800">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold tracking-wider text-ink-500 uppercase">Loan to value</span>
        <span className={clsx('rounded-sm px-1.5 py-px text-[10px] font-bold', tone.tag)}>{tone.word}</span>
        <b className={clsx('num ml-auto text-[13px]', tone.text)}>{v ? `${v.toFixed(1)}%${suffix ? ` ${suffix}` : ''}` : '-'}</b>
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-sm bg-ink-100 dark:bg-ink-800">
        {/* faint zones: safe / near / over */}
        <div className="absolute inset-y-0 left-0 bg-emerald-500/15" style={{ width: at(s) }} />
        <div className="absolute inset-y-0 bg-amber-500/20" style={{ left: at(s), width: `calc(${at(limit)} - ${at(s)})` }} />
        <div className="absolute inset-y-0 right-0 bg-rose-500/15" style={{ left: at(limit) }} />
        {/* actual value */}
        {v > 0 && <div className={clsx('absolute inset-y-0 left-0 rounded-sm bg-gradient-to-r transition-all duration-300', tone.bar)} style={{ width: at(v) }} />}
      </div>
      <div className="relative mt-0.5 h-3 text-[9px] font-semibold text-ink-400">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: at(s) }}>{Math.round(s)}%</span>
        <span className="absolute -translate-x-1/2 text-navy-900 dark:text-white" style={{ left: at(limit) }} title={`Scheme limit ${max}%`}>▲ {Math.round(limit)}%</span>
      </div>
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
    <Modal tone="amber" open={!!pending} onClose={() => { pending?.reject(new Error('Approval cancelled')); setPending(null); }} size="sm" icon={ShieldCheck} title="Admin approval" subtitle={pending?.message}
      footer={<Button variant="gold" onClick={approve}>Approve</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-600">Ask the manager / admin to enter their login to approve.</p>
        <Field label="Approver username"><Input autoFocus value={cred.username} onChange={(e) => setCred({ ...cred, username: e.target.value })} /></Field>
        <Field label="Password"><Input type="password" value={cred.password} onChange={(e) => setCred({ ...cred, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && approve()} /></Field>
      </div>
    </Modal>
  );
  return { run, ui };
}

/* ------------------------------------------------------------------ payments received grid */
const PAY_WORD = { CASH: 'Cash', UPI: 'UPI', BANK: 'Bank', CARD: 'Card', CHEQUE: 'Cheque' };
const TXN_LABEL = { INTEREST: 'Interest', PART_PAYMENT: 'Part Amount', TOPUP: 'Top-up', RELEASE: 'Release', RENEWAL: 'Re-loan', AUCTION: 'Auction' };
export function PaymentsGrid({ transactions = [], loan, advanceMode = 'at loan', className }) {
  const adv = loan && n(loan.advance_interest) ? [{ id: 'adv', txn_date: loan.loan_date, txn_type: 'ADVANCE', months_paid: loan.advance_months || 1, total_amount: loan.advance_interest, payments: [{ mode: advanceMode }] }] : [];
  const rows = [...adv, ...transactions.filter((t) => !t.is_void && t.txn_type !== 'DISBURSE')];
  return (
    <div className={clsx('overflow-auto rounded-md border border-ink-200 dark:border-ink-800', className)}>
      <table className="w-full text-[13px]">
        <thead className="navy-gradient sticky top-0 z-10 text-[11px] tracking-wider text-white uppercase"><tr><th className="px-3 py-1.5 text-left font-semibold">Date</th><th className="px-3 text-left font-semibold">Type</th><th className="px-3 text-right font-semibold">Period</th><th className="px-3 text-right font-semibold">Amount</th><th className="px-3 text-left font-semibold">Mode</th></tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-[12px] text-ink-400">No payments yet</td></tr>}
          {rows.map((t) => (
            <tr key={t.id}><td className="px-3 py-1.5">{date(t.txn_date)}</td><td className="px-3">{t.txn_type === 'ADVANCE' ? 'Advance interest' : TXN_LABEL[t.txn_type] || t.txn_type.replace('_', ' ')}</td><td className="num px-3 text-right">{n(t.interest_days) ? `${n(t.interest_days)} day${n(t.interest_days) > 1 ? 's' : ''}` : n(t.months_paid) ? `${n(t.months_paid)} month${n(t.months_paid) > 1 ? 's' : ''}` : ''}{n(t.interest_rate_used) > 0 && <span className="block text-[10px] text-amber-700 dark:text-amber-300">at {rateText(t.interest_rate_used, t.interest_rate_unit)}</span>}</td>
              <td className="num px-3 text-right">{amount(t.total_amount)}{t.txn_type === 'PART_PAYMENT' && n(t.interest_amount) > 0 && <span className="block text-[10px] text-ink-500">Int {amount(t.interest_amount).replace('.00', '')} + Part {amount(Math.abs(n(t.principal_amount))).replace('.00', '')}</span>}</td><td className="px-3">{(t.payments || []).map((p) => (p.amount ? <span key={p.id || p.mode} className="mr-1 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700">{PAY_WORD[p.mode] || p.mode} ₹{amount(p.amount).replace('.00', '')}</span> : p.mode))}</td></tr>
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
