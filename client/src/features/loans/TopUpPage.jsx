import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useFetch, useLookups } from '@/hooks/useApi';
import { usePrinter } from '@/features/print/usePrinter';
import { api } from '@/lib/api';
import { amount, date, money, n, round2, today, weight } from '@/lib/format';
import { useInterestChoice, InterestChoice } from './InterestChoice';
import { DeskScreen, Panel, Line, BigTotal, GoldButton, ExitButton, useKeys, LoanFinder, CustomerCard, CustomerLedgerDrawer, ItemPhotoPanel, LtvBar, useLoan, PayDrawer, LoanHead, ItemsSummary, Chip, loanCustomer, fineRate } from './desk';

/** Top-up Loan (desktop: frmTopUp) - extra amount on the same loan number within allowed days. */
export default function TopUpPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { full, isLoading, refresh } = useLoan(sp.get('loan'));
  const { data: settings } = useFetch('/admin/settings');
  const { printTxn, printerUi } = usePrinter();
  const [amt, setAmt] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const { data: lk } = useLookups();
  const others = useFetch(sp.get('loan') ? '/loans' : null, { customer_id: full?.loan?.customer_id, status: 'OPEN', pageSize: 50 }, { enabled: !!full });
  const [ledger, setLedger] = useState(false);
  const [saving, setSaving] = useState(false);
  const l = full?.loan;
  const c = full?.calc;
  useEffect(() => { setAmt(''); setPayOpen(false); }, [l?.id]);
  // interest deducted from the top-up: None (default), Auto (interest due now) or Manual (months / days / amount, typed rate)
  const ic = useInterestChoice({ basis: 'PAY', calc: c, loan: l, txns: full?.transactions, settings, allowNone: true, defaultMode: 'NONE', resetKey: l?.id,
    autoLabel: c ? 'interest due now' : '' });
  const deduct = c ? ic.interest : 0;
  const within = n(settings?.TOPUP_WITHIN_DAYS);
  const topups = (full?.transactions || []).filter((t) => t.txn_type === 'TOPUP' && !t.is_void);
  const newTotal = c ? round2(c.principalOutstanding + n(amt)) : 0;
  const rate = l ? (l.rate_type === 'MONTHLY' ? n(l.interest_rate) / 100 : n(l.interest_rate) / 1200) : 0;
  const pay = round2(n(amt) - n(deduct));
  const dayNo = l ? dayjs().diff(dayjs(l.loan_date), 'day') : 0;
  const tooLate = l && within > 0 && dayNo > within;
  const rateOf = (code) => lk?.rates.find((r) => r.metal_id === lk.metals.find((m) => m.code === code)?.id);
  const otherOpen = (others.data || []).filter((x) => x.id !== l?.id);
  const valueToday = round2((full?.items || []).reduce((s2, i) => s2 + n(i.value), 0)) || n(l?.market_value);
  let after = n(l?.principal);
  const topupRows = topups.map((t) => { after += n(t.principal_amount); return { ...t, after }; });

  const start = () => {
    if (!l || n(amt) <= 0) return toast.error('Enter top-up amount');
    if (ic.error) return toast.error(ic.error);
    if (pay < 0) return toast.error('Interest deducted is more than the top-up amount');
    if (pay > 0) setPayOpen(true); else give([]);
  };
  const give = async (payments) => {
    if (!l || n(amt) <= 0) return toast.error('Enter top-up amount');
    setSaving(true);
    try {
      const r = await api.post(`/loans/${l.id}/topup`, { date: today(), amount: n(amt), interest_amount: deduct, ...ic.payload, payments });
      setPayOpen(false);
      toast.success('Top-up given'); qc.invalidateQueries({ queryKey: ['/loans'] }); refresh();
      const last = r.data.loan.transactions.filter((t) => !t.is_void).at(-1); if (last && settings?.PRINT_AFTER_TOPUP !== '0') printTxn(r.data.loan, last);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  useKeys({ f2: start, f5: () => l && setLedger(true), 'ctrl+n': () => setSp({}), escape: () => navigate('/') }, [l, amt, deduct, pay, ic.error]);

  return (
    <>
      <DeskScreen title="Top-up Loan" subtitle="Give an extra amount on the same loan number, within the allowed days"
        tiles={[{ label: 'Top-up within', value: within ? `${within} days` : 'Any time' }, { label: 'Top-up date', value: dayjs().format('DD/MM/YYYY') }, { label: 'Gold · Silver', value: `${rateOf('GOLD') ? amount(fineRate(rateOf('GOLD'))) : '-'} · ${rateOf('SILVER') ? amount(fineRate(rateOf('SILVER'))) : '-'}`, gold: true }]}
        left={<>
          <LoanFinder onLoad={(id) => setSp({ loan: id })} loading={isLoading} />
          <Panel title="Customer · F5 ledger"><CustomerCard customer={loanCustomer(l)} onLedger={l ? () => setLedger(true) : null} rows={[['Other open loans', otherOpen.length ? otherOpen.map((x) => `#${x.bill_no}`).join(', ') : 'none']]} /></Panel>
          <ItemPhotoPanel value={l?.item_photo} readOnly onChange={() => {}} />
        </>}
        center={<>
          <Panel title="Loan" bodyClassName="flex flex-col p-0" className="[&>header]:hidden">
            <LoanHead loan={l} chips={<Chip tone={tooLate ? 'red' : 'green'}>{within ? `Day ${dayNo} of ${within} · ${tooLate ? 'not allowed' : 'allowed'}` : 'Allowed'}</Chip>}
              cells={[['Loan date', l && date(l.loan_date)], ['First amount', l && money(l.principal)], [`Interest · ${l ? (l.interest_type === 'COMPOUND' ? 'Compound' : 'Flat') : ''}`, l && `${n(l.interest_rate)}% ${l.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'}`], ['Running', c && `${c.elapsedDays} days`]]} />
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-[13px]"><thead className="navy-gradient text-white"><tr><th className="px-2 py-2 text-left">#</th><th className="px-2 text-left">Item</th><th className="px-2 text-left">Metal</th><th className="px-2 text-right">Pcs</th><th className="px-2 text-right">Gross</th><th className="px-2 text-right">Net wt</th><th className="px-2 text-right">Purity</th><th className="px-2 text-right">Value today</th></tr></thead>
                <tbody className="divide-y divide-ink-200">{(full?.items || []).map((i, k) => <tr key={i.id}><td className="px-2 py-1.5">{k + 1}</td><td className="px-2 font-semibold">{i.item_name}</td><td className="px-2"><Chip tone="gold">{i.metal_code || l.loan_on}</Chip></td><td className="num px-2 text-right">{i.pcs}</td><td className="num px-2 text-right">{weight(i.gross_wt)}</td><td className="num px-2 text-right">{weight(i.net_wt)}</td><td className="num px-2 text-right">{n(i.purity)}</td><td className="num px-2 text-right">{amount(i.value)}</td></tr>)}
                  {!full && <tr><td colSpan={8} className="py-16 text-center text-ink-400">Enter a loan number to load</td></tr>}</tbody></table>
            </div>
            <ItemsSummary items={full?.items} />
          </Panel>
          <Panel title={`Top-ups on this loan · ${topups.length ? topups.length : 'none'}`} bodyClassName="p-0">
            <table className="w-full text-[13px]"><thead className="navy-gradient sticky top-0 z-10 text-[11px] tracking-wider text-white uppercase"><tr><th className="px-3 py-1.5 text-left font-semibold">Date</th><th className="px-3 text-right font-semibold">Top-up</th><th className="px-3 text-right font-semibold">Loan after</th><th className="px-3 text-left font-semibold">Paid by</th><th className="px-3 text-left font-semibold">Entry</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{topupRows.map((t) => <tr key={t.id}><td className="px-3 py-1.5">{date(t.txn_date)}</td><td className="num px-3 text-right">{amount(t.principal_amount)}</td><td className="num px-3 text-right">{amount(t.after)}</td><td className="px-3">{t.payments.map((x) => x.mode).join(', ')}</td><td className="px-3">{t.created_by_name}</td></tr>)}
                {!topups.length && <tr><td colSpan={5} className="py-6 text-center text-[12px] text-ink-400">No top-ups yet</td></tr>}</tbody></table>
          </Panel>
        </>}
        right={(
          <Panel title={`Top-up · as on ${dayjs().format('DD/MM/YYYY')}`} bodyClassName="flex flex-col gap-2">
            <div className="flex flex-1 flex-col gap-2">
              {/* where the loan stands now - stretches to fill the panel */}
              <div className={`flex min-h-32 flex-1 flex-col justify-evenly bg-ink-50/50 dark:bg-ink-800/30 rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[13px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700`}>
                <Line label="Loan amount now" value={c ? amount(c.principalOutstanding) : '-'} />
                <Line label="Top-up given before" value={amount(topups.reduce((s, t) => s + n(t.principal_amount), 0))} />
                <Line label="Items value today" value={l ? amount(valueToday) : '-'} />
                <Line label="Eligible (scheme LTV)" value={l ? amount(l.eligible_amount) : '-'} />
              </div>
              <Field label="Top-up amount"><Input type="number" prefix={<IndianRupee className="size-4" />} className="!h-11 text-right text-xl font-bold" value={amt} onChange={(e) => setAmt(e.target.value)} disabled={tooLate} /></Field>
              <InterestChoice ic={ic} title="Interest deducted now" disabled={!l} />
              <div className="rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800 [&>div]:py-0.5 [&>div]:text-[13px] [&>div:not(:last-child)]:border-b [&>div]:border-dashed [&>div]:border-ink-200 dark:[&>div]:border-ink-700">
                <Line label="New loan total" value={amount(newTotal)} bold />
                <Line label="Interest / month (new total)" value={amount(newTotal * rate)} />
              </div>
              <LtvBar value={valueToday ? (newTotal / valueToday) * 100 : 0} max={l ? (n(l.eligible_amount) / n(l.market_value || 1)) * 100 : 75} suffix="(value today)" />
              {tooLate && <p className="rounded-md border-l-2 border-rose-600 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">Top-up allowed only within {within} days of loan date. Use Re-loan.</p>}
            </div>
            {/* pinned to the bottom of the panel */}
            <div className="desk-actions space-y-2">
              <BigTotal label="Pay to customer" value={Math.max(0, pay)} />
              <GoldButton disabled={!l || tooLate || saving} loading={saving && !payOpen} onClick={start}>Give Top-up (F2)</GoldButton>
            </div>
          </Panel>
        )}
        footerLeft={<Button variant="soft-danger" icon={Plus} onClick={() => setSp({})}>New / Clear (Ctrl+N)</Button>}
        footerRight={<ExitButton />}
        hints={[['Enter', 'Load loan'], ['F2', 'Give top-up'], ['F3', 'Bill book no'], ['F5', 'Customer ledger'], ['Ctrl+N', 'Clear'], ['Esc', 'Exit']]}
      />
      <CustomerLedgerDrawer customerId={ledger ? l?.customer_id : null} onClose={() => setLedger(false)} />
      <PayDrawer open={payOpen} onClose={() => setPayOpen(false)} direction="pay" total={pay} loading={saving} onConfirm={give}
        title={`Pay Customer · Top-up #${l?.bill_no || ''}`} subtitle={l && `${l.customer_name} · top-up ${money(amt)}`} />
      {printerUi}
    </>
  );
}
