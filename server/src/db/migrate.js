/**
 * Creates the database (if missing) and applies schema.sql.
 * Safe to re-run: every statement is CREATE TABLE IF NOT EXISTS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '#config/env.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const conn = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, multipleStatements: true,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${env.db.database}\``);
  const sql = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');
  await conn.query(sql);
  await conn.query("INSERT IGNORE INTO schema_migrations (version, description) VALUES (1, 'Initial schema')");
  await conn.end();
  console.log(`✔ Database "${env.db.database}" is up to date`);
};

run().catch((err) => {
  console.error('✖ Migration failed:', err.message);
  process.exit(1);
});
