import { RefreshCw, Printer, BookCheck } from 'lucide-react';
import { Badge, Button, DataTable, PageHeader, Spinner } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { printTable } from '@/lib/printTable';
import { date } from '@/lib/format';
import { ExitButton } from '@/features/loans/desk';

const Chips = ({ list, tone }) => (list.length ? <div className="flex flex-wrap gap-1">{list.map((x) => <Badge key={x} tone={tone}>{x}</Badge>)}</div> : <p className="text-sm text-emerald-700">None - all in order.</p>);

/** Bill Book Check: missing loan numbers, missing / repeated paper bill book numbers, cancelled bills. */
export default function BillBookCheckPage() {
  const { isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data, isFetching, refetch } = useFetch(isAllBranches ? null : '/desk/bill-book-check');
  if (isAllBranches) return <div className="card p-6 text-sm">Select a single branch from the header to check its bill book.</div>;
  if (!data) return <Spinner />;
  const print = () => printTable({ title: `Bill Book Check · ${data.fy}`, company, rows: [
    { k: 'Loans this year', v: `${data.total} (No ${data.first ?? '-'} to ${data.last ?? '-'})` },
    { k: 'Missing loan numbers', v: data.missingLoanNos.join(', ') || 'None' },
    { k: 'Missing bill book numbers', v: data.missingBillBook.join(', ') || 'None' },
    { k: 'Repeated bill book numbers', v: data.duplicateBillBook.map((d) => `${d.bill_book_no} (${d.loans})`).join('; ') || 'None' },
    { k: 'Cancelled bills', v: data.cancelled.map((c) => c.bill_no).join(', ') || 'None' },
  ], columns: [{ key: 'k', label: 'Check' }, { key: 'v', label: 'Result' }] });
  return (
    <div className="animate-rise space-y-3">
      <PageHeader icon={BookCheck} title="Bill Book Check" subtitle={`Financial year ${data.fy} · ${data.total} loans · No ${data.first ?? '-'} to ${data.last ?? '-'}`}
        actions={<><Button variant="outline" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Check again</Button><Button variant="outline" icon={Printer} onClick={print}>Print</Button></>} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card space-y-2 p-4"><p className="text-xs font-bold text-ink-600 uppercase">Missing loan numbers ({data.missingLoanNos.length})</p><Chips list={data.missingLoanNos} tone="red" /></div>
        <div className="card space-y-2 p-4"><p className="text-xs font-bold text-ink-600 uppercase">Missing paper bill book numbers ({data.missingBillBook.length})</p><Chips list={data.missingBillBook} tone="gold" /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card space-y-2 p-4"><p className="text-xs font-bold text-ink-600 uppercase">Bill book number used more than once</p>
          {data.duplicateBillBook.length ? <DataTable dense rows={data.duplicateBillBook} columns={[{ key: 'bill_book_no', label: 'Bill book no' }, { key: 'loans', label: 'Loans' }]} /> : <p className="text-sm text-emerald-700">None - all in order.</p>}</div>
        <div className="card space-y-2 p-4"><p className="text-xs font-bold text-ink-600 uppercase">Cancelled bills ({data.cancelled.length})</p>
          {data.cancelled.length ? <DataTable dense rows={data.cancelled} columns={[{ key: 'bill_no', label: 'Loan' }, { key: 'loan_date', label: 'Date', render: (r) => date(r.loan_date) }]} /> : <p className="text-sm text-ink-500">No cancelled bills.</p>}</div>
      </div>
      <div className="card flex justify-end px-3 py-2"><ExitButton /></div>
    </div>
  );
}
