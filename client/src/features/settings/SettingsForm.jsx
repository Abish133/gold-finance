import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, Card, Field, Input, Select, Switch, Textarea, Segmented, Spinner } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

/**
 * Generic settings editor. sections: [{ title, fields: [{ key, label, type: text|number|bool|select|textarea, options, hint }] }]
 * Scope "global" (all branches) or "branch" (overrides for the selected branch).
 */
export function SettingsForm({ sections, allowBranchScope = true }) {
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
