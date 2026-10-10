import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, ExternalLink, EyeOff, Megaphone, Pencil, Search, Send, Trash2, Undo2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { EventDetail } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { InventoryBars, StatCard, Table, Td, Th } from '@/components/app/Dashboard';
import { Tabs } from '@/components/ui/Tabs';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge, lifecycleStatus } from '@/components/ui/Badge';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Cover } from '@/components/ui/Media';
import { useToast } from '@/components/ui/Toast';
import { dateTime, eventWhen, money, num, relative, where } from '@/lib/format';

type Tab = 'overview' | 'tickets' | 'registrations' | 'announcements';

export default function EventManage() {
  const { id = '', tab = 'overview' } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['events', 'detail', String(eventId)], queryFn: () => api.events.detail(eventId) });
  usePageCrumbs([{ label: 'Events', to: '/organizer/events' }, { label: q.data?.title ?? 'Event' }]);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <Skeleton className="mx-auto h-[600px] max-w-[1320px]" />;
  const e = q.data;
  if (!e.viewerIsOwner) return <ErrorState error={new ApiError(403, 'FORBIDDEN', 'Only the event’s organizer can manage it.')} />;

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-8 grid gap-6 lg:grid-cols-[220px_1fr]">
        <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="aspect-[16/10] rounded-md" />
        <div className="min-w-0">
          <PageHeader
            eyebrow={`${e.category.name} · ${where({ format: e.format, venueName: e.venue?.name ?? null, city: e.venue?.city ?? null })}`}
            title={e.title}
            description={eventWhen(e.startsAt, e.endsAt, e.timezone)}
            actions={<Actions e={e} />}
          />
          <div className="-mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={lifecycleStatus(e)} />
            <Link to={`/events/${e.slug}`} className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-bone">
              {e.status === 'PUBLISHED' ? 'View public page' : 'Preview page'} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {e.status === 'REJECTED' && e.rejectionReason ? (
        <div className="mb-6 rounded border border-signal-danger/30 bg-signal-danger/[0.06] p-4 text-sm">
          <p className="font-medium text-[#ff9c92]">Changes requested</p>
          <p className="mt-1 text-bone/80">{e.rejectionReason}</p>
        </div>
      ) : null}
      {e.status === 'CANCELLED' ? (
        <div className="mb-6 rounded border border-signal-danger/30 bg-signal-danger/[0.06] p-4 text-sm">
          <p className="font-medium text-[#ff9c92]">Cancelled</p>
          <p className="mt-1 text-bone/80">{e.cancelReason}</p>
        </div>
      ) : null}

      <Tabs<Tab>
        className="mb-8"
        value={tab as Tab}
        onChange={(v) => navigate(v === 'overview' ? `/organizer/events/${e.id}` : `/organizer/events/${e.id}/${v}`, { replace: true })}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'tickets', label: 'Tickets', count: e.ticketTypes.length },
          { value: 'registrations', label: 'Registrations', count: e.totalSold },
          { value: 'announcements', label: 'Announcements' },
        ]}
      />

      {tab === 'overview' ? <OverviewTab e={e} /> : null}
      {tab === 'tickets' ? <TicketsTab e={e} /> : null}
      {tab === 'registrations' ? <RegistrationsTab e={e} /> : null}
      {tab === 'announcements' ? <AnnouncementsTab e={e} /> : null}
    </div>
  );
}

