import { memo, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X, Columns3, Check, Inbox } from 'lucide-react';
import { formatCell, n } from '@/lib/format';
import { StatusBadge } from './Display';
import { Select } from './Form';

const alignFor = (c) => c.align || (['money', 'weight', 'number'].includes(c.type) ? 'right' : 'left');
const plainLabel = (c) => (typeof c.label === 'string' ? c.label : c.key);

/* mark the searched text inside plain cell text */
function Highlight({ text, term }) {
  if (!term || text == null || text === '') return text ?? '';
  const s = String(text); const i = s.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return s;
  return <>{s.slice(0, i)}<mark className="dt-mark">{s.slice(i, i + term.length)}</mark>{s.slice(i + term.length)}</>;
}

const Cell = ({ col, row, term }) => {
  if (col.render) return col.render(row);
  if (col.type === 'status') return <StatusBadge status={row[col.key]} />;
  const v = formatCell(row[col.key], col.type);
  if (col.type === 'money' && n(row[col.key]) < 0) return <span className="text-rose-600">{v}</span>;
  return term && (typeof v === 'string' || typeof v === 'number') ? <Highlight text={v} term={term} /> : v;
};

/* hidden columns are remembered per screen + table on this computer */
const colStoreKey = (columns) => `gf.cols.${typeof window !== 'undefined' ? window.location.pathname : ''}.${columns.map((c) => c.key).join(',')}`;
const loadHidden = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };

