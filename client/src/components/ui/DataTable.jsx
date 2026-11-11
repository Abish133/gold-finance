import { memo } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { formatCell } from '@/lib/format';
import { Spinner, Empty, StatusBadge } from './Display';
import { Select } from './Form';

const alignFor = (c) => c.align || (['money', 'weight', 'number'].includes(c.type) ? 'right' : 'left');

const Cell = ({ col, row }) => {
  if (col.render) return col.render(row);
  if (col.type === 'status') return <StatusBadge status={row[col.key]} />;
  return formatCell(row[col.key], col.type);
};

/**
 * Generic data grid.
 * columns: [{ key, label, type: text|money|weight|date|number|status, render(row), sortable, align, className }]
 */
export const DataTable = memo(function DataTable({
  columns, rows = [], loading, fetching, sort, order, onSort, meta, onPage, onPageSize, onRowClick, onRowDoubleClick, totals,
  selectable, selected = [], onSelect, rowKey = 'id', empty, dense, rowClassName, stickyHeader = true,
  fill = false, // fill: compact, takes the height it is given, rows scroll with header / total / pages fixed
}) {
  const cellPad = fill ? 'px-2.5 py-1' : dense ? 'px-4 py-2' : 'px-4 py-3';
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected.includes(r[rowKey]));
  const toggleAll = () => onSelect?.(allSelected ? selected.filter((id) => !rows.some((r) => r[rowKey] === id)) : [...new Set([...selected, ...rows.map((r) => r[rowKey])])]);
  const toggle = (id) => onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className={clsx(fill ? 'flex min-h-64 flex-1 flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900' : 'card overflow-hidden')}>
      <div className={clsx('relative', fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto', fetching && !loading && 'opacity-70 transition-opacity')}>
        <table className={clsx('w-full', fill ? 'text-[12px]' : 'text-sm')}>
          <thead className={clsx(stickyHeader && 'sticky top-0 z-10')}>
            <tr className={clsx('text-left uppercase', fill
              ? 'navy-gradient text-[10px] font-semibold tracking-wider text-white'
              : 'border-b border-ink-300 bg-navy-50 text-xs font-bold tracking-wide text-navy-800 dark:bg-ink-800 dark:text-ink-200')}>
              {selectable && (
                <th className={clsx('w-10', fill ? 'px-2.5 py-1.5' : 'px-4 py-3')}><input type="checkbox" className="size-4 accent-gold-600" checked={allSelected} onChange={toggleAll} /></th>
              )}
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={clsx('whitespace-nowrap', fill ? 'px-2.5 py-1.5' : 'px-4 py-3', alignFor(c) === 'right' && 'text-right', c.headerClassName)}>
                  {c.sortable && onSort ? (
                    <button type="button" className={clsx('inline-flex items-center gap-1 uppercase', fill ? 'hover:text-white/70' : 'hover:text-ink-800 dark:hover:text-ink-200')}
                      onClick={() => onSort(c.key, sort === c.key && order === 'asc' ? 'desc' : 'asc')}>
                      {c.label}
                      {sort === c.key && (order === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {!loading && rows.map((r, i) => (
              <tr key={r[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(r) : undefined}
                className={clsx('transition-colors', onRowClick && (fill ? 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50' : 'cursor-pointer hover:bg-navy-50/70 dark:hover:bg-navy-800/20'),
                  selected.includes(r[rowKey]) && 'bg-cream-200 dark:bg-gold-500/10', rowClassName?.(r))}>
                {selectable && (
                  <td className="px-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="size-4 accent-gold-600" checked={selected.includes(r[rowKey])} onChange={() => toggle(r[rowKey])} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={clsx(cellPad, 'text-ink-700 dark:text-ink-200', alignFor(c) === 'right' && 'num text-right', c.className)}>
                    <Cell col={c} row={r} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot className={clsx(fill && 'sticky bottom-0 z-10')}>
              <tr className={fill ? 'border-t-2 border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100' : 'bg-navy-800 text-white'}>
                {selectable && <td />}
                {columns.map((c, i) => (
                  <td key={c.key} className={clsx('num font-bold', fill ? 'px-2.5 py-1.5 text-[12px]' : 'px-4 py-3 text-sm', alignFor(c) === 'right' && 'text-right')}>
                    {i === 0 ? 'Total' : totals[c.key] !== undefined ? formatCell(totals[c.key], c.type) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {loading && <Spinner label="Loading…" />}
        {!loading && !rows.length && (empty || <Empty title="No records found" message="Try changing filters or search." />)}
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
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid size-8 place-items-center rounded-lg hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800"><ChevronLeft className="size-4" /></button>
        <span className="num text-xs font-semibold">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid size-8 place-items-center rounded-lg hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800"><ChevronRight className="size-4" /></button>
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
        <button type="button" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"><X className="size-3.5" /></button>
      )}
    </div>
  );
}
