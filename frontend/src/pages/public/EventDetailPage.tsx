import { useLayoutEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, Lock, MapPin, Wifi } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Cover, Avatar } from '@/components/ui/Media';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { TicketPanel } from '@/components/events/TicketPanel';
import { EventCard } from '@/components/events/EventCards';
import { NotFoundPage } from './StatusPages';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fullDate, time, tzLabel, eventWhen } from '@/lib/format';
import { gsap, prefersReducedMotion } from '@/lib/gsap';

export default function EventDetailPage() {
  const { slug = '' } = useParams();
  const event = useQuery({ queryKey: ['events', 'detail', slug], queryFn: () => api.events.detail(slug) });
  const related = useQuery({ queryKey: ['events', 'related', event.data?.id], queryFn: () => api.events.related(event.data!.id), enabled: !!event.data });
  const hero = useRef<HTMLDivElement>(null);
  useDocumentTitle(event.data?.title);

  useLayoutEffect(() => {
    const el = hero.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-cover] img', { scale: 1.12 }, { scale: 1, duration: 1.8, ease: 'expo.out' });
      gsap.to('[data-cover]', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.from('[data-title-line]', { yPercent: 105, duration: 1.2, delay: 0.1 });
    }, el);
    return () => ctx.revert();
  }, [event.data?.id]);

  if (event.isError) {
    if (event.error instanceof ApiError && event.error.isNotFound) return <NotFoundPage />;
    return (
      <div className="container-x pt-40">
        <ErrorState error={event.error} onRetry={() => event.refetch()} />
      </div>
    );
  }

  if (event.isLoading || !event.data) return <DetailSkeleton />;
  const e = event.data;
  const tz = e.timezone;

  return (
    <article>
      <div ref={hero} className="relative h-[78svh] min-h-[520px] overflow-hidden">
        <div data-cover className="absolute inset-0">
          <Cover src={e.coverImageUrl} alt={e.title} category={e.category.slug} className="h-full w-full" eager />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" aria-hidden />
        <div className="container-x relative flex h-full flex-col justify-end pb-10">
          <Link to="/events" className="mb-auto mt-[calc(var(--nav-h)+1.5rem)] inline-flex w-fit items-center gap-2 text-[13px] text-bone/75 hover:text-bone">
            <ArrowLeft className="h-4 w-4" /> All events
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/events?category=${e.category.slug}`} className="rounded-sm bg-bone px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink">
              {e.category.name}
            </Link>
            {e.status !== 'PUBLISHED' ? <StatusBadge status={e.status} /> : null}
            {e.availability === 'LIMITED' || e.availability === 'SOLD_OUT' ? <StatusBadge status={e.availability} /> : null}
            {e.seed ? <Badge tone="muted">Demo listing</Badge> : null}
          </div>
          <h1 className="mt-5 max-w-5xl overflow-hidden font-display text-[clamp(2.3rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.045em]">
            <span data-title-line className="block">
              {e.title}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-bone/80">{e.summary}</p>
        </div>
      </div>

      {e.status === 'CANCELLED' ? (
        <div className="border-y border-signal-danger/30 bg-signal-danger/[0.07]">
          <div className="container-x py-4 text-sm">
            <strong className="font-medium text-[#ff9c92]">This event has been cancelled.</strong>{' '}
            <span className="text-bone/80">{e.cancelReason}</span>
          </div>
        </div>
      ) : null}
      {e.viewerIsOwner && e.status !== 'PUBLISHED' && e.status !== 'CANCELLED' ? (
        <div className="border-y border-signal-warn/30 bg-signal-warn/[0.06]">
          <div className="container-x flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span>Preview — only you and administrators can see this page until it’s approved.</span>
            <Link to={`/organizer/events/${e.id}`} className="underline">
              Manage event
            </Link>
          </div>
        </div>
      ) : null}

      <div className="container-x grid gap-12 py-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
            <Fact icon={<CalendarDays className="h-4 w-4" />} label="Date" value={fullDate(e.startsAt, tz)} />
            <Fact icon={<Clock3 className="h-4 w-4" />} label={`Time (${tzLabel(tz)})`} value={`${time(e.startsAt, tz)} – ${time(e.endsAt, tz)}`} />
            <Fact
              icon={e.format === 'ONLINE' ? <Wifi className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              label={e.format === 'ONLINE' ? 'Online' : 'Venue'}
              value={e.venue ? `${e.venue.name}, ${e.venue.city}` : 'Online event'}
            />
          </dl>

          <section className="mt-14" aria-labelledby="about-title">
            <h2 id="about-title" className="eyebrow mb-5">
              About this event
            </h2>
            <div className="space-y-5 text-[16.5px] leading-[1.75] text-bone/85">
              {e.description.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className={i === 0 ? 'font-serif text-[1.55rem] leading-[1.35] text-bone' : undefined}>
                  {para}
                </p>
              ))}
            </div>
          </section>

          {e.schedule.length ? (
            <section className="mt-14" aria-labelledby="schedule-title">
              <h2 id="schedule-title" className="eyebrow mb-5">
                Schedule
              </h2>
              <ol className="border-l border-line">
                {e.schedule.map((s) => (
                  <li key={s.id} className="relative pb-7 pl-7 last:pb-0">
                    <span className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full border border-volt bg-ink" aria-hidden />
                    <p className="tnum text-[12.5px] text-volt">
                      {fullDate(s.startsAt, tz) !== fullDate(e.startsAt, tz) ? `${fullDate(s.startsAt, tz)} · ` : ''}
                      {time(s.startsAt, tz)}
                    </p>
                    <p className="mt-1 font-display text-lg font-medium tracking-tight">{s.title}</p>
                    {s.description ? <p className="mt-1 text-sm text-mute">{s.description}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mt-14 grid gap-6 sm:grid-cols-2" aria-label="Location and organizer">
            <div className="rounded-md border border-line p-5">
              <p className="eyebrow mb-3">{e.format === 'ONLINE' ? 'Where to join' : 'Location'}</p>
              {e.venue ? (
                <>
                  <p className="font-medium">{e.venue.name}</p>
                  <p className="mt-1 text-sm text-mute">{[e.venue.address, e.venue.city, e.venue.country].filter(Boolean).join(', ')}</p>
                  <a
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-bone/80 underline-offset-4 hover:text-bone hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue.name, e.venue.address, e.venue.city].filter(Boolean).join(', '))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : null}
              {e.format !== 'IN_PERSON' ? (
                e.onlineUrl ? (
                  <a href={e.onlineUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-sm text-volt underline-offset-4 hover:underline">
                    {e.onlineUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-sm text-mute">
                    <Lock className="h-3.5 w-3.5" /> The joining link appears here once you’re registered.
                  </p>
                )
              ) : null}
            </div>
            <div className="rounded-md border border-line p-5">
              <p className="eyebrow mb-3">Hosted by</p>
              <div className="flex items-center gap-3">
                <Avatar name={e.organizer.organizationName ?? e.organizer.name} src={e.organizer.avatarUrl} size={40} />
                <div>
                  <p className="font-medium">{e.organizer.organizationName ?? e.organizer.name}</p>
                  <p className="text-[12.5px] text-mute">{e.organizer.publishedEvents} published events</p>
                </div>
              </div>
              {e.organizer.bio ? <p className="mt-3 text-sm leading-relaxed text-mute">{e.organizer.bio}</p> : null}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
            <TicketPanel event={e} />
            <p className="mt-4 text-[12px] leading-relaxed text-mute-700">{eventWhen(e.startsAt, e.endsAt, tz)}</p>
          </div>
        </aside>
      </div>

      {related.data?.length ? (
        <section className="container-x border-t border-line py-20" aria-labelledby="related-title">
          <div className="mb-10 flex items-end justify-between">
            <h2 id="related-title" className="font-display text-huge font-medium">
              You might also like
            </h2>
            <Link to={`/events?category=${e.category.slug}`} className="link-underline hidden text-sm text-bone/80 hover:text-bone sm:block">
              More {e.category.name.toLowerCase()}
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.data.map((r) => (
              <EventCard key={r.id} e={r} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-ink p-5">
      <dt className="flex items-center gap-2 text-[12px] text-mute">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 text-[14.5px] leading-snug">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading event">
      <Skeleton className="h-[78svh] min-h-[520px] w-full rounded-none" />
      <div className="container-x grid gap-10 py-14 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-8/12" />
        </div>
        <Skeleton className="h-80 lg:col-span-4 lg:col-start-9" />
      </div>
    </div>
  );
}
