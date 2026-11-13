import QRCode from 'qrcode';
import { branchPhones, phonesText, letterhead, loanBranch } from '@/lib/branchInfo';
import JsBarcode from 'jsbarcode';
import dayjs from 'dayjs';
import { PawnTicket } from './PawnTicket';
import { LABELS } from './labels';
import { money, date, weight, n } from '@/lib/format';

/*
 * A4 loan bill matching the branch's printed format:
 *   page 1  : bill + interest slab table + jewel table + declarations + promissory note + receipt
 *   page 2  : terms & conditions (from Print settings)
 *   page 3  : acknowledge card (customer copy)
 * Pure component (no hooks) -> safe to render in the print iframe.
 */

const B = 'border border-black';
const td = `${B} px-2 py-1 align-middle`;

function Header({ company, qr }) {
  return (
    <div className={`${B} flex items-center gap-3 px-3 py-2`}>
      <div className="w-24 shrink-0">{company.logo_path && <img src={company.logo_path} alt="" className="max-h-20 w-full object-contain" />}</div>
      <div className="flex-1 text-center">
        <p className="text-[22px] leading-tight font-extrabold tracking-wide text-[#c0392b]">{company.name}</p>
        {company.licence_no && <p className="text-[11px] font-bold">Licence No.: {company.licence_no}</p>}
        <p className="mt-2 text-[10px] leading-snug">{[company.address1, company.address2].filter(Boolean).join(', ')}</p>
        {company.address3 && <p className="text-[10px] leading-snug">{company.address3}</p>}
        {(company.mobile || company.phone) && <p className="text-[10px]">Mobile Number: {[company.mobile, company.phone].filter(Boolean).join(', ')}</p>}
      </div>
      <div className="w-24 shrink-0 text-right">{qr && <img src={qr} alt="" className="ml-auto size-20" />}</div>
    </div>
  );
}

function InfoGrid({ L, d }) {
  const { loan } = d;
  const addr = [loan.door_no, loan.street, loan.area, loan.city, loan.pincode].filter(Boolean).join(', ');
  const k = `${td} font-bold text-[13px] w-[22%]`;
  const v = `${td} text-[13px]`;
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr><td className={k}>{L.branch}</td><td className={v}>{loan.branch_name}</td><td className={k}>{L.phone}</td><td className={v}>{phonesText(branchPhones(loan.branch_phones, loan.branch_phone))}</td></tr>
        <tr><td className={k}>{L.customerNo}</td><td className={v}>{loan.customer_no}</td><td className={k}>{L.date}</td><td className={v}>{date(loan.loan_date)}</td></tr>
        <tr><td className={k}>{L.name}</td><td className={v}>{loan.customer_title ? `${loan.customer_title} ` : ''}{loan.customer_name}</td><td className={k}>{L.loanNo}</td><td className={v}>{loan.bill_no}{loan.manual_bill_no ? ` (${loan.manual_bill_no})` : ''}</td></tr>
        <tr><td className={k} rowSpan={3}>{L.address}</td><td className={v} rowSpan={3}>{loan.relation_name ? `${loan.relation_type || ''} ${loan.relation_name}, ` : ''}{addr}</td><td className={k}>{L.scheme}</td><td className={v}>{loan.scheme_code}</td></tr>
        <tr><td className={k}>{L.dueDate}</td><td className={v}>{date(loan.due_date)}</td></tr>
        <tr><td className={k}>{L.amount}</td><td className={v}>{money(loan.principal)}</td></tr>
      </tbody>
    </table>
  );
}

