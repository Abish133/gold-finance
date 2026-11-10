import clsx from 'clsx';
import { money, date, weight, amount, today } from '@/lib/format';

const TYPE = { REMINDER: 'Reminder', FIRST: 'First Notice', SECOND: 'Second Notice', FINAL: 'Final Notice before Auction', AUCTION: 'Auction Intimation' };
export const NOTICE_FORMATS = [
  { value: 'MYBOOK', label: 'Desktop notice (one per customer)' },
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

/* Desktop notice (MyBook): one letter per customer with all the customer's loans in a table.
   FIRST = PRE-AUCTION NOTICE (ref FN/..), REGISTERED = AUCTION NOTICE (REGISTERED POST) with the auction date (ref RN/..). */
const oneLine = (l) => {
  const who = [`${l.customer_title || ''} ${l.customer_name}`.trim(), l.relation_name && `${l.relation_type || ''} ${l.relation_name}`.trim()].filter(Boolean).join(' ');
  const street = [l.door_no && `Door No ${l.door_no}`, l.street, l.customer_area, l.city].filter(Boolean).join(', ');
  return [[who, street || l.address].filter(Boolean).join(', '), l.pincode].filter(Boolean).join(' - ');
};
function DeskNotice({ group, company, registered, auctionDate, auctionTime }) {
  const l = group[0];
  const total = group.reduce((t, x) => t + Number(x.loan_amount ?? x.principal ?? 0), 0);
  const wt = group.reduce((t, x) => t + Number(x.net_wt || 0), 0);
  const dear = `${l.customer_title || ''} ${l.customer_name}`.trim();
  const when = auctionDate ? `${date(auctionDate)}${auctionTime ? ` at ${auctionTime}` : ''}` : '';
  const place = [company.name, company.address1].filter(Boolean).join(', ');
  return (
    <div className="page-break pb-6 text-[13px] leading-relaxed text-black">
      <div className="border-b-4 border-double border-[#1f3a5f] pb-2 text-center">
        <p className="text-2xl font-bold text-[#1f3a5f]">{company.name}</p>
        <p>{companyLine(company)}</p>
        {(company.phone || company.mobile) && <p>Ph: {company.mobile || company.phone}</p>}
      </div>
      <div className="mt-3 flex justify-between"><span>Ref No: {registered ? 'RN' : 'FN'}/{l.bill_no}</span><span>Date: {date(today())}</span></div>
      <div className="mt-2 flex gap-6"><span className="font-bold">To:</span><span>{oneLine(l)}</span></div>
      <p className="mt-3 text-center text-lg font-bold text-[#1f3a5f]">{registered ? 'AUCTION NOTICE (REGISTERED POST)' : 'PRE-AUCTION NOTICE'}</p>
      <p className="mt-2 font-bold">Dear {dear},</p>
      {registered ? (<>
        <p>In spite of our earlier notice, you have not redeemed the articles pledged by you, listed below. Notice is hereby given that these articles will be sold by public auction{when ? ` on ${when}` : ''} at {place}.</p>
        <p className="mt-1">You may redeem the articles before the auction by paying the principal, interest and charges. Any surplus after the sale will be paid to you; any shortfall will be recovered from you.</p>
      </>) : (<>
        <p>The loan period of the articles pledged by you with us, listed below, has expired and interest is pending. You are requested to pay the interest and either renew or redeem your articles within 15 days of receiving this notice.</p>
        <p className="mt-1">If you fail to do so, we shall be compelled to sell the pledged articles by auction, as per the terms of the pledge and the law in force, without any further notice. Any shortfall after the sale will be recovered from you.</p>
      </>)}
      <div className="mt-2 flex gap-10 border-y border-black py-2"><span className="font-bold">Note :</span><span>If you find it difficult to redeem the articles mentioned in this notice, please come and meet us in person.</span></div>
      <table className="mt-3 w-full">
        <thead className="bg-[#d5dccf]"><tr><th className="px-2 py-1 text-left">Loan No</th><th className="px-2 text-left">Pledge Date</th><th className="px-2 text-right">Loan Amount</th><th className="px-2 text-left">Items</th><th className="px-2 text-right">Net Wt (g)</th></tr></thead>
        <tbody>{group.map((x) => <tr key={x.id} className="border-b border-ink-200"><td className="px-2 py-1">{x.bill_no}</td><td className="px-2">{date(x.loan_date)}</td><td className="px-2 text-right">{amount(x.loan_amount ?? x.principal)}</td><td className="px-2 uppercase">{x.items_text || x.item_summary}</td><td className="px-2 text-right">{weight(x.net_wt)}</td></tr>)}</tbody>
        <tfoot className="bg-ink-50 font-bold"><tr><td className="px-2 py-1" colSpan={2}>Total</td><td className="px-2 text-right">{amount(total)}</td><td /><td className="px-2 text-right">{weight(wt)}</td></tr></tfoot>
      </table>
      <p className="mt-3 font-bold">Please bring the Pawn Ticket with you</p>
      {registered
        ? (when && <p className="mt-3 border-2 border-[#c9a227] bg-[#faf3e3] py-2 text-center text-base font-bold">Auction on {when}</p>)
        : <p className="mt-2 text-right font-bold">Note: Last Final Notice</p>}
      <p className="mt-6 text-right font-bold">For {company.name}</p>
      <p className="mt-10 ml-auto w-[80mm] border-t border-black pt-1 text-right">Authorised Signatory</p>
    </div>
  );
}

/** Overdue / auction notice letters: desktop notice (one per customer), A4 letter, registered post with ack card, or inland letter. */
export function NoticeLetters({ loans, company, type = 'FIRST', auctionDate, auctionTime, format = 'LETTER' }) {
  if (format === 'MYBOOK' || format === 'MYBOOK_REGISTERED') {
    const groups = Object.values(loans.reduce((a, l) => { (a[l.customer_id || l.customer_name] ||= []).push(l); return a; }, {}));
    return <div className="mx-auto w-[190mm]">{groups.map((g) => <DeskNotice key={g[0].id} group={g} company={company} registered={format === 'MYBOOK_REGISTERED'} auctionDate={auctionDate} auctionTime={auctionTime} />)}</div>;
  }
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
