import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, Compass, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ButtonLink } from '@/components/ui/Button';
import { Cover } from '@/components/ui/Media';
import { BookingCard } from '@/components/tickets/BookingCard';
import { EventCard } from '@/components/events/EventCards';
import { fullDate, relative, time, where } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { cn } from '@/lib/cn';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function AttendeeOverview() {
  usePageCrumbs([{ label: 'Overview' }]);
  const { user } = useAuth();
  const upcoming = useQuery({ queryKey: ['bookings', 'upcoming'], queryFn: () => api.bookings.list('upcoming', 0, 6) });
  const notifications = useQuery({ queryKey: ['notifications', 'recent'], queryFn: () => api.notifications.list(false, 0, 5) });
  const recs = useQuery({ queryKey: ['me', 'recommendations'], queryFn: () => api.me.recommendations(3) });

  const next = upcoming.data?.content[0];
  const first = user?.fullName.split(' ')[0];

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={
          <>
            {greeting()}, {first}.
          </>
        }
        description={upcoming.data ? (upcoming.data.totalElements ? `You have ${upcoming.data.totalElements} upcoming booking${upcoming.data.totalElements > 1 ? 's' : ''}.` : 'Nothing booked yet — the programme is waiting.') : undefined}
        actions={
          <ButtonLink to="/events" variant="secondary" icon={<Compass className="h-4 w-4" />}>
            Discover events
          </ButtonLink>
        }
      />

      {upcoming.isError ? <ErrorState error={upcoming.error} onRetry={() => upcoming.refetch()} /> : upcoming.isLoading ? <Skeleton className="h-72 w-full" /> : next ? <NextUp b={next} /> : (
        <EmptyState icon={<Ticket className="h-4 w-4" />} title="No upcoming tickets" body="When you book an event, your QR tickets and a countdown will appear here." action={<ButtonLink to="/events">Browse events</ButtonLink>} />
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Panel title="Upcoming" action={<Link to="/account/tickets" className="text-[13px] text-mute hover:text-bone">All tickets</Link>}>
            {upcoming.isLoading ? (
              <Skeleton className="h-32" />
            ) : (upcoming.data?.content.length ?? 0) > 1 ? (
              <div className="space-y-3">
                {upcoming.data!.content.slice(1, 4).map((b) => (
                  <BookingCard key={b.id} b={b} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">{next ? 'That’s your only upcoming booking.' : 'Nothing else coming up.'}</p>
            )}
          </Panel>
          <Panel title="Suggested for you" eyebrow="Based on what you’ve booked">
            {recs.isLoading ? (
              <div className="grid gap-6 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="aspect-[4/3]" />
                ))}
              </div>
            ) : recs.data?.length ? (
              <div className="grid gap-6 sm:grid-cols-3">
                {recs.data.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">No suggestions right now.</p>
            )}
          </Panel>
        </div>
        <div className="lg:col-span-4">
          <Panel title="Recent updates" action={<Link to="/me/notifications" className="text-[13px] text-mute hover:text-bone">View all</Link>} bodyClassName="p-0">
            {notifications.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : notifications.data?.content.length ? (
              <ul className="divide-y divide-line">
                {notifications.data.content.map((n) => (
                  <li key={n.id}>
                    <Link to={n.link ?? '/me/notifications'} className="flex gap-3 px-5 py-4 hover:bg-white/[0.02]">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-volt')} aria-label={n.read ? undefined : 'Unread'} />
                      <div className="min-w-0">
                        <p className={cn('text-[13.5px] leading-snug', n.read ? 'text-bone/70' : 'text-bone')}>{n.title}</p>
                        <p className="mt-1 text-[12px] text-mute">{relative(n.createdAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 p-5 text-sm text-mute">
                <Bell className="h-4 w-4" /> You’re all caught up.
              </div>
            )}
          </Panel>
          <div className="mt-6 rounded-md border border-line p-5">
            <p className="eyebrow mb-2">Your profile</p>
            <p className="text-sm">{user?.email}</p>
            <p className="mt-1 text-[12.5px] text-mute">{user?.city ?? 'Add your city for better suggestions.'}</p>
            <Link to="/me/profile" className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-bone/80 hover:text-bone">
              Edit profile <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function useCountdown(target: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(diff / 864e5),
    hours: Math.floor((diff % 864e5) / 36e5),
    minutes: Math.floor((diff % 36e5) / 6e4),
    seconds: Math.floor((diff % 6e4) / 1000),
    started: diff === 0,
  };
}

function NextUp({ b }: { b: Booking }) {
  const e = b.event;
  const c = useCountdown(e.startsAt);
  return (
    <Link to={`/account/tickets/${b.reference}`} className="group grid overflow-hidden rounded-md border border-line bg-ink-800 lg:grid-cols-12">
      <Cover src={e.coverImageUrl} alt={e.title} category={e.category.slug} className="aspect-[16/9] lg:col-span-5 lg:aspect-auto lg:h-full" imgClassName="transition-transform duration-[1200ms] ease-out-expo group-hover:scale-[1.03]" />
      <div className="flex flex-col justify-between gap-8 p-6 sm:p-8 lg:col-span-7">
        <div>
          <p className="eyebrow text-volt">Next up</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-[1.02] tracking-[-0.035em]">{e.title}</h2>
          <p className="mt-3 text-sm text-mute">
            {fullDate(e.startsAt, e.timezone)} · {time(e.startsAt, e.timezone)} · {where(e)}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          {c.started ? (
            <p className="font-display text-2xl text-volt">Happening now</p>
          ) : (
            <dl className="tnum flex gap-6" aria-label="Time until the event starts">
              {(
                [
                  ['days', c.days],
                  ['hrs', c.hours],
                  ['min', c.minutes],
                  ['sec', c.seconds],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dd className="font-display text-[clamp(2rem,4vw,3.4rem)] font-medium leading-none tracking-tight">{String(v).padStart(2, '0')}</dd>
                  <dt className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">{k}</dt>
                </div>
              ))}
            </dl>
          )}
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="link-underline">Open tickets</span> <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
