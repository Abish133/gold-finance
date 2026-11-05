import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import { Bell, ChevronsLeft, LogOut, Menu, Moon, Search, Sun, Building2, Check, KeyRound, TrendingUp, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { NAV, allowed } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFetch, useAction } from '@/hooks/useApi';
import { useHotkey } from '@/hooks/useUtils';
import { Button, Drawer, Spinner, Avatar, Field, Input, Badge } from '@/components/ui';
import { GlobalSearch } from './GlobalSearch';
import { api } from '@/lib/api';
import { money0 } from '@/lib/format';

const useTheme = () => {
  const [dark, setDark] = useState(() => localStorage.getItem('gf.theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('gf.theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
};

function Sidebar({ collapsed, onCollapse, mobileOpen, onClose }) {
  const { can } = useAuth();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(can, i.screen)) })).filter((g) => g.items.length);
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-ink-950 text-ink-300 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen',
        collapsed ? 'w-[76px]' : 'w-72', mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl gold-gradient font-black text-ink-950 shadow-lg shadow-gold-500/20">G</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">Gold Finance</p>
              <p className="truncate text-[11px] text-ink-400">Pawn Broking Suite</p>
            </div>
          )}
          <button type="button" onClick={onCollapse} className="ml-auto hidden rounded-lg p-1.5 text-ink-500 hover:bg-white/5 hover:text-white lg:block">
            <ChevronsLeft className={clsx('size-4 transition', collapsed && 'rotate-180')} />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {groups.map((g) => (
            <div key={g.group}>
              {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">{g.group}</p>}
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.path}>
                    <NavLink to={i.path} end onClick={onClose} title={collapsed ? i.label : i.hint}
                      className={({ isActive }) => clsx('group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-gradient-to-r from-gold-500/20 to-gold-500/5 text-gold-300 ring-1 ring-gold-500/20' : 'hover:bg-white/5 hover:text-white',
                        collapsed && 'justify-center px-0')}>
                      <i.icon className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                      {!collapsed && i.hot && <kbd className="ml-auto rounded bg-white/5 px-1.5 text-[10px] text-ink-500">{i.hot}</kbd>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function BranchSwitcher() {
  const { user, branch, setBranch, currentBranch } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const single = user.branches.length === 1 && !user.all_branches;
  const label = branch === 'all' ? 'All Branches' : currentBranch?.name || 'Select branch';
  return (
    <>
      <button type="button" disabled={single} onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-800 transition hover:border-gold-400 disabled:cursor-default disabled:hover:border-ink-200 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">
        {branch === 'all' ? <Layers className="size-4 text-gold-600" /> : <Building2 className="size-4 text-gold-600" />}
        <span className="max-w-36 truncate">{label}</span>
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Switch branch" subtitle="Data is isolated per branch" icon={Building2} size="sm">
        <div className="space-y-2">
          {user.all_branches && (
            <BranchOption active={branch === 'all'} onClick={() => { setBranch('all'); setOpen(false); }} title="All Branches" sub="Consolidated view (read-only for entries)" icon={Layers} />
          )}
          {user.branches.map((b) => (
            <BranchOption key={b.id} active={String(branch) === String(b.id)} onClick={() => { setBranch(b.id); setOpen(false); }} title={b.name} sub={`Code: ${b.code}`} icon={Building2} />
          ))}
        </div>
      </Drawer>
    </>
  );
}

const BranchOption = ({ active, onClick, title, sub, icon: Icon }) => (
  <button type="button" onClick={onClick}
    className={clsx('flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition', active ? 'border-gold-400 bg-gold-50 dark:bg-gold-500/10' : 'border-ink-200 hover:border-gold-300 dark:border-ink-700')}>
    <div className="grid size-10 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"><Icon className="size-5" /></div>
    <div className="flex-1"><p className="font-semibold text-ink-900 dark:text-white">{title}</p><p className="text-xs text-ink-500">{sub}</p></div>
    {active && <Check className="size-5 text-gold-600" />}
  </button>
);

function RateTicker() {
  const { data } = useFetch('/masters/rates/latest/all', undefined, { staleTime: 5 * 60_000 });
  if (!data?.length) return null;
  return (
    <div className="hidden items-center gap-3 rounded-xl bg-gold-50 px-3 py-2 text-xs font-semibold text-gold-800 xl:flex dark:bg-gold-500/10 dark:text-gold-300">
      <TrendingUp className="size-4" />
      {data.map((r) => <span key={r.id} className="num">{r.metal_name} {money0(r.market_rate)}/g</span>)}
    </div>
  );
}

function AlertsButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { branch } = useAuth();
  const { data = [] } = useQuery({ queryKey: ['/dashboard/alerts', branch], queryFn: () => api.get('/dashboard/alerts').then((r) => r.data), refetchInterval: 5 * 60_000 });
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="relative" aria-label="Alerts">
        <Bell className="size-5" />
        {data.length > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-ink-900" />}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications" icon={Bell} size="sm">
        {!data.length ? <p className="text-sm text-ink-500">You are all caught up.</p> : (
          <div className="space-y-2">
            {data.map((a) => (
              <button key={a.key} type="button" onClick={() => { setOpen(false); navigate(a.link); }}
                className="flex w-full items-start gap-3 rounded-2xl border border-ink-200 p-4 text-left hover:border-gold-300 dark:border-ink-700">
                <Badge tone={a.type === 'warning' ? 'red' : 'blue'}>{a.type}</Badge>
                <span className="text-sm text-ink-700 dark:text-ink-200">{a.text}</span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}

function ProfileButton() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const form = useForm();
  const change = useAction({ url: '/auth/change-password', success: 'Password changed' });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl p-1 pr-3 hover:bg-ink-100 dark:hover:bg-ink-800">
        <Avatar name={user.full_name} size="sm" />
        <div className="hidden text-left leading-tight md:block">
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{user.full_name}</p>
          <p className="text-[11px] text-ink-500">{user.role_name}</p>
        </div>
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={user.full_name} subtitle={`@${user.username} · ${user.role_name}`} icon={KeyRound} size="sm"
        footer={<Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button>}>
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => change.mutate({ body: v }, { onSuccess: () => form.reset() }))}>
          <h4 className="text-sm font-semibold">Change password</h4>
          <Field label="Current password"><Input type="password" {...form.register('currentPassword', { required: true })} /></Field>
          <Field label="New password" hint="Minimum 6 characters"><Input type="password" {...form.register('newPassword', { required: true, minLength: 6 })} /></Field>
          <Button type="submit" loading={change.isPending}>Update password</Button>
        </form>
        <div className="mt-8 rounded-2xl bg-ink-50 p-4 text-xs text-ink-500 dark:bg-ink-800">
          <p className="mb-2 font-semibold text-ink-700 dark:text-ink-200">Keyboard shortcuts</p>
          <p><kbd>Ctrl</kbd> + <kbd>K</kbd> Global search</p>
          <p><kbd>F2</kbd> New loan · <kbd>F3</kbd> Loan counter · <kbd>Esc</kbd> close drawer</p>
        </div>
      </Drawer>
    </>
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('gf.sidebar') === '1');
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();

  useEffect(() => localStorage.setItem('gf.sidebar', collapsed ? '1' : '0'), [collapsed]);
  useEffect(() => setMobile(false), [location.pathname]);
  useHotkey('ctrl+k', () => setSearchOpen(true));
  useHotkey('F2', () => can('loan_new', 'add') && navigate('/loans/new'));
  useHotkey('F3', () => navigate('/loans/counter'));

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} mobileOpen={mobile} onClose={() => setMobile(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6 dark:border-ink-800 dark:bg-ink-900/80">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)}><Menu className="size-5" /></Button>
          <button type="button" onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm text-ink-400 transition hover:border-gold-300 dark:border-ink-700 dark:bg-ink-950">
            <Search className="size-4" /> <span className="truncate">Search loan no, customer, phone…</span>
            <kbd className="ml-auto hidden rounded-md border border-ink-200 bg-white px-1.5 text-[10px] font-semibold sm:block dark:border-ink-700 dark:bg-ink-900">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <RateTicker />
            <BranchSwitcher />
            <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Theme">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>
            <AlertsButton />
            <ProfileButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Spinner label="Loading screen…" />}><Outlet /></Suspense>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
