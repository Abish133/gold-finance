import { useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@/hooks/useApi';
import { amount, date, n, today, weight } from '@/lib/format';
import { ReportScreen, Seg, SideLine, SideHead } from './ReportScreen';

const STATUS = { OPEN: ['Open', 'bg-blue-100 text-blue-800'], RELEASED: ['Released', 'bg-emerald-100 text-emerald-800'], AUCTION: ['Auction', 'bg-rose-100 text-rose-700'], BANK: ['Bank', 'bg-violet-100 text-violet-800'], CANCELLED: ['Cancelled', 'bg-ink-100 text-ink-600'] };
const cust = { key: 'customer_name', label: 'Customer', render: (r) => <div><p className="font-semibold">{r.customer_name}</p><p className="text-[11px] text-ink-500">{[r.relation_name && `${r.relation_type || ''} ${r.relation_name}`, r.customer_phone].filter(Boolean).join(' · ')}</p></div> };
const metal = { key: 'loan_on', label: 'Metal', render: (r) => <span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{r.loan_on}</span> };
const by = (rows, m) => rows.filter((r) => r.loan_on === m);
const sum = (rows, k) => rows.reduce((s, r) => s + n(r[k]), 0);
const useReport = (url, init) => {
  const [f, setF] = useState({ from: today(), to: today(), metal: '', search: '', ...init });
  const [q, setQ] = useState(null);
  const res = useFetch(q ? url : null, q);
  return { f, setF, show: () => setQ({ ...f, search: undefined, _t: Date.now() }), rows: res.data || [], loading: res.isFetching };
};
const metalFilter = (f, setF) => <div><p className="label">Metal</p><Seg value={f.metal} onChange={(v) => setF({ ...f, metal: v })} options={[['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']]} /></div>;

/** Loan Report (desktop): loans given between the selected dates, with their status today. */
export function LoanReportPage() {
  const r = useReport('/desk/rep/loans', { status: '' });
  const rows = r.rows;
  const t = (m) => ({ label: m.charAt(0) + m.slice(1).toLowerCase(), value: `Rs ${amount(sum(by(rows, m), 'principal'))}`, hint: `${by(rows, m).length} loans · ${weight(sum(by(rows, m), 'net_wt'))} g`, cls: { GOLD: 'border-t-amber-600', SILVER: 'border-t-ink-400', MIX: 'border-t-violet-600' }[m] });
  return (
    <ReportScreen title="Loan Report" subtitle="Loans given between the selected dates, with their status today" f={r.f} setF={r.setF} onShow={r.show} rows={rows} loading={r.loading} dateKey="loan_date"
      filters={<>{metalFilter(r.f, r.setF)}<div><p className="label">Status today</p><Seg value={r.f.status} onChange={(v) => r.setF({ ...r.f, status: v })} options={[['', 'All'], ['OPEN', 'Open'], ['RELEASED', 'Released'], ['AUCTION', 'Auction'], ['BANK', 'Bank']]} /></div></>}
      tiles={[{ label: 'Loans given', value: rows.length, hint: `${rows.filter((x) => x.status_today === 'OPEN').length} open`, cls: 'border-t-navy-800' }, t('GOLD'), t('SILVER'), t('MIX'),
        { label: 'Total loan amount', value: `Rs ${amount(sum(rows, 'principal'))}`, hint: `Adv. interest Rs ${amount(sum(rows, 'advance_interest'))} · Charges Rs ${amount(sum(rows, 'doc_charges') + sum(rows, 'other_charges'))}`, dark: true }]}
      columns={[{ key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Date', type: 'date' }, cust, { key: 'item_summary', label: 'Items' }, metal,
        { key: 'gross_wt', label: 'Gross', type: 'weight', total: true }, { key: 'stone_wt', label: 'Less', type: 'weight', total: true }, { key: 'net_wt', label: 'Net Wt', type: 'weight', total: true },
        { key: 'principal', label: 'Amount', type: 'money', total: true },
        { key: 'status_today', label: 'Status Today', render: (x) => <span className={clsx('rounded px-2 py-0.5 text-[11px] font-bold', STATUS[x.status_today]?.[1])}>{STATUS[x.status_today]?.[0]}</span>, print: (x) => STATUS[x.status_today]?.[0] }]} />
  );
}

/** Release Report (desktop) and Release Report in Details (detail=true). */
export function ReleaseReportPage({ detail = false }) {
  const r = useReport('/desk/rep/releases', { paid: '', show: '' });
  const [sel, setSel] = useState(null);
  const rows = r.rows;
  const base = [{ key: 'release_no', label: 'Rel. No' }, { key: 'txn_date', label: 'Released', type: 'date' }, { key: 'bill_no', label: 'Loan No' }, cust];
  const columns = detail
    ? [...base, { key: 'item_summary', label: 'Items' }, { key: 'loan_amt', label: 'Loan Amt', type: 'money', total: true }, { key: 'interest_rate', label: 'ROI %', type: 'number' }, { key: 'days', label: 'Days', type: 'number' },
      { key: 'interest_received', label: 'Int. Recd', type: 'money', total: true }, { key: 'total_amount', label: 'Received', type: 'money', total: true }, { key: 'pct_month', label: '% p.m.', type: 'number' }, { key: 'pct_year', label: '% / Yr', type: 'number' }]
    : [...base, metal, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'days', label: 'Days', type: 'number' }, { key: 'principal_back', label: 'Loan Amt', type: 'money', total: true },
      { key: 'interest_received', label: 'Interest', type: 'money', total: true }, { key: 'discount', label: 'Discount', type: 'money', total: true }, { key: 'charges', label: 'Charges', type: 'money', total: true },
      { key: 'total_amount', label: 'Received', type: 'money', total: true }, { key: 'pct_month', label: '% p.m.', type: 'number' }, { key: 'pct_year', label: '% / Year', type: 'number' }, { key: 'paid_by', label: 'Paid By' }];
  const received = sum(rows, 'total_amount');
  return (
    <ReportScreen title={detail ? 'Release Report in Details' : 'Release Report'} subtitle={detail ? 'Every release with its full interest breakdown' : 'Loans released between the selected dates - loan amount back, interest and money received'}
      dateLabel="Released from" f={r.f} setF={r.setF} onShow={r.show} rows={rows} loading={r.loading} dateKey="txn_date" dayWise={!detail} sel={sel} setSel={setSel}
      filters={<>{metalFilter(r.f, r.setF)}
        {detail ? <div><p className="label">Show</p><Seg value={r.f.show} onChange={(v) => r.setF({ ...r.f, show: v })} options={[['', 'All'], ['part', 'With part payment'], ['discount', 'With discount']]} /></div>
          : <div><p className="label">Paid by</p><Seg value={r.f.paid} onChange={(v) => r.setF({ ...r.f, paid: v })} options={[['', 'All'], ['cash', 'Cash'], ['online', 'Online / Card']]} /></div>}</>}
      tiles={detail ? null : [{ label: 'Releases', value: rows.length, cls: 'border-t-navy-800' }, { label: 'Loan amount back', value: `Rs ${amount(sum(rows, 'principal_back'))}`, hint: 'Principal returned', cls: 'border-t-blue-600' },
        { label: 'Interest received', value: `Rs ${amount(sum(rows, 'interest_received'))}`, hint: `Discount Rs ${amount(sum(rows, 'discount'))}`, cls: 'border-t-amber-600' },
        { label: 'Cash / online', value: `Rs ${amount(received - sum(rows, 'online_amount'))}`, hint: `Online / Card Rs ${amount(sum(rows, 'online_amount'))}`, cls: 'border-t-ink-400' },
        { label: 'Total received', value: `Rs ${amount(received)}`, hint: `Charges Rs ${amount(sum(rows, 'charges'))} · Reverse ${sum(rows, 'principal_back') ? ((sum(rows, 'interest_received') / sum(rows, 'principal_back')) * 100).toFixed(2) : '0.00'} %`, dark: true }]}
      columns={columns}
      side={detail && (<>
        <p className="text-xs font-bold text-amber-700 uppercase">{sel ? `Release ${sel.release_no || ''} · Loan ${sel.bill_no}` : 'Select a release'}</p>
        <SideLine k="Pledged" v={sel && date(sel.loan_date)} /><SideLine k="Released" v={sel && date(sel.txn_date)} /><SideLine k="Items" v={sel?.item_summary} />
        <SideLine k="ROI / Months / Days" v={sel && `${n(sel.interest_rate)}% · ${Math.round(sel.days / 30)} m · ${sel.days} d`} />
        <SideHead>Principal</SideHead><SideLine k="Loan amount" v={sel && amount(sel.loan_amt)} /><SideLine minus k="Part paid earlier" v={sel && amount(sel.part_paid)} />
        <SideHead>Interest</SideHead><SideLine k="Total interest" v={sel && amount(sel.total_interest)} /><SideLine minus k="Advance interest" v={sel && amount(sel.advance_interest)} />
        <SideLine minus k="Paid in part pay." v={sel && amount(sel.interest_earlier)} /><SideLine k="Due at release" v={sel && amount(sel.due_at_release)} /><SideLine minus k="Discount" v={sel && amount(sel.discount)} />
        <SideLine k="Interest received" v={sel && amount(sel.interest_received)} bold />
        <SideHead>Other</SideHead><SideLine k="Charges" v={sel && amount(sel.charges)} /><SideLine k="Paid by" v={sel?.paid_by} />
        <SideLine k="Received" v={sel && amount(sel.total_amount)} bold /><SideLine k="Reverse % (m / yr)" v={sel && `${sel.pct_month} / ${sel.pct_year}`} />
      </>)} />
  );
}

/** Part Payment Report (desktop): loan amount and interest received before release. */
export function PartPaymentReportPage() {
  const r = useReport('/desk/rep/part-payments', { type: '' });
  const [sel, setSel] = useState(null);
  const all = useFetch(sel ? `/desk/rep/loan-payments/${sel.id}` : null);
  const rows = r.rows;
  const hist = all.data || [];
  return (
    <ReportScreen title="Part Payment Report" subtitle="Loan amount and interest received before release" dateLabel="Paid from" f={r.f} setF={r.setF} onShow={r.show} rows={rows} loading={r.loading} dateKey="txn_date" sel={sel} setSel={setSel}
      filters={<><div><p className="label">Type</p><Seg value={r.f.type} onChange={(v) => r.setF({ ...r.f, type: v })} options={[['', 'All'], ['principal', 'Loan amount'], ['interest', 'Interest']]} /></div>{metalFilter(r.f, r.setF)}</>}
      tiles={[{ label: 'Payments', value: rows.length, hint: `${new Set(rows.map((x) => x.id)).size} loans`, dark: true },
        { label: 'Loan amount received', value: amount(sum(rows, 'part_amount')), hint: `${rows.filter((x) => n(x.part_amount) > 0).length} payments`, cls: 'border-t-blue-600' },
        { label: 'Interest received', value: amount(sum(rows, 'interest')), hint: `${rows.filter((x) => n(x.interest) > 0).length} payments · ${sum(rows, 'months_paid')} months`, cls: 'border-t-amber-600' },
        { label: 'Total received', value: amount(sum(rows, 'total_amount')), hint: 'loan amount + interest', cls: 'border-t-emerald-700' },
        { label: 'Cash / online', value: amount(sum(rows, 'total_amount') - sum(rows, 'online_amount')), hint: `cash · online ${amount(sum(rows, 'online_amount'))}`, cls: 'border-t-ink-400' }]}
      columns={[{ key: 'txn_date', label: 'Paid On', type: 'date' }, { key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Pledged', type: 'date' }, cust, metal,
        { key: 'principal', label: 'Loan Amt', type: 'money' }, { key: 'type', label: 'Type' }, { key: 'months_paid', label: 'Months', type: 'number' },
        { key: 'total_amount', label: 'Paid', type: 'money', total: true }, { key: 'paid_by', label: 'Paid By' }, { key: 'status', label: 'Loan Now', render: (x) => <span className={clsx('rounded px-2 py-0.5 text-[11px] font-bold', STATUS[x.status === 'CLOSED' ? 'RELEASED' : x.status === 'AUCTIONED' ? 'AUCTION' : x.status]?.[1])}>{x.status === 'CLOSED' ? 'Released' : x.status === 'OPEN' ? 'Open' : x.status}</span>, print: (x) => (x.status === 'CLOSED' ? 'Released' : x.status) }]}
      side={(<>
        <p className="text-xs font-bold text-amber-700 uppercase">{sel ? `Loan ${sel.bill_no} · ${sel.customer_name}` : 'Select a payment'}</p>
        <SideLine k="Pledged" v={sel && date(sel.loan_date)} /><SideLine k="Items" v={sel?.item_summary} /><SideLine k="Loan amount" v={sel && amount(sel.principal)} />
        <SideHead>All part payments of this loan</SideHead>
        <div className="max-h-48 space-y-0.5 overflow-auto rounded border border-ink-200 p-1 text-xs dark:border-ink-700">
          {sel && !hist.length && <p className="text-ink-400">-</p>}
          {hist.map((h, i) => <div key={i} className="flex justify-between"><span>{date(h.txn_date)} · {n(h.principal_amount) < 0 ? 'Loan amt' : 'Interest'}</span><span className="num">{amount(h.total_amount)}</span></div>)}
        </div>
        <SideHead>Total paid so far</SideHead><SideLine k="Loan amount" v={sel && amount(hist.reduce((s, h) => s - n(h.principal_amount), 0))} /><SideLine k="Interest" v={sel && amount(hist.reduce((s, h) => s + n(h.interest_amount), 0))} />
        <SideLine k="Balance loan" v={sel && amount(sel.current_principal)} bold /><SideLine k="Status now" v={sel?.status === 'OPEN' ? 'Pending' : sel?.status} />
      </>)} />
  );
}
