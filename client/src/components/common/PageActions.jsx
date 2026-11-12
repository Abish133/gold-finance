import { Children, Fragment, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard } from 'lucide-react';
import clsx from 'clsx';

/* "Save (F2)" -> Save + a small F2 key badge (design only - the button and its key keep working the same) */
const KEY_RE = /^(.*?)\s*\(((?:(?:Ctrl|Alt|Shift)\s*\+\s*)*(?:F\d{1,2}|Esc|Enter|Del|Delete|Ins|Tab|Space|Home|End|PgUp|PgDn|Backspace|[A-Z0-9]|[←→↑↓+−-])(?:\s*\/\s*[^()]{1,6})?)\)\s*$/;
function withKeyBadges(node) {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) return <>{withKeyBadges(child.props.children)}</>;
    const kids = child.props.children;
    const text = typeof kids === 'string' ? kids : Array.isArray(kids) && kids.every((k) => typeof k === 'string' || typeof k === 'number') ? kids.join('') : null;
    const m = text && text.match(KEY_RE);
    if (m) return cloneElement(child, { title: child.props.title || text }, <>{m[1]}<kbd className="pa-key">{m[2]}</kbd></>);
    if (kids && typeof kids === 'object') return cloneElement(child, undefined, withKeyBadges(kids));
    return child;
  });
}

/* "F5 Show · Ctrl+P Print · Enter = select" -> [['F5','Show'], ['Ctrl+P','Print'], ['Enter','select']] */
export function parseKeys(keys) {
  if (!keys) return [];
  if (Array.isArray(keys)) return keys;
  return String(keys).split(/\s*·\s*/).map((part) => {
    const eq = part.split(/\s+=\s+/);
    if (eq.length > 1) return [eq[0].trim(), eq.slice(1).join(' = ').trim()];
    const m = part.match(/^((?:Ctrl|Alt|Shift)\s*\+\s*\S+|F\d{1,2}|Esc|Enter|Del|Delete|Tab|Space|←\s*\/\s*→|\S+)\s+(.*)$/);
    return m ? [m[1], m[2]] : [part, ''];
  }).filter(([k]) => k);
}

function KeysButton({ keys }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" className={clsx('pa-keys', open && 'pa-open')} onClick={() => setOpen((o) => !o)} title="Keyboard shortcuts for this screen"><Keyboard className="size-3.5" />Keys</button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-64 animate-drop overflow-hidden rounded-md border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100">
          <p className="border-b border-ink-100 px-3 py-1.5 text-[10px] font-bold tracking-wider text-ink-500 uppercase dark:border-ink-800">Shortcuts on this screen</p>
          <div className="max-h-80 overflow-y-auto py-1">
            {keys.map(([k, l]) => (
              <div key={`${k}-${l}`} className="flex items-center gap-2.5 px-3 py-1 text-[12px]">
                <kbd className="min-w-14 rounded-sm border border-ink-300 bg-ink-50 px-1.5 text-center text-[10px] font-bold text-navy-900 dark:border-ink-600 dark:bg-ink-800 dark:text-white">{k}</kbd><span className="min-w-0 truncate">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Page action buttons: shown in the page's dark header bar (right side) instead of a bottom toolbar.
 * keys: [['F2','Save'], ...] or a "F2 Save · F5 Refresh" string - listed under one "Keys" button.
 * If the page has no dark header the buttons stay in a slim bar where they are.
 */
export function PageActions({ children, keys, className }) {
  const anchor = useRef(null);
  const [host, setHost] = useState(null);
  useLayoutEffect(() => {
    const page = anchor.current?.closest('.desk') || anchor.current?.closest('main');
    const hdr = page && (page.querySelector(':scope > section.navy-gradient, :scope > div.navy-gradient') || page.querySelector(':scope > * > section.navy-gradient, :scope > * > div.navy-gradient:first-child') || page.querySelector('section.navy-gradient'));
    if (!hdr) return;
    let slot = hdr.querySelector(':scope > .page-actions');
    if (!slot) { slot = document.createElement('div'); slot.className = 'page-actions'; hdr.appendChild(slot); }
    setHost(slot);
  }, []);
  const list = parseKeys(keys);
  const content = <>{withKeyBadges(children)}{list.length > 0 && <KeysButton keys={list} />}</>;
  return (
    <>
      <span ref={anchor} hidden />
      {host ? createPortal(content, host)
        : <div className={clsx('flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]', className)}>{content}</div>}
    </>
  );
}
