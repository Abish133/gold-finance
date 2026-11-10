import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { KeyRound, Plus, Pencil, Trash2, Shield, Printer, LogOut } from 'lucide-react';
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
  const seg = (v, l) => <button key={l} type="button" onClick={() => setShow(v)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', show === v ? 'border-navy-300 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>;
  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">User Accounts</h1><p className="text-sm text-navy-100">Login users - role, branch, status and password</p></section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <div className="w-72"><p className="label">Search</p><Input value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div><p className="label">Show</p><div className="flex gap-1">{seg('', 'All')}{seg('active', 'Active')}{seg('inactive', 'Inactive')}</div></div>
        <div className="w-56"><p className="label">Role</p><Select value={roleF} onChange={(e) => setRoleF(e.target.value)} options={[{ value: '', label: 'All roles' }, ...roleNames.map((r) => ({ value: r, label: r }))]} /></div>
        <span className="ml-auto self-end text-xs text-ink-500">Rows shown: {rows.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {tile('Users', all.length, 'all', 'border-t-navy-800 bg-cream-100')}
        {tile('Active', all.filter((u) => u.is_active).length, 'can log in', 'border-t-emerald-700')}
        {tile('Inactive', all.filter((u) => !u.is_active).length, 'cannot log in', 'border-t-rose-600')}
        {tile('Roles', roleNames.length, roleNames.join(', '), 'border-t-amber-500')}
      </div>
      <div className="card min-h-[calc(100vh-30rem)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="navy-gradient text-white"><tr>{['ID', 'User Name', 'Employee', 'Role', 'Branches', 'Status', 'Last Activity'].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {!rows.length && <tr><td colSpan={7} className="py-12 text-center text-ink-400">{list.isLoading ? 'Loading…' : 'No users'}</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setSel(u)} onDoubleClick={() => can('s_users', 'edit') && setEdit(u)} className={clsx('cursor-pointer hover:bg-navy-50/50', sel?.id === u.id && 'bg-cream-200 dark:bg-ink-800')}>
                <td className="px-3 py-1.5">{u.id}</td><td className="px-3 font-bold uppercase">{u.username}</td><td className="px-3">{u.full_name}</td>
                <td className="px-3"><Badge tone={u.is_super_admin ? 'gold' : 'blue'}>{roleName(u)}</Badge></td>
                <td className="px-3 text-xs">{u.is_super_admin || u.all_branches ? 'All branches' : u.branch_names}</td>
                <td className="px-3">{u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                <td className="px-3">{u.last_login_at ? date(u.last_login_at) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        {can('s_users', 'add') && <Button variant="outline" icon={Plus} onClick={() => setEdit({})}>New User (Ctrl+N)</Button>}
        {can('s_users', 'edit') && <Button variant="outline" icon={Pencil} disabled={!sel} onClick={() => setEdit(sel)}>Edit User (F2)</Button>}
        {can('s_users', 'delete') && <Button variant="outline" icon={Trash2} disabled={!sel || sel.id === me.id} onClick={() => setDel(sel)}>Delete User (Del)</Button>}
        <span className="flex-1" />
        <Button variant="outline" icon={Shield} onClick={() => navigate('/settings/roles')}>Roles &amp; Permissions (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">Ctrl+N = new user · F2 / double-click = edit · Del = delete user · F6 = roles and permissions · F9 = print · Esc = exit</p>
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} onConfirm={remove} title={`Delete user ${del?.username}?`} message="The user cannot log in any more. Entries made by the user stay in the books." confirmText="Delete" />
      <Drawer open={!!edit} onClose={() => setEdit(null)} icon={KeyRound} size="lg" title={edit?.id ? `Edit ${edit.full_name}` : 'New user'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, id: edit.id, branch_ids: branches }))}>Save</Button></>}>
        <FormFields form={form} fields={[
          { name: 'full_name', label: 'Full name', required: true }, { name: 'username', label: 'Username', required: true },
          { name: 'password', label: edit?.id ? 'New password (leave blank to keep)' : 'Password', type: 'password', required: !edit?.id },
          { name: 'role_id', label: 'Role', type: 'select', required: true, options: (roles.data?.data || []).filter((r) => r.is_active).map((r) => ({ value: r.id, label: r.name })) },
          { name: 'phone', label: 'Mobile' }, { name: 'email', label: 'Email' },
          { name: 'is_active', label: 'Active', type: 'switch' },
        ]} />
        <div className="mt-6">
          <p className="label">Branch access</p>
          {role?.all_branches ? <Badge tone="violet">This role can access all branches</Badge> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {me.branches.map((b) => (
                <div key={b.id} className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
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
