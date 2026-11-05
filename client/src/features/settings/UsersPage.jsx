import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound, Plus } from 'lucide-react';
import { Avatar, Badge, Button, Checkbox, DataTable, Drawer, PageHeader, SearchInput } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { useList, useSaveResource } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { dateTime } from '@/lib/format';

export default function UsersPage() {
  const { can, user: me } = useAuth();
  const [state, set] = useTableState();
  const search = useDebounce(state.search);
  const list = useList('/admin/users', { ...state, search });
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

  return (
    <div className="animate-rise">
      <PageHeader icon={KeyRound} title="Users" subtitle="Login accounts, role and branch access" actions={can('s_users', 'add') && <Button variant="gold" icon={Plus} onClick={() => setEdit({})}>Add user</Button>} />
      <SearchInput className="mb-4 w-full sm:w-80" value={state.search} onChange={(v) => set({ search: v })} />
      <DataTable rows={list.data?.data} loading={list.isLoading} meta={list.data?.meta} onPage={(page) => set({ page })} onRowClick={can('s_users', 'edit') ? setEdit : undefined} columns={[
        { key: 'full_name', label: 'User', render: (r) => <div className="flex items-center gap-3"><Avatar name={r.full_name} size="sm" /><div><p className="font-semibold">{r.full_name}</p><p className="text-xs text-ink-500">@{r.username}</p></div></div> },
        { key: 'role_name', label: 'Role', render: (r) => <Badge tone={r.is_super_admin ? 'gold' : 'blue'}>{r.is_super_admin ? 'Super Admin' : r.role_name}</Badge> },
        { key: 'branch_names', label: 'Branches', render: (r) => (r.is_super_admin || r.all_branches ? <Badge tone="violet">All branches</Badge> : r.branch_names) },
        { key: 'last_login_at', label: 'Last login', render: (r) => dateTime(r.last_login_at) },
        { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>) },
      ]} />
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
