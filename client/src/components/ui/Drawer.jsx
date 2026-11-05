import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
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
export function Drawer({ open, onClose, title, subtitle, icon: Icon, size = 'md', footer, children, bodyClassName, closeOnOverlay = true }) {
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && panel.current && panel.current === [...document.querySelectorAll('[data-drawer]')].pop()) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => panel.current?.querySelector('input:not([type=hidden]):not([disabled]), select, textarea')?.focus(), 80);
    return () => {
      openCount -= 1;
      if (!openCount) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={closeOnOverlay ? onClose : undefined} />
      <section
        ref={panel}
        data-drawer
        role="dialog"
        aria-modal="true"
        className={clsx('relative flex h-full w-full animate-slide-in flex-col bg-white shadow-drawer dark:bg-ink-900', SIZES[size] || size)}
      >
        <header className="flex items-start gap-3 border-b border-ink-200/70 px-6 py-4 dark:border-ink-800">
          {Icon && (
            <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-700 dark:bg-gold-500/10 dark:text-gold-400">
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-ink-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ink-500">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
        </header>
        <div className={clsx('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-ink-200/70 bg-ink-50/60 px-6 py-3 dark:border-ink-800 dark:bg-ink-950/40">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}

/** Confirmation as a small drawer (no popups). */
export function ConfirmDrawer({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmText = 'Confirm', tone = 'danger', loading, children }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmText}</Button>
        </>
      )}
    >
      {message && <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{message}</p>}
      {children}
    </Drawer>
  );
}
