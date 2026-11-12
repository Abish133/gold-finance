import { Controller } from 'react-hook-form';
import clsx from 'clsx';
import { Field, Input, Select, Textarea, Switch } from '@/components/ui';
import { useList } from '@/hooks/useApi';
import { Phone, Plus, X } from 'lucide-react';
import { PasswordHelp } from '@/components/common/PasswordHelp';

const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
const validatePhones = (v, f) => {
  const list = (v || []).map((x) => String(x ?? '').trim()).filter(Boolean);
  if (f.required && !list.length) return 'At least one contact number is required';
  if (list.some((x) => !PHONE_RE.test(x))) return 'Use only digits, spaces, + - ( ) (6 to 20 characters)';
  if (new Set(list).size !== list.length) return 'The same number is entered twice';
  return true;
};

/** 1..max phone numbers: the first is the primary (mandatory when required), the rest are optional and can be added / removed. */
function PhoneList({ field, f, err }) {
  const max = f.max || 5;
  const list = Array.isArray(field.value) && field.value.length ? field.value : [''];
  const set = (next) => field.onChange(next);
  return (
    <div className={clsx('block', err && 'field-error')}>
      <span className="label">{f.label}{f.required && <span aria-hidden className="ml-1 inline-block size-1.5 -translate-y-px rounded-full bg-rose-500 align-middle" title="Required" />}</span>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map((v, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input value={v ?? ''} inputMode="tel" maxLength={20} autoComplete="off" prefix={<Phone className="size-3.5" />}
              placeholder={i === 0 ? 'Primary number' : `Number ${i + 1} (optional)`} aria-label={i === 0 ? 'Primary contact number' : `Contact number ${i + 1}`}
              onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))} onBlur={field.onBlur} />
            {i > 0 && (
              <button type="button" title="Remove this number" aria-label={`Remove number ${i + 1}`} onClick={() => set(list.filter((_, j) => j !== i))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"><X className="size-3.5" /></button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {list.length < max && (
          <button type="button" onClick={() => set([...list, ''])} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-navy-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800">
            <Plus className="size-3.5" />Add number
          </button>
        )}
        <span className="text-[11px] text-ink-400">{list.length} of {max}{f.hint ? ` · ${f.hint}` : ''}</span>
      </div>
      {err && <span role="alert" className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600"><span aria-hidden className="grid size-3 shrink-0 place-items-center rounded-full bg-rose-600 text-[8px] font-bold text-white">!</span>{err}</span>}
    </div>
  );
}

/** Select whose options come from an API list endpoint ({ all: 1 }). */
export function AsyncSelect({ endpoint, params, labelKey = 'name', valueKey = 'id', format, ...props }) {
  const { data } = useList(endpoint, { all: 1, ...params }, { staleTime: 5 * 60_000 });
  const options = (data?.data || []).map((r) => ({ value: r[valueKey], label: format ? format(r) : r[labelKey] }));
  return <Select options={options} {...props} />;
}

/**
 * Renders form fields from a schema. Works with react-hook-form.
 * field: { name, label, type, options, endpoint, labelKey, format, required, span, placeholder, hint, show(values), suffix, prefix, step }
 */
export function FormFields({ fields, form, cols = 2, dense = false, className }) {
  const { register, control, watch, formState: { errors } } = form;
  const values = watch();
  return (
    <div className={clsx('grid', className, dense ? 'gap-x-3 gap-y-2' : 'gap-4', cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'sm:grid-cols-3' : cols === 1 ? '' : 'sm:grid-cols-2')}>
      {fields.map((f) => {
        if (f.show && !f.show(values)) return null;
        if (f.type === 'section') {
          return dense
            ? <h4 key={f.name} className="col-span-full mt-1 flex items-center gap-2 text-[10px] font-bold tracking-wider text-navy-900 uppercase first:mt-0 dark:text-white"><span className="h-3 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />{f.label}<span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" /></h4>
            : <h4 key={f.name} className="col-span-full mt-2 border-b border-ink-100 pb-1 text-xs font-bold tracking-wider text-gold-700 uppercase dark:border-ink-800">{f.label}</h4>;
        }
        const rules = { required: f.required ? `${f.label} is required` : false, ...(f.rules || {}) };
        const span = f.span === 'full' ? 'col-span-full' : f.span === 2 ? 'sm:col-span-2' : '';
        const err = errors[f.name]?.message;
        if (f.type === 'phone-list') {
          return (
            <div key={f.name} className={span}>
              <Controller name={f.name} control={control} rules={{ validate: (v) => validatePhones(v, f) }}
                render={({ field }) => <PhoneList field={field} f={f} err={err} />} />
            </div>
          );
        }
        if (f.type === 'switch') {
          return (
            <div key={f.name} className={clsx(span, 'pt-1')}>
              <Controller name={f.name} control={control} render={({ field }) => (
                <Switch checked={!!Number(field.value) || field.value === true} onChange={(v) => field.onChange(v ? 1 : 0)} label={f.label} description={f.hint} />
              )} />
            </div>
          );
        }
        const ico = f.icon ? <f.icon className="size-3.5" /> : undefined;
        let input;
        switch (f.type) {
          case 'select':
            input = <Select {...register(f.name, rules)} prefix={ico} options={typeof f.options === 'function' ? f.options(values) : f.options} placeholder={f.placeholder ?? 'Select…'} />;
            break;
          case 'async-select':
            input = <AsyncSelect {...register(f.name, rules)} endpoint={f.endpoint} params={f.params} labelKey={f.labelKey} format={f.format} placeholder={f.placeholder ?? 'Select…'} />;
            break;
          case 'textarea':
            input = <Textarea {...register(f.name, rules)} rows={f.rows || 3} placeholder={f.placeholder} />;
            break;
          case 'money':
            input = <Input type="number" step="0.01" prefix="₹" {...register(f.name, rules)} placeholder={f.placeholder} />;
            break;
          default:
            input = <Input type={f.type || 'text'} step={f.step} suffix={f.suffix} prefix={f.prefix ?? ico} maxLength={f.maxLength} {...register(f.name, rules)} placeholder={f.placeholder} autoComplete="off" />;
        }
        if (f.suggest) {
          return (
            <div key={f.name} className={span}>
              <Field label={f.label} required={f.required} error={err} hint={f.hint}>{input}</Field>
              <PasswordHelp value={values[f.name]} onUse={(p) => form.setValue(f.name, p, { shouldDirty: true, shouldValidate: true })} />
            </div>
          );
        }
        return <Field key={f.name} label={f.label} required={f.required} error={err} hint={typeof f.hint === 'function' ? f.hint(values) : f.hint} className={span}>{input}</Field>;
      })}
    </div>
  );
}
