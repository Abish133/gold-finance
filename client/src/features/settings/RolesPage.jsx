import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users, Printer, Save, LogOut, Search, ChevronDown, ChevronsUpDown } from 'lucide-react';
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
  const [openG, setOpenG] = useState({});
  const gOpen = (name) => (filter.trim() ? true : openG[name] ?? name === tree[0]?.name);
  const toggleG = (name) => setOpenG((x) => ({ ...x, [name]: !gOpen(name) }));
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
    /* fit-screen: the page fits the window; the role list and the permission list scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Roles &amp; Permissions</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Which menus each role can open</p></div></section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[320px_1fr]">
        <div className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Roles · {list.length}</p>
          <div className="flex shrink-0 gap-1.5 p-2"><div className="flex-1"><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role" /></div><Button variant="outline" className="h-8 text-[12px]" icon={Plus} onClick={newRole}>New (Ctrl+N)</Button></div>
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="px-2 py-1.5 text-left">Role</th><th className="px-2 text-right">Users</th><th className="px-2 text-right">Menus</th><th className="px-2">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {isNew && <tr className="bg-emerald-50 dark:bg-emerald-950/30"><td className="px-2 py-1 font-semibold italic" colSpan={4}>New role</td></tr>}
              {shownRoles.map((r) => (
                <tr key={r.id} onClick={() => { setIsNew(false); setSelId(r.id); }} className={clsx('cursor-pointer', !isNew && sel?.id === r.id ? 'bg-emerald-50 font-semibold dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  <td className="px-2 py-1">{r.name}</td><td className="num px-2 text-right">{r.user_count ?? 0}</td>
                  <td className="num px-2 text-right">{r.is_system ? total : (r.screen_count ?? (sel?.id === r.id ? count : '-'))}</td>
                  <td className="px-2 text-center"><span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{r.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="shrink-0 space-y-2 border-t border-ink-200 bg-ink-50/50 p-2.5 text-[13px] dark:border-ink-800 dark:bg-ink-800/30">
            <p className="text-[10px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Users in this role ({isNew ? 0 : inRole.length})</p>
            <p className="line-clamp-2 text-[12px] text-ink-600 dark:text-ink-300">{isNew ? '-' : inRole.map((u) => `${String(u.username).toUpperCase()} - ${u.full_name}`).join(', ') || '-'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="label">Role name</p><Input className="!h-8 text-[13px]" value={info.name} disabled={ro} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></div>
              <div><p className="label">Status</p><div className="flex">{[[1, 'Active'], [0, 'Inactive']].map(([v, l]) => <button key={l} type="button" disabled={ro} onClick={() => setInfo({ ...info, is_active: v })} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', 'flex-1 justify-center', info.is_active === v ? (v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'relative z-10 border-rose-300 bg-rose-50 text-rose-800') : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{info.is_active === v && v ? <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span> : null}{l}</button>)}</div></div>
            </div>
            <Checkbox checked={!!info.all_branches} disabled={ro} onChange={(v) => setInfo({ ...info, all_branches: v ? 1 : 0 })} label="Can view all branches (owner / area manager)" />
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Permissions · {isNew ? 'new role' : info.name}
            <span className="ml-auto flex items-center gap-2 normal-case"><span className="h-1.5 w-24 overflow-hidden rounded-sm bg-ink-100 dark:bg-ink-800"><span className="block h-full bg-emerald-600" style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></span><span className="num text-[11px] text-ink-500">{count} of {total} menus</span></span>
            {ro && <span className="rounded-sm bg-amber-100 px-1.5 text-[10px] text-amber-800">read only</span>}</p>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-ink-100 p-2 dark:border-ink-800 [&_button]:h-8 [&_button]:text-[12px]">
            <div className="w-52"><Input prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a menu" /></div>
            <Button variant="outline" disabled={ro} onClick={() => tickAll(true)}>Tick All</Button>
            <Button variant="soft-danger" disabled={ro} onClick={() => tickAll(false)}>Clear All</Button>
            <Button variant="outline" icon={ChevronsUpDown} onClick={() => { const anyClosed = tree.some((g) => !gOpen(g.name)); setOpenG(Object.fromEntries(tree.map((g) => [g.name, anyClosed]))); }}>{tree.some((g) => !gOpen(g.name)) ? 'Expand All' : 'Collapse All'}</Button>
            <div className="ml-auto w-52"><Select className="!h-8 text-[13px]" value={copyFrom} disabled={ro} onChange={(e) => copy(e.target.value)} options={[{ value: '', label: 'Copy from Role…' }, ...list.filter((r) => r.id !== sel?.id || isNew).map((r) => ({ value: String(r.id), label: r.name }))]} /></div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2 text-[13px]">
            {tree.map((g) => {
              const items = g.items.filter((i) => !f || i.label.toLowerCase().includes(f) || g.name.toLowerCase().includes(f));
              if (!items.length) return null;
              const on = g.items.filter((i) => ticked(i.key)).length;
              return (
                <div key={g.name} className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
                  {/* accordion header: the tick box selects the whole group, the rest of the bar opens / closes it */}
                  <div className={clsx('flex items-center gap-2 px-2.5 py-1.5 transition', gOpen(g.name) ? 'bg-ink-50 dark:bg-ink-800/60' : 'hover:bg-ink-50 dark:hover:bg-ink-800/40')}>
                    <input type="checkbox" className="size-4 accent-emerald-600" disabled={ro} checked={on === g.items.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }} onChange={(e) => setGroup(g, e.target.checked)} title="Tick / clear the whole group" />
                    <button type="button" onClick={() => toggleG(g.name)} aria-expanded={gOpen(g.name)} className="flex flex-1 items-center gap-2 text-left">
                      <span className="flex-1 text-[12px] font-bold tracking-wide text-navy-900 uppercase dark:text-white">{g.name}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-sm bg-ink-200 dark:bg-ink-700"><span className="block h-full bg-emerald-600" style={{ width: `${(on / g.items.length) * 100}%` }} /></span>
                      <span className={clsx('num w-12 text-right text-[11px] font-bold', on === g.items.length ? 'text-emerald-700' : on ? 'text-amber-700' : 'text-ink-400')}>{on} / {g.items.length}</span>
                      <ChevronDown className={clsx('size-4 text-ink-400 transition-transform duration-200', gOpen(g.name) && 'rotate-180')} />
                    </button>
                  </div>
                  <div className={clsx('grid transition-[grid-template-rows] duration-200', gOpen(g.name) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="min-h-0 overflow-hidden">
                  <div className="divide-y divide-ink-100 border-t border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                    {items.map((i) => (
                      <div key={i.key} className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1', !ticked(i.key) && 'text-ink-400')}>
                        <label className="flex min-w-48 flex-1 cursor-pointer items-center gap-2"><input type="checkbox" className="size-3.5 accent-emerald-600" disabled={ro} checked={ticked(i.key)} onChange={(e) => setScreen(i.key, e.target.checked)} /><span className={clsx(ticked(i.key) && 'font-medium text-navy-900 dark:text-white')}>{i.label}</span></label>
                        {/* what this role can do on the menu - shown once the menu is ticked */}
                        {ticked(i.key) && (
                          <div className="flex flex-wrap gap-1">{ACTIONS.map((a) => {
                            const yes = !!perm[i.key]?.[a];
                            return (
                              <button key={a} type="button" disabled={ro} onClick={() => setAction(i.key, a, !yes)} title={`${yes ? 'Can' : 'Cannot'} ${a}`}
                                className={clsx('rounded-sm border px-1.5 py-px text-[10px] font-semibold capitalize transition disabled:cursor-default', yes ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 text-ink-400 line-through decoration-ink-300 hover:bg-ink-50 dark:border-ink-700')}>{a}</button>
                            );
                          })}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="soft-danger" icon={Trash2} disabled={ro || isNew || !sel} onClick={() => setDel(true)}>Delete Role (Del)</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={Users} onClick={() => navigate('/settings/users')}>User Accounts (F6)</Button>
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="gold" icon={Save} loading={saving} disabled={ro} onClick={save}>Save (F2)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="hidden shrink-0 truncate px-1 text-[11px] text-ink-400 2xl:block">F2 = save · Ctrl+N = new role · tick a menu = all its actions, then click an action chip to switch it off · F6 = user accounts · F9 = print · Esc = exit</p>
      <ConfirmDrawer open={del} onClose={() => setDel(false)} onConfirm={remove} title={`Delete role ${sel?.name}?`} message="Users of this role must be given another role first." confirmText="Delete" />
    </div>
  );
}
