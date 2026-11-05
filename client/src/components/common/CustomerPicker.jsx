import { useState } from 'react';
import { UserPlus, X, Phone, MapPin } from 'lucide-react';
import { Avatar, Badge, Button, SearchInput, Spinner } from '@/components/ui';
import { useList } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useUtils';
import { CustomerFormDrawer } from '@/features/customers/CustomerFormDrawer';
import { money } from '@/lib/format';

/** Search-as-you-type customer selector with inline "new customer". */
export function CustomerPicker({ value, onChange, allowCreate = true }) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const dq = useDebounce(q, 250);
  const list = useList('/customers', { search: dq, pageSize: 8, status: '' }, { enabled: !value && dq.length >= 1 });

  if (value) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-gold-200 bg-gold-50/60 p-4 dark:border-gold-500/20 dark:bg-gold-500/5">
        <Avatar src={value.photo} name={value.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-ink-900 dark:text-white">{value.title} {value.name}</p>
            <Badge tone="gold">#{value.customer_no}</Badge>
            {value.status === 'BLOCKED' && <Badge tone="red">Blocked</Badge>}
          </div>
          {value.relation_name && <p className="text-sm text-ink-500">{value.relation_type} {value.relation_name}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600 dark:text-ink-300">
            <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{value.phone}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[value.door_no, value.street, value.area, value.city].filter(Boolean).join(', ') || '—'}</span>
          </div>
          {value.open_loans > 0 && <p className="mt-2 text-xs font-medium text-ink-500">{value.open_loans} open loans · {money(value.outstanding)} outstanding</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Change customer"><X className="size-4" /></Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search customer by name / mobile / customer no…" className="flex-1" autoFocus />
        {allowCreate && <Button variant="soft" icon={UserPlus} onClick={() => setCreating(true)}>New</Button>}
      </div>
      {list.isFetching && <Spinner className="py-4" />}
      {dq && list.data?.data && (
        <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
          {list.data.data.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChange(c); setQ(''); }}
              className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-gold-50 dark:hover:bg-gold-500/10">
              <Avatar src={c.photo} name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name} <span className="text-xs font-normal text-ink-400">#{c.customer_no}</span></p>
                <p className="truncate text-xs text-ink-500">{c.phone} · {c.area || '—'}</p>
              </div>
              {c.status === 'BLOCKED' ? <Badge tone="red">Blocked</Badge> : c.open_loans > 0 && <Badge tone="gold">{c.open_loans} open</Badge>}
            </button>
          ))}
          {!list.data.data.length && <p className="p-3 text-sm text-ink-500">No customer found. {allowCreate && 'Click “New” to add.'}</p>}
        </div>
      )}
      <CustomerFormDrawer open={creating} onClose={() => setCreating(false)} onSaved={(c) => onChange(c)} />
    </div>
  );
}
