import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

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

  const toneCls = {
    ink: 'bg-ink-100 text-navy-800 dark:bg-ink-800 dark:text-white',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  }[tone];

  // springs in and out (Framer Motion), on a softly blurred backdrop
  return createPortal(
    <AnimatePresence>
      {open && (
    <div key="modal" className="fixed inset-0 z-50 grid place-items-center p-4">
      <motion.div className="absolute inset-0 bg-navy-950/30 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={closeOnOverlay ? onClose : undefined} />
      <motion.section ref={panel} role="dialog" aria-modal="true" data-drawer
        initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.14 } }}
        transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
        className={clsx('relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-white ring-1 ring-black/10 dark:bg-ink-900 dark:ring-white/10', SIZES[size] || size)}>
        {(title || Icon) && (
          <header className="flex shrink-0 items-center gap-2.5 px-4 pt-3.5 pb-2 pr-10">
            {Icon && <span className={clsx('grid size-7 shrink-0 place-items-center rounded-md', toneCls)}><Icon className="size-4" /></span>}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[14px] font-bold text-navy-900 dark:text-white">{title}</h2>}
              {subtitle && <p className="truncate text-[12px] text-ink-500">{subtitle}</p>}
            </div>
          </header>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="absolute top-3 right-3 grid size-6 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800">
            <X className="size-4" />
          </button>
        )}
        <div className={clsx('min-h-0 flex-1 overflow-y-auto text-[13px]', bodyClassName ?? 'px-4 py-2')}>{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 pt-2 pb-3.5 [&_button]:h-8 [&_button]:px-3 [&_button]:text-[12px]">{footer}</footer>}
      </motion.section>
    </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
