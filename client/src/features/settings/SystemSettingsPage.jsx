import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Undo2, Save, Printer } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Input, Select, Switch, Segmented, Textarea } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { ExitButton, useKeys } from '@/features/loans/desk';

/** Every setting with a short code (like the desktop System Control). */
export const SETTING_GROUPS = [
  { key: 'loan', label: 'Loan', items: [
    ['DEFAULT_ADVANCE_INTEREST', 'AI', 'Advance interest', 'Deduct the first month\'s interest when the loan is given', 'bool'],
    ['DEFAULT_INTEREST_TYPE', 'ITYP', 'Default interest type', 'Compound or simple for new loans', 'select', [['COMPOUND', 'Compound'], ['SIMPLE', 'Simple']]],
    ['DEFAULT_INTEREST_RATE', 'GROI', 'Default interest rate', 'Interest rate used for day-wise interest (number)', 'number'],
    ['ALLOW_BACKDATE_BILLING', 'OEBCBD', 'Allow back-date billing', 'Billing date can be set before today', 'bool'],
    ['DISCOUNT_APPROVAL_LIMIT', 'RDAL', 'Release: discount without admin (₹)', 'A bigger discount needs the admin password (0 = no limit)', 'number'],
    ['LTV_SAFE_PERCENT', 'LTVS', 'New loan: LTV safe %', 'Loan up to this % of item value is shown green', 'number'],
    ['LTV_WARN_PERCENT', 'LTVW', 'New loan: LTV warning %', 'Above this % of item value the loan asks before save', 'number'],
    ['OLD_LOAN_WARN_MONTHS', 'NLOM', 'New loan: old loan warning (months)', 'Warn when the customer has a loan open longer than this', 'number'],
    ['AUCTION_OVERDUE_MONTHS', 'AUOM', 'Auction: overdue after (months)', 'Auction list / release / interest calculator mark older loans', 'number'],
    ['AUCTION_AFTER_DAYS_OVERDUE', 'AUDD', 'Auction list: days after due date', 'Show in the overdue list after this many days past due', 'number'],
    ['STOCK_RISK_MARGIN', 'STRK', 'Stock: risk margin %', 'Stock analysis: margin below this % = at-risk loan', 'number'],
    ['RELEASE_GRACE_DAYS', 'RGDY', 'Release: grace days', 'Extra days after full months not charged', 'number'],
    ['MONTH_ROUND_HALF_DAYS', 'RDAY', 'Months mode: half month up to (days)', '1-15 days = ½ month, 16+ = full month (0 = always full)', 'number'],
    ['COMPOUND_PERIOD_MONTHS', 'CMPM', 'Compound interest period (months)', 'Unpaid interest is added to the loan every N months', 'number'],
    ['TOPUP_WITHIN_DAYS', 'TUPD', 'Top-up allowed within (days)', '0 = top-up any time', 'number'],
    ['REQUIRE_TODAY_RATE', 'RATE', 'Block new loan without today\'s rate', 'Gold / silver rate must be entered first', 'bool'],
    ['ALLOW_LOAN_ABOVE_ELIGIBLE', 'ALAE', 'Allow loan above eligible amount', '', 'bool'],
    ['BLOCK_LOAN_FOR_BLOCKED_CUSTOMER', 'BLKC', 'Stop loans for blocked customers', '', 'bool'],
    ['CANCEL_SAME_DAY_ONLY', 'CNSD', 'Cancel only same-day loans', '', 'bool'],
    ['ENFORCE_DAY_CLOSE', 'DCLK', 'Lock closed days', 'After Day End no entry, change or delete on that day; admin can reopen it from Day Close', 'bool'],
    ['ROUND_LOAN_TO', 'RNDL', 'Round eligible amount down to (₹)', '', 'number'],
    ['ROUND_INTEREST_TO', 'RNDI', 'Round interest to (₹)', '', 'number'],
    ['DEFAULT_TENURE_MONTHS', 'TENR', 'Default tenure (months)', '', 'number'],
  ] },
  { key: 'bill', label: 'Bill book', items: [
    ['LOAN_NO_RESET_YEARLY', 'LNRY', 'Restart loan numbers every year', '', 'bool'],
    ['LOAN_NO_FORMAT', 'LNFT', 'Loan number format', 'Tokens {PREFIX} {NO} {FY} {BRANCH}', 'text'],
    ['RECEIPT_PREFIX', 'RCPX', 'Receipt number prefix', '', 'text'],
  ] },
  { key: 'print', label: 'Print', items: [
    ['RECEIPT_LANG', 'PLNG', 'Bill language', '', 'select', [['ta', 'Tamil'], ['en', 'English']]],
    ['PRINT_PROMISSORY_NOTE', 'PPRN', 'Print promissory note', '', 'bool'],
    ['PRINT_TERMS_PAGE', 'PTRM', 'Print terms & conditions page', '', 'bool'],
    ['PRINT_ACK_CARD', 'PACK', 'Print acknowledge card', '', 'bool'],
    ['RECEIPT_NOTES', 'PNOT', 'Notes under the interest table', 'One per line', 'textarea'],
    ['RECEIPT_TERMS', 'PTXT', 'Terms & conditions', 'One clause per line', 'textarea'],
    ['RECEIPT_FOOTER', 'PFTR', 'Acknowledge card footer', '', 'textarea'],
    ['STICKER_WIDTH_MM', 'STKW', 'Sticker width (mm)', '', 'number'],
    ['STICKER_HEIGHT_MM', 'STKH', 'Sticker height (mm)', '', 'number'],
  ] },
  { key: 'payment', label: 'Payment', items: [
    ['NOTICE_POSTAGE', 'NPST', 'Notice postage (₹)', 'Collected at release', 'number'],
  ] },
  { key: 'messages', label: 'Messages', items: [
    ['SMS_ENABLED', 'SMSE', 'Enable SMS', '', 'bool'], ['SMS_PROVIDER_URL', 'SMSU', 'SMS provider URL', 'Use {phone} and {message}', 'text'],
    ['SMS_ON_NEW_LOAN', 'MSNL', 'SMS on new loan', '', 'bool'], ['SMS_ON_INTEREST', 'MSIP', 'SMS on interest / part payment', '', 'bool'],
    ['SMS_ON_RELEASE', 'MSRL', 'SMS on release', '', 'bool'], ['SMS_ON_DUE_REMINDER', 'MSDR', 'SMS due reminders', '', 'bool'],
  ] },
  { key: 'home', label: 'Home page', items: [
    ['HOME_SHOW_CHARTS', 'HQCH', 'Show charts on dashboard', '', 'bool'], ['HOME_SHOW_DUE_SOON', 'HQDS', 'Show loans due in 15 days', '', 'bool'],
  ] },
  { key: 'employee', label: 'Employee', items: [['EMP_LEAVE_PER_YEAR', 'EMLV', 'Leave days per year', '', 'number']] },
];

