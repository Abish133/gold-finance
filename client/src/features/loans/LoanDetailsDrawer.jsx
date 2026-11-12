import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/components/ui/ImageCapture';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import clsx from 'clsx';
import { Button, Drawer } from '@/components/ui';
import { ImagePreview } from '@/components/common/ImagePreview';
import { amount, date, n, weight } from '@/lib/format';

const STATUS = { OPEN: ['Pending', 'bg-blue-600'], CLOSED: ['Released', 'bg-emerald-600'], RENEWED: ['Re-loaned', 'bg-sky-600'], AUCTIONED: ['Auctioned', 'bg-rose-600'], CANCELLED: ['Cancelled', 'bg-ink-500'] };
/** label-over-value cell, used in the compact grids */
const Cell = ({ k, v, tone }) => (
  <div className="min-w-0 border-r border-b border-ink-100 px-2.5 py-1 dark:border-ink-800">
    <p className="text-[10px] font-semibold tracking-wider text-ink-400 uppercase">{k}</p>
    <p className={clsx('num text-[12px] leading-snug font-bold break-words', tone || 'text-navy-900 dark:text-white')}>{v ?? '-'}</p>
  </div>
);
const Box = ({ title, right, className, children }) => (
  <section className={clsx('flex min-w-0 flex-col overflow-hidden rounded-md border border-ink-200 dark:border-ink-800', className)}>
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 pr-1.5 pl-2.5 dark:border-ink-800">
      <span aria-hidden className="h-3 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />
      <span className="flex-1 truncate text-[10px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{title}</span>{right}
    </header>
    {children}
  </section>
);

