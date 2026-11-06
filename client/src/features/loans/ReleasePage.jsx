import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input, Textarea, Badge } from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, n, round2, today, weight } from '@/lib/format';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, PaymentsGrid, useLoan, useApproval } from './desk';

/** Loan Release (desktop: FrmRelease) - settle a loan and give the items back. */
export default function ReleasePage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAllBranches } = useAuth();
  const loanId = sp.get('loan');
  const [d, setD] = useState(today());
  const { full, isLoading, refresh } = useLoan(loanId, d !== today() ? d : undefined);
  const next = useFetch(isAllBranches ? null : '/loans/next-number');
  const { data: settings } = useFetch('/admin/settings');
  const { printTxn, printerUi } = usePrinter();
  const approval = useApproval();
  const [v, setV] = useState({ ticket_charge: '', post_charge: '', discount: '', remarks: '', unable: false });
  const [other, setOther] = useState({ enabled: false });
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);

  const l = full?.loan;
  const c = full?.calc;
  const postage = full?.notices?.reduce((s, x) => s + n(x.postage), 0) || 0;
  useEffect(() => { setV({ ticket_charge: '', post_charge: postage ? String(postage) : '', discount: '', remarks: '', unable: false }); setPayments([]); setOther({ enabled: false }); }, [loanId, postage]);

  const paidInterest = c ? round2(c.interestPaid - n(l.advance_interest)) : 0;
  const partPaid = full ? round2(full.transactions.filter((t) => !t.is_void && t.txn_type === 'PART_PAYMENT').reduce((s, t) => s - n(t.principal_amount), 0)) : 0;
  const total = c ? round2(c.principalOutstanding + c.interestDue + c.penalDue + n(v.ticket_charge) + n(v.post_charge) - n(v.discount)) : 0;
  const limit = n(settings?.DISCOUNT_APPROVAL_LIMIT);
  const open = l?.status === 'OPEN';

  const release = async () => {
    if (!open) return;
    setSaving(true);
    try {
      const r = await approval.run((ap) => api.post(`/loans/${l.id}/release`, {
        date: d, ticket_charge: v.ticket_charge, post_charge: v.post_charge, discount: v.discount, remarks: v.remarks, unable_to_release: v.unable,
        released_by_other: other.enabled ? other : null, payments, approval: ap,
      }));
      toast.success(`Released · Release no ${r.data.loan.loan.release_no}`);
      ['/loans', '/dashboard', '/dashboard/status', '/loans/next-number'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      refresh();
      const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1);
      if (last) printTxn(r.data.loan, last);
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  const clear = () => setSp({});
  useKeys({ f2: release, f5: () => l && setLedger(true), f7: () => l && navigate(`/loans/counter?loan=${l.id}`), 'ctrl+n': clear, f3: () => document.querySelector('[data-finder]')?.focus(), escape: () => navigate('/') }, [l, total, payments, v, other, d]);

  return (
    <>
      <DeskScreen
        title="Loan Release" subtitle="Settle a loan and give the items back"
        tiles={[{ label: 'Release no', value: l?.release_no || next.data?.release_no }, { label: 'Release date', value: dayjs(d).format('DD/MM/YYYY') }, { label: 'Status', value: l?.status || '-', gold: true }]}
        left={<>
          <LoanFinder onLoad={(id) => setSp({ loan: id })} loading={isLoading} />
          <Panel title="Customer · F5 ledger">
            <CustomerCard customer={l ? { ...l, name: l.customer_name, phone: l.customer_phone, photo: l.customer_photo || l.customer_photo_master, status: l.customer_status } : null} onLedger={l ? () => setLedger(true) : null} />
          </Panel>
          <ItemPhotoPanel value={l?.item_photo} readOnly onChange={() => {}} />
        </>}
        center={<>
          <Panel title={`Loan ${l ? `#${l.bill_no}${l.manual_bill_no ? ` · Bill book ${l.manual_bill_no}` : ''}` : '-'}`} bodyClassName="p-0">
            <div className="grid grid-cols-2 border-b border-ink-200 sm:grid-cols-4">
              {[['Loan date', l ? date(l.loan_date) : '-'], ['Loan amount', l ? amount(l.principal) : '-'], ['Interest', l ? `${n(l.interest_rate)}% ${l.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'} · ${l.interest_type === 'COMPOUND' ? 'Compound' : 'Simple'}` : '-'], ['Running', c ? `${c.elapsedDays} days` : '-']].map(([k, val]) => (
                <div key={k} className="border-r border-ink-200 px-4 py-2 last:border-r-0"><p className="label">{k}</p><p className="num font-bold text-navy-900">{val}</p></div>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Metal</th><th className="px-3 py-2 text-right">Pcs</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">Net wt</th><th className="px-3 py-2 text-right">Purity</th><th className="px-3 py-2 text-right">Value today</th></tr></thead>
              <tbody className="divide-y divide-ink-200">
                {(full?.items || []).map((i, k) => (
                  <tr key={i.id}><td className="px-3 py-1.5">{k + 1}</td><td className="px-3 font-semibold">{i.item_name}</td><td className="px-3">{i.metal_code || l.metal_name}</td><td className="num px-3 text-right">{i.pcs}</td>
                    <td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(i.value)}</td></tr>
                ))}
                {!full && <tr><td colSpan={8} className="py-16 text-center text-ink-400">Enter a loan number to load</td></tr>}
              </tbody>
            </table>
          </Panel>
          <Panel title="Payments already received" bodyClassName="p-0"><PaymentsGrid transactions={full?.transactions} /></Panel>
          {l && !open && <div className="rounded-md bg-cream-200 p-3 text-sm">This loan is <b>{l.status.toLowerCase()}</b>{l.close_date ? ` on ${date(l.close_date)}` : ''}{l.release_no ? ` · Release no ${l.release_no}` : ''}.</div>}
        </>}
        right={(
          <Panel title="Settlement">
            <div className="space-y-1">
              <Field label="Release date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
              <Line label="Loan amount" value={c ? amount(c.principalOutstanding) : '-'} />
              <Line label="Interest" value={c ? amount(c.totalInterest) : '-'} />
              <Line label="Days interest (info)" value={c ? `${c.chargeDays} days @ ${c.rate}%` : '-'} tone="text-ink-500" />
              {c?.penalDue > 0 && <Line label="Penal interest" value={amount(c.penalDue)} />}
              <Line minus label="Advance interest" value={l ? amount(l.advance_interest) : '-'} />
              <Line minus label="Interest already paid" value={amount(paidInterest)} />
              <Line minus label="Part amount paid" value={amount(partPaid)} />
              <div className="space-y-2 border-t border-ink-200 pt-2">
                <div className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm"><span>Against ticket charge</span><Input type="number" value={v.ticket_charge} onChange={(e) => setV({ ...v, ticket_charge: e.target.value })} /></div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm"><span>Post / other charge</span><Input type="number" value={v.post_charge} onChange={(e) => setV({ ...v, post_charge: e.target.value })} /></div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm"><span>Discount {limit ? `(admin > ₹${limit})` : ''}</span><Input type="number" value={v.discount} onChange={(e) => setV({ ...v, discount: e.target.value })} /></div>
              </div>
              <Checkbox className="pt-1" checked={v.unable} onChange={(x) => setV({ ...v, unable: x })} label="Customer unable to release (sign only)" />
              <Checkbox checked={other.enabled} onChange={(x) => setOther({ ...other, enabled: x })} label="Released to another person" />
              {other.enabled && (
                <div className="grid gap-2 rounded-md bg-ink-50 p-2">
                  <Input placeholder="Name" value={other.name || ''} onChange={(e) => setOther({ ...other, name: e.target.value })} />
                  <Input placeholder="Mobile" value={other.phone || ''} onChange={(e) => setOther({ ...other, phone: e.target.value })} />
                  <Input placeholder="Relation / ID proof" value={other.id_proof || ''} onChange={(e) => setOther({ ...other, id_proof: e.target.value })} />
                </div>
              )}
              <Field label="Remarks"><Textarea rows={2} value={v.remarks} onChange={(e) => setV({ ...v, remarks: e.target.value })} /></Field>
              {open && total > 0 && <PaymentSplit total={total} value={payments} onChange={setPayments} />}
              <BigTotal label="Total to receive" value={total} />
              <GoldButton disabled={!open || saving} loading={saving} onClick={release}>Release Loan (F2)</GoldButton>
              {l?.bank_pledge_id && <Badge tone="violet">Jewels are in bank - release from bank first</Badge>}
            </div>
          </Panel>
        )}
        footerLeft={<>
          <Button variant="outline" icon={Plus} onClick={clear}>New / Clear (Ctrl+N)</Button>
          <Button variant="outline" icon={FileText} disabled={!l} onClick={() => navigate(`/loans/counter?loan=${l.id}`)}>Loan Details (F7)</Button>
          {l && !open && full.transactions.filter((t) => t.txn_type === 'RELEASE' && !t.is_void).map((t) => <Button key={t.id} variant="outline" icon={Printer} onClick={() => printTxn(full, t)}>Reprint release</Button>)}
        </>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F2', 'Release'], ['F3', 'Bill book no'], ['F5', 'Customer ledger'], ['F7', 'Loan details'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {approval.ui}
      {printerUi}
    </>
  );
}
