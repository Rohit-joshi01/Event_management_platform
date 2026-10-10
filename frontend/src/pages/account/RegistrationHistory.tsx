import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { StatusBadge } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { money, shortDate } from '@/lib/format';

export default function RegistrationHistory() {
  usePageCrumbs([{ label: 'Registration history' }]);
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['bookings', 'all', page], queryFn: () => api.bookings.list('all', page, 20) });

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader eyebrow="Attendee" title="Registration history" description="Every booking you’ve made, including cancelled ones." />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <SkeletonRows rows={6} />
      ) : q.data!.content.length === 0 ? (
        <EmptyState icon={<History className="h-4 w-4" />} title="No registrations yet" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Booked</Th>
                <Th>Tickets</Th>
                <Th>Total</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {q.data!.content.map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <Link to={`/account/tickets/${b.reference}`} className="font-medium hover:text-volt">
                      {b.event.title}
                    </Link>
                    <p className="font-mono text-[11.5px] text-mute">{b.reference}</p>
                  </Td>
                  <Td className="tnum text-mute">{shortDate(b.createdAt)}</Td>
                  <Td className="text-mute">{Object.entries(b.tickets.reduce<Record<string, number>>((m, t) => ({ ...m, [t.ticketTypeName]: (m[t.ticketTypeName] ?? 0) + 1 }), {})).map(([n, c]) => `${c}× ${n}`).join(', ')}</Td>
                  <Td className="tnum">{b.totalCents ? money(b.totalCents) : 'Free'}</Td>
                  <Td>
                    <StatusBadge status={b.paymentStatus} />
                  </Td>
                  <Td>
                    <StatusBadge status={b.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={q.data!.page} totalPages={q.data!.totalPages} totalElements={q.data!.totalElements} size={q.data!.size} onChange={setPage} />
        </>
      )}
    </div>
  );
}
