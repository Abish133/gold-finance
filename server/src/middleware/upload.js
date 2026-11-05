import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';

export const UPLOAD_ROOT = path.resolve(env.uploadDir);
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(req.branchId || 'common'), new Date().toISOString().slice(0, 7));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const ALLOWED = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/;

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.test(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Only images or PDF files are allowed')),
});

/** Absolute disk path -> public url path served by express.static */
export const publicPath = (file) =>
  file ? '/uploads/' + path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/') : null;
