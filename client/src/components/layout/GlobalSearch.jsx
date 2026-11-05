import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, FileText, User } from 'lucide-react';
import { Drawer, SearchInput, Spinner, StatusBadge, Avatar } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { money, date } from '@/lib/format';

export function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const navigate = useNavigate();
  const { data, isFetching } = useFetch('/dashboard/search', { q: dq }, { enabled: open && dq.length >= 2 });
  const go = (path) => { onClose(); setQ(''); navigate(path); };

  return (
    <Drawer open={open} onClose={onClose} title="Search" subtitle="Loans, customers, phone, barcode" icon={Search} size="md">
      <SearchInput value={q} onChange={setQ} placeholder="Type at least 2 characters…" autoFocus />
      {isFetching && <Spinner />}
      {data && (
        <div className="mt-5 space-y-6">
          {data.loans?.length > 0 && (
            <section>
              <h4 className="label">Loans</h4>
              <div className="space-y-1.5">
                {data.loans.map((l) => (
                  <button key={l.id} type="button" onClick={() => go(`/loans/counter?loan=${l.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3 text-left hover:border-gold-300 hover:bg-gold-50/50 dark:border-ink-700 dark:hover:bg-gold-500/5">
                    <FileText className="size-5 text-gold-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900 dark:text-white">#{l.bill_no} · {l.customer_name}</p>
                      <p className="text-xs text-ink-500">{date(l.loan_date)} · {money(l.principal)}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {data.customers?.length > 0 && (
            <section>
              <h4 className="label">Customers</h4>
              <div className="space-y-1.5">
                {data.customers.map((c) => (
                  <button key={c.id} type="button" onClick={() => go(`/customers?view=${c.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3 text-left hover:border-gold-300 hover:bg-gold-50/50 dark:border-ink-700 dark:hover:bg-gold-500/5">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900 dark:text-white">{c.name} <span className="text-xs text-ink-400">#{c.customer_no}</span></p>
                      <p className="text-xs text-ink-500">{c.phone} · {c.area || '—'}</p>
                    </div>
                    <User className="size-4 text-ink-400" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {!data.loans?.length && !data.customers?.length && <p className="text-sm text-ink-500">No matches for “{dq}”.</p>}
        </div>
      )}
    </Drawer>
  );
}
