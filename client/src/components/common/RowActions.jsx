import clsx from 'clsx';

/**
 * Small icon buttons at the end of a table row (edit, delete, open ...).
 * They do exactly what the matching toolbar button does, for that row - clicks never select / open the row itself.
 * actions: [{ icon, label, onClick, tone: 'danger', hidden, disabled }]
 */
export function RowActions({ actions }) {
  const list = actions.filter((a) => a && !a.hidden);
  if (!list.length) return null;
  const stop = (e) => e.stopPropagation();
  return (
    <span className="row-actions inline-flex items-center justify-end gap-0.5" onClick={stop} onDoubleClick={stop}>
      {list.map(({ icon: Icon, label, onClick, tone, disabled }) => (
        <button key={label} type="button" title={label} aria-label={label} disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className={clsx('grid size-6 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-30',
            tone === 'danger'
              ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40'
              : 'text-ink-500 hover:bg-ink-100 hover:text-navy-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white')}>
          <Icon className="size-3.5" />
        </button>
      ))}
    </span>
  );
}

/** header cell for the actions column */
export const ActionsHead = ({ className }) => <th className={clsx('w-px px-2 py-1.5 text-right font-semibold whitespace-nowrap', className)}>Actions</th>;
