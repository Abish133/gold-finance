-- =====================================================================
-- Gold Finance - MySQL 8 schema
-- Every transactional table carries branch_id -> strict branch isolation
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description VARCHAR(200)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- company / branch
CREATE TABLE IF NOT EXISTS company (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  local_name VARCHAR(150),
  licence_no VARCHAR(60),
  licence_valid_till DATE,
  address1 VARCHAR(200), address2 VARCHAR(200), address3 VARCHAR(200),
  phone VARCHAR(60), mobile VARCHAR(60), email VARCHAR(120), gstin VARCHAR(20),
  website VARCHAR(150),
  logo_path VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  local_name VARCHAR(120),
  address VARCHAR(300),
  city VARCHAR(80), pincode VARCHAR(10),
  phone VARCHAR(40), email VARCHAR(120),
  manager_name VARCHAR(120),
  loan_prefix VARCHAR(10) DEFAULT '',
  opening_cash DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS financial_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  closed_at DATETIME, closed_by INT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- security
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(200),
  all_branches TINYINT(1) NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  screen_key VARCHAR(60) NOT NULL,
  can_view TINYINT(1) NOT NULL DEFAULT 0,
  can_add TINYINT(1) NOT NULL DEFAULT 0,
  can_edit TINYINT(1) NOT NULL DEFAULT 0,
  can_delete TINYINT(1) NOT NULL DEFAULT 0,
  can_print TINYINT(1) NOT NULL DEFAULT 0,
  can_export TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (role_id, screen_key),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20), email VARCHAR(120),
  role_id INT NOT NULL,
  employee_id INT NULL,
  default_branch_id INT NULL,
  is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT NOT NULL DEFAULT 0,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_branches (
  user_id INT NOT NULL,
  branch_id INT NOT NULL,
  PRIMARY KEY (user_id, branch_id),
  CONSTRAINT fk_ub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT, branch_id INT,
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(60), entity_id VARCHAR(40),
  details JSON,
  ip VARCHAR(60),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_audit_date (created_at), INDEX ix_audit_entity (entity, entity_id), INDEX ix_audit_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL DEFAULT 0,          -- 0 = global
  setting_key VARCHAR(60) NOT NULL,
  setting_value TEXT,
  UNIQUE KEY ux_setting (branch_id, setting_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS number_sequences (
  branch_id INT NOT NULL,
  seq_key VARCHAR(30) NOT NULL,
  fy_id INT NOT NULL DEFAULT 0,
  last_no INT NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, seq_key, fy_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- masters
CREATE TABLE IF NOT EXISTS metals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(40) NOT NULL,
  local_name VARCHAR(60),
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metal_id INT NOT NULL,
  name VARCHAR(40) NOT NULL,
  purity DECIMAL(6,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_purity_metal FOREIGN KEY (metal_id) REFERENCES metals(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS metal_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metal_id INT NOT NULL,
  rate_date DATE NOT NULL,
  purity DECIMAL(6,2) NOT NULL DEFAULT 91.60,
  market_rate DECIMAL(12,2) NOT NULL,
  loan_rate DECIMAL(12,2) NOT NULL,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_rate (metal_id, rate_date, purity),
  CONSTRAINT fk_rate_metal FOREIGN KEY (metal_id) REFERENCES metals(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metal_id INT NULL,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(150),
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  name VARCHAR(80) NOT NULL,
  local_name VARCHAR(80),
  description VARCHAR(150),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY ux_item_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schemes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  metal_id INT NULL,
  branch_id INT NULL,                         -- NULL = all branches
  ltv_percent DECIMAL(6,2) NOT NULL DEFAULT 75,
  rate_type ENUM('YEARLY','MONTHLY') NOT NULL DEFAULT 'YEARLY',
  calc_mode ENUM('DAYS','MONTHS','MYBOOK') NOT NULL DEFAULT 'MYBOOK',
  slab_mode ENUM('FROM_LOAN_DATE','STEPPED') NOT NULL DEFAULT 'FROM_LOAN_DATE',
  slabs JSON NOT NULL,                        -- [{upto_months:3, rate:15}, ... {upto_months:null, rate:24}]
  min_days INT NOT NULL DEFAULT 7,
  tenure_months INT NOT NULL DEFAULT 12,
  grace_days INT NOT NULL DEFAULT 0,
  penal_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  doc_charge_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
  doc_charge_fixed DECIMAL(10,2) NOT NULL DEFAULT 0,
  advance_interest_months INT NOT NULL DEFAULT 0,
  min_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  description VARCHAR(300),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(150),
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- customers
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  customer_no INT NOT NULL,
  title VARCHAR(10),
  name VARCHAR(120) NOT NULL,
  relation_type VARCHAR(10),
  relation_name VARCHAR(120),
  door_no VARCHAR(60), street VARCHAR(150), area VARCHAR(120), city VARCHAR(80),
  district VARCHAR(80), state VARCHAR(60), pincode VARCHAR(10),
  phone VARCHAR(15) NOT NULL, alt_phone VARCHAR(15), email VARCHAR(120),
  dob DATE, gender VARCHAR(10), occupation VARCHAR(80),
  id_proof_type VARCHAR(40), id_proof_no VARCHAR(60),
  nominee_name VARCHAR(120), nominee_relation VARCHAR(40),
  photo VARCHAR(255), signature VARCHAR(255), doc_front VARCHAR(255), doc_back VARCHAR(255),
  status ENUM('ACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  block_reason VARCHAR(200),
  notes VARCHAR(300),
  merged_into INT NULL,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_cust_no (branch_id, customer_no),
  INDEX ix_cust_phone (branch_id, phone),
  INDEX ix_cust_name (branch_id, name),
  INDEX ix_cust_area (branch_id, area),
  CONSTRAINT fk_cust_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- loans
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  fy_id INT NOT NULL,
  loan_no INT NOT NULL,
  bill_no VARCHAR(30) NOT NULL,
  manual_bill_no VARCHAR(30),
  barcode VARCHAR(40),
  loan_date DATE NOT NULL,
  due_date DATE NOT NULL,
  customer_id INT NOT NULL,
  scheme_id INT NOT NULL,
  metal_id INT NOT NULL,
  principal DECIMAL(14,2) NOT NULL,
  current_principal DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(6,2) NOT NULL,
  rate_type ENUM('YEARLY','MONTHLY') NOT NULL DEFAULT 'YEARLY',
  slabs_snapshot JSON NULL,                   -- scheme slabs frozen at loan time
  doc_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_interest DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_disbursed DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_items INT NOT NULL DEFAULT 0,
  total_pcs INT NOT NULL DEFAULT 0,
  gross_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  stone_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  net_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  avg_purity DECIMAL(6,2) NOT NULL DEFAULT 0,
  rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0,
  market_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  eligible_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  item_summary VARCHAR(300),
  item_photo VARCHAR(255),
  customer_photo VARCHAR(255),
  status ENUM('OPEN','CLOSED','RENEWED','AUCTIONED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  entry_type ENUM('NEW','OLD','RENEWAL') NOT NULL DEFAULT 'NEW',
  parent_loan_id INT NULL,
  close_date DATE, closed_by INT,
  bank_pledge_id INT NULL,
  cancel_reason VARCHAR(200), cancelled_by INT, cancelled_at DATETIME,
  sticker_printed_at DATETIME,
  remarks VARCHAR(300),
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_loan_no (branch_id, fy_id, loan_no),
  INDEX ix_loan_bill (branch_id, bill_no),
  INDEX ix_loan_status (branch_id, status, loan_date),
  INDEX ix_loan_date (branch_id, loan_date),
  INDEX ix_loan_due (branch_id, status, due_date),
  INDEX ix_loan_customer (customer_id),
  INDEX ix_loan_barcode (barcode),
  CONSTRAINT fk_loan_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_loan_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_loan_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  item_id INT NULL,
  item_name VARCHAR(80) NOT NULL,
  pcs INT NOT NULL DEFAULT 1,
  gross_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  stone_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  net_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  purity DECIMAL(6,2) NOT NULL DEFAULT 91.6,
  rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0,
  value DECIMAL(14,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(150),
  INDEX ix_li_loan (loan_id),
  CONSTRAINT fk_li_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- every money movement on a loan
CREATE TABLE IF NOT EXISTS loan_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  loan_id INT NOT NULL,
  receipt_no VARCHAR(30),
  txn_date DATE NOT NULL,
  txn_type ENUM('DISBURSE','TOPUP','PART_PAYMENT','INTEREST','RELEASE','AUCTION') NOT NULL,
  principal_amount DECIMAL(14,2) NOT NULL DEFAULT 0,  -- +ve increases principal, -ve reduces
  interest_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  penal_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  months_paid DECIMAL(6,2) NOT NULL DEFAULT 0,
  interest_upto DATE NULL,
  remarks VARCHAR(250),
  voucher_id INT NULL,
  is_void TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_lt_loan (loan_id, txn_date),
  INDEX ix_lt_branch_date (branch_id, txn_date, txn_type),
  CONSTRAINT fk_lt_loan FOREIGN KEY (loan_id) REFERENCES loans(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transaction_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  mode ENUM('CASH','UPI','BANK','CARD','CHEQUE') NOT NULL DEFAULT 'CASH',
  bank_account_id INT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference VARCHAR(80),
  INDEX ix_tp_txn (transaction_id),
  CONSTRAINT fk_tp_txn FOREIGN KEY (transaction_id) REFERENCES loan_transactions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS release_by_other (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  relation_type VARCHAR(10), relation_name VARCHAR(120),
  address VARCHAR(250), phone VARCHAR(20),
  id_proof VARCHAR(80), photo VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rbo_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS print_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  loan_id INT, doc_type VARCHAR(30) NOT NULL, copy_type VARCHAR(20) DEFAULT 'ORIGINAL',
  printed_by INT, printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_pl_loan (loan_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_checks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  check_date DATE NOT NULL,
  loan_id INT NOT NULL,
  remarks VARCHAR(150),
  checked_by INT,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_sc (branch_id, check_date, loan_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- bank re-pledge
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  bank_branch VARCHAR(120),
  account_name VARCHAR(120),
  account_no VARCHAR(40),
  ifsc VARCHAR(15),
  customer_id_at_bank VARCHAR(60),
  address VARCHAR(250), phone VARCHAR(20),
  opened_on DATE,
  used_for ENUM('OPERATING','PLEDGE','BOTH') NOT NULL DEFAULT 'BOTH',
  ledger_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX ix_ba_branch (branch_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_pledges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  bank_account_id INT NOT NULL,
  pledge_no VARCHAR(40) NOT NULL,
  pledge_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  min_days INT NOT NULL DEFAULT 0,
  charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_interest DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_pcs INT NOT NULL DEFAULT 0,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  release_date DATE, interest_paid DECIMAL(12,2) DEFAULT 0, total_paid DECIMAL(14,2) DEFAULT 0,
  remarks VARCHAR(250),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_bp_branch (branch_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_pledge_loans (
  bank_pledge_id INT NOT NULL,
  loan_id INT NOT NULL,
  PRIMARY KEY (bank_pledge_id, loan_id),
  CONSTRAINT fk_bpl_bp FOREIGN KEY (bank_pledge_id) REFERENCES bank_pledges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- auction / notices
CREATE TABLE IF NOT EXISTS auction_notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  loan_id INT NOT NULL,
  notice_type ENUM('REMINDER','FIRST','SECOND','FINAL','AUCTION') NOT NULL DEFAULT 'FIRST',
  notice_date DATE NOT NULL,
  sent_via ENUM('POST','REGISTERED','SMS','WHATSAPP','HAND','EMAIL') NOT NULL DEFAULT 'REGISTERED',
  postage DECIMAL(10,2) NOT NULL DEFAULT 0,
  reference VARCHAR(60),
  remarks VARCHAR(200),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_an_loan (loan_id), INDEX ix_an_branch (branch_id, notice_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auction_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  loan_id INT NOT NULL UNIQUE,
  auction_date DATE NOT NULL,
  buyer_name VARCHAR(120),
  sale_amount DECIMAL(14,2) NOT NULL,
  principal_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  interest_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  surplus DECIMAL(14,2) NOT NULL DEFAULT 0,
  approved_by VARCHAR(120),
  remarks VARCHAR(250),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- accounts (double entry)
CREATE TABLE IF NOT EXISTS ledger_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  nature ENUM('ASSET','LIABILITY','INCOME','EXPENSE','EQUITY') NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ledgers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20),
  system_key VARCHAR(40) NULL UNIQUE,
  branch_id INT NULL,                        -- NULL = shared across branches
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_ledger_group FOREIGN KEY (group_id) REFERENCES ledger_groups(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ledger_openings (
  ledger_id INT NOT NULL,
  branch_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,   -- +ve Debit, -ve Credit
  PRIMARY KEY (ledger_id, branch_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  voucher_no VARCHAR(30) NOT NULL,
  voucher_date DATE NOT NULL,
  voucher_type ENUM('RECEIPT','PAYMENT','JOURNAL','CONTRA','SYSTEM') NOT NULL,
  narration VARCHAR(300),
  source_type VARCHAR(30), source_id INT,
  is_void TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_v_branch_date (branch_id, voucher_date),
  INDEX ix_v_source (source_type, source_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS voucher_entries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  branch_id INT NOT NULL,
  entry_date DATE NOT NULL,
  ledger_id INT NOT NULL,
  debit DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit DECIMAL(14,2) NOT NULL DEFAULT 0,
  narration VARCHAR(300),
  INDEX ix_ve_ledger (ledger_id, branch_id, entry_date),
  INDEX ix_ve_branch_date (branch_id, entry_date),
  CONSTRAINT fk_ve_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cash_denominations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  count_date DATE NOT NULL,
  notes JSON NOT NULL,
  total DECIMAL(14,2) NOT NULL,
  book_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  difference DECIMAL(14,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(200),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_cd (branch_id, count_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS day_closes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  close_date DATE NOT NULL,
  opening_cash DECIMAL(14,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(14,2) NOT NULL DEFAULT 0,
  summary JSON,
  closed_by INT, closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_dc (branch_id, close_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- employees
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  emp_code VARCHAR(20) NOT NULL,
  title VARCHAR(10),
  name VARCHAR(120) NOT NULL,
  relation_type VARCHAR(10), relation_name VARCHAR(120),
  gender VARCHAR(10), dob DATE, marital_status VARCHAR(15),
  address VARCHAR(300), phone VARCHAR(15), email VARCHAR(120),
  qualification VARCHAR(150), experience VARCHAR(150),
  designation_id INT NULL, department VARCHAR(80),
  doj DATE, salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  bank_account VARCHAR(40), ifsc VARCHAR(15), pan VARCHAR(15), aadhaar VARCHAR(20),
  emergency_name VARCHAR(120), emergency_phone VARCHAR(15),
  photo VARCHAR(255), signature VARCHAR(255),
  status ENUM('ACTIVE','LEFT') NOT NULL DEFAULT 'ACTIVE',
  left_date DATE, left_reason VARCHAR(150),
  remarks VARCHAR(200),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_emp_code (emp_code),
  INDEX ix_emp_branch (branch_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  att_date DATE NOT NULL,
  status ENUM('P','A','H','L','WO') NOT NULL DEFAULT 'P',
  in_time TIME, out_time TIME,
  remarks VARCHAR(100),
  UNIQUE KEY ux_att (employee_id, att_date),
  INDEX ix_att_branch (branch_id, att_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salary_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  pay_month CHAR(7) NOT NULL,              -- YYYY-MM
  working_days DECIMAL(5,1) DEFAULT 0, present_days DECIMAL(5,1) DEFAULT 0,
  basic DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_recovery DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_date DATE, payment_mode VARCHAR(10) DEFAULT 'CASH',
  voucher_id INT NULL,
  remarks VARCHAR(200),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_sal (employee_id, pay_month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salary_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  effective_date DATE NOT NULL,
  old_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  new_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason VARCHAR(150),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_sh_emp (employee_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  owner_type ENUM('CUSTOMER','EMPLOYEE','LOAN') NOT NULL,
  owner_id INT NOT NULL,
  doc_type VARCHAR(60) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  remarks VARCHAR(150),
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_doc_owner (owner_type, owner_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- messaging
CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_key VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  body TEXT NOT NULL,
  dlt_template_id VARCHAR(40),
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS message_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  channel ENUM('SMS','WHATSAPP') NOT NULL DEFAULT 'SMS',
  event_key VARCHAR(40),
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  loan_id INT NULL,
  status ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  tries INT NOT NULL DEFAULT 0,
  last_error VARCHAR(250),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  INDEX ix_mq_status (status, created_at), INDEX ix_mq_branch (branch_id, created_at)
) ENGINE=InnoDB;
