export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export const num = (n, d = 0) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? d : Number(n));
/** Round to nearest `step` rupees (e.g. 1, 5, 10). */
export const roundTo = (n, step = 1) => (step > 0 ? Math.round(n / step) * step : n);
