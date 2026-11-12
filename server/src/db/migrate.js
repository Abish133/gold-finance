/**
 * Creates the database (if missing), applies schema.sql and then the
 * incremental column changes below. Safe to re-run any number of times.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '#config/env.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** v2 - parity with the desktop app (mix loans, compound interest, release no, bank reco ...) */
const COLUMNS = [
  ['stock_checks', 'missing', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER remarks'],
  ['loans', 'loan_on', "ENUM('GOLD','SILVER','MIX') NOT NULL DEFAULT 'GOLD' AFTER metal_id"],
  ['loans', 'interest_type', "ENUM('SIMPLE','COMPOUND') NOT NULL DEFAULT 'SIMPLE' AFTER rate_type"],
  ['loans', 'release_no', 'INT NULL AFTER close_date'],
  ['loans', 'released_unable', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER release_no'],
  ['loans', 'gold_rate', 'DECIMAL(12,2) NULL AFTER rate_per_gram'],
  ['loans', 'silver_rate', 'DECIMAL(12,2) NULL AFTER gold_rate'],
  ['loans', 'auction_marked_at', 'DATETIME NULL'],
  ['company', 'proprietor', 'VARCHAR(120) NULL AFTER local_name'],
  ['loan_items', 'metal_id', 'INT NULL AFTER item_id'],
  ['loan_items', 'fine_wt', 'DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER purity'],
  ['loan_transactions', 'approved_by', 'INT NULL'],
  ['loan_transactions', 'release_no', 'INT NULL'],
  ['voucher_entries', 'bank_date', 'DATE NULL'],
  ['voucher_entries', 'reference', 'VARCHAR(80) NULL'],
  ['bank_pledges', 'cash_received', 'DECIMAL(14,2) NOT NULL DEFAULT 0'],
  ['bank_pledges', 'rate_monthly', 'DECIMAL(6,3) NOT NULL DEFAULT 0'],
  ['bank_accounts', 'code', 'VARCHAR(20) NULL'],
  ['customers', 'occupation_place', 'VARCHAR(120) NULL'],
  ['auction_sales', 'sale_date', 'DATE NULL'],
  ['auction_sales', 'sale_voucher_id', 'INT NULL'],
  ['users', 'appearance', 'TEXT NULL'], // per-user look: accent colour, font, text size ...
];

const TABLES = `
CREATE TABLE IF NOT EXISTS item_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  items JSON NOT NULL,
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS customer_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  views INT NOT NULL DEFAULT 0,
  last_viewed_at DATETIME NULL,
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_cl_customer (customer_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS export_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  export_type VARCHAR(30) NOT NULL,
  from_date DATE, to_date DATE,
  records INT NOT NULL DEFAULT 0,
  created_by INT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
`;

const run = async () => {
  const conn = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, multipleStatements: true,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${env.db.database}\``);
  await conn.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
  await conn.query("INSERT IGNORE INTO schema_migrations (version, description) VALUES (1, 'Initial schema')");

  for (const [table, column, ddl] of COLUMNS) {
    const [rows] = await conn.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [env.db.database, table, column]);
    if (!rows.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  }
  await conn.query(TABLES);
  // ID proof names follow the desktop list
  await conn.query("UPDATE customers SET id_proof_type = 'Aadhaar Card' WHERE id_proof_type = 'Aadhaar'");
  await conn.query("UPDATE customers SET id_proof_type = 'PAN Card' WHERE id_proof_type = 'PAN'");
  await conn.query("INSERT IGNORE INTO schema_migrations (version, description) VALUES (2, 'Desktop parity: mix loans, compound interest, release no, bank reco')");
  // auctions: sale is entered after marking (desktop) - existing sales count as sold on the auction date
  await conn.query("UPDATE auction_sales SET sale_date = auction_date WHERE sale_date IS NULL AND sale_amount > 0");
  // MyBook interest mode + the desktop-style default scheme (rate per month, whole months, interest on the loan amount)
  await conn.query("ALTER TABLE schemes MODIFY calc_mode ENUM('DAYS','MONTHS','MYBOOK') NOT NULL DEFAULT 'MYBOOK'");
  const [[mb]] = await conn.query("SELECT COUNT(*) c FROM schemes WHERE calc_mode = 'MYBOOK'");
  if (!mb.c) {
    await conn.query(`INSERT INTO schemes (code, name, metal_id, ltv_percent, rate_type, calc_mode, slab_mode, slabs, min_days, grace_days, tenure_months, description)
      VALUES ('GL000', 'Gold Loan (MyBook)', NULL, 75, 'MONTHLY', 'MYBOOK', 'FROM_LOAN_DATE', '[{"upto_months":null,"rate":1.5}]', 0, 0, 12, 'Rate per month, every started month charged, interest on the loan amount')`);
  }
  await conn.query("INSERT IGNORE INTO schema_migrations (version, description) VALUES (3, 'MyBook interest mode')");
  await conn.end();
  console.log(`✔ Database "${env.db.database}" is up to date`);
};

run().catch((err) => {
  console.error('✖ Migration failed:', err.message);
  process.exit(1);
});