function Actions({ e }: { e: EventDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const ended = new Date(e.endsAt) < new Date();

  const done = (title: string, d?: EventDetail) => {
    if (d) qc.setQueryData(['events', 'detail', String(e.id)], d);
    void qc.invalidateQueries({ queryKey: ['events'] });
    void qc.invalidateQueries({ queryKey: ['organizer'] });
    toast.success(title);
  };
  const fail = (err: unknown) => toast.error('Action failed', err instanceof ApiError ? err.message : undefined);

  const submit = useMutation({ mutationFn: () => api.events.submit(e.id), onSuccess: (d) => done(d.status === 'PUBLISHED' ? 'Published' : 'Submitted for review', d), onError: fail });
  const withdraw = useMutation({ mutationFn: () => api.events.withdraw(e.id), onSuccess: (d) => done('Submission withdrawn', d), onError: fail });
  const unpublish = useMutation({ mutationFn: () => api.events.unpublish(e.id), onSuccess: (d) => done('Moved back to draft', d), onError: fail });
  const cancel = useMutation({
    mutationFn: () => api.events.cancel(e.id, reason.trim()),
    onSuccess: (d) => {
      setCancelOpen(false);
      done('Event cancelled', d);
    },
    onError: (err) => (err instanceof ApiError && err.fieldErrors.length ? setReasonError(err.fieldErrors[0]!.message) : fail(err)),
  });
  const remove = useMutation({
    mutationFn: () => api.events.remove(e.id),
    onSuccess: () => {
      setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: ['organizer'] });
      toast.success('Draft deleted');
      navigate('/organizer/events', { replace: true });
    },
    onError: fail,
  });

  return (
    <>
      {(e.status === 'DRAFT' || e.status === 'REJECTED' || e.status === 'PUBLISHED') && !ended ? (
        <ButtonLink to={`/organizer/events/${e.id}/edit`} variant="secondary" icon={<Pencil className="h-4 w-4" />}>
          Edit
        </ButtonLink>
      ) : null}
      {(e.status === 'DRAFT' || e.status === 'REJECTED') && !ended ? (
        <Button icon={<Send className="h-4 w-4" />} loading={submit.isPending} onClick={() => submit.mutate()}>
          Submit for review
        </Button>
      ) : null}
      {e.status === 'PENDING' ? (
        <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
          Withdraw
        </Button>
      ) : null}
      {e.status === 'PUBLISHED' && !ended && e.totalSold === 0 ? (
        <Button variant="secondary" icon={<EyeOff className="h-4 w-4" />} loading={unpublish.isPending} onClick={() => unpublish.mutate()}>
          Unpublish
        </Button>
      ) : null}
      {(e.status === 'PUBLISHED' || e.status === 'PENDING') && !ended ? (
        <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>
          Cancel event
        </Button>
      ) : null}
      {e.status === 'DRAFT' || e.status === 'REJECTED' ? (
        <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)} aria-label="Delete draft" />
      ) : null}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this event?"
        description={
          e.totalSold > 0
            ? `${num(e.totalSold)} tickets will be cancelled and every attendee will be notified with your reason. This can’t be undone.`
            : 'The event will be marked as cancelled. This can’t be undone.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep event
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => {
                if (reason.trim().length < 10) return setReasonError('Give attendees a reason (at least 10 characters).');
                setReasonError(undefined);
                cancel.mutate();
              }}
            >
              Cancel event
            </Button>
          </>
        }
      >
        <Textarea label="Reason shown to attendees" required value={reason} onChange={(ev) => setReason(ev.target.value)} error={reasonError} rows={4} />
      </Modal>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this draft?"
        description="The draft and its ticket types will be removed permanently."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep draft
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

