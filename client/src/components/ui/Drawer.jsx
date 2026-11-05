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
      <div className="absolute inset-0 animate-fade-in bg-navy-950/45" onClick={closeOnOverlay ? onClose : undefined} />
      <section
        ref={panel}
        data-drawer
        role="dialog"
        aria-modal="true"
        className={clsx('relative flex h-full w-full animate-slide-in flex-col bg-white shadow-drawer dark:bg-ink-900', SIZES[size] || size)}
      >
        <header className="navy-gradient flex items-center gap-3 border-b-[3px] border-gold-500 px-5 py-3 text-white">
          {Icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-white/95 text-navy-800">
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-navy-100">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"><X className="size-5" /></button>
        </header>
        <div className={clsx('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-ink-300 bg-cream-100 px-5 py-3 dark:border-ink-800 dark:bg-ink-950/40">{footer}</footer>}
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
