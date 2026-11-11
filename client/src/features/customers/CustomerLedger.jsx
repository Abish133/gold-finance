import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BookUser, Pencil, Camera, FolderOpen, Ban, RefreshCw, MessageCircle, Printer, FileSpreadsheet, FileDown, ArrowLeft, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Drawer, Field, Input, Spinner, Textarea } from '@/components/ui';
import { ImagePreview } from '@/components/common/ImagePreview';
import { DocumentsPanel } from '@/components/common/DocumentsPanel';
import { CustomerFormDrawer } from '@/features/customers/CustomerFormDrawer';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, weight } from '@/lib/format';

const STATUS = { OPEN: ['Pending', 'bg-blue-600 text-white'], CLOSED: ['Released', 'bg-emerald-600 text-white'], RENEWED: ['Released', 'bg-emerald-600 text-white'], IN_BANK: ['In Bank', 'bg-violet-700 text-white'], AUCTIONED: ['Auctioned', 'bg-rose-600 text-white'], CANCELLED: ['Cancelled', 'bg-ink-400 text-white'] };
const SHOW = { pending: (l) => l.status === 'OPEN', released: (l) => ['CLOSED', 'RENEWED'].includes(l.status), auctioned: (l) => l.status === 'AUCTIONED', all: () => true };
const cols = [
  { key: 'bill_no', label: 'Loan No' }, { key: 'manual_bill_no', label: 'Bill Book' }, { key: 'loan_date', label: 'Loan Date', type: 'date' }, { key: 'loan_on', label: 'Metal' },
  { key: 'item_summary', label: 'Pledged Items' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'principal', label: 'Loan Amount', type: 'money' },
  { key: 'interest_rate', label: 'ROI %', type: 'number' }, { key: 'months', label: 'Months', type: 'number' }, { key: 'interest_due', label: 'Interest *', type: 'money' },
  { key: 'total_due', label: 'Total', type: 'money' }, { key: 'close_date', label: 'Closed On', type: 'date' }, { key: 'status', label: 'Status' },
];

const Dot = () => (
  <span className="relative flex size-1.5" aria-hidden>
    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
  </span>
);

