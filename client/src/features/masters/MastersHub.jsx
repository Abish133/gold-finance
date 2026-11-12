import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router';
import clsx from 'clsx';
import {
  Building, Gem, UserCog, TrendingUp, ListChecks, Boxes, CalendarCheck, BadgeIndianRupee, Briefcase,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';

/* every master screen, shown inside one page as a tab (the screens are unchanged - only hosted here) */
export const MASTER_TABS = [
  { key: 'company', label: 'Company', icon: Building, screen: 's_company', page: lazy(() => import('@/features/settings/CompanyPage')) },
  { key: 'items', label: 'Items', icon: Gem, screen: 'm_items', page: lazy(() => import('./ItemMasterPage')) },
  { key: 'rates', label: 'Gold / Silver Rate', icon: TrendingUp, screen: 'm_rates', page: lazy(() => import('./RateBoardPage')) },
  { key: 'schemes', label: 'Loan Schemes', icon: ListChecks, screen: 'm_schemes', page: lazy(() => import('./SchemesPage')) },
  { key: 'metals', label: 'Metal & Purity', icon: Boxes, screen: 'm_metals', page: lazy(() => import('./MetalsPage')) },
  { key: 'employees', label: 'Employees', icon: UserCog, screen: 'employees', page: lazy(() => import('@/features/employees/EmployeesPage')) },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck, screen: 'attendance', page: lazy(() => import('@/features/employees/AttendancePage')) },
  { key: 'salary', label: 'Salary', icon: BadgeIndianRupee, screen: 'salary', page: lazy(() => import('@/features/employees/SalaryPage')) },
  { key: 'designations', label: 'Designations', icon: Briefcase, screen: 'm_designations', page: lazy(() => import('./DesignationsPage')) },
];

/** Masters: one page, one tab per master. The chosen tab is kept in the address (?tab=items) so links and refresh work. */
export default function MastersHub() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tabs = MASTER_TABS.filter((t) => can(t.screen));
  const cur = tabs.find((t) => t.key === sp.get('tab')) || tabs[0];
  const Page = cur?.page;

  return (
    <div className="fit-screen flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      {/* tab bar */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-md border border-ink-200 bg-white p-1 [scrollbar-width:none] dark:border-ink-800 dark:bg-ink-900 [&::-webkit-scrollbar]:hidden">
        <span className="px-2 text-[10px] font-bold tracking-widest whitespace-nowrap text-ink-400 uppercase">Masters</span>
        {tabs.map((t) => {
          const on = t.key === cur?.key;
          return (
            <button key={t.key} type="button" onClick={() => setSp({ tab: t.key })}
              className={clsx('flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold whitespace-nowrap transition',
                on ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-900' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800')}>
              <t.icon className={clsx('size-3.5', on ? 'opacity-100' : 'opacity-60')} />{t.label}
            </button>
          );
        })}
      </nav>
      {/* the chosen master screen fills the rest */}
      <div className="flex flex-col xl:min-h-0 xl:flex-1">
        {Page ? <Suspense fallback={<Spinner label="Loading…" />}><Page key={cur.key} /></Suspense> : <p className="p-6 text-sm text-ink-500">You do not have access to any master.</p>}
      </div>
    </div>
  );
}
