import clsx from 'clsx';
import { money, date, weight } from '@/lib/format';

const TYPE = { REMINDER: 'Reminder', FIRST: 'First Notice', SECOND: 'Second Notice', FINAL: 'Final Notice before Auction', AUCTION: 'Auction Intimation' };
export const NOTICE_FORMATS = [
  { value: 'LETTER', label: 'A4 letter' },
  { value: 'REGISTERED', label: 'Registered post (letter + ack card)' },
  { value: 'INLAND', label: 'Inland letter (fold & post)' },
];

const addressLines = (l) => [`${l.customer_title || ''} ${l.customer_name}`.trim(), l.relation_name && `${l.relation_type || ''} ${l.relation_name}`.trim(), l.address, l.area, l.customer_phone && `Ph: ${l.customer_phone}`].filter(Boolean);
const companyLine = (c) => [c.address1, c.address2, c.address3].filter(Boolean).join(', ');

function Body({ l, company, type, auctionDate, auctionTime }) {
  return (
    <>
      <p className="mt-3 text-center font-bold underline">{TYPE[type]} – Loan No {l.bill_no}</p>
      <p className="mt-3 leading-relaxed">
        Dear Sir / Madam, you have pledged gold ornaments weighing <b>{weight(l.net_wt)} g</b> ({l.item_summary}) with us on <b>{date(l.loan_date)}</b> against a loan of
        <b> {money(l.principal)}</b>. The loan became due on <b>{date(l.due_date)}</b> and an amount of <b>{money(l.total_due)}</b> (principal + interest + charges)
        is outstanding as on date.
      </p>
      <p className="mt-2 leading-relaxed">
        You are requested to repay the dues or renew the loan within 15 days from the receipt of this notice. Failing which the pledged ornaments will be sold in public
        auction{auctionDate ? <> on <b>{date(auctionDate)}{auctionTime ? ` at ${auctionTime}` : ''}</b></> : ''} as per the terms of the loan and applicable law, without further notice, at your risk and cost.
      </p>
      <p className="mt-8 text-right">For {company.name}</p>
      <p className="mt-8 text-right">Authorised Signatory</p>
    </>
  );
}

function Head({ company, small }) {
  return (
    <div className="border-b-2 border-black pb-2 text-center">
      <p className={clsx('font-extrabold text-[#c0392b]', small ? 'text-base' : 'text-xl')}>{company.name}</p>
      <p className="text-[11px]">{companyLine(company)}</p>
      {company.licence_no && <p className="text-[11px]">Licence No: {company.licence_no}</p>}
    </div>
  );
}

/** Overdue / auction notice letters, one per page: A4 letter, registered post with ack card, or inland letter. */
export function NoticeLetters({ loans, company, type = 'FIRST', auctionDate, auctionTime, format = 'LETTER' }) {
  return (
    <div className="mx-auto w-[190mm] text-[13px] text-black">
      {loans.map((l) => (
        <div key={l.id} className="page-break pb-6">
          {format === 'INLAND' ? (
            /* Inland letter: top half = address panel (outside after folding), bottom = message */
            <div className="border border-dashed border-black">
              <div className="grid h-[95mm] grid-cols-2 border-b border-dashed border-black">
                <div className="border-r border-dashed border-black p-4 text-[11px]">
                  <p className="font-bold">From:</p><p className="font-semibold">{company.name}</p><p>{companyLine(company)}</p>{company.phone && <p>Ph: {company.phone}</p>}
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-bold">To,</p>
                  {addressLines(l).map((x) => <p key={x} className="text-[14px] font-semibold">{x}</p>)}
                  <p className="mt-3 text-[11px]">PIN: ____________</p>
                </div>
              </div>
              <div className="p-4"><Head company={company} small /><p className="mt-2 text-right">Date: {date(new Date())}</p><Body l={l} company={company} type={type} auctionDate={auctionDate} auctionTime={auctionTime} /></div>
            </div>
          ) : (
            <>
              <Head company={company} />
              {format === 'REGISTERED' && <p className="mt-2 text-center text-[12px] font-bold tracking-wide">BY REGISTERED POST WITH ACKNOWLEDGEMENT DUE</p>}
              <p className="mt-3 text-right">Date: {date(new Date())}</p>
              <p className="mt-1 font-bold">To,</p>
              {addressLines(l).map((x) => <p key={x} className="max-w-[90mm]">{x}</p>)}
              <Body l={l} company={company} type={type} auctionDate={auctionDate} auctionTime={auctionTime} />
              {format === 'REGISTERED' && (
                /* Acknowledgement card to be pasted on the postal ack */
                <div className="mt-8 border-t border-dashed border-black pt-3 text-[11px]">
                  <p className="text-center font-bold">ACKNOWLEDGEMENT CARD – Loan No {l.bill_no}</p>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="border border-black p-2"><p className="font-bold">Addressee</p>{addressLines(l).map((x) => <p key={x}>{x}</p>)}</div>
                    <div className="border border-black p-2"><p className="font-bold">Return to</p><p className="font-semibold">{company.name}</p><p>{companyLine(company)}</p></div>
                  </div>
                  <p className="mt-2">Received the notice dated {date(new Date())} for Loan No {l.bill_no}. &nbsp; Signature: ____________________ &nbsp; Date: __________</p>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
