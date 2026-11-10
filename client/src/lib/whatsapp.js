import dayjs from 'dayjs';
import { amount } from '@/lib/format';

/** Opens WhatsApp (web or app) with the message typed in, for an Indian 10-digit mobile number. */
export const openWhatsApp = (phone, text) => {
  const no = String(phone || '').replace(/\D/g, '').slice(-10);
  if (no.length !== 10) return false;
  window.open(`https://wa.me/91${no}?text=${encodeURIComponent(text)}`, '_blank');
  return true;
};

/**
 * Desktop "WhatsApp: New loan / Release / Part payment / Interest paid" (System Control > Messages):
 * after saving, WhatsApp opens with the message ready for the customer. kind = LOAN | RELEASE | PART | INTEREST
 */
export const whatsappAfterSave = (settings, kind, full, txn) => {
  const key = { LOAN: 'WA_ON_NEW_LOAN', RELEASE: 'WA_ON_RELEASE', PART: 'WA_ON_PART_PAYMENT', INTEREST: 'WA_ON_INTEREST' }[kind];
  if (!key || settings?.[key] !== '1' || !full?.loan) return;
  const l = full.loan;
  const shop = settings?.COMPANY_NAME || '';
  const no = `${l.bill_no}${l.manual_bill_no ? ` / ${l.manual_bill_no}` : ''}`;
  const lines = {
    LOAN: `Dear ${l.customer_name}, your loan ${no} of Rs ${amount(l.principal)} is given on ${dayjs(l.loan_date).format('DD/MM/YYYY')} (${l.item_summary || ''}). Settle before ${dayjs(l.due_date).format('DD/MM/YYYY')}.`,
    RELEASE: `Dear ${l.customer_name}, your loan ${no} is released on ${dayjs(txn?.txn_date).format('DD/MM/YYYY')}. Received Rs ${amount(txn?.total_amount)}. Thank you.`,
    PART: `Dear ${l.customer_name}, received Rs ${amount(txn?.total_amount)} on loan ${no}. Balance loan amount Rs ${amount(l.current_principal)}.`,
    INTEREST: `Dear ${l.customer_name}, received interest Rs ${amount(txn?.total_amount)} on loan ${no}${txn?.months_paid ? ` for ${txn.months_paid} month(s)` : ''}.`,
  }[kind];
  openWhatsApp(l.customer_phone, `${shop ? `${shop}\n` : ''}${lines}`);
};
