import {
  LayoutDashboard, Users, UserX, Merge, FilePlus2, History, BookOpen, HandCoins, Wallet, ArrowUpCircle, RefreshCcw, Unlock, Printer, Tag,
  Calculator, Landmark, Building2, Gavel, Boxes, ScanLine, BookText, Receipt, NotebookPen, Scale, Coins, Lock, BarChart3, UserCog, CalendarCheck,
  BadgeIndianRupee, Gem, TrendingUp, Layers, ListChecks, Briefcase, Building, Shield, KeyRound, Settings2, MessageSquare, ScrollText,
  DatabaseBackup, CalendarRange, UserPlus, Files, Banknote, FileBarChart, Wrench, LifeBuoy, Keyboard, Info, CircleDollarSign,
} from 'lucide-react';

/**
 * Top menu bar (MyBook style). Single source of truth for menus + permissions.
 * `screen` must match server/src/config/screens.js. Items show only when the user can view the screen.
 * `section` starts a new labelled block inside a dropdown.
 */
export const MENUS = [
  {
    key: 'loan', label: 'Loan', icon: CircleDollarSign,
    items: [
      { label: 'New Loan', hint: 'Give a new loan', path: '/loans/new', icon: FilePlus2, screen: 'loan_new', hot: 'F1' },
      { label: 'Release', hint: 'Close / settle a loan', path: '/loans/counter?tab=RELEASE', icon: Unlock, screen: 'loan_release', hot: 'F2' },
      { label: 'Part Payment / Interest', hint: 'Interest or part amount', path: '/loans/counter?tab=INTEREST', icon: Wallet, screen: 'loan_interest', hot: 'F5' },
      { label: 'Top-up Loan', hint: 'Extra amount on same loan', path: '/loans/counter?tab=TOPUP', icon: ArrowUpCircle, screen: 'loan_topup' },
      { label: 'Re-loan', hint: 'Release old, new loan in one step', path: '/loans/counter?tab=RENEW', icon: RefreshCcw, screen: 'loan_renewal' },
      { label: 'Loan Counter', hint: 'All actions on one loan', path: '/loans/counter', icon: HandCoins, screen: 'loan_list' },
      { section: 'More' },
      { label: 'Old Loan Entry', hint: 'Enter an old paper loan', path: '/loans/old', icon: History, screen: 'loan_old' },
      { label: 'Duplicate Bill', hint: 'Reprint a receipt', path: '/loans/counter?tab=HISTORY', icon: Printer, screen: 'loan_print', hot: 'F8' },
      { label: 'Sticker', hint: 'Print item stickers', path: '/loans/stickers', icon: Tag, screen: 'loan_sticker', hot: 'F9' },
      { label: 'Interest Calculator', hint: 'Quote & compare schemes', path: '/loans/calculator', icon: Calculator, screen: 'interest_calculator' },
    ],
  },
  {
    key: 'records', label: 'Records', icon: Files,
    items: [
      { label: 'Customers', hint: 'Search / edit customers', path: '/customers', icon: Users, screen: 'customers', hot: 'F3' },
      { label: 'New Customer', hint: 'Add a customer', path: '/customers?new=1', icon: UserPlus, screen: 'customers' },
      { label: 'Blocked Customers', hint: 'Block / unblock', path: '/customers/blocked', icon: UserX, screen: 'customer_blocked' },
      { label: 'Merge Customers', hint: 'Combine duplicates', path: '/customers/merge', icon: Merge, screen: 'customer_merge' },
      { section: 'Register' },
      { label: 'Pledge Book', hint: 'All loans register', path: '/loans', icon: BookOpen, screen: 'loan_list' },
      { label: 'Stock Check', hint: 'Scan packets in vault', path: '/stock', icon: ScanLine, screen: 'stock' },
    ],
  },
  {
    key: 'auction', label: 'Auction', icon: Gavel,
    items: [{ label: 'Auction List & Notice', hint: 'Overdue loans, notices, sale', path: '/auction', icon: Gavel, screen: ['auction', 'auction_sale'] }],
  },
  {
    key: 'bank', label: 'Bank', icon: Landmark,
    items: [
      { label: 'Bank Pledge Book', hint: 'Re-pledge jewels with bank', path: '/bank/pledges', icon: Landmark, screen: 'bank_pledge' },
      { label: 'Bank Accounts', hint: 'Operating & pledge accounts', path: '/bank/accounts', icon: Building2, screen: 'bank_accounts' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: Banknote,
    items: [
      { label: 'Day Report', hint: 'Today at a glance', path: '/accounts/cash-book', icon: BookText, screen: 'acc_cashbook', hot: 'F7' },
      { label: 'Voucher Entry', hint: 'Rent, salary, bills', path: '/accounts/vouchers', icon: Receipt, screen: 'acc_voucher', hot: 'F6' },
      { label: 'Account Ledger', hint: 'Statement of any account', path: '/accounts/ledger', icon: NotebookPen, screen: 'acc_ledger_report' },
      { label: 'Final Accounts', hint: 'Trial balance · P&L · Balance sheet', path: '/accounts/final', icon: Scale, screen: 'acc_final' },
      { section: 'Day' },
      { label: 'Cash Denomination', hint: 'Count the cash drawer', path: '/accounts/denomination', icon: Coins, screen: 'cash_denomination' },
      { label: 'Day End', hint: 'Check cash and close the day', path: '/accounts/day-close', icon: Lock, screen: 'day_close', hot: 'F4' },
      { label: 'Account Master', hint: 'Ledgers & opening balances', path: '/accounts/ledgers', icon: Layers, screen: 'acc_ledgers' },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: FileBarChart,
    items: [
      { label: 'All Reports', hint: '23 reports with print & Excel', path: '/reports', icon: BarChart3, screen: ['reports_loan', 'reports_release', 'reports_collection', 'reports_customer', 'reports_summary'] },
      { section: 'Popular' },
      { label: 'Day-wise Loans', path: '/reports?key=daywise_loans', icon: FileBarChart, screen: 'reports_loan' },
      { label: 'Outstanding Loans', path: '/reports?key=outstanding', icon: FileBarChart, screen: 'reports_loan' },
      { label: 'Maturity / Overdue', path: '/reports?key=maturity', icon: FileBarChart, screen: 'reports_loan' },
      { label: 'Day-wise Releases', path: '/reports?key=daywise_releases', icon: FileBarChart, screen: 'reports_release' },
      { label: 'Interest Collection', path: '/reports?key=interest_collection', icon: FileBarChart, screen: 'reports_collection' },
      { label: 'Owner Summary', path: '/reports?key=owner_summary', icon: FileBarChart, screen: 'reports_summary' },
    ],
  },
  {
    key: 'masters', label: 'Masters', icon: Boxes,
    items: [
      { label: 'Gold Rate', hint: 'Daily market & loan rate', path: '/masters/rates', icon: TrendingUp, screen: 'm_rates' },
      { label: 'Loan Schemes', hint: 'LTV & interest slabs', path: '/masters/schemes', icon: ListChecks, screen: 'm_schemes' },
      { label: 'Items', hint: 'Jewel items & categories', path: '/masters/items', icon: Gem, screen: 'm_items' },
      { label: 'Metal & Purity', path: '/masters/metals', icon: Boxes, screen: 'm_metals' },
      { section: 'Staff' },
      { label: 'Employees', path: '/employees', icon: UserCog, screen: 'employees' },
      { label: 'Attendance', path: '/employees/attendance', icon: CalendarCheck, screen: 'attendance' },
      { label: 'Salary', path: '/employees/salary', icon: BadgeIndianRupee, screen: 'salary' },
      { label: 'Designations', path: '/masters/designations', icon: Briefcase, screen: 'm_designations' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Wrench,
    items: [
      { label: 'Company Information', path: '/settings/company', icon: Building, screen: 's_company' },
      { label: 'Branches', path: '/settings/branches', icon: Building2, screen: 's_branches' },
      { label: 'Users', path: '/settings/users', icon: KeyRound, screen: 's_users' },
      { label: 'Roles & Permissions', path: '/settings/roles', icon: Shield, screen: 's_roles' },
      { section: 'System' },
      { label: 'System Settings', path: '/settings/system', icon: Settings2, screen: 's_system' },
      { label: 'Print & Receipt', path: '/settings/print', icon: Printer, screen: 's_print' },
      { label: 'SMS / WhatsApp', path: '/settings/messages', icon: MessageSquare, screen: 's_messages' },
      { label: 'Audit Trail', path: '/settings/audit', icon: ScrollText, screen: 's_audit' },
      { label: 'Backup', path: '/settings/backup', icon: DatabaseBackup, screen: 's_backup' },
      { label: 'Financial Year', path: '/settings/year-end', icon: CalendarRange, screen: 's_year_end' },
    ],
  },
  {
    key: 'help', label: 'Help', icon: LifeBuoy,
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, screen: 'dashboard' },
      { label: 'Keyboard Shortcuts', action: 'shortcuts', icon: Keyboard },
      { label: 'About', action: 'about', icon: Info },
    ],
  },
];

/** Function keys, same as the desktop app. */
export const HOTKEYS = MENUS.flatMap((m) => m.items).filter((i) => i.hot).map((i) => ({ key: i.hot, path: i.path, screen: i.screen, label: i.label }));

export const allowed = (can, screen) => (!screen ? true : Array.isArray(screen) ? screen.some((s) => can(s)) : can(screen));
