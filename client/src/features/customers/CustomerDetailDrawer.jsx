import { useState } from 'react';
import { useNavigate } from 'react-router';
import { bookStatus } from '@/lib/loanStatus';
import { User, Pencil, FilePlus2, Phone, MessageCircle, Printer } from 'lucide-react';
import clsx from 'clsx';
import { Button, DataTable, Drawer, Spinner, StatusBadge, Tabs } from '@/components/ui';
import { ImagePreview } from '@/components/common/ImagePreview';
import { DocumentsPanel } from '@/components/common/DocumentsPanel';
import { DetailsSheet } from '@/features/print/LoanEstimate';
import { printElement } from '@/lib/print';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { money, grams, date, compact, weight } from '@/lib/format';

/** Customer 360: profile, KPIs, every loan with status. */
export function CustomerDetailDrawer({ id, onClose, onEdit }) {
  const { data, isLoading } = useFetch(id ? `/customers/${id}/summary` : null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: company } = useCompany();
  const [tab, setTab] = useState('loans');
  const c = data?.customer;
  const t = data?.totals;
  // desktop: customer since = first loan (old loans included)
  const since = (data?.loans || []).reduce((m, l) => (!m || l.loan_date < m ? l.loan_date : m), null) || c?.created_at;
  const address = c && [[c.door_no, c.street, c.area, c.city].filter(Boolean).join(', '), c.pincode].filter(Boolean).join(' - ');
  const printDetails = () => printElement(<DetailsSheet company={company} title="Customer Details" photo={c.photo} groups={[
    ['Personal', [['Customer no', c.customer_no], ['Name', `${c.title || ''} ${c.name}`], ['Relation', c.relation_name && `${c.relation_type || ''} ${c.relation_name}`], ['Date of birth', c.dob && date(c.dob)], ['Gender', c.gender], ['Occupation', c.occupation]]],
    ['Contact', [['Mobile', c.phone], ['Alternate', c.alt_phone], ['Email', c.email], ['Address', address]]],
    ['KYC', [['ID proof', c.id_proof_type && `${c.id_proof_type}: ${c.id_proof_no || ''}`], ['Nominee', c.nominee_name && `${c.nominee_name} (${c.nominee_relation || ''})`], ['Status', c.status], ['Branch', c.branch_name], ['Customer since', date(since)]]],
    ['Summary', [['Open loans', String(t.open_loans || 0)], ['Outstanding', money(t.outstanding)], ['Gold held', grams(t.gold_in_custody)], ['Total lent', money(t.total_lent)], ['Interest paid', money(t.interest_paid)]]],
  ]} tables={[{ title: 'Loans', rows: data.loans, columns: [['bill_no', 'Loan'], ['loan_date', 'Date', (r) => date(r.loan_date)], ['item_summary', 'Items'], ['net_wt', 'Net', (r) => weight(r.net_wt)], ['principal', 'Loan', (r) => money(r.principal)], ['current_principal', 'Balance', (r) => money(r.current_principal)], ['status', 'Status', (r) => bookStatus(r)]] }]} />, { title: 'Customer details' });

  return (
    <Drawer open={!!id} onClose={onClose} size="xl" icon={User} title={c ? c.name : 'Customer'} subtitle={c ? `Customer #${c.customer_no} · ${c.branch_name}` : ''}
      bodyClassName="flex !px-4 !py-3 sm:!overflow-hidden"
      footer={c && (
        <>
          <Button variant="outline" icon={Printer} onClick={printDetails}>Print details</Button>
          <a href={`tel:${c.phone}`}><Button variant="outline" icon={Phone}>Call</Button></a>
          <a href={`https://wa.me/91${String(c.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer"><Button variant="outline" icon={MessageCircle}>WhatsApp</Button></a>
          {can('customers', 'edit') && <Button variant="outline" icon={Pencil} onClick={() => onEdit(c)}>Edit</Button>}
          {can('loan_new', 'add') && c.status === 'ACTIVE' && <Button variant="gold" icon={FilePlus2} onClick={() => navigate(`/loans/new?customer=${c.id}`)}>New loan</Button>}
        </>
      )}>
      {isLoading || !c ? <Spinner /> : (
        <div className="flex min-h-0 w-full flex-col gap-2.5">
          {/* profile */}
          <div className="flex shrink-0 items-stretch gap-3">
            <ImagePreview src={c.photo} title={`${c.name} · #${c.customer_no}`} className="w-24 shrink-0 self-stretch rounded-md border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
              {c.photo ? <img src={c.photo} alt="" className="size-full object-cover" /> : <span className="grid size-full min-h-24 place-items-center text-2xl font-bold text-ink-400">{(c.name || '?').charAt(0)}</span>}
            </ImagePreview>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">{c.title} {c.name}</h3>
                <StatusBadge status={c.status} />
                {c.relation_name && <span className="text-[12px] text-ink-500">{c.relation_type} {c.relation_name}</span>}
              </div>
              {c.status === 'BLOCKED' && <p className="mt-1 rounded-md border-l-2 border-rose-600 bg-rose-50 px-2 py-1 text-[12px] text-rose-700">Blocked: {c.block_reason}</p>}
              <div className="mt-1.5 grid overflow-hidden rounded-md border border-ink-200 text-[12px] sm:grid-cols-3 dark:border-ink-800">
                {[['Mobile', c.phone], ['Alternate', c.alt_phone], ['ID proof', c.id_proof_type ? `${c.id_proof_type}: ${c.id_proof_no || ''}` : null],
                  ['Address', address], ['Nominee', c.nominee_name ? `${c.nominee_name} (${c.nominee_relation || ''})` : null], ['Customer since', date(since)]].map(([k, v]) => (
                  <div key={k} className="min-w-0 border-r border-b border-ink-100 px-2.5 py-1 dark:border-ink-800">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-400 uppercase">{k}</p>
                    <p className="truncate font-semibold text-navy-900 dark:text-white" title={v || ''}>{v || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* figures */}
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 sm:grid-cols-4 dark:border-ink-800">
            {[['Open loans', t.open_loans || 0, 'bg-navy-900 dark:bg-white'], ['Outstanding', compact(t.outstanding), 'bg-blue-600'], ['Gold held', grams(t.gold_in_custody), 'bg-amber-500'], ['Interest paid', compact(t.interest_paid), 'bg-emerald-600']].map(([l, v, bar]) => (
              <div key={l} className="relative border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
                <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
                <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
                <p className="num text-lg leading-tight font-bold text-navy-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>

          <Tabs value={tab} onChange={setTab} className="shrink-0" tabs={[{ value: 'loans', label: 'Loans', count: data.loans.length }, { value: 'docs', label: 'Documents' }]} />
          {tab === 'docs' ? <div className="min-h-0 flex-1 overflow-y-auto"><DocumentsPanel owner="customer" id={c.id} canEdit={can('customers', 'edit')} /></div> : (
            /* loans - fills the drawer, rows scroll */
            <DataTable
              fill
              columns={[
                { key: 'bill_no', label: 'Loan no', render: (r) => <span className="font-semibold">#{r.bill_no}</span> },
                { key: 'loan_date', label: 'Date', type: 'date' },
                { key: 'item_summary', label: 'Items', render: (r) => <span className="block max-w-56 truncate uppercase" title={r.items_text || r.item_summary}>{r.items_text || r.item_summary}</span> },
                { key: 'net_wt', label: 'Net wt', type: 'weight' },
                { key: 'principal', label: 'Loan', type: 'money' },
                { key: 'current_principal', label: 'Balance', type: 'money' },
                { key: 'status', label: 'Status', render: (r) => <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase dark:bg-ink-800">{bookStatus(r)}</span> },
              ]}
              rows={data.loans}
              onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)}
            />
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {[['ID front', c.doc_front], ['ID back', c.doc_back], ['Signature', c.signature]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <ImagePreview src={v} title={`${k} · ${c.name}`} className="h-9 w-14 rounded-sm border border-ink-200 dark:border-ink-700"><img src={v} alt={k} className="size-full object-cover" /></ImagePreview>
                <span className="text-[11px] text-ink-500">{k}</span>
              </div>
            ))}
            <p className="ml-auto text-[11px] text-ink-400">Total lent so far {money(t.total_lent)} across {t.total_loans} loans · click a loan to open it</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
