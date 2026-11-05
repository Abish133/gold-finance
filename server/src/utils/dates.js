import dayjs from 'dayjs';

export const today = () => dayjs().format('YYYY-MM-DD');
export const toDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null);
export const daysBetween = (from, to) => dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day');
export const addMonths = (d, m) => dayjs(d).add(m, 'month').format('YYYY-MM-DD');
export const addDays = (d, n) => dayjs(d).add(n, 'day').format('YYYY-MM-DD');
export { dayjs };
