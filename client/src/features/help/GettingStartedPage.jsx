import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, ArrowRight, SkipForward, BookOpen, RotateCcw, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

/* First-time setup, in the order a new shop should do it. Each step ticks itself when the data is there. */
export const SETUP = [
  { key: 'company', title: 'Company details', path: '/settings/company', time: '3 min',
    why: 'Your shop name, address, licence number and logo are printed on every loan bill and receipt.',
    what: ['Masters → Company Information', 'Type the shop name, address lines, mobile and pawn-broker licence number', 'Add the logo (optional) and press Save (F2)'],
    sample: 'Sri Lakshmi Gold Finance · 12, Main Road, Nagercoil · 94430 12345 · Licence TN-NGL-0421' },
  { key: 'branch', title: 'Branch and opening cash', path: '/settings/branches', time: '2 min',
    why: 'Every loan belongs to a branch. Opening cash is the money in the drawer on the first day - Day Report starts from it.',
    what: ['Settings → More → Branches', 'Edit "Head Office": code, name, phone, loan number prefix', 'Enter Opening cash (cash in drawer today) and Save', 'More shops? Add one branch for each'],
    sample: 'HO · Head Office · prefix (blank) · opening cash ₹2,00,000' },
  { key: 'rate', title: "Today's gold and silver rate", path: '/masters/rates', time: '1 min',
    why: 'Item value and the eligible loan amount come from today\'s rate. New loans cannot be saved without it.',
    what: ['Masters → Gold / Silver Rate', 'Type the 100% (fine) gold rate and silver rate', 'Press "Auto from 100% Rate" to fill the 92% rows', 'Save Today\'s Rate (F2) - do this every morning'],
    sample: 'Fine Gold ₹7,900 → Gold Ornament 92% ₹7,268 · Fine Silver ₹100' },
  { key: 'scheme', title: 'Interest rate (loan scheme)', path: '/masters/schemes', time: '2 min', manual: true,
    why: 'The scheme gives the default interest % per month, LTV % and period. "Gold Loan (MyBook)" works exactly like MyBook.',
    what: ['Masters → Loan Schemes', 'Open GL000 · Gold Loan (MyBook): set the rate per month (e.g. 1.5) and LTV % (e.g. 75)', 'Keep "Calculate by: MyBook" - every started month is charged', 'Save, then press "Mark done" here'],
    sample: 'GL000 · 1.5 % per month · LTV 75 % · tenure 12 months' },
  { key: 'items', title: 'Jewel item names', path: '/masters/items', time: '1 min',
    why: '88 common gold and silver item names are already added. Add any your shop uses.',
    what: ['Masters → Items', 'Check the list; Add Item for missing names (e.g. "Kasu Malai")'], sample: 'Chain, Ring, Bangle, Kamal, Jimikhi …' },
  { key: 'users', title: 'Staff logins', path: '/settings/users', time: '3 min',
    why: 'Each person signs in with their own name so every entry shows who did it. The role decides which screens they see.',
    what: ['Settings → Users & Roles → Users → Add User', 'Full name, username, password, role (Cashier / Branch Manager / Accountant / Viewer)', 'Tick the branches they work in and Save', 'Change what a role can do in Users & Roles → Roles & Permissions'],
    sample: 'Priya · priya · Cashier · Head Office' },
  { key: 'print', title: 'Printer and loan bill', path: '/settings/print', time: '3 min', manual: true,
    why: 'Choose the bill layout, language, copies and the receipt notes printed under every bill.',
    what: ['Settings → Printer Setup and Settings → More → Print settings', 'Loan bill layout: Branch bill (A4) or MyBook pawn ticket', 'Bill language Tamil / English, receipt notes and terms', 'Print one test bill from a loan, then press "Mark done" here'],
    sample: 'A4 · Tamil · 2 copies' },
  { key: 'bank', title: 'Bank accounts (optional)', path: '/bank/accounts', time: '2 min', optional: true,
    why: 'Needed for UPI / card / cheque payments and for pledging loans with a bank (potali).',
    what: ['Bank → Bank Accounts → New Bank (Ctrl+N)', 'Bank name, branch, account number, IFSC, used for: Potali / Online / Both'], sample: 'Indian Bank · Nagercoil · 6012345678 · Both' },
  { key: 'sms', title: 'SMS to customers (optional)', path: '/settings/messages', time: '5 min', optional: true,
    why: 'Customers get an SMS on new loan, interest receipt, release and due reminders.',
    what: ['Get a DLT-approved SMS provider and its send link', 'Settings → SMS Settings → Auto SMS Rules: Enable SMS, paste Provider URL, choose events, Save', 'Templates tab: match the approved wording'],
    sample: 'https://api.provider.com/send?key=XXXX&to={phone}&text={message}' },
  { key: 'backup', title: 'Backup', path: '/settings/backup', time: '1 min', manual: true,
    why: 'A nightly full backup is saved on the server. Take a copy to a pen drive or Google Drive every week.',
    what: ['Settings → Backup Database → Auto Backup: on, time 21:00, keep 30', 'Press "Take Full Backup Now" once and keep the file safe', 'Press "Mark done" here'], sample: 'Auto backup 21:00 · keep last 30' },
  { key: 'old_loans', title: 'Old paper loans (optional)', path: '/loans/old', time: 'as needed', optional: true,
    why: 'Loans given before you started this software. They are entered as opening loans and are not counted in today\'s cash.',
    what: ['Loan → Old Loan Entry', 'Customer, bill book no (required), pledge date (F4), items, loan amount, interest % p.m.', 'Save Old Loan (F2) - repeat for each paper bill'], sample: 'Bill 1042 · 05/01/2025 · Chain 10 g 91.6 % · ₹12,345 · 1.5 %' },
  { key: 'first_loan', title: 'Your first loan', path: '/loans/new', time: '3 min',
    why: 'Everything is ready - give the first loan to check the bill, the cash and the Day Report.',
    what: ['Loan → New Loan (F1)', 'Find or add the customer (F1 new customer)', 'Add items: item, pcs, gross wt, less wt, purity → Add Item', 'Loan amount, interest % p.m. → Save Loan (F2) → pay the customer → bill prints'],
    sample: 'Ravi Kumar · Chain 10 g 91.6 % · value ₹72,400 · loan ₹50,000 · 1.5 % → pays ₹49,250 (advance ₹750)' },
];