/** System Control (desktop: frmSystemSetting) - how the software behaves; loan, bill book, print and payment settings. */
export default function SystemSettingsPage() {
  const qc = useQueryClient();
  const { isAllBranches, currentBranch } = useAuth();
  const { data: company } = useCompany();
  const [scope, setScope] = useState('global');
  const { data } = useFetch('/admin/settings', { scope });
  const seq = useFetch(isAllBranches ? null : '/admin/sequences');
  const [v, setV] = useState({});
  const [s, setS] = useState({});
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  useEffect(() => { if (data) setV(data); }, [data]);
  useEffect(() => { if (seq.data) setS(seq.data); }, [seq.data]);
  const items = useMemo(() => SETTING_GROUPS.flatMap((g) => g.items.map((i) => ({ group: g, key: i[0], code: i[1], label: i[2], hint: i[3], type: i[4], options: i[5] }))), []);
  const shown = items.filter((i) => (group === 'all' || i.group.key === group) && (!q || `${i.label} ${i.hint} ${i.code}`.toLowerCase().includes(q.toLowerCase())));
  const changed = items.filter((i) => (v[i.key] ?? '') !== (data?.[i.key] ?? ''));
  const save = async () => {
    try {
      await api.put(`/admin/settings?scope=${scope}`, Object.fromEntries(items.map((i) => [i.key, v[i.key]])));
      if (!isAllBranches && seq.data && JSON.stringify(s) !== JSON.stringify(seq.data)) await api.put('/admin/sequences', s);
      toast.success('Changes saved'); qc.invalidateQueries({ queryKey: ['/admin/settings'] }); seq.refetch?.();
    } catch (e) { toast.error(e.message); }
  };
  const print = () => printTable({ title: 'System settings', company, rows: items.map((i) => ({ ...i, value: v[i.key] })), columns: [{ key: 'code', label: 'Code' }, { key: 'label', label: 'Setting' }, { key: 'value', label: 'Value' }] });
  useKeys({ f2: save, f9: print }, [v, s, scope]);

  const control = (i) => {
    const val = v[i.key] ?? '';
    const set = (x) => setV({ ...v, [i.key]: x });
    if (i.type === 'bool') return <Switch checked={val === '1'} onChange={(c) => set(c ? '1' : '0')} label={val === '1' ? 'Yes' : 'No'} />;
    if (i.type === 'select') return <Select className="w-40" value={val} onChange={(e) => set(e.target.value)} options={i.options.map(([a, b]) => ({ value: a, label: b }))} />;
    if (i.type === 'textarea') return <Textarea rows={3} className="tamil w-full" value={val} onChange={(e) => set(e.target.value)} />;
    return <Input type={i.type === 'number' ? 'number' : 'text'} className={clsx('text-right', i.type === 'number' ? 'w-28' : 'w-72 text-left')} value={val} onChange={(e) => set(e.target.value)} />;
  };
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">System Control</h1><p className="text-sm text-navy-100">How the software behaves - loan, bill book, print and payment settings</p></div>
        {!isAllBranches && <Segmented value={scope} onChange={setScope} options={[{ value: 'global', label: 'All branches' }, { value: 'branch', label: `Only ${currentBranch?.name}` }]} />}
      </section>
      <div className="card px-4 py-3"><p className="label">Search setting</p><Input className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid items-start gap-3 xl:grid-cols-[220px_1fr]">
        <div className="card p-2">
          {[{ key: 'all', label: 'All settings', n: items.length }, ...SETTING_GROUPS.map((g) => ({ key: g.key, label: g.label, n: g.items.length }))].map((g) => (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} className={clsx('flex w-full justify-between rounded-md px-3 py-2 text-left text-sm font-semibold', group === g.key ? 'bg-navy-50 text-navy-900' : 'text-ink-700 hover:bg-ink-50')}>
              <span>{g.label}</span><span className="rounded bg-ink-100 px-1.5 text-xs">{g.n}</span>
            </button>
          ))}
        </div>
        <div className="card max-h-[65vh] overflow-y-auto">
          {(group === 'all' || group === 'bill') && !isAllBranches && (
            <div className="border-b border-ink-200 bg-cream-100 px-4 py-3">
              <p className="mb-2 text-xs font-bold text-gold-700 uppercase">Bill book · next numbers ({currentBranch?.name})</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {[['LOAN', 'Next loan no'], ['RECEIPT', 'Next receipt no'], ['CUSTOMER', 'Next customer no']].map(([k, l]) => <label key={k} className="flex items-center gap-2">{l}<Input type="number" className="h-8 w-28 text-right" value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
              </div>
            </div>
          )}
          {shown.map((i, k) => (
            <div key={i.key}>
              {(k === 0 || shown[k - 1].group.key !== i.group.key) && <p className="bg-ink-50 px-4 py-1.5 text-xs font-bold text-gold-700 uppercase">{i.group.label}</p>}
              <div className={clsx('flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-2.5', changed.includes(i) && 'bg-navy-50/60')}>
                <div className="min-w-64 flex-1"><p className="text-sm font-semibold text-navy-900">{i.label}</p>{i.hint && <p className="text-xs text-ink-500">{i.hint}</p>}</div>
                <span className="w-14 text-right text-[10px] font-semibold text-ink-400">{i.code}</span>
                <div className={i.type === 'textarea' ? 'w-full' : ''}>{control(i)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Undo2} onClick={() => setV(data || {})}>Undo All Changes {changed.length ? `(${changed.length})` : ''}</Button>
        <div className="ml-auto flex gap-2"><Button variant="outline" icon={Printer} onClick={print}>Print Settings (F9)</Button><Button variant="gold" icon={Save} onClick={save}>Save Changes (F2)</Button><ExitButton /></div>
      </div>
    </div>
  );
}
