import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' };

/**
 * Centred dialog for short choices and prompts (pick a branch, confirm, etc).
 * Long forms still use Drawer.
 * - Esc and the × close it (when onClose is given); a click on the backdrop closes it only when closeOnOverlay.
 */
export function Modal({ open, onClose, title, subtitle, icon: Icon, tone = 'ink', size = 'md', footer, children, closeOnOverlay = false, bodyClassName }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => panel.current?.querySelector('input:not([disabled]), button[data-autofocus], select, textarea')?.focus(), 60);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  if (!open) return null;
  const toneCls = {
    ink: 'bg-ink-100 text-navy-800 ring-ink-200 dark:bg-ink-800 dark:text-white dark:ring-ink-700',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    red: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  }[tone];

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/45 backdrop-blur-[2px]" onClick={closeOnOverlay ? onClose : undefined} />
      <section ref={panel} role="dialog" aria-modal="true" data-drawer
        className={clsx('relative flex max-h-[85vh] w-full animate-rise flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900', SIZES[size] || size)}>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800">
            <X className="size-4" />
          </button>
        )}
        {(title || Icon) && (
          <header className="border-b border-ink-100 px-6 pt-6 pb-4 text-center dark:border-ink-800">
            {Icon && <span className={clsx('mx-auto grid size-11 place-items-center rounded-md ring-1', toneCls)}><Icon className="size-5" /></span>}
            {title && <h2 className="mt-3 text-base font-bold text-navy-900 dark:text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
          </header>
        )}
        <div className={clsx('min-h-0 flex-1 overflow-y-auto', bodyClassName ?? 'p-4')}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-950/40">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