/* What a person in each role does on day one. */
const ROLE_START = {
  Cashier: [['Sign in and check the top bar', 'Billing date, gold rate and your branch are shown at the top. If the rate is red, ask your manager to enter today\'s rate.', '/'],
    ['Give a loan', 'Loan → New Loan (F1).', '/loans/new'], ['Take interest or part amount', 'Loan → Part Payment (F5).', '/loans/part-payment'],
    ['Release a loan', 'Loan → Release Loan (F2).', '/loans/release'], ['Count cash in the evening', 'Accounts → Cash Denomination (F6 on Day End).', '/accounts/denomination']],
  'Branch Manager': [['Enter today\'s rate', 'Masters → Gold / Silver Rate - every morning.', '/masters/rates'], ['Watch the counter', 'Dashboard and Day Report (F7).', '/accounts/day-report'],
    ['Approve discounts', 'Discounts above the limit ask for your password at Release.', '/loans/release'], ['Close the day', 'Settings → Day End (F4) after counting the cash.', '/settings/day-end'],
    ['Overdue loans', 'Auction → Auction List & Notices.', '/auction']],
  Accountant: [['Enter expenses / income', 'Accounts → Voucher Entry.', '/accounts/vouchers'], ['Check the cash book', 'Accounts → Cash Book / Day Book.', '/accounts/cash-book'],
    ['Final accounts', 'Accounts → Final Accounts: Trial Balance, Profit & Loss, Balance Sheet.', '/accounts/final?tab=tb'], ['Send to Tally', 'Accounts → Tally Export after Day End.', '/accounts/tally']],
  Viewer: [['Look up a loan or customer', 'Ctrl+K search at the top, or Records → Pledge Book / Customers.', '/loans'], ['Reports', 'Reports menu - loans, releases, collections.', '/reports/loans']],
};

