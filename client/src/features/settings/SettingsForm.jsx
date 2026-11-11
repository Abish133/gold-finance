import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, Field, Input, Select, Switch, Textarea, Segmented, Spinner } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import clsx from 'clsx';
import { Save, Check, Loader2 } from 'lucide-react';

/* compact on/off row: small switch + label, green when on */
function ToggleRow({ on, label, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={clsx('flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] font-semibold transition', on ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
      <span className={clsx('relative h-4 w-7 shrink-0 rounded-full transition', on ? 'bg-emerald-600' : 'bg-ink-300 dark:bg-ink-600')}>
        <span className={clsx('absolute top-0.5 size-3 rounded-full bg-white transition-all', on ? 'left-3.5' : 'left-0.5')} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Generic settings editor. sections: [{ title, fields: [{ key, label, type: text|number|bool|select|textarea, options, hint }] }]
 * Scope "global" (all branches) or "branch" (overrides for the selected branch).
 */
export function SettingsForm({ sections, allowBranchScope = true, compact = false }) {
  const { isAllBranches, currentBranch } = useAuth();
  const [scope, setScope] = useState('global');
  const qc = useQueryClient();
  const { data, isLoading } = useFetch('/admin/settings', { scope });
  const [v, setV] = useState({});
  useEffect(() => { if (data) setV(data); }, [data]);
  const keys = sections.flatMap((s) => s.fields.map((f) => f.key));
  const save = useMutation({
    mutationFn: () => api.put(`/admin/settings?scope=${scope}`, Object.fromEntries(keys.map((k) => [k, v[k]]))),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['/admin/settings'] }); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <Spinner />;
  if (compact) {
    const dirty = data && keys.some((k) => (v[k] ?? '') !== (data[k] ?? ''));
    return (
      /* compact: sections side by side, inputs first, then on/off rows */
      <div className="flex shrink-0 flex-col gap-2">
        <div className="grid gap-2 lg:grid-cols-2">
          {sections.map((s, si) => {
            const inputs = s.fields.filter((f) => f.type !== 'bool');
            const bools = s.fields.filter((f) => f.type === 'bool');
            return (
              <div key={s.title} className="card flex flex-col overflow-hidden">
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
                  <span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />
                  <p className="text-[11px] font-bold tracking-wider whitespace-nowrap text-navy-900 uppercase dark:text-white">{s.title}</p>
                  {s.subtitle && <p className="truncate text-[11px] text-ink-500" title={s.subtitle}>{s.subtitle}</p>}
                  {si === sections.length - 1 && (
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {dirty && <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"><span className="size-1.5 animate-pulse rounded-full bg-amber-500" />Unsaved</span>}
                      <button type="button" disabled={save.isPending} onClick={() => save.mutate()}
                        className={clsx('flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition disabled:opacity-60', dirty ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800')}>
                        {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : dirty ? <Save className="size-3.5" /> : <Check className="size-3.5 text-emerald-600" />}{dirty ? 'Save changes' : 'Saved'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  {!!inputs.length && (
                    <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                      {inputs.map((f) => {
                        const val = v[f.key] ?? '';
                        const set = (x) => setV((o) => ({ ...o, [f.key]: x }));
                        const wide = f.type === 'textarea' || (!f.type && inputs.length === 1) || f.wide;
                        return (
                          <div key={f.key} className={clsx('min-w-0', wide && 'sm:col-span-2')}>
                            <p className="label truncate" title={f.label}>{f.label}</p>
                            {f.type === 'select' ? <Select className="!h-8 text-[13px]" value={val} onChange={(e) => set(e.target.value)} options={f.options} />
                              : f.type === 'textarea' ? <Textarea rows={f.rows || 3} value={val} onChange={(e) => set(e.target.value)} className={f.tamil ? 'tamil' : ''} />
                                : <Input className="!h-8 text-[13px]" type={f.type || 'text'} placeholder={f.hint} value={val} onChange={(e) => set(e.target.value)} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!!bools.length && (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {bools.map((f) => <ToggleRow key={f.key} on={(v[f.key] ?? '') === '1'} label={f.label} onChange={(c) => setV((o) => ({ ...o, [f.key]: c ? '1' : '0' }))} />)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {allowBranchScope && !isAllBranches
          ? <Segmented value={scope} onChange={setScope} options={[{ value: 'global', label: 'All branches (default)' }, { value: 'branch', label: `Only ${currentBranch?.name}` }]} />
          : <span />}
        <Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
      </div>
      {sections.map((s) => (
        <Card key={s.title} title={s.title} subtitle={s.subtitle}>
          <div className="grid gap-5 md:grid-cols-2">
            {s.fields.map((f) => {
              const val = v[f.key] ?? '';
              const set = (x) => setV((o) => ({ ...o, [f.key]: x }));
              if (f.type === 'bool') return <Switch key={f.key} checked={val === '1'} onChange={(c) => set(c ? '1' : '0')} label={f.label} description={f.hint} />;
              return (
                <Field key={f.key} label={f.label} hint={f.hint} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  {f.type === 'select' ? <Select value={val} onChange={(e) => set(e.target.value)} options={f.options} />
                    : f.type === 'textarea' ? <Textarea rows={f.rows || 4} value={val} onChange={(e) => set(e.target.value)} className={f.tamil ? 'tamil' : ''} />
                      : <Input type={f.type || 'text'} value={val} onChange={(e) => set(e.target.value)} />}
                </Field>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
