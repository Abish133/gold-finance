import dayjs from 'dayjs';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 2 });

export const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const money = (v) => inr.format(n(v));
export const money0 = (v) => inr0.format(n(v));
export const amount = (v) => num2.format(n(v));
export const compact = (v) => `₹${compactFmt.format(n(v))}`;
export const weight = (v) => `${n(v).toFixed(3)}`;
export const grams = (v) => `${n(v).toFixed(3)} g`;
export const pct = (v) => `${n(v)}%`;
export const date = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—');
export const dateTime = (v) => (v ? dayjs(v).format('DD/MM/YYYY hh:mm A') : '—');
/* Working (billing) date: after Day End closes today, entries go on tomorrow's date (as the desktop app).
   The header keeps it up to date from /desk/billing-date; a saved value older than today is ignored. */
let workDay = (() => { try { return localStorage.getItem('gf.workDate'); } catch { return null; } })();
export const setWorkDate = (d) => {
  if (!d || d === workDay) return;
  workDay = d;
  try { localStorage.setItem('gf.workDate', d); } catch { /* private mode */ }
};
export const realToday = () => dayjs().format('YYYY-MM-DD');
export const today = () => { const t = realToday(); return workDay && workDay > t ? workDay : t; };
export const monthStart = () => dayjs(today()).startOf('month').format('YYYY-MM-DD');
export const round2 = (v) => Math.round(n(v) * 100) / 100;
export const round3 = (v) => Math.round(n(v) * 1000) / 1000;

export const formatCell = (value, type) => {
  switch (type) {
    case 'money': return amount(value);
    case 'weight': return weight(value);
    case 'date': return date(value);
    case 'datetime': return dateTime(value);
    case 'number': return value === null || value === undefined ? '' : String(value);
    default: return value ?? '';
  }
};

/** Indian-English words for amounts (receipts / promissory note) */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (x) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
const three = (x) => `${x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' : ''}` : ''}${x % 100 ? two(x % 100) : ''}`;
export const inWords = (value) => {
  let x = Math.floor(n(value));
  if (!x) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(x / 1e7); x %= 1e7;
  const lakh = Math.floor(x / 1e5); x %= 1e5;
  const thousand = Math.floor(x / 1e3); x %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (x) parts.push(three(x));
  return `${parts.join(' ')} Rupees Only`;
};
