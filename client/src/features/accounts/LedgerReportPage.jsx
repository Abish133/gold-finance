import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Card, DataTable, Empty, Field, PageHeader, Stat } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { money, monthStart, today } from '@/lib/format';
import { DateRange, LedgerSelect, STATEMENT_COLUMNS } from './shared';

export default function LedgerReportPage() {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [ledger, setLedger] = useState('');
  const { data, isLoading } = useFetch(ledger ? '/accounts/ledger-statement' : null, { ...range, ledger_id: ledger });
  const bal = (v) => `${money(Math.abs(v))} ${v >= 0 ? 'Dr' : 'Cr'}`;
  return (
    <div className="animate-rise">
      <PageHeader icon={NotebookPen} title="Account Ledger" subtitle="Statement of any account for a period" />
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <Field label="Account"><LedgerSelect className="w-80" value={ledger} onChange={setLedger} /></Field>
        <DateRange value={range} onChange={setRange} />
      </div>
      {!ledger ? <Card><Empty title="Choose an account" /></Card> : (
        <>
          {data && (
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <Stat label="Opening" value={bal(data.opening)} /><Stat label="Debit" value={money(data.debit)} tone="green" />
              <Stat label="Credit" value={money(data.credit)} tone="red" /><Stat label="Closing" value={bal(data.closing)} tone="blue" />
            </div>
          )}
          <DataTable dense columns={[...STATEMENT_COLUMNS.slice(0, 3), { key: 'branch_name', label: 'Branch' }, ...STATEMENT_COLUMNS.slice(3)]} rows={data?.entries || []} loading={isLoading} totals={data && { debit: data.debit, credit: data.credit }} />
        </>
      )}
    </div>
  );
}
