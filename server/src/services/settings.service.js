import { query, queryOne } from '#config/db.js';

/**
 * Settings are key/value with branch override: branch row wins over global (branch_id = 0).
 * DEFAULTS documents every key the app understands.
 */
export const DEFAULTS = {
  // numbering
  LOAN_NO_RESET_YEARLY: '0',
  LOAN_NO_FORMAT: '{PREFIX}{NO}',          // tokens: {PREFIX} {NO} {FY} {BRANCH}
  RECEIPT_PREFIX: 'R',
  // loan rules
  ROUND_LOAN_TO: '100',
  ROUND_INTEREST_TO: '1',
  ALLOW_LOAN_ABOVE_ELIGIBLE: '0',
  BLOCK_LOAN_FOR_BLOCKED_CUSTOMER: '1',
  MONTH_ROUND_HALF_DAYS: '15',             // MONTHS calc: extra days <= this count as half month (0 = always full)
  CANCEL_SAME_DAY_ONLY: '1',
  REQUIRE_TODAY_RATE: '1',               // no new loan until today's gold/silver rate is entered
  COMPOUND_PERIOD_MONTHS: '12',          // compound interest: unpaid interest added to base every N months
  DISCOUNT_APPROVAL_LIMIT: '500',        // discount above this needs admin approval (0 = off)
  TOPUP_WITHIN_DAYS: '3',                // top-up allowed only within N days of loan (0 = always)
  DEFAULT_INTEREST_TYPE: 'COMPOUND',
  DEFAULT_ADVANCE_INTEREST: '1',         // deduct first month's interest when the loan is given
  DEFAULT_INTEREST_RATE: '1',            // day-wise interest default rate (number)
  ALLOW_BACKDATE_BILLING: '1',           // billing date can be set before today (permission still needed)
  LTV_SAFE_PERCENT: '75',                // new loan: up to this % of item value shown green
  LTV_WARN_PERCENT: '85',                // new loan: above this % asks before save
  OLD_LOAN_WARN_MONTHS: '12',            // warn when customer has a loan open longer than this
  AUCTION_OVERDUE_MONTHS: '12',          // auction list / interest calculator mark older loans
  STOCK_RISK_MARGIN: '10',               // stock analysis: margin below this % = at-risk loan
  RELEASE_GRACE_DAYS: '0',               // extra days after full months not charged
  PRINT_LOAN_RECEIPT_COPIES: '1',
  PRINT_LOAN_RECEIPT_PAPER: 'A4',
  PRINT_RELEASE_RECEIPT_COPIES: '1',
  PRINT_RELEASE_RECEIPT_PAPER: 'A5',
  PRINT_PART_RECEIPT_COPIES: '1',
  PRINT_PART_RECEIPT_PAPER: 'A5',
  PRINT_NOTICE_PAPER: 'A4',
  PRINT_REPORT_PAPER: 'A4',
  PRINT_DAYEND_PAPER: 'A4',
  PRINT_STICKER_PAPER: 'A4', PRINT_STICKER_COPIES: '1',
  PRINT_STICKER_THERMAL_PAPER: '58mm roll', PRINT_STICKER_THERMAL_COPIES: '1',
  HOME_SHOW_CHARTS: '1',
  HOME_SHOW_DUE_SOON: '1',
  EMP_LEAVE_PER_YEAR: '12',
  BACKGROUND_IMAGE: '',
  STICKER_FIELDS: 'company,bill_no,barcode,name,date,weight,pcs,amount',
  STICKER_COLUMNS: '3',
  STICKER_GAP_MM: '2',
  DEFAULT_TENURE_MONTHS: '12',
  // auction
  AUCTION_AFTER_DAYS_OVERDUE: '30',
  NOTICE_POSTAGE: '50',
  // print
  RECEIPT_LANG: 'ta',
  LOAN_RECEIPT_LAYOUT: 'PDF',              // PDF = branch bill (default) | MYBOOK = desktop pawn ticket
  RECEIPT_COPIES: 'customer,office',
  PRINT_TERMS_PAGE: '1',
  PRINT_ACK_CARD: '1',
  PRINT_PROMISSORY_NOTE: '1',
  RECEIPT_FOOTER: '* வேலை நேரம்: காலை 9:30 மணி முதல் மாலை 5:30 மணி வரை. நகை திருப்பும் நேரம்: காலை 10 மணி முதல் மாலை 3:30 வரை.\n*ஞாயிறு விடுமுறை.',
  RECEIPT_TERMS: '',
  RECEIPT_NOTES:
    'காலக்கெடு கடன் பெற்ற தேதியிலிருந்து கணக்கிடப்படுகிறது. குறைந்தபட்சம் 7 நாள் வட்டி பொருந்தும்.\nமேற்குறிப்பிட்டுள்ள நாட்களுக்குள் பெற்றுள்ள கடனை புதுப்பிக்கவோ / திருப்பவோ செய்யாவிட்டால் வட்டி விகிதம் கடன் தேதியிலிருந்து மாறுபடும்.\nஒவ்வொரு மாத இறுதியிலும் வட்டி விகிதம் கடன் தொகையுடன் சேர்க்கப்படும் அபராத வட்டிக்கு கூட்டு வட்டி கிடையாது.',
  STICKER_WIDTH_MM: '50',
  STICKER_HEIGHT_MM: '25',
  // messaging
  SMS_ENABLED: '0',
  SMS_PROVIDER_URL: '',                    // e.g. https://api.example.com/send?to={phone}&msg={message}&key=XXX
  SMS_ON_NEW_LOAN: '1',
  SMS_ON_RELEASE: '1',
  SMS_ON_INTEREST: '1',
  SMS_ON_DUE_REMINDER: '1',
  SMS_AUTO_REMINDER: '0',                  // daily due-reminder job
  SMS_REMINDER_TIME: '10:00',
  SMS_REMINDER_MONTHS: '3',                // no interest paid for this many months
  SMS_REMINDER_OVERDUE: '1',               // also remind loans past the settle-before date
  SMS_REMINDER_GAP_DAYS: '15',             // do not remind the same loan again within these days
  // auto backup (server folder)
  AUTO_BACKUP_ENABLED: '1',
  AUTO_BACKUP_TIME: '21:00',
  AUTO_BACKUP_KEEP: '30',
  SETUP_DONE: '{}',                       // Getting Started checklist: steps marked done / skipped
  // Tally export
  TALLY_HOST: 'localhost',
  TALLY_PORT: '9000',
  TALLY_COMPANY: '',
  TALLY_VCH_PREFIX: 'GF',
  TALLY_LEDGER_MAP: '{}',
  // day control
  ENFORCE_DAY_CLOSE: '1',
};