function OverviewTab({ e }: { e: EventDetail }) {
  const pct = e.totalCapacity ? Math.round((e.totalSold / e.totalCapacity) * 100) : 0;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-12">
        <StatCard label="Tickets sold" value={e.totalSold} accent sub={`${pct}% of ${num(e.totalCapacity)} capacity`} />
        <StatCard label="Remaining" value={Math.max(0, e.totalCapacity - e.totalSold)} sub={e.registrationState === 'SOLD_OUT' ? 'Sold out' : 'Across all ticket types'} />
        <StatCard label="Ticket types" value={e.ticketTypes.length} sub={e.minPriceCents ? `From ${money(e.minPriceCents)}` : 'Includes free tickets'} />
      </div>
      <Panel className="lg:col-span-7" title="Inventory">
        {e.ticketTypes.length ? (
          <InventoryBars rows={e.ticketTypes.map((t) => ({ key: String(t.id), label: t.name, sub: t.priceCents ? money(t.priceCents) : 'Free', sold: t.sold, quantity: t.quantity }))} />
        ) : (
          <p className="text-sm text-mute">No ticket types yet.</p>
        )}
      </Panel>
      <Panel className="lg:col-span-5" title="Review history">
        {e.approvalHistory.length ? (
          <ol className="space-y-4">
            {e.approvalHistory.map((h, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={h.decision} />
                  <span className="text-[12px] text-mute">{dateTime(h.createdAt)}</span>
                </div>
                {h.reason ? <p className="mt-1.5 text-bone/80">{h.reason}</p> : null}
                {h.adminName ? <p className="mt-1 text-[12px] text-mute">by {h.adminName}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-mute">{e.status === 'PENDING' ? 'Waiting for an administrator.' : 'Not reviewed yet.'}</p>
        )}
        <dl className="mt-6 space-y-2 border-t border-line pt-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-mute">Created</dt>
            <dd>{dateTime(e.createdAt)}</dd>
          </div>
          {e.submittedAt ? (
            <div className="flex justify-between">
              <dt className="text-mute">Submitted</dt>
              <dd>{dateTime(e.submittedAt)}</dd>
            </div>
          ) : null}
          {e.publishedAt ? (
            <div className="flex justify-between">
              <dt className="text-mute">Published</dt>
              <dd>{dateTime(e.publishedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </Panel>
    </div>
  );
}

function TicketsTab({ e }: { e: EventDetail }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-mute">Edit tickets from the event editor. Quantities can’t drop below what has been sold.</p>
        {e.status !== 'PENDING' && e.status !== 'CANCELLED' ? (
          <ButtonLink to={`/organizer/events/${e.id}/edit`} variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
            Edit tickets
          </ButtonLink>
        ) : null}
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Ticket</Th>
            <Th>Price</Th>
            <Th className="text-right">Sold</Th>
            <Th className="text-right">Remaining</Th>
            <Th>Sales window</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {e.ticketTypes.map((t) => (
            <tr key={t.id}>
              <Td>
                <p className="font-medium">{t.name}</p>
                <p className="text-[12px] text-mute">Max {t.maxPerOrder} per booking</p>
              </Td>
              <Td className="tnum">{t.priceCents ? money(t.priceCents) : 'Free'}</Td>
              <Td className="tnum text-right">
                {num(t.sold)} <span className="text-mute">/ {num(t.quantity)}</span>
              </Td>
              <Td className="tnum text-right">{num(t.remaining)}</Td>
              <Td className="text-[12.5px] text-mute">
                {t.salesStart ? dateTime(t.salesStart, e.timezone) : 'Now'} → {t.salesEnd ? dateTime(t.salesEnd, e.timezone) : 'event start'}
              </Td>
              <Td>
                <StatusBadge status={t.saleState === 'ON_SALE' ? 'AVAILABLE' : t.saleState === 'NOT_STARTED' ? 'PENDING' : t.saleState === 'ENDED' ? 'CLOSED' : 'SOLD_OUT'} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function RegistrationsTab({ e }: { e: EventDetail }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'CONFIRMED' | 'CANCELLED'>('');
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ['events', 'registrations', e.id, q, status, page], queryFn: () => api.events.registrations(e.id, { q, status, page, size: 20 }) });
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search attendees</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(ev) => {
              setQ(ev.target.value);
              setPage(0);
            }}
            placeholder="Search name, email or booking reference"
            className="h-10 w-full rounded border border-line bg-ink-850 pl-9 pr-3 text-[13.5px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none"
          />
        </label>
        <select
          value={status}
          onChange={(ev) => {
            setStatus(ev.target.value as typeof status);
            setPage(0);
          }}
          className="h-10 rounded border border-line bg-ink-850 px-3 text-[13.5px]"
          aria-label="Booking status"
        >
          <option value="">All bookings</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <a href={api.events.exportUrl(e.id)} className="inline-flex h-10 items-center gap-2 rounded border border-line-strong bg-ink-800 px-4 text-sm hover:bg-ink-700">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <SkeletonRows rows={6} />
      ) : list.data!.content.length === 0 ? (
        <EmptyState icon={<Users className="h-4 w-4" />} title={q || status ? 'No registrations match' : 'No registrations yet'} body={q || status ? undefined : 'Bookings will appear here as soon as people register.'} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Attendee</Th>
                <Th>Booking</Th>
                <Th>Tickets</Th>
                <Th className="text-right">Checked in</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Booked</Th>
              </tr>
            </thead>
            <tbody>
              {list.data!.content.map((r) => (
                <tr key={r.reference} className="hover:bg-white/[0.02]">
                  <Td>
                    <p className="font-medium">{r.attendeeName}</p>
                    <p className="text-[12px] text-mute">{r.attendeeEmail}</p>
                  </Td>
                  <Td className="font-mono text-[12px]">{r.reference}</Td>
                  <Td className="text-mute">{r.ticketSummary}</Td>
                  <Td className="tnum text-right">
                    {r.checkedIn}/{r.quantity}
                  </Td>
                  <Td className="tnum text-right">
                    {r.totalCents ? money(r.totalCents) : 'Free'}
                    {r.paymentStatus.startsWith('SIMULATED') ? <p className="text-[11px] text-signal-info">simulated</p> : null}
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-mute">{relative(r.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={list.data!.page} totalPages={list.data!.totalPages} totalElements={list.data!.totalElements} size={list.data!.size} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function AnnouncementsTab({ e }: { e: EventDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const list = useQuery({ queryKey: ['events', 'announcements', e.id], queryFn: () => api.events.announcements(e.id) });
  const preview = useQuery({ queryKey: ['events', 'announcement-preview', e.id], queryFn: () => api.events.announcementPreview(e.id), enabled: e.status === 'PUBLISHED' });
  const send = useMutation({
    mutationFn: () => api.events.announce(e.id, subject.trim(), message.trim()),
    onSuccess: (a) => {
      setConfirm(false);
      setSubject('');
      setMessage('');
      void qc.invalidateQueries({ queryKey: ['events', 'announcements', e.id] });
      toast.success('Announcement sent', `Delivered in-app to ${a.recipientCount} attendee${a.recipientCount === 1 ? '' : 's'}.`);
    },
    onError: (err) => {
      setConfirm(false);
      if (err instanceof ApiError) {
        setErrors(err.fieldMap());
        toast.error('Not sent', err.message);
      }
    },
  });

  const review = () => {
    const v: Record<string, string> = {};
    if (subject.trim().length < 3) v.subject = 'Add a subject (at least 3 characters).';
    if (message.trim().length < 10) v.message = 'Write a message (at least 10 characters).';
    setErrors(v);
    if (!Object.keys(v).length) setConfirm(true);
  };

  const recipients = preview.data?.recipientCount ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-6" title="New announcement" eyebrow="In-app delivery">
        {e.status !== 'PUBLISHED' ? (
          <p className="text-sm text-mute">Announcements can be sent once the event is published.</p>
        ) : (
          <div className="space-y-4">
            <Input label="Subject" value={subject} maxLength={160} onChange={(ev) => setSubject(ev.target.value)} error={errors.subject} />
            <Textarea label="Message" rows={6} maxLength={4000} value={message} onChange={(ev) => setMessage(ev.target.value)} error={errors.message} hint={`${message.length}/4000`} />
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] text-mute">
                {preview.isLoading ? 'Counting recipients…' : `${num(recipients)} attendee${recipients === 1 ? '' : 's'} will receive this`}
              </p>
              <Button icon={<Megaphone className="h-4 w-4" />} onClick={review} disabled={recipients === 0}>
                Review & send
              </Button>
            </div>
          </div>
        )}
      </Panel>
      <Panel className="lg:col-span-6" title="Sent" bodyClassName="p-0">
        {list.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-20" />
          </div>
        ) : list.data?.length ? (
          <ul className="divide-y divide-line">
            {list.data.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium">{a.subject}</p>
                  <span className="shrink-0 text-[12px] text-mute">{relative(a.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-[13.5px] text-mute">{a.message}</p>
                <p className="mt-2 text-[12px] text-mute-700">
                  Delivered in-app to {a.recipientCount} · by {a.senderName}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-mute">Nothing sent yet.</p>
        )}
      </Panel>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Send to ${num(recipients)} attendee${recipients === 1 ? '' : 's'}?`}
        description="They’ll see it in their AFTR notifications. No email is sent."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Edit
            </Button>
            <Button loading={send.isPending} onClick={() => send.mutate()}>
              Send announcement
            </Button>
          </>
        }
      >
        <div className="rounded border border-line bg-ink-850 p-4">
          <p className="text-[12px] text-mute">{e.title}</p>
          <p className="mt-1 font-medium">{subject}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-bone/80">{message}</p>
        </div>
      </Modal>
    </div>
  );
}
