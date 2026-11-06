import clsx from 'clsx';
import { UserRound } from 'lucide-react';

/** Photo box with the "photo not available" placeholder (customer / employee). */
export function PhotoBox({ src, className = 'h-32 w-28', onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={clsx('grid shrink-0 place-items-center overflow-hidden rounded border-2 border-ink-300 bg-ink-100 dark:border-ink-700 dark:bg-ink-800', className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : (
        <div className="text-center text-ink-500"><UserRound className="mx-auto size-12" strokeWidth={1.5} /><p className="px-1 text-[10px] leading-tight font-bold uppercase">Photo not available</p></div>
      )}
    </button>
  );
}
