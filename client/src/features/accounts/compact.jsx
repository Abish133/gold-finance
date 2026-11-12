import clsx from 'clsx';
import { PageActions } from '@/components/common/PageActions';

/* Shared compact building blocks for the accounts screens (fit-screen, no page scroll). */

export const SHELL = 'desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1';

/** Slim dark header bar; children go on the right (chips, tabs). */
export function Head({ icon: Icon, title, sub, children }) {
  return (
    <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
      {Icon && <Icon className="size-5 shrink-0 opacity-80" />}
      <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">{title}</h1>{sub && <p className="hidden truncate text-[12px] text-white/60 lg:block">{sub}</p>}</div>
      {children}
    </section>
  );
}

/** Info chip for the dark header. */
export function Chip({ label, value, strong }) {
  return (
    <div className={clsx('flex items-center gap-2 rounded-md border px-3 py-1', strong ? 'border-white bg-white text-navy-900' : 'border-white/15')}>
      <span className={clsx('text-[10px] font-bold tracking-wider uppercase', strong ? 'text-navy-900/60' : 'text-white/60')}>{label}</span><b className="num text-[13px] whitespace-nowrap">{value}</b>
    </div>
  );
}

/** Tabs that sit inside the dark header. */
export function HeadTabs({ value, onChange, tabs }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-white/20">
      {tabs.map(([k, l, Icon, count]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={clsx('flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold transition', value === k ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10')}>
          {Icon && <Icon className="size-3.5" />}{l}{count != null && <span className={clsx('num rounded-sm px-1 text-[10px]', value === k ? 'bg-navy-900/10' : 'bg-white/15')}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Pulsing "active" dot. */
export function Dot() {
  return <span className="relative flex size-1.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>;
}

/** Joined toggle button class. */
export const tgl = (on) => clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md',
  on ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300');

/** Joined toggle group: options [[value, label]]. */
export function Toggle({ value, onChange, options, isOn }) {
  return (
    <div className="flex">
      {options.map(([k, l]) => { const on = isOn ? isOn(k) : value === k; return <button key={k} type="button" onClick={() => onChange(k)} className={tgl(on)}>{on && <Dot />}{l}</button>; })}
    </div>
  );
}

/** Filter / toolbar strip. */
export function Bar({ className, children }) {
  return <div className={clsx('flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900', className)}>{children}</div>;
}

/** Page actions: shown in the dark header bar; the hint text becomes the "Keys" list. */
export function Actions({ hint, children }) {
  return <PageActions keys={hint}>{children}</PageActions>;
}

const COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' };
/** Figure strip: items [{ label, value, bar, tone, hint }] - bar / tone are literal Tailwind classes. */
export function Strip({ items }) {
  return (
    <div className={clsx('grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900', COLS[items.length])}>
      {items.map((i) => (
        <div key={i.label} className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
          <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', i.bar || 'bg-navy-900 dark:bg-white')} />
          <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{i.label}</p>
          <p className="flex min-w-0 items-baseline gap-2"><span className={clsx('num truncate text-[15px] leading-tight font-bold', i.tone || 'text-navy-900 dark:text-white')}>{i.value}</span>{i.hint && <span className="truncate text-[10px] text-ink-500" title={i.hint}>{i.hint}</span>}</p>
        </div>
      ))}
    </div>
  );
}

/** Small labelled field for toolbars. */
export function F({ label, className, children }) {
  return <div className={className}><p className="label">{label}</p>{children}</div>;
}

export const thead = 'navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase';
export const tfoot = 'sticky bottom-0 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100';
export const inp = '!h-8 text-[13px]';

/** On/off pill the same height as the toolbar inputs (replaces plain checkboxes). */
export function SwitchPill({ checked, onChange, label, className }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
      className={clsx('flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-[12px] font-semibold whitespace-nowrap transition', checked ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300', className)}>
      <span className={clsx('relative h-4 w-7 shrink-0 rounded-full transition', checked ? 'bg-emerald-600' : 'bg-ink-300 dark:bg-ink-600')}>
        <span className={clsx('absolute top-0.5 size-3 rounded-full bg-white transition-all', checked ? 'left-3.5' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

/** Main toolbar action (Show / Load / Set) with its shortcut as a key chip. */
export function RunButton({ icon: Icon, label, keyHint, className, ...props }) {
  return (
    <button type="button" {...props}
      className={clsx('flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-navy-900 pr-1.5 pl-3 text-[12px] font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-navy-900 dark:hover:bg-ink-100', className)}>
      {Icon && <Icon className="size-3.5" />}{label}
      {keyHint && <kbd className="ml-0.5 rounded-sm bg-white/15 px-1.5 py-px font-sans text-[10px] font-bold text-white/80 dark:bg-navy-900/10 dark:text-navy-900/70">{keyHint}</kbd>}
    </button>
  );
}
