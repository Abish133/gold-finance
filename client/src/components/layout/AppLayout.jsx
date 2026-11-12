import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { Bell, LogOut, Moon, Search, Sun, Building2, KeyRound, Layers, ChevronDown, ChevronRight, Power, Keyboard, Info, Maximize, Minimize, Menu as MenuIcon, X, CalendarDays, Coins } from 'lucide-react';
import { MENUS, HOTKEYS, allowed } from '@/config/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFetch, useAction, useCompany } from '@/hooks/useApi';
import { useHotkey } from '@/hooks/useUtils';
import { Button, Drawer, Spinner, Field, Input, Badge, Modal } from '@/components/ui';
import { GlobalSearch } from './GlobalSearch';
import { amount, setWorkDate, today } from '@/lib/format';
import { addRecentScreen, recentScreens } from '@/lib/recent';
import { MorningBriefing } from './MorningBriefing';
import { loadWaTemplates } from '@/lib/whatsapp';
import { appZoom, isDarkMode, loadAppearance, saveAppearance, syncAppearance } from '@/lib/appearance';
import { PasswordHelp } from '@/components/common/PasswordHelp';

/* light / dark lives in the Appearance settings (also "follow Windows") - the header button switches it */
const useTheme = () => {
  const [dark, setDarkState] = useState(() => isDarkMode());
  useEffect(() => {
    const on = () => setDarkState(isDarkMode());
    window.addEventListener('gf-appearance', on);
    return () => window.removeEventListener('gf-appearance', on);
  }, []);
  const setDark = (v) => { const next = typeof v === 'function' ? v(isDarkMode()) : v; saveAppearance({ ...loadAppearance(), mode: next ? 'dark' : 'light' }); };
  return [dark, setDark];
};

