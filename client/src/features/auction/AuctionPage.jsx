import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Gavel, Send, Printer, Hammer } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Checkbox, DataTable, Drawer, Field, Input, KeyValue, PageHeader, Select, Tabs, Textarea, Badge } from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { NoticeLetters } from '@/features/print/NoticeLetter';
import { money, today, date, monthStart } from '@/lib/format';

export default function AuctionPage() {
  const { can, isAllBranches } = useAuth();
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [tab, setTab] = useState('list');
  const [days, setDays] = useState('');
  const list = useFetch(tab === 'list' ? '/auction/list' : null, { days });
  const notices = useFetch(tab === 'notices' ? '/auction/notices' : null, { from: monthStart(), to: today() });
  const sales = useFetch(tab === 'sales' ? '/auction/sales' : null);
  const [sel, setSel] = useState([]);
  const [notice, setNotice] = useState(null);
  const [sale, setSale] = useState(null);

  const rows = list.data || [];
  const chosen = rows.filter((r) => sel.includes(r.id));

  const sendNotice = useMutation({
    mutationFn: () => api.post('/auction/notices', { ...notice, loan_ids: sel }),
    onSuccess: (r) => {
      toast.success(`${r.data.count} notices recorded`);
      if (notice.print) printElement(<NoticeLetters loans={chosen} company={company || {}} type={notice.notice_type} auctionDate={notice.auction_date} />, { title: 'Notices' });
      qc.invalidateQueries({ queryKey: ['/auction/list'] }); setNotice(null); setSel([]);
    },
    onError: (e) => toast.error(e.message),
  });
  const doSale = useMutation({
    mutationFn: () => api.post('/auction/sales', sale),
    onSuccess: (r) => { toast.success(`Auction recorded. Surplus ${money(r.data.surplus)}`); qc.invalidateQueries({ queryKey: ['/auction'] }); setSale(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="animate-rise">
      <PageHeader icon={Gavel} title="Auction & Notices" subtitle="Overdue loans, notice tracking and auction settlement" actions={tab === 'list' && (
        <>
          <Button variant="outline" icon={Printer} disabled={!sel.length} onClick={() => printElement(<NoticeLetters loans={chosen} company={company || {}} />, { title: 'Notices' })}>Print notices</Button>
          {can('auction', 'add') && !isAllBranches && <Button variant="gold" icon={Send} disabled={!sel.length} onClick={() => setNotice({ notice_type: 'FIRST', sent_via: 'REGISTERED', notice_date: today(), print: true })}>Record notice ({sel.length})</Button>}
        </>
      )} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'list', label: 'Overdue list', count: rows.length || undefined }, { value: 'notices', label: 'Notices sent' }, can('auction_sale') && { value: 'sales', label: 'Auction sales' }].filter(Boolean)} />
      {tab === 'list' && (
        <>
          <div className="mb-3 flex items-end gap-3"><Field label="Min. overdue days (blank = setting)"><Input type="number" className="w-48" value={days} onChange={(e) => setDays(e.target.value)} /></Field></div>
          <DataTable dense selectable selected={sel} onSelect={setSel} rows={rows} loading={list.isLoading} columns={[
            { key: 'bill_no', label: 'Loan', render: (r) => <span className="font-semibold">#{r.bill_no}</span> },
            { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'due_date', label: 'Due', type: 'date' },
            { key: 'overdue_days', label: 'Overdue', render: (r) => <Badge tone="red">{r.overdue_days} d</Badge> },
            { key: 'customer_name', label: 'Customer', render: (r) => <div><p className="font-semibold">{r.customer_name}</p><p className="text-xs text-ink-500">{r.customer_phone}</p></div> },
            { key: 'net_wt', label: 'Net wt', type: 'weight' }, { key: 'current_principal', label: 'Principal', type: 'money' },
            { key: 'interest_due', label: 'Interest', type: 'money' }, { key: 'total_due', label: 'Total due', type: 'money' },
            { key: 'notices', label: 'Notices', render: (r) => (r.notices ? <Badge tone="gold">{r.notices} · {date(r.last_notice)}</Badge> : '—') },
            { key: 'x', label: '', align: 'right', render: (r) => can('auction_sale', 'add') && <Button size="sm" variant="outline" icon={Hammer} onClick={(e) => { e.stopPropagation(); setSale({ loan_id: r.id, loan: r, auction_date: today(), sale_amount: '', payments: [] }); }}>Auction</Button> },
          ]} />
        </>
      )}
      {tab === 'notices' && <DataTable dense rows={notices.data || []} loading={notices.isLoading} columns={[
        { key: 'notice_date', label: 'Date', type: 'date' }, { key: 'bill_no', label: 'Loan' }, { key: 'customer_name', label: 'Customer' }, { key: 'notice_type', label: 'Type' },
        { key: 'sent_via', label: 'Via' }, { key: 'reference', label: 'Ref' }, { key: 'postage', label: 'Postage', type: 'money' },
      ]} />}
      {tab === 'sales' && <DataTable dense rows={sales.data || []} loading={sales.isLoading} columns={[
        { key: 'auction_date', label: 'Date', type: 'date' }, { key: 'bill_no', label: 'Loan' }, { key: 'customer_name', label: 'Customer' }, { key: 'buyer_name', label: 'Buyer' },
        { key: 'net_wt', label: 'Wt', type: 'weight' }, { key: 'principal_due', label: 'Principal', type: 'money' }, { key: 'interest_due', label: 'Interest', type: 'money' },
        { key: 'sale_amount', label: 'Sold for', type: 'money' }, { key: 'surplus', label: 'Surplus / (loss)', type: 'money' },
      ]} />}

      <Drawer open={!!notice} onClose={() => setNotice(null)} title={`Record notice for ${sel.length} loans`} icon={Send} size="sm"
        footer={<Button variant="gold" loading={sendNotice.isPending} onClick={() => sendNotice.mutate()}>Save</Button>}>
        {notice && (
          <div className="space-y-4">
            <Field label="Notice type"><Select value={notice.notice_type} onChange={(e) => setNotice({ ...notice, notice_type: e.target.value })} options={['REMINDER', 'FIRST', 'SECOND', 'FINAL', 'AUCTION']} /></Field>
            <Field label="Sent via"><Select value={notice.sent_via} onChange={(e) => setNotice({ ...notice, sent_via: e.target.value })} options={['REGISTERED', 'POST', 'SMS', 'WHATSAPP', 'HAND', 'EMAIL']} /></Field>
            <Field label="Date"><Input type="date" value={notice.notice_date} onChange={(e) => setNotice({ ...notice, notice_date: e.target.value })} /></Field>
            <Field label="Postage per notice" hint="Collected at release"><Input type="number" value={notice.postage ?? ''} onChange={(e) => setNotice({ ...notice, postage: e.target.value })} /></Field>
            <Field label="Auction date (printed on letter)"><Input type="date" value={notice.auction_date || ''} onChange={(e) => setNotice({ ...notice, auction_date: e.target.value })} /></Field>
            <Field label="Reference / RLAD no"><Input value={notice.reference || ''} onChange={(e) => setNotice({ ...notice, reference: e.target.value })} /></Field>
            <Checkbox checked={notice.sms} onChange={(v) => setNotice({ ...notice, sms: v })} label="Also send SMS reminder" />
            <Checkbox checked={notice.print} onChange={(v) => setNotice({ ...notice, print: v })} label="Print notice letters" />
          </div>
        )}
      </Drawer>

      <Drawer open={!!sale} onClose={() => setSale(null)} title={`Auction loan #${sale?.loan?.bill_no}`} icon={Hammer} size="md"
        footer={<Button variant="danger" loading={doSale.isPending} onClick={() => doSale.mutate()}>Confirm auction</Button>}>
        {sale && (
          <div className="space-y-4">
            <KeyValue items={[['Customer', sale.loan.customer_name], ['Net wt', `${sale.loan.net_wt} g`], ['Principal', money(sale.loan.current_principal)], ['Total due', money(sale.loan.total_due)]]} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Auction date"><Input type="date" value={sale.auction_date} onChange={(e) => setSale({ ...sale, auction_date: e.target.value })} /></Field>
              <Field label="Sale amount" required><Input type="number" value={sale.sale_amount} onChange={(e) => setSale({ ...sale, sale_amount: e.target.value })} /></Field>
              <Field label="Buyer"><Input value={sale.buyer_name || ''} onChange={(e) => setSale({ ...sale, buyer_name: e.target.value })} /></Field>
              <Field label="Approved by"><Input value={sale.approved_by || ''} onChange={(e) => setSale({ ...sale, approved_by: e.target.value })} /></Field>
              <Field label="Extra charges"><Input type="number" value={sale.charges || ''} onChange={(e) => setSale({ ...sale, charges: e.target.value })} /></Field>
            </div>
            <Field label="Remarks"><Textarea value={sale.remarks || ''} onChange={(e) => setSale({ ...sale, remarks: e.target.value })} /></Field>
            <PaymentSplit total={Number(sale.sale_amount) || 0} value={sale.payments} onChange={(p) => setSale((s) => ({ ...s, payments: p }))} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
