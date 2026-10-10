import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Megaphone, ShieldAlert, Ticket, CalendarCheck2, CalendarX2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Toggle } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { dateTime, relative } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/cn';

const ICONS: Record<string, typeof Bell> = {
  ANNOUNCEMENT: Megaphone,
  BOOKING_CONFIRMED: Ticket,
  BOOKING_CANCELLED: CalendarX2,
  EVENT_CANCELLED: CalendarX2,
  EVENT_APPROVED: CalendarCheck2,
  EVENT_REJECTED: ShieldAlert,
  SECURITY: ShieldAlert,
  RECOMMENDATION: Sparkles,
};

export default function Notifications() {
  usePageCrumbs([{ label: 'Notifications' }]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const q = useQuery({ queryKey: ['notifications', 'list', filter, page], queryFn: () => api.notifications.list(filter === 'unread', page, 20) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const mark = useMutation({ mutationFn: ({ id, read }: { id: number; read: boolean }) => api.notifications.mark(id, read), onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: api.notifications.readAll,
    onSuccess: (r) => {
      void invalidate();
      toast.success(r.updated ? `Marked ${r.updated} as read` : 'Nothing unread');
    },
  });
  const prefs = useMutation({
    mutationFn: (patch: Partial<Pick<NonNullable<typeof user>, 'notifyAnnouncements' | 'notifyReminders' | 'notifyRecommendations'>>) =>
      api.me.update({
        fullName: user!.fullName,
        bio: user!.bio,
        avatarUrl: user!.avatarUrl ?? '',
        organizationName: user!.organizationName,
        city: user!.city,
        notifyAnnouncements: user!.notifyAnnouncements,
        notifyReminders: user!.notifyReminders,
        notifyRecommendations: user!.notifyRecommendations,
        ...patch,
      }),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Preferences saved');
    },
    onError: () => toast.error('Couldn’t save preferences'),
  });

  const open = (n: Notification) => {
    if (!n.read) mark.mutate({ id: n.id, read: true });
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <PageHeader
          title="Notifications"
          description="Booking confirmations, organizer announcements and account activity. Delivered in-app — this deployment doesn’t send email."
          actions={
            <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} loading={readAll.isPending} onClick={() => readAll.mutate()}>
              Mark all read
            </Button>
          }
        />
        <Tabs
          className="mb-2"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(0);
          }}
          items={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ]}
        />
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <SkeletonRows rows={6} />
        ) : q.data!.content.length === 0 ? (
          <EmptyState className="mt-6" icon={<Bell className="h-4 w-4" />} title={filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {q.data!.content.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id} className="group flex gap-4 py-5">
                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', n.read ? 'border-line text-mute' : 'border-volt/40 text-volt')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                      <p className={cn('text-[14.5px] leading-snug', n.read ? 'text-bone/70' : 'font-medium text-bone')}>{n.title}</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-mute">{n.body}</p>
                      <p className="mt-2 text-[12px] text-mute-700" title={dateTime(n.createdAt)}>
                        {relative(n.createdAt)}
                      </p>
                    </button>
                    <button
                      onClick={() => mark.mutate({ id: n.id, read: !n.read })}
                      className="h-8 shrink-0 self-start rounded px-2 text-[12px] text-mute opacity-100 hover:bg-white/5 hover:text-bone sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      Mark {n.read ? 'unread' : 'read'}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination page={q.data!.page} totalPages={q.data!.totalPages} totalElements={q.data!.totalElements} size={q.data!.size} onChange={setPage} />
          </>
        )}
      </div>
      <aside className="lg:col-span-4 lg:pt-[108px]">
        <div className="rounded-md border border-line bg-ink-800 p-5">
          <p className="eyebrow mb-5">Preferences</p>
          {user ? (
            <div className="space-y-5">
              <Toggle
                label="Organizer announcements"
                description="Updates from organizers of events you’ve booked."
                checked={user.notifyAnnouncements}
                disabled={prefs.isPending}
                onChange={(v) => prefs.mutate({ notifyAnnouncements: v })}
              />
              <Toggle label="Event reminders" description="A heads-up before events you’re attending." checked={user.notifyReminders} disabled={prefs.isPending} onChange={(v) => prefs.mutate({ notifyReminders: v })} />
              <Toggle
                label="Suggestions"
                description="Occasional picks based on what you book."
                checked={user.notifyRecommendations}
                disabled={prefs.isPending}
                onChange={(v) => prefs.mutate({ notifyRecommendations: v })}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
