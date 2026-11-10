import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Unlock, Printer, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, ConfirmDrawer, Field, Input, Select } from '@/components/ui';
import { useFetch, useList, useLookups, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { amount, date, n, round2, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

/** Bank Release (desktop): repay a bank loan - the pledged loans come back in hand. */
export default function BankReleasePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAllBranches, can } = useAuth();
  const { data: lk } = useLookups();
  const { data: company } = useCompany();
  const banks = (lk?.banks || []).filter((b) => b.used_for !== 'OPERATING');
  const [bank, setBank] = useState('');
  const [d, setD] = useState(today());
  const [no, setNo] = useState('');
  const [sp] = useSearchParams();
  const [selId, setSelId] = useState(sp.get('pledge') ? Number(sp.get('pledge')) : null);
  const [paid, setPaid] = useState('');
  const [mode, setMode] = useState('BANK');
  const [saving, setSaving] = useState(false);
  const pre = useFetch(sp.get('pledge') ? `/bank/pledges/${sp.get('pledge')}` : null);
  useEffect(() => { if (!bank && pre.data) setBank(String(pre.data.bank_account_id)); else if (!bank && !sp.get('pledge') && banks[0]) setBank(String(banks[0].id)); }, [banks, bank, pre.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useList('/bank/pledges', { status: 'OPEN', bank_account_id: bank, as_on: d, pageSize: 200, search: no }, { enabled: !!bank });
  const releasedToday = useList('/bank/pledges', { status: 'CLOSED', bank_account_id: bank, date_on: 'release', from: d, to: d, pageSize: 200 }, { enabled: !!bank });
  const detail = useFetch(selId ? `/bank/pledges/${selId}` : null, { date: d });
  const rows = open.data?.data || [];
  const bp = detail.data;
  const c = bp?.calc;
  const payable = bp ? round2(n(bp.amount) + n(c.interest)) : 0;
  const interestPaid = bp && paid !== '' ? round2(n(paid) - n(bp.amount)) : c?.interest || 0;
  const diff = bp ? round2(interestPaid - n(c.interest)) : 0;
  const effRate = bp && c.days ? round2((interestPaid * 36500) / (n(bp.amount) * c.days)) : 0;
  useEffect(() => { setPaid(''); }, [selId]);
  // paid from: the way the bank money came in (cash -> cash, as the desktop)
  useEffect(() => { if (bp) setMode(Number(bp.received_in_cash) ? 'CASH' : 'BANK'); }, [bp?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (list, k) => list.reduce((s, r) => s + n(r[k]), 0);
  const [ask, setAsk] = useState(false);
  // desktop asks first: "Release bank loan 1 (bank)? Loan amount, interest paid, total paid to bank, loans back in hand"
  const release = async (sure) => {
    if (!bp) return toast.error('Select the bank loan');
    if (sure !== true) return setAsk(true);
    setAsk(false);
    setSaving(true);
    try {
      await api.post(`/bank/pledges/${bp.id}/release`, { date: d, interest: interestPaid, mode, bank_account_id: bp.bank_account_id });
      toast.success(`Bank loan ${bp.pledge_no} released - ${bp.loans.length} loans back in hand`);
      setSelId(null); qc.invalidateQueries({ queryKey: ['/bank/pledges'] }); qc.invalidateQueries({ queryKey: ['/loans'] });
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const printReleases = () => printTable({ title: `Bank releases on ${date(d)}`, company, rows: releasedToday.data?.data || [], columns: [
    { key: 'pledge_no', label: 'Bank loan no' }, { key: 'bank_name', label: 'Bank' }, { key: 'pledge_date', label: 'Loan date', type: 'date' }, { key: 'loan_count', label: 'Loans', type: 'number' },
    { key: 'amount', label: 'Amount', type: 'money' }, { key: 'interest_paid', label: 'Interest', type: 'money' }, { key: 'total_paid', label: 'Total paid', type: 'money' }] });
  useKeys({ f2: () => release(), f5: () => { open.refetch(); releasedToday.refetch(); }, f9: printReleases, escape: () => navigate('/') }, [bp, paid, d, mode]);
  const confirm = (
    <ConfirmDrawer open={ask} onClose={() => setAsk(false)} onConfirm={() => release(true)} tone="primary" loading={saving} confirmText="Yes, release"
      title={bp ? `Release bank loan ${bp.pledge_no} (${bp.bank_name || 'bank'})?` : 'Release bank loan?'}>
      {bp && <div className="space-y-1 text-sm">
        <p>Loan amount: <b>Rs. {amount(bp.amount)}</b></p>
        <p>Interest paid: <b>Rs. {amount(interestPaid)}</b> ({effRate.toFixed(2)}% / year)</p>
        <p>Total paid to bank: <b>Rs. {amount(n(bp.amount) + n(interestPaid))}</b></p>
        <p className="pt-2">{bp.loans.length} customer loan(s) will come back in hand.</p>
      </div>}
    </ConfirmDrawer>
  );
  if (isAllBranches) return <div className="card p-6 text-sm">Select a branch to release from bank.</div>;
  if (lk && !banks.length) return <div className="card space-y-3 p-6 text-sm"><p>No bank account found. Please add the bank in Bank Accounts first.</p><Button onClick={() => navigate('/bank/accounts')}>Open Bank Accounts</Button></div>;

  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  const line = (k, v, cls) => <div className={clsx('flex justify-between py-0.5', cls)}><span>{k}</span><b className="num">{v}</b></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Bank Release</h1><p className="text-sm text-navy-100">Repay a bank loan - the pledged loans come back in hand</p></div>
        <div className="rounded-md bg-white/10 px-4 py-1.5 text-center"><p className="text-[11px] font-bold uppercase">Billing date</p><p className="font-bold">{dayjs(today()).format('DD/MM/YYYY')}</p></div>
      </section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Bank / branch" className="w-80"><Select value={bank} onChange={(e) => { setBank(e.target.value); setSelId(null); }} options={banks.map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))} /></Field>
        <Field label="Release date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Field label="Bank loan no" className="w-72"><Input value={no} onChange={(e) => setNo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rows[0] && setSelId(rows[0].id)} placeholder="type for suggestions" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {tile('Pending at this bank', rows.length, 'bank loans', 'border-t-violet-600')}
        {tile('Bank loan amount', `Rs. ${amount(sum(rows, 'amount'))}`, `${sum(rows, 'loan_count')} customer loans inside`, 'border-t-blue-600')}
        {tile('Interest due to bank', `Rs. ${amount(open.data?.tiles?.interestDue || 0)}`, `as on ${date(d)}`, 'border-t-rose-600')}
        {tile('Released on this date', releasedToday.data?.data?.length || 0, `Rs. ${amount(sum(releasedToday.data?.data || [], 'total_paid'))} paid on ${date(d)}`, 'border-t-emerald-700')}
      </div>
      <div className="grid items-stretch gap-3 xl:grid-cols-[1fr_440px]">
        <div className="space-y-3">
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr>{['Bank Loan No', 'Loan Date', 'Loans', 'Weight', 'Amount', '% / Year', 'Days', 'Interest'].map((h, i) => <th key={h} className={clsx('px-2 py-2', i > 1 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-ink-400">No pending bank loans at this bank</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelId(r.id)} className={clsx('cursor-pointer', selId === r.id && 'bg-navy-50 dark:bg-ink-800')}>
                    <td className="px-2 py-1.5 font-semibold">{r.pledge_no}</td><td className="px-2">{date(r.pledge_date)}</td><td className="num px-2 text-right">{r.loan_count}</td><td className="num px-2 text-right">{weight(r.total_wt)}</td>
                    <td className="num px-2 text-right">{amount(r.amount)}</td><td className="num px-2 text-right">{n(r.interest_rate)}</td><td className="num px-2 text-right">{r.days}</td><td className="num px-2 text-right">{amount(r.interest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-auto">
            <p className="px-3 py-2 text-xs font-bold text-navy-900 uppercase dark:text-white">Customer loans in this bank loan</p>
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr>{['Loan No', 'Customer', 'Metal', 'Items', 'Net Wt', 'Amount', 'Status Now'].map((h, i) => <th key={h} className={clsx('px-2 py-2', [4, 5].includes(i) ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {!bp && <tr><td colSpan={7} className="py-8 text-center text-ink-400">Select a bank loan</td></tr>}
                {(bp?.loans || []).map((l) => (
                  <tr key={l.id}><td className="px-2 py-1.5 font-semibold">{l.bill_no}{l.manual_bill_no ? ` / ${l.manual_bill_no}` : ''}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.loan_on}</td><td className="px-2 uppercase">{l.items_text || l.item_summary}</td>
                    <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right">{amount(l.loan_amount ?? l.principal)}</td>
                    <td className="px-2">{l.status === 'OPEN' ? <span className="text-violet-700">In bank</span> : `${l.status === 'CLOSED' || l.status === 'RENEWED' ? 'released' : l.status.toLowerCase()} by customer`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <p className="navy-gradient -mx-4 -mt-4 mb-2 px-4 py-2 text-sm font-bold text-white uppercase">Release calculation</p>
          {line('Loan date', bp ? date(bp.pledge_date) : '-')}{line('Loan amount', bp ? amount(bp.amount) : '-')}{line('Interest % / year', bp ? `${n(bp.interest_rate).toFixed(2)} (${(n(bp.interest_rate) / 12).toFixed(2)} / month)` : '-')}
          {line('Days', c ? c.days : '-')}{line('Per day interest', bp ? amount((n(bp.amount) * n(bp.interest_rate)) / 36500) : '-')}{line('Total interest', c ? amount(c.interest) : '-')}
          {line('Advance interest', bp ? amount(bp.advance_interest) : '-')}{line('Interest due', c ? amount(round2(c.interest - n(bp.advance_interest))) : '-', 'font-semibold')}
          <div className="-mx-4 flex justify-between bg-cream-100 px-4 py-2 text-base font-bold dark:bg-ink-800"><span>PAYABLE TO BANK</span><span className="num">{bp ? amount(payable) : ''}</span></div>
          <Field label="Actually paid to bank"><Input type="number" className="h-11 text-right text-lg font-bold" placeholder={bp ? String(payable) : ''} value={paid} onChange={(e) => setPaid(e.target.value)} /></Field>
          <Field label="Paid from"><Select value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: 'BANK', label: 'Same bank account' }, { value: 'CASH', label: 'Cash' }]} /></Field>
          {line('Interest paid', bp ? amount(interestPaid) : '-')}{line('Difference', bp ? amount(diff) : '-', diff ? (diff > 0 ? 'text-rose-600' : 'text-emerald-700') : '')}{line('Effective rate', bp ? `${effRate}% / year` : '-')}
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={RefreshCw} onClick={() => { open.refetch(); releasedToday.refetch(); }}>Refresh (F5)</Button>
        <span className="flex-1" />
        {can('bank_pledge', 'edit') && <Button variant="gold" icon={Unlock} loading={saving} disabled={!bp} onClick={() => release()}>Release from Bank (F2)</Button>}
        <Button variant="outline" icon={Printer} onClick={printReleases}>Print Releases (F9)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">Type bank loan no = suggestions · Enter = select / amount paid · F2 = release · F5 = refresh · F9 = print releases of the day · Esc = exit</p>
      {confirm}
    </div>
  );
}
