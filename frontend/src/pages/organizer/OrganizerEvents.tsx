import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { Tabs } from '@/components/ui/Tabs';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge, lifecycleStatus } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Cover } from '@/components/ui/Media';
import { dateTime, num, priceLabel, relative } from '@/lib/format';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'LIVE', label: 'Live' },
  { value: 'PENDING', label: 'In review' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'REJECTED', label: 'Changes requested' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export default function OrganizerEvents() {
  usePageCrumbs([{ label: 'Events' }]);
  const [status, setStatus] = useState<(typeof FILTERS)[number]['value']>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ['organizer', 'events', status, q, page], queryFn: () => api.organizer.events({ status, q, page, size: 15 }) });

  return (
    <div className="mx-auto max-w-[1320px]">
      <PageHeader
        title="Events"
        description="Drafts, submissions, live listings and history."
        actions={
          <ButtonLink to="/organizer/events/new" icon={<CalendarPlus className="h-4 w-4" />}>
            Create event
          </ButtonLink>
        }
      />
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          className="flex-1"
          items={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        />
        <label className="relative lg:w-72">
          <span className="sr-only">Search your events</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search by title"
            className="h-10 w-full rounded border border-line bg-ink-850 pl-9 pr-3 text-[13.5px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none"
          />
        </label>
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <SkeletonRows rows={6} />
      ) : list.data!.content.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-4 w-4" />}
          title={q ? 'No events match that search' : 'Nothing here yet'}
          body={status === 'ALL' && !q ? 'Create a draft to get started.' : undefined}
          action={status === 'ALL' && !q ? <ButtonLink to="/organizer/events/new">Create event</ButtonLink> : undefined}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>Starts</Th>
                <Th className="text-right">Sold</Th>
                <Th>Price</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {list.data!.content.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link to={`/organizer/events/${e.id}`} className="flex items-center gap-3">
                      <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="h-10 w-14 shrink-0 rounded-sm" />
                      <span className="min-w-0">
                        <span className="block max-w-[340px] truncate font-medium hover:text-volt">{e.title}</span>
                        <span className="text-[12px] text-mute">{e.category.name}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <StatusBadge status={lifecycleStatus(e)} />
                  </Td>
                  <Td className="tnum whitespace-nowrap text-mute">{dateTime(e.startsAt, e.timezone)}</Td>
                  <Td className="tnum text-right">
                    {num(e.totalSold)}
                    <span className="text-mute"> / {num(e.totalCapacity)}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-mute">{e.totalCapacity ? priceLabel(e.minPriceCents) : '—'}</Td>
                  <Td className="whitespace-nowrap text-mute">{relative(e.createdAt)}</Td>
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
