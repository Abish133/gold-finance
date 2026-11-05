import { Input, Field, Select } from '@/components/ui';
import { useList } from '@/hooks/useApi';

export function DateRange({ value, onChange, single }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {!single && <Field label="From"><Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></Field>}
      <Field label={single ? 'As on' : 'To'}><Input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></Field>
    </div>
  );
}

export function LedgerSelect({ value, onChange, filter, placeholder = 'Select account', className }) {
  const { data } = useList('/accounts/ledgers', { all: 1, pageSize: 500 }, { staleTime: 60_000 });
  const opts = (data?.data || []).filter((l) => (filter ? filter(l) : true)).map((l) => ({ value: l.id, label: `${l.name} · ${l.group_name}` }));
  return <Select className={className} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} options={opts} />;
}

export const STATEMENT_COLUMNS = [
  { key: 'entry_date', label: 'Date', type: 'date' },
  { key: 'voucher_no', label: 'Voucher' },
  { key: 'narration', label: 'Particulars' },
  { key: 'debit', label: 'Debit (In)', type: 'money' },
  { key: 'credit', label: 'Credit (Out)', type: 'money' },
  { key: 'balance', label: 'Balance', type: 'money', render: (r) => <span className="font-semibold">{Math.abs(r.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {r.balance >= 0 ? 'Dr' : 'Cr'}</span> },
];
