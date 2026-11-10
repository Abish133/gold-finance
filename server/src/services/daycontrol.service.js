import dayjs from 'dayjs';
import { queryOne } from '#config/db.js';
import { can } from '#middleware/auth.js';
import { ApiError } from '#utils/ApiError.js';
import { getSetting } from './settings.service.js';

export const lastClosedDate = async (branchId) =>
  (await queryOne('SELECT MAX(close_date) AS d FROM day_closes WHERE branch_id = :b', { b: branchId }))?.d || null;

/**
 * Working (billing) date of a branch, as the desktop app: after Day End closes today, work moves to the next day
 * (an evening customer after closing is entered on tomorrow's date). Never more than one day ahead of today.
 */
export const workDate = async (branchId) => {
  const today = dayjs().startOf('day');
  if (!branchId) return today.format('YYYY-MM-DD');
  const closed = await lastClosedDate(branchId);
  if (closed && !dayjs(closed).isBefore(today, 'day')) return dayjs(closed).add(1, 'day').format('YYYY-MM-DD');
  return today.format('YYYY-MM-DD');
};

/**
 * Guards a transaction date (no date = the working date):
 *  - no future dates
 *  - back-dated entries need the "loan_backdate" permission
 *  - dates on/before the last Day Close are locked
 */
export const ensureDateOpen = async (req, date) => {
  const work = dayjs(await workDate(req.branchId));
  const d = date ? dayjs(date).startOf('day') : work;
  const today = dayjs().startOf('day');
  if (!d.isValid()) throw ApiError.badRequest('Invalid date');
  // the working date may be tomorrow (today already closed by Day End); anything later is refused
  if (d.isAfter(today) && !d.isSame(work, 'day')) throw ApiError.badRequest('Future dated entries are not allowed');
  if (d.isBefore(today) && !can(req.user, 'loan_backdate', 'add')) {
    throw ApiError.forbidden('You are not allowed to make back-dated entries');
  }
  if ((await getSetting('ENFORCE_DAY_CLOSE', req.branchId)) === '1') {
    const closed = await lastClosedDate(req.branchId);
    if (closed && !d.isAfter(dayjs(closed))) {
      throw ApiError.badRequest(`Day is closed up to ${dayjs(closed).format('DD/MM/YYYY')}. Entries are locked.`);
    }
  }
  return d.format('YYYY-MM-DD');
};
