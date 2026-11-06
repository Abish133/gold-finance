import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { PaymentSplit } from '@/components/common/PaymentSplit';
import { useFetch } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, n, round2, today, weight } from '@/lib/format';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, LtvBar, useLoan } from './desk';

/** Top-up Loan (desktop: frmTopUp) - extra amount on the same loan number within allowed days. */
export default function TopUpPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { full, isLoading, refresh } = useLoan(sp.get('loan'));
  const { data: settings } = useFetch('/admin/settings');
  const { printTxn, printerUi } = usePrinter();
  const [amt, setAmt] = useState('');
  const [deduct, setDeduct] = useState('');
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);
  const l = full?.loan;
  const c = full?.calc;
  useEffect(() => { setAmt(''); setDeduct(''); setPayments([]); }, [l?.id]);
  const within = n(settings?.TOPUP_WITHIN_DAYS);
  const topups = (full?.transactions || []).filter((t) => t.txn_type === 'TOPUP' && !t.is_void);
  const newTotal = c ? round2(c.principalOutstanding + n(amt)) : 0;
  const rate = l ? (l.rate_type === 'MONTHLY' ? n(l.interest_rate) / 100 : n(l.interest_rate) / 1200) : 0;
  const pay = round2(n(amt) - n(deduct));
  const tooLate = l && within > 0 && dayjs().diff(dayjs(l.loan_date), 'day') > within;

  const give = async () => {
    if (!l || n(amt) <= 0) return toast.error('Enter top-up amount');
    setSaving(true);
    try {
      const r = await api.post(`/loans/${l.id}/topup`, { date: today(), amount: n(amt), interest_amount: n(deduct), payments });
      toast.success('Top-up given'); qc.invalidateQueries({ queryKey: ['/loans'] }); refresh();
      const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); if (last) printTxn(r.data.loan, last);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: give, f5: () => l && setLedger(true), 'ctrl+n': () => setSp({}), escape: () => navigate('/') }, [l, amt, deduct, payments]);

  return (
    <>
      <DeskScreen title="Top-up Loan" subtitle="Give an extra amount on the same loan number, within the allowed days"
        tiles={[{ label: 'Top-up within', value: within ? `${within} days` : 'Any time' }, { label: 'Top-up date', value: dayjs().format('DD/MM/YYYY') }, { label: 'Loan', value: l ? `#${l.bill_no}` : '-', gold: true }]}
        left={<>
          <LoanFinder onLoad={(id) => setSp({ loan: id })} loading={isLoading} />
          <Panel title="Customer · F5 ledger"><CustomerCard customer={l ? { ...l, name: l.customer_name, phone: l.customer_phone, photo: l.customer_photo || l.customer_photo_master } : null} onLedger={l ? () => setLedger(true) : null} /></Panel>
          <ItemPhotoPanel value={l?.item_photo} readOnly onChange={() => {}} />
        </>}
        center={<>
          <Panel title="Loan" bodyClassName="p-0">
            <div className="grid grid-cols-4 border-b border-ink-200">
              {[['Loan date', l ? date(l.loan_date) : '-'], ['First amount', l ? amount(l.principal) : '-'], ['Interest', l ? `${n(l.interest_rate)}%` : '-'], ['Running', c ? `${c.elapsedDays} days` : '-']].map(([k, v]) => (
                <div key={k} className="border-r border-ink-200 px-4 py-2 last:border-0"><p className="label">{k}</p><p className="num font-bold">{v}</p></div>))}
            </div>
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 text-right">Pcs</th><th className="px-3 text-right">Gross</th><th className="px-3 text-right">Net wt</th><th className="px-3 text-right">Purity</th><th className="px-3 text-right">Value today</th></tr></thead>
              <tbody className="divide-y divide-ink-200">{(full?.items || []).map((i) => <tr key={i.id}><td className="px-3 py-1.5 font-semibold">{i.item_name}</td><td className="num px-3 text-right">{i.pcs}</td><td className="num px-3 text-right">{weight(i.gross_wt)}</td><td className="num px-3 text-right">{weight(i.net_wt)}</td><td className="num px-3 text-right">{n(i.purity)}</td><td className="num px-3 text-right">{amount(i.value)}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Top-ups on this loan" bodyClassName="p-0">
            <table className="w-full text-sm"><thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 text-right">Top-up</th><th className="px-3 text-left">Paid by</th><th className="px-3 text-left">Entry</th></tr></thead>
              <tbody className="divide-y divide-ink-200">{topups.map((t) => <tr key={t.id}><td className="px-3 py-1.5">{date(t.txn_date)}</td><td className="num px-3 text-right">{amount(t.principal_amount)}</td><td className="px-3">{t.payments.map((p) => p.mode).join(', ')}</td><td className="px-3">{t.created_by_name}</td></tr>)}
                {!topups.length && <tr><td colSpan={4} className="py-6 text-center text-ink-400">No top-ups yet</td></tr>}</tbody></table>
          </Panel>
        </>}
        right={(
          <Panel title={`Top-up · as on ${dayjs().format('DD/MM/YYYY')}`}>
            <div className="space-y-2">
              <Line label="Loan amount now" value={c ? amount(c.principalOutstanding) : '-'} />
              <Line label="Top-up given before" value={amount(topups.reduce((s, t) => s + n(t.principal_amount), 0))} />
              <Line label="Items value today" value={l ? amount(l.market_value) : '-'} />
              <Line label="Eligible (scheme LTV)" value={l ? amount(l.eligible_amount) : '-'} />
              <Field label="Top-up amount"><Input type="number" className="h-12 text-xl font-bold" value={amt} onChange={(e) => setAmt(e.target.value)} disabled={tooLate} /></Field>
              <Field label="Interest deducted now (optional)"><Input type="number" value={deduct} onChange={(e) => setDeduct(e.target.value)} /></Field>
              <Line label="New loan total" value={amount(newTotal)} bold />
              <Line label="Interest / month (new total)" value={amount(newTotal * rate)} />
              <LtvBar value={l && n(l.market_value) ? (newTotal / n(l.market_value)) * 100 : 0} max={l ? (n(l.eligible_amount) / n(l.market_value || 1)) * 100 : 75} />
              {tooLate && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-700">Top-up allowed only within {within} days of loan date. Use Re-loan.</p>}
              {pay > 0 && <PaymentSplit total={pay} value={payments} onChange={setPayments} direction="paid" label="Paid by" />}
              <BigTotal label="Pay to customer" value={pay} tone="green" />
              <GoldButton disabled={!l || tooLate || saving} loading={saving} onClick={give}>Give Top-up (F2)</GoldButton>
            </div>
          </Panel>
        )}
        footerLeft={<Button variant="outline" icon={Plus} onClick={() => setSp({})}>New / Clear (Ctrl+N)</Button>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F2', 'Give top-up'], ['F3', 'Bill book no'], ['F5', 'Customer ledger'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      {printerUi}
    </>
  );
}
