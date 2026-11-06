import { FileText } from 'lucide-react';
import clsx from 'clsx';
import { Button, Drawer } from '@/components/ui';
import { PhotoBox } from '@/components/common/PhotoBox';
import { amount, date, n, weight } from '@/lib/format';

const STATUS = { OPEN: ['Pending', 'bg-blue-600'], CLOSED: ['Released', 'bg-emerald-600'], RENEWED: ['Re-loaned', 'bg-sky-600'], AUCTIONED: ['Auctioned', 'bg-rose-600'], CANCELLED: ['Cancelled', 'bg-ink-500'] };
const Row = ({ k, v }) => <div className="flex justify-between gap-4 py-0.5 text-sm"><span className="text-ink-600">{k}</span><b className="num text-right">{v ?? '-'}</b></div>;

/** Loan Details (desktop F7): customer, item photo, pledged items, loan and release summary. */
export function LoanDetailsDrawer({ full, onClose }) {
  const l = full?.loan;
  const items = full?.items || [];
  const txns = (full?.transactions || []).filter((t) => !t.is_void);
  const parts = txns.filter((t) => t.txn_type === 'PART_PAYMENT');
  const rel = txns.find((t) => ['RELEASE', 'RENEWAL', 'AUCTION'].includes(t.txn_type));
  const st = STATUS[l?.status] || [l?.status, 'bg-ink-500'];
  const tot = items.reduce((s, i) => ({ g: s.g + n(i.gross_wt), net: s.net + n(i.net_wt), v: s.v + n(i.value) }), { g: 0, net: 0, v: 0 });
  return (
    <Drawer open={!!l} onClose={onClose} size="xl" icon={FileText} title={l ? `Loan Details - Loan No ${l.bill_no}` : ''}
      subtitle={l && [l.manual_bill_no && `Bill Book No ${l.manual_bill_no}`, `Pledged on ${date(l.loan_date)}`, l.loan_on].filter(Boolean).join(' · ')}
      footer={<><span className={clsx('rounded px-5 py-1.5 text-sm font-bold text-white uppercase', st[1])}>{st[0]}</span><span className="flex-1" /><Button variant="outline" onClick={onClose}>Close (Esc)</Button></>}>
      {l && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-ink-200 p-3 dark:border-ink-700">
              <p className="mb-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Customer</p>
              <div className="flex gap-4">
                <PhotoBox src={l.customer_photo || l.customer_photo_master} className="h-40 w-32" />
                <div className="flex-1">
                  <Row k="Customer A/c" v={l.customer_no} /><Row k="Name" v={`${l.customer_title || ''} ${l.customer_name}`} />
                  <Row k="Relation" v={l.relation_name && `${l.relation_type || ''} ${l.relation_name}`} />
                  <Row k="Address" v={[l.door_no, l.street, l.area, l.city].filter(Boolean).join(', ')} />
                  <Row k="Phone" v={l.customer_phone} /><Row k="ID Proof" v={l.id_proof_type} />
                </div>
              </div>
            </section>
            <section className="rounded-md border border-ink-200 p-3 dark:border-ink-700">
              <p className="mb-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Item photo</p>
              <a href={l.item_photo || undefined} target="_blank" rel="noreferrer" className="grid h-40 place-items-center overflow-hidden rounded bg-ink-50 dark:bg-ink-800">
                {l.item_photo ? <img src={l.item_photo} alt="" className="size-full object-contain" /> : <span className="text-sm text-ink-400">No item photo saved for this loan</span>}
              </a>
            </section>
          </div>
          <section className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-700">
            <p className="px-3 py-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Pledged items ({items.length})</p>
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr>{['S.No', 'Item', 'Metal', 'Pcs', 'Gross Wt', 'Less Wt', 'Net Wt', 'Purity', 'Item Value'].map((h, i) => <th key={h} className={clsx('px-3 py-1.5', i > 2 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">{items.map((i, k) => (
                <tr key={i.id}><td className="px-3 py-1">{k + 1}</td><td className="px-3">{i.item_name}{i.remarks ? <span className="text-xs text-ink-500"> ({i.remarks})</span> : ''}</td><td className="px-3">{i.metal_code || l.loan_on}</td>
                  <td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.stone_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td>
                  <td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(i.value)}</td></tr>
              ))}</tbody>
            </table>
          </section>
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-md border border-ink-200 p-3 dark:border-ink-700">
              <p className="mb-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Loan</p>
              <Row k="Loan Date" v={date(l.loan_date)} /><Row k="Bill Book No" v={l.manual_bill_no} /><Row k="Loan Amount" v={amount(l.principal)} />
              <Row k="Interest" v={`${n(l.interest_rate).toFixed(2)} % ${l.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'} · ${l.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'}`} />
              <Row k="Adv. Interest" v={amount(l.advance_interest)} /><Row k="Gross / Net Wt" v={`${weight(tot.g)} / ${weight(tot.net)} g`} /><Row k="Item Value" v={amount(tot.v || l.market_value)} />
              <Row k="Settle Before" v={date(l.due_date)} /><Row k="Part Payments" v={parts.length ? `${parts.length} · ${amount(parts.reduce((s, t) => s - n(t.principal_amount), 0))}` : 'None'} />
              {l.bank_pledge_id && <Row k="Pledged at bank" v="Yes" />}
            </section>
            <section className="rounded-md border border-ink-200 p-3 dark:border-ink-700">
              <p className="mb-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Release</p>
              {rel ? (<>
                <Row k="Status" v={st[0]} /><Row k="Release Date" v={date(rel.txn_date)} /><Row k="Release No" v={l.release_no} />
                <Row k="Principal" v={amount(Math.abs(n(rel.principal_amount)))} /><Row k="Interest" v={amount(n(rel.interest_amount) + n(rel.penal_amount))} /><Row k="Total Received" v={amount(rel.total_amount)} />
              </>) : <Row k="Status" v="Not released yet" />}
            </section>
          </div>
        </div>
      )}
    </Drawer>
  );
}
