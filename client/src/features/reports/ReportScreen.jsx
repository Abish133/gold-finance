import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, date, n, today, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';

export const fyStart = () => (dayjs(today()).month() >= 3 ? dayjs(today()).month(3).date(1) : dayjs(today()).subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
export const QUICK = {
  Today: () => [today(), today()],
  'This month': () => [dayjs(today()).startOf('month').format('YYYY-MM-DD'), today()],
  'Last month': () => [dayjs(today()).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs(today()).subtract(1, 'month').endOf('month').format('YYYY-MM-DD')],
  'A/c year': () => [fyStart(), today()],
};
const NUM = ['money', 'weight', 'number'];
export const fmt = (v, type) => (type === 'money' ? amount(v) : type === 'weight' ? weight(v) : type === 'date' ? (v ? date(v) : '') : type === 'number' ? (v === null || v === undefined || v === '' ? '' : n(v)) : v ?? '');
/** joined toggle; the chosen option is green with a pulsing dot */
export const Seg = ({ value, onChange, options }) => (
  <div className="flex">{options.map(([v, l]) => (
    <button key={String(v)} type="button" onClick={() => onChange(v)}
      className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md',
        value === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
      {value === v && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}
    </button>
  ))}</div>
);
/* the old border-t-<colour> class becomes the thin bar on the left of a figure cell */
const BAR = { 'border-t-navy-800': 'bg-navy-900', 'border-t-navy-700': 'bg-navy-900', 'border-t-navy-500': 'bg-blue-600', 'border-t-blue-600': 'bg-blue-600', 'border-t-gold-500': 'bg-amber-500', 'border-t-amber-500': 'bg-amber-500', 'border-t-amber-600': 'bg-amber-500',
  'border-t-rose-600': 'bg-rose-600', 'border-t-emerald-700': 'bg-emerald-600', 'border-t-emerald-600': 'bg-emerald-600', 'border-t-violet-600': 'bg-violet-600', 'border-t-lime-700': 'bg-lime-600', 'border-t-ink-400': 'bg-ink-400', 'border-t-fuchsia-600': 'bg-fuchsia-600', 'border-t-sky-600': 'bg-sky-600' };
/** one cell of a figures strip (put several inside <Tiles>) */
export const Tile = ({ label, value, hint, cls, dark }) => {
  const bar = String(cls || '').split(' ').map((c) => BAR[c]).find(Boolean) || 'bg-navy-900 dark:bg-white';
  return (
    <div className={clsx('relative min-w-0 px-3 py-1.5 pl-4', dark ? 'navy-gradient text-white' : 'bg-white dark:bg-ink-900')}>
      {!dark && <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />}
      <p className={clsx('truncate text-[10px] font-bold tracking-wider uppercase', dark ? 'opacity-70' : 'text-ink-500')}>{label}</p>
      <p className={clsx('num truncate text-[15px] leading-tight font-bold', !dark && 'text-navy-900 dark:text-white')}>{value}</p>
      <p className={clsx('truncate text-[10px]', dark ? 'opacity-70' : 'text-ink-500')}>{hint}</p>
    </div>
  );
};
/** strip that holds Tiles: one bordered row, thin lines between the cells */
export const Tiles = ({ children, cols }) => (
  <div className="grid shrink-0 gap-px overflow-hidden rounded-md border border-ink-200 bg-ink-200 dark:border-ink-800 dark:bg-ink-800" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>
);

/**
 * Shared layout of the desktop report screens: title bar, date range + quick buttons + extra filters,
 * search, optional day-wise totals, tiles, grid with footer totals, optional "select a row" panel, buttons.
 */
export function ReportScreen({ title, subtitle, dateLabel = 'From', filters, f, setF, onShow, rows = [], columns, totals = {}, tiles, side, sel, setSel, dateKey, dayWise = true, loading }) {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [daily, setDaily] = useState(false);
  const shown = useMemo(() => rows.filter((r) => !f.search || JSON.stringify(r).toLowerCase().includes(f.search.toLowerCase())), [rows, f.search]);
  const withTotals = useMemo(() => {
    if (!daily || !dateKey) return shown;
    const out = []; let cur = null; let acc = null;
    const flush = () => { if (acc) out.push({ __sub: true, [dateKey]: cur, ...acc }); };
    for (const r of shown) {
      const k = String(r[dateKey]).slice(0, 10);
      if (k !== cur) { flush(); cur = k; acc = {}; }
      out.push(r);
      for (const c of columns) if (c.type === 'money' || c.type === 'weight') acc[c.key] = n(acc[c.key]) + n(r[c.key]);
    }
    flush();
    return out;
  }, [shown, daily, dateKey, columns]);
  const sum = (k) => shown.reduce((s, r) => s + n(r[k]), 0);
  // total: true = sum of the column; total: (rows) => value = a computed total (e.g. weighted %)
  const foot = Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, typeof c.total === 'function' ? c.total(shown) : sum(c.key)]));
  const titleFull = `${title} · ${date(f.from)} - ${date(f.to)}`;
  const preview = () => printTable({ title: titleFull, company, columns: columns.map((c) => ({ ...c, print: c.print })), rows: shown, totals: { ...foot, ...totals } });
  const excel = () => exportCsv(title, columns, shown);
  useKeys({ f5: onShow, f6: onShow, f9: preview, 'ctrl+p': preview, 'ctrl+e': excel, f3: () => document.getElementById('rep-search')?.focus(), escape: () => navigate('/') }, [f, shown]);

  return (
    /* fit-screen: the report fits the window; the table (and the side panel) scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">{title}</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">{subtitle}</p></div>
        <div className="flex items-baseline gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-semibold tracking-wider text-white/55 uppercase">Period</span><span className="num text-[13px] font-bold">{date(f.from)} – {date(f.to)}</span></div>
      </section>
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label={dateLabel}><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div><p className="label">Quick</p><div className="flex">{Object.entries(QUICK).map(([k, fn]) => {
          const [qa, qb] = fn(); const on = f.from === qa && f.to === qb;
          return (
            <button key={k} type="button" onClick={() => setF({ ...f, from: qa, to: qb })}
              className={clsx('-ml-px h-8 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', on ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{k}</button>
          );
        })}</div></div>
        {filters}
        <div className="min-w-44 flex-1"><p className="label">Search (F3)</p><Input id="rep-search" prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder="Search in the result" value={f.search || ''} onChange={(e) => setF({ ...f, search: e.target.value })} /></div>
        <Button className="h-8" icon={Search} loading={loading} onClick={onShow}>Show (F5)</Button>
        {((dayWise && dateKey) || shown.length > 0) && (
          <div className="flex w-full items-center gap-4 text-[13px]">
            {dayWise && dateKey && <Checkbox checked={daily} onChange={setDaily} label="Day-wise totals" />}
            <span className="ml-auto text-[11px] text-ink-500">Rows shown: {shown.length}</span>
          </div>
        )}
      </div>
      {tiles && <Tiles cols={tiles.length}>{tiles.map((t) => <Tile key={t.label} {...t} />)}</Tiles>}
      <div className={clsx('grid items-stretch gap-2 xl:min-h-0 xl:flex-1', side && 'xl:grid-cols-[1fr_300px]')}>
        <div className="min-h-64 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{columns.map((c) => <th key={c.key} className={clsx('px-2 py-1.5 font-semibold whitespace-nowrap', NUM.includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {!withTotals.length && <tr><td colSpan={columns.length} className="py-12 text-center text-[12px] text-ink-400"><Search className="mx-auto mb-1.5 size-5" />Select the dates and press Show (F5)</td></tr>}
              {withTotals.map((r, i) => (r.__sub ? (
                <tr key={`s${i}`} className="bg-sky-50 text-[11px] font-bold text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">{columns.map((c, k) => <td key={c.key} className={clsx('px-2 py-1', NUM.includes(c.type) && 'num text-right')}>{k === 0 ? `Total ${date(r[dateKey])}` : (c.type === 'money' || c.type === 'weight') ? fmt(r[c.key], c.type) : ''}</td>)}</tr>
              ) : (
                <tr key={r.txn_id || r.id || r.key || i} onClick={() => setSel?.(r)} className={clsx('cursor-pointer', sel && sel === r ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  {columns.map((c, k) => <td key={c.key} className={clsx('px-2 py-1', k === 0 && 'border-l-2', k === 0 && (sel && sel === r ? 'border-emerald-600' : 'border-transparent'), NUM.includes(c.type) && 'num text-right', c.className)}>{c.render ? c.render(r) : fmt(r[c.key], c.type)}</td>)}
                </tr>
              )))}
            </tbody>
            {shown.length > 0 && <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 text-[12px] font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"><tr>{columns.map((c, k) => <td key={c.key} className={clsx('px-2 py-1.5', NUM.includes(c.type) && 'num text-right')}>{k === 0 ? '' : k === 1 ? `Total · ${shown.length}` : c.total ? fmt(foot[c.key], c.type) : ''}</td>)}</tr></tfoot>}
          </table>
        </div>
        {side && <div className="flex flex-col overflow-y-auto rounded-md border border-ink-200 bg-white p-3 text-[12px] xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">{side}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <p className="hidden min-w-0 flex-1 truncate px-1 text-[11px] text-ink-400 2xl:block">F5 = show · F6 = refresh · F3 = search · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
        <span className="flex-1 2xl:hidden" />
        <Button variant="outline" icon={RefreshCw} onClick={onShow}>Refresh (F6)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>
        <Button variant="soft-danger" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
    </div>
  );
}

/** "label .... value" line for the select-a-row panels */
export const SideLine = ({ k, v, bold, minus }) => (
  <div className={clsx('flex justify-between gap-2 border-b border-dashed border-ink-100 py-0.5 dark:border-ink-800', bold && 'font-bold text-navy-900 dark:text-white', minus && 'text-rose-600')}>
    <span className={clsx(!bold && !minus && 'text-ink-500')}>{minus ? '- ' : ''}{k}</span><span className="num text-right font-semibold">{v ?? '-'}</span>
  </div>
);
export const SideHead = ({ children }) => <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-navy-900 uppercase first:mt-0 dark:text-white"><span className="h-3 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />{children}</p>;
