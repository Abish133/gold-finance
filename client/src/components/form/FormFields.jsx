import { Controller } from 'react-hook-form';
import clsx from 'clsx';
import { Field, Input, Select, Textarea, Switch } from '@/components/ui';
import { useList } from '@/hooks/useApi';
import { PasswordHelp } from '@/components/common/PasswordHelp';

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
