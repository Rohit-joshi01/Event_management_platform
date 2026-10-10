import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { InventoryBars, RegistrationsChart, RevenueCard, StatCard, Table, Td, Th } from '@/components/app/Dashboard';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { num } from '@/lib/format';

export default function OrganizerAnalytics() {
  usePageCrumbs([{ label: 'Analytics' }]);
  const a = useQuery({ queryKey: ['organizer', 'analytics'], queryFn: api.organizer.analytics });

  const byEvent = useMemo(() => {
    const m = new Map<number, { title: string; sold: number; quantity: number; types: { ticketType: string; sold: number; quantity: number }[] }>();
    for (const t of a.data?.ticketsByType ?? []) {
      const cur = m.get(t.eventId) ?? { title: t.eventTitle, sold: 0, quantity: 0, types: [] };
      cur.sold += t.sold;
      cur.quantity += t.quantity;
      cur.types.push(t);
      m.set(t.eventId, cur);
    }
    return [...m.entries()].sort((x, y) => y[1].sold - x[1].sold);
  }, [a.data]);

  if (a.isError) return <ErrorState error={a.error} onRetry={() => a.refetch()} />;
  if (a.isLoading || !a.data) return <Skeleton className="mx-auto h-[600px] max-w-[1320px]" />;
  const d = a.data;
  const last30 = d.registrationsByDay.reduce((s, p) => s + p.tickets, 0);

  return (
    <div className="mx-auto max-w-[1320px]">
      <PageHeader title="Analytics" description="Registrations, ticket sales and attendance across all of your events." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tickets sold" value={d.ticketsSold} accent sub={`${num(last30)} in the last 30 days`} />
        <StatCard label="Bookings" value={d.totalRegistrations} sub={d.totalRegistrations ? `${(d.ticketsSold / d.totalRegistrations).toFixed(1)} tickets per booking` : undefined} />
        <StatCard label="Checked in" value={d.checkedIn} sub={`${Math.round(d.attendanceRate * 100)}% of tickets sold`} />
        <RevenueCard revenue={d.revenue} />
      </div>
      <Panel className="mt-6" title="Registrations over time" eyebrow="Tickets issued per day (IST) · last 30 days">
        <RegistrationsChart data={d.registrationsByDay} height={300} />
        <details className="mt-4 text-[13px] text-mute">
          <summary className="cursor-pointer hover:text-bone">Show as table</summary>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-left">
              <tbody>
                {d.registrationsByDay.filter((p) => p.tickets).map((p) => (
                  <tr key={p.date} className="border-b border-line">
                    <td className="py-1.5">{p.date}</td>
                    <td className="tnum py-1.5 text-right text-bone">{p.tickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Tickets sold by type">
          {byEvent.length ? (
            <div className="space-y-8">
              {byEvent.map(([id, ev]) => (
                <div key={id}>
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <Link to={`/organizer/events/${id}`} className="truncate font-medium hover:text-volt">
                      {ev.title}
                    </Link>
                    <span className="tnum shrink-0 text-[12.5px] text-mute">
                      {num(ev.sold)} / {num(ev.quantity)}
                    </span>
                  </div>
                  <InventoryBars rows={ev.types.map((t, i) => ({ key: `${id}-${i}`, label: t.ticketType, sold: t.sold, quantity: t.quantity }))} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute">No ticket sales yet.</p>
          )}
        </Panel>
        <Panel className="lg:col-span-5" title="Exports" eyebrow="CSV registration lists" bodyClassName="p-0">
          {byEvent.length ? (
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th className="text-right">Download</Th>
                </tr>
              </thead>
              <tbody>
                {byEvent.map(([id, ev]) => (
                  <tr key={id}>
                    <Td className="max-w-[260px] truncate">{ev.title}</Td>
                    <Td className="text-right">
                      <a href={api.events.exportUrl(id)} className="inline-flex items-center gap-1.5 text-[13px] text-bone/80 hover:text-volt">
                        <Download className="h-3.5 w-3.5" /> CSV
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-mute">Nothing to export yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
