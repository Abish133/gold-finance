import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge, Button, Drawer, Spinner } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { api } from '@/lib/api';

const ACTIONS = ['view', 'add', 'edit', 'delete', 'print', 'export'];

/** Screen x action permission matrix for a role. */
function PermissionDrawer({ role, onClose }) {
  const { data: screens = [] } = useFetch('/admin/screens');
  const { data: existing, isLoading } = useFetch(role ? `/admin/roles/${role.id}/permissions` : null);
  const [perm, setPerm] = useState({});
  useEffect(() => {
    if (!existing) return;
    setPerm(Object.fromEntries(existing.map((p) => [p.screen_key, Object.fromEntries(ACTIONS.map((a) => [a, !!p[`can_${a}`]]))])));
  }, [existing]);
  const groups = useMemo(() => screens.reduce((a, s) => ({ ...a, [s.group]: [...(a[s.group] || []), s] }), {}), [screens]);
  const toggle = (key, a, v) => setPerm((p) => {
    const cur = { ...(p[key] || {}), [a]: v };
    if (a !== 'view' && v) cur.view = true;
    if (a === 'view' && !v) ACTIONS.forEach((x) => { cur[x] = false; });
    return { ...p, [key]: cur };
  });
  const setGroup = (list, v) => setPerm((p) => ({ ...p, ...Object.fromEntries(list.map((s) => [s.key, Object.fromEntries(ACTIONS.map((a) => [a, v]))])) }));
  const save = useMutation({
    mutationFn: () => api.put(`/admin/roles/${role.id}/permissions`, {
      permissions: Object.entries(perm).filter(([, v]) => v.view).map(([k, v]) => ({ screen_key: k, ...Object.fromEntries(ACTIONS.map((a) => [`can_${a}`, !!v[a]])) })),
    }),
    onSuccess: () => { toast.success('Permissions saved. Users get them on next request.'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Drawer open={!!role} onClose={onClose} size="xl" icon={Grid3x3} title={`Permissions · ${role?.name}`} subtitle="Tick what this role can see and do on each screen"
      footer={<Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save permissions</Button>}>
      {isLoading ? <Spinner /> : (
        <div className="space-y-6">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g} className="card overflow-hidden">
              <div className="flex items-center justify-between bg-ink-50 px-4 py-2 dark:bg-ink-800">
                <p className="text-sm font-bold">{g}</p>
                <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setGroup(list, true)}>All</Button><Button size="sm" variant="ghost" onClick={() => setGroup(list, false)}>None</Button></div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-ink-500 uppercase"><th className="px-4 py-2 text-left">Screen</th>{ACTIONS.map((a) => <th key={a} className="w-20 px-2 py-2">{a}</th>)}</tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {list.map((s) => (
                    <tr key={s.key}>
                      <td className="px-4 py-2 font-medium">{s.label}</td>
                      {ACTIONS.map((a) => <td key={a} className="text-center"><input type="checkbox" className="size-4 accent-gold-600" checked={!!perm[s.key]?.[a]} onChange={(e) => toggle(s.key, a, e.target.checked)} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export default function RolesPage() {
  const [role, setRole] = useState(null);
  return (
    <>
      <ResourcePage title="Roles & Permissions" singular="Role" endpoint="/admin/roles" screen="s_roles" icon={Shield} defaults={{ is_active: 1, all_branches: 0 }}
        subtitle="Create employee roles and control every screen and action"
        rowActions={(r) => !r.is_system && <Button size="sm" variant="soft" icon={Grid3x3} onClick={() => setRole(r)}>Permissions</Button>}
        columns={[
          { key: 'name', label: 'Role', sortable: true, render: (r) => <span className="font-semibold">{r.name} {r.is_system ? <Badge tone="gold">System</Badge> : null}</span> },
          { key: 'description', label: 'Description' },
          { key: 'all_branches', label: 'Branch access', render: (r) => (r.all_branches ? <Badge tone="violet">All branches</Badge> : <Badge>Assigned branches</Badge>) },
          { key: 'user_count', label: 'Users', type: 'number' },
        ]}
        fields={[
          { name: 'name', label: 'Role name', required: true }, { name: 'description', label: 'Description' },
          { name: 'all_branches', label: 'Can view all branches', type: 'switch', hint: 'For owners / area managers: switch between branches or see all together' },
          { name: 'is_active', label: 'Active', type: 'switch' },
        ]} />
      <PermissionDrawer role={role} onClose={() => setRole(null)} />
    </>
  );
}
