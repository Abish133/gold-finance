// Figures read off MyBook's own Interest Calculation screen (@Test company), loans pledged 05/01/2025.
// L2: ₹12,345 @1.5% p.m. compound, advance ₹185 · L3: same, flat · L4: ₹25,000 @2% p.m. compound, no advance.
export const MYBOOK_LOANS = {
  L2: { principal: 12345, interest_rate: 1.5, interest_type: 'COMPOUND', advance_interest: 185 },
  L3: { principal: 12345, interest_rate: 1.5, interest_type: 'SIMPLE', advance_interest: 185 },
  L4: { principal: 25000, interest_rate: 2, interest_type: 'COMPOUND', advance_interest: 0 },
};
export const PLEDGED = '2025-01-05';
// [interest up to, months shown, L2 due, L3 due, L4 due]
export const MYBOOK_CASES = [
  ['2025-01-05', 1, 0, 0, 500],
  ['2025-01-12', 1, 0, 0, 500],
  ['2025-02-05', 1, 0, 0, 500],
  ['2025-02-06', 2, 185, 185, 1000],
  ['2025-02-20', 2, 185, 185, 1000],
  ['2025-04-05', 3, 371, 370, 1500],
  ['2025-12-06', 12, 2037, 2035, 6000],
  ['2026-01-05', 12, 2037, 2035, 6000],
  ['2026-01-06', 13, 2256, 2220, 6620],
  ['2026-03-05', 14, 2474, 2405, 7240],
  ['2026-11-05', 22, 4222, 3885, 12200],
  ['2027-01-05', 24, 4659, 4255, 13440],
  ['2027-01-06', 25, 4917, 4440, 14209],
  ['2027-06-05', 29, 5948, 5180, 17284],
];

// after payments on 05/11/2026: L2 paid 3 months interest (₹555); L4 paid ₹5,000 part amount
// [interest up to, L2 due, L4 interest due, L4 total due]
export const MYBOOK_AFTER_PAYMENTS = [
  ['2026-11-05', 3667, 12200, 32200],
  ['2026-11-06', 3886, 12820, 32820],
  ['2027-01-05', 4104, 13440, 33440],
  ['2027-01-06', 4362, 14209, 34209],
  ['2027-06-05', 5393, 17284, 37284],
];
// ₹12,375 @1.5% p.m. pledged 05/01/2025, as on 05/11/2026: monthly & advance ₹186, compound ₹4,232, flat ₹3,906
export const MYBOOK_ROUNDING = { principal: 12375, advance: 186, compound: 4232, flat: 3906, asOf: '2026-11-05' };
// item value: fine weight x 100% rate, nearest ₹100 - [net, purity, rate, value]
export const MYBOOK_VALUES = [[10, 91.6, 7900, 72400], [9.99, 91.6, 7900, 72300], [9.5, 91.6, 7900, 68700]];
