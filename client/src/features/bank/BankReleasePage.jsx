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
import { NeedBranch } from '@/components/common/NeedBranch';
import { PageActions } from '@/components/common/PageActions';

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
  if (isAllBranches) return <NeedBranch action="release from bank" />;
  if (lk && !banks.length) return <div className="card space-y-3 p-6 text-sm"><p>No bank account found. Please add the bank in Bank Accounts first.</p><Button onClick={() => navigate('/bank/accounts')}>Open Bank Accounts</Button></div>;

  const tile = (l, v, h, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );
  const line = (k, v, cls) => <div className={clsx('flex justify-between border-b border-dashed border-ink-200 py-0.5 last:border-0 dark:border-ink-700', cls)}><span className="text-ink-500">{k}</span><b className="num">{v}</b></div>;
  return (
    /* fit-screen: the page fits the window; tables and panels scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Bank Release</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Repay a bank loan - the pledged loans come back in hand</p></div>
        <div className="rounded-md border border-white/15 px-3 py-1 text-center"><p className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Billing date</p><p className="font-bold">{dayjs(today()).format('DD/MM/YYYY')}</p></div>
      </section>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Bank / branch" className="w-80"><Select value={bank} onChange={(e) => { setBank(e.target.value); setSelId(null); }} options={banks.map((b) => ({ value: b.id, label: `${b.bank_name}${b.bank_branch ? ` · ${b.bank_branch}` : ''}` }))} /></Field>
        <Field label="Release date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Field label="Bank loan no" className="w-72"><Input value={no} onChange={(e) => setNo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rows[0] && setSelId(rows[0].id)} placeholder="type for suggestions" /></Field>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {tile('Pending at this bank', rows.length, 'bank loans', 'bg-violet-600')}
        {tile('Bank loan amount', `Rs. ${amount(sum(rows, 'amount'))}`, `${sum(rows, 'loan_count')} customer loans inside`, 'bg-blue-600')}
        {tile('Interest due to bank', `Rs. ${amount(open.data?.tiles?.interestDue || 0)}`, `as on ${date(d)}`, 'bg-rose-600')}
        {tile('Released on this date', releasedToday.data?.data?.length || 0, `Rs. ${amount(sum(releasedToday.data?.data || [], 'total_paid'))} paid on ${date(d)}`, 'bg-emerald-700')}
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
            <table className="w-full text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['Bank Loan No', 'Loan Date', 'Loans', 'Weight', 'Amount', '% / Year', 'Days', 'Interest'].map((h, i) => <th key={h} className={clsx('px-2 py-1.5 font-semibold', i > 1 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-[12px] text-ink-400">No pending bank loans at this bank</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelId(r.id)} className={clsx('cursor-pointer', selId === r.id && 'bg-emerald-50 dark:bg-emerald-950/30')}>
                    <td className="px-2 py-1.5 font-semibold">{r.pledge_no}</td><td className="px-2">{date(r.pledge_date)}</td><td className="num px-2 text-right">{r.loan_count}</td><td className="num px-2 text-right">{weight(r.total_wt)}</td>
                    <td className="num px-2 text-right">{amount(r.amount)}</td><td className="num px-2 text-right">{n(r.interest_rate)}</td><td className="num px-2 text-right">{r.days}</td><td className="num px-2 text-right">{amount(r.interest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
            <p className="sticky top-0 z-20 flex h-8 items-center gap-2 border-b border-ink-200 bg-white px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-violet-600" />Customer loans in this bank loan</p>
            <table className="w-full text-[12px]">
              <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['Loan No', 'Customer', 'Metal', 'Items', 'Net Wt', 'Amount', 'Status Now'].map((h, i) => <th key={h} className={clsx('px-2 py-1.5 font-semibold', [4, 5].includes(i) ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {!bp && <tr><td colSpan={7} className="py-8 text-center text-ink-400">Select a bank loan</td></tr>}
                {(bp?.loans || []).map((l) => (
                  <tr key={l.id}><td className="px-2 py-1.5 font-semibold">{l.bill_no}{l.manual_bill_no ? ` / ${l.manual_bill_no}` : ''}</td><td className="px-2">{l.customer_name}</td><td className="px-2">{l.loan_on}</td><td className="max-w-56 truncate px-2 uppercase" title={l.items_text || l.item_summary}>{l.items_text || l.item_summary}</td>
                    <td className="num px-2 text-right">{weight(l.net_wt)}</td><td className="num px-2 text-right">{amount(l.loan_amount ?? l.principal)}</td>
                    <td className="px-2">{l.status === 'OPEN' ? <span className="text-violet-700">In bank</span> : `${l.status === 'CLOSED' || l.status === 'RENEWED' ? 'released' : l.status.toLowerCase()} by customer`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* release calculation: compact grid - fits without scrolling */}
        <div className="flex flex-col gap-2 rounded-md border border-ink-200 bg-white p-2.5 text-[12px] xl:min-h-0 xl:overflow-y-auto dark:border-ink-800 dark:bg-ink-900">
          <p className="flex shrink-0 items-center gap-2 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Release calculation{bp && <span className="ml-auto truncate text-[11px] font-semibold tracking-normal text-ink-500 normal-case">{bp.pledge_no}</span>}</p>
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 dark:border-ink-800 [&>div:nth-last-child(-n+2)]:border-b-0">
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Loan date</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{bp ? date(bp.pledge_date) : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Loan amount</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{bp ? amount(bp.amount) : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Interest % / year</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white">{bp ? n(bp.interest_rate).toFixed(2) : '-'}{bp && <span className="ml-1 text-[10px] font-normal text-ink-500">({(n(bp.interest_rate) / 12).toFixed(2)}/m)</span>}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Days</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{c ? c.days : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Per day interest</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{bp ? amount((n(bp.amount) * n(bp.interest_rate)) / 36500) : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Total interest</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{c ? amount(c.interest) : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Advance interest</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white ">{bp ? amount(bp.advance_interest) : '-'}</p></div>
            <div className="min-w-0 border-b border-ink-100 px-2.5 py-1 odd:border-r dark:border-ink-800"><p className="truncate text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Interest due</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white text-rose-600">{c ? amount(round2(c.interest - n(bp.advance_interest))) : '-'}</p></div>
          </div>
          <div className="navy-gradient flex shrink-0 items-center justify-between rounded-md px-3 py-1.5 text-white"><span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Payable to bank</span><span className="num text-lg font-extrabold">{bp ? amount(payable) : '-'}</span></div>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div><p className="label">Actually paid</p><Input type="number" className="!h-8 text-right text-[14px] font-bold" placeholder={bp ? String(payable) : ''} value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
            <div><p className="label">Paid from</p><Select className="!h-8 text-[13px]" value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: 'BANK', label: 'Same bank' }, { value: 'CASH', label: 'Cash' }]} /></div>
          </div>
          <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-md border border-ink-200 text-center dark:border-ink-800 [&>div]:min-w-0 [&>div]:px-1.5 [&>div]:py-1 [&>div:not(:last-child)]:border-r [&>div]:border-ink-200 dark:[&>div]:border-ink-800">
            <div><p className="truncate text-[10px] font-semibold text-ink-500 uppercase">Interest paid</p><p className="num truncate text-[12px] font-bold">{bp ? amount(interestPaid) : '-'}</p></div>
            <div><p className="truncate text-[10px] font-semibold text-ink-500 uppercase">Difference</p><p className={clsx('num truncate text-[12px] font-bold', diff ? (diff > 0 ? 'text-rose-600' : 'text-emerald-700') : '')}>{bp ? amount(diff) : '-'}</p></div>
            <div><p className="truncate text-[10px] font-semibold text-ink-500 uppercase">Eff. rate</p><p className="num truncate text-[12px] font-bold">{bp ? `${effRate}%` : '-'}</p></div>
          </div>
        </div>
      </div>
      <PageActions keys="Type bank loan no = suggestions · Enter = select / amount paid · F2 = release · F5 = refresh · F9 = print releases of the day · Esc = exit">
        <Button variant="outline" icon={RefreshCw} onClick={() => { open.refetch(); releasedToday.refetch(); }}>Refresh (F5)</Button>
        <span className="flex-1" />
        {can('bank_pledge', 'edit') && <Button variant="gold" icon={Unlock} loading={saving} disabled={!bp} onClick={() => release()}>Release from Bank (F2)</Button>}
        <Button variant="outline" icon={Printer} onClick={printReleases}>Print Releases (F9)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </PageActions>
      {confirm}
    </div>
  );
}
