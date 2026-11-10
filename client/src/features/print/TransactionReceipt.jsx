import dayjs from 'dayjs';
import { amount, inWords, n, weight } from '@/lib/format';

const TITLES = {
  INTEREST: 'INTEREST RECEIPT', PART_PAYMENT: 'PART PAYMENT RECEIPT', TOPUP: 'TOP-UP RECEIPT', RELEASE: 'RELEASE RECEIPT',
  DISBURSE: 'LOAN PAYMENT VOUCHER', AUCTION: 'AUCTION SETTLEMENT',
};
const d = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-');
const rs = (v) => `₹${amount(v)}`;
/** desktop wording: "Rupees One Thousand Only" */
const words = (v) => `Rupees ${inWords(v).replace(/ Rupees Only$/, '')} Only`;
const MODES = { CASH: 'Cash', UPI: 'Online', BANK: 'Bank', CARD: 'Card', CHEQUE: 'Cheque' };
const modeName = (p) => `${MODES[p.mode] || p.mode}${p.reference ? ` (${p.reference})` : ''}`;

const Row = ({ k, v, bold, indent }) => (
  <div className={`flex justify-between py-[3px] ${bold ? 'font-bold' : ''}`}><span className={indent ? 'pl-4' : ''}>{k}</span><span className="text-right">{v}</span></div>
);

function Head({ company, small }) {
  return (
    <div className="border-b border-black pb-2 text-center">
      <p className="text-2xl font-bold">{company.name}</p>
      <p className={small ? 'text-[12px] text-ink-600' : 'text-[13px]'}>{[company.address1, company.address2, company.address3].filter(Boolean).join(', ')}</p>
      {(company.phone || company.mobile) && <p className={small ? 'text-[12px] text-ink-600' : 'text-[13px]'}>{small ? 'Phone' : 'Ph:'} {company.phone || company.mobile}</p>}
    </div>
  );
}
const Signs = ({ company, release }) => (
  <div className={`mt-14 flex justify-between text-[13px] ${release ? 'text-ink-600' : ''}`}><span>{release ? 'Customer signature' : 'Customer Sign'}</span><span>{release ? `For ${company.name}` : 'Authorised Sign'}</span></div>
);

/** Interest / part payment / top-up receipts laid out like the desktop (one copy, centred list). */
function PaymentReceipt({ data }) {
  const { company, loan, txn, monthly } = data;
  const months = n(txn.months_paid);
  const from = txn.interest_upto && months ? dayjs(txn.interest_upto).subtract(months, 'month') : null;
  const principal = Math.abs(n(txn.principal_amount));
  const pays = txn.payments || [];
  return (
    <div className="mx-auto w-[150mm] text-[15px] text-black">
      <Head company={company} />
      <p className="py-2 text-center text-lg font-bold">{TITLES[txn.txn_type] || 'RECEIPT'}</p>
      <Row k="Date" v={`${d(txn.txn_date)}  ${txn.created_at ? dayjs(txn.created_at).format('hh:mm A') : ''}`} />
      <Row k="Loan No" v={<b>{loan.bill_no}{loan.manual_bill_no ? `  (Bill ${loan.manual_bill_no})` : ''}</b>} />
      <Row k="Customer" v={`${loan.customer_title ? `${loan.customer_title} ` : ''}${loan.customer_name}`} />
      <Row k="Loan Date" v={d(loan.loan_date)} />
      <Row k="Loan Amount" v={rs(loan.principal)} />
      <div className="my-1 border-t border-black" />
      {n(txn.interest_amount) > 0 && (<>
        {months > 0 && <Row k="Interest Months" v={`${months}${from ? `  (${d(from)} to ${d(txn.interest_upto)})` : ''}`} />}
        {months > 0 && monthly > 0 && <Row k="Interest / Month" v={rs(monthly)} />}
        <Row k="Interest Received" v={rs(n(txn.interest_amount) + n(txn.penal_amount))} bold />
      </>)}
      {txn.txn_type === 'PART_PAYMENT' && principal > 0 && (<>
        <Row k="Part Amount Received" v={rs(principal)} bold />
        <Row k="Outstanding after this" v={rs(data.balance)} />
      </>)}
      {txn.txn_type === 'TOPUP' && (<>
        <Row k="Top-up Amount" v={rs(principal)} bold />
        <Row k="Loan after top-up" v={rs(data.balance)} />
      </>)}
      {n(txn.charges) > 0 && <Row k="Charges" v={rs(txn.charges)} />}
      {n(txn.discount) > 0 && <Row k="Discount" v={`- ${rs(txn.discount)}`} />}
      {pays.map((p, i) => <Row key={i} k={modeName(p)} v={rs(p.amount)} indent />)}
      <p className="mt-2">{words(txn.total_amount)}</p>
      <Signs company={company} />
    </div>
  );
}

