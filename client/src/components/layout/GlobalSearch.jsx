import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, FileText, User, History, LayoutGrid, CornerDownLeft } from 'lucide-react';
import clsx from 'clsx';
import { Drawer, SearchInput, StatusBadge, Avatar } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { MENUS, allowed } from '@/config/navigation';
import { money, date } from '@/lib/format';
import { addRecentRecord, recentRecords, recentScreens } from '@/lib/recent';

/* every screen the user may open, flat: { label, hint, path, icon, menu } */
const useScreens = () => {
  const { can } = useAuth();
  return useMemo(() => MENUS.flatMap((m) => m.items.flatMap((i) => (i.section ? [] : i.items ? i.items : [i])).filter((i) => i.path && allowed(can, i.screen)).map((i) => ({ ...i, menu: m.label }))), [can]);
};

const Head = ({ icon: Icon, children }) => <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase"><Icon className="size-3" />{children}</h4>;
const Row = ({ onClick, children, className }) => (
  <button type="button" onClick={onClick} className={clsx('group flex w-full items-center gap-2.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-ink-700 dark:hover:bg-emerald-950/20', className)}>
    {children}
    <CornerDownLeft className="size-3.5 shrink-0 text-ink-300 opacity-0 transition group-hover:opacity-100" />
  </button>
);

/** Ctrl+K: search loans / customers, jump to any screen, reopen recent screens and records. */
export function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const navigate = useNavigate();
  const screens = useScreens();
  const { data, isFetching } = useFetch('/dashboard/search', { q: dq }, { enabled: open && dq.length >= 2 });
  const go = (path, rec) => { if (rec) addRecentRecord(rec); onClose(); setQ(''); navigate(path); };
  const term = q.trim().toLowerCase();
  const screenHits = term.length >= 2 ? screens.filter((s) => `${s.label} ${s.hint || ''} ${s.menu}`.toLowerCase().includes(term)).slice(0, 6) : [];
  const recents = open && !term ? recentScreens() : [];
  const records = open && !term ? recentRecords() : [];
  const iconFor = (path) => screens.find((s) => s.path === path)?.icon || LayoutGrid;

  return (
    <Drawer open={open} onClose={onClose} title="Search" subtitle="Loans, customers, phone, barcode - or any screen" icon={Search} size="md" bodyClassName="!px-4 !py-3">
      <SearchInput value={q} onChange={setQ} placeholder="Loan no, name, phone - or a screen like 'release'…" autoFocus />

      <div className="mt-3 space-y-4">
        {/* nothing typed: recent screens and records */}
        {!term && (
          <>
            {recents.length > 0 && (
              <section>
                <Head icon={History}>Recent screens</Head>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {recents.map((s) => { const Icon = iconFor(s.path); return (
                    <Row key={s.path} onClick={() => go(s.path)}>
                      <Icon className="size-4 shrink-0 text-navy-600 dark:text-navy-300" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{s.label}</span><span className="block truncate text-[11px] text-ink-500">{s.menu}</span></span>
                    </Row>
                  ); })}
                </div>
              </section>
            )}
            {records.length > 0 && (
              <section>
                <Head icon={History}>Recently opened</Head>
                <div className="space-y-1.5">
                  {records.map((r) => (
                    <Row key={r.path} onClick={() => go(r.path)}>
                      {r.type === 'customer' ? <User className="size-4 shrink-0 text-ink-500" /> : <FileText className="size-4 shrink-0 text-ink-500" />}
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{r.label}</span>{r.sub && <span className="block truncate text-[11px] text-ink-500">{r.sub}</span>}</span>
                    </Row>
                  ))}
                </div>
              </section>
            )}
            {!recents.length && !records.length && <p className="py-6 text-center text-[12px] text-ink-400">Type a loan number, customer name, phone - or the name of a screen.</p>}
          </>
        )}

        {/* matching screens */}
        {screenHits.length > 0 && (
          <section>
            <Head icon={LayoutGrid}>Screens</Head>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {screenHits.map((s) => (
                <Row key={s.path} onClick={() => go(s.path)}>
                  <s.icon className="size-4 shrink-0 text-navy-600 dark:text-navy-300" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{s.label}</span><span className="block truncate text-[11px] text-ink-500">{s.menu}{s.hot ? ` · ${s.hot}` : ''}</span></span>
                </Row>
              ))}
            </div>
          </section>
        )}

        {isFetching && <div className="space-y-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" />)}</div>}

        {data && dq.length >= 2 && !isFetching && (
          <>
            {data.loans?.length > 0 && (
              <section>
                <Head icon={FileText}>Loans</Head>
                <div className="space-y-1.5">
                  {data.loans.map((l) => (
                    <Row key={l.id} onClick={() => go(`/loans/counter?loan=${l.id}`, { type: 'loan', id: l.id, label: `#${l.bill_no} · ${l.customer_name}`, sub: `${date(l.loan_date)} · ${money(l.principal)}`, path: `/loans/counter?loan=${l.id}` })}>
                      <FileText className="size-4 shrink-0 text-navy-600 dark:text-navy-300" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-ink-900 dark:text-white">#{l.bill_no} · {l.customer_name}</span><span className="block truncate text-[11px] text-ink-500">{date(l.loan_date)} · {money(l.principal)}</span></span>
                      <StatusBadge status={l.status} />
                    </Row>
                  ))}
                </div>
              </section>
            )}
            {data.customers?.length > 0 && (
              <section>
                <Head icon={User}>Customers</Head>
                <div className="space-y-1.5">
                  {data.customers.map((c) => (
                    <Row key={c.id} onClick={() => go(`/customers?view=${c.id}`, { type: 'customer', id: c.id, label: c.name, sub: `#${c.customer_no} · ${c.phone || ''}`, path: `/customers?view=${c.id}` })}>
                      <Avatar name={c.name} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-ink-900 dark:text-white">{c.name} <span className="text-[11px] font-normal text-ink-400">#{c.customer_no}</span></span><span className="block truncate text-[11px] text-ink-500">{c.phone} · {c.area || '—'}</span></span>
                    </Row>
                  ))}
                </div>
              </section>
            )}
            {!data.loans?.length && !data.customers?.length && !screenHits.length && (
              <p className="py-6 text-center text-[12px] text-ink-500">No loan, customer or screen matches “{dq}”. Check the spelling or try the phone number.</p>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
