import {
  LayoutDashboard, Users, UserX, Merge, FilePlus2, History, BookOpen, HandCoins, Wallet, ArrowUpCircle, RefreshCcw, Unlock, Printer, Tag,
  Calculator, Landmark, Building2, Gavel, Boxes, ScanLine, BookText, Receipt, NotebookPen, Scale, Coins, Lock, BarChart3, UserCog, CalendarCheck,
  BadgeIndianRupee, Gem, TrendingUp, Layers, ListChecks, Briefcase, Building, Shield, KeyRound, Settings2, FileText, MessageSquare, ScrollText,
  DatabaseBackup, CalendarRange,
} from 'lucide-react';

/**
 * Single source of truth for menu + routes. `screen` must match server/src/config/screens.js.
 * A menu item shows only if the user has `view` on its screen (super admin sees all).
 */
export const NAV = [
  { group: 'Overview', items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard, screen: 'dashboard' }] },
  {
    group: 'Loan Counter',
    items: [
      { label: 'New Loan', path: '/loans/new', icon: FilePlus2, screen: 'loan_new', hot: 'F2' },
      { label: 'Loan Counter', path: '/loans/counter', icon: HandCoins, screen: 'loan_release', hint: 'Interest · Part pay · Top-up · Renew · Release', hot: 'F3' },
      { label: 'Pledge Book', path: '/loans', icon: BookOpen, screen: 'loan_list' },
      { label: 'Old Loan Entry', path: '/loans/old', icon: History, screen: 'loan_old' },
      { label: 'Interest Calculator', path: '/loans/calculator', icon: Calculator, screen: 'interest_calculator' },
      { label: 'Packet Stickers', path: '/loans/stickers', icon: Tag, screen: 'loan_sticker' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { label: 'Customers', path: '/customers', icon: Users, screen: 'customers' },
      { label: 'Blocked Customers', path: '/customers/blocked', icon: UserX, screen: 'customer_blocked' },
      { label: 'Merge Customers', path: '/customers/merge', icon: Merge, screen: 'customer_merge' },
    ],
  },
  {
    group: 'Vault & Auction',
    items: [
      { label: 'Stock Check', path: '/stock', icon: ScanLine, screen: 'stock' },
      { label: 'Bank Re-pledge', path: '/bank/pledges', icon: Landmark, screen: 'bank_pledge' },
      { label: 'Auction & Notices', path: '/auction', icon: Gavel, screen: 'auction' },
    ],
  },
  {
    group: 'Accounts',
    items: [
      { label: 'Day Book & Cash Book', path: '/accounts/cash-book', icon: BookText, screen: 'acc_cashbook' },
      { label: 'Voucher Entry', path: '/accounts/vouchers', icon: Receipt, screen: 'acc_voucher' },
      { label: 'Account Ledger', path: '/accounts/ledger', icon: NotebookPen, screen: 'acc_ledger_report' },
      { label: 'Final Accounts', path: '/accounts/final', icon: Scale, screen: 'acc_final', hint: 'Trial balance · P&L · Balance sheet' },
      { label: 'Cash Denomination', path: '/accounts/denomination', icon: Coins, screen: 'cash_denomination' },
      { label: 'Day Close', path: '/accounts/day-close', icon: Lock, screen: 'day_close' },
      { label: 'Account Master', path: '/accounts/ledgers', icon: Layers, screen: 'acc_ledgers' },
      { label: 'Bank Accounts', path: '/bank/accounts', icon: Building2, screen: 'bank_accounts' },
    ],
  },
  { group: 'Reports', items: [{ label: 'Reports', path: '/reports', icon: BarChart3, screen: ['reports_loan', 'reports_release', 'reports_collection', 'reports_customer', 'reports_summary'] }] },
  {
    group: 'Employees',
    items: [
      { label: 'Employees', path: '/employees', icon: UserCog, screen: 'employees' },
      { label: 'Attendance', path: '/employees/attendance', icon: CalendarCheck, screen: 'attendance' },
      { label: 'Salary', path: '/employees/salary', icon: BadgeIndianRupee, screen: 'salary' },
    ],
  },
  {
    group: 'Masters',
    items: [
      { label: 'Gold Rate', path: '/masters/rates', icon: TrendingUp, screen: 'm_rates' },
      { label: 'Loan Schemes', path: '/masters/schemes', icon: ListChecks, screen: 'm_schemes' },
      { label: 'Items', path: '/masters/items', icon: Gem, screen: 'm_items' },
      { label: 'Metal & Purity', path: '/masters/metals', icon: Boxes, screen: 'm_metals' },
      { label: 'Designations', path: '/masters/designations', icon: Briefcase, screen: 'm_designations' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Company', path: '/settings/company', icon: Building, screen: 's_company' },
      { label: 'Branches', path: '/settings/branches', icon: Building2, screen: 's_branches' },
      { label: 'Users', path: '/settings/users', icon: KeyRound, screen: 's_users' },
      { label: 'Roles & Permissions', path: '/settings/roles', icon: Shield, screen: 's_roles' },
      { label: 'System Settings', path: '/settings/system', icon: Settings2, screen: 's_system' },
      { label: 'Print & Receipt', path: '/settings/print', icon: Printer, screen: 's_print' },
      { label: 'SMS / WhatsApp', path: '/settings/messages', icon: MessageSquare, screen: 's_messages' },
      { label: 'Audit Trail', path: '/settings/audit', icon: ScrollText, screen: 's_audit' },
      { label: 'Backup', path: '/settings/backup', icon: DatabaseBackup, screen: 's_backup' },
      { label: 'Financial Year', path: '/settings/year-end', icon: CalendarRange, screen: 's_year_end' },
    ],
  },
];

export const allowed = (can, screen) => (Array.isArray(screen) ? screen.some((s) => can(s)) : can(screen));

export const ICONS = { FileText, Wallet, ArrowUpCircle, RefreshCcw, Unlock, Printer };
