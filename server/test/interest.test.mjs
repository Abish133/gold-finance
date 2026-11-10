// MyBook interest rules: our engine against figures read off the desktop app (no server needed).
import { calculateInterest, itemValue } from '#services/interest.service.js';
import { MYBOOK_LOANS, MYBOOK_CASES, PLEDGED, MYBOOK_AFTER_PAYMENTS, MYBOOK_ROUNDING, MYBOOK_VALUES } from './mybook-interest.cases.mjs';

const scheme = { calc_mode: 'MYBOOK', rate_type: 'MONTHLY' };
const fails = [];
const calc = (l, asOf, txns = []) => calculateInterest({ loan: { ...l, loan_date: PLEDGED, rate_type: 'MONTHLY', due_date: '2026-01-05' }, scheme, txns, asOf, options: { graceDays: 0 } });
const eq = (got, exp, what) => { if (Math.abs(got - exp) > 0.5) fails.push(`${what}: ours ${got}, MyBook ${exp}`); };

for (const [d, m, ...exp] of MYBOOK_CASES) {
  Object.values(MYBOOK_LOANS).forEach((l, i) => { const c = calc(l, d); eq(c.interestDue, exp[i], `L${i + 2} ${d}`); eq(c.months, m, `L${i + 2} months ${d}`); });
}
for (const [d, l2, l4i, l4t] of MYBOOK_AFTER_PAYMENTS) {
  eq(calc(MYBOOK_LOANS.L2, d, [{ txn_type: 'INTEREST', txn_date: '2026-11-05', interest_amount: 555, principal_amount: 0 }]).interestDue, l2, `L2 after interest ${d}`);
  const c4 = calc(MYBOOK_LOANS.L4, d, [{ txn_type: 'PART_PAYMENT', txn_date: '2026-11-05', interest_amount: 0, principal_amount: -5000 }]);
  eq(c4.interestDue, l4i, `L4 interest after part payment ${d}`); eq(c4.totalPayable, l4t, `L4 total after part payment ${d}`);
}
const R = MYBOOK_ROUNDING;
const rc = calc({ principal: R.principal, interest_rate: 1.5, interest_type: 'COMPOUND', advance_interest: R.advance }, R.asOf);
eq(rc.monthlyInterest, R.advance, 'monthly interest 12375'); eq(rc.interestDue, R.compound, 'compound 12375');
eq(calc({ principal: R.principal, interest_rate: 1.5, interest_type: 'SIMPLE', advance_interest: R.advance }, R.asOf).interestDue, R.flat, 'flat 12375');
for (const [net, pur, rate, v] of MYBOOK_VALUES) eq(itemValue(net, pur, rate, 100), v, `item value ${net} g`);

const n = MYBOOK_CASES.length * 6 + MYBOOK_AFTER_PAYMENTS.length * 3 + 3 + MYBOOK_VALUES.length;
console.log(fails.length ? `FAILED ${fails.length} of ${n}:\n${fails.join('\n')}` : `ALL ${n} MYBOOK FIGURES MATCH`);
if (fails.length) process.exitCode = 1;
