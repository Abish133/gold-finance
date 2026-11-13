import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { amount, n, round2 } from '@/lib/format';
import { RATE_UNITS, ratePer, rateText, convertRate } from '@/lib/rateUnits';

/**
 * One interest control for every screen that takes interest: Auto (the figure the scheme / system works out)
 * or Manual - by Months, by Days or a typed Amount, at the loan's rate or a typed rate in any unit
 * (% a month, % a year, % a day, ₹ a day, ₹ a month - see lib/rateUnits).
 *
 *   const ic = useInterestChoice({ basis: 'DUE', calc, loan, txns, settings, resetKey: loan?.id });
 *   ic.interest  -> amount to use          ic.payload -> fields for the API (empty when Auto)
 *   <InterestChoice ic={ic} title="Interest" />
 *
 * basis 'DUE'     - settling the loan so far (Release, Re-loan, Counter): manual months / days cover the whole period
 *                   from the loan date, less interest already paid (advance included).
 * basis 'PAY'     - paying some interest now and keeping the loan (Counter interest / part / top-up): months / days being
 *                   paid now, from where the paid interest ends.
 * basis 'ADVANCE' - interest taken now for the coming period (advance at New Loan / Re-loan): nothing to take off.
 */

const MODE_LABEL = { AUTO: 'Auto', MONTHS: 'Months', DAYS: 'Days', AMOUNT: 'Amount', NONE: 'None' };

/** Re-loan: interest_rate is the new loan's rate, so a rate typed for the old loan's interest goes as old_interest_rate. */
export const oldInterest = ({ interest_rate: rate, interest_rate_unit: unit, ...rest }) => (rate == null ? rest : { ...rest, old_interest_rate: rate, old_interest_rate_unit: unit });

/** Loan rate % per month and the amount interest is worked on (MyBook: loan amount with top-ups, part payments do not lower it). */
export const rateInfo = (calc, loan, txns = []) => {
  if (!calc) return { loanRate: 0, base: 0, monthly: 0 };
  const loanRate = round2(calc.rateType === 'MONTHLY' ? n(calc.rate) : n(calc.rate) / 12);
  const partPaid = round2(txns.filter((t) => !t.is_void && t.txn_type === 'PART_PAYMENT').reduce((s, t) => s - n(t.principal_amount), 0));
  const base = calc.mode === 'MYBOOK' ? round2(n(calc.principalOutstanding) + partPaid) : n(calc.principalOutstanding);
  return { loanRate, base, monthly: n(calc.monthlyInterest) || Math.round((base * loanRate) / 100) };
};

