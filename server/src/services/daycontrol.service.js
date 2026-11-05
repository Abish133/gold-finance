import dayjs from 'dayjs';
import { queryOne } from '#config/db.js';
import { can } from '#middleware/auth.js';
import { ApiError } from '#utils/ApiError.js';
import { getSetting } from './settings.service.js';

export const lastClosedDate = async (branchId) =>
  (await queryOne('SELECT MAX(close_date) AS d FROM day_closes WHERE branch_id = :b', { b: branchId }))?.d || null;

/**
 * Guards a transaction date:
 *  - no future dates
 *  - back-dated entries need the "loan_backdate" permission
 *  - dates on/before the last Day Close are locked
 */
export const ensureDateOpen = async (req, date) => {
  const d = dayjs(date).startOf('day');
  const today = dayjs().startOf('day');
  if (!d.isValid()) throw ApiError.badRequest('Invalid date');
  if (d.isAfter(today)) throw ApiError.badRequest('Future dated entries are not allowed');
  if (d.isBefore(today) && !can(req.user, 'loan_backdate', 'add')) {
    throw ApiError.forbidden('You are not allowed to make back-dated entries');
  }
  if ((await getSetting('ENFORCE_DAY_CLOSE', req.branchId)) === '1') {
    const closed = await lastClosedDate(req.branchId);
    if (closed && !d.isAfter(dayjs(closed))) {
      throw ApiError.badRequest(`Day is closed up to ${dayjs(closed).format('DD-MM-YYYY')}. Entries are locked.`);
    }
  }
  return d.format('YYYY-MM-DD');
};
