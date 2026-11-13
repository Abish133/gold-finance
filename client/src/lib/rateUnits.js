/**
 * Interest rate units for a typed (manual) rate.
 *   PM  % per month (the loan's own unit)     PA  % per year (days counted on 365)
 *   PD  % per day                             RD  ₹ per day          RM  ₹ per month
 * A month is 30 days, except % per year where a day is 1/365 of the year.
 */
export const RATE_UNITS = [
  { value: 'PM', label: '% / month', short: '% p.m.' },
  { value: 'PA', label: '% / year', short: '% p.a.' },
  { value: 'PD', label: '% / day', short: '% a day' },
  { value: 'RD', label: '₹ / day', short: '₹ a day' },
  { value: 'RM', label: '₹ / month', short: '₹ a month' },
];

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export const unitShort = (u) => RATE_UNITS.find((x) => x.value === (u || 'PM'))?.short || '% p.m.';

/** "1.25% p.m." / "₹25 a day" */
export const rateText = (rate, unit) => (['RD', 'RM'].includes(unit) ? `₹${num(rate)} ${unitShort(unit).replace('₹ ', '')}` : `${num(rate)}${unitShort(unit)}`);

/** Interest a month and a day for `base` at `rate` in `unit`. */
export const ratePer = (base, rate, unit = 'PM') => {
  const b = num(base);
  const r = num(rate);
  switch (unit) {
    case 'PA': return { monthly: Math.round((b * r) / 1200), perDay: (b * r) / 100 / 365 };
    case 'PD': return { monthly: Math.round(((b * r) / 100) * 30), perDay: (b * r) / 100 };
    case 'RD': return { monthly: Math.round(r * 30), perDay: r };
    case 'RM': return { monthly: Math.round(r), perDay: r / 30 };
    default: { const m = Math.round((b * r) / 100); return { monthly: m, perDay: m / 30 }; }
  }
};

/** A rate moved to another unit with the same money (1.2% a month → 0.04% a day → 14.4% a year → ₹20 a day on ₹50,000). */
export const convertRate = (rate, from, to, base) => {
  if (from === to) return num(rate);
  const b = num(base) || 1;
  const r = num(rate);
  // exact money a month and a day in the old unit (no rounding)
  const month = { PM: (b * r) / 100, PA: (b * r) / 1200, PD: ((b * r) / 100) * 30, RD: r * 30, RM: r }[from] ?? (b * r) / 100;
  const day = { PM: (b * r) / 100 / 30, PA: (b * r) / 100 / 365, PD: (b * r) / 100, RD: r, RM: r / 30 }[from] ?? (b * r) / 100 / 30;
  const dayUnit = ['PD', 'RD'].includes(from);
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const r2 = (x) => Math.round(x * 100) / 100;
  switch (to) {
    case 'PM': return r4((month / b) * 100);
    case 'PA': return r2(dayUnit ? (day * 365 / b) * 100 : (month * 12 / b) * 100);
    case 'PD': return r4((day / b) * 100);
    case 'RD': return r2(day);
    case 'RM': return r2(month);
    default: return r;
  }
};

/** The loan's rate (% per month) shown in another unit - the starting value when the unit is changed. */
export const rateInUnit = (loanRatePm, unit, base) => {
  const pm = num(loanRatePm);
  const monthly = Math.round((num(base) * pm) / 100);
  switch (unit) {
    case 'PA': return Math.round(pm * 12 * 100) / 100;
    case 'PD': return Math.round((pm / 30) * 10000) / 10000;
    case 'RD': return Math.round((monthly / 30) * 100) / 100;
    case 'RM': return monthly;
    default: return pm;
  }
};
