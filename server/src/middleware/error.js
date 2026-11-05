import { logger } from '#config/logger.js';
import { env } from '#config/env.js';

export const notFound = (req, res) => res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  if (err.code === 'ER_DUP_ENTRY') { status = 409; message = 'Duplicate entry - this record already exists'; }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') { status = 409; message = 'This record is in use and cannot be deleted'; }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 400; message = `File too large (max ${env.maxUploadMb} MB)`; }
  if (status >= 500) {
    logger.error({ err, url: req.originalUrl }, 'Unhandled error');
    if (env.isProd) message = 'Internal server error';
  }
  res.status(status).json({ message, details: err.details });
};
