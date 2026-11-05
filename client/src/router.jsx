import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { Spinner, Empty } from '@/components/ui';
import { ShieldOff } from 'lucide-react';
import LoginPage from '@/features/auth/LoginPage';

// every screen is code-split -> tiny initial bundle, instant first paint
const P = {
  Dashboard: lazy(() => import('@/features/dashboard/DashboardPage')),
  Customers: lazy(() => import('@/features/customers/CustomersPage')),
  BlockedCustomers: lazy(() => import('@/features/customers/BlockedCustomersPage')),
  MergeCustomers: lazy(() => import('@/features/customers/MergeCustomersPage')),
  NewLoan: lazy(() => import('@/features/loans/NewLoanPage')),
  LoanCounter: lazy(() => import('@/features/loans/LoanCounterPage')),
  PledgeBook: lazy(() => import('@/features/loans/PledgeBookPage')),
  Calculator: lazy(() => import('@/features/loans/InterestCalculatorPage')),
  Stickers: lazy(() => import('@/features/loans/StickersPage')),
  StockCheck: lazy(() => import('@/features/stock/StockCheckPage')),
  BankPledge: lazy(() => import('@/features/bank/BankPledgePage')),
  BankAccounts: lazy(() => import('@/features/bank/BankAccountsPage')),
  Auction: lazy(() => import('@/features/auction/AuctionPage')),
  CashBook: lazy(() => import('@/features/accounts/CashBookPage')),
  Vouchers: lazy(() => import('@/features/accounts/VouchersPage')),
  Ledger: lazy(() => import('@/features/accounts/LedgerReportPage')),
  FinalAccounts: lazy(() => import('@/features/accounts/FinalAccountsPage')),
  Denomination: lazy(() => import('@/features/accounts/DenominationPage')),
  DayClose: lazy(() => import('@/features/accounts/DayClosePage')),
  Ledgers: lazy(() => import('@/features/accounts/LedgersPage')),
  Reports: lazy(() => import('@/features/reports/ReportsPage')),
  Employees: lazy(() => import('@/features/employees/EmployeesPage')),
  Attendance: lazy(() => import('@/features/employees/AttendancePage')),
  Salary: lazy(() => import('@/features/employees/SalaryPage')),
  Rates: lazy(() => import('@/features/masters/RatesPage')),
  Schemes: lazy(() => import('@/features/masters/SchemesPage')),
  Items: lazy(() => import('@/features/masters/ItemsPage')),
  Metals: lazy(() => import('@/features/masters/MetalsPage')),
  Designations: lazy(() => import('@/features/masters/DesignationsPage')),
  Company: lazy(() => import('@/features/settings/CompanyPage')),
  Branches: lazy(() => import('@/features/settings/BranchesPage')),
  Users: lazy(() => import('@/features/settings/UsersPage')),
  Roles: lazy(() => import('@/features/settings/RolesPage')),
  System: lazy(() => import('@/features/settings/SystemSettingsPage')),
  Print: lazy(() => import('@/features/settings/PrintSettingsPage')),
  Messages: lazy(() => import('@/features/settings/MessagesPage')),
  Audit: lazy(() => import('@/features/settings/AuditPage')),
  Backup: lazy(() => import('@/features/settings/BackupPage')),
  YearEnd: lazy(() => import('@/features/settings/YearEndPage')),
};

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner label="Starting…" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Route-level screen guard: hides screens the role is not allowed to view. */
function Guard({ screen, children }) {
  const { can } = useAuth();
  const ok = Array.isArray(screen) ? screen.some((s) => can(s)) : can(screen);
  if (!ok) return <Empty icon={ShieldOff} title="Access restricted" message="Your role does not have access to this screen. Contact your administrator." />;
  return children;
}

const r = (path, Comp, screen, props) => ({ path, element: <Guard screen={screen}><Comp {...props} /></Guard> });
const REPORT_SCREENS = ['reports_loan', 'reports_release', 'reports_collection', 'reports_customer', 'reports_summary'];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Guard screen="dashboard"><P.Dashboard /></Guard> },
      r('customers', P.Customers, 'customers'),
      r('customers/blocked', P.BlockedCustomers, 'customer_blocked'),
      r('customers/merge', P.MergeCustomers, 'customer_merge'),
      r('loans', P.PledgeBook, 'loan_list'),
      r('loans/new', P.NewLoan, 'loan_new', { mode: 'NEW' }),
      r('loans/old', P.NewLoan, 'loan_old', { mode: 'OLD' }),
      r('loans/counter', P.LoanCounter, ['loan_release', 'loan_interest', 'loan_part_payment', 'loan_topup', 'loan_renewal', 'loan_list']),
      r('loans/calculator', P.Calculator, 'interest_calculator'),
      r('loans/stickers', P.Stickers, 'loan_sticker'),
      r('stock', P.StockCheck, 'stock'),
      r('bank/pledges', P.BankPledge, 'bank_pledge'),
      r('bank/accounts', P.BankAccounts, 'bank_accounts'),
      r('auction', P.Auction, ['auction', 'auction_sale']),
      r('accounts/cash-book', P.CashBook, 'acc_cashbook'),
      r('accounts/vouchers', P.Vouchers, 'acc_voucher'),
      r('accounts/ledger', P.Ledger, 'acc_ledger_report'),
      r('accounts/final', P.FinalAccounts, 'acc_final'),
      r('accounts/denomination', P.Denomination, 'cash_denomination'),
      r('accounts/day-close', P.DayClose, 'day_close'),
      r('accounts/ledgers', P.Ledgers, 'acc_ledgers'),
      r('reports', P.Reports, REPORT_SCREENS),
      r('employees', P.Employees, 'employees'),
      r('employees/attendance', P.Attendance, 'attendance'),
      r('employees/salary', P.Salary, 'salary'),
      r('masters/rates', P.Rates, 'm_rates'),
      r('masters/schemes', P.Schemes, 'm_schemes'),
      r('masters/items', P.Items, 'm_items'),
      r('masters/metals', P.Metals, 'm_metals'),
      r('masters/designations', P.Designations, 'm_designations'),
      r('settings/company', P.Company, 's_company'),
      r('settings/branches', P.Branches, 's_branches'),
      r('settings/users', P.Users, 's_users'),
      r('settings/roles', P.Roles, 's_roles'),
      r('settings/system', P.System, 's_system'),
      r('settings/print', P.Print, 's_print'),
      r('settings/messages', P.Messages, 's_messages'),
      r('settings/audit', P.Audit, 's_audit'),
      r('settings/backup', P.Backup, 's_backup'),
      r('settings/year-end', P.YearEnd, 's_year_end'),
      { path: '*', element: <Empty title="Page not found" message="The page you are looking for does not exist." /> },
    ],
  },
]);
