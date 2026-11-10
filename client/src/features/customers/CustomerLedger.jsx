import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BookUser, Pencil, Camera, FolderOpen, Ban, RefreshCw, MessageCircle, Printer, FileSpreadsheet, FileDown, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Drawer, Field, Input, Spinner, Textarea } from '@/components/ui';
import { PhotoBox } from '@/components/common/PhotoBox';
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
  const seg = (val, cur, set, label) => <button key={val} type="button" onClick={() => set(val)} className={clsx('h-9 rounded-md border px-4 text-sm font-semibold', cur === val ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{label}</button>;

  return (
    <Drawer open={!!customerId} onClose={onClose} size="full" icon={BookUser} title="Customer Ledger" subtitle="Complete loan history of one customer - pending, released, auctioned"
      footer={c && (
        <>
          <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F5)</Button>
          <span className="flex-1" />
          <Button variant="outline" icon={MessageCircle} className="text-emerald-700" onClick={whatsapp}>WhatsApp (Ctrl+W)</Button>
          <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
          <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('customer-ledger', cols, printRows)}>Excel (Ctrl+E)</Button>
          <Button variant="outline" icon={ArrowLeft} onClick={onClose}>Back (Esc)</Button>
        </>
      )}>
      {isLoading || !c ? <Spinner /> : (
        <div className="space-y-3" onKeyDown={keys} tabIndex={-1}>
          <div className="flex flex-wrap gap-5 rounded-md bg-ink-50 p-3 dark:bg-ink-800">
            <PhotoBox src={c.photo} className="h-48 w-44" onClick={() => document.getElementById('ledger-photo')?.click()} />
            <input id="ledger-photo" type="file" accept="image/*" className="hidden" onChange={(e) => { e.target.files?.[0] && photo(e.target.files[0]); e.target.value = ''; }} />
            <div className="min-w-64 flex-1 space-y-2 text-sm">
              <p className="text-2xl font-bold text-navy-900 dark:text-white">{c.title} {c.name}</p>
              <span className={clsx('inline-block rounded px-6 py-1 text-sm font-bold text-white', c.status === 'BLOCKED' ? 'bg-rose-600' : 'bg-emerald-700')}>{c.status}</span>
              {[['Relation', c.relation_name && `${c.relation_type || ''} ${c.relation_name}`], ['Address', address], ['Phone', c.phone], ['ID Proof', c.id_proof_type && `${c.id_proof_type} ${c.id_proof_no || ''}`]].map(([k, v]) => (
                <p key={k} className="grid grid-cols-[100px_1fr]"><span className="text-ink-500">{k}</span><b>{v || '-'}</b></p>
              ))}
            </div>
            <div className="min-w-64 space-y-2 text-sm">
              {[['Customer since', date(data.since || c.created_at)], ['Last loan', loans[0] ? date(loans[0].loan_date) : 'Never'], ['Documents', data.documents ? `${data.documents} file(s)` : 'None'], ['Released by other', data.releasedByOther ? date(data.releasedByOther) : 'Never'], ['Blocked reason', c.block_reason]].filter(([, v]) => v).map(([k, v]) => (
                <p key={k} className="grid grid-cols-[130px_1fr]"><span className="text-ink-500">{k}</span><b>{v}</b></p>
              ))}
            </div>
            <div className="grid w-64 content-start gap-2">
              {can('customers', 'edit') && <Button variant="outline" icon={Pencil} onClick={() => setPanel('edit')}>Edit Customer (F6)</Button>}
              <Button variant="outline" icon={Camera} onClick={() => document.getElementById('ledger-photo')?.click()}>Change Photo (F7)</Button>
              <Button variant="outline" icon={FolderOpen} onClick={() => setPanel('docs')}>Documents (F8)</Button>
              {can('customer_blocked', 'edit') && <Button variant="outline" icon={Ban} className="text-rose-700" onClick={() => { setReason(''); setPanel('block'); }}>{c.status === 'BLOCKED' ? 'Unblock' : 'Block'} Customer (Ctrl+B)</Button>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[['All loans', loans.length, `Rs. ${amount(sum(loans, 'principal'))}`, 'border-t-navy-800', 'all'], ['Pending', pending.length, `Rs. ${amount(sum(pending, 'principal'))}`, 'border-t-blue-600', 'pending'],
              ['Interest due today', `Rs. ${amount(sum(pending, 'interest_due'))}`, `on pending loans, as on ${date(data.asOn || new Date())}`, 'border-t-amber-600'],
              ['Released', released.length, `Rs. ${amount(sum(released, 'principal'))} · int. ${amount(sum(released, 'interest_received'))}`, 'border-t-rose-600', 'released'],
              ['Auctioned', auctioned.length, `Rs. ${amount(sum(auctioned, 'principal'))}`, 'border-t-emerald-700', 'auctioned'], ['Part payments', partCount.length, `Rs. ${amount(sum(loans, 'part_paid'))}`, 'border-t-violet-600']].map(([l, v, h, cls, k]) => (
              <button key={l} type="button" disabled={!k} onClick={() => k && setShow(k)} className={clsx('card border-t-4 px-4 py-3 text-left', cls, k && show === k && 'bg-amber-50/60 dark:bg-ink-800')}>
                <p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900 dark:text-white">{v}</p><p className="text-[11px] text-ink-500">{h}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div><p className="label">Show</p><div className="flex gap-1">{[['pending', 'Pending'], ['released', 'Released'], ['auctioned', 'Auctioned'], ['all', 'All']].map(([k, l]) => seg(k, show, setShow, l))}</div></div>
            <div><p className="label">Metal</p><div className="flex gap-1">{[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']].map(([k, l]) => seg(k, metal, setMetal, l))}</div></div>
            <Field label="Search" className="min-w-64 flex-1"><Input className="bg-gold-50" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
            {[['Gold', 'GOLD', 'border-t-amber-500'], ['Silver', 'SILVER', 'border-t-ink-400'], ['Total', '', 'border-t-navy-800']].map(([l, m, cls]) => (
              <div key={l} className={clsx('card min-w-56 border-t-4 px-3 py-1.5', cls)}><p className="text-[10px] font-bold text-ink-500 uppercase">{l}</p><p className="num text-xs font-semibold">{wt(m)}</p></div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border border-ink-300 dark:border-ink-700">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="navy-gradient text-white"><tr>{[...cols.map((x) => x.label), 'Photo'].map((h) => <th key={h} className={clsx('px-2 py-2', ['Net Wt', 'Loan Amount', 'ROI %', 'Months', 'Interest *', 'Total'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!rows.length && <tr><td colSpan={14} className="py-10 text-center text-ink-400">No loans</td></tr>}
                {rows.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-navy-50/60" onDoubleClick={() => { onClose(); navigate(`/loans/counter?loan=${l.id}`); }}>
                    <td className="px-2 py-1.5 font-semibold">{l.bill_no}</td><td className="px-2">{l.manual_bill_no || '-'}</td><td className="px-2">{date(l.loan_date)}</td>
                    <td className="px-2"><span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{l.loan_on}</span></td><td className="px-2 uppercase">{l.items_text || l.item_summary}</td>
                    <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right font-bold">{amount(l.principal)}</td><td className="num px-2 text-right">{n(l.interest_rate)}</td>
                    <td className="num px-2 text-right">{Math.ceil(n(l.months)) || n(l.months_due)}</td><td className="num px-2 text-right">{amount(l.interest_due)}</td><td className="num px-2 text-right">{amount(l.total_due)}</td>
                    <td className="px-2">{l.close_date ? date(l.close_date) : ''}</td>
                    <td className="px-2"><span className={clsx('rounded px-2 py-0.5 text-[11px] font-bold', STATUS[l.status === 'OPEN' && l.bank_pledge_id ? 'IN_BANK' : l.status]?.[1])}>{STATUS[l.status === 'OPEN' && l.bank_pledge_id ? 'IN_BANK' : l.status]?.[0] || l.status}</span></td>
                    <td className="px-2">{l.item_photo ? <a href={l.item_photo} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">View</a> : <span className="text-xs text-ink-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="navy-gradient text-white"><tr className="font-bold">
                <td colSpan={5} className="px-2 py-2">Total - {rows.length} loan{rows.length === 1 ? '' : 's'}</td><td className="num px-2 text-right">{weight(sum(rows, 'net_wt'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'principal'))}</td>
                <td /><td /><td className="num px-2 text-right">{amount(sum(rows, 'interest_due'))}</td><td className="num px-2 text-right">{amount(sum(rows, 'total_due'))}</td><td colSpan={3} />
              </tr></tfoot>
            </table>
          </div>
          <p className="text-xs text-ink-500">* interest as on today · double-click = loan details · F6 edit customer · F7 change photo · F8 documents · Ctrl+B block / unblock · F9 print · Ctrl+W WhatsApp · Ctrl+E Excel · Esc back</p>
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
