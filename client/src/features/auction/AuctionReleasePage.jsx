import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import clsx from 'clsx';
import { Button, DataTable } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { AuctionReleaseTab } from './AuctionReleaseTab';

/** Auction Release (desktop): close unredeemed loans as AUCTION and record what the items sold for. Tabs: Due for Auction / Auctioned. */
export default function AuctionReleasePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('due');
  const sales = useFetch('/auction/sales');
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Auction Release</h1><p className="text-sm text-navy-100">Close unredeemed loans as AUCTION and record what the items sold for</p></section>
      <div className="flex gap-1">
        {[['due', 'Due for Auction'], ['done', `Auctioned (${sales.data?.length || 0})`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={clsx('h-11 min-w-64 rounded-t-md border px-6 text-base font-bold', tab === k ? 'border-ink-300 bg-white text-navy-900 dark:bg-ink-900 dark:text-white' : 'border-transparent bg-ink-100 text-ink-600 dark:bg-ink-800')}>{l}</button>
        ))}
      </div>
      {tab === 'due' ? <AuctionReleaseTab /> : (
        <DataTable dense rows={sales.data || []} loading={sales.isLoading} columns={[
          { key: 'auction_date', label: 'Auction Date', type: 'date' }, { key: 'bill_no', label: 'Loan No' }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'customer_name', label: 'Customer' },
          { key: 'buyer_name', label: 'Buyer' }, { key: 'net_wt', label: 'Net Wt', type: 'weight' }, { key: 'principal_due', label: 'Loan Amount', type: 'money' }, { key: 'interest_due', label: 'Interest', type: 'money' },
          { key: 'sale_amount', label: 'Sold For', type: 'money' }, { key: 'surplus', label: 'Surplus / (Loss)', type: 'money' },
        ]} />
      )}
      <div className="flex justify-end"><Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button></div>
      <p className="px-1 text-xs text-ink-500">F3 = scan / type loan no · Space = tick selected rows · Ctrl+A = tick all · Ctrl+N = tick with notice · Ctrl+D = untick · F10 = mark / save sale · Ctrl+E = Excel · Esc = exit</p>
    </div>
  );
}
