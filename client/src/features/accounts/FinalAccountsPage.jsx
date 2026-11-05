import { useState } from 'react';
import { Scale } from 'lucide-react';
import { Card, DataTable, PageHeader, Spinner, Tabs } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { money, today } from '@/lib/format';
import dayjs from 'dayjs';
import { DateRange } from './shared';

function Side({ title, rows, total }) {
  return (
    <Card title={title} bodyClassName="p-0">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {rows.map((r) => <tr key={`${r.id}-${r.name}`}><td className="px-5 py-2">{r.name}<span className="ml-2 text-xs text-ink-400">{r.group_name}</span></td><td className="num px-5 py-2 text-right">{money(r.amount)}</td></tr>)}
        </tbody>
        <tfoot><tr className="bg-ink-900 font-bold text-white"><td className="px-5 py-2.5">Total</td><td className="num px-5 py-2.5 text-right">{money(total)}</td></tr></tfoot>
      </table>
    </Card>
  );
}

export default function FinalAccountsPage() {
  const [tab, setTab] = useState('pl');
  const fyStart = dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1);
  const [range, setRange] = useState({ from: fyStart.format('YYYY-MM-DD'), to: today() });
  const tb = useFetch(tab === 'tb' ? '/accounts/trial-balance' : null, { to: range.to });
  const pl = useFetch(tab === 'pl' ? '/accounts/profit-loss' : null, range);
  const bs = useFetch(tab === 'bs' ? '/accounts/balance-sheet' : null, { to: range.to });
  return (
    <div className="animate-rise">
      <PageHeader icon={Scale} title="Final Accounts" subtitle="Generated automatically from every loan, receipt and voucher" actions={<DateRange value={range} onChange={setRange} single={tab !== 'pl'} />} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'pl', label: 'Profit & Loss' }, { value: 'bs', label: 'Balance Sheet' }, { value: 'tb', label: 'Trial Balance' }]} />
      {tab === 'pl' && (pl.data ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2"><Side title="Income" rows={pl.data.income} total={pl.data.totalIncome} /><Side title="Expenses" rows={pl.data.expense} total={pl.data.totalExpense} /></div>
          <div className={`mt-6 rounded-2xl p-5 text-center text-white ${pl.data.netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            <p className="text-sm opacity-80">{pl.data.netProfit >= 0 ? 'Net profit' : 'Net loss'}</p><p className="num text-3xl font-extrabold">{money(Math.abs(pl.data.netProfit))}</p>
          </div>
        </>
      ) : <Spinner />)}
      {tab === 'bs' && (bs.data ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2"><Side title="Liabilities & Capital" rows={bs.data.liabilities} total={bs.data.totalLiabilities} /><Side title="Assets" rows={bs.data.assets} total={bs.data.totalAssets} /></div>
          {Math.abs(bs.data.difference) > 0.01 && <p className="mt-3 text-sm text-rose-600">Difference {money(bs.data.difference)} - check ledger opening balances.</p>}
        </>
      ) : <Spinner />)}
      {tab === 'tb' && (
        <DataTable dense loading={tb.isLoading} rows={tb.data?.rows || []} totals={tb.data && { dr: tb.data.totalDebit, cr: tb.data.totalCredit }} columns={[
          { key: 'name', label: 'Account' }, { key: 'group_name', label: 'Group' },
          { key: 'dr', label: 'Debit', type: 'money', render: (r) => (r.balance > 0 ? money(r.balance) : '') },
          { key: 'cr', label: 'Credit', type: 'money', render: (r) => (r.balance < 0 ? money(-r.balance) : '') },
        ]} />
      )}
    </div>
  );
}
