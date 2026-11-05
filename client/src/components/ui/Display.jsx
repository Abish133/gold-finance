import clsx from 'clsx';
import { Loader2, Inbox } from 'lucide-react';

const TONES = {
  gray: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  gold: 'bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export function Badge({ tone = 'gray', children, className, dot }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONE = {
  OPEN: 'green', ACTIVE: 'green', CLOSED: 'gray', RENEWED: 'blue', AUCTIONED: 'violet', CANCELLED: 'red', BLOCKED: 'red', LEFT: 'gray',
  PENDING: 'gold', SENT: 'green', FAILED: 'red', SKIPPED: 'gray',
};
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'gray'} dot>{status ? status.charAt(0) + status.slice(1).toLowerCase() : '—'}</Badge>;

export function Card({ title, subtitle, actions, children, className, bodyClassName, icon: Icon }) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center gap-3 border-b border-ink-100 px-5 py-3.5 dark:border-ink-800">
          {Icon && <Icon className="size-4.5 text-gold-600" />}
          <div className="min-w-0 flex-1">
            {title && <h3 className="truncate text-sm font-semibold text-ink-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'gold', trend }) {
  const ring = { gold: 'from-gold-400/20 to-gold-600/5 text-gold-700 dark:text-gold-300', green: 'from-emerald-400/20 to-emerald-600/5 text-emerald-700 dark:text-emerald-300',
    blue: 'from-sky-400/20 to-sky-600/5 text-sky-700 dark:text-sky-300', red: 'from-rose-400/20 to-rose-600/5 text-rose-700 dark:text-rose-300',
    violet: 'from-violet-400/20 to-violet-600/5 text-violet-700 dark:text-violet-300' }[tone];
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
          <p className="num mt-2 truncate text-2xl font-bold text-ink-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-ink-500">{hint}</p>}
        </div>
        {Icon && <div className={clsx('grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br', ring)}><Icon className="size-5" /></div>}
      </div>
      {trend}
    </div>
  );
}

export function Spinner({ className, label }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-10 text-sm text-ink-500', className)}>
      <Loader2 className="size-5 animate-spin text-gold-600" /> {label}
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800"><Icon className="size-6" /></div>
      <p className="mt-4 font-semibold text-ink-800 dark:text-ink-100">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <div className="grid size-11 place-items-center rounded-2xl gold-gradient text-ink-950 shadow-sm"><Icon className="size-5" /></div>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-ink-900 sm:text-2xl dark:text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {children}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('flex gap-1 overflow-x-auto border-b border-ink-200 dark:border-ink-800', className)}>
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)}
          className={clsx('-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition',
            value === t.value ? 'border-gold-500 text-ink-900 dark:text-white' : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count != null && <span className="rounded-full bg-ink-100 px-1.5 text-[11px] text-ink-600 dark:bg-ink-800 dark:text-ink-300">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items, cols = 2 }) {
  return (
    <dl className={clsx('grid gap-x-6 gap-y-3', cols === 3 ? 'sm:grid-cols-3' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-ink-500">{k}</dt>
          <dd className="num mt-0.5 truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ src, name, size = 'md' }) {
  const s = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-lg', xl: 'size-24 text-2xl' }[size];
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return src
    ? <img src={src} alt={name} className={clsx('shrink-0 rounded-2xl object-cover ring-2 ring-white dark:ring-ink-800', s)} loading="lazy" />
    : <div className={clsx('grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-200 to-gold-400 font-bold text-gold-900', s)}>{initials}</div>;
}
