import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { ButtonLink } from '@/components/ui/Button';
import { BookingCard } from '@/components/tickets/BookingCard';

type Scope = 'upcoming' | 'past' | 'cancelled';

export default function MyTickets() {
  usePageCrumbs([{ label: 'My tickets' }]);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['bookings', scope, page], queryFn: () => api.bookings.list(scope, page, 10) });

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader eyebrow="Attendee" title="My tickets" description="Open a booking to show its QR codes at the door, print it, or cancel before the event starts." />
      <Tabs
        className="mb-6"
        value={scope}
        onChange={(v) => {
          setScope(v);
          setPage(0);
        }}
        items={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : q.data!.content.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-4 w-4" />}
          title={scope === 'upcoming' ? 'No upcoming tickets' : scope === 'past' ? 'No past events yet' : 'No cancelled bookings'}
          body={scope === 'upcoming' ? 'Book something and it will show up here with your QR codes.' : undefined}
          action={scope === 'upcoming' ? <ButtonLink to="/events">Find an event</ButtonLink> : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {q.data!.content.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
          <Pagination page={q.data!.page} totalPages={q.data!.totalPages} totalElements={q.data!.totalElements} size={q.data!.size} onChange={setPage} />
        </>
      )}
    </div>
  );
}