export default function GettingStartedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const admin = !!user?.is_super_admin;
  const { data, refetch } = useFetch(admin ? '/desk/setup-status' : null);
  const status = Object.fromEntries((data?.steps || []).map((s) => [s.key, s]));
  const mark = async (key, value) => {
    try { await api.post('/desk/setup-status/mark', { key, value }); refetch(); qc.invalidateQueries({ queryKey: ['/desk/setup-status'] }); } catch (e) { toast.error(e.message); }
  };
  const nextKey = SETUP.find((s) => !status[s.key]?.done && !status[s.key]?.skipped)?.key;
  const pct = data ? Math.round((data.done / data.total) * 100) : 0;

  if (!admin) {
    const steps = ROLE_START[user?.role_name] || ROLE_START.Viewer;
    return (
      <div className="animate-rise mx-auto max-w-4xl space-y-3">
        <section className="navy-gradient rounded-md px-5 py-4 text-white"><h1 className="text-2xl font-bold">Welcome, {user?.full_name}</h1><p className="text-sm text-navy-100">You are signed in as <b>{user?.role_name}</b>. These are the things you will do most. The User Manual has every step with examples.</p></section>
        {steps.map(([t, h, path], i) => (
          <div key={t} className="card flex items-center gap-4 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy-50 text-sm font-bold text-navy-900 dark:bg-ink-800 dark:text-white">{i + 1}</span>
            <div className="flex-1"><p className="font-bold">{t}</p><p className="text-sm text-ink-600 dark:text-ink-300">{h}</p></div>
            <Button variant="outline" icon={ArrowRight} onClick={() => navigate(path)}>Open</Button>
          </div>
        ))}
        <Button variant="gold" icon={BookOpen} onClick={() => navigate('/help/manual')}>Open the User Manual</Button>
      </div>
    );
  }

  return (
    <div className="animate-rise mx-auto max-w-5xl space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-4 rounded-md px-5 py-4 text-white">
        <Rocket className="size-9 text-gold-300" />
        <div className="flex-1"><h1 className="text-2xl font-bold">Getting Started</h1><p className="text-sm text-navy-100">Do these steps once, top to bottom, before the shop starts real work. Each step ticks itself when it is done.</p></div>
        <div className="w-56"><div className="flex justify-between text-xs font-bold"><span>{data?.done ?? 0} of {data?.total ?? SETUP.length} done</span><span>{pct}%</span></div><div className="mt-1 h-2 rounded bg-white/20"><div className="h-2 rounded bg-gold-400" style={{ width: `${pct}%` }} /></div></div>
      </section>
      {SETUP.map((s, i) => {
        const st = status[s.key] || {};
        const done = st.done; const skipped = st.skipped && !done; const next = s.key === nextKey;
        return (
          <div key={s.key} className={clsx('card px-4 py-3', next && 'ring-2 ring-gold-500', (done || skipped) && 'opacity-80')}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="pt-0.5">{done ? <CheckCircle2 className="size-7 text-emerald-600" /> : <Circle className={clsx('size-7', next ? 'text-gold-500' : 'text-ink-300')} />}</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy-900 dark:text-white">Step {i + 1} · {s.title} {s.optional && <span className="ml-1 rounded bg-ink-100 px-1.5 text-[10px] font-bold text-ink-600 uppercase dark:bg-ink-800">optional</span>}
                  {next && <span className="ml-1 rounded bg-gold-100 px-1.5 text-[10px] font-bold text-gold-800 uppercase">do this next</span>}
                  {skipped && <span className="ml-1 rounded bg-ink-100 px-1.5 text-[10px] font-bold text-ink-600 uppercase">skipped</span>}
                  <span className="ml-2 text-xs font-normal text-ink-500">about {s.time}</span></p>
                <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{s.why}</p>
                {!done && (<>
                  <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm">{s.what.map((w) => <li key={w}>{w}</li>)}</ol>
                  <p className="mt-2 rounded bg-cream-100 px-2 py-1 text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200"><b>Example:</b> {s.sample}</p>
                </>)}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button size="sm" variant={next ? 'gold' : 'outline'} icon={ArrowRight} onClick={() => navigate(s.path)}>Open</Button>
                {!done && s.manual && <Button size="sm" variant="outline" icon={CheckCircle2} onClick={() => mark(s.key, true)}>Mark done</Button>}
                {!done && !skipped && s.optional && <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => mark(s.key, 'skip')}>Skip</Button>}
                {(st.skipped || (done && s.manual)) && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => mark(s.key, null)}>Undo</Button>}
              </div>
            </div>
          </div>
        );
      })}
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <BookOpen className="size-5 text-navy-700" /><p className="flex-1 text-sm">Every screen is explained step by step, with examples, in the <b>User Manual</b> (Help menu).</p>
        <Button variant="outline" onClick={() => navigate('/help/manual')}>Open User Manual</Button>
      </div>
    </div>
  );
}
