import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { dateTime, humanize } from '@/lib/format';

const ACTIONS = [
  'EVENT_SUBMITTED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_CANCELLED', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_FEATURED',
  'BOOKING_CREATED', 'BOOKING_CANCELLED', 'TICKET_CHECKED_IN', 'ANNOUNCEMENT_SENT',
  'USER_REGISTERED', 'USER_LOGIN', 'USER_ROLE_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'USER_DELETED', 'SETTINGS_UPDATED',
];

function tone(action: string) {
  if (/REJECTED|CANCELLED|SUSPENDED|DELETED/.test(action)) return 'danger' as const;
  if (/APPROVED|CREATED|REACTIVATED|CHECKED_IN/.test(action)) return 'volt' as const;
  if (/SETTINGS|ROLE/.test(action)) return 'warn' as const;
  return 'neutral' as const;
}

export default function ActivityLog() {
  usePageCrumbs([{ label: 'Activity log' }]);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(q);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const list = useQuery({ queryKey: ['admin', 'audit', debounced, action, entityType, page], queryFn: () => api.admin.auditLogs({ q: debounced, action, entityType, page, size: 30 }) });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Activity log" description="An append-only record of meaningful actions: approvals, bookings, account changes and settings." />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_160px]">
        <label className="relative">
          <span className="sr-only">Search the log</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary or actor email" className="h-10 w-full rounded border border-line bg-ink-850 pl-9 pr-3 text-[13.5px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none" />
        </label>
        <select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="h-10 rounded border border-line bg-ink-850 px-3 text-[13.5px]">
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {humanize(a)}
            </option>
          ))}
        </select>
        <select aria-label="Entity" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }} className="h-10 rounded border border-line bg-ink-850 px-3 text-[13.5px]">
          <option value="">All entities</option>
          {['EVENT', 'ORDER', 'TICKET', 'USER', 'SETTINGS'].map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <SkeletonRows rows={10} />
      ) : !list.data!.content.length ? (
        <EmptyState icon={<Activity className="h-4 w-4" />} title="No matching activity" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Details</Th>
                <Th>Actor</Th>
                <Th>Entity</Th>
              </tr>
            </thead>
            <tbody>
              {list.data!.content.map((l) => (
                <tr key={l.id}>
                  <Td className="tnum whitespace-nowrap text-[12.5px] text-mute">{dateTime(l.createdAt)}</Td>
                  <Td>
                    <Badge tone={tone(l.action)} dot={false}>
                      {humanize(l.action)}
                    </Badge>
                  </Td>
                  <Td className="max-w-[460px]">{l.summary}</Td>
                  <Td className="text-[12.5px] text-mute">{l.actorEmail ?? 'System'}</Td>
                  <Td className="whitespace-nowrap text-[12.5px] text-mute">
                    {humanize(l.entityType)}
                    {l.entityId ? ` #${l.entityId}` : ''}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={list.data!.page} totalPages={list.data!.totalPages} totalElements={list.data!.totalElements} size={list.data!.size} onChange={setPage} />
        </>
      )}
    </div>
  );
}
