import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Wifi } from 'lucide-react';
import type { Booking } from '@/lib/types';
import { Cover } from '@/components/ui/Media';
import { StatusBadge } from '@/components/ui/Badge';
import { dayNum, money, monthAbbr, time, weekday, where } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Ticket-stub styled booking summary with a perforated edge. */
export function BookingCard({ b }: { b: Booking }) {
  const e = b.event;
  const cancelled = b.status === 'CANCELLED';
  return (
    <Link
      to={`/account/tickets/${b.reference}`}
      className={cn('group grid overflow-hidden rounded-md border border-line bg-ink-800 transition-colors hover:border-line-strong sm:grid-cols-[180px_1fr_150px]', cancelled && 'opacity-70')}
    >
      <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
      <div className="min-w-0 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          {b.paymentStatus !== 'NOT_REQUIRED' ? <StatusBadge status={b.paymentStatus} /> : null}
        </div>
        <h3 className="mt-3 truncate font-display text-xl font-medium tracking-tight group-hover:text-volt">{e.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-mute">
          {e.format === 'ONLINE' ? <Wifi className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          <span className="truncate">{where(e)}</span>
        </p>
        <p className="mt-3 text-[12.5px] text-mute">
          <span className="font-mono text-bone/80">{b.reference}</span> · {b.tickets.length} ticket{b.tickets.length > 1 ? 's' : ''} · {b.totalCents ? money(b.totalCents) : 'Free'}
        </p>
      </div>
      <div className="relative flex items-center justify-between gap-4 border-t border-dashed border-line-strong p-5 sm:flex-col sm:items-start sm:justify-center sm:border-l sm:border-t-0">
        <span className="absolute -top-2 left-[-8px] hidden h-4 w-4 rounded-full border border-line bg-ink sm:block" aria-hidden />
        <span className="absolute -bottom-2 left-[-8px] hidden h-4 w-4 rounded-full border border-line bg-ink sm:block" aria-hidden />
        <div className="tnum">
          <p className="text-[11px] tracking-[0.14em] text-volt">
            {weekday(e.startsAt, e.timezone).toUpperCase()} {monthAbbr(e.startsAt, e.timezone)}
          </p>
          <p className="font-display text-4xl font-medium leading-none tracking-tight">{dayNum(e.startsAt, e.timezone)}</p>
          <p className="mt-1 text-[12px] text-mute">{time(e.startsAt, e.timezone)}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-mute transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-volt" />
      </div>
    </Link>
  );
}
