/**
 * Branch letterhead: every branch has its own pawn broker licence and 1 to 5 contact numbers.
 * Bills, receipts, notices and reports print these in place of the company-level ones.
 */
export const MAX_PHONES = 5;

/** JSON / string / array -> clean list of numbers (falls back to the old single phone). */
export const branchPhones = (raw, fallback) => {
  let list = raw;
  if (typeof list === 'string') {
    const text = list;
    try { list = JSON.parse(text); } catch { list = null; }
    if (!Array.isArray(list)) list = text.split(','); // "9443300001" or "94433 00001, 04652 231122"
  }
  if (!Array.isArray(list)) list = [];
  list = list.map((p) => String(p ?? '').trim()).filter(Boolean);
  if (!list.length && fallback) list = [String(fallback).trim()];
  return [...new Set(list)].slice(0, MAX_PHONES);
};

export const phonesText = (list, sep = ', ') => (list || []).filter(Boolean).join(sep);

/** The branch of a loan row (from the loan query's branch_* columns). */
export const loanBranch = (loan) => (loan ? {
  id: loan.branch_id, code: loan.branch_code, name: loan.branch_name, licence_no: loan.branch_licence_no,
  phones: branchPhones(loan.branch_phones, loan.branch_phone), address: loan.branch_address, city: loan.branch_city, pincode: loan.branch_pincode,
} : null);

/**
 * Company merged with a branch: licence_no and phone numbers come from the branch
 * (company values are the fallback). The untouched company stays in `base`.
 */
export const letterhead = (company, branch) => {
  if (!company) return company;
  const base = company.base || company;
  if (!branch || branch.id === 'all') return { ...base, base, phones: branchPhones([base.mobile, base.phone]) };
  const phones = branchPhones(branch.phones, branch.phone);
  return {
    ...base,
    base,
    licence_no: branch.licence_no || base.licence_no,
    mobile: phones.length ? phonesText(phones) : base.mobile,
    phone: phones.length ? '' : base.phone,
    phones: phones.length ? phones : branchPhones([base.mobile, base.phone]),
    branch_id: branch.id, branch_name: branch.name, branch_code: branch.code,
  };
};
