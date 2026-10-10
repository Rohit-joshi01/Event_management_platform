import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { RegistrationsChart, RevenueCard, StatCard } from '@/components/app/Dashboard';
import { Panel } from '@/components/ui/Panel';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Cover } from '@/components/ui/Media';
import { StatusBadge } from '@/components/ui/Badge';
import { dateTime, dayMonth, money, num, relative, time } from '@/lib/format';

export default function OrganizerOverview() {
  usePageCrumbs([{ label: 'Overview' }]);
  const { user } = useAuth();
  const a = useQuery({ queryKey: ['organizer', 'analytics'], queryFn: api.organizer.analytics });

  return (
    <div className="mx-auto max-w-[1320px]">
      <PageHeader
        eyebrow={user?.organizationName ?? 'Organizer workspace'}
        title="Overview"
        description="Everything here is calculated from your events, tickets and bookings."
        actions={
          <ButtonLink to="/organizer/events/new" icon={<CalendarPlus className="h-4 w-4" />}>
            Create event
          </ButtonLink>
        }
      />
      {a.isError ? (
        <ErrorState error={a.error} onRetry={() => a.refetch()} />
      ) : a.isLoading || !a.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : a.data.totalEvents === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-4 w-4" />}
          title="Create your first event"
          body="Draft it, add ticket types and submit it for review. Once approved it goes live on the programme."
          action={<ButtonLink to="/organizer/events/new">Start a draft</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Events created" value={a.data.totalEvents} sub={`${a.data.eventsByStatus.PUBLISHED ?? 0} live · ${a.data.eventsByStatus.COMPLETED ?? 0} completed`} />
            <StatCard label="Tickets sold" value={a.data.ticketsSold} accent sub={`${num(a.data.totalRegistrations)} bookings`} />
            <StatCard label="Awaiting review" value={a.data.eventsByStatus.PENDING ?? 0} sub={`${a.data.eventsByStatus.DRAFT ?? 0} drafts · ${a.data.eventsByStatus.REJECTED ?? 0} need changes`} />
            <RevenueCard revenue={a.data.revenue} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-8" title="Registrations" eyebrow="Tickets issued per day · last 30 days" action={<Link to="/organizer/analytics" className="text-[13px] text-mute hover:text-bone">Analytics</Link>}>
              <RegistrationsChart data={a.data.registrationsByDay} />
            </Panel>
            <Panel className="lg:col-span-4" title="Upcoming deadlines" bodyClassName="p-0">
              {a.data.upcomingDeadlines.length ? (
                <ul className="divide-y divide-line">
                  {a.data.upcomingDeadlines.map((d, i) => (
                    <li key={i}>
                      <Link to={`/organizer/events/${d.eventId}`} className="flex gap-4 px-5 py-3.5 hover:bg-white/[0.02]">
                        <div className="tnum w-12 shrink-0 text-center">
                          <p className="font-display text-xl leading-none">{dayMonth(d.at).split(' ')[0]}</p>
                          <p className="text-[11px] uppercase text-mute">{dayMonth(d.at).split(' ')[1]}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13.5px]">{d.label}</p>
                          <p className="truncate text-[12px] text-mute">
                            {d.eventTitle} · {time(d.at)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 p-5 text-sm text-mute">
                  <CalendarClock className="h-4 w-4" /> No deadlines coming up.
                </p>
              )}
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-7" title="Live and upcoming" bodyClassName="p-0">
              {a.data.upcomingEvents.length ? (
                <ul className="divide-y divide-line">
                  {a.data.upcomingEvents.map((e) => {
                    const pct = e.totalCapacity ? Math.round((e.totalSold / e.totalCapacity) * 100) : 0;
                    return (
                      <li key={e.id}>
                        <Link to={`/organizer/events/${e.id}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02]">
                          <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="aspect-square rounded-sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium">{e.title}</p>
                            <p className="text-[12px] text-mute">
                              {dateTime(e.startsAt, e.timezone)} · {num(e.totalSold)}/{num(e.totalCapacity)} sold
                            </p>
                          </div>
                          <div className="w-24">
                            <p className="tnum mb-1 text-right text-[12px] text-mute">{pct}%</p>
                            <div className="h-1 overflow-hidden rounded-full bg-ink-600">
                              <div className="h-full bg-volt" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-5 text-sm text-mute">No live events right now.</p>
              )}
            </Panel>
            <Panel className="lg:col-span-5" title="Recent bookings" bodyClassName="p-0">
              {a.data.recentBookings.length ? (
                <ul className="divide-y divide-line">
                  {a.data.recentBookings.map((b) => (
                    <li key={b.reference} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px]">
                          {b.attendeeName} <span className="text-mute">· {b.quantity}×</span>
                        </p>
                        <p className="truncate text-[12px] text-mute">
                          {b.eventTitle} · {relative(b.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tnum text-[13px]">{b.totalCents ? money(b.totalCents) : 'Free'}</span>
                        {b.paymentStatus === 'SIMULATED_PAID' ? <StatusBadge status="SIMULATED_PAID" /> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-sm text-mute">No bookings yet.</p>
              )}
              <div className="border-t border-line px-5 py-3">
                <Link to="/organizer/events" className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-bone">
                  All events <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
