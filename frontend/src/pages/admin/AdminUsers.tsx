import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, UserRoundCog, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AdminUser, Role } from '@/lib/types';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Table, Td, Th } from '@/components/app/Dashboard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Field';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Media';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { dateTime, num, relative, shortDate } from '@/lib/format';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', ORGANIZER: 'Organizer', ATTENDEE: 'Attendee' };

export default function AdminUsers() {
  usePageCrumbs([{ label: 'Users' }]);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(q);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const [sortField, direction] = sort.split(':');
  const list = useQuery({
    queryKey: ['users', debounced, role, status, sort, page],
    queryFn: () => api.users.list({ q: debounced, role, status, page, size: 20, sort: sortField, direction }),
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Users" description={list.data ? `${num(list.data.totalElements)} accounts match the current filters.` : 'Search, filter and manage accounts.'} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_190px]">
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or organization"
            className="h-10 w-full rounded border border-line bg-ink-850 pl-9 pr-3 text-[13.5px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none"
          />
        </label>
        <FilterSelect label="Role" value={role} onChange={(v) => { setRole(v); setPage(0); }} options={[['', 'All roles'], ['ATTENDEE', 'Attendees'], ['ORGANIZER', 'Organizers'], ['ADMIN', 'Admins']]} />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[['', 'Any status'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended']]} />
        <FilterSelect label="Sort" value={sort} onChange={setSort} options={[['createdAt:desc', 'Newest first'], ['createdAt:asc', 'Oldest first'], ['fullName:asc', 'Name A–Z'], ['lastLoginAt:desc', 'Recently active']]} />
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <SkeletonRows rows={8} />
      ) : !list.data!.content.length ? (
        <EmptyState icon={<Users className="h-4 w-4" />} title="No users match" body="Try a different search or clear the filters." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>Last active</Th>
                <Th className="text-right">Activity</Th>
              </tr>
            </thead>
            <tbody>
              {list.data!.content.map((u) => (
                <tr key={u.id} className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setSelected(u)}>
                  <Td>
                    <button className="flex items-center gap-3 text-left" onClick={() => setSelected(u)}>
                      <Avatar name={u.fullName} src={u.avatarUrl} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{u.fullName}</span>
                        <span className="block truncate text-[12px] text-mute">{u.email}</span>
                      </span>
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={u.role === 'ADMIN' ? 'volt' : u.role === 'ORGANIZER' ? 'info' : 'neutral'} dot={false}>
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={u.status} />
                  </Td>
                  <Td className="tnum whitespace-nowrap text-mute">{shortDate(u.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-mute">{u.lastLoginAt ? relative(u.lastLoginAt) : 'Never'}</Td>
                  <Td className="tnum text-right text-mute">{u.role === 'ORGANIZER' ? `${u.eventCount} events` : `${u.bookingCount} bookings`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={list.data!.page} totalPages={list.data!.totalPages} totalElements={list.data!.totalElements} size={list.data!.size} onChange={setPage} />
        </>
      )}
      {selected ? <UserDialog user={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded border border-line bg-ink-850 px-3 text-[13.5px] focus:border-volt/60 focus:outline-none">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: user.fullName, role: user.role, organizationName: user.organizationName ?? '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const self = me?.id === user.id;
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const fail = (e: unknown) => setErr(e instanceof ApiError ? e.message : 'Action failed.');

  const save = useMutation({
    mutationFn: () => api.users.update(user.id, { fullName: form.fullName.trim(), role: form.role, organizationName: form.organizationName.trim() || null }),
    onSuccess: () => {
      void refresh();
      toast.success('User updated');
      onClose();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: () => (user.status === 'ACTIVE' ? api.users.suspend(user.id) : api.users.reactivate(user.id)),
    onSuccess: (u) => {
      void refresh();
      toast.success(u.status === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated', u.status === 'SUSPENDED' ? 'Their active sessions stop working immediately.' : undefined);
      onClose();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.users.remove(user.id),
    onSuccess: () => {
      void refresh();
      toast.success('Account deleted');
      onClose();
    },
    onError: (e) => {
      setConfirmDelete(false);
      fail(e);
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={user.fullName}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {user.email} <StatusBadge status={user.status} />
          {user.seed ? <Badge tone="muted">Seed</Badge> : null}
        </span>
      }
      size="lg"
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-[13px] text-[#ff9c92]">Permanently delete this account?</span>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              No
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Yes, delete
            </Button>
          </>
        ) : (
          <>
            {!self ? (
              <Button variant="ghost" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
            {!self ? (
              <Button variant={user.status === 'ACTIVE' ? 'danger' : 'secondary'} loading={toggle.isPending} onClick={() => toggle.mutate()}>
                {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
              </Button>
            ) : null}
            <Button icon={<UserRoundCog className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate()}>
              Save changes
            </Button>
          </>
        )
      }
    >
      {err ? (
        <p role="alert" className="mb-4 rounded border border-signal-danger/40 bg-signal-danger/[0.07] px-3 py-2 text-sm text-[#ffb3ab]">
          {err}
        </p>
      ) : null}
      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Meta k="Joined" v={dateTime(user.createdAt)} />
        <Meta k="Last sign-in" v={user.lastLoginAt ? relative(user.lastLoginAt) : 'Never'} />
        <Meta k="Events" v={num(user.eventCount)} />
        <Meta k="Bookings" v={num(user.bookingCount)} />
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
        <Select label="Role" value={form.role} disabled={self} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} hint={self ? 'You can’t change your own role.' : 'Changes take effect on the user’s next request.'}>
          <option value="ATTENDEE">Attendee</option>
          <option value="ORGANIZER">Organizer</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Input label="Organization" optional wrapperClassName="sm:col-span-2" value={form.organizationName} onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))} />
      </div>
      <p className="mt-5 text-[12.5px] leading-relaxed text-mute">
        Accounts with events or bookings can’t be deleted — suspend them instead so history stays intact. Every change here is written to the activity log.
      </p>
    </Modal>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] text-mute">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
