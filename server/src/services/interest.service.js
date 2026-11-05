import dayjs from 'dayjs';
import { round2, roundTo, num } from '#utils/money.js';

/**
 * Pure interest engine (no DB). Used by release, interest receipt, renewal, reports and calculator.
 *
 * Scheme options
 *   rate_type  YEARLY  -> rate is % per annum   | MONTHLY -> rate is % per month
 *   calc_mode  DAYS    -> exact days            | MONTHS  -> months with half/full rounding
 *   slab_mode  FROM_LOAN_DATE -> slab reached applies to the whole period (as on the RJM receipt)
 *              STEPPED        -> every slab period is charged at its own rate
 *   slabs      [{ upto_months: 3, rate: 15 }, { upto_months: 6, rate: 18 }, ..., { upto_months: null, rate: 24 }]
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

/** Build principal timeline segments from transactions. */
const principalEvents = (loan, txns) => {
  const evts = txns
    .filter((t) => !t.is_void && ['DISBURSE', 'TOPUP', 'PART_PAYMENT'].includes(t.txn_type))
    .map((t) => ({ at: toTime(t.txn_date), delta: num(t.principal_amount) }))
    .sort((a, b) => a.at - b.at);
  if (!evts.length) evts.push({ at: toTime(loan.loan_date), delta: num(loan.principal) });
  return evts;
};

export const calculateInterest = ({ loan, scheme = {}, txns = [], asOf, options = {} }) => {
  const halfDays = num(options.monthRoundHalfDays, 15);
  const roundStep = num(options.roundInterestTo, 1);
  const rateType = loan.rate_type || scheme.rate_type || 'YEARLY';
  const calcMode = scheme.calc_mode || 'DAYS';
  const slabMode = scheme.slab_mode || 'FROM_LOAN_DATE';
  const minDays = num(scheme.min_days, 0);
  const graceDays = num(scheme.grace_days, 0);
  const slabs = parseSlabs(loan.slabs_snapshot ?? scheme.slabs, loan.interest_rate);

  const start = toTime(loan.loan_date);
  const end = toTime(asOf || new Date());
  const elapsedDays = Math.max(0, Math.round((end - start) / DAY_MS));
  const chargeDays = Math.max(elapsedDays, minDays);
  const monthsElapsed = Math.max(0, elapsedDays - graceDays) / 30;
  const currentSlab = slabFor(slabs, monthsElapsed);

  // principal per day segments [{from, days, principal}]
  const events = principalEvents(loan, txns);
  const segments = [];
  let principal = 0;
  let idx = 0;
  let cursor = start;
  const stop = start + chargeDays * DAY_MS;
  while (idx < events.length && events[idx].at <= cursor) principal += events[idx++].delta;
  while (cursor < stop) {
    const nextAt = idx < events.length ? Math.min(events[idx].at, stop) : stop;
    const days = Math.round((nextAt - cursor) / DAY_MS);
    if (days > 0 && principal > 0) segments.push({ fromDay: Math.round((cursor - start) / DAY_MS), days, principal: round2(principal) });
    cursor = nextAt;
    while (idx < events.length && events[idx].at <= cursor) principal += events[idx++].delta;
  }
  // apply events after charge window (e.g. part payment today) to get outstanding
  while (idx < events.length) principal += events[idx++].delta;
  const outstanding = round2(Math.max(0, principal));

  const perDayFactor = (rate) => (rateType === 'MONTHLY' ? rate / 100 / 30 : rate / 100 / 365);
  let gross = 0;
  let months = null;

  if (calcMode === 'MONTHS') {
    months = Math.max(billedMonths(loan.loan_date, dayjs(asOf).format('YYYY-MM-DD'), halfDays), minDays > 0 ? (minDays <= halfDays ? 0.5 : 1) : 0);
    const totalSegDays = segments.reduce((s, x) => s + x.days, 0) || 1;
    for (const seg of segments) {
      const segMonths = (months * seg.days) / totalSegDays;
      if (slabMode === 'STEPPED') {
        // walk each month of the segment
        let m0 = (months * seg.fromDay) / totalSegDays;
        let remaining = segMonths;
        while (remaining > 1e-9) {
          const slab = slabFor(slabs, m0 + 0.0001);
          const cap = slab.upto_months == null ? remaining : Math.min(remaining, Math.max(0.0001, slab.upto_months - m0));
          gross += seg.principal * monthlyRate(slab.rate, rateType) * cap;
          remaining -= cap; m0 += cap;
        }
      } else {
        gross += seg.principal * monthlyRate(currentSlab.rate, rateType) * segMonths;
      }
    }
  } else {
    for (const seg of segments) {
      if (slabMode === 'STEPPED') {
        for (let d = 0; d < seg.days; d++) {
          const slab = slabFor(slabs, (seg.fromDay + d) / 30 + 1e-9);
          gross += seg.principal * perDayFactor(slab.rate);
        }
      } else {
        gross += seg.principal * perDayFactor(currentSlab.rate) * seg.days;
      }
    }
  }

  const totalInterest = round2(roundTo(gross, roundStep));
  const paid = txns.filter((t) => !t.is_void);
  const interestPaid = round2(num(loan.advance_interest) + paid.reduce((s, t) => s + (['INTEREST', 'RELEASE', 'PART_PAYMENT', 'TOPUP'].includes(t.txn_type) ? num(t.interest_amount) : 0), 0));
  const interestDue = round2(Math.max(0, totalInterest - interestPaid));
  const excessInterest = round2(Math.max(0, interestPaid - totalInterest));

  // penal interest after due date (simple, never compounded)
  let penal = 0;
  let overdueDays = 0;
  if (num(scheme.penal_rate) > 0 && loan.due_date) {
    overdueDays = Math.max(0, Math.round((end - toTime(loan.due_date)) / DAY_MS) - graceDays);
    if (overdueDays > 0) penal = outstanding * (num(scheme.penal_rate) / 100 / 365) * overdueDays;
  }
  const penalPaid = paid.reduce((s, t) => s + num(t.penal_amount), 0);
  const penalDue = round2(Math.max(0, roundTo(penal, roundStep) - penalPaid));

  const isOverdue = loan.due_date ? end > toTime(loan.due_date) : false;
  const nextSlab = slabs.find((s) => s.upto_months != null && s.upto_months >= monthsElapsed && s !== currentSlab) || null;
  const nextSlabDate = currentSlab.upto_months != null ? dayjs(loan.loan_date).add(Math.round(currentSlab.upto_months * 30) + graceDays, 'day').format('YYYY-MM-DD') : null;

  return {
    asOf: dayjs(end).format('YYYY-MM-DD'),
    elapsedDays,
    chargeDays,
    months,
    monthsElapsed: round2(monthsElapsed),
    rate: currentSlab.rate,
    rateType,
    slabs,
    segments,
    principalOutstanding: outstanding,
    totalInterest,
    interestPaid,
    interestDue,
    excessInterest,
    penalDue,
    overdueDays,
    isOverdue,
    totalPayable: round2(outstanding + interestDue + penalDue),
    currentSlabEndsOn: nextSlabDate,
    nextSlabRate: nextSlab?.rate ?? null,
  };
};

