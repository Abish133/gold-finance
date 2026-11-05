import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';
import { UPLOAD_ROOT } from '#middleware/upload.js';
import { notFound, errorHandler } from '#middleware/error.js';
import api from './routes.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/uploads') || req.url === '/api/health' }, quietReqLogger: true }));

  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '30d', immutable: true }));
  app.use('/api', api);

  // serve the built client in production (single deployable)
  const clientDist = path.resolve('..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1y', index: false, setHeaders: (res, p) => p.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
};
