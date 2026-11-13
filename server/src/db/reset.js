/**
 * DELETES the whole database (DB_NAME in server/.env) and creates it empty again.
 * Run through npm so migrate + seed follow:   npm run db:reset
 * Needs --yes so it can never run by accident. Take a backup first (Settings > Backup) if the data matters.
 */
import mysql from 'mysql2/promise';
import { env } from '#config/env.js';

if (!process.argv.includes('--yes')) {
  console.error('✖ This deletes the whole database. Run: npm run db:reset');
  process.exit(1);
}

const run = async () => {
  const conn = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password });
  await conn.query(`DROP DATABASE IF EXISTS \`${env.db.database}\``);
  await conn.query(`CREATE DATABASE \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  console.log(`✔ Database "${env.db.database}" deleted and created empty`);
};

run().catch((err) => { console.error('✖ Reset failed:', err.message); process.exit(1); });