function SlabTable({ L, d, showRate = true }) {
  const { loan, schemes, settings } = d;
  const list = schemes.length ? schemes : [{ ltv_percent: 75, slabs: loan.slabs_snapshot }];
  const parse = (s) => (typeof s === 'string' ? JSON.parse(s) : s) || [];
  const head = parse(list[0].slabs);
  const notes = String(settings.RECEIPT_NOTES || '').split('\n').filter(Boolean);
  const purity = n(loan.avg_purity) || 91.6;
  return (
    <div className="mt-2">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {showRate && <tr><td className={`${td} w-[35%] text-center text-[13px] font-bold`}>{L.interest}</td><td className={`${td} w-[14%] text-[13px]`}>{n(loan.interest_rate)}</td><td className="border-0" colSpan={3} /></tr>}
          <tr><td className={`${td} text-center font-bold`}>{L.goldQuality}</td><td className={`${td} text-center font-bold`} colSpan={head.length}>{L.rateTenure}</td></tr>
          <tr>
            <td className={`${td} text-center font-bold`}>{L.perGram(purity)}</td>
            {head.map((s, i) => <td key={i} className={`${td} text-center font-bold`}>{s.upto_months == null ? L.above(head[i - 1]?.upto_months ?? 0) : L.upto(s.upto_months)}</td>)}
          </tr>
          {list.map((s, i) => (
            <tr key={i}>
              <td className={`${td} text-center font-bold`}>{L.ltvRow(n(s.ltv_percent))}</td>
              {parse(s.slabs).map((x, j) => <td key={j} className={`${td} text-center`}>{n(x.rate)}%</td>)}
            </tr>
          ))}
          {notes.map((t, i) => <tr key={`n${i}`}><td className={`${td} text-[10.5px]`} colSpan={head.length + 1}>{t}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Jewels({ L, d, withAmount = true }) {
  const { loan, items } = d;
  const totalNet = items.reduce((s, i) => s + n(i.net_wt), 0) || 1;
  const perGram = n(loan.principal) / totalNet;
  const th = `${B} px-1.5 py-1 text-center text-[11px] font-bold leading-tight`;
  const c = `${B} px-1.5 py-0.5 text-[13px]`;
  return (
    <div className={`${B} mt-2 flex items-stretch gap-2 p-1`}>
      {/* customer photo: the one taken with this loan, else the customer's own photo */}
      <div className="w-24 shrink-0">{(loan.customer_photo || loan.customer_photo_master) && <img src={loan.customer_photo || loan.customer_photo_master} alt="" className="h-28 w-full object-cover" />}</div>
      <div className="flex-1 py-2">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>{L.item}</th><th className={th}>{L.gross}</th><th className={th}>{L.net}</th><th className={th}>{L.stone}</th><th className={th}>{L.pcs}</th>
              {withAmount && <><th className={th}>{L.amtPerGram}</th><th className={th}>{L.loanAmt}</th></>}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className={c}>{i.item_name}</td><td className={c}>{weight(i.gross_wt)}</td><td className={c}>{weight(i.net_wt)}</td><td className={c}>{weight(i.stone_wt)}</td><td className={c}>{i.pcs}</td>
                {withAmount && <><td className={c}>{money(perGram)}</td><td className={c}>{money((n(i.net_wt) / totalNet) * n(loan.principal))}</td></>}
              </tr>
            ))}
            {items.length > 1 && (
              <tr className="font-bold">
                <td className={c}>Total</td><td className={c}>{weight(loan.gross_wt)}</td><td className={c}>{weight(loan.net_wt)}</td><td className={c}>{weight(loan.stone_wt)}</td><td className={c}>{loan.total_pcs}</td>
                {withAmount && <><td className={c} /><td className={c}>{money(loan.principal)}</td></>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="w-24 shrink-0">{loan.item_photo && <img src={loan.item_photo} alt="" className="h-28 w-full object-cover" />}</div>
    </div>
  );
}

function Declarations({ L, d }) {
  return (
    <div className={`${B} mt-2`}>
      <div className="grid grid-cols-[58%_42%]">
        <p className="border-r border-black p-1.5 text-[10.5px] leading-snug">{L.sanction(date(d.loan.loan_date))}</p>
        <p className="p-1.5 text-[10.5px] leading-snug">{L.consent}</p>
      </div>
      <div className="grid h-20 grid-cols-[29%_29%_42%] border-t border-black text-center">
        <div className="flex items-end justify-center border-r border-black pb-1 text-[15px]">{L.manager}</div>
        <div className="flex items-end justify-center border-r border-black pb-1 text-[15px]">{L.accountant}</div>
        <div className="flex items-end justify-center pb-1 text-[15px] font-bold">{L.borrowerSign}</div>
      </div>
    </div>
  );
}

export function LoanReceipt({ data }) {
  if (data.settings?.LOAN_RECEIPT_LAYOUT === 'MYBOOK') return <PawnTicket data={data} />;
  const L = LABELS[data.settings.RECEIPT_LANG === 'en' ? 'en' : 'ta'];
  const { loan, company, settings, copy } = data;
  const terms = String(settings.RECEIPT_TERMS || '').split('\n').filter(Boolean);
  const footer = String(settings.RECEIPT_FOOTER || '').split('\n').filter(Boolean);
  // the branch's contact numbers on the acknowledge card (unless the footer already has a contact line)
  const contact = (company.phones || []).filter(Boolean);
  if (contact.length && !footer.some((f) => /தொடர்புக்கு|contact/i.test(f))) footer.push(`*${L.contact}: ${contact.join(', ')}`);

  return (
    <div className="tamil mx-auto w-[194mm] text-black">
      {/* ---------------- page 1 ---------------- */}
      <div className="page-break">
        {copy === 'DUPLICATE' && <p className="mb-1 text-right text-[10px] font-bold tracking-widest">DUPLICATE COPY</p>}
        <Header company={company} qr={data.qr} />
        <InfoGrid L={L} d={data} />
        <SlabTable L={L} d={data} />
        <Jewels L={L} d={data} />
        <Declarations L={L} d={data} />

        {settings.PRINT_PROMISSORY_NOTE !== '0' && (
          <div className={`${B} mt-2`}>
            <p className="border-b border-black py-1 text-center text-[15px] font-bold">{L.pronote}</p>
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                <tr><td className={`${td} w-[22%]`}>{L.interest}</td><td className={td}>{n(loan.interest_rate)} %</td><td className={`${td} w-[22%]`}>{L.date}</td><td className={td}>{date(loan.due_date)}</td></tr>
                <tr><td className={td}>{L.rupees}</td><td className={td} colSpan={3}>{money(loan.principal)}</td></tr>
              </tbody>
            </table>
            <p className="px-1.5 pt-1 text-[10.5px] leading-snug">{L.pronoteText(company.local_name || company.name)}</p>
            <p className="pt-6 pb-2 text-center text-[15px] font-bold">{L.borrowerSign2}</p>
          </div>
        )}

        <div className={`${B} mt-2`}>
          <p className="border-b border-black py-1 text-center text-[15px] font-bold">{L.receipt}</p>
          <p className="px-1.5 pt-1 text-[10.5px] leading-snug">{L.receiptText}</p>
          <p className="pt-6 pb-2 text-center text-[15px] font-bold">{L.borrowerSign2}</p>
        </div>
      </div>

      {/* ---------------- page 2: terms ---------------- */}
      {settings.PRINT_TERMS_PAGE !== '0' && terms.length > 0 && (
        <div className="page-break pt-2">
          <p className="mb-2 text-[13px] font-bold">{L.terms}</p>
          <ol className="space-y-1.5 text-[10.5px] leading-snug">
            {terms.map((t, i) => <li key={i}><b>{i + 1}.</b> {t.replace(/^\d+\.\s*/, '')}</li>)}
          </ol>
          <p className="mt-8 text-[12px] font-bold">{L.termsSign}</p>
        </div>
      )}

      {/* ---------------- page 3: acknowledge card ---------------- */}
      {settings.PRINT_ACK_CARD !== '0' && (
        <div className="pt-1">
          <p className="border-x border-t border-black py-1 text-center text-[15px] font-bold tracking-wider">{L.ack}</p>
          <Header company={company} qr={data.qr} />
          <InfoGrid L={L} d={data} />
          <SlabTable L={L} d={data} showRate={false} />
          <Jewels L={L} d={data} withAmount={false} />
          <Declarations L={L} d={data} />
          {footer.length > 0 && (
            <div className={`${B} border-t-0 px-1.5 py-1 text-[11px] leading-relaxed`}>
              {footer.map((f, i) => <p key={i}><span className="text-[#c0392b]">{f.startsWith('*') ? '*' : ''}</span>{f.replace(/^\*/, ' ')}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Prepare everything the receipt needs (incl. QR) before rendering in the print frame. */
export const buildLoanPrintData = async ({ full, company, settings, schemes, copy }) => {
  const qr = await QRCode.toDataURL(`LOAN:${full.loan.barcode || full.loan.bill_no}`, { margin: 0, width: 160 });
  const metalSchemes = (schemes || []).filter((s) => s.metal_id === full.loan.metal_id && s.is_active);
  const ordered = metalSchemes.sort((a, b) => n(a.ltv_percent) - n(b.ltv_percent));
  // pawn ticket barcode: loan no (8 digits) + month and year of the loan, like the desktop
  let barcode = null;
  try {
    const text = full.loan.barcode || `${String(full.loan.loan_no || full.loan.bill_no).replace(/\D/g, '').padStart(8, '0')}${dayjs(full.loan.loan_date).format('MMYYYY')}`;
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, { format: 'CODE128', height: 40, width: 1.6, displayValue: false, margin: 0 });
    barcode = { src: canvas.toDataURL('image/png'), text };
  } catch { /* no barcode */ }
  // desktop PMBN / SOBO: print the hand-written bill book no in place of the system loan no
  const bookOnly = (settings?.BILL_BOOK_ON_RECEIPT === '1' || settings?.BILL_BOOK_ONLY === '1') && full.loan.manual_bill_no;
  const loan = bookOnly ? { ...full.loan, bill_no: full.loan.manual_bill_no, manual_bill_no: null } : full.loan;
  return { loan, items: full.items, company: letterhead(company || {}, loanBranch(full.loan)), settings: settings || {}, schemes: ordered, qr, copy, barcode };
};
