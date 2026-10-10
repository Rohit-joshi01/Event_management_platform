import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Minus, Plus, Ticket } from 'lucide-react';
import type { Booking, EventDetail } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { dateTime, money, num } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATE_COPY: Record<string, { title: string; tone: 'muted' | 'danger' | 'warn' }> = {
  SOLD_OUT: { title: 'Sold out', tone: 'danger' },
  CLOSED: { title: 'Registration closed', tone: 'muted' },
  ENDED: { title: 'This event has ended', tone: 'muted' },
  CANCELLED: { title: 'Event cancelled', tone: 'danger' },
  NOT_YET_OPEN: { title: 'Tickets not on sale yet', tone: 'warn' },
  UNAVAILABLE: { title: 'Not published', tone: 'warn' },
};

export function TicketPanel({ event }: { event: EventDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => Object.entries(qty).filter(([, q]) => q > 0).map(([id, q]) => ({ ticketTypeId: Number(id), quantity: q })), [qty]);
  const total = items.reduce((s, i) => s + (event.ticketTypes.find((t) => t.id === i.ticketTypeId)?.priceCents ?? 0) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const purchase = useMutation({
    mutationFn: () => api.registrations.create(event.id, items),
    onSuccess: (b) => {
      setBooking(b);
      setConfirmOpen(false);
      setQty({});
      setError(null);
      toast.success('You’re in', `Booking ${b.reference} confirmed.`);
      void qc.invalidateQueries({ queryKey: ['events'] });
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => {
      setConfirmOpen(false);
      const msg = e instanceof ApiError ? e.message : 'Booking failed.';
      setError(msg);
      if (e instanceof ApiError && (e.code === 'SOLD_OUT' || e.code === 'ALREADY_REGISTERED')) {
        void qc.invalidateQueries({ queryKey: ['events', 'detail'] });
      }
    },
  });

  const start = () => {
    setError(null);
    if (!user) {
      navigate(`/sign-in?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setConfirmOpen(true);
  };

  if (booking) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-volt/40 bg-ink-800 p-6">
        <CheckCircle2 className="h-6 w-6 text-volt" />
        <p className="mt-4 font-display text-2xl font-medium tracking-tight">You’re going.</p>
        <p className="mt-2 text-sm text-mute">
          Booking <span className="font-mono text-bone">{booking.reference}</span> · {booking.tickets.length} ticket{booking.tickets.length > 1 ? 's' : ''}
          {booking.paymentSimulated ? ' · development checkout (no payment taken)' : ''}
        </p>
        <ButtonLink to={`/account/tickets/${booking.reference}`} className="mt-6 w-full" size="lg">
          View QR tickets
        </ButtonLink>
      </motion.div>
    );
  }

  if (event.viewerBookingReference) {
    return (
      <div className="rounded-md border border-line bg-ink-800 p-6">
        <p className="eyebrow mb-3 text-volt">You have tickets</p>
        <p className="text-sm text-mute">
          Booking <span className="font-mono text-bone">{event.viewerBookingReference}</span> is confirmed for this event.
        </p>
        <ButtonLink to={`/account/tickets/${event.viewerBookingReference}`} className="mt-5 w-full" size="lg" icon={<Ticket className="h-4 w-4" />}>
          View my tickets
        </ButtonLink>
      </div>
    );
  }

  const state = event.registrationState;
  const closedCopy = STATE_COPY[state];
  const nonAttendee = user && user.role !== 'ATTENDEE';

  return (
    <div className="overflow-hidden rounded-md border border-line bg-ink-800">
      <div className="flex items-baseline justify-between border-b border-line px-6 py-4">
        <p className="eyebrow">Tickets</p>
        <p className="tnum text-[12.5px] text-mute">
          {event.totalCapacity ? `${num(Math.max(event.totalCapacity - event.totalSold, 0))} of ${num(event.totalCapacity)} left` : null}
        </p>
      </div>

      {closedCopy ? (
        <div className={cn('flex gap-3 border-b border-line px-6 py-4 text-sm', closedCopy.tone === 'danger' ? 'bg-signal-danger/[0.06]' : 'bg-ink-850')}>
          <Info className={cn('mt-0.5 h-4 w-4 shrink-0', closedCopy.tone === 'danger' ? 'text-signal-danger' : closedCopy.tone === 'warn' ? 'text-signal-warn' : 'text-mute')} />
          <div>
            <p className="font-medium">{closedCopy.title}</p>
            {event.registrationMessage ? <p className="mt-0.5 text-mute">{event.registrationMessage}</p> : null}
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-line">
        {event.ticketTypes.map((t) => {
          const q = qty[t.id] ?? 0;
          const max = Math.min(t.maxPerOrder, t.remaining);
          const selectable = state === 'OPEN' && t.onSale && !nonAttendee;
          return (
            <li key={t.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  {t.description ? <p className="mt-0.5 text-[13px] leading-snug text-mute">{t.description}</p> : null}
                  <p className="mt-1.5 text-[12px] text-mute">
                    {t.saleState === 'SOLD_OUT' ? (
                      <span className="text-[#ff9c92]">Sold out</span>
                    ) : t.saleState === 'NOT_STARTED' && t.salesStart ? (
                      <>On sale {dateTime(t.salesStart, event.timezone)}</>
                    ) : t.saleState === 'ENDED' ? (
                      'Sales ended'
                    ) : t.remaining <= Math.max(5, t.quantity * 0.1) ? (
                      <span className="text-signal-warn">Only {t.remaining} left</span>
                    ) : t.salesEnd ? (
                      <>Sales end {dateTime(t.salesEnd, event.timezone)}</>
                    ) : (
                      `Max ${t.maxPerOrder} per booking`
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="tnum font-display text-lg">{t.priceCents ? money(t.priceCents) : 'Free'}</p>
                  {selectable ? (
                    <div className="flex items-center rounded border border-line">
                      <button
                        className="flex h-8 w-8 items-center justify-center text-mute hover:text-bone disabled:opacity-30"
                        onClick={() => setQty((s) => ({ ...s, [t.id]: Math.max(0, q - 1) }))}
                        disabled={q === 0}
                        aria-label={`Fewer ${t.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="tnum w-6 text-center text-sm" aria-live="polite" aria-label={`${q} ${t.name} selected`}>
                        {q}
                      </span>
                      <button
                        className="flex h-8 w-8 items-center justify-center text-mute hover:text-bone disabled:opacity-30"
                        onClick={() => setQty((s) => ({ ...s, [t.id]: Math.min(max, q + 1) }))}
                        disabled={q >= max || count >= 10}
                        aria-label={`More ${t.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line bg-ink-850 px-6 py-5">
        <AnimatePresence>
          {error ? (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="mb-4 flex gap-2 text-[13px] text-[#ff9c92]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {nonAttendee ? (
          <p className="text-[13px] leading-relaxed text-mute">
            You’re signed in as {user!.role === 'ADMIN' ? 'an administrator' : 'an organizer'}. Tickets can only be booked from an attendee account.
          </p>
        ) : state === 'OPEN' ? (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm text-mute">{count ? `${count} ticket${count > 1 ? 's' : ''}` : 'Select tickets'}</span>
              <span className="tnum font-display text-2xl">{money(total)}</span>
            </div>
            <Button size="lg" className="w-full" disabled={count === 0} onClick={start}>
              {user ? (total > 0 ? 'Continue to checkout' : 'Register') : 'Sign in to book'}
            </Button>
          </>
        ) : (
          <ButtonLink to="/events" variant="secondary" size="lg" className="w-full">
            Find something similar
          </ButtonLink>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !purchase.isPending && setConfirmOpen(false)}
        title={total > 0 ? 'Confirm your booking' : 'Confirm registration'}
        description={event.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={purchase.isPending}>
              Back
            </Button>
            <Button onClick={() => purchase.mutate()} loading={purchase.isPending} data-autofocus>
              {total > 0 ? `Confirm · ${money(total)}` : 'Confirm registration'}
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-sm">
          {items.map((i) => {
            const t = event.ticketTypes.find((x) => x.id === i.ticketTypeId)!;
            return (
              <li key={i.ticketTypeId} className="flex justify-between">
                <span>
                  {i.quantity} × {t.name}
                </span>
                <span className="tnum">{t.priceCents ? money(t.priceCents * i.quantity) : 'Free'}</span>
              </li>
            );
          })}
          <li className="flex justify-between border-t border-line pt-2 font-medium">
            <span>Total</span>
            <span className="tnum">{money(total)}</span>
          </li>
        </ul>
        {total > 0 ? (
          <div className="mt-5 flex gap-3 rounded border border-signal-info/30 bg-signal-info/[0.06] p-4 text-[13px] leading-relaxed text-bone/85">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-signal-info" />
            <p>
              <strong className="font-medium">Development checkout.</strong> No payment provider is connected to this deployment, so no money will be
              charged. Your booking will be recorded as a <em>simulated</em> payment and never reported as real revenue.
            </p>
          </div>
        ) : null}
        <p className="mt-4 text-[12.5px] text-mute">
          Signed in as {user?.email}. You can cancel from <Link to="/account/tickets" className="underline">My tickets</Link> until the event starts.
        </p>
      </Modal>
    </div>
  );
}
