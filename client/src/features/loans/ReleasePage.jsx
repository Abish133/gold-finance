import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input, Badge } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, money, n, round2, today, weight } from '@/lib/format';
import { whatsappAfterSave } from '@/lib/whatsapp';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, PaymentsGrid, useLoan, useApproval, PayDrawer, LoanHead, ItemsSummary, Chip, loanCustomer, fineRate } from './desk';
import { LoanDetailsDrawer } from './LoanDetailsDrawer';

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
  const { data: lk } = useLookups();
  const others = useFetch(full?.loan ? '/loans' : null, { customer_id: full?.loan?.customer_id, status: 'OPEN', pageSize: 50 });
  const { printTxn, printerUi } = usePrinter();
  const approval = useApproval();
  const [v, setV] = useState({ ticket_charge: '', post_charge: '', discount: '', remarks: '', unable: false });
  const [other, setOther] = useState({ enabled: false });
  const [pay, setPay] = useState(false);
  const [details, setDetails] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);

  const l = full?.loan;
  const c = full?.calc;
  // desktop: actual days from the loan date (01/01/2025 to 11/11/2026 = 679)
  const days = l ? dayjs(d).diff(dayjs(l.loan_date), 'day') : 0;
  const postage = full?.notices?.reduce((s, x) => s + n(x.postage), 0) || 0;
  useEffect(() => { setV({ ticket_charge: '', post_charge: postage ? String(postage) : '', discount: '', remarks: '', unable: false }); setPay(false); setOther({ enabled: false }); }, [loanId, postage]);

  const paidInterest = c ? round2(c.interestPaid - n(l.advance_interest)) : 0;
  const partPaid = full ? round2(full.transactions.filter((t) => !t.is_void && t.txn_type === 'PART_PAYMENT').reduce((s, t) => s - n(t.principal_amount), 0)) : 0;
  const total = c ? round2(c.principalOutstanding + c.interestDue + c.penalDue + n(v.ticket_charge) + n(v.post_charge) - n(v.discount)) : 0;
  const limit = n(settings?.DISCOUNT_APPROVAL_LIMIT);
  const open = l?.status === 'OPEN';
  const rateOf = (code) => lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === code)?.id);
  const goldR = rateOf('GOLD');
  const silverR = rateOf('SILVER');
  const otherOpen = (others.data || []).filter((x) => x.id !== l?.id);

  const start = () => { if (!open) return; if (total > 0 && !v.unable) setPay(true); else release([]); };
  const release = async (payments) => {
    if (!open) return;
    setSaving(true);
    try {
      const r = await approval.run((ap) => api.post(`/loans/${l.id}/release`, {
        date: d, ticket_charge: v.ticket_charge, post_charge: v.post_charge, discount: v.discount, remarks: v.remarks, unable_to_release: v.unable,
        released_by_other: other.enabled ? other : null, payments, approval: ap,
      }));
      setPay(false);
      toast.success(`Released · Release no ${r.data.loan.loan.release_no}`);
      ['/loans', '/dashboard', '/dashboard/status', '/loans/next-number'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      refresh();
      const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1);
      if (last && settings?.PRINT_AFTER_RELEASE !== '0') printTxn(r.data.loan, last);
      whatsappAfterSave(settings, 'RELEASE', r.data.loan, last);
    } catch (e) { if (e.message !== 'Approval cancelled') toast.error(e.message); } finally { setSaving(false); }
  };
  const clear = () => setSp({});
  useKeys({ f2: start, f5: () => l && setLedger(true), f7: () => l && setDetails(true), 'ctrl+n': clear, f3: () => document.querySelector('[data-finder]')?.focus(), escape: () => navigate('/') }, [l, total, v, other, d]);

  return (
    <>
      <DeskScreen
        title="Loan Release" subtitle="Settle a loan and give the items back"
        tiles={[{ label: 'Release no', value: String(l?.release_no || next.data?.release_no || '').padStart(5, '0') }, { label: 'Release date', value: dayjs(d).format('DD/MM/YYYY') }, { label: 'Gold · Silver', value: `${goldR ? amount(fineRate(goldR)) : '-'} · ${silverR ? amount(fineRate(silverR)) : '-'}`, gold: true }]}
        left={<>
          <LoanFinder onLoad={(id) => setSp({ loan: id })} loading={isLoading} defaultBy={settings?.RELEASE_BY_BILL_BOOK === '1' ? 'bill' : 'loan'} />
          <Panel title="Customer · F5 ledger">
            <CustomerCard customer={loanCustomer(l)} onLedger={l ? () => setLedger(true) : null} rows={[['Other open loans', otherOpen.length ? otherOpen.map((x) => `#${x.bill_no}`).join(', ') : 'none']]} />
          </Panel>
          <ItemPhotoPanel value={l?.item_photo} readOnly onChange={() => {}} />
        </>}
        center={<>
          <Panel title="Loan" bodyClassName="flex flex-col p-0" className="[&>header]:hidden">
            <LoanHead loan={l} chips={<>{l?.bank_pledge_id ? <Chip tone="violet">At bank</Chip> : <Chip tone="green">In hand</Chip>}<Chip tone="gold">{c ? `${Math.max(1, c.monthsDue)} month${c.monthsDue > 1 ? 's' : ''}` : ''}</Chip>{!open && <Chip tone="red">{l?.status}</Chip>}</>}
              cells={[['Loan date', l && date(l.loan_date)], ['Loan amount', l && money(l.principal)], [`Interest · ${l ? (l.interest_type === 'COMPOUND' ? 'Compound' : 'Flat') : ''}`, l && `${n(l.interest_rate)}% ${l.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'}`],
                ['Running', l && (() => { const m = dayjs(d).diff(dayjs(l.loan_date), 'month'); return `${m} m ${dayjs(d).diff(dayjs(l.loan_date).add(m, 'month'), 'day')} d`; })()]]} />
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Metal</th><th className="px-3 py-2 text-right">Pcs</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">Net wt</th><th className="px-3 py-2 text-right">Purity</th><th className="px-3 py-2 text-right">Value today</th></tr></thead>
                <tbody className="divide-y divide-ink-200">
                  {(full?.items || []).map((i, k) => (
                    <tr key={i.id}><td className="px-3 py-1.5">{k + 1}</td><td className="px-3 font-semibold uppercase">{i.item_name}</td><td className="px-3"><Chip tone="gold">{i.metal_code || l.loan_on}</Chip></td><td className="num px-3 text-right">{i.pcs}</td>
                      <td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity).toFixed(2)}</td><td className="num px-3 text-right">{amount(i.value)}</td></tr>
                  ))}
                  {!full && <tr><td colSpan={8} className="py-16 text-center text-ink-400">Enter a loan number to load</td></tr>}
                </tbody>
              </table>
            </div>
            <ItemsSummary items={full?.items} />
          </Panel>
          <Panel title={`Payments already received${full ? ` · ${(full.transactions || []).filter((t) => !t.is_void && t.txn_type !== 'DISBURSE').length + (n(l?.advance_interest) ? 1 : 0)}` : ''}`} bodyClassName="p-0"><PaymentsGrid transactions={full?.transactions} loan={l} /></Panel>
          {l && !open && <div className="rounded-md bg-cream-200 p-3 text-sm">This loan is <b>{l.status.toLowerCase()}</b>{l.close_date ? ` on ${date(l.close_date)}` : ''}{l.release_no ? ` · Release no ${l.release_no}` : ''}.</div>}
        </>}
        right={(
          <Panel title={`Settlement${c ? ` · as on ${dayjs(d).format('DD/MM/YYYY')}` : ''}`}>
            <div className="space-y-1">
              {settings?.ALLOW_BACKDATE_BILLING === '1' && <Field label="Release date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>}
              <Line label="Loan amount" value={c ? amount(round2(c.principalOutstanding + partPaid)) : '-'} />
              <Line label={`Interest${c ? ` · ${c.monthsDue} month${c.monthsDue > 1 ? 's' : ''}` : ''}`} value={c ? amount(c.totalInterest) : '-'} />
              {/* desktop: info only - day-wise interest at the System Control default rate (% p.m.) for the actual days */}
              {settings?.RELEASE_SHOW_DAYS_INTEREST !== '0' && <Line label={`Days interest (${days} days) · info`} value={c ? amount(Math.round((c.principalOutstanding + partPaid) * (n(settings?.DEFAULT_INTEREST_RATE) || 1) / 100 / 30 * days)) : '-'} tone="text-ink-500" />}
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
              <BigTotal label="Total to receive" value={total} />
              <GoldButton disabled={!open || saving} loading={saving && !pay} onClick={start}>Release Loan (F2)</GoldButton>
              {l?.bank_pledge_id && <Badge tone="violet">Jewels are in bank - release from bank first</Badge>}
            </div>
          </Panel>
        )}
        footerLeft={<>
          <Button variant="outline" icon={Plus} onClick={clear}>New / Clear (Ctrl+N)</Button>
          <Button variant="outline" icon={FileText} disabled={!l} onClick={() => setDetails(true)}>Loan Details (F7)</Button>
          {l && !open && full.transactions.filter((t) => t.txn_type === 'RELEASE' && !t.is_void).map((t) => <Button key={t.id} variant="outline" icon={Printer} onClick={() => printTxn(full, t)}>Reprint release</Button>)}
        </>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F2', 'Release'], ['F3', 'Bill book no'], ['F5', 'Customer ledger'], ['F7', 'Loan details'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      <LoanDetailsDrawer full={details ? full : null} onClose={() => setDetails(false)} />
      {/* desktop: Receive Payment · Loan 6 / Book 103, with Released by (F6) customer / other person */}
      <PayDrawer open={pay} onClose={() => setPay(false)} direction="receive" total={total} loading={saving} onConfirm={release}
        confirmLabel="Confirm Release (F2)" saveWord="release" onF6={() => setOther((o) => ({ ...o, enabled: !o.enabled }))}
        title={`Receive Payment · Loan ${l?.bill_no || ''}${l?.manual_bill_no ? ` / Book ${l.manual_bill_no}` : ''}`}
        subtitle={l && `${l.customer_title ? `${l.customer_title} ` : ''}${l.customer_name} · release on ${dayjs(d).format('DD/MM/YYYY')}`}>
        <div>
          <p className="label">Released by (F6)</p>
          <div className="flex gap-2">
            {[[false, 'Customer (self)'], [true, 'Other person']].map(([k, t]) => (
              <button key={t} type="button" onClick={() => setOther({ ...other, enabled: k })} className={`rounded-md border px-6 py-1.5 text-sm font-bold ${other.enabled === k ? 'border-ink-300 bg-ink-100 text-navy-900' : 'border-ink-300 bg-white text-ink-600'}`}>{t}</button>
            ))}
          </div>
          {other.enabled && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Input placeholder="Name" value={other.name || ''} onChange={(e) => setOther({ ...other, name: e.target.value })} />
              <Input placeholder="Mobile" value={other.phone || ''} onChange={(e) => setOther({ ...other, phone: e.target.value })} />
              <Input placeholder="Relation / ID proof" value={other.id_proof || ''} onChange={(e) => setOther({ ...other, id_proof: e.target.value })} />
            </div>
          )}
        </div>
      </PayDrawer>
      {approval.ui}
      {printerUi}
    </>
  );
}