export function useInterestChoice({
  basis = 'DUE', calc, loan, txns, settings, auto, autoLabel,
  monthly: monthlyIn, loanRate: rateIn, base: baseIn, defaultMonths, defaultDays,
  allowNone = false, defaultMode = 'AUTO', resetKey,
}) {
  const info = useMemo(() => rateInfo(calc, loan, txns), [calc, loan, txns]);
  const loanRate = rateIn ?? info.loanRate;
  const base = baseIn ?? info.base;
  const sysMonthly = monthlyIn ?? info.monthly;
  const minDays = n(settings?.INTEREST_MIN_DAYS);
  const autoMonths = defaultMonths ?? (!calc ? 1 : basis === 'PAY' ? Math.max(1, n(calc.monthsDue) - n(calc.monthsPaid)) : Math.max(1, n(calc.monthsDue)));
  const autoDays = defaultDays ?? (calc && basis === 'DUE' ? Math.max(1, n(calc.elapsedDays)) : 30);
  const [s, setS] = useState({ mode: defaultMode, months: autoMonths, days: '', amount: '', rate: '', unit: 'PM', touched: false });
  // a new loan / screen starts on Auto again
  useEffect(() => { setS({ mode: defaultMode, months: autoMonths, days: '', amount: '', rate: '', unit: 'PM', touched: false }); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // the rate counts as typed only once the user types it - until then the loan's own rate is used exactly
  // (the box shows it in the unit of the mode: % a month for Months, % a day for Days)
  const rateTyped = ['MONTHS', 'DAYS'].includes(s.mode) && s.touched && s.rate !== '' && n(s.rate) >= 0;
  const typed = rateTyped ? ratePer(base, s.rate, s.unit) : null;
  const monthly = typed ? typed.monthly : sysMonthly;
  const perDay = typed ? typed.perDay : monthly / 30;
  const paid = basis === 'DUE' && calc ? n(calc.interestPaid) : 0;
  const months = Math.max(0, Math.floor(n(s.months)));
  const days = Math.max(0, Math.floor(n(s.days)));
  const autoAmount = round2(auto ?? (calc ? n(calc.interestDue) : 0));

  let gross = 0;
  let interest = autoAmount;
  if (s.mode === 'NONE') interest = 0;
  else if (s.mode === 'MONTHS') { gross = round2(months * monthly); interest = round2(Math.max(0, gross - paid)); }
  else if (s.mode === 'DAYS') { gross = Math.round(perDay * days); interest = round2(Math.max(0, gross - paid)); }
  else if (s.mode === 'AMOUNT') interest = round2(Math.max(0, n(s.amount)));

  const manual = s.mode !== 'AUTO';
  const daysTooFew = s.mode === 'DAYS' && days > 0 && minDays > 0 && days < minDays;
  const reduced = basis === 'DUE' && manual ? round2(Math.max(0, autoAmount - interest)) : 0;
  const at = rateTyped ? ` at ${rateText(s.rate, s.unit)}` : '';
  const label = s.mode === 'MONTHS' ? `${months} month${months === 1 ? '' : 's'}${at}`
    : s.mode === 'DAYS' ? `${days} day${days === 1 ? '' : 's'}${at}`
      : s.mode === 'AMOUNT' ? 'typed amount' : s.mode === 'NONE' ? 'none' : autoLabel || 'auto';
  // PAY: the new paid-up date - from where the paid months end, plus the months / days paid now
  const paidFrom = basis === 'PAY' && calc && loan ? dayjs(loan.loan_date).add(n(calc.monthsPaid), 'month') : null;
  const upto = !paidFrom ? null : s.mode === 'MONTHS' ? paidFrom.add(months, 'month') : s.mode === 'DAYS' ? paidFrom.add(days, 'day') : null;
  const payload = !manual ? {} : {
    interest_amount: interest,
    ...(upto && interest > 0 ? { interest_upto: upto.format('YYYY-MM-DD') } : {}),
    ...(s.mode === 'DAYS' && days ? { interest_days: days } : {}),
    ...(s.mode === 'MONTHS' && basis !== 'DUE' ? { months_paid: months } : {}),
    ...(rateTyped ? { interest_rate: n(s.rate), interest_rate_unit: s.unit } : {}),
  };

  const set = (patch) => setS((x) => {
    const next = { ...x, ...patch };
    // switching to Days / Months: start from the period so far
    if (patch.mode === 'DAYS' && !x.days) next.days = String(Math.max(autoDays, minDays, 1));
    if (patch.mode === 'MONTHS' && !x.months) next.months = autoMonths;
    // until a rate is typed, the rate box follows the mode: Months -> % a month, Days -> % a day (the loan's rate in that unit)
    if (['MONTHS', 'DAYS'].includes(patch.mode) && !x.touched) {
      next.unit = patch.mode === 'DAYS' ? 'PD' : 'PM';
      next.rate = String(convertRate(loanRate, 'PM', next.unit, base));
    }
    // typing a rate makes it the rate of this entry
    if (patch.rate != null) next.touched = true;
    // another unit: the same money in the new unit (1.2% a month -> 0.04% a day -> 14.4% a year -> ₹20 a day on ₹50,000)
    if (patch.unit && patch.unit !== x.unit && patch.rate == null) {
      next.rate = String(convertRate(x.touched && x.rate !== '' ? x.rate : loanRate, x.touched && x.rate !== '' ? x.unit : 'PM', patch.unit, base));
    }
    return next;
  });
  // back to the loan's own rate
  const resetRate = () => setS((x) => ({ ...x, touched: false, unit: x.mode === 'DAYS' ? 'PD' : 'PM', rate: String(convertRate(loanRate, 'PM', x.mode === 'DAYS' ? 'PD' : 'PM', base)) }));
  const error = daysTooFew ? `At least ${minDays} days must be charged` : s.mode === 'DAYS' && !days ? 'Enter the number of days' : null;

  return {
    ...s, set, resetRate, basis, manual, interest, gross, paid, monthly, perDay, loanRate, rateTyped, base, reduced, autoAmount, autoLabel,
    label, payload, error, minDays, allowNone, modes: ['AUTO', 'MONTHS', 'DAYS', 'AMOUNT', ...(allowNone ? ['NONE'] : [])],
  };
}

const box = 'num h-8 w-full min-w-0 rounded-md border border-ink-200 bg-white px-2 text-center text-[15px] font-bold text-navy-900 outline-none [appearance:textfield] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * Interest rate box with its unit (% a month / % a year / % a day / ₹ a day / ₹ a month) and what it comes to.
 * Used in every Interest box and on Part Payment.
 */
export function RateField({ title = 'Interest', rate, unit = 'PM', typed, placeholder, onRate, onUnit, onReset, perDay, monthly, className, big, resetLabel = 'Use loan rate', idleLabel = 'loan rate - type to change' }) {
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="label">Interest rate</p>
        {typed ? <button type="button" className="text-[10px] font-bold text-amber-700 underline dark:text-amber-300" onClick={onReset}>{resetLabel}</button>
          : <span className="text-[10px] text-ink-400">{idleLabel}</span>}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`${title}: rate`} className={clsx(box, big && '!h-9 !text-lg', '!w-20 shrink-0', typed && '!border-amber-400 !bg-amber-50 dark:!bg-amber-950/30')}
          value={rate} placeholder={String(placeholder ?? '')} onChange={(e) => onRate(e.target.value)} onFocus={(e) => e.target.select()} />
        <select aria-label={`${title}: rate unit`} value={unit} onChange={(e) => onUnit(e.target.value)}
          className={clsx('h-8 min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-1 text-[12px] font-semibold text-ink-700 outline-none focus:border-emerald-500 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200', big && '!h-9', typed && '!border-amber-400 !bg-amber-50 dark:!bg-amber-950/30')}>
          {RATE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      {(perDay != null || monthly != null) && (
        <p className="num mt-0.5 text-[11px] text-ink-500" title="What this rate comes to">= ₹{amount(perDay)} a day · ₹{amount(monthly)} a month</p>
      )}
    </div>
  );
}

/** The control itself: mode switch, the inputs of the mode, and one summary line. */
export function InterestChoice({ ic, title = 'Interest', approvalLimit, disabled, className, hideSummary, rate = true }) {
  const showRate = rate && ['MONTHS', 'DAYS'].includes(ic.mode);
  return (
    <div className={clsx('rounded-md border border-ink-200 p-1.5 dark:border-ink-800', disabled && 'pointer-events-none opacity-60', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex-1 pl-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">{title}</span>
        <div className="flex" role="tablist" aria-label={`${title}: how to charge`}>
          {ic.modes.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={ic.mode === k} onClick={() => ic.set({ mode: k })}
              className={clsx('-ml-px h-7 border px-2 text-[11.5px] font-bold first:ml-0 first:rounded-l-md last:rounded-r-md',
                ic.mode === k ? (k === 'AUTO' ? 'relative z-10 border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'relative z-10 border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200')
                  : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{MODE_LABEL[k]}</button>
          ))}
        </div>
      </div>

      {ic.mode !== 'AUTO' && ic.mode !== 'NONE' && (
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)] items-end gap-1.5">
          {ic.mode === 'MONTHS' && (
            <div>
              <p className="label">{ic.basis === 'DUE' ? 'Months from loan date' : 'Months'}</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="One month less" onClick={() => ic.set({ months: Math.max(0, n(ic.months) - 1) })}><Minus className="size-3.5" /></Button>
                <input type="number" min="0" inputMode="numeric" aria-label={`${title}: months`} className={box} value={ic.months} onChange={(e) => ic.set({ months: e.target.value })} onFocus={(e) => e.target.select()} />
                <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="One month more" onClick={() => ic.set({ months: n(ic.months) + 1 })}><Plus className="size-3.5" /></Button>
              </div>
            </div>
          )}
          {ic.mode === 'DAYS' && (
            <div>
              <p className="label">{ic.basis === 'DUE' ? 'Days from loan date' : 'Days'}</p>
              <div className="flex flex-wrap items-center gap-1">
                <input type="number" min="0" inputMode="numeric" aria-label={`${title}: days`} className={clsx(box, '!w-16 shrink-0')} value={ic.days} onChange={(e) => ic.set({ days: e.target.value })} onFocus={(e) => e.target.select()} />
                {[7, 15, 30].map((x) => (
                  <Button key={x} size="sm" variant="outline" className="!h-8 min-w-8 flex-1 !shrink !px-1 text-[12px]" disabled={ic.minDays > 0 && x < ic.minDays} onClick={() => ic.set({ days: String(x) })}>{x}</Button>
                ))}
              </div>
            </div>
          )}
          {ic.mode === 'AMOUNT' && (
            <div>
              <p className="label">{ic.basis === 'DUE' ? 'Interest to take now (₹)' : 'Interest (₹)'}</p>
              <input type="number" min="0" aria-label={`${title}: amount`} className={clsx(box, '!text-right')} value={ic.amount} placeholder={String(ic.autoAmount)} onChange={(e) => ic.set({ amount: e.target.value })} onFocus={(e) => e.target.select()} />
            </div>
          )}
          {showRate && <RateField title={title} rate={ic.rate} unit={ic.unit} typed={ic.rateTyped} placeholder={ic.loanRate} perDay={ic.perDay} monthly={ic.monthly}
            onRate={(v) => ic.set({ rate: v })} onUnit={(u) => ic.set({ unit: u })} onReset={ic.resetRate} />}
        </div>
      )}

      {!hideSummary && (
        <div className="mt-1 space-y-0.5 px-1 text-[12px]">
          {['MONTHS', 'DAYS'].includes(ic.mode) && (
            <p className="flex justify-between gap-2 text-ink-500">
              <span>{ic.mode === 'MONTHS' ? `${n(ic.months)} × ₹${amount(ic.monthly)} a month` : `${n(ic.days)} days × ₹${amount(ic.perDay)} a day`}{ic.paid > 0 ? ` − paid ${amount(ic.paid)}` : ''}</span>
              <span className="num">{amount(ic.gross)}</span>
            </p>
          )}
          <p className="flex justify-between gap-2 font-bold text-navy-900 dark:text-white">
            <span>{ic.mode === 'AUTO' ? `Auto${ic.autoLabel ? ` · ${ic.autoLabel}` : ''}` : ic.mode === 'NONE' ? 'No interest' : `Manual · ${ic.label}`}</span>
            <span className="num">{amount(ic.interest)}</span>
          </p>
          {ic.manual && ic.mode !== 'NONE' && ic.autoAmount !== ic.interest && (
            <p className={clsx('flex justify-between gap-2', ic.reduced > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-500')}>
              <span>{ic.reduced > 0 ? `Less than auto (${amount(ic.autoAmount)})${approvalLimit ? ` · admin above ₹${approvalLimit}` : ''}` : `Auto would be ${amount(ic.autoAmount)}`}</span>
              {ic.reduced > 0 && <span className="num">− {amount(ic.reduced)}</span>}
            </p>
          )}
          {ic.error && <p className="font-semibold text-rose-600">{ic.error}</p>}
        </div>
      )}
    </div>
  );
}
