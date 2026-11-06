/**
 * Master list of screens. Permissions are granted per screen per action.
 * The client builds its menu from the same keys, so adding a screen here
 * makes it instantly available in "Roles & Permissions".
 */
export const SCREENS = [
  { key: 'dashboard', group: 'Dashboard', label: 'Dashboard' },

  { key: 'customers', group: 'Customers', label: 'Customers' },
  { key: 'customer_blocked', group: 'Customers', label: 'Block / Unblock Customers' },
  { key: 'customer_merge', group: 'Customers', label: 'Merge Customers' },

  { key: 'loan_new', group: 'Loans', label: 'New Loan' },
  { key: 'loan_old', group: 'Loans', label: 'Old Loan Entry' },
  { key: 'loan_list', group: 'Loans', label: 'Pledge Book' },
  { key: 'loan_edit', group: 'Loans', label: 'Edit Pledged Record' },
  { key: 'loan_cancel', group: 'Loans', label: 'Cancel Loan' },
  { key: 'loan_interest', group: 'Loans', label: 'Interest Receipt' },
  { key: 'loan_part_payment', group: 'Loans', label: 'Part Payment' },
  { key: 'loan_topup', group: 'Loans', label: 'Top-up Loan' },
  { key: 'loan_renewal', group: 'Loans', label: 'Re-Loan / Renewal' },
  { key: 'loan_release', group: 'Loans', label: 'Release' },
  { key: 'loan_print', group: 'Loans', label: 'Bill / Duplicate Print' },
  { key: 'loan_sticker', group: 'Loans', label: 'Jewel Packet Sticker' },
  { key: 'loan_backdate', group: 'Loans', label: 'Back-date Entries' },
  { key: 'admin_approval', group: 'Loans', label: 'Admin Approval (discount above limit)' },
  { key: 'interest_calculator', group: 'Loans', label: 'Interest Calculator' },

  { key: 'bank_accounts', group: 'Bank', label: 'Bank Accounts' },
  { key: 'bank_pledge', group: 'Bank', label: 'Bank Pledge (Re-pledge)' },

  { key: 'auction', group: 'Auction', label: 'Auction List & Notice' },
  { key: 'auction_sale', group: 'Auction', label: 'Auction Sale' },

  { key: 'stock', group: 'Stock', label: 'Current Stock & Stock Check' },

  { key: 'acc_ledgers', group: 'Accounts', label: 'Account Master' },
  { key: 'acc_voucher', group: 'Accounts', label: 'Voucher Entry' },
  { key: 'acc_cashbook', group: 'Accounts', label: 'Cash Book / Day Book' },
  { key: 'acc_ledger_report', group: 'Accounts', label: 'Account Ledger' },
  { key: 'acc_final', group: 'Accounts', label: 'Trial Balance / P&L / Balance Sheet' },
  { key: 'cash_denomination', group: 'Accounts', label: 'Cash Denomination' },
  { key: 'day_close', group: 'Accounts', label: 'Day Close' },

  { key: 'reports_loan', group: 'Reports', label: 'Loan Reports' },
  { key: 'reports_release', group: 'Reports', label: 'Release Reports' },
  { key: 'reports_collection', group: 'Reports', label: 'Interest & Collection Reports' },
  { key: 'reports_customer', group: 'Reports', label: 'Customer Reports' },
  { key: 'reports_summary', group: 'Reports', label: 'Summary / Owner Reports' },

  { key: 'employees', group: 'Employees', label: 'Employees' },
  { key: 'attendance', group: 'Employees', label: 'Attendance' },
  { key: 'salary', group: 'Employees', label: 'Salary' },

  { key: 'm_metals', group: 'Masters', label: 'Metal & Purity' },
  { key: 'm_rates', group: 'Masters', label: 'Metal Rate Update' },
  { key: 'm_items', group: 'Masters', label: 'Items & Categories' },
  { key: 'm_schemes', group: 'Masters', label: 'Loan Schemes' },
  { key: 'm_designations', group: 'Masters', label: 'Designations' },

  { key: 's_company', group: 'Settings', label: 'Company Information' },
  { key: 's_branches', group: 'Settings', label: 'Branches' },
  { key: 's_users', group: 'Settings', label: 'Users' },
  { key: 's_roles', group: 'Settings', label: 'Roles & Permissions' },
  { key: 's_system', group: 'Settings', label: 'System Settings' },
  { key: 's_print', group: 'Settings', label: 'Print & Receipt Setup' },
  { key: 's_messages', group: 'Settings', label: 'SMS / WhatsApp' },
  { key: 's_audit', group: 'Settings', label: 'Audit Trail' },
  { key: 's_backup', group: 'Settings', label: 'Backup & Export' },
  { key: 's_year_end', group: 'Settings', label: 'Financial Year / Year End' },
  { key: 's_import', group: 'Settings', label: 'Data Import / Migration' },
  { key: 's_start_fresh', group: 'Settings', label: 'Start Fresh (remove practice entries)' },
  { key: 'acc_bank_reco', group: 'Accounts', label: 'Bank Reconciliation' },
  { key: 'acc_tally', group: 'Accounts', label: 'Tally Export' },
];

export const ACTIONS = ['view', 'add', 'edit', 'delete', 'print', 'export'];
export const SCREEN_KEYS = new Set(SCREENS.map((s) => s.key));
