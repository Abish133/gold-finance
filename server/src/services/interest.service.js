import dayjs from 'dayjs';
import { round2, roundTo, num } from '#utils/money.js';

/**
 * Pure interest engine (no DB). Used by release, interest receipt, renewal, reports and calculator.
 *
 *   rate_type      YEARLY -> % per annum   | MONTHLY -> % per month
 *   calc_mode      DAYS   -> exact days    | MONTHS  -> months with half/full rounding
 *   slab_mode      FROM_LOAN_DATE -> slab reached applies to the whole period (as on the printed bill)
 *                  STEPPED        -> every slab period charged at its own rate
 *   interest_type  SIMPLE | COMPOUND -> unpaid interest is added to the base every `compoundMonths`
 *   slabs          [{ upto_months: 3, rate: 15 }, ..., { upto_months: null, rate: 24 }]
 */

const DAY_MS = 86400000;
const toTime = (d) => dayjs(d).startOf('day').valueOf();

export const parseSlabs = (slabs, fallbackRate) => {
  let list = slabs;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = null; } }
  if (!Array.isArray(list) || !list.length) return [{ upto_months: null, rate: num(fallbackRate) }];
  return [...list]
    .map((s) => ({ upto_months: s.upto_months === '' || s.upto_months == null ? null : Number(s.upto_months), rate: Number(s.rate) }))
    .sort((a, b) => (a.upto_months ?? Infinity) - (b.upto_months ?? Infinity));
};

export const slabFor = (slabs, months) => slabs.find((s) => s.upto_months == null || months <= s.upto_months) || slabs[slabs.length - 1];

/** Months billed in MONTHS mode: full months + 0 / 0.5 / 1 for the extra days. */
export const billedMonths = (from, to, halfDays = 15) => {
  const a = dayjs(from).startOf('day');
  const b = dayjs(to).startOf('day');
  if (!b.isAfter(a)) return 0;
  const full = b.diff(a, 'month');
  const extra = b.diff(a.add(full, 'month'), 'day');
  if (extra === 0) return full;
  if (halfDays > 0 && extra <= halfDays) return full + 0.5;
  return full + 1;
};

export const monthlyRate = (rate, rateType) => (rateType === 'MONTHLY' ? rate / 100 : rate / 100 / 12);

