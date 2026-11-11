import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProd ? 'info' : 'debug'),
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
