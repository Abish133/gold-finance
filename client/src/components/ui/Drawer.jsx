import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
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

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/45" onClick={closeOnOverlay ? onClose : undefined} />
      <section
        ref={panel}
        data-drawer
        role="dialog"
        aria-modal="true"
        className={clsx('relative flex h-full w-full animate-slide-in flex-col bg-white shadow-drawer transition-[max-width] duration-200 dark:bg-ink-900', max ? 'max-w-full' : SIZES[size] || size)}
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
          {canMax && (
            <button type="button" onClick={toggleMax} aria-label={max ? 'Back to normal size' : 'Full screen'} title={max ? 'Back to normal size' : 'Full screen'}
              className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white">
              {max ? <Minimize2 className="size-4.5" /> : <Maximize2 className="size-4.5" />}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"><X className="size-5" /></button>
        </header>
        <div className={clsx('flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-ink-300 bg-cream-100 px-5 py-3 dark:border-ink-800 dark:bg-ink-950/40">{footer}</footer>}
      </section>
    </div>,
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
