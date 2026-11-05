import { useState } from 'react';
import { BookText } from 'lucide-react';
import { Card, DataTable, KeyValue, PageHeader, Segmented, Stat } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { money, today, n } from '@/lib/format';
import { DateRange, STATEMENT_COLUMNS } from './shared';

const T = { DISBURSE: 'New loans', INTEREST: 'Interest receipts', PART_PAYMENT: 'Part payments', TOPUP: 'Top-ups', RELEASE: 'Releases', AUCTION: 'Auctions' };

/** Cash book + day book (day report) in one screen. */
export default function CashBookPage() {
  const [range, setRange] = useState({ from: today(), to: today() });
  const [view, setView] = useState('day');
  const book = useFetch('/accounts/cash-book', range);
  const day = useFetch('/accounts/day-summary', range);
  const vouchers = useFetch(view === 'vouchers' ? '/accounts/vouchers' : null, { ...range, pageSize: 200 });
  const s = day.data;

  return (
    <div className="animate-rise">
      <PageHeader icon={BookText} title="Day Book & Cash Book" subtitle="Day report, cash movement and all vouchers" actions={<DateRange value={range} onChange={setRange} />} />
      {s && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Opening cash" value={money(s.cash.opening)} />
          <Stat label="Cash received" value={money(s.cash.receipts)} tone="green" />
          <Stat label="Cash paid" value={money(s.cash.payments)} tone="red" />
          <Stat label="Closing cash" value={money(s.cash.closing)} tone="blue" />
        </div>
      )}
      <Segmented className="mb-4" value={view} onChange={setView} options={[{ value: 'day', label: 'Day report' }, { value: 'cash', label: 'Cash book' }, { value: 'vouchers', label: 'All vouchers' }]} />
      <div className="mt-4">
        {view === 'day' && s && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Loans issued">
              <KeyValue items={[['Count', s.loans.cnt], ['Amount', money(s.loans.principal)], ['Net weight', `${n(s.loans.net_wt).toFixed(3)} g`], ['Doc charges', money(s.loans.doc_charges)], ['Advance interest', money(s.loans.advance_interest)]]} />
            </Card>
            {Object.entries(s.transactions).filter(([k]) => k !== 'DISBURSE').map(([k, v]) => (
              <Card key={k} title={T[k] || k}>
                <KeyValue items={[['Count', v.cnt], ['Principal', money(v.principal)], ['Interest', money(v.interest)], ['Penal', money(v.penal)], ['Discount', money(v.discount)], ['Total', money(v.total)]]} />
              </Card>
            ))}
          </div>
        )}
        {view === 'cash' && (
          <DataTable dense columns={STATEMENT_COLUMNS} loading={book.isLoading}
            rows={book.data ? [{ entry_date: range.from, narration: 'Opening balance', balance: book.data.opening, debit: null, credit: null }, ...book.data.entries] : []}
            totals={book.data && { debit: book.data.debit, credit: book.data.credit }} />
        )}
        {view === 'vouchers' && (
          <DataTable dense loading={vouchers.isLoading} rows={vouchers.data || []} columns={[
            { key: 'voucher_date', label: 'Date', type: 'date' }, { key: 'voucher_no', label: 'No' }, { key: 'voucher_type', label: 'Type' },
            { key: 'narration', label: 'Narration' }, { key: 'lines_text', label: 'Entries', className: 'text-xs text-ink-500 max-w-md' }, { key: 'amount', label: 'Amount', type: 'money' },
          ]} />
        )}
      </div>
    </div>
  );
}