export const getSettings = async (branchId = 0) => {
  const rows = await query(
    'SELECT branch_id, setting_key, setting_value FROM settings WHERE branch_id IN (0, :b) ORDER BY branch_id',
    { b: branchId || 0 },
  );
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.setting_key] = r.setting_value; // branch rows come last -> override
  return out;
};

export const getSetting = async (key, branchId = 0) => {
  const row = await queryOne(
    'SELECT setting_value FROM settings WHERE setting_key = :k AND branch_id IN (0, :b) ORDER BY branch_id DESC LIMIT 1',
    { k: key, b: branchId || 0 },
  );
  return row ? row.setting_value : DEFAULTS[key];
};

export const saveSettings = async (values, branchId = 0) => {
  const entries = Object.entries(values);
  if (!entries.length) return;
  const placeholders = entries.map((_, i) => `(:b, :k${i}, :v${i})`).join(',');
  const params = { b: branchId || 0 };
  entries.forEach(([k, v], i) => { params[`k${i}`] = k; params[`v${i}`] = v == null ? null : String(v); });
  await query(
    `INSERT INTO settings (branch_id, setting_key, setting_value) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    params,
  );
};

export const getCurrentFy = async (db = { queryOne }) => {
  const fy = await db.queryOne('SELECT * FROM financial_years WHERE is_current = 1 LIMIT 1');
  if (!fy) throw new Error('No current financial year configured');
  return fy;
};