/** Release receipt like the desktop: items, loan, interest, less advance / paid, total received. */
function ReleaseReceipt({ data }) {
  const { company, loan, txn, items = [], paidBefore = 0, months } = data;
  const adv = n(loan.advance_interest);
  const interestTotal = n(txn.interest_amount) + adv + paidBefore;
  const pays = txn.payments || [];
  return (
    <div className="mx-auto w-[160mm] text-[15px] text-black">
      <Head company={company} small />
      <div className="mt-2 flex justify-between text-lg font-bold"><span>RELEASE RECEIPT</span><span>No {loan.release_no ?? txn.release_no ?? txn.receipt_no}</span></div>
      <div className="flex justify-between font-bold"><span>Loan No {loan.bill_no}{loan.manual_bill_no ? `  ·  Bill Book ${loan.manual_bill_no}` : ''}</span><span>Date {d(txn.txn_date)}</span></div>
      <p>Customer: {loan.customer_title ? `${loan.customer_title} ` : ''}{loan.customer_name}   (A/c {loan.customer_no})</p>
      <p className="text-[13px] text-ink-600">Loan date {d(loan.loan_date)}  ·  Interest {n(loan.interest_rate).toFixed(2)}% {loan.rate_type === 'MONTHLY' ? 'p.m.' : 'p.a.'}</p>
      <div className="my-2 border-t border-ink-400" />
      {items.map((i) => <Row key={i.id} k={`${i.item_name}  x${i.pcs}`} v={`${weight(i.net_wt)} g`} />)}
      <div className="my-2 border-t border-ink-400" />
      <Row k="Loan amount" v={amount(Math.abs(n(txn.principal_amount)))} />
      <Row k={`Interest${months ? ` (${months} months)` : ''}`} v={amount(interestTotal)} />
      {adv > 0 && <Row k="Less: advance interest" v={`- ${amount(adv)}`} />}
      {paidBefore > 0 && <Row k="Less: interest already paid" v={`- ${amount(paidBefore)}`} />}
      {n(txn.penal_amount) > 0 && <Row k="Penal interest" v={amount(txn.penal_amount)} />}
      {n(txn.charges) > 0 && <Row k="Charges" v={amount(txn.charges)} />}
      {n(txn.discount) > 0 && <Row k="Less: discount" v={`- ${amount(txn.discount)}`} />}
      <div className="my-2 border-t border-ink-400" />
      <Row k={<span className="text-lg">TOTAL RECEIVED</span>} v={<span className="text-lg">₹ {amount(txn.total_amount)}</span>} bold />
      <p className="text-[13px] text-ink-600">{words(txn.total_amount)}</p>
      {pays.length > 0 && <p className="text-[13px] text-ink-600">Paid by: {pays.map((p) => `${modeName(p)} ${amount(p.amount)}`).join(', ')}</p>}
      <Signs company={company} release />
    </div>
  );
}

export function TransactionReceipt({ data }) {
  return data.txn.txn_type === 'RELEASE' ? <ReleaseReceipt data={data} /> : <PaymentReceipt data={data} />;
}
