import { money, amount, weight, date, n } from '@/lib/format';

const companyLine = (c = {}) => [c.address1, c.address2, c.address3].filter(Boolean).join(', ');

/** Shop header used by the A4 sheets below. */
export function SheetHead({ company = {}, title, subtitle }) {
  return (
    <div className="mb-3 border-b-2 border-black pb-2 text-center">
      <p className="text-lg font-extrabold">{company.name}</p>
      <p className="text-[11px]">{companyLine(company)}</p>
      {(company.licence_no || company.mobile || company.phone) && <p className="text-[11px]">{[company.licence_no && `Licence No: ${company.licence_no}`, (company.mobile || company.phone) && `Ph: ${[company.mobile, company.phone].filter(Boolean).join(', ')}`].filter(Boolean).join(' · ')}</p>}
      <p className="mt-1 text-[13px] font-bold uppercase">{title}</p>
      {subtitle && <p className="text-[11px]">{subtitle}</p>}
    </div>
  );
}

/** Loan estimate / quotation given to the customer before the loan is saved. */
export function LoanEstimate({ company, customer, scheme, items, rates, values: v }) {
  return (
    <div className="mx-auto w-[190mm] text-[12px] text-black">
      <SheetHead company={company} title="Loan Estimate" subtitle={`Date: ${date(new Date())} · This is only an estimate, not a loan receipt`} />
      {customer && <p className="mb-2"><b>Customer:</b> {customer.name} {customer.phone ? `· ${customer.phone}` : ''}</p>}
      <table className="w-full border-collapse">
        <thead><tr>{['#', 'Item', 'Pcs', 'Gross', 'Stone', 'Net', 'Purity', 'Value'].map((h) => <th key={h} className="border border-black bg-gray-100 px-1 py-0.5 text-left">{h}</th>)}</tr></thead>
        <tbody>{items.map((i, k) => (
          <tr key={i.key || k}>
            <td className="border border-black px-1">{k + 1}</td><td className="border border-black px-1">{i.item_name}</td><td className="border border-black px-1 text-right">{i.pcs}</td>
            <td className="border border-black px-1 text-right">{weight(i.gross_wt)}</td><td className="border border-black px-1 text-right">{weight(i.stone_wt)}</td>
            <td className="border border-black px-1 text-right">{weight(i.net_wt)}</td><td className="border border-black px-1 text-right">{n(i.purity)}</td><td className="border border-black px-1 text-right">{amount(i.value)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1">
        {[['Scheme', scheme ? `${scheme.code} · ${scheme.name}` : '-'], ['Loan on', v.loanOn], ['Gold rate / g', rates.gold ? amount(rates.gold) : '-'], ['Silver rate / g', rates.silver ? amount(rates.silver) : '-'],
          ['Item value', money(v.value)], ['Eligible amount', money(v.eligible)], ['Loan amount', money(v.principal)], ['Loan to value', `${n(v.ltv).toFixed(1)}%`],
          ['Interest rate', `${v.rate}% ${scheme?.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'}`], ['Interest / month', money(v.perMonth)], ['Document charges', money(v.doc)], ['Advance interest', money(v.advance)],
          ['Due date', v.due ? date(v.due) : '-'], ['Amount in hand', money(v.netPay)]].map(([k, x]) => (
          <div key={k} className="flex justify-between border-b border-gray-300 py-0.5"><span>{k}</span><b>{x}</b></div>
        ))}
      </div>
      <p className="mt-6 text-[10px]">Rates and eligibility are as on today and may change. Valid for today only.</p>
      <p className="mt-8 text-right">For {company?.name}</p>
    </div>
  );
}

/** Full details sheet (customer / employee) with photo and grouped fields. */
export function DetailsSheet({ company, title, photo, groups, tables = [] }) {
  return (
    <div className="mx-auto w-[190mm] text-[12px] text-black">
      <SheetHead company={company} title={title} subtitle={`Printed on ${date(new Date())}`} />
      <div className="flex gap-4">
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
          {groups.flatMap(([g, rows]) => [
            <p key={g} className="col-span-2 mt-2 border-b border-black font-bold uppercase">{g}</p>,
            ...rows.filter(([, v]) => v !== undefined).map(([k, v]) => <div key={g + k} className="flex justify-between gap-2 border-b border-gray-300 py-0.5"><span className="text-gray-700">{k}</span><b className="text-right">{v || '-'}</b></div>),
          ])}
        </div>
        {photo && <img src={photo} alt="" className="h-36 w-28 border border-black object-cover" />}
      </div>
      {tables.map((t) => (
        <div key={t.title} className="mt-4">
          <p className="mb-1 font-bold uppercase">{t.title}</p>
          <table className="w-full border-collapse"><thead><tr>{t.columns.map((c) => <th key={c[0]} className="border border-black bg-gray-100 px-1 text-left">{c[1]}</th>)}</tr></thead>
            <tbody>{t.rows.map((r, i) => <tr key={i}>{t.columns.map((c) => <td key={c[0]} className="border border-black px-1">{c[2] ? c[2](r) : r[c[0]]}</td>)}</tr>)}</tbody></table>
        </div>
      ))}
      <div className="mt-12 flex justify-between"><span>Signature</span><span>Authorised Signatory</span></div>
    </div>
  );
}

/** Pledged items photo report: one card per loan with the item photo. */
export function PhotoReport({ company, loans, title = 'Pledged Items Photo Report' }) {
  return (
    <div className="mx-auto w-[190mm] text-[11px] text-black">
      <SheetHead company={company} title={title} subtitle={`${loans.length} loans · ${date(new Date())}`} />
      <div className="grid grid-cols-3 gap-2">
        {loans.map((l) => (
          <div key={l.id} className="break-inside-avoid border border-black p-1">
            {l.item_photo ? <img src={l.item_photo} alt="" className="h-32 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-gray-100 text-gray-500">No photo</div>}
            <p className="mt-1 font-bold">#{l.bill_no} · {date(l.loan_date)}</p>
            <p className="truncate">{l.customer_name}</p>
            <p className="truncate">{l.item_summary}</p>
            <p>Net {weight(l.net_wt)} g · {money(l.current_principal ?? l.principal)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tamil Nadu Pawnbrokers Act - Form D: register of pledges (A4 landscape). */
export function FormD({ company, loans, from, to }) {
  const cols = ['Sl', 'Pawn ticket no', 'Date of loan', 'Name & address of pawner', 'Description of articles', 'Weight (g)', 'Value (Rs)', 'Loan (Rs)', 'Rate of interest', 'Date of redemption', 'Amount repaid', 'Remarks'];
  return (
    <div className="text-[9.5px] text-black">
      <div className="mb-2 text-center">
        <p className="text-[12px] font-bold">FORM D</p>
        <p>[See Rule 9 of the Tamil Nadu Pawnbrokers Rules]</p>
        <p className="text-[12px] font-bold">{company?.name}</p>
        <p>{companyLine(company)} {company?.licence_no ? `· Licence No ${company.licence_no}` : ''}</p>
        <p className="font-semibold">Register of pledges from {date(from)} to {date(to)}</p>
      </div>
      <table className="w-full border-collapse">
        <thead><tr>{cols.map((c) => <th key={c} className="border border-black bg-gray-100 px-0.5 py-0.5 text-left align-bottom">{c}</th>)}</tr></thead>
        <tbody>{loans.map((l, i) => (
          <tr key={l.id}>
            <td className="border border-black px-0.5">{i + 1}</td><td className="border border-black px-0.5">{l.bill_no}</td><td className="border border-black px-0.5">{date(l.loan_date)}</td>
            <td className="border border-black px-0.5">{l.customer_name}{l.area ? `, ${l.area}` : ''}</td><td className="border border-black px-0.5">{l.item_summary}</td>
            <td className="border border-black px-0.5 text-right">{weight(l.net_wt)}</td><td className="border border-black px-0.5 text-right">{amount(l.market_value)}</td>
            <td className="border border-black px-0.5 text-right">{amount(l.principal)}</td><td className="border border-black px-0.5">{n(l.interest_rate)}%</td>
            <td className="border border-black px-0.5">{l.close_date ? date(l.close_date) : ''}</td><td className="border border-black px-0.5 text-right">{l.close_date ? amount(l.principal) : ''}</td>
            <td className="border border-black px-0.5">{l.status !== 'OPEN' ? l.status : ''}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="mt-8 flex justify-between"><span>Date: {date(new Date())}</span><span>Signature of Pawnbroker</span></div>
    </div>
  );
}
