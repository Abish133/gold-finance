import { useEffect, useMemo, useRef, useState } from 'react';
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
import { exportCsv } from '@/lib/exporters';
import { NoticeLetters } from '@/features/print/NoticeLetter';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { PageActions } from '@/components/common/PageActions';

const cols = [
  { key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'age', label: 'Age' }, { key: 'customer_name', label: 'Customer' },
  { key: 'items_upper', label: 'Items' }, { key: 'loan_on', label: 'Metal' }, { key: 'gross_wt', label: 'Gross', type: 'weight' }, { key: 'stone_wt', label: 'Less', type: 'weight' },
  { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'loan_amount', label: 'Amount', type: 'money' },
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
      const r = await api.get('/auction/list', { asOn: bd, older_than: 0, from: f.from, to: f.to, loan_on: f.metal, include: f.include });
      const list = r.data.map((x) => ({ ...x, age: `${x.age_months} m`, items_upper: String(x.items_text || x.item_summary || '').toUpperCase() }));
      setRows(list); setSel(list.map((x) => x.id)); setShown(true);
      if (!list.length) toast.info(`No unreleased loans were pledged between ${date(f.from)} and ${date(f.to)}. Change the dates and press Show (F5).`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  // desktop: the list is shown as soon as the screen opens (dates from the billing date)
  const autoShown = useRef(false);
  useEffect(() => {
    if (!bd || !f.from || autoShown.current) return;
    autoShown.current = true;
    show();
  }, [bd, f.from]); // eslint-disable-line react-hooks/exhaustive-deps
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
      printElement(<NoticeLetters loans={chosen} company={company || {}} type={type} auctionDate={auction.date} auctionTime={dayjs(`2000-01-01 ${auction.time}`).format('hh:mm A')} format={via === 'REGISTERED' ? 'MYBOOK_REGISTERED' : 'MYBOOK'} />, { title: 'Notices' });
    } catch (e) { toast.error(e.message); }
  };
  // desktop prints: company name + address lines, title, table, ***** End of Report
  const Head = ({ title }) => (
    <div className="mb-1 font-serif text-black"><p className="text-xl">{company?.name}</p>{[company?.address1, company?.address2, company?.address3].filter(Boolean).map((x) => <p key={x} className="text-[12px] leading-tight">{x}</p>)}<p className="mt-1 text-base">{title}</p></div>
  );
  const End = () => <div className="mt-1 text-center font-bold text-black"><p className="tracking-tighter">********************************************</p><p>End of Report</p></div>;
  const who = (r) => [`${r.customer_title || ''} ${r.customer_name}${r.relation_name ? ` ${r.relation_type || ''} ${r.relation_name}` : ''}`.trim(), r.address].filter(Boolean).join(', ');
  const auctionList = () => need() && printElement(
    <div className="text-[12px] text-black">
      <Head title="Auction List" />
      <table className="w-full border-collapse">
        <thead><tr className="border border-ink-400 bg-ink-100 shadow-[3px_3px_0_#2f7d6d]">{['S No', 'Loan No', 'Pledge Date', 'Amount', 'Loan On', 'Customer Name & Address'].map((h) => <th key={h} className={clsx('px-1 py-1', h === 'Amount' ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
        <tbody>{chosen.map((r, i) => (
          <tr key={r.id} className="border-b border-ink-200 align-top font-semibold"><td className="px-1 pt-3 pb-1">{i + 1}</td><td className="px-1 pt-3">{r.bill_no}</td><td className="px-1 pt-3">{date(r.loan_date)}</td><td className="px-1 pt-3 text-right">{amount(r.loan_amount)}</td><td className="px-1 pt-3">{r.loan_on}</td>
            <td className="px-1 pt-3 pb-1"><p>{who(r)}</p><p>{r.items_upper}</p><p>Gross Wt.{weight(r.gross_wt)} &nbsp;&nbsp; Net Wt. {weight(r.net_wt)} &nbsp;&nbsp; Ph. No : {r.customer_phone}</p></td></tr>
        ))}</tbody>
        <tfoot><tr className="border-b border-ink-300 text-[13px] font-bold"><td className="px-1 py-1 text-rose-700">Total</td><td className="px-1 text-blue-800">{chosen.length}</td><td className="px-1 text-right">₹</td><td colSpan={2} /><td className="px-1">{amount(sum(chosen, 'loan_amount'))}</td></tr></tfoot>
      </table>
      <End />
    </div>, { title: 'Auction List' });
  // desktop: post split amount = loan amount limit - loans below it go in the Certificate of Post list, the rest in the Registered Post list
  const postList = (title, regd) => {
    if (!need()) return;
    if (!n(split)) { toast.info('Enter the post split amount first. Loans below it go in the Certificate of Post list, the rest in the Registered Post list.'); return; }
    const list = chosen.filter((r) => (regd ? n(r.loan_amount) >= n(split) : n(r.loan_amount) < n(split)));
    if (!list.length) { toast.info(`No ticked loans ${regd ? 'from' : 'below'} Rs ${amount(split)}`); return; }
    printElement(
      <div className="text-[12px] text-black">
        <Head title={`${title}  -  ${list.length} record${list.length > 1 ? 's' : ''}`} />
        <table className="w-full border-collapse">
          <thead><tr className="bg-ink-100">{['#', 'Loan', 'Date', 'Customer and Address', 'Loan Amount'].map((h) => <th key={h} className={clsx('px-1 py-1', h === 'Loan Amount' || h === '#' ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
          <tbody>{list.map((r, i) => <tr key={r.id} className="font-semibold"><td className="px-1 pt-2 text-right">{i + 1}</td><td className="px-1 pt-2">{r.bill_no}</td><td className="px-1 pt-2">{date(r.loan_date)}</td><td className="px-1 pt-2">{who(r)}</td><td className="px-1 pt-2 text-right">{amount(r.loan_amount)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-black bg-ink-100 font-bold"><td colSpan={3} /><td className="px-1">Total</td><td className="px-1 text-right">{amount(sum(list, 'loan_amount'))}</td></tr></tfoot>
        </table>
        <End />
      </div>, { title });
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
  useKeys({ f5: show, f6: () => notice('FIRST', 'POST'), f7: () => notice('FINAL', 'REGISTERED'), f9: auctionList, f10: () => postList('List of Certificate of Post', false), f11: () => postList('List of Registered Post', true),
    'ctrl+a': () => setSel(rows.map((r) => r.id)), 'ctrl+d': () => setSel([]), 'ctrl+w': whatsapp, 'ctrl+e': () => exportCsv('auction-list', cols, rows), f2: clear, escape: () => navigate('/') }, [f, rows, sel, auction, split]);

  const seg = (k, opts) => <div className="flex">{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v, ...(k === 'older' ? { to: dayjs(bd || undefined).subtract(v, 'month').format('YYYY-MM-DD') } : {}) })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{f[k] === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div>;
  const tile = (label, v, h, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );
  const pr = (label, fn, pdf) => (
    <Button variant="outline" className="h-9 w-full justify-start text-[13px]" icon={pdf ? List : Printer} onClick={fn}>
      <span className="flex-1 text-left">{label}</span>{pdf ? <FileDown className="size-4 text-rose-600" /> : <Printer className="size-4 text-ink-400" />}
    </Button>
  );

  return (
    /* fit-screen: the page fits the window; the loan list and the side panel scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Auction List &amp; Notices</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Unreleased loans pledged between the selected dates - print notices, auction list and post lists</p></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Pledged from"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Older than</p>{seg('older', [[6, '6 months'], [9, '9 months'], [12, '12 months']])}</div>
        <div><p className="label">Metal</p>{seg('metal', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
        <div><p className="label">Include</p>{seg('include', [['bank', 'In shop + Bank'], ['', 'In shop only']])}</div>
        <Button className="ml-auto h-8" icon={Search} loading={busy} onClick={() => show()}>Show (F5)</Button>
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
            {tile('Loans in list', rows.length, `${chosen.length} ticked for printing`, 'bg-navy-800')}
            {tile('Gold', `Rs ${amount(sum(by('GOLD'), 'loan_amount'))}`, `${by('GOLD').length} loans · ${weight(sum(by('GOLD'), 'net_wt'))} g`, 'bg-amber-600')}
            {tile('Silver', `Rs ${amount(sum(by('SILVER'), 'loan_amount'))}`, `${by('SILVER').length} loans · ${weight(sum(by('SILVER'), 'net_wt'))} g`, 'bg-ink-400')}
            {tile('Mix', `Rs ${amount(sum(by('MIX'), 'loan_amount'))}`, `${by('MIX').length} loans · ${weight(sum(by('MIX'), 'net_wt'))} g`, 'bg-violet-600')}
            <div className="navy-gradient min-w-0 px-3 py-1.5 text-white"><p className="text-[10px] font-bold tracking-wider uppercase opacity-70">Total loan amount</p><p className="num truncate text-[15px] leading-tight font-bold">₹{amount(sum(rows, 'loan_amount'))}</p><p className="truncate text-[10px] opacity-70">{multi ? `${multi} customer${multi > 1 ? 's have' : ' has'} more than 1 loan` : 'No customer has more than one loan'}</p></div>
          </div>
          <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
            <table className="w-full min-w-[1000px] text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="w-10 px-2 py-1.5"><input type="checkbox" checked={rows.length > 0 && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                {cols.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold', ['money', 'weight'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!rows.length && <tr><td colSpan={11} className="py-12 text-center text-[12px] text-ink-400">{shown ? 'No unreleased loans in these dates' : 'Choose the dates and press Show (F5)'}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => toggle(r.id)} className={clsx('cursor-pointer', sel.includes(r.id) ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                    <td className={clsx('border-l-2 px-2 py-1 text-center', sel.includes(r.id) ? 'border-emerald-600' : 'border-transparent')}><input type="checkbox" className="size-3.5 accent-emerald-600" checked={sel.includes(r.id)} readOnly /></td>
                    <td className="px-2 font-semibold">{r.bill_no}{r.bank_pledge_id ? <span className="ml-1 text-[10px] font-bold text-violet-700">BANK</span> : ''}</td><td className="px-2">{date(r.loan_date)}</td><td className="px-2">{r.age}</td>
                    <td className="px-2"><b>{r.customer_name}</b>{custCount[r.customer_id] > 1 && <span className="ml-1 rounded bg-rose-50 px-1 text-[9px] font-bold text-rose-700">{custCount[r.customer_id]} LOANS</span>}<span className="block text-[11px] text-ink-500">{r.relation_name ? `${r.relation_type || ''} ${r.relation_name} · ` : ''}{r.customer_phone}{r.notices ? ` · ${r.notices} notice(s), last ${date(r.last_notice)}` : ''}</span></td>
                    <td className="max-w-48 truncate px-2" title={r.items_upper}>{r.items_upper}</td><td className="px-2">{r.loan_on}</td><td className="num px-2 text-right">{weight(r.gross_wt)}</td><td className="num px-2 text-right">{weight(r.stone_wt)}</td>
                    <td className="num px-2 text-right">{weight(r.net_wt)}</td><td className="num px-2 text-right">{amount(r.loan_amount)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-[12px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr><td colSpan={4} /><td className="px-2 py-1.5">Total - {rows.length} loans</td><td colSpan={2} /><td className="num px-2 text-right">{weight(sum(rows, 'gross_wt'))}</td><td className="num px-2 text-right">{weight(sum(rows, 'stone_wt'))}</td><td className="num px-2 text-right">{weight(sum(rows, 'net_wt'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'loan_amount'))}</td></tr></tfoot>}
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-ink-200 bg-white p-3 xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Notices to customers</p>
            {pr('First Notice (F6)', () => notice('FIRST', 'POST'))}
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Auction date"><Input type="date" value={auction.date} onChange={(e) => setAuction({ ...auction, date: e.target.value })} /></Field>
              <Field label="Time"><Input type="time" value={auction.time} onChange={(e) => setAuction({ ...auction, time: e.target.value })} /></Field>
            </div>
            {pr('Registered Notice (F7)', () => notice('FINAL', 'REGISTERED'))}
          </div>
          <div className="space-y-2 border-t border-ink-100 pt-2.5 dark:border-ink-800">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Lists</p>
            {pr('Auction List (F9)', auctionList)}
            <Field label="Post split amount (Rs)" hint="Loans below this amount go in the Certificate of Post list, the rest in the Registered Post list"><Input type="number" value={split} onChange={(e) => setSplit(e.target.value)} /></Field>
            {pr('Cert. of Post List (F10)', () => postList('List of Certificate of Post', false), true)}
            {pr('Regd. Post List (F11)', () => postList('List of Registered Post', true), true)}
          </div>
        </div>
      </div>
      <PageActions keys="F5 = show · Space or click = tick / untick loan · Ctrl+A = tick all · Ctrl+D = untick all · F9 = auction list · Ctrl+W = WhatsApp / SMS · Ctrl+E = Excel · F2 = clear · Esc = exit">
        <Button variant="outline" icon={CheckSquare} onClick={() => setSel(rows.map((r) => r.id))}>Select All (Ctrl+A)</Button>
        <Button variant="outline" icon={Eraser} onClick={() => setSel([])}>Clear All (Ctrl+D)</Button>
        <p className="mx-1 hidden text-[11px] text-ink-500 lg:block">Only ticked loans are printed. Released loans are never shown.</p>
        <span className="flex-1" />
        <Button className="!bg-emerald-700 !text-white" icon={MessageCircle} onClick={whatsapp}>WhatsApp / SMS (Ctrl+W)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('auction-list', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={Eraser} onClick={clear}>Clear (F2)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </PageActions>
    </div>
  );
}
