import type * as T from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Error raised for any non-2xx response, carrying the backend's structured error body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: T.FieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: T.FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  fieldMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const f of this.fieldErrors) if (!map[f.field]) map[f.field] = f.message;
    return map;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

let csrfPromise: Promise<void> | null = null;

/** Ensures the XSRF-TOKEN cookie exists before the first state-changing request. */
async function ensureCsrf() {
  if (readCookie('XSRF-TOKEN')) return;
  if (!csrfPromise) {
    csrfPromise = fetch(`${BASE}/api/v1/auth/csrf`, { credentials: 'include' })
      .then(() => undefined)
      .finally(() => {
        csrfPromise = null;
      });
  }
  await csrfPromise;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<R>(method: string, path: string, body?: unknown, query?: Query, retried = false): Promise<R> {
  const mutating = method !== 'GET';
  if (mutating) await ensureCsrf();
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const xsrf = readCookie('XSRF-TOKEN');
  if (mutating && xsrf) headers['X-XSRF-TOKEN'] = xsrf;

  let res: Response;
  try {
    res = await fetch(BASE + withQuery(path, query), {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the AFTR server. Check that the backend is running and try again.');
  }

  if (res.status === 204) return undefined as R;
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = (data ?? {}) as Partial<T.ErrorBody>;
    // A stale CSRF token (e.g. after logout/login) is refreshed once transparently.
    if (res.status === 403 && mutating && !retried && /session token/i.test(err.message ?? '')) {
      document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
      return request<R>(method, path, body, query, true);
    }
    throw new ApiError(
      res.status,
      err.code ?? `HTTP_${res.status}`,
      err.message ?? (res.status >= 500 ? 'Something went wrong on our side.' : 'Request failed.'),
      err.fieldErrors ?? [],
    );
  }
  return data as R;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const get = <R>(path: string, query?: Query) => request<R>('GET', path, undefined, query);
const post = <R>(path: string, body?: unknown) => request<R>('POST', path, body ?? {});
const put = <R>(path: string, body: unknown) => request<R>('PUT', path, body);
const patch = <R>(path: string, body: unknown) => request<R>('PATCH', path, body);
const del = <R = void>(path: string) => request<R>('DELETE', path);

export interface EventSearch {
  q?: string;
  category?: string;
  city?: string;
  from?: string;
  to?: string;
  price?: 'free' | 'paid' | '';
  format?: string;
  featured?: boolean;
  sort?: 'date' | 'popular' | 'newest' | 'price';
  page?: number;
  size?: number;
}

export const api = {
  auth: {
    session: () => get<T.SessionResponse>('/api/v1/auth/session'),
    login: (email: string, password: string) => post<T.SessionResponse>('/api/v1/auth/login', { email, password }),
    register: (body: { fullName: string; email: string; password: string; role: 'ATTENDEE' | 'ORGANIZER'; organizationName?: string }) =>
      post<T.SessionResponse>('/api/v1/auth/register', body),
    logout: () => post<void>('/api/v1/auth/logout'),
  },
  me: {
    get: () => get<T.User>('/api/v1/me'),
    update: (body: Partial<T.User>) => put<T.User>('/api/v1/me', body),
    changePassword: (currentPassword: string, newPassword: string) =>
      post<void>('/api/v1/me/password', { currentPassword, newPassword }),
    changeEmail: (newEmail: string, currentPassword: string) => post<T.User>('/api/v1/me/email', { newEmail, currentPassword }),
    recommendations: (limit = 6) => get<T.EventSummary[]>('/api/v1/me/recommendations', { limit }),
  },
  settings: {
    public: () => get<T.PublicSettings>('/api/v1/settings/public'),
  },
  events: {
    search: (q: EventSearch) => get<T.Page<T.EventSummary>>('/api/v1/events', q as Query),
    meta: () => get<T.EventMeta>('/api/v1/events/meta/filters'),
    categories: () => get<T.Category[]>('/api/v1/categories'),
    detail: (idOrSlug: string | number) => get<T.EventDetail>(`/api/v1/events/${encodeURIComponent(String(idOrSlug))}`),
    related: (id: number) => get<T.EventSummary[]>(`/api/v1/events/${id}/related`),
    create: (body: T.EventUpsert) => post<T.EventDetail>('/api/v1/events', body),
    update: (id: number, body: T.EventUpsert) => put<T.EventDetail>(`/api/v1/events/${id}`, body),
    submit: (id: number) => post<T.EventDetail>(`/api/v1/events/${id}/submit`),
    withdraw: (id: number) => post<T.EventDetail>(`/api/v1/events/${id}/withdraw`),
    unpublish: (id: number) => post<T.EventDetail>(`/api/v1/events/${id}/unpublish`),
    cancel: (id: number, reason: string) => post<T.EventDetail>(`/api/v1/events/${id}/cancel`, { reason }),
    remove: (id: number) => del(`/api/v1/events/${id}`),
    approve: (id: number) => post<T.EventDetail>(`/api/v1/events/${id}/approve`),
    reject: (id: number, reason: string) => post<T.EventDetail>(`/api/v1/events/${id}/reject`, { reason }),
    tickets: (id: number) => get<T.TicketType[]>(`/api/v1/events/${id}/tickets`),
    createTicket: (id: number, body: T.TicketTypeUpsert) => post<T.TicketType>(`/api/v1/events/${id}/tickets`, body),
    updateTicket: (id: number, ticketId: number, body: T.TicketTypeUpsert) =>
      put<T.TicketType>(`/api/v1/events/${id}/tickets/${ticketId}`, body),
    deleteTicket: (id: number, ticketId: number) => del(`/api/v1/events/${id}/tickets/${ticketId}`),
    registrations: (id: number, q: { q?: string; status?: string; page?: number; size?: number }) =>
      get<T.Page<T.RegistrationRow>>(`/api/v1/events/${id}/registrations`, q),
    exportUrl: (id: number) => `${BASE}/api/v1/events/${id}/registrations/export`,
    announcements: (id: number) => get<T.Announcement[]>(`/api/v1/events/${id}/announcements`),
    announcementPreview: (id: number) =>
      get<{ recipientCount: number; channel: string }>(`/api/v1/events/${id}/announcements/preview`),
    announce: (id: number, subject: string, message: string) =>
      post<T.Announcement>(`/api/v1/events/${id}/announcements`, { subject, message }),
  },
  registrations: {
    create: (eventId: number, items: { ticketTypeId: number; quantity: number }[]) =>
      post<T.Booking>('/api/v1/registrations', { eventId, items }),
  },
  bookings: {
    list: (scope: 'upcoming' | 'past' | 'cancelled' | 'all', page = 0, size = 20) =>
      get<T.Page<T.Booking>>('/api/v1/bookings', { scope, page, size }),
    get: (reference: string) => get<T.Booking>(`/api/v1/bookings/${encodeURIComponent(reference)}`),
    cancel: (reference: string) => post<T.Booking>(`/api/v1/bookings/${encodeURIComponent(reference)}/cancel`),
  },
  tickets: {
    verify: (code: string) => get<T.TicketVerification>(`/api/v1/tickets/${encodeURIComponent(code)}/verify`),
    checkIn: (code: string) => post<T.TicketVerification>(`/api/v1/tickets/${encodeURIComponent(code)}/check-in`),
  },
  notifications: {
    list: (unread = false, page = 0, size = 20) => get<T.Page<T.Notification>>('/api/v1/notifications', { unread, page, size }),
    unreadCount: () => get<{ unread: number }>('/api/v1/notifications/unread-count'),
    mark: (id: number, read: boolean) => patch<T.Notification>(`/api/v1/notifications/${id}`, { read }),
    readAll: () => post<{ updated: number }>('/api/v1/notifications/read-all'),
  },
  organizer: {
    events: (q: { status?: string; q?: string; page?: number; size?: number }) =>
      get<T.Page<T.EventSummary>>('/api/v1/organizer/events', q),
    analytics: () => get<T.OrganizerAnalytics>('/api/v1/organizer/analytics'),
    announcements: () => get<T.Announcement[]>('/api/v1/organizer/announcements'),
  },
  admin: {
    analytics: () => get<T.AdminAnalytics>('/api/v1/admin/analytics'),
    events: (q: { status?: string; q?: string; page?: number; size?: number }) =>
      get<T.Page<T.EventSummary>>('/api/v1/admin/events', q),
    feature: (id: number, featured: boolean) => patch<T.EventSummary>(`/api/v1/admin/events/${id}/feature`, { featured }),
    approvals: (page = 0, size = 20) => get<T.Page<T.ApprovalRecord>>('/api/v1/admin/approvals', { page, size }),
    auditLogs: (q: { q?: string; action?: string; entityType?: string; page?: number; size?: number }) =>
      get<T.Page<T.AuditLog>>('/api/v1/admin/audit-logs', q),
    settings: () => get<{ settings: T.SettingItem[] }>('/api/v1/admin/settings'),
    updateSettings: (values: Record<string, string>) => put<{ settings: T.SettingItem[] }>('/api/v1/admin/settings', { values }),
  },
  users: {
    list: (q: { q?: string; role?: string; status?: string; page?: number; size?: number; sort?: string; direction?: string }) =>
      get<T.Page<T.AdminUser>>('/api/v1/users', q),
    get: (id: number) => get<T.AdminUser>(`/api/v1/users/${id}`),
    update: (id: number, body: { fullName: string; role: T.Role; organizationName: string | null }) =>
      patch<T.AdminUser>(`/api/v1/users/${id}`, body),
    suspend: (id: number) => post<T.AdminUser>(`/api/v1/users/${id}/suspend`),
    reactivate: (id: number) => post<T.AdminUser>(`/api/v1/users/${id}/reactivate`),
    remove: (id: number) => del(`/api/v1/users/${id}`),
  },
  uploads: {
    image: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<T.UploadResponse>('POST', '/api/v1/uploads/images', form);
    },
  },
};

/** Resolves backend-relative asset URLs (e.g. /uploads/x.jpg) against the API base. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return BASE + url;
  return url;
}
