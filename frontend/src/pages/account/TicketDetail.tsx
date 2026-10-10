import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, Printer, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { dateTime, eventWhen, money, where } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function TicketDetail() {
  const { reference = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ['bookings', 'detail', reference], queryFn: () => api.bookings.get(reference) });
  usePageCrumbs([{ label: 'My tickets', to: '/account/tickets' }, { label: reference }], q.data?.event.title);

  const cancel = useMutation({
    mutationFn: () => api.bookings.cancel(reference),
    onSuccess: (b) => {
      qc.setQueryData(['bookings', 'detail', reference], b);
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      setConfirm(false);
      toast.success('Booking cancelled', 'Your seats were released.');
    },
    onError: (e) => {
      setConfirm(false);
      toast.error('Couldn’t cancel', e instanceof ApiError ? e.message : undefined);
    },
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <Skeleton className="mx-auto h-[520px] max-w-[1080px]" />;
  const b = q.data;
  const e = b.event;

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        eyebrow={`Booking ${b.reference}`}
        title={e.title}
        description={`${eventWhen(e.startsAt, e.endsAt, e.timezone)} · ${where(e)}`}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} className="print:hidden">
              Print tickets
            </Button>
            {b.cancellable ? (
              <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm(true)} className="print:hidden">
                Cancel booking
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-2 print:hidden">
        <StatusBadge status={b.status} />
        <StatusBadge status={b.paymentStatus} />
        {b.seed ? <Badge tone="muted">Demo data</Badge> : null}
        <Link to={`/events/${e.slug}`} className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-bone">
          Event page <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {b.paymentSimulated ? (
        <p className="mb-6 rounded border border-signal-info/30 bg-signal-info/[0.05] px-4 py-3 text-[13px] text-bone/80 print:hidden">
          This booking used the development checkout. No payment was taken — the {money(b.totalCents)} total is recorded as simulated.
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {b.tickets.map((t, i) => {
          const usable = t.status === 'VALID' && b.status === 'CONFIRMED';
          return (
            <article key={t.id} className={cn('overflow-hidden rounded-md border bg-bone text-ink print:break-inside-avoid', usable ? 'border-transparent' : 'border-line opacity-60')}>
              <div className="flex items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">
                    Ticket {i + 1} of {b.tickets.length}
                  </p>
                  <p className="mt-2 font-display text-xl font-medium leading-tight tracking-tight">{t.ticketTypeName}</p>
                  <p className="mt-1 text-[13px] text-ink/60">{t.priceCents ? money(t.priceCents) : 'Free'}</p>
                </div>
                <span
                  className={cn(
                    'rounded-sm px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]',
                    t.status === 'VALID' ? 'bg-ink text-volt' : t.status === 'CHECKED_IN' ? 'bg-ink/10 text-ink' : 'bg-[#f2695c]/15 text-[#a3271c]',
                  )}
                >
                  {t.status === 'VALID' ? 'Valid' : t.status === 'CHECKED_IN' ? 'Used' : 'Cancelled'}
                </span>
              </div>
              <div className="relative border-t border-dashed border-ink/25">
                <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-ink" aria-hidden />
                <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-ink" aria-hidden />
              </div>
              <div className="flex items-center gap-6 p-6">
                <div className="rounded bg-white p-2">
                  {usable ? (
                    <QRCodeSVG value={t.code} size={132} level="M" bgColor="#ffffff" fgColor="#0A0A0A" aria-label={`QR code for ticket ${i + 1}`} />
                  ) : (
                    <div className="flex h-[132px] w-[132px] items-center justify-center text-center text-[12px] text-ink/50">{t.status === 'CHECKED_IN' ? 'Already used' : 'Not valid'}</div>
                  )}
                </div>
                <div className="min-w-0 text-[12.5px] text-ink/70">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ink/45">Ticket code</p>
                  <p className="mt-1 break-all font-mono text-[11.5px] text-ink">{t.code}</p>
                  {t.checkedInAt ? <p className="mt-3">Checked in {dateTime(t.checkedInAt, e.timezone)}</p> : <p className="mt-3">Show this code at the entrance.</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-[12.5px] text-mute">
        Booked {dateTime(b.createdAt)} · Total {b.totalCents ? money(b.totalCents) : 'Free'}
        {b.cancelledAt ? ` · Cancelled ${dateTime(b.cancelledAt)}` : ''}
      </p>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Cancel this booking?"
        description="All tickets in this booking will stop working and the seats go back on sale. This can’t be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep booking
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel booking
            </Button>
          </>
        }
      />
    </div>
  );
}