/** Loan Details (desktop F7): customer, item photo, pledged items, loan and release summary. */
export function LoanDetailsDrawer({ full, onClose }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const l = full?.loan;
  const shownPhoto = photo && l && photo.id === l.id ? photo.path : l?.item_photo;
  const changePhoto = async (file) => {
    try {
      const small = await compressImage(file);
      const r = await api.upload(`/loans/${l.id}/photo`, small);
      setPhoto({ id: l.id, path: r.data.item_photo });
      qc.invalidateQueries({ queryKey: [`/loans/${l.id}`] });
      toast.success('Item photo changed');
    } catch (e) { toast.error(e.message); }
  };
  const items = full?.items || [];
  const txns = (full?.transactions || []).filter((t) => !t.is_void);
  const parts = txns.filter((t) => t.txn_type === 'PART_PAYMENT');
  const rel = txns.find((t) => ['RELEASE', 'RENEWAL', 'AUCTION'].includes(t.txn_type));
  const st = STATUS[l?.status] || [l?.status, 'bg-ink-500'];
  const tot = items.reduce((s, i) => ({ g: s.g + n(i.gross_wt), net: s.net + n(i.net_wt), v: s.v + n(i.value) }), { g: 0, net: 0, v: 0 });
  return (
    <Drawer open={!!l} onClose={onClose} size="xl" icon={FileText} bodyClassName="flex !px-3 !py-2.5 sm:!overflow-hidden" title={l ? `Loan Details - Loan No ${l.bill_no}` : ''}
      subtitle={l && [l.manual_bill_no && `Bill Book No ${l.manual_bill_no}`, `Pledged on ${date(l.loan_date)}`, l.loan_on].filter(Boolean).join(' · ')}
      footer={<><span className={clsx('rounded-md px-3 py-1 text-[12px] font-bold text-white uppercase', st[1])}>{st[0]}</span><span className="flex-1" /><Button variant="soft-danger" onClick={onClose}>Close (Esc)</Button></>}>
      {l && (
        <div className="flex min-h-0 w-full flex-col gap-2">
          {/* customer + item photo */}
          <div className="grid shrink-0 gap-2 lg:grid-cols-[1fr_300px]">
            <Box title="Customer">
              <div className="flex items-stretch gap-2.5 p-2">
                <ImagePreview src={l.customer_photo || l.customer_photo_master} title={l.customer_name} className="w-20 shrink-0 self-stretch rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
                  {(l.customer_photo || l.customer_photo_master)
                    ? <img src={l.customer_photo || l.customer_photo_master} alt="" className="size-full object-cover" />
                    : <span className="grid size-full min-h-20 place-items-center text-lg font-bold text-ink-400">{(l.customer_name || '?').slice(0, 2).toUpperCase()}</span>}
                </ImagePreview>
                <div className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-md border border-ink-200 sm:grid-cols-3 dark:border-ink-800">
                  <Cell k="Customer A/c" v={l.customer_no} /><Cell k="Name" v={`${l.customer_title || ''} ${l.customer_name}`} /><Cell k="Relation" v={l.relation_name && `${l.relation_type || ''} ${l.relation_name}`} />
                  <Cell k="Phone" v={l.customer_phone} /><Cell k="ID Proof" v={l.id_proof_type} /><Cell k="Address" v={[l.door_no, l.street, l.area, l.city].filter(Boolean).join(', ')} />
                </div>
              </div>
            </Box>
            <Box title="Item photo" right={(can('loan_edit', 'add') || can('loan_new', 'add')) && <Button size="sm" variant="outline" icon={ImagePlus} className="h-6 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5" onClick={() => fileRef.current?.click()}>Change photo</Button>}>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { e.target.files?.[0] && changePhoto(e.target.files[0]); e.target.value = ''; }} />
              <ImagePreview src={shownPhoto} title={`Item photo · Loan #${l.bill_no}`} className="m-2 grid h-24 place-items-center rounded-md bg-ink-50 dark:bg-ink-800">
                {shownPhoto ? <img src={shownPhoto} alt="" className="size-full object-contain" /> : <span className="text-[12px] text-ink-400">No item photo saved</span>}
              </ImagePreview>
            </Box>
          </div>

          {/* items - fills the middle, rows scroll */}
          <Box title={`Pledged items · ${items.length}`} className="min-h-32 flex-1">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['S.No', 'Item', 'Metal', 'Pcs', 'Gross Wt', 'Less Wt', 'Net Wt', 'Purity', 'Item Value'].map((h, i) => <th key={h} className={clsx('px-2.5 py-1.5 font-semibold', i > 2 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{items.map((i, k) => (
                  <tr key={i.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50"><td className="px-2.5 py-1">{k + 1}</td><td className="px-2.5 font-semibold uppercase">{i.item_name}{i.remarks ? <span className="text-[11px] font-normal text-ink-500 normal-case"> ({i.remarks})</span> : ''}</td>
                    <td className="px-2.5"><span className={clsx('rounded-sm px-1.5 text-[10px] font-bold', (i.metal_code || l.loan_on) === 'SILVER' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800')}>{i.metal_code || l.loan_on}</span></td>
                    <td className="num px-2.5 text-right">{i.pcs}</td><td className="num px-2.5 text-right">{weight(i.gross_wt)}</td><td className="num px-2.5 text-right">{weight(i.stone_wt)}</td><td className="num px-2.5 text-right font-semibold">{weight(i.net_wt)}</td>
                    <td className="num px-2.5 text-right">{n(i.purity)}</td><td className="num px-2.5 text-right">{amount(i.value)}</td></tr>
                ))}</tbody>
                <tfoot className="sticky bottom-0 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                  <tr><td colSpan={3} className="px-2.5 py-1">Total</td><td className="num px-2.5 text-right">{items.reduce((t, i) => t + n(i.pcs), 0)}</td><td className="num px-2.5 text-right">{weight(tot.g)}</td><td />
                    <td className="num px-2.5 text-right">{weight(tot.net)}</td><td /><td className="num px-2.5 text-right">{amount(tot.v)}</td></tr>
                </tfoot>
              </table>
            </div>
          </Box>

          {/* loan + release */}
          <div className="grid shrink-0 gap-2 lg:grid-cols-[3fr_2fr]">
            <Box title="Loan">
              <div className="grid grid-cols-2 sm:grid-cols-5">
                <Cell k="Loan date" v={date(l.loan_date)} /><Cell k="Bill book no" v={l.manual_bill_no} /><Cell k="Loan amount" v={amount(l.principal)} />
                <Cell k="Interest" v={`${n(l.interest_rate).toFixed(2)}% ${l.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'} · ${l.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'}`} />
                <Cell k="Adv. interest" v={amount(l.advance_interest)} />
                <Cell k="Gross / net wt" v={`${weight(tot.g)} / ${weight(tot.net)} g`} /><Cell k="Item value" v={amount(tot.v || l.market_value)} /><Cell k="Settle before" v={date(l.due_date)} />
                <Cell k="Part payments" v={parts.length ? `${parts.length} · ${amount(parts.reduce((acc, t) => acc - n(t.principal_amount), 0))}` : 'None'} />
                <Cell k="At bank" v={l.bank_pledge_id ? 'Yes' : 'No'} tone={l.bank_pledge_id ? 'text-violet-700' : undefined} />
              </div>
            </Box>
            <Box title="Release">
              {rel ? (
                <div className="grid grid-cols-3">
                  <Cell k="Status" v={st[0]} /><Cell k="Release date" v={date(rel.txn_date)} /><Cell k="Release no" v={l.release_no} />
                  <Cell k="Principal" v={amount(Math.abs(n(rel.principal_amount)))} /><Cell k="Interest" v={amount(n(rel.interest_amount) + n(rel.penal_amount))} /><Cell k="Total received" v={amount(rel.total_amount)} tone="text-emerald-700" />
                </div>
              ) : <p className="grid flex-1 place-items-center p-3 text-[12px] text-ink-400">Not released yet</p>}
            </Box>
          </div>
        </div>
      )}
    </Drawer>
  );
}
