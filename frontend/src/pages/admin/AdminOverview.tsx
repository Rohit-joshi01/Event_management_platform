import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { CountBars, InventoryBars, RegistrationsChart, RevenueCard, StatCard } from '@/components/app/Dashboard';
import { Panel } from '@/components/ui/Panel';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { dateTime, humanize, num, relative } from '@/lib/format';

const STATUS_ORDER = ['PUBLISHED', 'PENDING', 'DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const STATUS_LABEL: Record<string, string> = { PUBLISHED: 'Live', PENDING: 'In review', DRAFT: 'Draft', REJECTED: 'Changes requested', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export default function AdminOverview() {
  usePageCrumbs([{ label: 'Overview' }]);
  const a = useQuery({ queryKey: ['admin', 'analytics'], queryFn: api.admin.analytics });

  if (a.isError) return <ErrorState error={a.error} onRetry={() => a.refetch()} />;
  if (a.isLoading || !a.data) {
    return (
      <div className="mx-auto grid max-w-[1400px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }
  const d = a.data;
  const statusTotal = STATUS_ORDER.reduce((s, k) => s + (d.eventsByStatus[k] ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Platform operations"
        title="Overview"
        description="Live figures from users, events, bookings and the audit log."
        actions={
          d.pendingApprovals ? (
            <ButtonLink to="/admin/approvals" icon={<ShieldCheck className="h-4 w-4" />}>
              Review {d.pendingApprovals} pending
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={d.totalUsers} sub={`+${num(d.newUsersLast30Days)} in 30 days · ${num(d.usersByRole.ORGANIZER)} organizers`} />
        <StatCard label="Events" value={d.totalEvents} sub={`${num(d.eventsByStatus.PUBLISHED ?? 0)} live now`} />
        <StatCard label="Pending approvals" value={d.pendingApprovals} accent={d.pendingApprovals > 0} sub={d.pendingApprovals ? 'Waiting for a decision' : 'Queue is clear'} />
        <StatCard label="Registrations" value={d.totalRegistrations} sub={`${num(d.ticketsIssued)} active tickets`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Registration trend" eyebrow="Tickets issued per day · last 30 days">
          <RegistrationsChart data={d.registrationsByDay} height={260} />
        </Panel>
        <div className="grid gap-6 lg:col-span-4">
          <RevenueCard revenue={d.revenue} />
          <Panel title="Events by status">
            <InventoryBars rows={STATUS_ORDER.map((k) => ({ key: k, label: STATUS_LABEL[k]!, sold: d.eventsByStatus[k] ?? 0, quantity: statusTotal }))} />
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-4" title="Event activity" eyebrow="Events created per week">
          <CountBars data={d.eventsCreatedByWeek.map((w) => ({ label: new Date(w.week).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: w.count }))} unit="events" />
        </Panel>
        <Panel
          className="lg:col-span-4"
          title="Recent activity"
          bodyClassName="p-0"
          action={
            <Link to="/admin/activity" className="text-[13px] text-mute hover:text-bone">
              Full log
            </Link>
          }
        >
          <ul className="max-h-[340px] divide-y divide-line overflow-y-auto">
            {d.recentActivity.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <p className="text-[13px] leading-snug">{l.summary}</p>
                <p className="mt-1 text-[11.5px] text-mute">
                  {humanize(l.action)} · {l.actorEmail ?? 'system'} · {relative(l.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="lg:col-span-4" title="Upcoming events" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {d.upcomingEvents.map((e) => (
              <li key={e.id}>
                <Link to={`/events/${e.slug}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px]">{e.title}</p>
                    <p className="text-[11.5px] text-mute">
                      {dateTime(e.startsAt, e.timezone)} · {e.organizerName}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-mute" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
