import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { Bell, LogOut, Moon, Search, Sun, Building2, KeyRound, Layers, ChevronDown, ChevronRight, Power, Keyboard, Info, Maximize, Minimize } from 'lucide-react';
import { MENUS, HOTKEYS, allowed } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFetch, useAction, useCompany } from '@/hooks/useApi';
import { useHotkey } from '@/hooks/useUtils';
import { Button, Drawer, Spinner, Field, Input, Badge } from '@/components/ui';
import { GlobalSearch } from './GlobalSearch';
import { amount, setWorkDate, today } from '@/lib/format';
import { appZoom } from '@/lib/appearance';

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

  /* the menu that owns the page you are on gets the underline */
  const hasPath = (i) => (i.path && i.path.split('?')[0] === location.pathname) || i.items?.some(hasPath);
  const current = menus.find((m) => m.items.some(hasPath))?.key;

  return (
    <nav ref={bar} className="navy-gradient no-print relative z-30 flex h-10 items-stretch gap-1 px-3 text-[13px] text-white/70">
      {menus.map((m) => {
        const isOpen = open === m.key;
        const isCurrent = current === m.key;
        return (
          <div key={m.key} className="relative py-1.5" data-menu={m.key} onMouseEnter={() => open && setOpen(m.key)}>
            <button type="button" onClick={() => setOpen(isOpen ? null : m.key)}
              className={clsx('flex h-full items-center gap-1.5 rounded-md px-2.5 font-semibold transition',
                isOpen ? 'bg-white text-navy-900' : isCurrent ? 'text-white' : 'hover:bg-white/10 hover:text-white')}>
              <m.icon className="size-4" strokeWidth={2} />
              {m.label}
              <ChevronDown className={clsx('size-3 transition', isOpen ? 'rotate-180 opacity-70' : 'opacity-40')} />
            </button>
            {isCurrent && !isOpen && <span aria-hidden className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-t-sm bg-white" />}
          </div>
        );
      })}
      <span className="flex-1" />
      <div className="py-1.5">
        <button type="button" onClick={onExit} className="flex h-full items-center gap-1.5 rounded-md px-2.5 font-semibold transition hover:bg-rose-600 hover:text-white">
          <Power className="size-4" />Exit
        </button>
      </div>
      {open && (() => {
        const m = menus.find((x) => x.key === open);
        const btn = bar.current?.querySelector(`[data-menu="${open}"]`)?.getBoundingClientRect();
        const left = Math.max(4, Math.min(btn ? btn.left : 8, window.innerWidth / appZoom() - 330));
        return (
          <div className="fixed z-40 mt-10 w-80 animate-drop overflow-hidden rounded-md border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            style={{ left: `${left}px`, marginTop: '42px' }}>
            {/* fits under the menu bar; long menus (Settings) scroll instead of being cut off */}
            <ul className="overflow-y-auto overscroll-contain py-1" style={{ maxHeight: `calc(100vh / var(--app-zoom, 1) - ${Math.round((btn?.bottom || 40) + 16)}px)` }}>
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
                    <ul className="fixed z-50 w-72 overflow-hidden rounded-md border border-ink-200 bg-white py-1 dark:border-ink-700 dark:bg-ink-900"
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
                  <button type="button" onClick={() => choose(i)} className="flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-1.5 text-left hover:border-navy-900 hover:bg-ink-50 dark:hover:border-white dark:hover:bg-ink-800">
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
    <Button variant="ghost" size="icon" className="size-7 rounded-md" onClick={toggle} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
      {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
    </Button>
  );
}

/* ------------------------------------------------------------------ header strip */
function BranchSwitcher() {
  const { user, branch, setBranch } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const search = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  // links with ?switch=branch open the dropdown
  useEffect(() => {
    if (new URLSearchParams(location.search).get('switch') === 'branch') { navigate(location.pathname, { replace: true }); setOpen(true); }
  }, [location, navigate]);
  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setHi(0);
    setTimeout(() => search.current?.focus(), 0);
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const single = user.branches.length === 1 && !user.all_branches;
  const all = [...(user.all_branches ? [{ id: 'all', name: 'All Branches', code: 'all' }] : []), ...user.branches];
  const term = q.trim().toLowerCase();
  const list = term ? all.filter((b) => b.name.toLowerCase().includes(term) || String(b.code || '').toLowerCase().includes(term)) : all;
  const current = all.find((b) => String(b.id) === String(branch));
  const pick = (b) => { if (b) { setBranch(b.id); setOpen(false); } };
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(list[hi]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" disabled={single} onClick={() => setOpen((o) => !o)} title="Switch branch - data is kept separate for every branch"
        className="flex h-7 items-stretch overflow-hidden rounded-md border border-emerald-600/60 text-left transition hover:border-emerald-600 disabled:cursor-default dark:border-emerald-500/50">
        <span className="flex items-center gap-1.5 bg-emerald-600 px-2 text-[10px] font-bold tracking-wide text-white uppercase">
          <span className="relative flex size-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-white/70" /><span className="relative size-1.5 rounded-full bg-white" /></span>
          {branch === 'all' ? <Layers className="size-3.5" /> : <Building2 className="size-3.5" />}
          Branch
        </span>
        <span className="flex items-center gap-1 bg-emerald-50 px-2 dark:bg-emerald-950/40">
          <span className="max-w-36 truncate text-[12px] font-bold text-emerald-900 dark:text-emerald-100">{current?.name || 'Select branch'}</span>
          {!single && <ChevronDown className={clsx('size-3.5 text-emerald-700 transition dark:text-emerald-300', open && 'rotate-180')} />}
        </span>
      </button>
      {open && (() => {
        /* fixed: the header clips anything that overflows it */
        const r = box.current?.getBoundingClientRect();
        const width = 260;
        const left = Math.max(8, Math.min((r?.right ?? width) - width, window.innerWidth / appZoom() - width - 8));
        return (
          <div className="fixed z-50 w-[260px] animate-drop overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900"
            style={{ top: (r?.bottom ?? 40) + 4, left }}>
            <div className="relative border-b border-ink-100 p-1.5 dark:border-ink-800">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-ink-400" />
              <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={keys} placeholder="Search branch or code…"
                className="h-8 w-full rounded-md border border-ink-200 bg-white pr-2 pl-8 text-[13px] outline-none focus:border-emerald-500 dark:border-ink-700 dark:bg-ink-950" />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {!list.length && <li className="px-3 py-3 text-center text-[12px] text-ink-400">No branch matches “{q}”</li>}
              {list.map((b, i) => {
                const active = String(b.id) === String(branch);
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => pick(b)} onMouseEnter={() => setHi(i)}
                      className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]', i === hi && 'bg-ink-100 dark:bg-ink-800')}>
                      {b.id === 'all' ? <Layers className="size-3.5 shrink-0 text-ink-500" /> : <Building2 className="size-3.5 shrink-0 text-ink-500" />}
                      <span className={clsx('flex-1 truncate', active ? 'font-bold text-emerald-800 dark:text-emerald-300' : 'font-medium')}>{b.name}</span>
                      {b.id !== 'all' && b.code && <span className="num text-[10px] text-ink-400">{b.code}</span>}
                      {active && (
                        <span className="relative flex size-1.5" aria-hidden>
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}

/* ---- small header icons (inline SVG, 18px) */
const CalendarIcon = ({ day, alert }) => (
  <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" aria-hidden>
    <rect x="2" y="3.5" width="16" height="14.5" rx="2.5" className="fill-white stroke-ink-300 dark:fill-ink-800 dark:stroke-ink-600" strokeWidth="1" />
    <path d="M2 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 18 6v1.5H2Z" className={alert ? 'fill-rose-600' : 'fill-navy-900 dark:fill-white'} />
    <rect x="5.5" y="1.5" width="1.6" height="3.5" rx=".8" className="fill-ink-500" />
    <rect x="12.9" y="1.5" width="1.6" height="3.5" rx=".8" className="fill-ink-500" />
    <text x="10" y="15.6" textAnchor="middle" fontSize="7.5" fontWeight="700" className="fill-navy-900 dark:fill-white">{day}</text>
  </svg>
);

/* gold: stacked ingots */
const GoldIcon = () => (
  <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" aria-hidden>
    <defs>
      <linearGradient id="hdr-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fde68a" /><stop offset=".55" stopColor="#e0a526" /><stop offset="1" stopColor="#a16207" />
      </linearGradient>
    </defs>
    <path d="M1.5 17.5 3.4 12h5.2l1.9 5.5Z" fill="url(#hdr-gold)" stroke="#92400e" strokeWidth=".7" strokeLinejoin="round" />
    <path d="M9.5 17.5 11.4 12h5.2l1.9 5.5Z" fill="url(#hdr-gold)" stroke="#92400e" strokeWidth=".7" strokeLinejoin="round" />
    <path d="M5.5 11 7.4 5.5h5.2l1.9 5.5Z" fill="url(#hdr-gold)" stroke="#92400e" strokeWidth=".7" strokeLinejoin="round" />
    <path d="M8 7h2.5" stroke="#fffbeb" strokeWidth=".8" strokeLinecap="round" opacity=".8" />
  </svg>
);

/* silver: coin with milled edge */
const SilverIcon = () => (
  <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" aria-hidden>
    <defs>
      <radialGradient id="hdr-silver" cx=".35" cy=".3" r=".8">
        <stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#cbd5e1" /><stop offset="1" stopColor="#64748b" />
      </radialGradient>
    </defs>
    <circle cx="10" cy="10" r="8.2" fill="url(#hdr-silver)" stroke="#475569" strokeWidth=".7" />
    <circle cx="10" cy="10" r="6.1" fill="none" stroke="#64748b" strokeWidth=".6" strokeDasharray="1 1" />
    <text x="10" y="12.6" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155">Ag</text>
  </svg>
);

/* one-line stat: icon + small grey label + bold value */
const HeaderStat = ({ icon, label, value, onClick, accent, title }) => (
  <button type="button" onClick={onClick} title={title}
    className={clsx('flex h-7 items-center gap-1.5 rounded-md px-2 leading-none whitespace-nowrap transition', onClick ? 'hover:bg-ink-100 dark:hover:bg-ink-800' : 'cursor-default')}>
    {icon}
    <span className="text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{label}</span>
    <span className={clsx('num text-[13px] font-bold', accent || 'text-navy-900 dark:text-white')}>{value}</span>
  </button>
);

const Sep = () => <span aria-hidden className="h-4 w-px shrink-0 bg-ink-200 dark:bg-ink-700" />;

function HeaderStrip({ onSearch, onProfile, onAlerts, alertCount, dark, setDark }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: rates = [] } = useFetch('/masters/rates/latest/all', undefined, { staleTime: 5 * 60_000 });
  const { data: years = [] } = useFetch('/admin/financial-years', undefined, { staleTime: 30 * 60_000 });
  const fy = years.find((y) => y.is_current);
  const { data: billing } = useFetch('/desk/billing-date', undefined, { staleTime: 60_000 });
  setWorkDate(billing?.billingDate);
  const gold = rates.find((r) => r.metal_code === 'GOLD');
  const silver = rates.find((r) => r.metal_code === 'SILVER');
  const todayRate = gold && dayjs(gold.rate_date).isSame(dayjs(today()), 'day');
  const name = company?.name || 'Gold Finance';

  return (
    <header className="no-print relative z-20 flex h-12 items-center gap-3 overflow-hidden border-b border-ink-200 bg-white px-5 py-2 dark:border-ink-800 dark:bg-ink-900">
      <Link to="/" className="flex shrink-0 items-center gap-2" title={fy ? `Books ${dayjs(fy.start_date).format('DD/MM/YYYY')} to ${dayjs(fy.end_date).format('DD/MM/YYYY')}` : undefined}>
        {company?.logo_path
          ? <img src={company.logo_path} alt="" className="size-6 rounded-md bg-white object-contain ring-1 ring-ink-200" />
          : <span className="grid size-6 place-items-center rounded-md bg-navy-900 text-[13px] font-bold text-white dark:bg-white dark:text-navy-900">{name.replace(/[^A-Za-z]/g, '').charAt(0) || 'G'}</span>}
        <span className="max-w-56 truncate text-[15px] font-bold text-navy-900 dark:text-white">{name}</span>
        {fy && (
          <span className="flex h-6 items-stretch overflow-hidden rounded-md border border-navy-900 text-[11px] font-bold dark:border-white/70">
            <span className="flex items-center bg-navy-900 px-1.5 text-[10px] tracking-wider text-white dark:bg-white dark:text-navy-900">FY</span>
            <span className="num flex items-center bg-white px-1.5 text-navy-900 dark:bg-ink-900 dark:text-white">{fy.name}</span>
          </span>
        )}
      </Link>

      <Sep />

      <div className="hidden items-center md:flex">
        <HeaderStat icon={<CalendarIcon day={dayjs(billing?.billingDate).format('D')} alert={billing?.behind} />} label="Date" value={dayjs(billing?.billingDate).format('DD/MM/YYYY')} accent={billing?.behind ? 'text-rose-600' : undefined}
          onClick={billing?.behind ? () => navigate('/accounts/day-report') : undefined} title={billing?.behind ? 'Billing date is behind today - finish Day End' : 'Billing date'} />
        <Sep />
        <HeaderStat icon={<GoldIcon />} label="Gold" value={gold ? `₹${amount((gold.market_rate * 100) / (gold.purity || 100))}` : 'Not set'} accent={!todayRate ? 'text-rose-600' : undefined}
          onClick={() => navigate('/masters?tab=rates')} title={todayRate ? 'Gold rate per gram' : 'Gold rate not set for today'} />
        <Sep />
        <HeaderStat icon={<SilverIcon />} label="Silver" value={silver ? `₹${amount((silver.market_rate * 100) / (silver.purity || 100))}` : 'Not set'}
          onClick={() => navigate('/masters?tab=rates')} title="Silver rate per gram" />
      </div>

      <span className="flex-1" />

      <button type="button" onClick={onSearch} title="Search (Ctrl K)"
        className="flex h-7 shrink-0 items-center gap-2 rounded-md border border-ink-200 px-2 text-[12px] text-ink-400 transition hover:border-navy-400 hover:text-navy-700 dark:border-ink-700">
        <Search className="size-3.5" /><span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded bg-ink-100 px-1 text-[10px] font-semibold text-ink-500 sm:block dark:bg-ink-800">Ctrl K</kbd>
      </button>

      <Sep />
      <BranchSwitcher />
      <Sep />

      <div className="flex shrink-0 items-center">
        <FullscreenButton />
        <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Theme" className="size-7 rounded-md">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
        <Button variant="ghost" size="icon" onClick={onAlerts} className="relative size-7 rounded-md" aria-label="Reminders">
          <Bell className="size-4" />
          {alertCount > 0 && <span className="absolute top-0 right-0 grid size-3.5 place-items-center rounded-full bg-rose-600 text-[8px] font-bold text-white">{alertCount}</span>}
        </Button>
      </div>

      <Sep />

      <button type="button" onClick={onProfile} title={user.role_name}
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-md pr-2 pl-0.5 transition hover:bg-ink-100 dark:hover:bg-ink-800">
        <span className="grid size-6 place-items-center rounded-md bg-navy-900 text-[10px] font-bold text-white uppercase dark:bg-white dark:text-navy-900">{user.username.slice(0, 2)}</span>
        <span className="text-[12px] font-bold text-navy-900 uppercase dark:text-white">{user.username}</span>
      </button>
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
      <span className="font-bold ml-auto text-xl whitespace-nowrap text-white">{company?.name || 'Gold Finance'}</span>
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
      <div className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
        {[...HOTKEYS.map((h) => [h.key, h.label]), ['Ctrl + K', 'Search loans & customers'], ['Esc', 'Close drawer / menu']].map(([k, l]) => (
          <div key={k} className="flex items-center gap-3 border-b border-ink-100 px-3 py-1.5 text-[13px] last:border-0 dark:border-ink-800">
            <kbd className="min-w-16 rounded-md border border-ink-300 bg-ink-50 px-2 py-0.5 text-center text-[11px] font-bold text-navy-900 dark:border-ink-600 dark:bg-ink-800 dark:text-white">{k}</kbd><span>{l}</span>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function AboutDrawer({ open, onClose }) {
  const { data: company } = useCompany();
  return (
    <Drawer open={open} onClose={onClose} title="About" icon={Info} size="sm">
      <div className="flex items-center gap-3 rounded-md border border-ink-200 p-3 dark:border-ink-800">
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-navy-900 text-xl font-bold text-white dark:bg-white dark:text-navy-900">{(company?.name || 'G').replace(/[^A-Za-z]/g, '').charAt(0) || 'G'}</span>
        <div className="min-w-0"><p className="truncate text-lg font-bold text-navy-900 dark:text-white">{company?.name || 'Gold Finance'}</p><p className="text-[12px] text-ink-500">A complete pawn broker solution</p></div>
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-ink-200 text-[13px] dark:border-ink-800">
        {[['Edition', 'Web edition 1.0'], ['Branches', 'Multi-branch'], ['Licence', company?.licence_no || '-'], ['Phone', company?.mobile || company?.phone || '-']].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-ink-100 px-3 py-1.5 last:border-0 dark:border-ink-800"><span className="text-ink-500">{k}</span><b className="text-right">{v}</b></div>
        ))}
      </div>
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

  useHotkey('ctrl+k', () => setPanel('search'));
  for (const h of HOTKEYS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkey(h.key, () => allowed(can, h.screen) && navigate(h.path));
  }

  return (
    /* a page marked .fit-screen (the dashboard) fills the window exactly on desktop: no page scroll, its sections scroll inside */
    <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] flex-col xl:has-[.fit-screen]:h-[calc(100vh/var(--app-zoom,1))]">
      <div className="sticky top-0 z-30">
        <MenuBar onAction={setPanel} onExit={() => setPanel('exit')} />
        <HeaderStrip dark={dark} setDark={setDark} onSearch={() => setPanel('search')} onProfile={() => setPanel('profile')} onAlerts={() => setPanel('alerts')} alertCount={alerts.length} />
      </div>
      <main className="w-full flex-1 p-2 sm:p-3 xl:has-[.fit-screen]:flex xl:has-[.fit-screen]:min-h-0 xl:has-[.fit-screen]:flex-col xl:has-[.fit-screen]:overflow-hidden">
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
