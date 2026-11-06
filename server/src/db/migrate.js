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
  ['loans', 'loan_on', "ENUM('GOLD','SILVER','MIX') NOT NULL DEFAULT 'GOLD' AFTER metal_id"],
  ['loans', 'interest_type', "ENUM('SIMPLE','COMPOUND') NOT NULL DEFAULT 'SIMPLE' AFTER rate_type"],
  ['loans', 'release_no', 'INT NULL AFTER close_date'],
  ['loans', 'released_unable', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER release_no'],
  ['loans', 'gold_rate', 'DECIMAL(12,2) NULL AFTER rate_per_gram'],
  ['loans', 'silver_rate', 'DECIMAL(12,2) NULL AFTER gold_rate'],
  ['loans', 'auction_marked_at', 'DATETIME NULL'],
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
];

const TABLES = `
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
  await conn.query("INSERT IGNORE INTO schema_migrations (version, description) VALUES (2, 'Desktop parity: mix loans, compound interest, release no, bank reco')");
  await conn.end();
  console.log(`✔ Database "${env.db.database}" is up to date`);
};

run().catch((err) => {
  console.error('✖ Migration failed:', err.message);
  process.exit(1);
});
