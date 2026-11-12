import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * Click-to-enlarge image. Renders the thumbnail (children or an <img>), and on click
 * a full-screen viewer with zoom (+ / − / wheel), rotate and download. Esc or a click outside closes it.
 */
export function ImagePreview({ src, alt = '', title, className, imgClassName, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={!src} onClick={() => src && setOpen(true)} title={src ? 'Click to preview' : undefined}
        className={clsx('group relative overflow-hidden', src ? 'cursor-zoom-in' : 'cursor-default', className)}>
        {children || (src && <img src={src} alt={alt} className={clsx('size-full object-cover', imgClassName)} />)}
        {src && (
          <span className="pointer-events-none absolute right-1 bottom-1 grid size-6 place-items-center rounded-md bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 className="size-3.5" />
          </span>
        )}
      </button>
      {open && <Viewer src={src} alt={alt} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function Viewer({ src, alt, title, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const zoomBy = (d) => setZoom((z) => Math.min(5, Math.max(0.5, Math.round((z + d) * 10) / 10)));
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === '+' || e.key === '=') zoomBy(0.25);
      else if (e.key === '-') zoomBy(-0.25);
      else if (e.key.toLowerCase() === 'r') setTurn((t) => t + 90);
    };
    window.addEventListener('keydown', key, true);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key, true); };
  }, [onClose]);

  const tool = 'grid size-8 place-items-center rounded-md text-white/80 transition hover:bg-white/15 hover:text-white';
  return createPortal(
    <div data-drawer className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <header className="flex shrink-0 items-center gap-1 px-3 py-2 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title || alt || 'Preview'}</p>
        <button type="button" className={tool} onClick={() => zoomBy(-0.25)} title="Zoom out (−)"><ZoomOut className="size-4" /></button>
        <span className="num w-12 text-center text-[12px] text-white/70">{Math.round(zoom * 100)}%</span>
        <button type="button" className={tool} onClick={() => zoomBy(0.25)} title="Zoom in (+)"><ZoomIn className="size-4" /></button>
        <button type="button" className={tool} onClick={() => setTurn((t) => t + 90)} title="Rotate (R)"><RotateCw className="size-4" /></button>
        <a className={tool} href={src} download title="Download" onClick={(e) => e.stopPropagation()}><Download className="size-4" /></a>
        <span className="mx-1 h-5 w-px bg-white/20" />
        <button type="button" className={tool} onClick={onClose} title="Close (Esc)"><X className="size-5" /></button>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4"
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 0.15 : -0.15)}>
        <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          className="max-h-full max-w-full rounded-md object-contain transition-transform duration-150 select-none"
          style={{ transform: `scale(${zoom}) rotate(${turn}deg)` }} />
      </div>
      <p className="shrink-0 pb-2 text-center text-[11px] text-white/50">Scroll or + / − to zoom · double-click 2× · R rotate · Esc close</p>
    </div>,
    document.body,
  );
}
