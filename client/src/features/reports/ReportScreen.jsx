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

export const fyStart = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1)).format('YYYY-MM-DD');
export const QUICK = {
  Today: () => [today(), today()],
  'This month': () => [dayjs().startOf('month').format('YYYY-MM-DD'), today()],
  'Last month': () => [dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')],
  'A/c year': () => [fyStart(), today()],
};
const NUM = ['money', 'weight', 'number'];
export const fmt = (v, type) => (type === 'money' ? amount(v) : type === 'weight' ? weight(v) : type === 'date' ? (v ? date(v) : '') : type === 'number' ? (v === null || v === undefined || v === '' ? '' : n(v)) : v ?? '');
export const Seg = ({ value, onChange, options }) => (
  <div className="flex gap-1">{options.map(([v, l]) => (
    <button key={String(v)} type="button" onClick={() => onChange(v)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', value === v ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800 dark:bg-ink-900 dark:text-white')}>{l}</button>
  ))}</div>
);
export const Tile = ({ label, value, hint, cls, dark }) => (
  <div className={clsx('rounded-md border-t-4 px-4 py-3', dark ? 'navy-gradient border-t-amber-500 text-white' : 'card', cls)}>
    <p className="text-xs font-bold uppercase opacity-80">{label}</p><p className="num text-2xl font-bold">{value}</p><p className="text-[11px] opacity-70">{hint}</p>
  </div>
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
  const foot = Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, sum(c.key)]));
  const titleFull = `${title} · ${date(f.from)} - ${date(f.to)}`;
  const preview = () => printTable({ title: titleFull, company, columns: columns.map((c) => ({ ...c, print: c.print })), rows: shown, totals: { ...foot, ...totals } });
  const excel = () => exportCsv(title, columns, shown);
  useKeys({ f5: onShow, f6: onShow, f9: preview, 'ctrl+p': preview, 'ctrl+e': excel, f3: () => document.getElementById('rep-search')?.focus(), escape: () => navigate('/') }, [f, shown]);

  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-navy-100">{subtitle}</p></section>
      <div className="card space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={dateLabel}><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <div><p className="label">Quick</p><div className="flex gap-1">{Object.entries(QUICK).map(([k, fn]) => <button key={k} type="button" onClick={() => { const [a, b] = fn(); setF({ ...f, from: a, to: b }); }} className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 dark:bg-ink-900 dark:text-white">{k}</button>)}</div></div>
          {filters}
          <Button className="ml-auto" size="lg" variant="outline" icon={Search} loading={loading} onClick={onShow}>Show (F5)</Button>
        </div>
        <div className="flex items-center gap-4">
          <Input id="rep-search" className="max-w-xs" placeholder="Search (F3)" value={f.search || ''} onChange={(e) => setF({ ...f, search: e.target.value })} />
          {dayWise && dateKey && <Checkbox checked={daily} onChange={setDaily} label="Day-wise totals" />}
          <span className="ml-auto text-xs text-ink-500">Rows shown: {shown.length}</span>
        </div>
      </div>
      {tiles && <div className={clsx('grid gap-3', `sm:grid-cols-${Math.min(5, tiles.length)}`)} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>{tiles.map((t) => <Tile key={t.label} {...t} />)}</div>}
      <div className={clsx('grid items-stretch gap-3', side && 'xl:grid-cols-[1fr_320px]')}>
        <div className="card min-h-[calc(100vh-27rem)] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="navy-gradient sticky top-0 text-white"><tr>{columns.map((c) => <th key={c.key} className={clsx('px-2 py-2 whitespace-nowrap', NUM.includes(c.type) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {!withTotals.length && <tr><td colSpan={columns.length} className="py-16 text-center text-ink-400">Select the dates and press Show (F5)</td></tr>}
              {withTotals.map((r, i) => (r.__sub ? (
                <tr key={`s${i}`} className="bg-cream-100 text-xs font-bold dark:bg-ink-800">{columns.map((c, k) => <td key={c.key} className={clsx('px-2 py-1', NUM.includes(c.type) && 'num text-right')}>{k === 0 ? `Total ${date(r[dateKey])}` : (c.type === 'money' || c.type === 'weight') ? fmt(r[c.key], c.type) : ''}</td>)}</tr>
              ) : (
                <tr key={r.txn_id || r.id || r.key || i} onClick={() => setSel?.(r)} className={clsx('cursor-pointer', sel && sel === r && 'bg-navy-50 dark:bg-ink-800')}>
                  {columns.map((c) => <td key={c.key} className={clsx('px-2 py-1.5', NUM.includes(c.type) && 'num text-right', c.className)}>{c.render ? c.render(r) : fmt(r[c.key], c.type)}</td>)}
                </tr>
              )))}
            </tbody>
            {shown.length > 0 && <tfoot className="navy-gradient text-white"><tr className="font-bold">{columns.map((c, k) => <td key={c.key} className={clsx('px-2 py-2', NUM.includes(c.type) && 'num text-right')}>{k === 0 ? '' : k === 1 ? `Total - ${shown.length}` : c.total ? fmt(foot[c.key], c.type) : ''}</td>)}</tr></tfoot>}
          </table>
        </div>
        {side && <div className="card space-y-1 p-4 text-sm">{side}</div>}
      </div>
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={RefreshCw} onClick={onShow}>Refresh (F6)</Button>
        <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 = show · F6 = refresh · F3 = search · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
    </div>
  );
}

/** "label .... value" line for the select-a-row panels */
export const SideLine = ({ k, v, bold, minus }) => <div className={clsx('flex justify-between gap-2 py-0.5', bold && 'font-bold', minus && 'text-rose-600')}><span>{minus ? '- ' : ''}{k}</span><span className="num text-right">{v ?? '-'}</span></div>;
export const SideHead = ({ children }) => <p className="pt-2 text-xs font-bold text-ink-600 uppercase">{children}</p>;
