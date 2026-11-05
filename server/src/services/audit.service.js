import { query } from '#config/db.js';
import { logger } from '#config/logger.js';

/** Fire-and-forget audit trail. Never blocks or breaks the main request. */
export const audit = (req, action, entity, entityId, details = null) => {
  query(
    `INSERT INTO audit_logs (user_id, branch_id, action, entity, entity_id, details, ip)
     VALUES (:u, :b, :a, :e, :id, :d, :ip)`,
    {
      u: req.user?.id ?? null,
      b: req.branchId ?? null,
      a: action,
      e: entity,
      id: entityId == null ? null : String(entityId),
      d: details ? JSON.stringify(details) : null,
      ip: req.ip,
    },
  ).catch((err) => logger.warn({ err }, 'audit write failed'));
};