export const calculateInterest = ({ loan, scheme = {}, txns = [], asOf, options = {} }) => {
  const halfDays = num(options.monthRoundHalfDays, 15);
  const roundStep = num(options.roundInterestTo, 1);
  const compoundMonths = Math.max(1, num(options.compoundMonths, 12));
  const rateType = loan.rate_type || scheme.rate_type || 'YEARLY';
  const calcMode = scheme.calc_mode || 'DAYS';
  const slabMode = scheme.slab_mode || 'FROM_LOAN_DATE';
  const compound = (loan.interest_type || scheme.interest_type) === 'COMPOUND';
  const minDays = num(scheme.min_days, 0);
  const graceDays = num(scheme.grace_days, 0);
  const slabs = parseSlabs(loan.slabs_snapshot ?? scheme.slabs, loan.interest_rate);

  const start = toTime(loan.loan_date);
  const end = toTime(asOf || new Date());
  const elapsedDays = Math.max(0, Math.round((end - start) / DAY_MS));
  const monthsElapsed = Math.max(0, elapsedDays - graceDays) / 30;
  const currentSlab = slabFor(slabs, monthsElapsed);

  // days actually charged
  let months = null;
  let chargeDays = Math.max(elapsedDays, minDays);
  if (calcMode === 'MONTHS') {
    months = Math.max(billedMonths(loan.loan_date, dayjs(end).format('YYYY-MM-DD'), halfDays), minDays > 0 ? (minDays <= halfDays ? 0.5 : 1) : 0);
    chargeDays = Math.round(months * 30);
  }
  // per-day factor for a rate
  const dayFactor = (rate) => {
    if (calcMode === 'MONTHS') return rateType === 'MONTHLY' ? rate / 100 / 30 : rate / 100 / 360;
    return rateType === 'MONTHLY' ? rate / 100 / 30 : rate / 100 / 365;
  };

  // principal + interest-paid events by day index
  const valid = txns.filter((t) => !t.is_void);
  const pEvents = valid.filter((t) => ['DISBURSE', 'TOPUP', 'PART_PAYMENT'].includes(t.txn_type))
    .map((t) => ({ day: Math.round((toTime(t.txn_date) - start) / DAY_MS), delta: num(t.principal_amount) }));
  if (!pEvents.length) pEvents.push({ day: 0, delta: num(loan.principal) });
  const iEvents = valid.filter((t) => num(t.interest_amount) > 0 && t.txn_type !== 'DISBURSE')
    .map((t) => ({ day: Math.round((toTime(t.txn_date) - start) / DAY_MS), amt: num(t.interest_amount) }));

  // day-by-day accrual (max a few thousand iterations per loan)
  let principal = pEvents.filter((e) => e.day <= 0).reduce((s, e) => s + e.delta, 0);
  let capitalised = 0;
  let accrued = 0;
  let paidSoFar = num(loan.advance_interest);
  const periodDays = compoundMonths * 30;
  const segments = [];
  let seg = null;
  for (let d = 0; d < chargeDays; d++) {
    if (d > 0) for (const e of pEvents) if (e.day === d) principal += e.delta;
    for (const e of iEvents) if (e.day === d) paidSoFar += e.amt;
    if (compound && d > 0 && d % periodDays === 0) {
      capitalised = Math.max(0, accrued - paidSoFar);
    }
    const rate = slabMode === 'STEPPED' ? slabFor(slabs, d / 30 + 1e-9).rate : currentSlab.rate;
    const base = Math.max(0, principal) + (compound ? capitalised : 0);
    accrued += base * dayFactor(rate);
    if (!seg || seg.principal !== round2(base)) { seg = { fromDay: d, days: 0, principal: round2(base) }; segments.push(seg); }
    seg.days += 1;
  }
  for (const e of pEvents) if (e.day >= chargeDays && e.day > 0) principal += e.delta;
  const outstanding = round2(Math.max(0, principal));

  const totalInterest = round2(roundTo(accrued, roundStep));
  const interestPaid = round2(num(loan.advance_interest) + iEvents.reduce((s, e) => s + e.amt, 0));
  const interestDue = round2(Math.max(0, totalInterest - interestPaid));
  const excessInterest = round2(Math.max(0, interestPaid - totalInterest));

  // penal interest after due date (simple, never compounded)
  let penal = 0;
  let overdueDays = 0;
  if (num(scheme.penal_rate) > 0 && loan.due_date) {
    overdueDays = Math.max(0, Math.round((end - toTime(loan.due_date)) / DAY_MS) - graceDays);
    if (overdueDays > 0) penal = outstanding * (num(scheme.penal_rate) / 100 / 365) * overdueDays;
  }
  const penalPaid = valid.reduce((s, t) => s + num(t.penal_amount), 0);
  const penalDue = round2(Math.max(0, roundTo(penal, roundStep) - penalPaid));

  // month view for the "interest months" strip
  const monthly = round2(outstanding * monthlyRate(currentSlab.rate, rateType));
  const monthsPaid = monthly > 0 ? Math.floor((interestPaid + 0.5) / monthly) : 0;
  const monthsDue = Math.max(Math.ceil(Math.max(elapsedDays, minDays) / 30), 1);

  const isOverdue = loan.due_date ? end > toTime(loan.due_date) : false;
  const nextSlab = slabs.find((s) => s.upto_months != null && s.upto_months >= monthsElapsed && s !== currentSlab) || null;
  const currentSlabEndsOn = currentSlab.upto_months != null ? dayjs(loan.loan_date).add(Math.round(currentSlab.upto_months * 30) + graceDays, 'day').format('YYYY-MM-DD') : null;

  return {
    asOf: dayjs(end).format('YYYY-MM-DD'),
    elapsedDays, chargeDays, months, monthsElapsed: round2(monthsElapsed),
    rate: currentSlab.rate, rateType, interestType: compound ? 'COMPOUND' : 'SIMPLE', slabs, segments,
    principalOutstanding: outstanding, capitalised: round2(capitalised),
    totalInterest, interestPaid, interestDue, excessInterest, penalDue, overdueDays, isOverdue,
    totalPayable: round2(outstanding + interestDue + penalDue),
    monthlyInterest: monthly, monthsPaid, monthsDue,
    paidUpTo: dayjs(loan.loan_date).add(monthsPaid, 'month').format('YYYY-MM-DD'),
    currentSlabEndsOn, nextSlabRate: nextSlab?.rate ?? null,
  };
};

/** Eligible loan from items + scheme LTV. Silver items use the silver rate. */
export const eligibility = ({ items = [], loanRate, silverRate, ltvPercent = 75, roundStep = 100 }) => {
  let gross = 0, stone = 0, net = 0, pcs = 0, value = 0, purityWt = 0, fine = 0;
  for (const it of items) {
    const g = num(it.gross_wt), s = num(it.stone_wt);
    const n = it.net_wt != null && it.net_wt !== '' ? num(it.net_wt) : Math.max(0, g - s);
    const purity = num(it.purity, 91.6);
    const rate = num(it.rate_per_gram, it.metal === 'SILVER' ? silverRate : loanRate);
    gross += g; stone += s; net += n; pcs += num(it.pcs, 1);
    value += n * rate * (purity / 91.6);
    purityWt += purity * n; fine += (n * purity) / 100;
  }
  const marketValue = round2(value);
  const eligible = Math.floor((marketValue * num(ltvPercent)) / 100 / (roundStep || 1)) * (roundStep || 1);
  return {
    gross_wt: Math.round(gross * 1000) / 1000, stone_wt: Math.round(stone * 1000) / 1000, net_wt: Math.round(net * 1000) / 1000,
    fine_wt: Math.round(fine * 1000) / 1000, total_pcs: pcs, avg_purity: net ? round2(purityWt / net) : 0, market_value: marketValue, eligible_amount: eligible,
  };
};
