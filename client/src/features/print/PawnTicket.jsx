import dayjs from 'dayjs';
import { amount, inWords, n, weight } from '@/lib/format';

/*
 * MyBook-style pawn ticket (Printer Setup -> Loan bill layout = "MyBook pawn ticket").
 * Customer copy + office copy on one A4. Pure component (no hooks).
 */
const NOTE = 'Note : Period fixed for redemption of Gold and Silver articles - 11 Months. If the pledger fails to redeem the articles or to pay interest within the agreed period of redemption, the articles will be auctioned without any notice and the pawner shall have no claim whatsoever.';
const words = (v) => `Rupees ${inWords(v).replace(/ Rupees Only$/, '')} Only`;

function Copy({ data, label }) {
  const { loan, items = [], company, settings, barcode } = data;
  const tot = items.reduce((s, i) => ({ g: s.g + n(i.gross_wt), l: s.l + n(i.stone_wt), w: s.w + n(i.net_wt) }), { g: 0, l: 0, w: 0 });
  // desktop: a reprint says ** DUPLICATE COPY ** in the Item Remark line
  const remark = [data.copy === 'DUPLICATE' ? '** DUPLICATE COPY **' : '', ...items.map((i) => i.remarks)].filter(Boolean).join(', ');
  return (
    <div className="border border-[#0f1e3c] border-t-4 text-black">
      <div className="flex items-start justify-between border-b-2 border-[#b8892b] px-5 py-3">
        <div>
          <p className="text-2xl font-extrabold uppercase text-[#0f1e3c]">{company.name}</p>
          <p className="text-[12px]">{[company.address1, company.address2, company.address3].filter(Boolean).join(', ')}</p>
          {(company.phone || company.mobile) && <p className="mt-2 text-[12px]">Ph: {company.phone || company.mobile}</p>}
        </div>
        <div className="text-right">
          <p className="inline-block rounded bg-[#0f1e3c] px-8 py-1 text-[13px] font-bold tracking-wide text-white">PAWN TICKET</p>
          <p className="mt-1 text-[11px] font-bold text-[#c0392b]">{label}</p>
          {barcode && <img src={barcode.src} alt="" className="ml-auto h-8" />}
          {barcode && <p className="text-[10px] tracking-wider">{barcode.text}</p>}
        </div>
      </div>
      <div className="px-5 pt-1 text-center">
        <p className="text-[11px] font-bold">SCHEDULE (C) MONEY LENDERS RULES</p>
        <p className="text-[9px]">Inventory of articles taken in pawn as provided in Sub-section (2) of Section 3 of the Act and referred to in Rule 25</p>
      </div>
      <div className="mx-5 mt-2 flex items-center justify-between rounded bg-[#e9eef5] px-3 py-1 text-[12px]">
        <p className="font-bold text-[#0f1e3c]">Loan No. <span className="ml-2 text-[15px] text-[#c0392b]">{loan.bill_no}</span></p>
        <p><b className="text-[#0f1e3c]">Date</b> <span className="ml-2">{dayjs(loan.loan_date).format('DD/MM/YYYY')}</span></p>
        <p className="font-bold text-[#0f1e3c]">Customer ID <span className="ml-2">{loan.customer_no}</span></p>
      </div>
      <div className="mx-5 mt-2 flex gap-4">
        <div className="flex-1 space-y-1 text-[12px]">
          <div className="flex gap-6">
            <div className="flex-1 border-b border-ink-300 pb-1"><p className="text-[8px] text-ink-500">NAME</p><p className="font-bold">{loan.customer_title ? `${loan.customer_title} ` : ''}{loan.customer_name}{loan.relation_name ? `  ${loan.relation_type || 'S/o'}  ${loan.relation_name}` : ''}</p></div>
            <div className="w-44 border-b border-ink-300 pb-1"><p className="text-[8px] text-ink-500">PHONE NO.</p><p className="font-bold">{loan.customer_phone}</p></div>
          </div>
          <div className="border-b border-ink-300 pb-1"><p className="text-[8px] text-ink-500">ADDRESS</p><p className="font-bold">{[loan.door_no, loan.street, loan.area, loan.city].filter(Boolean).join(', ') || '-'}</p></div>
          <p className="pt-1 text-right text-[9px] italic">The following articles pawned with me</p>
        </div>
        <div className="grid h-[72px] w-[60px] place-items-center overflow-hidden border border-ink-400 bg-ink-50 text-[7px] text-ink-500">
          {loan.customer_photo || loan.customer_photo_master ? <img src={loan.customer_photo || loan.customer_photo_master} alt="" className="size-full object-cover" /> : 'PHOTO'}
        </div>
      </div>
      <table className="mx-5 mt-1 w-[calc(100%-2.5rem)] border-collapse text-[12px]">
        <thead className="bg-[#0f1e3c] text-[10px] text-white"><tr><th className="px-2 py-1 text-left">METAL</th><th className="px-2 text-left">DESCRIPTION OF ARTICLES PLEDGED</th><th className="px-2 text-right">GROSS WT.</th><th className="px-2 text-right">LESS WT.</th><th className="px-2 text-right">NET WT.</th></tr></thead>
        <tbody>
          <tr className="align-top">
            <td className="border border-ink-300 px-2 py-1 font-bold">{[...new Set(items.map((i) => i.metal_code || loan.loan_on))].join(' / ')}</td>
            <td className="border border-ink-300 px-2 py-1">{items.map((i) => `${String(i.item_name).toUpperCase()} ${i.pcs}`).join(', ')}</td>
            <td className="border border-ink-300 px-2 py-1 text-right">{weight(tot.g)}</td>
            <td className="border border-ink-300 px-2 py-1 text-right">{weight(tot.l)}</td>
            <td className="border border-ink-300 px-2 py-1 text-right font-bold">{weight(tot.w)}</td>
          </tr>
          <tr><td colSpan={5} className="border border-ink-300 px-2 py-1 text-[10px] font-bold">Item Remark : <span className="font-normal">{remark}</span></td></tr>
        </tbody>
      </table>
      <div className="mx-5 mt-2 flex gap-3">
        <div className="w-40 rounded border-2 border-[#b8892b] bg-[#fdf8ec] px-2 py-1"><p className="text-[8px] font-bold text-[#b8892b]">LOAN AMOUNT</p><p className="text-[16px] font-extrabold">Rs. {amount(loan.principal).replace(/\.00$/, '')}/-</p></div>
        <div className="flex-1 rounded border border-ink-300 px-2 py-1"><p className="text-[8px] text-ink-500">IN WORDS</p><p className="text-[12px] font-bold italic">{words(loan.principal)}</p></div>
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-[#c0392b]">{settings.TICKET_INTEREST_NOTE || 'INTEREST SHOULD BE PAID EVERY THREE MONTHS'}</p>
      <p className="mx-5 text-[9px] leading-snug">{settings.TICKET_NOTE || NOTE}</p>
      <p className="mx-5 text-right text-[9px] italic">I declare that all the above mentioned are my own</p>
      <div className="mx-5 mt-8 flex justify-between pb-3 text-[9px]">
        <div className="w-56 text-center"><p className="text-left text-[12px]">☞</p><p className="border-b border-black pt-3 text-[10px] font-bold">{loan.branch_code || ''}</p><p className="pt-1">Signature of the pawn broker or his agent</p></div>
        <div className="w-56 text-center"><p className="text-left text-[12px]">☞</p><p className="border-b border-black pt-3 text-[10px] font-bold">&nbsp;</p><p className="pt-1">Signature or thumb impression of the pawner</p></div>
      </div>
    </div>
  );
}

export function PawnTicket({ data }) {
  return (
    <div className="mx-auto w-[194mm] space-y-4">
      <Copy data={data} label="CUSTOMER COPY" />
      <div className="border-t border-dashed border-ink-400" />
      <Copy data={data} label="PAWN BROKER COPY" />
    </div>
  );
}
