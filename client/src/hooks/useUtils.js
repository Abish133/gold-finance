import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** useHotkey('ctrl+k', handler) */
export function useHotkey(combo, handler, deps = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const [mod, key] = combo.toLowerCase().includes('+') ? combo.toLowerCase().split('+') : [null, combo.toLowerCase()];
    const onKey = (e) => {
      const modOk = !mod || (mod === 'ctrl' && (e.ctrlKey || e.metaKey)) || (mod === 'alt' && e.altKey) || (mod === 'shift' && e.shiftKey);
      if (modOk && e.key.toLowerCase() === key) { e.preventDefault(); ref.current(e); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, ...deps]);
}

/** Drawer / panel open state carrying an optional payload. */
export function useDisclosure(initial = null) {
  const [state, setState] = useState(initial);
  const open = useCallback((payload = true) => setState(payload), []);
  const close = useCallback(() => setState(null), []);
  return { isOpen: state !== null && state !== false, data: state, open, close };
}

/** Table state: page, pageSize, sort, search, filters -> query params */
export function useTableState(defaults = {}) {
  const [state, setState] = useState({ page: 1, pageSize: 25, search: '', sort: undefined, order: undefined, ...defaults });
  const set = useCallback((patch) => setState((s) => ({ ...s, ...(patch.page ? {} : { page: 1 }), ...patch })), []);
  return [state, set];
}
