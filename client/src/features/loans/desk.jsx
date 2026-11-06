/**
 * Building blocks shared by the counter screens (New Loan, Release, Part Payment,
 * Top-up, Re-loan, Old Loan, Edit). Layout and shortcuts follow the desktop app:
 * navy title bar with info tiles, three panels, bottom action bar with key hints.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ScanLine, LogOut, Plus, BookUser, ShieldCheck, ImagePlus, Camera, History, Trash2, Expand } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Drawer, Field, Input, Select, Spinner, StatusBadge, DataTable } from '@/components/ui';
import { compressImage } from '@/components/ui/ImageCapture';
import { useFetch } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { money, amount, date, weight, n, round2, round3 } from '@/lib/format';

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
          <div key={t.label} className={clsx('min-w-28 rounded-md px-4 py-1.5 text-center', t.gold ? 'bg-gold-500 text-navy-950' : 'bg-white/10')}>
            <p className="text-[11px] font-bold tracking-wide uppercase opacity-90">{t.label}</p>
            <p className="num text-sm font-bold">{t.value ?? '-'}</p>
          </div>
        ))}
      </section>
      <div className={clsx('grid items-start gap-3', cols)}>
        {left && <div className="space-y-3">{left}</div>}
        <div className="min-w-0 space-y-3">{center}</div>
        {right && <div className="space-y-3 xl:sticky xl:top-36">{right}</div>}
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
    <section className={clsx('card overflow-hidden', className)}>
      <header className="navy-gradient flex items-center gap-2 px-4 py-2 text-sm font-bold tracking-wide text-white uppercase">
        <span className="flex-1 truncate">{title}</span>{actions}
      </header>
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Rows of "label .... value" (settlement style). */
export const Line = ({ label, value, tone, bold, minus }) => (
  <div className={clsx('flex items-center justify-between gap-3 py-1 text-sm', bold && 'font-bold', minus && 'text-rose-600', tone)}>
    <span>{minus ? '− ' : ''}{label}</span><span className="num">{value}</span>
  </div>
);

export function BigTotal({ label, value, tone = 'navy' }) {
  return (
    <div className={clsx('rounded-md px-4 py-3 text-white', tone === 'green' ? 'bg-emerald-700' : 'navy-gradient')}>
      <p className="text-xs font-bold tracking-wide uppercase opacity-90">{label}</p>
      <p className="num mt-1 text-3xl font-extrabold">{money(value)}</p>
    </div>
  );
}

export const GoldButton = ({ children, ...p }) => (
  <Button {...p} size="lg" className="h-14 w-full rounded-md !bg-gold-500 text-lg !text-navy-950 hover:!bg-gold-400 border-0">{children}</Button>
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
export function CustomerLedgerDrawer({ customerId, onClose }) {
  const { data, isLoading } = useFetch(customerId ? `/customers/${customerId}/ledger` : null);
  return (
    <Drawer open={!!customerId} onClose={onClose} size="xl" icon={BookUser} title={data ? `Ledger · ${data.customer.name}` : 'Customer ledger'} subtitle={data && `A/c No ${data.customer.customer_no} · ${data.customer.phone}`}>
      {isLoading ? <Spinner /> : (
        <DataTable dense rows={data?.entries || []} columns={[
          { key: 'txn_date', label: 'Date', type: 'date' }, { key: 'bill_no', label: 'Loan' }, { key: 'txn_type', label: 'Type', render: (r) => r.txn_type.replace('_', ' ') },
          { key: 'receipt_no', label: 'Receipt' }, { key: 'principal_amount', label: 'Principal', type: 'money' }, { key: 'interest_amount', label: 'Interest', type: 'money' },
          { key: 'total_amount', label: 'Amount', type: 'money' }, { key: 'balance', label: 'Loan balance', type: 'money' },
        ]} />
      )}
    </Drawer>
  );
}

export function CustomerCard({ customer, extra, onLedger }) {
  if (!customer) {
    return <div className="flex items-center gap-3 text-sm text-ink-500"><Avatar name="?" size="lg" /> No customer loaded</div>;
  }
  const addr = [customer.door_no, customer.street, customer.area, customer.city, customer.pincode].filter(Boolean).join(', ');
  return (
    <div>
      <div className="flex gap-3">
        <Avatar src={customer.photo || customer.customer_photo_master} name={customer.name || customer.customer_name} size="xl" />
        <div className="min-w-0 text-sm">
          <p className="truncate text-base font-bold text-navy-900 dark:text-white">{customer.title ? `${customer.title}. ` : ''}{customer.name || customer.customer_name}</p>
          {customer.relation_name && <p className="text-ink-500">{customer.relation_type} {customer.relation_name}</p>}
          <p>A/c No <b>{customer.customer_no}</b></p>
          <p>{customer.phone || customer.customer_phone}</p>
          {customer.status === 'BLOCKED' && <Badge tone="red">Blocked</Badge>}
        </div>
      </div>
      {addr && <p className="mt-2 text-xs text-ink-600">{addr}</p>}
      {customer.id_proof_type && <p className="text-xs text-ink-500">ID: {customer.id_proof_type} {customer.id_proof_no}</p>}
      {extra}
      {onLedger && <Button size="sm" variant="outline" icon={BookUser} className="mt-3" onClick={onLedger}>Ledger (F5)</Button>}
    </div>
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

/** Compute net, fine and value for a jewel row with the current rates. */
export const computeItem = (it, rates) => {
  const net = round3(Math.max(0, n(it.gross_wt) - n(it.stone_wt)));
  const silver = it.metal === 'SILVER';
  const rate = silver ? n(rates.silver) : n(rates.gold);
  const basis = silver ? 92.5 : 91.6;
  return { ...it, net_wt: net, fine_wt: round3((net * n(it.purity)) / 100), rate_per_gram: rate, value: round2(net * rate * (n(it.purity) / basis)) };
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
export function LtvBar({ value, max = 75 }) {
  const pct = Math.min(100, n(value));
  const tone = pct > max ? 'bg-rose-600' : pct > max * 0.9 ? 'bg-gold-500' : 'bg-emerald-600';
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-600"><span>Loan to value</span><b className="num">{value ? `${n(value).toFixed(1)}%` : '-'}</b></div>
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
export function PaymentsGrid({ transactions = [] }) {
  const rows = transactions.filter((t) => !t.is_void && t.txn_type !== 'DISBURSE');
  return (
    <div className="overflow-hidden rounded-md border border-ink-300">
      <table className="w-full text-sm">
        <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Months</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Mode</th></tr></thead>
        <tbody className="divide-y divide-ink-200">
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-ink-400">No payments yet</td></tr>}
          {rows.map((t) => (
            <tr key={t.id}><td className="px-3 py-1.5">{date(t.txn_date)}</td><td className="px-3">{t.txn_type.replace('_', ' ')}</td><td className="num px-3 text-right">{n(t.months_paid) || ''}</td>
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
