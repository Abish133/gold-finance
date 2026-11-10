import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Printer, List, FileDown, CheckSquare, Eraser, MessageCircle, FileSpreadsheet, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useCompany, useFetch, useSettings } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { NoticeLetters } from '@/features/print/NoticeLetter';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const cols = [
  { key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'age', label: 'Age' }, { key: 'customer_name', label: 'Customer' },
  { key: 'item_summary', label: 'Items' }, { key: 'loan_on', label: 'Metal' }, { key: 'gross_wt', label: 'Gross', type: 'weight' }, { key: 'stone_wt', label: 'Less', type: 'weight' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'principal', label: 'Amount', type: 'money' },
];
const yearAgo = (m) => dayjs(today()).subtract(m, 'month').format('YYYY-MM-DD');

/** Auction List & Notices (desktop): unreleased loans pledged between dates - print notices, auction list and post lists. */
export default function AuctionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data: settings } = useSettings();
  const [f, setF] = useState({ from: yearAgo(24), to: yearAgo(12), older: 12, metal: '', include: 'bank' });
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState([]);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auction, setAuction] = useState({ date: dayjs(today()).add(15, 'day').format('YYYY-MM-DD'), time: '11:00' });
  const [split, setSplit] = useState('');
  // desktop: dates work from the billing date - oldest open loan up to (billing date - N months); auction 15 days after
  const { data: billing } = useFetch('/desk/billing-date');
  const bd = billing?.billingDate;
  useEffect(() => {
    if (!bd || shown) return;
    setF((x) => ({ ...x, from: billing.oldestOpen || dayjs(bd).subtract(24, 'month').format('YYYY-MM-DD'), to: dayjs(bd).subtract(x.older, 'month').format('YYYY-MM-DD') }));
    setAuction((a) => ({ ...a, date: dayjs(bd).add(15, 'day').format('YYYY-MM-DD') }));
  }, [bd]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = async () => {
    setBusy(true);
    try {
      const r = await api.get('/auction/list', { asOn: bd, older_than: f.older, from: f.from, to: f.to, loan_on: f.metal, include: f.include });
      const list = r.data.map((x) => ({ ...x, age: `${x.age_months} m` }));
      setRows(list); setSel(list.map((x) => x.id)); setShown(true);
      if (!list.length) toast.info(`No unreleased loans were pledged between ${date(f.from)} and ${date(f.to)}. Change the dates and press Show (F5).`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const chosen = rows.filter((r) => sel.includes(r.id));
  const by = (m) => rows.filter((r) => r.loan_on === m);
  const sum = (list, k) => list.reduce((s, r) => s + n(r[k]), 0);
  const custCount = useMemo(() => { const c = {}; rows.forEach((r) => { c[r.customer_id] = (c[r.customer_id] || 0) + 1; }); return c; }, [rows]);
  const multi = useMemo(() => { const c = {}; rows.forEach((r) => { c[r.customer_id] = (c[r.customer_id] || 0) + 1; }); return Object.values(c).filter((x) => x > 1).length; }, [rows]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const need = () => { if (!chosen.length) { toast.error('Tick the loans to print'); return false; } return true; };

  // notices are recorded against each loan (postage is collected at release)
  const notice = async (type, via) => {
    if (!need()) return;
    try {
      if (!isAllBranches && can('auction', 'add')) await api.post('/auction/notices', { loan_ids: sel, notice_type: type, sent_via: via, notice_date: today(), postage: via === 'REGISTERED' ? settings?.NOTICE_POSTAGE : 0 });
      qc.invalidateQueries({ queryKey: ['/auction/list'] });
      printElement(<NoticeLetters loans={chosen} company={company || {}} type={type} auctionDate={auction.date} auctionTime={dayjs(`2000-01-01 ${auction.time}`).format('hh:mm A')} format={via === 'REGISTERED' ? 'REGISTERED' : 'LETTER'} />, { title: 'Notices' });
    } catch (e) { toast.error(e.message); }
  };
  const auctionList = () => need() && printTable({ title: `Auction List · auction on ${date(auction.date)} ${dayjs(`2000-01-01 ${auction.time}`).format('hh:mm A')}`, company, rows: chosen, columns: cols,
    totals: { gross_wt: sum(chosen, 'gross_wt'), net_wt: sum(chosen, 'net_wt'), current_principal: sum(chosen, 'principal') } });
  // post lists: name + address per letter; split into sheets of "post split amount" worth of postage when given
  const postList = (title, regd) => {
    if (!need()) return;
    const per = n(settings?.NOTICE_POSTAGE) || 0;
    const lines = chosen.map((r, i) => ({ sno: i + 1, name: `${r.customer_title || ''} ${r.customer_name}${r.relation_name ? ` ${r.relation_type || ''} ${r.relation_name}` : ''}`, address: r.address, loan: r.bill_no, postage: regd ? per : '' }));
    const size = n(split) && per ? Math.max(1, Math.floor(n(split) / per)) : lines.length;
    const parts = []; for (let i = 0; i < lines.length; i += size) parts.push(lines.slice(i, i + size));
    printElement(<div>{parts.map((p, k) => (
      <div key={k} className={k < parts.length - 1 ? 'page-break' : ''}>
        <div className="mb-2 text-center text-black"><p className="text-base font-bold">{company?.name}</p><p className="font-semibold">{title}{parts.length > 1 ? ` · sheet ${k + 1} of ${parts.length}` : ''}</p><p className="text-xs">Date: {date(new Date())}</p></div>
        <table className="w-full border-collapse text-[11px] text-black"><thead><tr>{['S.No', 'Name', 'Address', 'Loan', regd && 'Postage'].filter(Boolean).map((h) => <th key={h} className="border border-black bg-gray-100 px-1 text-left">{h}</th>)}</tr></thead>
          <tbody>{p.map((l) => <tr key={l.sno}><td className="border border-black px-1">{l.sno}</td><td className="border border-black px-1">{l.name}</td><td className="border border-black px-1">{l.address}</td><td className="border border-black px-1">{l.loan}</td>{regd && <td className="border border-black px-1 text-right">{l.postage}</td>}</tr>)}</tbody></table>
        <div className="mt-8 flex justify-between text-xs text-black"><span>Total letters: {p.length}</span><span>Signature / Post office seal</span></div>
      </div>
    ))}</div>, { title });
  };
  const whatsapp = async () => {
    if (!need()) return;
    try {
      if (!isAllBranches) await api.post('/auction/notices', { loan_ids: sel, notice_type: 'REMINDER', sent_via: 'SMS', notice_date: today(), postage: 0, sms: true });
      toast.success(`${chosen.length} reminder message(s) queued`);
      if (chosen.length === 1) { const r = chosen[0]; window.open(`https://wa.me/91${String(r.customer_phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`${company?.name}: Loan ${r.bill_no} dated ${date(r.loan_date)} is due. Please pay before ${date(auction.date)} to avoid auction.`)}`, '_blank'); }
    } catch (e) { toast.error(e.message); }
  };
  const clear = () => { setRows([]); setSel([]); setShown(false); };
  useKeys({ f5: show, f6: () => notice('FIRST', 'POST'), f7: () => notice('FINAL', 'REGISTERED'), f9: auctionList, f10: () => postList('Certificate of Posting List', false), f11: () => postList('Registered Post List', true),
    'ctrl+a': () => setSel(rows.map((r) => r.id)), 'ctrl+d': () => setSel([]), 'ctrl+w': whatsapp, 'ctrl+e': () => exportCsv('auction-list', cols, rows), f2: clear, escape: () => navigate('/') }, [f, rows, sel, auction, split]);

  const seg = (k, opts) => <div className="flex gap-1">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v, ...(k === 'older' ? { to: dayjs(bd || undefined).subtract(v, 'month').format('YYYY-MM-DD') } : {}) })} className={clsx('h-10 rounded-md border px-4 text-sm font-semibold', f[k] === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>)}</div>;
  const tile = (label, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{label}</p><p className="num text-2xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  const pr = (label, fn, pdf) => (
    <div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1 justify-start" icon={pdf ? List : Printer} onClick={fn}>{label}</Button>
      <Button variant="outline" size="lg" title="Print" onClick={fn}>{pdf ? <FileDown className="size-4 text-rose-600" /> : <Printer className="size-4" />}</Button></div>
  );

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Auction List &amp; Notices</h1><p className="text-sm text-navy-100">Unreleased loans pledged between the selected dates - print notices, auction list and post lists</p></section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <Field label="Pledged from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Older than</p>{seg('older', [[6, '6 months'], [9, '9 months'], [12, '12 months']])}</div>
        <div><p className="label">Metal</p>{seg('metal', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Include</p>{seg('include', [['bank', 'In shop + Bank'], ['', 'In shop only']])}</div>
        <Button className="ml-auto" size="lg" variant="outline" icon={Search} loading={busy} onClick={show}>Show (F5)</Button>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-5">
            {tile('Loans in list', rows.length, `${chosen.length} ticked for printing`, 'border-t-navy-800')}
            {tile('Gold', `Rs ${amount(sum(by('GOLD'), 'principal'))}`, `${by('GOLD').length} loans · ${weight(sum(by('GOLD'), 'net_wt'))} g`, 'border-t-amber-600')}
            {tile('Silver', `Rs ${amount(sum(by('SILVER'), 'principal'))}`, `${by('SILVER').length} loans · ${weight(sum(by('SILVER'), 'net_wt'))} g`, 'border-t-ink-400')}
            {tile('Mix', `Rs ${amount(sum(by('MIX'), 'principal'))}`, `${by('MIX').length} loans · ${weight(sum(by('MIX'), 'net_wt'))} g`, 'border-t-violet-600')}
            <div className="navy-gradient rounded-md px-4 py-3 text-white"><p className="text-xs font-bold uppercase">Total loan amount</p><p className="num text-2xl font-bold">Rs {amount(sum(rows, 'principal'))}</p><p className="text-[11px]">{multi ? `${multi} customer${multi > 1 ? 's have' : ' has'} more than 1 loan` : 'No customer has more than one loan'}</p></div>
          </div>
          <div className="card overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="navy-gradient text-white"><tr><th className="w-10 px-2 py-2"><input type="checkbox" checked={rows.length > 0 && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                {cols.map((c) => <th key={c.key} className={clsx('px-2 py-2', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!rows.length && <tr><td colSpan={11} className="py-20 text-center text-ink-400">{shown ? 'No unreleased loans in these dates' : 'Choose the dates and press Show (F5)'}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => toggle(r.id)} className={clsx('cursor-pointer', sel.includes(r.id) && 'bg-navy-50/70 dark:bg-ink-800')}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={sel.includes(r.id)} readOnly /></td>
                    <td className="px-2 font-semibold">{r.bill_no}{r.bank_pledge_id ? <span className="ml-1 text-[10px] font-bold text-violet-700">BANK</span> : ''}</td><td className="px-2">{date(r.loan_date)}</td><td className="px-2">{r.age}</td>
                    <td className="px-2"><b>{r.customer_name}</b>{custCount[r.customer_id] > 1 && <span className="ml-1 rounded bg-rose-50 px-1 text-[9px] font-bold text-rose-700">{custCount[r.customer_id]} LOANS</span>}<span className="block text-[11px] text-ink-500">{r.customer_phone}{r.notices ? ` · ${r.notices} notice(s), last ${date(r.last_notice)}` : ''}</span></td>
                    <td className="px-2">{r.item_summary}</td><td className="px-2">{r.loan_on}</td><td className="num px-2 text-right">{weight(r.gross_wt)}</td><td className="num px-2 text-right">{weight(r.stone_wt)}</td>
                    <td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.current_principal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          <div className="card space-y-3 p-4">
            <p className="text-sm font-bold text-amber-700 uppercase">Notices to customers</p>
            {pr('First Notice (F6)', () => notice('FIRST', 'POST'))}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Auction date"><Input type="date" value={auction.date} onChange={(e) => setAuction({ ...auction, date: e.target.value })} /></Field>
              <Field label="Time"><Input type="time" value={auction.time} onChange={(e) => setAuction({ ...auction, time: e.target.value })} /></Field>
            </div>
            {pr('Registered Notice (F7)', () => notice('FINAL', 'REGISTERED'))}
          </div>
          <div className="card space-y-3 p-4">
            <p className="text-sm font-bold text-amber-700 uppercase">Lists</p>
            {pr('Auction List (F9)', auctionList)}
            <Field label="Post split amount (Rs)" hint="Splits the post lists into sheets of this postage value"><Input type="number" value={split} onChange={(e) => setSplit(e.target.value)} /></Field>
            {pr('Cert. of Post List (F10)', () => postList('Certificate of Posting List', false), true)}
            {pr('Regd. Post List (F11)', () => postList('Registered Post List', true), true)}
          </div>
        </div>
      </div>
      <div className="card flex flex-wrap items-center gap-2 px-3 py-2">
        <Button variant="outline" icon={CheckSquare} onClick={() => setSel(rows.map((r) => r.id))}>Select All (Ctrl+A)</Button>
        <Button variant="outline" icon={Eraser} onClick={() => setSel([])}>Clear All (Ctrl+D)</Button>
        <p className="mx-2 text-sm text-ink-500">Only ticked loans are printed. Released loans are never shown.</p>
        <span className="flex-1" />
        <Button className="!bg-emerald-700 !text-white" icon={MessageCircle} onClick={whatsapp}>WhatsApp / SMS (Ctrl+W)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auction-list', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={Eraser} onClick={clear}>Clear (F2)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 = show · Space or click = tick / untick loan · Ctrl+A = tick all · Ctrl+D = untick all · F9 = auction list · Ctrl+W = WhatsApp / SMS · Ctrl+E = Excel · F2 = clear · Esc = exit</p>
    </div>
  );
}
