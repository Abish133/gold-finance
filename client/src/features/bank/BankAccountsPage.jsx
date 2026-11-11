import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet, BookOpen, Printer, LogOut, Building2, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, ConfirmDrawer, Drawer, Field, Input, Select, Textarea } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, n } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

const USED = { PLEDGE: 'Potali', OPERATING: 'Online money', BOTH: 'Both' };
const cols = [{ key: 'code', label: 'Code' }, { key: 'bank_name', label: 'Bank Name' }, { key: 'bank_branch', label: 'Branch' }, { key: 'account_no', label: 'A/c No' }, { key: 'used', label: 'Used For' }, { key: 'open_count', label: 'Open', type: 'number' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }];
const FIELDS = [['bank_name', 'Bank name *'], ['bank_branch', 'Bank branch'], ['account_name', 'Account name'], ['account_no', 'Account no'], ['ifsc', 'IFSC'], ['customer_id_at_bank', 'Customer ID at bank'], ['phone', 'Phone'], ['opened_on', 'Opened on', 'date']];

/** Bank Accounts (desktop): banks for bank loans (potali) and for online / card / cheque money. */
export default function BankAccountsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data = [], refetch } = useFetch('/bank/accounts-summary');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(false);
  const rows = useMemo(() => data.filter((r) => !q || `${r.bank_name} ${r.bank_branch} ${r.account_no}`.toLowerCase().includes(q.toLowerCase()))
    .map((r, i) => ({ ...r, code: i + 1, used: USED[r.used_for] || r.used_for })), [data, q]);
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ['/masters/lookups'] }); };
  const save = async () => {
    if (!edit.bank_name) return toast.error('Enter bank name');
    try {
      const body = Object.fromEntries(Object.entries(edit).filter(([k]) => [...FIELDS.map((f) => f[0]), 'used_for', 'address', 'is_active'].includes(k)));
      if (edit.id) await api.put(`/masters/bank-accounts/${edit.id}`, body); else await api.post('/masters/bank-accounts', body);
      toast.success('Bank saved'); setEdit(null); refresh();
    } catch (e) { toast.error(e.message); }
  };
  const remove = async () => { try { await api.del(`/masters/bank-accounts/${sel.id}`); toast.success('Bank deleted'); setDel(false); setSel(null); refresh(); } catch (e) { toast.error(e.message); } };
  const print = () => printTable({ title: 'Bank Accounts', company, columns: cols, rows });
  useKeys({ 'ctrl+n': () => !isAllBranches && setEdit({ used_for: 'BOTH', is_active: 1 }), f2: () => sel && setEdit(sel), delete: () => sel && setDel(true), f6: () => navigate('/bank/book'), f9: print, 'ctrl+p': print, 'ctrl+e': () => exportCsv('bank-accounts', cols, rows), escape: () => navigate('/') }, [sel, rows]);
  const tile = (l, v, h, bar) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );
  return (
    /* fit-screen: the page fits the window; tables and panels scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white"><h1 className="text-lg font-bold whitespace-nowrap">Bank Accounts</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Banks for bank loans (potali) and for online / card / cheque money</p></section>
      <div className="flex items-end gap-3 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900"><Field label="Search bank / branch / a/c no" className="w-96"><Input autoFocus prefix={<Search className="size-3.5" />} value={q} onChange={(e) => setQ(e.target.value)} /></Field><span className="ml-auto pb-2 text-[11px] text-ink-500">{rows.length} of {data.length} bank accounts</span></div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {tile('Bank accounts', data.length, 'all', 'bg-navy-800')}
        {tile('With open bank loans', data.filter((r) => n(r.open_count)).length, '', 'bg-violet-600')}
        {tile('Open potali', data.reduce((s, r) => s + n(r.open_count), 0), 'potali not released', 'bg-blue-600')}
        {tile('Outstanding', `Rs ${amount(data.reduce((s, r) => s + n(r.outstanding), 0))}`, 'bank loan amount outstanding', 'bg-rose-600')}
      </div>
      <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full text-[12px]">
          <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{cols.map((c) => <th key={c.key} className={clsx('px-3 py-1.5 font-semibold', ['money', 'number'].includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-[12px] text-ink-400">No bank accounts - press New Bank (Ctrl+N)</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => setEdit(r)} className={clsx('cursor-pointer', sel?.id === r.id && 'bg-emerald-50 dark:bg-emerald-950/30', !r.is_active && 'text-ink-400')}>
                <td className="px-3 py-1">{r.code}</td><td className="px-3 font-semibold">{r.bank_name}</td><td className="px-3">{r.bank_branch}</td><td className="px-3">{r.account_no}</td><td className="px-3">{r.used}</td>
                <td className="num px-3 text-right">{r.open_count}</td><td className="num px-3 text-right">{amount(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        {can('bank_accounts', 'add') && !isAllBranches && <Button variant="outline" icon={Plus} onClick={() => setEdit({ used_for: 'BOTH', is_active: 1 })}>New Bank (Ctrl+N)</Button>}
        {can('bank_accounts', 'edit') && <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => setEdit(sel)}>Edit (F2)</Button>}
        {can('bank_accounts', 'delete') && <Button variant="soft-danger" icon={Trash2} disabled={!sel} onClick={() => setDel(true)}>Delete (Del)</Button>}
        <span className="flex-1" />
        <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('bank-accounts', cols, rows)}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={BookOpen} onClick={() => navigate('/bank/book')}>Bank Pledge Book (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">Ctrl+N = new bank · F2 / double-click = edit · Del = delete · F6 = bank pledge book · F9 = print · Esc = exit</p>
      <Drawer open={!!edit} onClose={() => setEdit(null)} size="md" icon={Building2} title={edit?.id ? `Edit bank · ${edit.bank_name}` : 'New bank'} subtitle="A ledger is created automatically for each bank account" footer={<Button variant="gold" onClick={save}>Save (F2)</Button>}>
        {edit && (
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, l, type]) => <Field key={k} label={l}><Input type={type || 'text'} value={edit[k] ? String(edit[k]).slice(0, type === 'date' ? 10 : 200) : ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
            <Field label="Used for"><Select value={edit.used_for || 'BOTH'} onChange={(e) => setEdit({ ...edit, used_for: e.target.value })} options={[{ value: 'PLEDGE', label: 'Potali (bank loans)' }, { value: 'OPERATING', label: 'Online / card / cheque money' }, { value: 'BOTH', label: 'Both' }]} /></Field>
            <Field label="Active"><Select value={String(edit.is_active ?? 1)} onChange={(e) => setEdit({ ...edit, is_active: Number(e.target.value) })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} /></Field>
            <Field label="Address" className="col-span-2"><Textarea rows={2} value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
      <ConfirmDrawer open={del} onClose={() => setDel(false)} onConfirm={remove} title={`Delete ${sel?.bank_name}?`} message="Banks already used in bank loans or payments cannot be deleted - set them inactive instead." />
    </div>
  );
}
