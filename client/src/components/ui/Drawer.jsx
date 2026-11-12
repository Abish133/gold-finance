import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(1400px,100vw)]',
};

let openCount = 0;

/**
 * Slide-in drawer from the right. Used everywhere instead of popups / modals.
 * Drawers stack naturally (each new one renders above the previous).
 */
/* full-screen choice is remembered per drawer title (e.g. "New Customer" always opens full) */
const maxKey = (title) => `gf.drawerMax.${typeof title === 'string' ? title : ''}`;
const readMax = (title) => { try { return localStorage.getItem(maxKey(title)) === '1'; } catch { return false; } };

export function Drawer({ open, onClose, title, subtitle, icon: Icon, size = 'md', footer, children, bodyClassName, closeOnOverlay = true }) {
  const panel = useRef(null);
  const canMax = size !== 'sm';
  const [max, setMax] = useState(() => canMax && readMax(title));
  useEffect(() => { if (open) setMax(canMax && readMax(title)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleMax = () => setMax((m) => {
    try { localStorage.setItem(maxKey(title), m ? '0' : '1'); } catch { /* private window */ }
    return !m;
  });
  // latest onClose without re-running the open effect (an inline onClose changes every render,
  // which used to re-focus the first box while typing in another one)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && panel.current && panel.current === [...document.querySelectorAll('[data-drawer]')].pop()) closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    // focus the first box once when the drawer opens - never steal focus the user already moved inside it
    const t = setTimeout(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.querySelector('input:not([type=hidden]):not([disabled]), select, textarea')?.focus();
    }, 80);
    return () => {
      openCount -= 1;
      if (!openCount) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  // floating sheet with labelled size / close buttons; springs in and out (Framer Motion)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="drawer" className="fixed inset-0 z-50 flex justify-end sm:p-2">
          <motion.div className="absolute inset-0 bg-navy-950/30 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} onClick={closeOnOverlay ? onClose : undefined} />
          <motion.section
            ref={panel}
            data-drawer
            role="dialog"
            aria-modal="true"
            initial={{ x: 56, opacity: 0, scale: 0.985 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 44, opacity: 0, scale: 0.985, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.85 }}
            className={clsx('relative flex h-full w-full flex-col overflow-hidden bg-white ring-1 ring-black/10 transition-[max-width] duration-300 sm:rounded-lg dark:bg-ink-900 dark:ring-white/10', max ? 'max-w-full' : SIZES[size] || size)}
          >
            <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-200 bg-ink-50/85 px-3.5 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/60">
              {Icon && <span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy-900 text-white dark:bg-white dark:text-navy-900"><Icon className="size-4" /></span>}
              <div className="min-w-0 flex-1 leading-tight">
                <h2 className="truncate text-[14px] font-bold text-navy-900 dark:text-white">{title}</h2>
                {subtitle && <p className="truncate text-[11px] text-ink-500">{subtitle}</p>}
              </div>
              {/* labelled icon buttons: size and close */}
              <div className="flex shrink-0 items-center gap-1.5">
                {canMax && (
                  <button type="button" onClick={toggleMax} title={max ? 'Back to normal size' : 'Full size'}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 text-[12px] font-semibold text-navy-800 transition hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800">
                    {max ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}<span className="hidden sm:inline">{max ? 'Normal size' : 'Full size'}</span>
                  </button>
                )}
                <button type="button" onClick={onClose} title="Close (Esc)"
                  className="flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70">
                  <X className="size-3.5" /><span className="hidden sm:inline">Close</span>
                  <kbd className="hidden rounded-sm bg-rose-100 px-1 text-[10px] font-bold text-rose-600 sm:inline dark:bg-rose-900/50 dark:text-rose-300">Esc</kbd>
                </button>
              </div>
            </header>
            <div className={clsx('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
            {footer && <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-ink-200 bg-ink-50/85 px-4 py-2.5 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/60">{footer}</footer>}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}


/** Confirmation: a small centred box (quick yes / no) - the name stays for the existing screens. */
export function ConfirmDrawer({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmText = 'Confirm', tone = 'danger', loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={AlertTriangle}
      tone={tone === 'danger' ? 'red' : 'amber'}
      size={children ? 'md' : 'sm'}
      footer={(
        <>
          <Button variant="soft-danger" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-autofocus>{confirmText}</Button>
        </>
      )}
    >
      {message && <p className="text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">{message}</p>}
      {children && <div className={clsx('rounded-md border border-ink-200 p-3 text-[13px] dark:border-ink-700 [&_b]:text-navy-900 dark:[&_b]:text-white', message && 'mt-3')}>{children}</div>}
    </Modal>
  );
}
