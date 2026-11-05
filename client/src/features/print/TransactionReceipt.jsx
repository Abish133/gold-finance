import { money, date, weight, inWords, n } from '@/lib/format';

const TITLES = {
  INTEREST: 'INTEREST RECEIPT', PART_PAYMENT: 'PART PAYMENT RECEIPT', TOPUP: 'TOP-UP LOAN VOUCHER', RELEASE: 'LOAN CLOSURE / RELEASE RECEIPT',
  DISBURSE: 'LOAN PAYMENT VOUCHER', AUCTION: 'AUCTION SETTLEMENT',
};

function Copy({ d, label }) {
  const { company, loan, txn } = d;
  const rows = [
    ['Principal', Math.abs(n(txn.principal_amount))],
    ['Interest', n(txn.interest_amount)],
    ['Penal interest', n(txn.penal_amount)],
    ['Charges', n(txn.charges)],
    ['Discount', -n(txn.discount)],
  ].filter(([, v]) => v);
  return (
    <div className="border border-black p-3 text-black">
      <div className="flex items-start justify-between border-b border-black pb-2">
        <div>
          <p className="text-lg font-extrabold text-[#c0392b]">{company.name}</p>
          <p className="text-[10px]">{[company.address1, company.address2, company.address3].filter(Boolean).join(', ')}</p>
          <p className="text-[10px]">{loan.branch_name} · {loan.branch_phone || company.mobile}</p>
        </div>
        <div className="text-right text-[11px]">
          <p className="font-bold">{TITLES[txn.txn_type] || 'RECEIPT'}</p>
          <p>No: <b>{txn.receipt_no}</b></p>
          <p>Date: <b>{date(txn.txn_date)}</b></p>
          <p className="text-[9px] tracking-widest">{label}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 text-[12px]">
        <p>Loan No: <b>{loan.bill_no}</b> ({date(loan.loan_date)})</p>
        <p>Customer: <b>{loan.customer_name}</b> (#{loan.customer_no})</p>
        <p>Items: {loan.item_summary}</p>
        <p>Net Wt: {weight(loan.net_wt)} g · Loan {money(loan.principal)}</p>
      </div>
      <table className="mt-2 w-full border-collapse text-[12px]">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td className="border border-black px-2 py-0.5">{k}</td><td className="border border-black px-2 py-0.5 text-right">{money(v)}</td></tr>)}
          <tr className="font-bold"><td className="border border-black px-2 py-1">{txn.txn_type === 'TOPUP' || txn.txn_type === 'DISBURSE' ? 'Amount paid to customer' : 'Total received'}</td><td className="border border-black px-2 py-1 text-right">{money(txn.total_amount)}</td></tr>
        </tbody>
      </table>
      <p className="mt-1 text-[11px]">({inWords(txn.total_amount)})</p>
      {txn.payments?.length > 0 && <p className="text-[11px]">Mode: {txn.payments.map((p) => `${p.mode} ${money(p.amount)}${p.reference ? ` (${p.reference})` : ''}`).join(', ')}</p>}
      {txn.txn_type !== 'RELEASE' && <p className="text-[11px]">Balance principal after this receipt: <b>{money(d.balance)}</b></p>}
      <div className="mt-8 flex justify-between text-[11px]"><span>Customer signature</span><span>For {company.name}</span></div>
    </div>
  );
}

/** Two copies (customer + office) on one A4 sheet. */
export function TransactionReceipt({ data }) {
  return (
    <div className="mx-auto w-[194mm] space-y-6">
      <Copy d={data} label="CUSTOMER COPY" />
      <div className="border-t border-dashed border-black" />
      <Copy d={data} label="OFFICE COPY" />
    </div>
  );
}
