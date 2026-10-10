import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Inbox, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { EventSummary } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/Badge';
import { Cover } from '@/components/ui/Media';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { useToast } from '@/components/ui/Toast';
import { dateTime, eventWhen, money, relative, where } from '@/lib/format';

export default function Approvals() {
  usePageCrumbs([{ label: 'Approvals' }]);
  const [tab, setTab] = useState<'queue' | 'history'>('queue');
  const queue = useQuery({ queryKey: ['admin', 'events', 'PENDING'], queryFn: () => api.admin.events({ status: 'PENDING', size: 50 }) });
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected ?? queue.data?.content[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Event approvals" description="Review submissions before they go live. Rejections need a reason, which is sent to the organizer and kept in the audit log." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'queue', label: 'Queue', count: queue.data?.totalElements },
          { value: 'history', label: 'Decision history' },
        ]}
      />
      {tab === 'history' ? (
        <History />
      ) : queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.isLoading ? (
        <SkeletonRows rows={4} />
      ) : !queue.data?.content.length ? (
        <EmptyState icon={<Inbox className="h-4 w-4" />} title="The queue is clear" body="New submissions will appear here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <ul className="space-y-2 lg:col-span-4">
            {queue.data.content.map((e) => (
              <li key={e.id}>
                <QueueItem e={e} active={e.id === current} onClick={() => setSelected(e.id)} />
              </li>
            ))}
          </ul>
          <div className="lg:col-span-8">{current ? <Review id={current} onDecided={() => setSelected(null)} /> : null}</div>
        </div>
      )}
    </div>
  );
}

function QueueItem({ e, active, onClick }: { e: EventSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className={`flex w-full gap-3 rounded-md border p-3 text-left transition-colors ${active ? 'border-volt/50 bg-ink-800' : 'border-line hover:border-line-strong'}`}
    >
      <Cover src={e.coverImageUrl} alt="" category={e.category.slug} className="h-14 w-20 shrink-0 rounded-sm" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium">{e.title}</p>
        <p className="truncate text-[12px] text-mute">{e.organizerName}</p>
        <p className="mt-1 text-[11.5px] text-mute-700">Submitted {e.submittedAt ? relative(e.submittedAt) : '—'}</p>
      </div>
    </button>
  );
}