function ColumnChooser({ columns, hidden, setHidden }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const shown = columns.filter((c) => !hidden.includes(c.key)).length;
  return (
    <div ref={box} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Show / hide columns" aria-label="Show or hide columns"
        className={clsx('grid size-5 place-items-center rounded-sm transition', hidden.length ? 'bg-white/25 text-white' : 'text-white/60 hover:bg-white/15 hover:text-white')}>
        <Columns3 className="size-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-56 animate-drop overflow-hidden rounded-md border border-ink-200 bg-white text-left text-[12px] font-normal tracking-normal text-ink-800 normal-case dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">
          <div className="flex items-center justify-between border-b border-ink-100 px-2.5 py-1.5 dark:border-ink-800">
            <span className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">Columns · {shown}/{columns.length}</span>
            {hidden.length > 0 && <button type="button" onClick={() => setHidden([])} className="text-[11px] font-semibold text-navy-700 hover:underline dark:text-ink-300">Show all</button>}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {columns.map((c) => {
              const on = !hidden.includes(c.key);
              return (
                <button key={c.key} type="button" disabled={on && shown === 1}
                  onClick={() => setHidden(on ? [...hidden, c.key] : hidden.filter((k) => k !== c.key))}
                  className="flex w-full items-center gap-2 px-2.5 py-1 text-left hover:bg-ink-50 disabled:opacity-50 dark:hover:bg-ink-800">
                  <span className={clsx('grid size-3.5 place-items-center rounded-sm border', on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-300 dark:border-ink-600')}>{on && <Check className="size-2.5" strokeWidth={3} />}</span>
                  <span className="truncate">{plainLabel(c)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generic data grid.
 * columns: [{ key, label, type: text|money|weight|date|number|status, render(row), sortable, align, className }]
 * highlight: text to mark in plain cells (the list search)
 */
export const DataTable = memo(function DataTable({
  columns, rows = [], loading, fetching, sort, order, onSort, meta, onPage, onPageSize, onRowClick, onRowDoubleClick, totals,
  selectable, selected = [], onSelect, rowKey = 'id', empty, dense, rowClassName, stickyHeader = true, highlight,
  fill = false, // fill: compact, takes the height it is given, rows scroll with header / total / pages fixed
  chooser = true,
}) {
  const cellPad = fill ? 'px-2.5 py-1' : dense ? 'px-4 py-2' : 'px-4 py-3';
  const safeRows = rows || [];
  const allSelected = selectable && safeRows.length > 0 && safeRows.every((r) => selected.includes(r[rowKey]));
  const toggleAll = () => onSelect?.(allSelected ? selected.filter((id) => !safeRows.some((r) => r[rowKey] === id)) : [...new Set([...selected, ...safeRows.map((r) => r[rowKey])])]);
  const toggle = (id) => onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // show / hide columns (only offered for tables with 4+ columns)
  const storeKey = useMemo(() => colStoreKey(columns), [columns]);
  const [hidden, setHiddenState] = useState(() => loadHidden(storeKey));
  useEffect(() => { setHiddenState(loadHidden(storeKey)); }, [storeKey]);
  const setHidden = (h) => { setHiddenState(h); try { localStorage.setItem(storeKey, JSON.stringify(h)); } catch { /* private mode */ } };
  const canChoose = chooser && columns.filter((c) => !String(c.key).startsWith('_') && (typeof c.label !== 'string' || c.label.trim())).length >= 4;
  const named = columns.filter((c) => !String(c.key).startsWith('_') && (typeof c.label !== 'string' || c.label.trim()));
  const cols = canChoose ? columns.filter((c) => !hidden.includes(c.key)) : columns;

  // rows that just appeared get a soft highlight
  const seen = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    if (loading) return;
    const ids = safeRows.map((r) => r[rowKey]).filter((k) => k != null);
    if (seen.current && seen.current.size) {
      const added = ids.filter((k) => !seen.current.has(k));
      if (added.length && added.length <= 3) { setFresh(new Set(added)); const t = setTimeout(() => setFresh(new Set()), 1600); seen.current = new Set(ids); return () => clearTimeout(t); }
    }
    seen.current = new Set(ids);
    return undefined;
  }, [safeRows, loading, rowKey]);

  const term = typeof highlight === 'string' && highlight.trim().length >= 2 ? highlight.trim() : '';
  const lastLabel = cols.length - 1;

  return (
    <div className={clsx(fill ? 'flex min-h-64 flex-1 flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900' : 'card overflow-hidden')}>
      <div className={clsx('relative', fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto', fetching && !loading && 'opacity-70 transition-opacity')}>
        <table className={clsx('dt dt-sticky dt-cards w-full', fill ? 'text-[12px]' : 'text-sm')}>
          <thead className={clsx(stickyHeader && 'sticky top-0 z-10')}>
            <tr className={clsx('text-left uppercase', fill
              ? 'navy-gradient text-[10px] font-semibold tracking-wider text-white'
              : 'navy-gradient text-[11px] font-semibold tracking-wider text-white')}>
              {selectable && (
                <th className={clsx('w-10', fill ? 'px-2.5 py-1.5' : 'px-4 py-2.5')}><input type="checkbox" className="size-4 accent-emerald-600" checked={allSelected} onChange={toggleAll} /></th>
              )}
              {cols.map((c, ci) => (
                <th key={c.key} style={{ width: c.width }} className={clsx('whitespace-nowrap', fill ? 'px-2.5 py-1.5' : 'px-4 py-2.5', alignFor(c) === 'right' && 'text-right', c.headerClassName)}>
                  <span className={clsx('inline-flex items-center gap-1.5', alignFor(c) === 'right' && 'flex-row-reverse')}>
                    {c.sortable && onSort ? (
                      <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-white/70"
                        onClick={() => onSort(c.key, sort === c.key && order === 'asc' ? 'desc' : 'asc')}>
                        {c.label}
                        {sort === c.key && (order === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    ) : c.label}
                    {canChoose && ci === lastLabel && <span onClick={(e) => e.stopPropagation()}><ColumnChooser columns={named} hidden={hidden} setHidden={setHidden} /></span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk${i}`} className="dt-skeleton">
                {selectable && <td className={cellPad}><span className="dt-bone w-4" /></td>}
                {cols.map((c, ci) => <td key={c.key} className={cellPad}><span className={clsx('dt-bone', alignFor(c) === 'right' && 'ml-auto', ci % 3 === 0 ? 'w-3/4' : ci % 3 === 1 ? 'w-1/2' : 'w-2/3')} /></td>)}
              </tr>
            ))}
            {!loading && safeRows.map((r, i) => (
              <tr key={r[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(r) : undefined}
                className={clsx('transition-colors', (onRowClick || onRowDoubleClick) && 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50',
                  selected.includes(r[rowKey]) && 'bg-emerald-50 dark:bg-emerald-950/30', fresh.has(r[rowKey]) && 'dt-flash', rowClassName?.(r))}>
                {selectable && (
                  <td className={clsx(fill ? 'px-2.5' : 'px-4', 'dt-check')} data-label="" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="size-4 accent-emerald-600" checked={selected.includes(r[rowKey])} onChange={() => toggle(r[rowKey])} />
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} data-label={plainLabel(c)} className={clsx(cellPad, 'text-ink-700 dark:text-ink-200', alignFor(c) === 'right' && 'num text-right', c.className)}>
                    <Cell col={c} row={r} term={term} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && !loading && safeRows.length > 0 && (
            <tfoot className={clsx(fill && 'sticky bottom-0 z-10')}>
              <tr className="border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                {selectable && <td />}
                {cols.map((c, i) => (
                  <td key={c.key} data-label={i === 0 ? '' : plainLabel(c)} className={clsx('num font-bold', fill ? 'px-2.5 py-1.5 text-[12px]' : 'px-4 py-2.5 text-sm', alignFor(c) === 'right' && 'text-right', totals[c.key] === undefined && i !== 0 && 'dt-blank')}>
                    {i === 0 ? 'Total' : totals[c.key] !== undefined ? formatCell(totals[c.key], c.type) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && !safeRows.length && (empty && typeof empty !== 'string' ? empty : (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <span className="grid size-10 place-items-center rounded-md bg-ink-100 text-ink-400 dark:bg-ink-800"><Inbox className="size-5" /></span>
            <p className="mt-2.5 text-[13px] font-semibold text-ink-700 dark:text-ink-200">{term ? `Nothing matches "${term}"` : typeof empty === 'string' ? empty : 'No records yet'}</p>
            {(term || typeof empty !== 'string') && <p className="mt-0.5 max-w-sm text-[12px] text-ink-500">{term ? 'Check the spelling, or clear the search box to see everything.' : 'Change the filters or dates above, or add a new record.'}</p>}
          </div>
        ))}
      </div>
      {meta && onPage && <Pagination meta={meta} onPage={onPage} onPageSize={onPageSize} compact={fill} />}
    </div>
  );
});

export function Pagination({ meta, onPage, onPageSize, compact }) {
  const { page, pages, total, pageSize } = meta;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={clsx('flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink-100 text-ink-500 dark:border-ink-800', compact ? 'px-2.5 py-1 text-[12px]' : 'px-4 py-2.5 text-sm')}>
      <span className="num">{from}–{to} of {total.toLocaleString('en-IN')}</span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <Select className={clsx('w-20 text-xs', compact ? '!h-7' : 'h-8')} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} options={[10, 25, 50, 100, 200]} />
        )}
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className="grid size-8 place-items-center rounded-md hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800"><ChevronLeft className="size-4" /></button>
        <span className="num text-xs font-semibold">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" className="grid size-8 place-items-center rounded-md hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <input value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pr-8 pl-9" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-ink-400 hover:text-ink-700"><X className="size-3.5" /></button>
      )}
    </div>
  );
}
