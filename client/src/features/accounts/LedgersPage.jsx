import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, RefreshCw, FileDown, FileSpreadsheet, Printer, Lock, Scale, Layers, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Badge, Button, ConfirmDrawer, Field, Input, Select, Switch, Modal } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { NATURE_TONE, jn } from './LedgerReportPage';
import { amount } from '@/lib/format';
import { SHELL, Head, Chip, Dot, Bar, Actions, thead, tfoot, inp } from './compact';
import { RowActions, ActionsHead } from '@/components/common/RowActions';

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
  useKeys({ f2: () => can('acc_ledgers', 'add') && openNew(), f3: () => openEdit(sel), delete: () => sel && !sel.is_system && setDel(sel), f4: () => sel && navigate(`/accounts/ledger?ledger=${sel.id}`), f6: () => refetch(), 'ctrl+p': print, 'ctrl+e': () => exportCsv('accounts', cols, rows) }, [sel, rows, groups]);

  const viewLabel = VIEWS.find((v) => v[0] === view)[1].replace('· ', '');
  const totalDr = rows.reduce((s, l) => s + (l.balance > 0 ? l.balance : 0), 0);
  const totalCr = rows.reduce((s, l) => s + (l.balance < 0 ? -l.balance : 0), 0);
  return (
    /* fit-screen: views on the left, the account list scrolls on its own */
    <div className={SHELL}>
      <Head icon={Layers} title="Account Master" sub="Your ledger accounts - add, edit, opening balance">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip label="Accounts" value={ledgers.length} />
          <Chip label="Mine" value={ledgers.filter((l) => !l.is_system).length} />
          <Chip label="Locked" value={ledgers.filter((l) => l.is_system).length} />
        </div>
      </Head>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[230px_1fr]">
        <div className="card flex flex-col overflow-hidden xl:min-h-0">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" /><p className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Show</p></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {VIEWS.map(([k, label, fn]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={clsx('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px]', view === k ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800', label.startsWith('·') && 'pl-6')}>
                <span className="flex-1 truncate">{label.replace('· ', '')}</span>{view === k && <Dot />}<span className="num rounded-sm bg-ink-100 px-1.5 text-[10px] dark:bg-ink-800">{ledgers.filter(fn).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          <Bar className="!items-center">
            <div className="w-72"><Input autoFocus prefix={<Search className="size-3.5" />} className={inp} placeholder="Find A/c - name or number" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <span className="text-[11px] text-ink-500">Click = select · double-click = edit</span>
            {can('acc_ledgers', 'add') && <Button variant="gold" className="ml-auto h-8 text-[12px]" icon={Plus} onClick={openNew}>New Account (F2)</Button>}
          </Bar>
          <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" /><p className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{viewLabel}</p><span className="ml-auto text-[11px] text-ink-500">{rows.length} accounts</span></div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[12px]">
                <thead className={thead}><tr><th className="w-20 px-3 py-2 text-left">A/c No</th><th className="px-3 text-left">A/c Name</th><th className="px-3 text-left">Group</th><th className="px-3 text-right">Balance</th><th className="w-8" /><ActionsHead /></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {rows.map((l) => (
                    <tr key={l.id} onClick={() => setSel(l)} onDoubleClick={() => openEdit(l)} className={clsx('cursor-pointer', sel?.id === l.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50', !l.is_active && 'opacity-50')}>
                      <td className="num px-3 py-1.5"><span className="flex items-center gap-1.5">{sel?.id === l.id && <Dot />}{l.id}</span></td><td className="px-3 font-medium">{l.name}</td>
                      <td className="px-3"><Badge tone={NATURE_TONE[l.nature]} className="text-[10px]">{l.group_name}</Badge></td>
                      <td className={clsx('num px-3 text-right whitespace-nowrap', l.balance > 0 ? 'text-rose-600' : 'text-emerald-700')}>{jn(l.balance)}</td>
                      <td className="px-2">{l.is_system ? <Lock className="size-3.5 text-gold-600" /> : null}</td>
                      <td className="px-2 py-0.5 text-right"><RowActions actions={[{ icon: Pencil, label: 'Edit account', onClick: () => openEdit(l) }, { icon: BookOpen, label: 'Open ledger', onClick: () => navigate(`/accounts/ledger?ledger=${l.id}`) }, { icon: Trash2, label: 'Delete account', tone: 'danger', disabled: !!l.is_system, onClick: () => setDel(l) }]} /></td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={6} className="py-12 text-center text-ink-400">No account found</td></tr>}
                </tbody>
                <tfoot className={tfoot}><tr><td colSpan={3} className="px-3 py-1.5 text-[11px] tracking-wider uppercase">Total · {rows.length} accounts</td><td className="num px-3 text-right whitespace-nowrap"><span className="text-rose-600">{amount(totalDr)} Nave</span> · <span className="text-emerald-700">{amount(totalCr)} Jama</span></td><td /><td /></tr></tfoot>
              </table>
            </div>
          </div>
          <Actions hint="F2 New · F3 Edit · Del Delete · F4 Ledger · F6 Refresh · Ctrl+P PDF · Ctrl+E Excel">
            <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => openEdit(sel)}>Edit (F3)</Button>
            <Button variant="soft-danger" icon={Trash2} disabled={!sel || sel.is_system} onClick={() => setDel(sel)}>Delete (Del)</Button>
            <Button variant="outline" icon={BookOpen} disabled={!sel} onClick={() => navigate(`/accounts/ledger?ledger=${sel.id}`)}>Ledger (F4)</Button>
            <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
            <Button variant="outline" icon={FileDown} onClick={print}>PDF</Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('accounts', cols, rows)}>Excel</Button>
            <Button variant="outline" icon={Printer} onClick={print}>Print List</Button>
            <ExitButton />
          </Actions>
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} size="md" icon={Scale} title={edit?.id ? `Edit A/c ${edit.id}` : 'New account'} footer={<Button variant="gold" onClick={save}>Save</Button>}>
        {edit && (
          <div className="dense space-y-2.5">
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
      </Modal>
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} message="Accounts used in vouchers cannot be deleted - make them inactive instead."
        onConfirm={async () => { try { await api.del(`/accounts/ledgers/${del.id}`); toast.success('Deleted'); setDel(null); setSel(null); refetch(); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
