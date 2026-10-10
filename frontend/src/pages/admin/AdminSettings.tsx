import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { SettingItem } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Input, Toggle } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

export default function AdminSettings() {
  usePageCrumbs([{ label: 'Settings' }]);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.admin.settings });
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setValues(Object.fromEntries(q.data.settings.map((s) => [s.key, s.value])));
  }, [q.data]);

  const groups = useMemo(() => {
    const m = new Map<string, SettingItem[]>();
    for (const s of q.data?.settings ?? []) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, [q.data]);

  const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => q.data?.settings.find((s) => s.key === k)?.value !== v));
  const dirty = Object.keys(changed).length > 0;

  const save = useMutation({
    mutationFn: () => api.admin.updateSettings(changed),
    onSuccess: (r) => {
      qc.setQueryData(['admin', 'settings'], r);
      void qc.invalidateQueries({ queryKey: ['settings', 'public'] });
      setError(null);
      toast.success('Settings saved', 'The change is recorded in the activity log.');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Couldn’t save settings.'),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton className="mx-auto h-[520px] max-w-[960px]" />;

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader
        title="Settings"
        description="Platform-wide configuration. Changes apply immediately and are audited."
        actions={
          <Button icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Save {dirty ? `(${Object.keys(changed).length})` : ''}
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="mb-6 rounded border border-signal-danger/40 bg-signal-danger/[0.07] px-4 py-3 text-sm text-[#ffb3ab]">
          {error}
        </p>
      ) : null}
      <div className="space-y-6">
        {groups.map(([group, items]) => (
          <Panel key={group} title={group}>
            <div className="space-y-6">
              {items.map((s) =>
                s.type === 'boolean' ? (
                  <Toggle key={s.key} label={s.label} description={s.description} checked={values[s.key] === 'true'} onChange={(v) => setValues((x) => ({ ...x, [s.key]: String(v) }))} />
                ) : (
                  <Input
                    key={s.key}
                    label={s.label}
                    hint={s.description}
                    type={s.type === 'integer' ? 'number' : s.type === 'email' ? 'email' : 'text'}
                    value={values[s.key] ?? ''}
                    onChange={(e) => setValues((x) => ({ ...x, [s.key]: e.target.value }))}
                  />
                ),
              )}
            </div>
          </Panel>
        ))}
        <Panel title="Integrations" eyebrow="Read-only">
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-mute">Payment provider</dt>
              <dd className="text-right">Not connected — development checkout (simulated payments)</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-mute">Email delivery</dt>
              <dd className="text-right">Not configured — notifications are in-app only</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12.5px] text-mute">These are controlled by server environment variables, not from this screen.</p>
        </Panel>
      </div>
    </div>
  );
}
