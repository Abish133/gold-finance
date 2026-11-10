import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Printer, Search, Rocket, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Markdown, parseFront } from './Markdown';

/* every chapter is a markdown file in ./manual (also joined into docs/USER-MANUAL.md) */
const FILES = import.meta.glob('./manual/*.md', { query: '?raw', import: 'default', eager: true });
export const CHAPTERS = Object.entries(FILES).sort(([a], [b]) => a.localeCompare(b)).map(([path, raw]) => {
  const { meta, body } = parseFront(raw);
  return { id: path.split('/').pop().replace('.md', ''), title: meta.title, group: meta.group, screens: (meta.screens || '*').split(',').map((s) => s.trim()), body };
});
const GROUPS = ['Start here', 'Loan', 'Records', 'Auction', 'Bank', 'Accounts', 'Reports', 'Masters', 'Settings', 'Help'];

/* default screens of each role (Settings → Users & Roles can change them) - to preview the manual a role sees */
const ROLE_SCREENS = {
  Cashier: 'acc_cashbook,cash_denomination,customers,dashboard,interest_calculator,loan_interest,loan_list,loan_new,loan_part_payment,loan_print,loan_release,loan_renewal,loan_sticker,loan_topup,reports_collection,reports_loan,reports_release,stock',
  'Branch Manager': 'acc_bank_reco,acc_cashbook,acc_final,acc_ledger_report,acc_ledgers,acc_tally,acc_voucher,admin_approval,attendance,auction,auction_sale,bank_accounts,bank_pledge,cash_denomination,customers,dashboard,day_close,employees,interest_calculator,loan_backdate,loan_cancel,loan_edit,loan_interest,loan_list,loan_new,loan_old,loan_part_payment,loan_print,loan_release,loan_renewal,loan_sticker,loan_topup,m_designations,m_items,m_metals,m_rates,m_schemes,reports_collection,reports_customer,reports_loan,reports_release,reports_summary,s_audit,s_company,s_import,s_messages,s_print,s_start_fresh,s_system,s_users,salary,stock',
  Accountant: 'acc_cashbook,acc_final,acc_ledger_report,acc_ledgers,acc_voucher,bank_accounts,bank_pledge,cash_denomination,dashboard,day_close,reports_collection,reports_summary,salary',
  Viewer: 'customers,dashboard,interest_calculator,loan_list,reports_collection,reports_customer,reports_loan,reports_release',
};

/** User Manual (Help menu): role-based chapters, step by step with examples; search, print a chapter or the whole manual. */
export default function ManualPage() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const admin = !!user?.is_super_admin;
  const [view, setView] = useState(admin ? 'All' : user?.role_name);
  const [q, setQ] = useState('');
  const [cur, setCur] = useState(CHAPTERS[0]?.id);
  const [all, setAll] = useState(false);
  const allowed = (ch) => {
    if (ch.screens.includes('*')) return true;
    if (admin && view === 'All') return true;
    if (admin && ROLE_SCREENS[view]) return ch.screens.some((s) => ROLE_SCREENS[view].split(',').includes(s));
    return ch.screens.some((s) => can(s));
  };
  const visible = useMemo(() => CHAPTERS.filter(allowed).filter((c) => !q.trim() || `${c.title} ${c.body}`.toLowerCase().includes(q.trim().toLowerCase())), [q, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const chapter = visible.find((c) => c.id === cur) || visible[0];
  const idx = visible.indexOf(chapter);
  const print = (whole) => { setAll(whole); setTimeout(() => { window.print(); setAll(false); }, 150); };

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient no-print flex flex-wrap items-center gap-3 rounded-md px-5 py-3 text-white">
        <BookOpen className="size-8 text-gold-300" />
        <div className="flex-1"><h1 className="text-2xl font-bold">User Manual</h1><p className="text-sm text-navy-100">Every menu, step by step, with examples · showing the chapters for <b>{admin ? (view === 'All' ? 'every role' : view) : user?.role_name}</b></p></div>
        {admin && <Select className="w-48 !text-ink-900" value={view} onChange={(e) => setView(e.target.value)} options={['All', ...Object.keys(ROLE_SCREENS)].map((r) => ({ value: r, label: r === 'All' ? 'Show: every role' : `Show for: ${r}` }))} />}
        <Button variant="outline" className="!bg-white" icon={Rocket} onClick={() => navigate('/getting-started')}>Getting Started</Button>
      </section>
      <div className="grid items-start gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="card no-print sticky top-2 max-h-[calc(100vh-11rem)] overflow-y-auto p-2">
          <Input prefix={<Search className="size-4" />} placeholder="Search the manual…" value={q} onChange={(e) => setQ(e.target.value)} />
          {GROUPS.map((g) => {
            const list = visible.filter((c) => c.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mt-2">
                <p className="px-2 text-[10px] font-bold tracking-widest text-ink-400 uppercase">{g}</p>
                {list.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCur(c.id); window.scrollTo({ top: 0 }); }}
                    className={clsx('flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm', chapter?.id === c.id ? 'bg-navy-50 font-bold text-navy-900 dark:bg-ink-800 dark:text-white' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-400" />{c.title}
                  </button>
                ))}
              </div>
            );
          })}
          {!visible.length && <p className="p-3 text-sm text-ink-500">Nothing found for "{q}".</p>}
        </aside>
        <article className="card p-5">
          <div className="no-print mb-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" icon={Printer} onClick={() => print(false)}>Print this chapter</Button>
            <Button size="sm" variant="outline" icon={Printer} onClick={() => print(true)}>Print whole manual</Button>
          </div>
          {all
            ? visible.map((c) => <div key={c.id} className="page-break mb-8"><Markdown text={c.body} /></div>)
            : chapter && <Markdown text={chapter.body} highlight={q} />}
          {!all && chapter && (
            <div className="no-print mt-6 flex justify-between border-t border-ink-200 pt-3 dark:border-ink-700">
              <Button variant="outline" disabled={idx <= 0} onClick={() => setCur(visible[idx - 1].id)}>← {visible[idx - 1]?.title || 'Previous'}</Button>
              <Button variant="gold" disabled={idx >= visible.length - 1} onClick={() => { setCur(visible[idx + 1].id); window.scrollTo({ top: 0 }); }}>{visible[idx + 1]?.title || 'Next'} →</Button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
