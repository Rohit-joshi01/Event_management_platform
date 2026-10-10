import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Wifi } from 'lucide-react';
import type { EventSummary } from '@/lib/types';
import { Cover } from '@/components/ui/Media';
import { StatusBadge } from '@/components/ui/Badge';
import { dayMonth, dayNum, monthAbbr, priceLabel, time, weekday, where } from '@/lib/format';
import { cn } from '@/lib/cn';

function AvailabilityTag({ e }: { e: EventSummary }) {
  if (e.availability === 'LIMITED' || e.availability === 'SOLD_OUT' || e.availability === 'CANCELLED') {
    return <StatusBadge status={e.availability} />;
  }
  return null;
}

function Place({ e, className }: { e: EventSummary; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {e.format === 'ONLINE' ? <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{where(e)}</span>
    </span>
  );
}

/** Large editorial card: image dominant, metadata set like a magazine caption. */
export function FeatureCard({ e, className, priority }: { e: EventSummary; className?: string; priority?: boolean }) {
  return (
    <Link to={`/events/${e.slug}`} className={cn('group block', className)}>
      <div className="relative overflow-hidden rounded-md">
        <Cover
          src={e.coverImageUrl}
          alt={e.title}
          category={e.category.slug}
          eager={priority}
          className="aspect-[4/3] lg:aspect-[16/11]"
          imgClassName="transition-transform duration-[1400ms] ease-out-expo group-hover:scale-[1.035]"
        />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-sm bg-ink/80 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-bone backdrop-blur">{e.category.name}</span>
          <AvailabilityTag e={e} />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5">
        <div className="tnum border-r border-line pr-5 text-center">
          <p className="text-[11px] font-medium tracking-[0.14em] text-volt">{monthAbbr(e.startsAt, e.timezone)}</p>
          <p className="font-display text-[2.6rem] font-medium leading-none tracking-tight">{dayNum(e.startsAt, e.timezone)}</p>
          <p className="mt-1 text-[11px] text-mute">{weekday(e.startsAt, e.timezone)}</p>
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-[clamp(1.4rem,2.2vw,2rem)] font-medium leading-[1.05] tracking-[-0.03em] transition-colors group-hover:text-volt">{e.title}</h3>
          <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-mute">{e.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-bone/70">
            <span className="tnum">{time(e.startsAt, e.timezone)}</span>
            <Place e={e} />
            <span className="text-bone">{priceLabel(e.minPriceCents)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Mid-size card for grids. */
export function EventCard({ e, className, aspect = 'aspect-[4/3]' }: { e: EventSummary; className?: string; aspect?: string }) {
  return (
    <Link to={`/events/${e.slug}`} className={cn('group flex flex-col', className)}>
      <div className="relative overflow-hidden rounded">
        <Cover
          src={e.coverImageUrl}
          alt={e.title}
          category={e.category.slug}
          className={aspect}
          imgClassName="transition-transform duration-[1200ms] ease-out-expo group-hover:scale-[1.04]"
        />
        <div className="absolute right-3 top-3">
          <AvailabilityTag e={e} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 text-[12px] uppercase tracking-[0.12em] text-mute">
        <span>{e.category.name}</span>
        <span className="tnum normal-case tracking-normal">
          {weekday(e.startsAt, e.timezone)}, {dayMonth(e.startsAt, e.timezone)} · {time(e.startsAt, e.timezone)}
        </span>
      </div>
      <h3 className="mt-2 font-display text-[1.35rem] font-medium leading-[1.12] tracking-[-0.025em] transition-colors group-hover:text-volt">{e.title}</h3>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[13px] text-bone/70">
        <Place e={e} />
        <span className="shrink-0 text-bone">{priceLabel(e.minPriceCents)}</span>
      </div>
    </Link>
  );
}

/** Dense list row — used for "happening soon" and long result lists. */
export function EventRow({ e, index }: { e: EventSummary; index?: number }) {
  return (
    <Link
      to={`/events/${e.slug}`}
      className="group grid grid-cols-[64px_1fr_auto] items-center gap-4 border-t border-line py-4 transition-colors hover:bg-white/[0.02] sm:grid-cols-[40px_88px_1fr_200px_120px_24px] sm:gap-6 sm:px-2"
    >
      <span className="tnum hidden text-[12px] text-mute-700 sm:block">{index !== undefined ? String(index + 1).padStart(2, '0') : ''}</span>
      <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="aspect-square w-16 rounded-sm sm:w-[88px]" />
      <div className="min-w-0">
        <p className="tnum text-[12px] text-volt">
          {weekday(e.startsAt, e.timezone)} {dayMonth(e.startsAt, e.timezone)} · {time(e.startsAt, e.timezone)}
        </p>
        <h3 className="mt-1 truncate font-display text-[1.1rem] font-medium tracking-[-0.02em] sm:text-[1.25rem]">{e.title}</h3>
        <Place e={e} className="mt-1 text-[12.5px] text-mute sm:hidden" />
      </div>
      <Place e={e} className="hidden text-[13px] text-mute sm:flex" />
      <span className="hidden text-right text-[13px] sm:block">{e.availability === 'SOLD_OUT' ? <StatusBadge status="SOLD_OUT" /> : priceLabel(e.minPriceCents)}</span>
      <ArrowUpRight className="h-4 w-4 text-mute transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-volt" aria-hidden />
    </Link>
  );
}

export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)} aria-hidden>
      <div className="relative aspect-[4/3] overflow-hidden rounded bg-ink-700/70">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>
      <div className="mt-4 h-3 w-1/3 rounded bg-ink-700/70" />
      <div className="mt-3 h-5 w-3/4 rounded bg-ink-700/70" />
      <div className="mt-3 h-3 w-1/2 rounded bg-ink-700/70" />
    </div>
  );
}
