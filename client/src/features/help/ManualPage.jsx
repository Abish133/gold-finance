import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Printer, Search, Rocket, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Markdown, parseFront } from './Markdown';
import { PageActions } from '@/components/common/PageActions';

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
    /* fit-screen: the chapter list and the chapter each scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient no-print flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <BookOpen className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">User Manual</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Every menu, step by step, with examples · showing the chapters for <b>{admin ? (view === 'All' ? 'every role' : view) : user?.role_name}</b></p></div>
        {admin && <Select className="!h-8 w-48 text-[13px] !text-ink-900" value={view} onChange={(e) => setView(e.target.value)} options={['All', ...Object.keys(ROLE_SCREENS)].map((r) => ({ value: r, label: r === 'All' ? 'Show: every role' : `Show for: ${r}` }))} />}
      </section>
      <PageActions>
        <Button variant="outline" icon={Rocket} onClick={() => navigate('/getting-started')}>Getting Started</Button>
        <Button variant="outline" icon={Printer} onClick={() => print(false)}>Print chapter</Button>
        <Button variant="outline" icon={Printer} onClick={() => print(true)}>Print all</Button>
      </PageActions>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[260px_1fr]">
        <aside className="card no-print flex max-h-[60vh] flex-col overflow-hidden xl:max-h-none xl:min-h-0">
          <div className="shrink-0 border-b border-ink-100 p-1.5 dark:border-ink-800"><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Search the manual…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {GROUPS.map((g) => {
            const list = visible.filter((c) => c.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mt-2">
                <p className="px-2 text-[10px] font-bold tracking-widest text-ink-400 uppercase">{g}</p>
                {list.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCur(c.id); document.getElementById('manual-article')?.scrollTo({ top: 0 }); }}
                    className={clsx('flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[13px]', chapter?.id === c.id ? 'bg-emerald-50 font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                    <ChevronRight className="size-3.5 shrink-0 text-ink-400" />{c.title}
                  </button>
                ))}
              </div>
            );
          })}
          {!visible.length && <p className="p-3 text-[12px] text-ink-500">Nothing found for "{q}".</p>}
          </div>
        </aside>
        <article id="manual-article" className="card overflow-y-auto px-5 py-5 xl:min-h-0">
          {all
            ? visible.map((c) => <div key={c.id} className="page-break mb-8"><Markdown text={c.body} /></div>)
            : chapter && <Markdown text={chapter.body} highlight={q} />}
          {!all && chapter && (
            <div className="no-print mt-4 flex justify-between gap-2 border-t border-ink-200 pt-2.5 dark:border-ink-700 [&_button]:h-8 [&_button]:text-[12px]">
              <Button variant="outline" disabled={idx <= 0} onClick={() => setCur(visible[idx - 1].id)}>← {visible[idx - 1]?.title || 'Previous'}</Button>
              <Button variant="primary" disabled={idx >= visible.length - 1} onClick={() => { setCur(visible[idx + 1].id); document.getElementById('manual-article')?.scrollTo({ top: 0 }); }}>{visible[idx + 1]?.title || 'Next'} →</Button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
