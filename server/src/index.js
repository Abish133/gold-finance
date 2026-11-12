import { createApp } from './app.js';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';
import { pool } from '#config/db.js';
import { processQueue, ensureTemplates } from '#services/message.service.js';
import { autoBackupTick } from '#services/backup.service.js';
import { reminderTick } from '#services/reminder.service.js';
import { automationTick } from '#services/automation.service.js';

const app = createApp();

const start = async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    logger.fatal({ err: err.message }, 'Cannot connect to MySQL. Check server/.env and run "npm run db:setup"');
    process.exit(1);
  }
  await ensureTemplates();   // every message has an editable template (SMS / WhatsApp > Templates)
  const server = app.listen(env.port, () => logger.info(`API ready on http://localhost:${env.port}`));
  const timer = setInterval(processQueue, 30_000);
  // daily jobs: auto backup + due-reminder SMS (each checks its own time)
  const daily = setInterval(() => { autoBackupTick(); reminderTick(); automationTick(); }, 60_000);
  setTimeout(() => { autoBackupTick(); reminderTick(); automationTick(); }, 15_000).unref();

  const shutdown = async (sig) => {
    logger.info(`${sig} received, shutting down`);
    clearInterval(timer); clearInterval(daily);
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start();
