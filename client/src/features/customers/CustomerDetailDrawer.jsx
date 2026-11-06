import { useState } from 'react';
import { useNavigate } from 'react-router';
import { User, Pencil, FilePlus2, Phone, MessageCircle, Printer } from 'lucide-react';
import { Avatar, Badge, Button, DataTable, Drawer, KeyValue, Spinner, Stat, StatusBadge, Tabs } from '@/components/ui';
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
  const address = c && [c.door_no, c.street, c.area, c.city, c.pincode].filter(Boolean).join(', ');
  const printDetails = () => printElement(<DetailsSheet company={company} title="Customer Details" photo={c.photo} groups={[
    ['Personal', [['Customer no', c.customer_no], ['Name', `${c.title || ''} ${c.name}`], ['Relation', c.relation_name && `${c.relation_type || ''} ${c.relation_name}`], ['Date of birth', c.dob && date(c.dob)], ['Gender', c.gender], ['Occupation', c.occupation]]],
    ['Contact', [['Mobile', c.phone], ['Alternate', c.alt_phone], ['Email', c.email], ['Address', address]]],
    ['KYC', [['ID proof', c.id_proof_type && `${c.id_proof_type}: ${c.id_proof_no || ''}`], ['Nominee', c.nominee_name && `${c.nominee_name} (${c.nominee_relation || ''})`], ['Status', c.status], ['Branch', c.branch_name], ['Customer since', date(c.created_at)]]],
    ['Summary', [['Open loans', String(t.open_loans || 0)], ['Outstanding', money(t.outstanding)], ['Gold held', grams(t.gold_in_custody)], ['Total lent', money(t.total_lent)], ['Interest paid', money(t.interest_paid)]]],
  ]} tables={[{ title: 'Loans', rows: data.loans, columns: [['bill_no', 'Loan'], ['loan_date', 'Date', (r) => date(r.loan_date)], ['item_summary', 'Items'], ['net_wt', 'Net', (r) => weight(r.net_wt)], ['principal', 'Loan', (r) => money(r.principal)], ['current_principal', 'Balance', (r) => money(r.current_principal)], ['status', 'Status']] }]} />, { title: 'Customer details' });

  return (
    <Drawer open={!!id} onClose={onClose} size="xl" icon={User} title={c ? c.name : 'Customer'} subtitle={c ? `Customer #${c.customer_no} · ${c.branch_name}` : ''}
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-start gap-5">
            <Avatar src={c.photo} name={c.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold">{c.title} {c.name}</h3>
                <StatusBadge status={c.status} />
              </div>
              {c.relation_name && <p className="text-sm text-ink-500">{c.relation_type} {c.relation_name}</p>}
              {c.status === 'BLOCKED' && <Badge tone="red" className="mt-2">Blocked: {c.block_reason}</Badge>}
              <div className="mt-4"><KeyValue cols={3} items={[
                ['Mobile', c.phone], ['Alternate', c.alt_phone], ['ID proof', c.id_proof_type ? `${c.id_proof_type}: ${c.id_proof_no || ''}` : null],
                ['Address', address], ['Nominee', c.nominee_name ? `${c.nominee_name} (${c.nominee_relation || ''})` : null], ['Customer since', date(c.created_at)],
              ]} /></div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Open loans" value={t.open_loans || 0} />
            <Stat label="Outstanding" value={compact(t.outstanding)} tone="blue" />
            <Stat label="Gold held" value={grams(t.gold_in_custody)} tone="gold" />
            <Stat label="Interest paid" value={compact(t.interest_paid)} tone="green" />
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'loans', label: 'Loans', count: data.loans.length }, { value: 'docs', label: 'Documents' }]} />
          {tab === 'docs' ? <DocumentsPanel owner="customer" id={c.id} canEdit={can('customers', 'edit')} /> : <DataTable
            dense
            columns={[
              { key: 'bill_no', label: 'Loan no', render: (r) => <span className="font-semibold">#{r.bill_no}</span> },
              { key: 'loan_date', label: 'Date', type: 'date' },
              { key: 'item_summary', label: 'Items' },
              { key: 'net_wt', label: 'Net wt', type: 'weight' },
              { key: 'principal', label: 'Loan', type: 'money' },
              { key: 'current_principal', label: 'Balance', type: 'money' },
              { key: 'status', label: 'Status', type: 'status' },
            ]}
            rows={data.loans}
            onRowClick={(r) => navigate(`/loans/counter?loan=${r.id}`)}
          />}
          {[c.doc_front, c.doc_back, c.signature].some(Boolean) && (
            <div className="grid grid-cols-3 gap-3">
              {[['ID front', c.doc_front], ['ID back', c.doc_back], ['Signature', c.signature]].filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="block">
                  <p className="label">{k}</p><img src={v} alt={k} className="aspect-[16/10] w-full rounded-xl object-cover" />
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-ink-400">Total lent so far {money(t.total_lent)} across {t.total_loans} loans.</p>
        </div>
      )}
    </Drawer>
  );
}
