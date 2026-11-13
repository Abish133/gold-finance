import dayjs from 'dayjs';
import { rupees } from '@/lib/format';
import { api } from '@/lib/api';

/* WhatsApp templates from SMS / WhatsApp > Templates (loaded once after sign-in) */
let waTemplates = {};
let waShop = '';   // company name for {shop} (Masters > Company Information)
export const loadWaTemplates = async () => {
  try { const r = await api.get('/dashboard/wa-templates'); waTemplates = r.data || {}; waShop = r.shop || ''; } catch { /* keep the built-in texts */ }
};
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());

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
  const shop = waShop || settings?.COMPANY_NAME || '';
  const no = `${l.bill_no}${l.manual_bill_no ? ` / ${l.manual_bill_no}` : ''}`;
  // the period paid: "for 15 days" (by days) or "for 2 month(s)"
  const period = Number(txn?.interest_days) > 0 ? ` for ${Number(txn.interest_days)} days` : txn?.months_paid ? ` for ${txn.months_paid} month(s)` : '';
  const lines = {
    LOAN: `Dear ${l.customer_name}, your loan ${no} of Rs ${rupees(l.principal)} is given on ${dayjs(l.loan_date).format('DD/MM/YYYY')} (${l.item_summary || ''}). Settle before ${dayjs(l.due_date).format('DD/MM/YYYY')}.`,
    RELEASE: `Dear ${l.customer_name}, your loan ${no} is released on ${dayjs(txn?.txn_date).format('DD/MM/YYYY')}. Received Rs ${rupees(txn?.total_amount)}. Thank you.`,
    PART: `Dear ${l.customer_name}, received Rs ${rupees(txn?.total_amount)} on loan ${no}. Balance loan amount Rs ${rupees(l.current_principal)}.`,
    INTEREST: `Dear ${l.customer_name}, received interest Rs ${rupees(txn?.total_amount)} on loan ${no}${period}.`,
  }[kind];
  const tpl = waTemplates[{ LOAN: 'WA_NEW_LOAN', RELEASE: 'WA_RELEASE', PART: 'WA_PART_PAYMENT', INTEREST: 'WA_INTEREST' }[kind]];
  if (tpl) {
    const amt = kind === 'LOAN' ? l.principal : txn?.total_amount;
    const text = fill(tpl, {
      shop, name: l.customer_name, loan_no: no, amount: rupees(amt), items: l.item_summary || '', balance: rupees(l.current_principal),
      date: dayjs(kind === 'LOAN' ? l.loan_date : txn?.txn_date).format('DD/MM/YYYY'), due_date: l.due_date ? dayjs(l.due_date).format('DD/MM/YYYY') : '',
      months: period, period,
    }).replace(/^\s*\n/, '');   // no shop name -> no empty first line
    openWhatsApp(l.customer_phone, text);
    return;
  }
  openWhatsApp(l.customer_phone, `${shop ? `${shop}\n` : ''}${lines}`);
};
