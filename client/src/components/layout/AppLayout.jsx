import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { Bell, LogOut, Moon, Search, Sun, Building2, Check, KeyRound, Layers, ChevronDown, ChevronRight, Power, Keyboard, Info, User, Maximize, Minimize } from 'lucide-react';
import { MENUS, HOTKEYS, allowed } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFetch, useAction, useCompany, useSettings } from '@/hooks/useApi';
import { useHotkey } from '@/hooks/useUtils';
import { Button, Drawer, Spinner, Field, Input, Badge } from '@/components/ui';
import { GlobalSearch } from './GlobalSearch';
import { amount } from '@/lib/format';

const useTheme = () => {
  const [dark, setDark] = useState(() => localStorage.getItem('gf.theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('gf.theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
};

/* ------------------------------------------------------------------ top menu bar */
function MenuBar({ onAction, onExit }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(null);
  const [sub, setSub] = useState(null);
  const bar = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const visible = (i) => (i.items ? i.items.some((x) => allowed(can, x.screen)) : i.section || allowed(can, i.screen));
  const menus = MENUS.map((m) => ({ ...m, items: m.items.filter(visible).map((i) => (i.items ? { ...i, items: i.items.filter((x) => allowed(can, x.screen)) } : i)) }))
    .map((m) => ({ ...m, items: m.items.filter((i, idx, arr) => !i.section || (arr[idx + 1] && !arr[idx + 1].section)) }))
    .filter((m) => m.items.some((i) => !i.section));

  useEffect(() => { setOpen(null); setSub(null); }, [location]);
  useEffect(() => setSub(null), [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!bar.current?.contains(e.target)) setOpen(null); };
    const esc = (e) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const choose = (i) => {
    setOpen(null);
    if (i.action) onAction(i.action); else navigate(i.path);
  };

  return (
    <nav ref={bar} className="navy-gradient no-print relative z-30 flex h-10 items-stretch gap-0.5 overflow-x-auto px-2 text-sm text-white shadow-[inset_0_-1px_0_rgb(255_255_255/0.06)]">
      {menus.map((m) => (
        <div key={m.key} className="relative" data-menu={m.key} onMouseEnter={() => open && setOpen(m.key)}>
          <button type="button" onClick={() => setOpen(open === m.key ? null : m.key)}
            className={clsx('flex h-full items-center gap-1.5 rounded-sm px-3 font-semibold transition', open === m.key ? 'bg-white/15' : 'hover:bg-white/10')}>
            <span className="grid size-5 place-items-center rounded-[4px] bg-white/90 text-navy-800"><m.icon className="size-3.5" /></span>
            {m.label}
          </button>
        </div>
      ))}
      <button type="button" onClick={onExit} className="flex items-center gap-1.5 rounded-sm px-3 font-semibold hover:bg-white/10">
        <span className="grid size-5 place-items-center rounded-[4px] bg-white/90 text-rose-600"><Power className="size-3.5" /></span>Exit
      </button>
      {open && (() => {
        const m = menus.find((x) => x.key === open);
        const btn = bar.current?.querySelector(`[data-menu="${open}"]`)?.getBoundingClientRect();
        const left = Math.max(4, Math.min(btn ? btn.left : 8, window.innerWidth - 330));
        return (
          <div className="fixed z-40 mt-10 w-80 animate-drop overflow-hidden rounded-b-md border border-ink-300 bg-white text-ink-800 shadow-xl dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            style={{ left: `${left}px` }}>
            <div className="h-0.5 bg-gold-500" />
            {/* fits under the menu bar; long menus (Settings) scroll instead of being cut off */}
            <ul className="overflow-y-auto overscroll-contain py-1" style={{ maxHeight: `calc(100vh - ${Math.round((btn?.bottom || 40) + 16)}px)` }}>
              {m.items.map((i, k) => (i.section ? (
                i.section.trim() ? <li key={`s${k}`} className="mt-1 border-t border-ink-200 px-4 pt-2 pb-1 text-[10px] font-bold tracking-widest text-ink-400 uppercase dark:border-ink-700">{i.section}</li> : <li key={`s${k}`} className="my-1 border-t border-ink-200 dark:border-ink-700" />
              ) : i.items ? (
                /* submenu (desktop: Print ▸, Stock ▸) */
                <li key={i.label} className="relative border-t border-ink-200 dark:border-ink-700" onMouseEnter={() => setSub(i.label)} onMouseLeave={() => setSub(null)}>
                  <button type="button" onClick={() => setSub(sub === i.label ? null : i.label)} className={clsx('flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-navy-50 dark:hover:bg-navy-800/40', sub === i.label && 'bg-navy-50 dark:bg-navy-800/40')}>
                    <i.icon className="size-4.5 shrink-0 text-navy-600 dark:text-navy-300" />
                    <span className="flex-1 font-semibold text-navy-900 dark:text-white">{i.label}</span>
                    <ChevronRight className="size-4 text-ink-500" />
                  </button>
                  {sub === i.label && (
                    <ul className="fixed z-50 w-72 overflow-hidden rounded-md border border-ink-300 bg-white py-1 shadow-xl dark:border-ink-700 dark:bg-ink-900"
                      style={{ left: `${left + 320}px`, marginTop: '-40px' }}>
                      {i.items.map((x) => (
                        <li key={x.label}>
                          <button type="button" onClick={() => choose(x)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-navy-50 dark:hover:bg-navy-800/40">
                            <x.icon className="size-4.5 shrink-0 text-navy-600 dark:text-navy-300" />
                            <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-navy-900 dark:text-white">{x.label}</span>{x.hint && <span className="block truncate text-xs text-ink-500">{x.hint}</span>}</span>
                            {x.hot && <kbd className="rounded border border-ink-300 bg-ink-50 px-1.5 text-[10px] font-bold text-ink-600 dark:border-ink-700 dark:bg-ink-800">{x.hot}</kbd>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={i.label}>
                  <button type="button" onClick={() => choose(i)} className="flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-navy-50 dark:hover:bg-navy-800/40">
                    <i.icon className="size-4.5 shrink-0 text-navy-600 dark:text-navy-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy-900 dark:text-white">{i.label}</span>
                      {i.hint && <span className="block truncate text-xs text-ink-500">{i.hint}</span>}
                    </span>
                    {i.hot && <kbd className="rounded border border-ink-300 bg-ink-50 px-1.5 text-[10px] font-bold text-ink-600 dark:border-ink-700 dark:bg-ink-800">{i.hot}</kbd>}
                  </button>
                </li>
              )))}
            </ul>
          </div>
        );
      })()}
    </nav>
  );
}

/* ------------------------------------------------------------------ full screen */
/** One click: full screen. Next click (or Esc): normal window. */
function FullscreenButton() {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
      {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
    </Button>
  );
}

/* ------------------------------------------------------------------ header strip */
function BranchSwitcher() {
  const { user, branch, setBranch, currentBranch } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (new URLSearchParams(location.search).get('switch') === 'branch') { setOpen(true); navigate(location.pathname, { replace: true }); }
  }, [location, navigate]);
  const single = user.branches.length === 1 && !user.all_branches;
  const label = branch === 'all' ? 'All Branches' : currentBranch?.name || 'Select branch';
  return (
    <>
      <button type="button" disabled={single} onClick={() => setOpen(true)} title="Switch branch"
        className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-left transition hover:border-navy-400 disabled:cursor-default disabled:hover:border-ink-200 dark:border-ink-700 dark:bg-ink-900">
        {branch === 'all' ? <Layers className="size-5 text-navy-600" /> : <Building2 className="size-5 text-navy-600" />}
        <span className="leading-tight">
          <span className="block text-[10px] font-semibold tracking-wide text-ink-500 uppercase">Branch</span>
          <span className="block max-w-36 truncate text-sm font-bold text-navy-900 dark:text-white">{label}</span>
        </span>
        {!single && <ChevronDown className="size-4 text-ink-400" />}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Switch branch" subtitle="Data is kept separate for every branch" icon={Building2} size="sm">
        <div className="space-y-2">
          {user.all_branches && <BranchOption active={branch === 'all'} onClick={() => { setBranch('all'); setOpen(false); }} title="All Branches" sub="Consolidated view (entries need a single branch)" icon={Layers} />}
          {user.branches.map((b) => <BranchOption key={b.id} active={String(branch) === String(b.id)} onClick={() => { setBranch(b.id); setOpen(false); }} title={b.name} sub={`Code: ${b.code}`} icon={Building2} />)}
        </div>
      </Drawer>
    </>
  );
}

const BranchOption = ({ active, onClick, title, sub, icon: Icon }) => (
  <button type="button" onClick={onClick}
    className={clsx('flex w-full items-center gap-3 rounded-md border p-3.5 text-left transition', active ? 'border-navy-500 bg-navy-50 dark:bg-navy-800/30' : 'border-ink-200 hover:border-navy-300 dark:border-ink-700')}>
    <div className="grid size-10 place-items-center rounded-md bg-navy-800 text-white"><Icon className="size-5" /></div>
    <div className="flex-1"><p className="font-semibold text-navy-900 dark:text-white">{title}</p><p className="text-xs text-ink-500">{sub}</p></div>
    {active && <Check className="size-5 text-navy-600" />}
  </button>
);

const HeaderTile = ({ icon, label, value, onClick, accent, title }) => (
  <button type="button" onClick={onClick} title={title} className="flex items-center gap-2.5 border-l border-ink-200 px-4 py-1 text-left first:border-l-0 hover:bg-white/60 dark:border-ink-700">
    {icon}
    <span className="leading-tight">
      <span className="block text-[10px] font-semibold tracking-wide text-ink-500 uppercase">{label}</span>
      <span className={clsx('num block text-[15px] font-bold', accent || 'text-navy-900 dark:text-white')}>{value}</span>
    </span>
  </button>
);

function HeaderStrip({ onSearch, onProfile, onAlerts, alertCount, dark, setDark }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: rates = [] } = useFetch('/masters/rates/latest/all', undefined, { staleTime: 5 * 60_000 });
  const { data: years = [] } = useFetch('/admin/financial-years', undefined, { staleTime: 30 * 60_000 });
  const fy = years.find((y) => y.is_current);
  const { data: billing } = useFetch('/desk/billing-date', undefined, { staleTime: 60_000 });
  const gold = rates.find((r) => r.metal_code === 'GOLD');
  const silver = rates.find((r) => r.metal_code === 'SILVER');
  const todayRate = gold && dayjs(gold.rate_date).isSame(dayjs(), 'day');
  const name = company?.name || 'Gold Finance';

  return (
    <header className="no-print relative z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-b-[3px] border-gold-500 bg-cream-100 px-4 py-2 dark:bg-ink-900">
      <Link to="/" className="flex min-w-0 items-center gap-3">
        {company?.logo_path
          ? <img src={company.logo_path} alt="" className="size-11 rounded-md bg-white object-contain p-0.5 ring-1 ring-ink-200" />
          : <div className="brand grid size-11 shrink-0 place-items-center rounded-md bg-navy-900 text-2xl text-white shadow-sm">{name.replace(/[^A-Za-z]/g, '').charAt(0) || 'G'}</div>}
        <div className="min-w-0 leading-tight">
          <p className="brand truncate text-2xl text-navy-900 dark:text-white">{name}</p>
          {fy && <p className="truncate text-xs text-ink-500">A/c Year <b className="text-gold-700">{fy.name}</b> <span className="mx-1.5">·</span> Books {dayjs(fy.start_date).format('DD/MM/YYYY')} to {dayjs(fy.end_date).format('DD/MM/YYYY')}</p>}
        </div>
      </Link>

      <button type="button" onClick={onSearch}
        className="mx-auto flex h-10 w-full max-w-sm min-w-56 flex-1 items-center gap-2 rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-400 hover:border-navy-400 dark:border-ink-700 dark:bg-ink-950">
        <Search className="size-4" /> <span className="truncate">Loan no, customer, mobile, barcode…</span>
        <kbd className="ml-auto hidden rounded border border-ink-200 px-1.5 text-[10px] font-semibold sm:block dark:border-ink-700">Ctrl K</kbd>
      </button>

      <div className="flex items-center rounded-md border border-ink-200 bg-white/70 py-1 dark:border-ink-700 dark:bg-ink-950/40">
        <HeaderTile label="Billing date" value={dayjs(billing?.billingDate).format('DD/MM/YYYY')} accent={billing?.behind ? 'text-rose-600' : undefined}
          onClick={billing?.behind ? () => navigate('/accounts/day-report') : undefined} title={billing?.behind ? 'Billing date is behind today - finish Day End' : undefined}
          icon={<span className="grid h-8 w-7 place-items-end overflow-hidden rounded-sm border border-ink-300 bg-white pb-0.5 text-center text-xs font-bold text-navy-900"><span className="absolute" /><span className="block w-full border-t-4 border-rose-600 pt-0.5">{dayjs(billing?.billingDate).format('D')}</span></span>} />
        <HeaderTile label="Gold rate" value={gold ? `₹${amount((gold.market_rate * 100) / (gold.purity || 100))}` : 'Not set'} accent={!todayRate ? 'text-rose-600' : undefined} onClick={() => navigate('/masters/rates')}
          icon={<span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-[11px] font-black text-white ring-2 ring-gold-200">G</span>} />
        <HeaderTile label="Silver rate" value={silver ? `₹${amount((silver.market_rate * 100) / (silver.purity || 100))}` : 'Not set'} onClick={() => navigate('/masters/rates')}
          icon={<span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-500 text-[11px] font-black text-white ring-2 ring-slate-200">S</span>} />
      </div>

      <BranchSwitcher />

      <div className="flex items-center gap-1">
        <FullscreenButton />
        <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Theme">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>
        <Button variant="ghost" size="icon" onClick={onAlerts} className="relative" aria-label="Reminders">
          <Bell className="size-5" />
          {alertCount > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-rose-600 text-[9px] font-bold text-white">{alertCount}</span>}
        </Button>
        <button type="button" onClick={onProfile} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/70 dark:hover:bg-ink-800">
          <User className="size-6 text-navy-600" />
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold text-navy-900 uppercase dark:text-white">{user.username}</span>
            <span className="block text-xs text-gold-700">{user.role_name}</span>
          </span>
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ status bar */
function StatusBar() {
  const { data } = useFetch('/dashboard/status', undefined, { refetchInterval: 120_000 });
  const { data: company } = useCompany();
  const month = dayjs().format('MMMM');
  const Item = ({ label, value, warn }) => (
    <span className="whitespace-nowrap">{label} <b className={clsx('num ml-1.5 text-base', warn ? 'text-rose-300' : 'text-white')}>{value ?? 0}</b></span>
  );
  return (
    <footer className="navy-gradient no-print flex items-center gap-8 overflow-x-auto border-t-[3px] border-gold-500 px-5 py-2 text-sm text-navy-100">
      <Item label={`${month} Loans`} value={data?.month_loans} />
      <Item label={`${month} Releases`} value={data?.month_releases} />
      <Item label="Open Loans" value={data?.open_loans} />
      <Item label="Unsettled (over 12 months)" value={data?.unsettled_12m} warn={data?.unsettled_12m > 0} />
      <span className="brand ml-auto text-xl whitespace-nowrap text-white">{company?.name || 'Gold Finance'}</span>
    </footer>
  );
}

/* ------------------------------------------------------------------ drawers */
function AlertsDrawer({ open, onClose, alerts }) {
  const navigate = useNavigate();
  return (
    <Drawer open={open} onClose={onClose} title="Reminders" icon={Bell} size="sm">
      {!alerts.length ? <p className="text-sm text-ink-500">You are all caught up.</p> : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <button key={a.key} type="button" onClick={() => { onClose(); navigate(a.link); }}
              className="flex w-full items-start gap-3 rounded-md border border-gold-200 bg-cream-100 p-3.5 text-left hover:border-gold-400 dark:border-ink-700 dark:bg-ink-800">
              <Badge tone={a.type === 'warning' ? 'red' : 'gold'}>{a.type === 'warning' ? 'Due' : 'Note'}</Badge>
              <span className="text-sm text-ink-700 dark:text-ink-200">{a.text}</span>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}

function ProfileDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const form = useForm();
  const change = useAction({ url: '/auth/change-password', success: 'Password changed' });
  return (
    <Drawer open={open} onClose={onClose} title={user.full_name} subtitle={`@${user.username} · ${user.role_name}`} icon={KeyRound} size="sm"
      footer={<Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button>}>
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => change.mutate({ body: v }, { onSuccess: () => form.reset() }))}>
        <h4 className="text-sm font-semibold">Change password</h4>
        <Field label="Current password"><Input type="password" {...form.register('currentPassword', { required: true })} /></Field>
        <Field label="New password" hint="Minimum 6 characters"><Input type="password" {...form.register('newPassword', { required: true, minLength: 6 })} /></Field>
        <Button type="submit" loading={change.isPending}>Update password</Button>
      </form>
    </Drawer>
  );
}

function ShortcutsDrawer({ open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose} title="Keyboard shortcuts" icon={Keyboard} size="sm">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
          {[...HOTKEYS.map((h) => [h.key, h.label]), ['Ctrl + K', 'Search loans & customers'], ['Esc', 'Close drawer / menu']].map(([k, l]) => (
            <tr key={k}><td className="py-2 pr-4"><kbd className="rounded border border-ink-300 bg-ink-50 px-2 py-0.5 text-xs font-bold dark:bg-ink-800">{k}</kbd></td><td className="py-2">{l}</td></tr>
          ))}
        </tbody>
      </table>
    </Drawer>
  );
}

function AboutDrawer({ open, onClose }) {
  const { data: company } = useCompany();
  return (
    <Drawer open={open} onClose={onClose} title="About" icon={Info} size="sm">
      <p className="brand text-3xl text-navy-900 dark:text-white">{company?.name || 'Gold Finance'}</p>
      <p className="mt-1 text-sm text-ink-500">A complete pawn broker solution · multi-branch · web edition 1.0</p>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ layout */
export function AppLayout() {
  const [panel, setPanel] = useState(null);
  const [dark, setDark] = useTheme();
  const navigate = useNavigate();
  const { can, logout } = useAuth();
  const { data: alerts = [] } = useFetch('/dashboard/alerts', undefined, { refetchInterval: 5 * 60_000 });
  const { data: settings } = useSettings();
  const bg = settings?.BACKGROUND_IMAGE;

  useHotkey('ctrl+k', () => setPanel('search'));
  for (const h of HOTKEYS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkey(h.key, () => allowed(can, h.screen) && navigate(h.path));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30">
        <MenuBar onAction={setPanel} onExit={() => setPanel('exit')} />
        <HeaderStrip dark={dark} setDark={setDark} onSearch={() => setPanel('search')} onProfile={() => setPanel('profile')} onAlerts={() => setPanel('alerts')} alertCount={alerts.length} />
      </div>
      {bg && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-[0.07]" style={{ backgroundImage: `url(${bg})` }} />}
      <main className="w-full flex-1 p-2 sm:p-3">
        <Suspense fallback={<Spinner label="Loading screen…" />}><Outlet /></Suspense>
      </main>
      <div className="sticky bottom-0 z-20"><StatusBar /></div>

      <GlobalSearch open={panel === 'search'} onClose={() => setPanel(null)} />
      <AlertsDrawer open={panel === 'alerts'} onClose={() => setPanel(null)} alerts={alerts} />
      <ProfileDrawer open={panel === 'profile'} onClose={() => setPanel(null)} />
      <ShortcutsDrawer open={panel === 'shortcuts'} onClose={() => setPanel(null)} />
      <AboutDrawer open={panel === 'about'} onClose={() => setPanel(null)} />
      <Drawer open={panel === 'exit'} onClose={() => setPanel(null)} title="Exit" icon={Power} size="sm"
        footer={<><Button variant="outline" onClick={() => setPanel(null)}>Stay</Button><Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button></>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">Sign out of this computer? Unsaved entries on the open screen will be lost.</p>
      </Drawer>
    </div>
  );
}
