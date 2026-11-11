import {
  LayoutDashboard, Users, UserX, Merge, FilePlus2, History, BookOpen, HandCoins, Wallet, ArrowUpCircle, RefreshCcw, Unlock, Printer, Tag,
  Calculator, Landmark, Building2, Gavel, Boxes, ScanLine, BookText, Receipt, NotebookPen, Scale, Coins, Lock, BarChart3, UserCog, CalendarCheck,
  BadgeIndianRupee, Gem, TrendingUp, Layers, ListChecks, Briefcase, Building, Shield, KeyRound, Settings2, MessageSquare, ScrollText,
  DatabaseBackup, CalendarRange, UserPlus, Pencil, Trash, Files, Banknote, FileBarChart, Wrench, LifeBuoy, Keyboard, Info, CircleDollarSign, BookCheck, Lightbulb, Palette, Rocket,
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
      { label: 'Release Loan', hint: 'Close / settle a loan', path: '/loans/release', icon: Unlock, screen: 'loan_release', hot: 'F2' },
      { label: 'Part Payment', hint: 'Interest or part amount', path: '/loans/part-payment', icon: Wallet, screen: 'loan_interest', hot: 'F5' },
      { label: 'Top-up Loan', hint: 'Extra amount on same loan', path: '/loans/topup', icon: ArrowUpCircle, screen: 'loan_topup' },
      { label: 'Re-loan', hint: 'Release old, new loan in one step', path: '/loans/reloan', icon: RefreshCcw, screen: 'loan_renewal' },
      { label: 'Interest Calculator', hint: 'Interest due on open loans / quote', path: '/loans/calculator', icon: Calculator, screen: 'interest_calculator' },
      { section: ' ' },
      { label: 'Old Loan Entry', hint: 'Enter an old paper loan', path: '/loans/old', icon: History, screen: 'loan_old' },
      { label: 'Edit Loan Record', hint: 'Correct an open loan', path: '/loans/edit', icon: Pencil, screen: 'loan_edit' },
      { label: 'Loan Details', hint: 'All actions & history of one loan', path: '/loans/counter', icon: HandCoins, screen: 'loan_list' },
      { label: 'Print', icon: Printer, items: [
        { label: 'Jewel Packet Sticker', hint: 'Print item stickers', path: '/loans/stickers', icon: Tag, screen: 'loan_sticker', hot: 'F9' },
        { label: 'Duplicate Bill', hint: 'Reprint loan receipt', path: '/loans/duplicate', icon: Printer, screen: 'loan_print', hot: 'F8' },
      ] },
    ],
  },
  {
    key: 'records', label: 'Records', icon: Files,
    items: [
      { label: 'Pledge Book', hint: 'All loans register', path: '/loans', icon: BookOpen, screen: 'loan_list' },
      { label: 'Customers', hint: 'Search / edit customers, ledger', path: '/customers', icon: Users, screen: 'customers', hot: 'F3' },
      { label: 'Stock', icon: Boxes, items: [
        { label: 'Stock Analysis', hint: 'Amount due against market value', path: '/stock/analysis', icon: TrendingUp, screen: 'stock' },
        { label: 'Stock Check', hint: 'Scan packets in vault', path: '/stock', icon: ScanLine, screen: 'stock' },
      ] },
      { section: 'More' },
      { label: 'Bill Book Check', hint: 'Missing / repeated bill numbers', path: '/loans/bill-book-check', icon: BookCheck, screen: 'loan_list' },
    ],
  },
  {
    key: 'auction', label: 'Auction', icon: Gavel,
    items: [
      { label: 'Auction List & Notices', hint: 'Overdue loans, notices', path: '/auction', icon: Gavel, screen: ['auction', 'auction_sale'] },
      { label: 'Auction Release', hint: 'Close unredeemed loans as auctioned', path: '/auction/release', icon: Gavel, screen: 'auction_sale' },
    ],
  },
  {
    key: 'bank', label: 'Bank', icon: Landmark,
    items: [
      { label: 'Pledge to Bank', hint: 'New bank loan on our loans', path: '/bank/pledge', icon: Landmark, screen: 'bank_pledge' },
      { label: 'Release from Bank', hint: 'Repay a bank loan', path: '/bank/release', icon: Landmark, screen: 'bank_pledge' },
      { label: 'Bank Pledge Book', hint: 'All bank loans - at bank and released', path: '/bank/book', icon: BookOpen, screen: 'bank_pledge' },
      { label: 'Bank Reports', hint: 'Taken, released, month-wise', path: '/bank/reports', icon: FileBarChart, screen: 'bank_pledge' },
      { section: ' ' },
      { label: 'Bank Accounts', hint: 'Banks for potali and online money', path: '/bank/accounts', icon: Building2, screen: 'bank_accounts' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: Banknote,
    items: [
      { label: 'Voucher Entry', hint: 'Rent, salary, bills', path: '/accounts/vouchers', icon: Receipt, screen: 'acc_voucher', hot: 'F6' },
      { label: 'Account Ledger', hint: 'Statement of any account', path: '/accounts/ledger', icon: NotebookPen, screen: 'acc_ledger_report' },
      { label: 'Cash Book / Day Book', hint: 'Cash movement and all vouchers', path: '/accounts/cash-book', icon: BookText, screen: 'acc_cashbook' },
      { label: 'Bank Reconciliation', hint: 'Match book entries with bank statement', path: '/accounts/bank-reco', icon: Scale, screen: 'acc_bank_reco' },
      { label: 'Tally Export', hint: 'Vouchers & ledgers to Tally', path: '/accounts/tally', icon: FileBarChart, screen: 'acc_tally' },
      { label: 'Final Accounts', icon: Scale, items: [
        { label: 'Trial Balance', path: '/accounts/final?tab=tb', icon: Scale, screen: 'acc_final' },
        { label: 'Profit & Loss', path: '/accounts/final?tab=pl', icon: TrendingUp, screen: 'acc_final' },
        { label: 'Balance Sheet', path: '/accounts/final?tab=bs', icon: Layers, screen: 'acc_final' },
      ] },
      { label: 'Account Master', hint: 'Ledgers & opening balances', path: '/accounts/ledgers', icon: Layers, screen: 'acc_ledgers' },
      { section: 'Day' },
      { label: 'Cash Denomination', hint: 'Count the cash drawer', path: '/accounts/denomination', icon: Coins, screen: 'cash_denomination' },
      { label: 'Day End', hint: 'Check everything and close the day', path: '/settings/day-end', icon: Lock, screen: ['day_close', 'cash_denomination'], hot: 'F4' },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: FileBarChart,
    items: [
      { label: 'Day Report', hint: 'Today at a glance', path: '/accounts/day-report', icon: BookText, screen: 'acc_cashbook', hot: 'F7' },
      { label: 'Loan Reports', icon: FileBarChart, items: [
        { label: 'Loan Report', hint: 'Loans given, status today', path: '/reports/loans', icon: FileBarChart, screen: 'reports_loan' },
        { label: 'Release Report', hint: 'Loan amount back, interest', path: '/reports/releases', icon: FileBarChart, screen: 'reports_release' },
        { label: 'Loan & Release Item Details', hint: 'Release with full interest breakdown', path: '/reports/release-details', icon: FileBarChart, screen: 'reports_release' },
        { label: 'Part Payment Report', hint: 'Loan amount and interest received', path: '/reports/part-payments', icon: FileBarChart, screen: 'reports_collection' },
      ] },
      { label: 'Summary', icon: BarChart3, items: [
        { label: 'Loan & Release Summary', path: '/reports/summary', icon: FileBarChart, screen: 'reports_summary' },
        { label: 'Loan & Release Comparison', path: '/reports/compare', icon: TrendingUp, screen: 'reports_summary' },
      ] },
      { section: ' ' },
      { label: 'Current Stock Report', path: '/stock/current', icon: FileBarChart, screen: 'reports_loan' },
      { label: 'Auction Report', path: '/auction/report', icon: Gavel, screen: 'reports_summary' },
      { section: 'More' },
      { label: 'All Reports', hint: 'Every other report with print & Excel', path: '/reports', icon: BarChart3, screen: ['reports_loan', 'reports_release', 'reports_collection', 'reports_customer', 'reports_summary'] },
    ],
  },
  {
    key: 'masters', label: 'Masters', icon: Boxes,
    items: [
      { label: 'Company Information', hint: 'Name, address, licence', path: '/masters?tab=company', icon: Building, screen: 's_company' },
      { label: 'Items', hint: 'Jewel items & categories', path: '/masters?tab=items', icon: Gem, screen: 'm_items' },
      { label: 'Employees', hint: 'Staff, ID card, login, salary', path: '/masters?tab=employees', icon: UserCog, screen: 'employees' },
      { label: 'Gold / Silver Rate', hint: 'Daily board rate', path: '/masters?tab=rates', icon: TrendingUp, screen: 'm_rates' },
      { section: 'More' },
      { label: 'Loan Schemes', hint: 'LTV & interest slabs', path: '/masters?tab=schemes', icon: ListChecks, screen: 'm_schemes' },
      { label: 'Metal & Purity', path: '/masters?tab=metals', icon: Boxes, screen: 'm_metals' },
      { label: 'Attendance', path: '/masters?tab=attendance', icon: CalendarCheck, screen: 'attendance' },
      { label: 'Salary', path: '/masters?tab=salary', icon: BadgeIndianRupee, screen: 'salary' },
      { label: 'Designations', path: '/masters?tab=designations', icon: Briefcase, screen: 'm_designations' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Wrench,
    items: [
      { label: 'Day End', hint: 'Check everything and close the day', path: '/settings/day-end', icon: CalendarCheck, screen: ['day_close', 'cash_denomination'] },
      { label: 'Day Close', hint: 'Closed days, re-open the last day', path: '/accounts/day-close', icon: Lock, screen: 'day_close' },
      { label: 'Change Company / Branch', path: '/?switch=branch', icon: Building2, screen: 'dashboard' },
      { section: ' ' },
      { label: 'Users & Roles', icon: KeyRound, items: [
        { label: 'Users', hint: 'Logins, branches, passwords', path: '/settings/users', icon: KeyRound, screen: 's_users' },
        { label: 'Roles & Permissions', hint: 'Which screens each role can use', path: '/settings/roles', icon: Shield, screen: 's_roles' },
      ] },
      { label: 'System Control', path: '/settings/system', icon: Settings2, screen: 's_system' },
      { label: 'Printer Setup', hint: 'Paper, copies, bill content, labels', path: '/settings/printer', icon: Printer, screen: 's_print' },
      { label: 'SMS Settings', path: '/settings/messages', icon: MessageSquare, screen: 's_messages' },
      { section: ' ' },
      { label: 'Backup Database', path: '/settings/backup', icon: DatabaseBackup, screen: 's_backup' },
      { label: 'Database Migration', hint: 'Import from old software', path: '/settings/import', icon: DatabaseBackup, screen: 's_import' },
      { label: 'Start Fresh', hint: 'Remove practice entries', path: '/settings/start-fresh', icon: Trash, screen: 's_start_fresh' },
      { label: 'User Log', hint: 'Logins & activity', path: '/settings/audit?action=LOGIN', icon: ScrollText, screen: 's_audit' },
      { label: 'Year End Process', path: '/settings/year-end', icon: CalendarRange, screen: 's_year_end' },
      { section: 'More' },
      { label: 'Branches', path: '/settings/branches', icon: Building2, screen: 's_branches' },
      { label: 'Appearance', hint: 'Background image', path: '/settings/appearance', icon: Palette, screen: 's_company' },
      { label: 'Audit Trail', path: '/settings/audit', icon: ScrollText, screen: 's_audit' },
    ],
  },
  {
    key: 'help', label: 'Help', icon: LifeBuoy,
    items: [
      { label: 'User Manual', hint: 'Every menu step by step, with examples', path: '/help/manual', icon: BookOpen, screen: 'dashboard' },
      { label: 'Getting Started', hint: 'First-time setup / your first day', path: '/getting-started', icon: Rocket, screen: 'dashboard' },
      { section: ' ' },
      { label: 'About', action: 'about', icon: Info },
      { label: 'Keyboard Shortcuts', action: 'shortcuts', icon: Keyboard },
      { section: ' ' },
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, screen: 'dashboard' },
      { label: 'Advisory', hint: 'What to act on today', path: '/advisory', icon: Lightbulb, screen: 'dashboard' },
    ],
  },
];

/** Function keys, same as the desktop app. */
export const HOTKEYS = MENUS.flatMap((m) => m.items.flatMap((i) => i.items || [i])).filter((i) => i.hot).map((i) => ({ key: i.hot, path: i.path, screen: i.screen, label: i.label }));

export const allowed = (can, screen) => (!screen ? true : Array.isArray(screen) ? screen.some((s) => can(s)) : can(screen));