function Review({ id, onDecided }: { id: number; onDecided: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const q = useQuery({ queryKey: ['events', 'detail', String(id)], queryFn: () => api.events.detail(id) });

  const after = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    void qc.invalidateQueries({ queryKey: ['events'] });
    toast.success(msg);
    onDecided();
  };
  const approve = useMutation({ mutationFn: () => api.events.approve(id), onSuccess: () => after('Approved — the event is live'), onError: (e) => toast.error('Couldn’t approve', e instanceof ApiError ? e.message : undefined) });
  const reject = useMutation({
    mutationFn: () => api.events.reject(id, reason.trim()),
    onSuccess: () => {
      setRejectOpen(false);
      setReason('');
      after('Rejected — the organizer has been notified');
    },
    onError: (e) => (e instanceof ApiError && e.fieldErrors.length ? setReasonError(e.fieldErrors[0]!.message) : toast.error('Couldn’t reject', e instanceof ApiError ? e.message : undefined)),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <Skeleton className="h-[520px]" />;
  const e = q.data;

  return (
    <article className="overflow-hidden rounded-md border border-line bg-ink-800">
      <Cover src={e.coverImageUrl} alt={e.title} category={e.category.slug} className="aspect-[21/9]" />
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={e.status} />
          <span className="text-[12px] uppercase tracking-[0.12em] text-mute">{e.category.name}</span>
        </div>
        <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight">{e.title}</h2>
        <p className="mt-2 text-mute">{e.summary}</p>
        <dl className="mt-6 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-mute">When</dt>
            <dd className="mt-0.5">{eventWhen(e.startsAt, e.endsAt, e.timezone)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-mute">Where</dt>
            <dd className="mt-0.5">
              {where({ format: e.format, venueName: e.venue?.name ?? null, city: e.venue?.city ?? null })}
              {e.onlineUrl ? <span className="block break-all text-mute">{e.onlineUrl}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-mute">Organizer</dt>
            <dd className="mt-0.5">{e.organizer.organizationName ?? e.organizer.name}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-mute">Submitted</dt>
            <dd className="mt-0.5">{e.submittedAt ? dateTime(e.submittedAt) : '—'}</dd>
          </div>
        </dl>
        <div className="mt-6 space-y-3 text-[14.5px] leading-relaxed text-bone/80">
          {e.description.split(/\n\s*\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {e.schedule.length ? (
          <div className="mt-6">
            <p className="eyebrow mb-2">Schedule</p>
            <ul className="space-y-1 text-sm">
              {e.schedule.map((s) => (
                <li key={s.id}>
                  <span className="tnum text-mute">{dateTime(s.startsAt, e.timezone)}</span> — {s.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6">
          <p className="eyebrow mb-2">Tickets</p>
          <ul className="divide-y divide-line rounded border border-line">
            {e.ticketTypes.map((t) => (
              <li key={t.id} className="flex justify-between px-4 py-2.5 text-sm">
                <span>
                  {t.name} <span className="text-mute">· {t.quantity} available · max {t.maxPerOrder}</span>
                </span>
                <span className="tnum">{t.priceCents ? money(t.priceCents) : 'Free'}</span>
              </li>
            ))}
          </ul>
        </div>
        {e.approvalHistory.length ? (
          <div className="mt-6 rounded border border-line bg-ink-850 p-4 text-[13px]">
            <p className="eyebrow mb-2">Previous decisions</p>
            {e.approvalHistory.map((h, i) => (
              <p key={i} className="text-mute">
                {h.decision === 'REJECTED' ? 'Rejected' : 'Approved'} {dateTime(h.createdAt)} {h.reason ? `— ${h.reason}` : ''}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink-850 px-6 py-4">
        <Link to={`/events/${e.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-bone">
          Open full preview <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <div className="flex gap-2">
          <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setRejectOpen(true)} disabled={approve.isPending}>
            Reject
          </Button>
          <Button icon={<Check className="h-4 w-4" />} loading={approve.isPending} onClick={() => approve.mutate()}>
            Approve & publish
          </Button>
        </div>
      </div>
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject submission"
        description="Explain what needs to change. The organizer sees this note and can resubmit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              onClick={() => {
                if (reason.trim().length < 10) return setReasonError('Explain the decision in at least 10 characters.');
                setReasonError(undefined);
                reject.mutate();
              }}
            >
              Reject with reason
            </Button>
          </>
        }
      >
        <Textarea label="Reason" required rows={5} value={reason} onChange={(ev) => setReason(ev.target.value)} error={reasonError} maxLength={1000} />
      </Modal>
    </article>
  );
}

function History() {
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['admin', 'approvals', page], queryFn: () => api.admin.approvals(page, 20) });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <SkeletonRows rows={6} />;
  if (!q.data!.content.length) return <EmptyState title="No decisions yet" />;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Event</Th>
            <Th>Decision</Th>
            <Th>Reason</Th>
            <Th>By</Th>
            <Th>When</Th>
          </tr>
        </thead>
        <tbody>
          {q.data!.content.map((r) => (
            <tr key={r.id}>
              <Td>
                <Link to={`/events/${r.eventSlug}`} className="hover:text-volt">
                  {r.eventTitle}
                </Link>
              </Td>
              <Td>
                <StatusBadge status={r.decision} />
              </Td>
              <Td className="max-w-[360px] text-mute">{r.reason ?? '—'}</Td>
              <Td className="text-mute">{r.adminName}</Td>
              <Td className="whitespace-nowrap text-mute">{dateTime(r.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={q.data!.page} totalPages={q.data!.totalPages} totalElements={q.data!.totalElements} size={q.data!.size} onChange={setPage} />
    </>
  );
}
