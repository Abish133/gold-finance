import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { KeyRound, Plus, Pencil, Trash2, Shield, Printer, LogOut, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Badge, Button, Checkbox, ConfirmDrawer, Drawer, Input, Select } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { useList, useSaveResource, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { date } from '@/lib/format';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { useKeys } from '@/features/loans/desk';
import { PageActions } from '@/components/common/PageActions';

export default function UsersPage() {
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  const { data: company } = useCompany();
  const [q, setQ] = useState('');
  const [show, setShow] = useState('');
  const [roleF, setRoleF] = useState('');
  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const list = useList('/admin/users', { pageSize: 500 });
  const roles = useList('/admin/roles', { all: 1 });
  const [edit, setEdit] = useState(null);
  const [branches, setBranches] = useState([]);
  const form = useForm();
  const save = useSaveResource('/admin/users', { onDone: () => setEdit(null) });

  useEffect(() => {
    if (!edit) return;
    form.reset({ is_active: 1, ...edit, password: '' });
    setBranches(edit.branch_ids ? String(edit.branch_ids).split(',').map(Number) : []);
  }, [edit, form]);

  const role = (roles.data?.data || []).find((r) => String(r.id) === String(form.watch('role_id')));
  const all = list.data?.data || [];
  const roleName = (u) => (u.is_super_admin ? 'Super Admin' : u.role_name);
  // desktop User Accounts: search, All / Active / Inactive, role filter
  const rows = all.filter((u) => (!show || (show === 'active' ? u.is_active : !u.is_active)) && (!roleF || roleName(u) === roleF)
    && (!q.trim() || `${u.username} ${u.full_name} ${roleName(u)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const roleNames = [...new Set(all.map(roleName))];
  const cols = [{ key: 'id', label: 'ID' }, { key: 'username', label: 'User Name' }, { key: 'full_name', label: 'Employee' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }, { key: 'last_login_at', label: 'Last Activity', type: 'date' }];
  const print = () => printTable({ title: 'User Accounts', company, columns: cols, rows: rows.map((u) => ({ ...u, username: String(u.username).toUpperCase(), role: roleName(u), status: u.is_active ? 'Active' : 'Inactive' })) });
  const remove = async () => {
    try { await api.del(`/admin/users/${del.id}`); toast.success('User deleted'); setDel(null); setSel(null); list.refetch(); } catch (e) { toast.error(e.message); }
  };
  useKeys({ 'ctrl+n': () => can('s_users', 'add') && setEdit({}), f2: () => sel && can('s_users', 'edit') && setEdit(sel), delete: () => sel && can('s_users', 'delete') && sel.id !== me.id && setDel(sel),
    f6: () => navigate('/settings/roles'), f9: print, escape: () => navigate('/') }, [sel, rows]);
  const seg = (v, l) => <button key={l} type="button" onClick={() => setShow(v)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', show === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{show === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>;
  const tile = (l, v, h, cls) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', cls)} />
      <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="flex items-baseline gap-2"><span className="num text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</span><span className="truncate text-[10px] text-ink-500">{h}</span></p>
    </div>
  );

  return (
    /* fit-screen: the page fits the window; only the user list scrolls */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">User Accounts</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Login users - role, branch, status and password</p></div></section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <div className="w-72"><p className="label">Search</p><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Name, user name, mobile…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div><p className="label">Show</p><div className="flex">{seg('', 'All')}{seg('active', 'Active')}{seg('inactive', 'Inactive')}</div></div>
        <div className="w-52"><p className="label">Role</p><Select className="!h-8 text-[13px]" value={roleF} onChange={(e) => setRoleF(e.target.value)} options={[{ value: '', label: 'All roles' }, ...roleNames.map((r) => ({ value: r, label: r }))]} /></div>
        <span className="ml-auto self-end pb-2 text-[11px] text-ink-500">Rows shown: {rows.length}</span>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {tile('Users', all.length, 'all', 'bg-navy-900 dark:bg-white')}
        {tile('Active', all.filter((u) => u.is_active).length, 'can log in', 'bg-emerald-600')}
        {tile('Inactive', all.filter((u) => !u.is_active).length, 'cannot log in', 'bg-rose-600')}
        {tile('Roles', roleNames.length, roleNames.join(', '), 'bg-amber-500')}
      </div>
      <div className="min-h-64 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
        <table className="w-full text-[12px]">
          <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['ID', 'User Name', 'Employee', 'Role', 'Branches', 'Status', 'Last Activity'].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!rows.length && <tr><td colSpan={7} className="py-10 text-center text-[12px] text-ink-400">{list.isLoading ? 'Loading…' : 'No users'}</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setSel(u)} onDoubleClick={() => can('s_users', 'edit') && setEdit(u)} className={clsx('cursor-pointer', sel?.id === u.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')} title="Double-click to edit">
                <td className="num px-3 py-1">{u.id}</td><td className="px-3 font-bold uppercase">{u.username}</td><td className="px-3">{u.full_name}</td>
                <td className="px-3"><Badge tone={u.is_super_admin ? 'gold' : 'blue'}>{roleName(u)}</Badge></td>
                <td className="max-w-56 truncate px-3 text-[11px] text-ink-600 dark:text-ink-300">{u.is_super_admin || u.all_branches ? 'All branches' : u.branch_names}</td>
                <td className="px-3">{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                <td className="px-3">{u.last_login_at ? date(u.last_login_at) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PageActions keys="Ctrl+N = new user · F2 / double-click = edit · Del = delete user · F6 = roles and permissions · F9 = print · Esc = exit">
        {can('s_users', 'add') && <Button variant="outline" icon={Plus} onClick={() => setEdit({})}>New User (Ctrl+N)</Button>}
        {can('s_users', 'edit') && <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => setEdit(sel)}>Edit User (F2)</Button>}
        {can('s_users', 'delete') && <Button variant="soft-danger" icon={Trash2} disabled={!sel || sel.id === me.id} onClick={() => setDel(sel)}>Delete User (Del)</Button>}
        <span className="flex-1" />
        <Button variant="outline" icon={Shield} onClick={() => navigate('/settings/roles')}>Roles &amp; Permissions (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </PageActions>
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} onConfirm={remove} title={`Delete user ${del?.username}?`} message="The user cannot log in any more. Entries made by the user stay in the books." confirmText="Delete" />
      <Drawer open={!!edit} onClose={() => setEdit(null)} icon={KeyRound} size="lg" bodyClassName="dense !px-4 !py-3" title={edit?.id ? `Edit ${edit.full_name}` : 'New user'}
        footer={<><Button variant="soft-danger" onClick={() => setEdit(null)}>Cancel (Esc)</Button><Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, id: edit.id, branch_ids: branches }))}>Save</Button></>}>
        <FormFields dense form={form} fields={[
          { name: 'full_name', label: 'Full name', required: true }, { name: 'username', label: 'Username', required: true },
          { name: 'password', label: edit?.id ? 'New password (leave blank to keep)' : 'Password', type: 'password', required: !edit?.id },
          { name: 'role_id', label: 'Role', type: 'select', required: true, options: (roles.data?.data || []).filter((r) => r.is_active).map((r) => ({ value: r.id, label: r.name })) },
          { name: 'phone', label: 'Mobile' }, { name: 'email', label: 'Email' },
          { name: 'is_active', label: 'Active', type: 'switch' },
        ]} />
        <div className="mt-3">
          <p className="label">Branch access</p>
          {role?.all_branches ? <Badge tone="violet">This role can access all branches</Badge> : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {me.branches.map((b) => (
                <div key={b.id} className={clsx('rounded-md border px-2.5 py-1.5 text-[13px]', branches.includes(b.id) ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-ink-200 dark:border-ink-700')}>
                  <Checkbox checked={branches.includes(b.id)} onChange={(c) => setBranches((x) => (c ? [...x, b.id] : x.filter((y) => y !== b.id)))} label={`${b.name} (${b.code})`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
