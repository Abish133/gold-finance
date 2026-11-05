import { forwardRef, useId } from 'react';
import clsx from 'clsx';

export function Field({ label, error, hint, required, children, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}{required && <span className="text-rose-500"> *</span>}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef(function Input({ className, prefix, suffix, ...props }, ref) {
  if (!prefix && !suffix) return <input ref={ref} className={clsx('input', className)} {...props} />;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-400">{prefix}</span>}
      <input ref={ref} className={clsx('input', prefix && 'pl-8', suffix && 'pr-12', className)} {...props} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-ink-400">{suffix}</span>}
    </div>
  );
});

export const Select = forwardRef(function Select({ className, options = [], placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={clsx('input appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'object'
        ? <option key={o.value} value={o.value}>{o.label}</option>
        : <option key={o} value={o}>{o}</option>))}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx('input h-auto py-2', className)} {...props} />;
});

export function Switch({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx('flex cursor-pointer items-start gap-3', disabled && 'opacity-50')}>
      <span className="relative mt-0.5 inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-ink-200 transition peer-checked:bg-navy-700 dark:bg-ink-700" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>}
          {description && <span className="block text-xs text-ink-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, className }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange?.(e.target.checked)}
        className="size-4 rounded border-ink-300 accent-gold-600" />
      {label}
    </label>
  );
}

/** Segmented control - nice replacement for radio groups */
export function Segmented({ value, onChange, options, size = 'md' }) {
  return (
    <div className="inline-flex rounded-md border border-ink-300 bg-white p-0.5 dark:border-ink-700 dark:bg-ink-800">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={clsx('rounded-[4px] font-semibold transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              value === v ? 'bg-navy-800 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>
            {l}
          </button>
        );
      })}
    </div>
  );
}