/** Customer Ledger (desktop F5): complete loan history of one customer - pending, released, auctioned. */
export function CustomerLedgerDrawer({ customerId, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: company } = useCompany();
  const { data, isLoading, refetch } = useFetch(customerId ? `/customers/${customerId}/ledger` : null);
  const [show, setShow] = useState('pending');
  const [metal, setMetal] = useState('');
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState(null);
  const [reason, setReason] = useState('');
  const c = data?.customer;
  const loans = data?.loans || [];
  const rows = useMemo(() => loans.filter(SHOW[show]).filter((l) => !metal || l.loan_on === metal)
    .filter((l) => !q || `${l.bill_no} ${l.manual_bill_no || ''} ${l.item_summary}`.toLowerCase().includes(q.toLowerCase()))
    .map((l) => ({ ...l, total_due: l.status === 'OPEN' ? l.total_due : n(l.principal) })), [loans, show, metal, q]);
  const sum = (list, k) => list.reduce((s, l) => s + n(l[k]), 0);
  const by = (f) => loans.filter(f);
  const pending = by(SHOW.pending);
  const released = by(SHOW.released);
  const auctioned = by(SHOW.auctioned);
  const partCount = loans.filter((l) => n(l.part_paid) > 0);
  const wt = (m) => { const list = rows.filter((l) => (m ? l.loan_on === m : true)); return `${weight(sum(list, 'net_wt'))} g · Rs. ${amount(sum(list, 'principal'))} · ${list.length}`; };
  const address = c && [[c.door_no, c.street, c.area, c.city].filter(Boolean).join(', '), c.pincode].filter(Boolean).join(' - ');
  const printRows = rows.map((r) => ({ ...r, item_summary: r.items_text || r.item_summary, status: STATUS[r.status === 'OPEN' && r.bank_pledge_id ? 'IN_BANK' : r.status]?.[0] || r.status }));
  const print = () => printTable({ title: `Customer Ledger · ${c.name} (A/c ${c.customer_no})`, company, rows: printRows, columns: cols, totals: { net_wt: sum(rows, 'net_wt'), principal: sum(rows, 'principal'), interest_due: sum(rows, 'interest_due'), total_due: sum(rows, 'total_due') } });
  const whatsapp = () => {
    const text = `${company?.name || ''}\nDear ${c.name}, your pending loans:\n${pending.map((l) => `Loan ${l.bill_no} (${date(l.loan_date)}) - Rs ${amount(l.principal)}, interest due Rs ${amount(l.interest_due)}`).join('\n')}`;
    window.open(`https://wa.me/91${String(c.phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`, '_blank');
  };
  const block = async () => {
    try { await api.post(`/customers/${c.id}/block`, { block: c.status !== 'BLOCKED', reason }); toast.success(c.status === 'BLOCKED' ? 'Customer unblocked' : 'Customer blocked'); setPanel(null); refetch(); qc.invalidateQueries({ queryKey: ['/customers'] }); } catch (e) { toast.error(e.message); }
  };
  const photo = async (file) => {
    try { await api.upload(`/customers/${c.id}/files/photo`, file); toast.success('Photo changed'); refetch(); } catch (e) { toast.error(e.message); }
  };
  const keys = (e) => {
    const k = `${e.ctrlKey ? 'ctrl+' : ''}${e.key.toLowerCase()}`;
    const map = { f5: refetch, f6: () => setPanel('edit'), f7: () => document.getElementById('ledger-photo')?.click(), f8: () => setPanel('docs'), 'ctrl+b': () => setPanel('block'), f9: print, 'ctrl+p': print, 'ctrl+w': whatsapp, 'ctrl+e': () => exportCsv('customer-ledger', cols, printRows) };
    if (c && map[k]) { e.preventDefault(); map[k](); }
  };
  const seg = (val, cur, set, label) => (
    <button key={val} type="button" onClick={() => set(val)}
      className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-3 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md',
        cur === val ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
      {cur === val && <Dot />}{label}
    </button>
  );
  const statusOf = (l) => STATUS[l.status === 'OPEN' && l.bank_pledge_id ? 'IN_BANK' : l.status];

  return (
    <Drawer open={!!customerId} onClose={onClose} size="full" icon={BookUser} title={c ? `Customer Ledger · ${c.name} · A/c ${c.customer_no}` : 'Customer Ledger'} subtitle="Complete loan history of one customer - pending, released, auctioned"
      bodyClassName="flex !px-3 !py-2.5 !overflow-hidden"
      footer={c && (
        <>
          <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F5)</Button>
          <span className="flex-1" />
          <Button variant="outline" icon={MessageCircle} className="text-emerald-700" onClick={whatsapp}>WhatsApp (Ctrl+W)</Button>
          <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
          <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('customer-ledger', cols, printRows)}>Excel (Ctrl+E)</Button>
          <Button variant="soft-danger" icon={ArrowLeft} onClick={onClose}>Back (Esc)</Button>
        </>
      )}>
      {isLoading || !c ? <Spinner /> : (
        <div className="flex min-h-0 w-full flex-col gap-2" onKeyDown={keys} tabIndex={-1}>
          {/* customer strip */}
          <div className="flex shrink-0 flex-wrap items-stretch gap-3 rounded-md border border-ink-200 p-2 dark:border-ink-800">
            <ImagePreview src={c.photo} title={`${c.name} · A/c ${c.customer_no}`} className="min-h-28 w-28 shrink-0 self-stretch rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
              {c.photo ? <img src={c.photo} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-ink-400"><UserRound className="size-9" strokeWidth={1.25} /></span>}
            </ImagePreview>
            <input id="ledger-photo" type="file" accept="image/*" className="hidden" onChange={(e) => { e.target.files?.[0] && photo(e.target.files[0]); e.target.value = ''; }} />
            <div className="flex min-w-64 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-navy-900 dark:text-white">{c.title} {c.name}</p>
                <span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase', c.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{c.status}</span>
                <span className="num rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">A/C {c.customer_no}</span>
              </div>
              <div className="grid flex-1 grid-cols-1 content-stretch overflow-hidden rounded-md border border-ink-200 text-[12px] md:grid-cols-2 2xl:grid-cols-4 dark:border-ink-800">
                {[['Relation', c.relation_name && `${c.relation_type || ''} ${c.relation_name}`], ['Phone', c.phone], ['Address', address], ['ID Proof', c.id_proof_type && `${c.id_proof_type} ${c.id_proof_no || ''}`],
                  ['Customer since', date(data.since || c.created_at)], ['Last loan', loans[0] ? date(loans[0].loan_date) : 'Never'], ['Documents', data.documents ? `${data.documents} file(s)` : 'None'],
                  ['Released by other', data.releasedByOther ? date(data.releasedByOther) : 'Never'], ...(c.block_reason ? [['Blocked reason', c.block_reason]] : [])].map(([k, v]) => (
                  <p key={k} className="flex flex-col justify-center border-r border-b border-ink-100 px-2.5 py-1 dark:border-ink-800"><span className="text-[10px] font-semibold tracking-wider text-ink-400 uppercase">{k}</span><b className="truncate text-[12px] text-navy-900 dark:text-white" title={v || ''}>{v || '-'}</b></p>
                ))}
              </div>
            </div>
            <div className="flex w-full flex-col justify-between gap-1 sm:w-56 [&_button]:h-8 [&_button]:w-full [&_button]:justify-start [&_button]:px-2.5 [&_button]:text-[12px] [&_button_svg]:shrink-0">
              {can('customers', 'edit') && <Button variant="outline" icon={Pencil} onClick={() => setPanel('edit')}>Edit Customer (F6)</Button>}
              <Button variant="outline" icon={Camera} onClick={() => document.getElementById('ledger-photo')?.click()}>Change Photo (F7)</Button>
              <Button variant="outline" icon={FolderOpen} onClick={() => setPanel('docs')}>Documents (F8)</Button>
              {can('customer_blocked', 'edit') && <Button variant="soft-danger" icon={Ban} onClick={() => { setReason(''); setPanel('block'); }}>{c.status === 'BLOCKED' ? 'Unblock' : 'Block'} Customer (Ctrl+B)</Button>}
            </div>
          </div>

          {/* figures - the counted ones also filter the table */}
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 sm:grid-cols-3 xl:grid-cols-6 dark:border-ink-800">
            {[['All loans', loans.length, `₹${amount(sum(loans, 'principal'))}`, 'bg-navy-900 dark:bg-white', 'all'], ['Pending', pending.length, `₹${amount(sum(pending, 'principal'))}`, 'bg-blue-600', 'pending'],
              ['Interest due', `₹${amount(sum(pending, 'interest_due'))}`, `as on ${date(data.asOn || new Date())}`, 'bg-amber-500'],
              ['Released', released.length, `₹${amount(sum(released, 'principal'))} · int. ${amount(sum(released, 'interest_received'))}`, 'bg-emerald-600', 'released'],
              ['Auctioned', auctioned.length, `₹${amount(sum(auctioned, 'principal'))}`, 'bg-rose-600', 'auctioned'], ['Part payments', partCount.length, `₹${amount(sum(loans, 'part_paid'))}`, 'bg-violet-600']].map(([l, v, h, bar, k]) => (
              <button key={l} type="button" disabled={!k} onClick={() => k && setShow(k)}
                className={clsx('relative border-ink-200 px-3 py-1.5 pl-4 text-left transition not-last:border-r dark:border-ink-800', k ? 'hover:bg-ink-50 dark:hover:bg-ink-800/50' : 'cursor-default', k && show === k && 'bg-emerald-50/70 dark:bg-emerald-950/30')}>
                <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}{k && show === k && <Dot />}</p>
                <p className="num text-lg leading-tight font-bold text-navy-900 dark:text-white">{v}</p>
                <p className="truncate text-[10px] text-ink-500">{h}</p>
              </button>
            ))}
          </div>

          {/* filters */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex">{[['pending', 'Pending'], ['released', 'Released'], ['auctioned', 'Auctioned'], ['all', 'All']].map(([k, l]) => seg(k, show, setShow, l))}</div>
            <div className="flex">{[['', 'All metals'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => seg(k, metal, setMetal, l))}</div>
            <div className="min-w-56 flex-1"><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Search loan no, bill book or item…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {[['Gold', 'GOLD', 'bg-amber-500'], ['Silver', 'SILVER', 'bg-slate-400'], ['Total', '', 'bg-navy-900 dark:bg-white']].map(([l, m, dot]) => (
              <span key={l} className="flex h-8 items-center gap-1.5 rounded-md border border-ink-200 px-2 text-[11px] dark:border-ink-800">
                <span className={clsx('size-2 rounded-sm', dot)} /><b className="text-ink-500 uppercase">{l}</b><span className="num font-semibold">{wt(m)}</span>
              </span>
            ))}
          </div>

          {/* loans - fills the rest; header and total stay put while rows scroll */}
          <div className="min-h-40 flex-1 overflow-auto rounded-md border border-ink-200 dark:border-ink-800">
            <table className="w-full min-w-[1100px] text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{[...cols.map((x) => x.label), 'Photo'].map((h) => <th key={h} className={clsx('px-2 py-1.5 font-semibold', ['Net Wt', 'Loan Amount', 'ROI %', 'Months', 'Interest *', 'Total'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!rows.length && <tr><td colSpan={14} className="py-10 text-center text-[12px] text-ink-400">No loans in this view</td></tr>}
                {rows.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50" title="Click for loan details" onClick={() => { onClose(); navigate(`/loans/counter?loan=${l.id}`); }}>
                    <td className="num px-2 py-1 font-semibold">{l.bill_no}</td><td className="px-2">{l.manual_bill_no || '-'}</td><td className="num px-2">{date(l.loan_date)}</td>
                    <td className="px-2"><span className={clsx('rounded-sm px-1.5 text-[10px] font-bold', l.loan_on === 'SILVER' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800')}>{l.loan_on}</span></td>
                    <td className="max-w-72 truncate px-2 uppercase" title={l.items_text || l.item_summary}>{l.items_text || l.item_summary}</td>
                    <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right font-bold">{amount(l.principal)}</td><td className="num px-2 text-right">{n(l.interest_rate)}</td>
                    <td className="num px-2 text-right">{Math.ceil(n(l.months)) || n(l.months_due)}</td><td className="num px-2 text-right">{amount(l.interest_due)}</td><td className="num px-2 text-right font-semibold">{amount(l.total_due)}</td>
                    <td className="num px-2">{l.close_date ? date(l.close_date) : ''}</td>
                    <td className="px-2"><span className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-bold', statusOf(l)?.[1])}>{statusOf(l)?.[0] || l.status}</span></td>
                    <td className="px-2 py-0.5" onClick={(e) => e.stopPropagation()}>{l.item_photo
                      ? <ImagePreview src={l.item_photo} title={`Item photo · Loan #${l.bill_no}`} className="block size-7 rounded-sm border border-ink-200 dark:border-ink-700"><img src={l.item_photo} alt="" className="size-full object-cover" /></ImagePreview>
                      : <span className="text-ink-300">-</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr className="font-bold">
                <td colSpan={5} className="px-2 py-1.5">Total · {rows.length} loan{rows.length === 1 ? '' : 's'}</td><td className="num px-2 text-right">{weight(sum(rows, 'net_wt'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'principal'))}</td>
                <td /><td /><td className="num px-2 text-right">{amount(sum(rows, 'interest_due'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'total_due'))}</td><td colSpan={3} />
              </tr></tfoot>
            </table>
          </div>
          <p className="shrink-0 truncate text-[11px] text-ink-400">* interest as on today · click a loan = loan details · F6 edit · F7 photo · F8 documents · Ctrl+B block · F9 print · Ctrl+W WhatsApp · Ctrl+E Excel · Esc back</p>
        </div>
      )}
      <CustomerFormDrawer open={panel === 'edit'} customer={c} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refetch(); }} />
      <Drawer open={panel === 'docs'} onClose={() => setPanel(null)} size="lg" icon={FolderOpen} title={`Documents · ${c?.name || ''}`}>{c && <DocumentsPanel owner="customer" id={c.id} canEdit={can('customers', 'edit')} />}</Drawer>
      <Drawer open={panel === 'block'} onClose={() => setPanel(null)} size="sm" icon={Ban} title={c?.status === 'BLOCKED' ? 'Unblock customer' : 'Block customer'}
        footer={<Button variant={c?.status === 'BLOCKED' ? 'primary' : 'danger'} onClick={block}>{c?.status === 'BLOCKED' ? 'Unblock' : 'Block'}</Button>}>
        {c?.status !== 'BLOCKED' ? <Field label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field> : <p className="text-sm">New loans will be allowed again for {c?.name}.</p>}
      </Drawer>
    </Drawer>
  );
}