/* ------------------------------------------------------------------ top menu bar */
function MenuBar({ onAction, onExit }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(null);
  const [sub, setSub] = useState(null);
  const [mobile, setMobile] = useState(false);
  const bar = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const visible = (i) => (i.items ? i.items.some((x) => allowed(can, x.screen)) : i.section || allowed(can, i.screen));
  const menus = MENUS.map((m) => ({ ...m, items: m.items.filter(visible).map((i) => (i.items ? { ...i, items: i.items.filter((x) => allowed(can, x.screen)) } : i)) }))
    .map((m) => ({ ...m, items: m.items.filter((i, idx, arr) => !i.section || (arr[idx + 1] && !arr[idx + 1].section)) }))
    .filter((m) => m.items.some((i) => !i.section));

  useEffect(() => { setOpen(null); setSub(null); setMobile(false); }, [location]);
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
    setOpen(null); setMobile(false);
    if (i.action) onAction(i.action); else navigate(i.path);
  };

  /* the menu that owns the page you are on gets the underline */
  const hasPath = (i) => (i.path && i.path.split('?')[0] === location.pathname) || i.items?.some(hasPath);
  const current = menus.find((m) => m.items.some(hasPath))?.key;
  /* the screen you are on: breadcrumb "Loans › Release" + the Recent list */
  const flatItems = (items) => items.flatMap((i) => (i.section ? [] : i.items ? i.items : [i]));
  const curMenu = menus.find((m) => m.key === current);
  const curItem = curMenu && (flatItems(curMenu.items).find((i) => i.path === location.pathname + location.search) || flatItems(curMenu.items).find(hasPath));
  useEffect(() => { if (curItem?.path) addRecentScreen({ path: curItem.path, label: curItem.label, menu: curMenu.label }); }, [curItem?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav ref={bar} className="navy-gradient no-print relative z-30 flex h-10 items-stretch gap-1 px-2 text-[13px] text-white/70 sm:px-3">
      {/* phones / tablets: one Menu button */}
      <div className="py-1.5 lg:hidden">
        <button type="button" onClick={() => setMobile(true)} className="flex h-full items-center gap-1.5 rounded-md px-2.5 font-semibold text-white hover:bg-white/10">
          <MenuIcon className="size-4" />Menu
        </button>
      </div>
      {current && <span className="flex min-w-0 items-center truncate text-[12px] font-semibold text-white/60 lg:hidden">{menus.find((m) => m.key === current)?.label}</span>}
      {menus.map((m) => {
        const isOpen = open === m.key;
        const isCurrent = current === m.key;
        return (
          <div key={m.key} className="relative hidden py-1.5 lg:block" data-menu={m.key} onMouseEnter={() => open && setOpen(m.key)}>
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
      {curItem && (
        <span className="mr-2 hidden min-w-0 items-center gap-1.5 truncate text-[12px] text-white/50 lg:flex" title="You are here">
          {curMenu.label}<ChevronRight className="size-3 shrink-0 opacity-60" /><b className="truncate font-semibold text-white/90">{curItem.label}</b>
        </span>
      )}
      <div className="py-1.5">
        <button type="button" onClick={onExit} className="flex h-full items-center gap-1.5 rounded-md px-2.5 font-semibold transition hover:bg-rose-600 hover:text-white">
          <Power className="size-4" />Exit
        </button>
      </div>
      {mobile && <MobileMenu menus={menus} current={current} hasPath={hasPath} onChoose={choose} onClose={() => setMobile(false)} />}
      {open && (() => {
        const m = menus.find((x) => x.key === open);
        const btn = bar.current?.querySelector(`[data-menu="${open}"]`)?.getBoundingClientRect();
        const left = Math.max(4, Math.min(btn ? btn.left : 8, window.innerWidth / appZoom() - 330));
        return (
          <motion.div key={open} className="fixed z-40 mt-10 w-80 overflow-hidden rounded-md border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            style={{ left: `${left}px`, marginTop: '42px' }} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 38 }}>
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
          </motion.div>
        );
      })()}
    </nav>
  );
}

/* ------------------------------------------------------------------ mobile menu */
/** Slide-in menu for phones and tablets: search + one accordion per menu. */
function MobileMenu({ menus, current, hasPath, onChoose, onClose }) {
  const [openKey, setOpenKey] = useState(current || menus[0]?.key);
  const [q, setQ] = useState('');
  const [recent] = useState(() => recentScreens().slice(0, 4));
  const term = q.trim().toLowerCase();
  const flat = (items) => items.flatMap((i) => (i.section ? [] : i.items ? i.items : [i]));
  const hits = term ? menus.flatMap((m) => flat(m.items).filter((i) => `${i.label} ${i.hint || ''}`.toLowerCase().includes(term)).map((i) => ({ ...i, menu: m.label }))) : [];
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const Item = ({ i, sub }) => (
    <button type="button" onClick={() => onChoose(i)}
      className={clsx('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left', hasPath(i) ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
      <i.icon className="size-4 shrink-0 text-navy-600 dark:text-navy-300" />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{i.label}</span>{(sub || i.hint) && <span className="block truncate text-[11px] text-ink-500">{sub || i.hint}</span>}</span>
      {i.hot && <kbd className="rounded-sm border border-ink-300 bg-ink-50 px-1.5 text-[10px] font-bold text-ink-600 dark:border-ink-700 dark:bg-ink-800">{i.hot}</kbd>}
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <motion.div className="absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col bg-white text-ink-800 dark:bg-ink-900 dark:text-ink-100"
        initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
        <div className="navy-gradient flex h-11 shrink-0 items-center gap-2 px-3 text-white">
          <MenuIcon className="size-4" /><b className="flex-1 text-[14px]">Menu</b>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid size-8 place-items-center rounded-md hover:bg-white/15"><X className="size-5" /></button>
        </div>
        <div className="shrink-0 border-b border-ink-100 p-2 dark:border-ink-800">
          <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a screen…" className="h-9 w-full rounded-md border border-ink-200 bg-white pr-2 pl-8 text-[14px] outline-none focus:border-navy-400 dark:border-ink-700 dark:bg-ink-900" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!term && recent.length > 0 && (
            <div className="mb-1 border-b border-ink-100 pb-2 dark:border-ink-800">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-widest text-ink-400 uppercase">Recent</p>
              {recent.map((r) => { const it = flat(menus.flatMap((m) => m.items)).find((x) => x.path === r.path); return it ? <Item key={r.path} i={it} sub={r.menu} /> : null; })}
            </div>
          )}
          {term ? (hits.length ? hits.map((i) => <Item key={`${i.menu}-${i.label}`} i={i} sub={i.menu} />) : <p className="p-4 text-center text-[13px] text-ink-400">No screen named "{q}"</p>)
            : menus.map((m) => {
              const isOpen = openKey === m.key;
              return (
                <div key={m.key} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                  <button type="button" onClick={() => setOpenKey(isOpen ? null : m.key)} className={clsx('flex w-full items-center gap-2.5 px-2 py-2.5 text-left', current === m.key && 'text-emerald-800 dark:text-emerald-300')}>
                    <m.icon className="size-4.5 shrink-0" /><span className="flex-1 text-[14px] font-bold">{m.label}</span>
                    {current === m.key && <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}
                    <ChevronDown className={clsx('size-4 text-ink-400 transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="pb-2 pl-2">
                      {m.items.map((i, k) => (i.section
                        ? (i.section.trim() ? <p key={`s${k}`} className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-ink-400 uppercase">{i.section}</p> : <div key={`s${k}`} className="my-1 border-t border-ink-100 dark:border-ink-800" />)
                        : i.items ? (
                          <div key={i.label}><p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-ink-400 uppercase">{i.label}</p>{i.items.map((x) => <Item key={x.label} i={x} />)}</div>
                        ) : <Item key={i.label} i={i} />))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </motion.div>
    </div>
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
    <Button variant="ghost" size="icon" className="size-8 rounded-md hover:bg-white dark:hover:bg-ink-900" onClick={toggle} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
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
        className="flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 py-1 pr-2 pl-1 text-left transition hover:border-emerald-400 disabled:cursor-default dark:border-emerald-900 dark:bg-emerald-950/30">
        <span className="relative grid size-8 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
          {branch === 'all' ? <Layers className="size-4" /> : <Building2 className="size-4" />}
          <span className="absolute -top-0.5 -right-0.5 flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative size-2 rounded-full bg-emerald-400 ring-2 ring-emerald-50 dark:ring-emerald-950" /></span>
        </span>
        <span className="hidden flex-col leading-none sm:flex">
          <span className="text-[9px] font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">Branch</span>
          <span className="mt-0.5 max-w-36 truncate text-[12px] font-bold text-emerald-900 dark:text-emerald-100">{current?.name || 'Select branch'}</span>
        </span>
        {!single && <ChevronDown className={clsx('size-3.5 text-emerald-700 transition dark:text-emerald-300', open && 'rotate-180')} />}
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

/* gold: stacked ingots */

/* silver: coin with milled edge */

/* one-line stat: icon + small grey label + bold value */
const HeaderStat = ({ icon, label, value, onClick, accent, title }) => (
  <button type="button" onClick={onClick} title={title}
    className={clsx('flex items-center gap-2 rounded-md px-2 py-1 text-left whitespace-nowrap transition', onClick ? 'hover:bg-white dark:hover:bg-ink-700/60' : 'cursor-default')}>
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white dark:bg-ink-900">{icon}</span>
    <span className="flex flex-col leading-none">
      <span className="text-[9px] font-bold tracking-wider text-ink-400 uppercase">{label}</span>
      <span className={clsx('num mt-0.5 text-[13px] font-bold', accent || 'text-navy-900 dark:text-white')}>{value}</span>
    </span>
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
    <header className="no-print relative z-20 flex h-14 items-center gap-2 overflow-hidden border-b border-ink-200 bg-white px-2 sm:gap-3 sm:px-4 dark:border-ink-800 dark:bg-ink-900">
      {/* brand: logo, name, books year */}
      <Link to="/" className="flex shrink-0 items-center gap-2.5" title={fy ? `Books ${dayjs(fy.start_date).format('DD/MM/YYYY')} to ${dayjs(fy.end_date).format('DD/MM/YYYY')}` : undefined}>
        {company?.logo_path
          ? <img src={company.logo_path} alt="" className="size-9 rounded-md bg-white object-contain ring-1 ring-ink-200 dark:ring-ink-700" />
          : <span className="grid size-9 place-items-center rounded-md bg-navy-900 text-[16px] font-bold text-white dark:bg-white dark:text-navy-900">{name.replace(/[^A-Za-z]/g, '').charAt(0) || 'G'}</span>}
        <span className="hidden min-w-0 flex-col leading-none sm:flex">
          <span className="max-w-56 truncate text-[15px] font-bold text-navy-900 dark:text-white">{name}</span>
          {fy && <span className="mt-1 text-[11px] text-ink-500">Books <b className="num font-semibold text-ink-700 dark:text-ink-300">FY {fy.name}</b></span>}
        </span>
      </Link>

      {/* today's figures in one soft panel */}
      <div className="ml-2 hidden items-center gap-0.5 rounded-md bg-ink-100/70 p-0.5 md:flex dark:bg-ink-800/60">
        <HeaderStat icon={<CalendarDays className={clsx('size-4', billing?.behind ? 'text-rose-600' : 'text-navy-700 dark:text-ink-200')} />} label="Billing date" value={dayjs(billing?.billingDate).format('DD MMM YYYY')} accent={billing?.behind ? 'text-rose-600' : undefined}
          onClick={billing?.behind ? () => navigate('/accounts/day-report') : undefined} title={billing?.behind ? 'Billing date is behind today - finish Day End' : 'Billing date'} />
        <HeaderStat icon={<Coins className="size-4 text-amber-500" />} label={todayRate ? 'Gold / g' : 'Gold / g · not today'} value={gold ? `₹${amount((gold.market_rate * 100) / (gold.purity || 100))}` : 'Not set'} accent={!todayRate ? 'text-rose-600' : undefined}
          onClick={() => navigate('/masters?tab=rates')} title={todayRate ? 'Gold rate per gram - click to update' : 'Gold rate not entered for today - click to enter'} />
        <HeaderStat icon={<Coins className="size-4 text-slate-400" />} label="Silver / g" value={silver ? `₹${amount((silver.market_rate * 100) / (silver.purity || 100))}` : 'Not set'}
          onClick={() => navigate('/masters?tab=rates')} title="Silver rate per gram - click to update" />
      </div>

      <span className="flex-1" />

      {/* search */}
      <button type="button" onClick={onSearch} title="Search (Ctrl K)"
        className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-transparent bg-ink-100/70 px-3 text-[12px] text-ink-500 transition hover:border-ink-300 hover:bg-white lg:w-64 dark:bg-ink-800/60 dark:hover:border-ink-600 dark:hover:bg-ink-900">
        <Search className="size-4 shrink-0" /><span className="hidden min-w-0 flex-1 truncate text-left whitespace-nowrap lg:inline">Search loan, customer…</span>
        <kbd className="hidden shrink-0 rounded-sm border border-ink-200 bg-white px-1.5 text-[10px] font-semibold whitespace-nowrap text-ink-500 sm:block dark:border-ink-700 dark:bg-ink-900">Ctrl K</kbd>
      </button>

      <BranchSwitcher />

      {/* tools */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-ink-100/70 p-0.5 dark:bg-ink-800/60">
        <span className="hidden sm:block"><FullscreenButton /></span>
        <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Light / dark" title={dark ? 'Light mode' : 'Dark mode'} className="size-8 rounded-md hover:bg-white dark:hover:bg-ink-900">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
        <Button variant="ghost" size="icon" onClick={onAlerts} className="relative size-8 rounded-md hover:bg-white dark:hover:bg-ink-900" aria-label="Reminders" title="Reminders">
          <Bell className="size-4" />
          {alertCount > 0 && <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white ring-2 ring-ink-100 dark:ring-ink-800">{alertCount}</span>}
        </Button>
      </div>

      {/* user */}
      <button type="button" onClick={onProfile} title="My profile · change password · sign out"
        className="flex h-10 shrink-0 items-center gap-2 rounded-md py-1 pr-2 pl-1 transition hover:bg-ink-100 dark:hover:bg-ink-800">
        <span className="grid size-8 place-items-center rounded-md bg-navy-900 text-[11px] font-bold text-white uppercase dark:bg-white dark:text-navy-900">{(user.full_name || user.username).split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
        <span className="hidden flex-col text-left leading-none sm:flex">
          <span className="max-w-32 truncate text-[12px] font-bold text-navy-900 dark:text-white">{user.full_name || user.username}</span>
          <span className="mt-1 max-w-32 truncate text-[10px] text-ink-500">{user.role_name}</span>
        </span>
        <ChevronDown className="hidden size-3.5 text-ink-400 sm:block" />
      </button>
    </header>
  );
}

/* ------------------------------------------------------------------ status bar */
function StatusBar() {
  const navigate = useNavigate();
  const { user, currentBranch, isAllBranches } = useAuth();
  const { data, isError } = useFetch('/dashboard/status', undefined, { refetchInterval: 60_000 });
  const { data: company } = useCompany();
  const [now, setNow] = useState(() => dayjs());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 20_000);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const d = data || {};
  const num = (v) => Number(v || 0);
  const short = (v) => { const x = num(v); return x >= 1e7 ? `${(x / 1e7).toFixed(2)}Cr` : x >= 1e5 ? `${(x / 1e5).toFixed(2)}L` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : `${Math.round(x)}`; };
  const Item = ({ label, value, to, tone, title }) => (
    <button type="button" onClick={to ? () => navigate(to) : undefined} title={title || (to ? 'Open' : undefined)}
      className={clsx('flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 leading-none whitespace-nowrap', to ? 'hover:bg-white/10' : 'cursor-default')}>
      <span className="text-[11px] leading-none text-white/55">{label}</span>
      <b className={clsx('num text-[13px] leading-none', tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-white')}>{value}</b>
    </button>
  );
  const Group = ({ title, className, children }) => (
    <div className={clsx('flex shrink-0 items-center', className)}>
      <span className="mr-0.5 flex h-4 items-center rounded-sm bg-white/10 px-1.5 text-[9px] leading-none font-bold tracking-wider text-white/70 uppercase">{title}</span>{children}
    </div>
  );
  const Sep = () => <span aria-hidden className="h-4 w-px shrink-0 bg-white/15" />;
  const serverOk = online && !isError;
  const attention = num(d.overdue) + num(d.unsettled_12m) + num(d.sms_failed);

  return (
    <footer className="navy-gradient no-print hidden h-9 items-center gap-2.5 overflow-hidden border-t-[3px] border-gold-500 px-3 leading-none text-white md:flex">
      <Group title="Today">
        <Item label="Loans" value={`${num(d.today_loans)} · ₹${short(d.today_lent)}`} to="/accounts/day-report" title="New loans given today" />
        <Item label="Releases" value={num(d.today_releases)} to="/accounts/day-report" />
      </Group>
      <Sep />
      <Group title={now.format('MMM')}>
        <Item label="Loans" value={`${num(d.month_loans)} · ₹${short(d.month_lent)}`} to="/analytics" title="This month - open Business Analytics" />
        <Item label="Releases" value={num(d.month_releases)} to="/analytics" />
      </Group>
      <Sep />
      <Group title="Book" className="hidden lg:flex">
        <Item label="Open" value={num(d.open_loans)} to="/loans" title="Open loans - Pledge Book" />
        <Item label="Outstanding" value={`₹${short(d.outstanding)}`} to="/loans" />
        <Item label="Gold" value={`${num(d.open_wt).toFixed(1)} g`} to="/stock/current" title="Net weight in custody - Current Stock" />
      </Group>
      <span className="hidden lg:block"><Sep /></span>
      <Group title={attention ? 'Attention' : 'All clear'} className="hidden xl:flex">
        <Item label="Overdue" value={num(d.overdue)} tone={num(d.overdue) ? 'warn' : undefined} to="/loans/calculator" title="Past the settle-before date" />
        <Item label="12m+" value={num(d.unsettled_12m)} tone={num(d.unsettled_12m) ? 'bad' : undefined} to="/auction" title="Open for over 12 months - Auction" />
        {(num(d.sms_pending) > 0 || num(d.sms_failed) > 0) && (
          <Item label="SMS" value={num(d.sms_failed) ? `${num(d.sms_failed)} failed` : `${num(d.sms_pending)} waiting`} tone={num(d.sms_failed) ? 'bad' : undefined} to="/settings/messages" />
        )}
      </Group>

      <span className="flex-1" />
      <span className={clsx('flex h-6 shrink-0 items-center gap-1.5 text-[11px] leading-none', serverOk ? 'text-white/70' : 'text-rose-300')} title={serverOk ? 'Connected to the server' : 'Cannot reach the server - entries may not save'}>
        <span className={clsx('size-2 rounded-full', serverOk ? 'bg-emerald-400' : 'animate-pulse bg-rose-400')} />{serverOk ? 'Online' : 'Offline'}
      </span>
      <Sep />
      <span className="hidden h-6 shrink-0 items-center truncate text-[11px] leading-none text-white/70 lg:flex" title="Signed in as">{user.username} · {isAllBranches ? 'All branches' : currentBranch?.name}</span>
      <span className="hidden lg:block"><Sep /></span>
      <span className="num flex h-6 shrink-0 items-center text-[12px] leading-none font-semibold text-white/85" title={now.format('dddd, DD MMMM YYYY')}>{now.format('ddd DD MMM · hh:mm A')}</span>
      <Sep />
      <span className="hidden h-6 max-w-56 shrink-0 items-center truncate text-[14px] leading-none font-bold whitespace-nowrap text-white xl:flex">{company?.name || 'Gold Finance'}</span>
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
    <Modal open={open} onClose={onClose} title={user.full_name} subtitle={`@${user.username} · ${user.role_name}`} icon={KeyRound} size="md"
      footer={<Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button>}>
      <form className="space-y-3" onSubmit={form.handleSubmit((v) => change.mutate({ body: { currentPassword: v.currentPassword, newPassword: v.newPassword } }, { onSuccess: () => form.reset() }))}>
        <h4 className="text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">Change password</h4>
        <Field label="Current password" error={form.formState.errors.currentPassword && 'Enter your current password'}><Input type="password" autoComplete="current-password" {...form.register('currentPassword', { required: true })} /></Field>
        <div>
          <Field label="New password" error={form.formState.errors.newPassword && 'At least 6 characters'}><Input type="password" autoComplete="new-password" {...form.register('newPassword', { required: true, minLength: 6 })} /></Field>
          <PasswordHelp value={form.watch('newPassword')} onUse={(p) => { form.setValue('newPassword', p, { shouldDirty: true, shouldValidate: true }); form.setValue('confirmPassword', p, { shouldValidate: true }); }} />
        </div>
        <Field label="Confirm new password" error={form.formState.errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirmPassword', { required: 'Type the new password again', validate: (v) => v === form.getValues('newPassword') || 'Does not match the new password' })} />
        </Field>
        <Button type="submit" variant="gold" className="w-full" loading={change.isPending}>Update password</Button>
      </form>
    </Modal>
  );
}

function ShortcutsDrawer({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" icon={Keyboard} size="md">
      <div className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
        {[...HOTKEYS.map((h) => [h.key, h.label]), ['Ctrl + K', 'Search loans & customers'], ['Esc', 'Close drawer / menu']].map(([k, l]) => (
          <div key={k} className="flex items-center gap-3 border-b border-ink-100 px-3 py-1.5 text-[13px] last:border-0 dark:border-ink-800">
            <kbd className="min-w-16 rounded-md border border-ink-300 bg-ink-50 px-2 py-0.5 text-center text-[11px] font-bold text-navy-900 dark:border-ink-600 dark:bg-ink-800 dark:text-white">{k}</kbd><span>{l}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function AboutDrawer({ open, onClose }) {
  const { data: company } = useCompany();
  return (
    <Modal open={open} onClose={onClose} title="About" icon={Info} size="sm">
      <div className="flex items-center gap-3 rounded-md border border-ink-200 p-3 dark:border-ink-800">
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-navy-900 text-xl font-bold text-white dark:bg-white dark:text-navy-900">{(company?.name || 'G').replace(/[^A-Za-z]/g, '').charAt(0) || 'G'}</span>
        <div className="min-w-0"><p className="truncate text-lg font-bold text-navy-900 dark:text-white">{company?.name || 'Gold Finance'}</p><p className="text-[12px] text-ink-500">A complete pawn broker solution</p></div>
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-ink-200 text-[13px] dark:border-ink-800">
        {[['Edition', 'Web edition 1.0'], ['Branches', 'Multi-branch'], ['Licence', company?.licence_no || '-'], ['Phone', company?.mobile || company?.phone || '-']].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-ink-100 px-3 py-1.5 last:border-0 dark:border-ink-800"><span className="text-ink-500">{k}</span><b className="text-right">{v}</b></div>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ layout */
export function AppLayout() {
  const [panel, setPanel] = useState(null);
  const [dark, setDark] = useTheme();
  const navigate = useNavigate();
  const { can, logout } = useAuth();
  const { data: alerts = [] } = useFetch('/dashboard/alerts', undefined, { refetchInterval: 5 * 60_000 });

  useEffect(() => { syncAppearance(); loadWaTemplates(); }, []); // the user's own look (or the shop default) + WhatsApp texts after login
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
      <main className="w-full min-w-0 flex-1 p-2 sm:p-3 xl:has-[.fit-screen]:flex xl:has-[.fit-screen]:min-h-0 xl:has-[.fit-screen]:flex-col xl:has-[.fit-screen]:overflow-hidden">
        <Suspense fallback={<Spinner label="Loading screen…" />}><Outlet /></Suspense>
      </main>
      <div className="sticky bottom-0 z-20"><StatusBar /></div>

      <GlobalSearch open={panel === 'search'} onClose={() => setPanel(null)} />
      <MorningBriefing />
      <AlertsDrawer open={panel === 'alerts'} onClose={() => setPanel(null)} alerts={alerts} />
      <ProfileDrawer open={panel === 'profile'} onClose={() => setPanel(null)} />
      <ShortcutsDrawer open={panel === 'shortcuts'} onClose={() => setPanel(null)} />
      <AboutDrawer open={panel === 'about'} onClose={() => setPanel(null)} />
      <Modal tone="red" open={panel === 'exit'} onClose={() => setPanel(null)} title="Exit" icon={Power} size="sm"
        footer={<><Button variant="outline" onClick={() => setPanel(null)}>Stay</Button><Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button></>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">Sign out of this computer? Unsaved entries on the open screen will be lost.</p>
      </Modal>
    </div>
  );
}
