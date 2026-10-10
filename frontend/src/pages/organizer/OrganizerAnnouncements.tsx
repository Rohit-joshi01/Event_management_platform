import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { dateTime } from '@/lib/format';

export default function OrganizerAnnouncements() {
  usePageCrumbs([{ label: 'Announcements' }]);
  const q = useQuery({ queryKey: ['organizer', 'announcements'], queryFn: api.organizer.announcements });
  const events = useQuery({ queryKey: ['organizer', 'events', 'LIVE', '', 0], queryFn: () => api.organizer.events({ status: 'LIVE', size: 50 }) });

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title="Announcements" description="Messages you’ve sent to registered attendees. They’re delivered as in-app notifications — no email is sent." />
      {events.data?.content.length ? (
        <div className="mb-8 rounded-md border border-line bg-ink-800 p-5">
          <p className="eyebrow mb-3">Write to attendees of</p>
          <div className="flex flex-wrap gap-2">
            {events.data.content.map((e) => (
              <Link key={e.id} to={`/organizer/events/${e.id}/announcements`} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] text-bone/85 hover:border-volt hover:text-volt">
                {e.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Megaphone className="h-4 w-4" />} title="No announcements yet" body="Open a live event and use the Announcements tab to message its attendees." />
      ) : (
        <ol className="relative border-l border-line">
          {q.data.map((a) => (
            <li key={a.id} className="relative pb-10 pl-8 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full border border-volt bg-ink" />
              <p className="tnum text-[12px] text-mute">{dateTime(a.createdAt)}</p>
              <Link to={`/organizer/events/${a.eventId}/announcements`} className="mt-1 block text-[13px] text-volt hover:underline">
                {a.eventTitle}
              </Link>
              <p className="mt-2 font-display text-lg font-medium tracking-tight">{a.subject}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-bone/75">{a.message}</p>
              <p className="mt-2 text-[12px] text-mute-700">Delivered in-app to {a.recipientCount} attendee{a.recipientCount === 1 ? '' : 's'}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
