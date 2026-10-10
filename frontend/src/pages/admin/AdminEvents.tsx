import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarRange, Search, Star } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { EventSummary } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { StatusBadge, lifecycleStatus } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { dateTime, num } from '@/lib/format';
import { cn } from '@/lib/cn';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'LIVE', label: 'Live' },
  { value: 'PENDING', label: 'In review' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function AdminEvents() {
  usePageCrumbs([{ label: 'Events' }]);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [cancelling, setCancelling] = useState<EventSummary | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['admin', 'events', status, q, page], queryFn: () => api.admin.events({ status, q, page, size: 20 }) });

  const feature = useMutation({
    mutationFn: ({ id, featured }: { id: number; featured: boolean }) => api.admin.feature(id, featured),
    onSuccess: (e) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(e.featured ? 'Featured on the homepage' : 'Removed from featured');
    },
    onError: (e) => toast.error('Couldn’t update', e instanceof ApiError ? e.message : undefined),
  });
  const cancel = useMutation({
    mutationFn: () => api.events.cancel(cancelling!.id, reason.trim()),
    onSuccess: () => {
      setCancelling(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event cancelled', 'Attendees and the organizer were notified.');
    },
    onError: (e) => toast.error('Couldn’t cancel', e instanceof ApiError ? e.message : undefined),
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Events" description="Every event on the platform. Feature standout listings on the homepage or cancel events that break the rules." />
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          className="flex-1"
          items={FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        />
        <label className="relative lg:w-80">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Title or organizer"
            className="h-10 w-full rounded border border-line bg-ink-850 pl-9 pr-3 text-[13.5px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none"
          />
        </label>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <SkeletonRows rows={8} />
      ) : !list.data!.content.length ? (
        <EmptyState icon={<CalendarRange className="h-4 w-4" />} title="No events match" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Organizer</Th>
                <Th>Status</Th>
                <Th>Starts</Th>
                <Th className="text-right">Sold</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.data!.content.map((e) => {
                const life = lifecycleStatus(e);
                return (
                  <tr key={e.id} className="hover:bg-white/[0.02]">
                    <Td>
                      <Link to={`/events/${e.slug}`} className="block max-w-[320px] truncate font-medium hover:text-volt">
                        {e.title}
                      </Link>
                      <span className="text-[12px] text-mute">{e.category.name}</span>
                    </Td>
                    <Td className="text-mute">{e.organizerName}</Td>
                    <Td>
                      <StatusBadge status={life} />
                    </Td>
                    <Td className="tnum whitespace-nowrap text-mute">{dateTime(e.startsAt, e.timezone)}</Td>
                    <Td className="tnum text-right">
                      {num(e.totalSold)}
                      <span className="text-mute">/{num(e.totalCapacity)}</span>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {life === 'PUBLISHED' ? (
                          <button
                            onClick={() => feature.mutate({ id: e.id, featured: !e.featured })}
                            className={cn('rounded p-2 hover:bg-white/5', e.featured ? 'text-volt' : 'text-mute hover:text-bone')}
                            aria-label={e.featured ? 'Unfeature' : 'Feature on homepage'}
                            title={e.featured ? 'Featured — click to remove' : 'Feature on homepage'}
                          >
                            <Star className={cn('h-4 w-4', e.featured && 'fill-current')} />
                          </button>
                        ) : null}
                        {life === 'PUBLISHED' || life === 'PENDING' ? (
                          <button onClick={() => setCancelling(e)} className="rounded p-2 text-mute hover:bg-white/5 hover:text-signal-danger" aria-label="Cancel event" title="Cancel event">
                            <Ban className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={list.data!.page} totalPages={list.data!.totalPages} totalElements={list.data!.totalElements} size={list.data!.size} onChange={setPage} />
        </>
      )}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title={`Cancel “${cancelling?.title ?? ''}”?`}
        description={`${num(cancelling?.totalSold ?? 0)} tickets will be cancelled. Attendees and the organizer receive your reason.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => {
                if (reason.trim().length < 10) return setReasonError('At least 10 characters.');
                setReasonError(undefined);
                cancel.mutate();
              }}
            >
              Cancel event
            </Button>
          </>
        }
      >
        <Textarea label="Reason" required rows={4} value={reason} onChange={(ev) => setReason(ev.target.value)} error={reasonError} />
      </Modal>
    </div>
  );
}