function monthlyRate(rate, rateType) {
  return rateType === 'MONTHLY' ? rate / 100 : rate / 100 / 12;
}

/** Eligible loan from items + scheme LTV. */
export const eligibility = ({ items = [], loanRate, ltvPercent = 75, roundStep = 100 }) => {
  let gross = 0, stone = 0, net = 0, pcs = 0, value = 0, purityWt = 0;
  for (const it of items) {
    const g = num(it.gross_wt), s = num(it.stone_wt);
    const n = it.net_wt != null && it.net_wt !== '' ? num(it.net_wt) : Math.max(0, g - s);
    const purity = num(it.purity, 91.6);
    const rate = num(it.rate_per_gram, loanRate);
    gross += g; stone += s; net += n; pcs += num(it.pcs, 1);
    value += n * rate * (purity / 91.6);
    purityWt += purity * n;
  }
  const marketValue = round2(value);
  const eligible = Math.floor((marketValue * num(ltvPercent)) / 100 / (roundStep || 1)) * (roundStep || 1);
  return {
    gross_wt: Math.round(gross * 1000) / 1000,
    stone_wt: Math.round(stone * 1000) / 1000,
    net_wt: Math.round(net * 1000) / 1000,
    total_pcs: pcs,
    avg_purity: net ? round2(purityWt / net) : 0,
    market_value: marketValue,
    eligible_amount: eligible,
  };
};
