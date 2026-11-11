import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, RefreshCw, FileDown, FileSpreadsheet, Printer, Lock, Scale } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Badge, Button, ConfirmDrawer, Drawer, Field, Input, Select, Switch } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { NATURE_TONE, jn } from './LedgerReportPage';

const VIEWS = [
  ['all', 'All accounts', () => true], ['mine', 'My accounts', (l) => !l.is_system], ['system', 'System (locked)', (l) => !!l.is_system],
  ['bs', 'Balance Sheet', (l) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(l.nature)], ['asset', '· Assets', (l) => l.nature === 'ASSET'], ['liab', '· Liabilities', (l) => ['LIABILITY', 'EQUITY'].includes(l.nature)],
  ['pl', 'Profit & Loss', (l) => ['INCOME', 'EXPENSE'].includes(l.nature)], ['inc', '· Income', (l) => l.nature === 'INCOME'], ['exp', '· Expenditure', (l) => l.nature === 'EXPENSE'],
];

/** Account Master (desktop: frmAccountMaster) - ledger accounts: add, edit, opening balance. */
export default function LedgersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, isAllBranches } = useAuth();
  const { data: company } = useCompany();
  const { data: ledgers = [], refetch } = useFetch('/desk/ledger-balances');
  const { data: groups = [] } = useFetch('/accounts/groups');
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const filter = VIEWS.find((v) => v[0] === view)[2];
  const rows = useMemo(() => ledgers.filter(filter).filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || String(l.id) === q), [ledgers, filter, q]);
  const cols = [{ key: 'id', label: 'A/c No' }, { key: 'name', label: 'A/c Name' }, { key: 'group_name', label: 'Group' }, { key: 'balance', label: 'Balance', print: (r) => jn(r.balance) }];
  const save = async () => {
    try {
      const body = { name: edit.name, group_id: edit.group_id, code: edit.code, is_active: edit.is_active ? 1 : 0 };
      const r = edit.id ? await api.put(`/accounts/ledgers/${edit.id}`, body) : await api.post('/accounts/ledgers', body);
      if (edit.opening !== '' && edit.opening != null && !isAllBranches) await api.put(`/accounts/ledgers/${r.data.id}/opening`, { amount: Math.abs(Number(edit.opening)), type: edit.opening_type });
      toast.success('Account saved'); setEdit(null); refetch(); qc.invalidateQueries({ queryKey: ['/accounts/ledgers'] });
    } catch (e) { toast.error(e.message); }
  };
  const openNew = () => setEdit({ name: '', group_id: groups[0]?.id, code: '', is_active: true, opening: '', opening_type: 'DR' });
  const openEdit = (l) => l && setEdit({ ...l, is_active: !!l.is_active, opening: '', opening_type: 'DR' });
  const print = () => printTable({ title: 'Account Master', company, columns: cols, rows });
  useKeys({ f2: () => can('acc_ledgers', 'add') && openNew(), f3: () => openEdit(sel), delete: () => sel && !sel.is_system && setDel(sel), f4: () => sel && navigate('/accounts/ledger'), f6: () => refetch(), 'ctrl+p': print, 'ctrl+e': () => exportCsv('accounts', cols, rows) }, [sel, rows, groups]);

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex flex-wrap items-center gap-4 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Account Master</h1><p className="text-sm text-navy-100">Your ledger accounts - add, edit, opening balance</p></div>
        <span className="text-sm">Find A/c</span><Input className="w-80 bg-gold-50 text-ink-900" value={q} onChange={(e) => setQ(e.target.value)} />
      </section>
      <div className="grid items-start gap-3 xl:grid-cols-[260px_1fr]">
        <div className="card p-2">
          <p className="label px-2 pt-1">Show</p>
          {VIEWS.map(([k, label, fn]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={clsx('flex w-full justify-between rounded-md px-3 py-1.5 text-left text-sm', view === k ? 'bg-navy-800 text-white' : 'hover:bg-navy-50', label.startsWith('·') && 'pl-6')}>
              <span>{label.replace('· ', '')}</span><span>({ledgers.filter(fn).length})</span>
            </button>
          ))}
          <div className="mt-3 border-t border-ink-200 px-3 pt-2 text-sm">
            <p className="label">Totals</p>
            <div className="flex justify-between"><span>Accounts</span><b>{ledgers.length}</b></div>
            <div className="flex justify-between"><span>My accounts</span><b>{ledgers.filter((l) => !l.is_system).length}</b></div>
            <div className="flex justify-between"><span>System (locked)</span><b>{ledgers.filter((l) => l.is_system).length}</b></div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <p className="border-b border-ink-200 px-4 py-2 font-bold text-navy-900">{VIEWS.find((v) => v[0] === view)[1].replace('· ', '')}</p>
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr><th className="w-20 px-3 py-2 text-left">A/c No</th><th className="px-3 text-left">A/c Name</th><th className="px-3 text-left">Group</th><th className="px-3 text-right">Balance</th><th className="w-8" /></tr></thead>
            <tbody className="divide-y divide-ink-200">
              {rows.map((l) => (
                <tr key={l.id} onClick={() => setSel(l)} onDoubleClick={() => openEdit(l)} className={clsx('cursor-pointer text-base hover:bg-navy-50/60', sel?.id === l.id && 'bg-cream-200', !l.is_active && 'opacity-50')}>
                  <td className="px-3 py-1.5">{l.id}</td><td className="px-3">{l.name}</td>
                  <td className="px-3"><Badge tone={NATURE_TONE[l.nature]} className="text-[10px]">{l.group_name}</Badge></td>
                  <td className={clsx('num px-3 text-right', l.balance > 0 ? 'text-rose-600' : 'text-emerald-700')}>{jn(l.balance)}</td>
                  <td className="px-2">{l.is_system ? <Lock className="size-3.5 text-gold-600" /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        {can('acc_ledgers', 'add') && <Button variant="outline" icon={Plus} onClick={openNew}>New Account (F2)</Button>}
        <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => openEdit(sel)}>Edit (F3)</Button>
        <Button variant="soft-danger" icon={Trash2} disabled={!sel || sel.is_system} onClick={() => setDel(sel)}>Delete (Del)</Button>
        <Button variant="outline" icon={BookOpen} disabled={!sel} onClick={() => navigate('/accounts/ledger')}>Ledger (F4)</Button>
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('accounts', cols, rows)}>Excel (Ctrl+E)</Button>
          <Button variant="outline" icon={Printer} onClick={print}>Print List</Button>
          <ExitButton />
        </div>
      </div>
      <Drawer open={!!edit} onClose={() => setEdit(null)} size="sm" icon={Scale} title={edit?.id ? `Edit A/c ${edit.id}` : 'New account'} footer={<Button variant="gold" onClick={save}>Save</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label="A/c name"><Input autoFocus disabled={edit.is_system} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Group"><Select disabled={edit.is_system} value={edit.group_id} onChange={(e) => setEdit({ ...edit, group_id: e.target.value })} options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.nature})` }))} /></Field>
            <Field label="Code"><Input value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
            {!isAllBranches && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Opening balance (this branch)"><Input type="number" value={edit.opening} onChange={(e) => setEdit({ ...edit, opening: e.target.value })} /></Field>
                <Field label="Type"><Select value={edit.opening_type} onChange={(e) => setEdit({ ...edit, opening_type: e.target.value })} options={[{ value: 'DR', label: 'Nave (Dr)' }, { value: 'CR', label: 'Jama (Cr)' }]} /></Field>
              </div>
            )}
            <Switch checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Active" />
          </div>
        )}
      </Drawer>
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} message="Accounts used in vouchers cannot be deleted - make them inactive instead."
        onConfirm={async () => { try { await api.del(`/accounts/ledgers/${del.id}`); toast.success('Deleted'); setDel(null); setSel(null); refetch(); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
