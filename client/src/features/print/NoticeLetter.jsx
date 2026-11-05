import { money, date, weight } from '@/lib/format';

const TYPE = { REMINDER: 'Reminder', FIRST: 'First Notice', SECOND: 'Second Notice', FINAL: 'Final Notice before Auction', AUCTION: 'Auction Intimation' };

/** Overdue / auction notice letters, one per page (registered post format). */
export function NoticeLetters({ loans, company, type = 'FIRST', auctionDate }) {
  return (
    <div className="mx-auto w-[190mm] text-[13px] text-black">
      {loans.map((l) => (
        <div key={l.id} className="page-break pb-6">
          <div className="border-b-2 border-black pb-2 text-center">
            <p className="text-xl font-extrabold text-[#c0392b]">{company.name}</p>
            <p className="text-[11px]">{[company.address1, company.address2, company.address3].filter(Boolean).join(', ')}</p>
            {company.licence_no && <p className="text-[11px]">Licence No: {company.licence_no}</p>}
          </div>
          <p className="mt-4 text-right">Date: {date(new Date())}</p>
          <p className="mt-2 font-bold">To,</p>
          <p>{l.customer_title} {l.customer_name}</p>
          {l.relation_name && <p>{l.relation_type} {l.relation_name}</p>}
          <p className="max-w-[90mm]">{l.address}</p>
          <p className="mt-4 text-center font-bold underline">{TYPE[type]} – Loan No {l.bill_no}</p>
          <p className="mt-4 leading-relaxed">
            Dear Sir / Madam, you have pledged gold ornaments weighing <b>{weight(l.net_wt)} g</b> ({l.item_summary}) with us on <b>{date(l.loan_date)}</b> against a loan of
            <b> {money(l.principal)}</b>. The loan became due on <b>{date(l.due_date)}</b> and an amount of <b>{money(l.total_due)}</b> (principal + interest + charges)
            is outstanding as on date.
          </p>
          <p className="mt-3 leading-relaxed">
            You are requested to repay the dues or renew the loan within 15 days from the receipt of this notice. Failing which the pledged ornaments will be sold in public
            auction{auctionDate ? <> on <b>{date(auctionDate)}</b></> : ''} as per the terms of the loan and applicable law, without further notice, at your risk and cost.
          </p>
          <p className="mt-10 text-right">For {company.name}</p>
          <p className="mt-10 text-right">Authorised Signatory</p>
        </div>
      ))}
    </div>
  );
}
