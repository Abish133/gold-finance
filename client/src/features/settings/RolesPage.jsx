import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users, Printer, Save, LogOut, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Checkbox, ConfirmDrawer, Input, Select } from '@/components/ui';
import { useFetch, useList, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { printTable } from '@/lib/printTable';
import { MENUS } from '@/config/navigation';
import { useKeys } from '@/features/loans/desk';

const ACTIONS = ['view', 'add', 'edit', 'delete', 'print', 'export'];
const allOn = () => Object.fromEntries(ACTIONS.map((a) => [a, true]));

/** Roles & Permissions (desktop): roles on the left, the menu tree with tick boxes on the right. */
export default function RolesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const roles = useList('/admin/roles', { all: 1, pageSize: 200 });
  const { data: screens = [] } = useFetch('/admin/screens');
  const list = (roles.data?.data || []);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const sel = list.find((r) => r.id === selId) || list.find((r) => !r.is_system) || list[0];
  const { data: existing } = useFetch(sel && !sel.is_system ? `/admin/roles/${sel.id}/permissions` : null);
  const { data: users = [] } = useFetch('/admin/users', { pageSize: 500 });
  const [perm, setPerm] = useState({});
  const [info, setInfo] = useState({ name: '', is_active: 1, all_branches: 0 });
  const [open, setOpen] = useState({});
  const [filter, setFilter] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [del, setDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!sel || isNew) return;
    setInfo({ name: sel.name, description: sel.description || '', is_active: sel.is_active ? 1 : 0, all_branches: sel.all_branches ? 1 : 0 });
  }, [sel?.id, isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isNew) return;
    if (sel?.is_system) { setPerm(Object.fromEntries(screens.map((s) => [s.key, allOn()]))); return; }
    if (existing) setPerm(Object.fromEntries(existing.map((p) => [p.screen_key, Object.fromEntries(ACTIONS.map((a) => [a, !!p[`can_${a}`]]))])));
  }, [existing, sel?.id, screens, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // the tree follows the menu bar: menu -> its screens (sub-menus flattened); screens not in a menu go under "Other"
  const tree = useMemo(() => {
    const label = Object.fromEntries(screens.map((s) => [s.key, s.label]));
    const used = new Set();
    const groups = MENUS.map((m) => {
      const items = [];
      for (const it of m.items) for (const x of it.items || [it]) {
        const keys = [].concat(x.screen || []);
        // an item that opens with more than one screen: each screen under its own name
        for (const key of keys) if (key && label[key] && !used.has(key)) { used.add(key); items.push({ key, label: keys.length > 1 ? label[key] : x.label }); }
      }
      return { name: m.label, items };
    }).filter((g) => g.items.length);
    const rest = screens.filter((s) => !used.has(s.key)).map((s) => ({ key: s.key, label: s.label }));
    if (rest.length) groups.push({ name: 'Other', items: rest });
    return groups;
  }, [screens]);
  const total = tree.reduce((t, g) => t + g.items.length, 0);
  const ticked = (key) => !!perm[key]?.view;
  const count = tree.reduce((t, g) => t + g.items.filter((i) => ticked(i.key)).length, 0);
  const ro = !!sel?.is_system && !isNew;
  const setScreen = (key, v) => setPerm((p) => ({ ...p, [key]: v ? allOn() : Object.fromEntries(ACTIONS.map((a) => [a, false])) }));
  const setAction = (key, a, v) => setPerm((p) => {
    const cur = { ...(p[key] || {}), [a]: v };
    if (a !== 'view' && v) cur.view = true;
    if (a === 'view' && !v) ACTIONS.forEach((x) => { cur[x] = false; });
    return { ...p, [key]: cur };
  });
  const setGroup = (g, v) => g.items.forEach((i) => setScreen(i.key, v));
  const tickAll = (v) => tree.forEach((g) => setGroup(g, v));
  const copy = async (id) => {
    setCopyFrom(id);
    if (!id) return;
    const r = list.find((x) => String(x.id) === String(id));
    if (r?.is_system) { tickAll(true); return; }
    const p = (await api.get(`/admin/roles/${id}/permissions`)).data;
    setPerm(Object.fromEntries(p.map((x) => [x.screen_key, Object.fromEntries(ACTIONS.map((a) => [a, !!x[`can_${a}`]]))])));
    toast.success(`Permissions copied from ${r?.name} - press Save (F2)`);
  };

  const save = async () => {
    if (ro) return toast.error('The Super Admin role always has every menu');
    if (!info.name.trim()) return toast.error('Enter the role name');
    setSaving(true);
    try {
      let id = sel?.id;
      if (isNew) id = (await api.post('/admin/roles', { ...info, name: info.name.trim() })).data.id;
      else await api.put(`/admin/roles/${id}`, { ...info, name: info.name.trim() });
      await api.put(`/admin/roles/${id}/permissions`, { permissions: Object.entries(perm).filter(([, v]) => v.view).map(([k, v]) => ({ screen_key: k, ...Object.fromEntries(ACTIONS.map((a) => [`can_${a}`, !!v[a]])) })) });
      toast.success('Role saved. Users get the new menus on their next screen.');
      setIsNew(false); setSelId(id);
      qc.invalidateQueries({ queryKey: ['/admin/roles'] }); qc.invalidateQueries({ queryKey: [`/admin/roles/${id}/permissions`] });
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const remove = async () => {
    try { await api.del(`/admin/roles/${sel.id}`); toast.success('Role deleted'); setDel(false); setSelId(null); roles.refetch(); } catch (e) { toast.error(e.message); }
  };
  const newRole = () => { setIsNew(true); setInfo({ name: '', description: '', is_active: 1, all_branches: 0 }); setPerm({}); setCopyFrom(''); };
  const print = () => printTable({ title: `Role permissions · ${info.name}`, company, columns: [{ key: 'menu', label: 'Menu' }, { key: 'screen', label: 'Screen' }, { key: 'allowed', label: 'Allowed' }],
    rows: tree.flatMap((g) => g.items.map((i) => ({ menu: g.name, screen: i.label, allowed: ticked(i.key) ? ACTIONS.filter((a) => perm[i.key]?.[a]).join(', ') : '-' }))) });
  useKeys({ f2: save, 'ctrl+n': newRole, f6: () => navigate('/settings/users'), f9: print, escape: () => navigate('/') }, [perm, info, sel, isNew]);

  const roleUsers = Array.isArray(users) ? users : users?.data || [];
  const inRole = roleUsers.filter((u) => sel && (sel.is_system ? u.is_super_admin : u.role_id === sel.id));
  const shownRoles = list.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const f = filter.trim().toLowerCase();

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Roles &amp; Permissions</h1><p className="text-sm text-navy-100">Which menus each role can open</p></section>
      <div className="grid items-start gap-3 lg:grid-cols-[340px_1fr]">
        <div className="card flex min-h-[calc(100vh-17rem)] flex-col">
          <p className="navy-gradient rounded-t-md px-3 py-2 text-sm font-bold text-white uppercase">Roles · {list.length}</p>
          <div className="flex gap-2 p-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role" /><Button variant="outline" icon={Plus} onClick={newRole}>New Role (Ctrl+N)</Button></div>
          <table className="w-full text-sm">
            <thead className="bg-navy-800 text-white"><tr><th className="px-2 py-1.5 text-left">Role</th><th className="px-2 text-right">Users</th><th className="px-2 text-right">Menus</th><th className="px-2">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {isNew && <tr className="bg-cream-200"><td className="px-2 py-1.5 font-semibold italic" colSpan={4}>New role</td></tr>}
              {shownRoles.map((r) => (
                <tr key={r.id} onClick={() => { setIsNew(false); setSelId(r.id); }} className={clsx('cursor-pointer hover:bg-navy-50/50', !isNew && sel?.id === r.id && 'bg-cream-200 font-semibold dark:bg-ink-800')}>
                  <td className="px-2 py-1.5">{r.name}</td><td className="num px-2 text-right">{r.user_count ?? 0}</td>
                  <td className="num px-2 text-right">{r.is_system ? total : (r.screen_count ?? (sel?.id === r.id ? count : '-'))}</td>
                  <td className="px-2 text-center"><span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{r.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto space-y-2 border-t border-ink-200 p-3 text-sm dark:border-ink-700">
            <p className="text-xs font-bold text-amber-700 uppercase">Users in this role ({isNew ? 0 : inRole.length})</p>
            <p className="text-ink-700">{isNew ? '-' : inRole.map((u) => `${String(u.username).toUpperCase()} - ${u.full_name}`).join(', ') || '-'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="label">Role name</p><Input value={info.name} disabled={ro} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></div>
              <div><p className="label">Status</p><div className="flex gap-1">{[[1, 'Active'], [0, 'Inactive']].map(([v, l]) => <button key={l} type="button" disabled={ro} onClick={() => setInfo({ ...info, is_active: v })} className={clsx('h-9 flex-1 rounded border text-xs font-semibold', info.is_active === v ? 'border-navy-300 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-ink-600 dark:bg-ink-900')}>{l}</button>)}</div></div>
            </div>
            <Checkbox checked={!!info.all_branches} disabled={ro} onChange={(v) => setInfo({ ...info, all_branches: v ? 1 : 0 })} label="Can view all branches (owner / area manager)" />
          </div>
        </div>
        <div className="card min-h-[calc(100vh-17rem)]">
          <p className="navy-gradient rounded-t-md px-3 py-2 text-sm font-bold text-white uppercase">Permissions - {isNew ? 'new role' : info.name} <span className="ml-2 normal-case">{count} of {total} menus</span></p>
          <div className="flex flex-wrap gap-2 p-2">
            <Input className="w-56" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a menu" />
            <Button variant="outline" disabled={ro} onClick={() => tickAll(true)}>Tick All</Button>
            <Button variant="outline" disabled={ro} onClick={() => tickAll(false)}>Clear All</Button>
            <Button variant="outline" onClick={() => setOpen(Object.fromEntries(tree.flatMap((g) => g.items.map((i) => [i.key, !Object.values(open).some(Boolean)]))))}>{Object.values(open).some(Boolean) ? 'Collapse All' : 'Expand All'}</Button>
            <div className="w-56"><Select value={copyFrom} disabled={ro} onChange={(e) => copy(e.target.value)} options={[{ value: '', label: 'Copy from Role…' }, ...list.filter((r) => r.id !== sel?.id || isNew).map((r) => ({ value: String(r.id), label: r.name }))]} /></div>
          </div>
          <div className="max-h-[calc(100vh-24rem)] space-y-2 overflow-auto px-3 pb-3 text-sm">
            {tree.map((g) => {
              const items = g.items.filter((i) => !f || i.label.toLowerCase().includes(f) || g.name.toLowerCase().includes(f));
              if (!items.length) return null;
              const on = g.items.filter((i) => ticked(i.key)).length;
              return (
                <div key={g.name}>
                  <label className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                    <input type="checkbox" className="size-4 accent-gold-600" disabled={ro} checked={on === g.items.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }} onChange={(e) => setGroup(g, e.target.checked)} />
                    {g.name} <span className="text-xs font-semibold text-amber-700">({on} of {g.items.length})</span>
                  </label>
                  <div className="ml-6 space-y-0.5">
                    {items.map((i) => (
                      <div key={i.key}>
                        <div className="flex items-center gap-1">
                          <button type="button" className="text-ink-400" onClick={() => setOpen({ ...open, [i.key]: !open[i.key] })}>{open[i.key] ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button>
                          <label className={clsx('flex items-center gap-2', !ticked(i.key) && 'text-ink-400')}><input type="checkbox" className="size-4 accent-gold-600" disabled={ro} checked={ticked(i.key)} onChange={(e) => setScreen(i.key, e.target.checked)} />{i.label}</label>
                        </div>
                        {open[i.key] && <div className="ml-10 flex flex-wrap gap-3 py-0.5 text-xs">{ACTIONS.map((a) => <label key={a} className="flex items-center gap-1 capitalize"><input type="checkbox" className="size-3.5 accent-gold-600" disabled={ro} checked={!!perm[i.key]?.[a]} onChange={(e) => setAction(i.key, a, e.target.checked)} />{a}</label>)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="soft-danger" icon={Trash2} disabled={ro || isNew || !sel} onClick={() => setDel(true)}>Delete Role (Del)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={Users} onClick={() => navigate('/settings/users')}>User Accounts (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="gold" icon={Save} loading={saving} disabled={ro} onClick={save}>Save (F2)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F2 = save · Ctrl+N = new role · tick a menu = all its actions (open the arrow for view / add / edit / delete / print / export) · F6 = user accounts · F9 = print · Esc = exit</p>
      <ConfirmDrawer open={del} onClose={() => setDel(false)} onConfirm={remove} title={`Delete role ${sel?.name}?`} message="Users of this role must be given another role first." confirmText="Delete" />
    </div>
  );
}
