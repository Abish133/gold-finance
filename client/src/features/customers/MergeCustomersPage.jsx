import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { Merge, ArrowDown, Trash2, UserCheck, MousePointerClick } from 'lucide-react';
import { Button, ConfirmDrawer } from '@/components/ui';
import { CustomerPicker } from '@/components/common/CustomerPicker';
import { useAction } from '@/hooks/useApi';

/**
 * Merge Customers as a side section next to the customers table (F8).
 * `selected` = the row picked in the table, so it can be used without searching again.
 */
export function MergeCustomersPanel({ open, selected }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const merge = useAction({ url: '/customers/merge', invalidate: ['/customers'], success: 'Customers merged' });
  useEffect(() => { if (open) { setFrom(null); setTo(null); } }, [open]);
  if (!open) return null;
  const same = from && to && from.id === to.id;
  const useRow = (set) => selected && (
    <button type="button" onClick={() => set(selected)} title="Use the customer selected in the table"
      className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 normal-case hover:bg-ink-100 dark:hover:bg-ink-800">
      <MousePointerClick className="size-3" />Use #{selected.customer_no}
    </button>
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
        <Merge className="size-4 text-navy-700 dark:text-white" />
        <span className="flex-1 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Merge customers</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        <p className="text-[11px] text-ink-500">Click a customer in the table, then use it below - or search here.</p>
        <section className="rounded-md border border-rose-200 p-2 dark:border-rose-900/60">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-rose-700 uppercase dark:text-rose-300">
            <Trash2 className="size-3.5" /><span className="flex-1">Duplicate - will be removed</span>{useRow(setFrom)}
          </p>
          <CustomerPicker value={from} onChange={setFrom} allowCreate={false} />
        </section>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-400"><ArrowDown className="size-3.5" />loans, photos and documents move to</div>
        <section className="rounded-md border border-emerald-200 p-2 dark:border-emerald-900/60">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
            <UserCheck className="size-3.5" /><span className="flex-1">Keep this customer</span>{useRow(setTo)}
          </p>
          <CustomerPicker value={to} onChange={setTo} allowCreate={false} />
        </section>
        {same && <p className="rounded-md border-l-2 border-rose-600 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">Pick two different customers.</p>}
        <div className="mt-auto pt-1">
          <Button variant="gold" icon={Merge} className="h-9 w-full" disabled={!from || !to || same} onClick={() => setConfirm(true)}>Merge customers</Button>
        </div>
      </div>
      <ConfirmDrawer open={confirm} onClose={() => setConfirm(false)} title="Merge customers?" loading={merge.isPending}
        message={`All loans of #${from?.customer_no} ${from?.name} will be moved to #${to?.customer_no} ${to?.name}. This cannot be undone.`}
        onConfirm={() => merge.mutate({ body: { fromId: from.id, toId: to.id } }, { onSuccess: () => { setConfirm(false); setFrom(null); setTo(null); } })} />
    </section>
  );
}

/** Old address /customers/merge - opens the Customers page with the merge section. */
export default function MergeCustomersPage() {
  return <Navigate to="/customers?merge=1" replace />;
}
