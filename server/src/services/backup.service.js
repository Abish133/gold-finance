import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import dayjs from 'dayjs';
import { pool, query, queryOne } from '#config/db.js';
import { logger } from '#config/logger.js';
import { getSettings } from './settings.service.js';

/** Server-side backup files live here (one .json.gz per backup). */
export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
const NAME = /^gold-finance-[\w-]+\.json\.gz$/;

const tableNames = async () => (await query("SELECT table_name t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")).map((r) => r.t);

/** Full backup: every table, every branch. This is the only kind that can be restored. */
export const buildFullBackup = async () => {
  const out = { app: 'gold-finance', scope: 'FULL', generated_at: new Date().toISOString(), tables: {} };
  for (const t of await tableNames()) out.tables[t] = await query(`SELECT * FROM \`${t}\``);
  return out;
};

const rowCount = (b) => Object.values(b.tables).reduce((t, r) => t + r.length, 0);

const logBackup = (userId, details) =>
  query("INSERT INTO audit_logs (user_id, action, entity, details) VALUES (:u, 'BACKUP', 'database', :d)", { u: userId ?? null, d: JSON.stringify(details) })
    .catch((err) => logger.warn({ err }, 'backup log failed'));

/** Write a full backup file on the server; keeps only the newest `keep` files of that type. */
export const writeBackupFile = async ({ type = 'Auto', userId = null, keep } = {}) => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const data = await buildFullBackup();
  const name = `gold-finance-${type.toLowerCase().replace(/[^a-z]+/g, '-')}-${dayjs().format('YYYY-MM-DD_HHmmss')}.json.gz`;
  const gz = zlib.gzipSync(JSON.stringify(data));
  fs.writeFileSync(path.join(BACKUP_DIR, name), gz);
  const details = { type, file: name, rows: rowCount(data), kb: Math.round(gz.length / 1024), scope: 'FULL' };
  await logBackup(userId, details);
  if (keep) {
    const prefix = `gold-finance-${type.toLowerCase().replace(/[^a-z]+/g, '-')}-`;
    listBackupFiles().filter((f) => f.name.startsWith(prefix)).slice(keep).forEach((f) => fs.rmSync(path.join(BACKUP_DIR, f.name), { force: true }));
  }
  return details;
};

export const listBackupFiles = () => {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter((n) => NAME.test(n))
    .map((name) => { const st = fs.statSync(path.join(BACKUP_DIR, name)); return { name, kb: Math.round(st.size / 1024), created_at: dayjs(st.mtime).format('YYYY-MM-DD HH:mm:ss') }; })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const backupFilePath = (name) => {
  if (!NAME.test(name || '')) return null;
  const p = path.join(BACKUP_DIR, name);
  return fs.existsSync(p) ? p : null;
};

/** Read a backup from a .json or .json.gz buffer. */
export const parseBackup = (buf) => {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { throw new Error('This is not a backup file'); }
  if (!data?.tables || typeof data.tables !== 'object') throw new Error('This is not a backup file');
  if (data.scope !== 'FULL') throw new Error('This backup has only some branches (taken from the Backup button). Restore needs a full backup - use a server backup file or "Full backup".');
  return data;
};

/** The audit trail is never overwritten, so the restore itself stays on record. */
const KEEP_ON_RESTORE = ['audit_logs'];

/** Replace every table that is in the backup with the backup rows. Tables not in the backup are left alone. */
export const restoreBackup = async (data) => {
  const existing = new Set(await tableNames());
  const conn = await pool.getConnection();
  const done = [];
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.beginTransaction();
    for (const [t, rows] of Object.entries(data.tables)) {
      if (!existing.has(t) || !Array.isArray(rows) || KEEP_ON_RESTORE.includes(t)) continue;
      const cols = (await conn.query(`SHOW COLUMNS FROM \`${t}\``))[0].map((c) => c.Field);
      await conn.query(`DELETE FROM \`${t}\``);
      if (rows.length) {
        const use = cols.filter((c) => c in rows[0]);
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500).map((r) => use.map((c) => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])));
          await conn.query(`INSERT INTO \`${t}\` (${use.map((c) => `\`${c}\``).join(', ')}) VALUES ?`, [chunk]);
        }
      }
      done.push({ table: t, rows: rows.length });
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    conn.release();
  }
  return done;
};

/** Nightly auto backup: runs once a day after the set time (checked every minute). */
let lastAutoDay = null;
export const autoBackupTick = async () => {
  try {
    const s = await getSettings(0);
    if (s.AUTO_BACKUP_ENABLED !== '1') return;
    const now = dayjs();
    const [h, m] = String(s.AUTO_BACKUP_TIME || '21:00').split(':').map(Number);
    if (now.hour() * 60 + now.minute() < h * 60 + (m || 0)) return;
    const day = now.format('YYYY-MM-DD');
    if (lastAutoDay === day) return;
    const already = await queryOne("SELECT id FROM audit_logs WHERE action = 'BACKUP' AND DATE(created_at) = :d AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.type')) = 'Auto' LIMIT 1", { d: day });
    lastAutoDay = day;
    if (already) return;
    const r = await writeBackupFile({ type: 'Auto', keep: Math.max(1, Number(s.AUTO_BACKUP_KEEP) || 30) });
    logger.info(r, 'auto backup written');
  } catch (err) {
    logger.warn({ err }, 'auto backup failed');
  }
};
