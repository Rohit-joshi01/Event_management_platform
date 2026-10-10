// Mirrors the Spring Boot DTOs in backend/src/main/java/com/aftr/dto. Keep in sync.

export type Role = 'ADMIN' | 'ORGANIZER' | 'ATTENDEE';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type EventStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'CANCELLED';
export type EventFormat = 'IN_PERSON' | 'ONLINE' | 'HYBRID';
export type OrderStatus = 'CONFIRMED' | 'CANCELLED';
export type PaymentStatus = 'NOT_REQUIRED' | 'SIMULATED_PAID' | 'SIMULATED_REFUNDED' | 'PAID' | 'REFUNDED';
export type PaymentProvider = 'NONE' | 'DEV_SIMULATED';
export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'CANCELLED';
export type Availability = 'AVAILABLE' | 'LIMITED' | 'SOLD_OUT' | 'CLOSED' | 'ENDED' | 'CANCELLED' | EventStatus;
export type RegistrationState = 'OPEN' | 'NOT_YET_OPEN' | 'CLOSED' | 'SOLD_OUT' | 'CANCELLED' | 'ENDED' | 'UNAVAILABLE';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorBody {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  fieldErrors: FieldError[];
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  bio: string | null;
  organizationName: string | null;
  city: string | null;
  notifyAnnouncements: boolean;
  notifyReminders: boolean;
  notifyRecommendations: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  user: User | null;
}

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  organizationName: string | null;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  eventCount: number;
  bookingCount: number;
  seed: boolean;
}

export interface CategoryRef {
  id: number;
  slug: string;
  name: string;
}

export interface Category extends CategoryRef {
  description: string | null;
  upcomingCount: number;
}

export interface EventSummary {
  id: number;
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  category: CategoryRef;
  startsAt: string;
  endsAt: string;
  timezone: string;
  format: EventFormat;
  venueName: string | null;
  city: string | null;
  organizerName: string;
  minPriceCents: number;
  currency: string;
  totalCapacity: number;
  totalSold: number;
  status: EventStatus;
  availability: Availability;
  featured: boolean;
  seed: boolean;
  submittedAt: string | null;
  createdAt: string;
}

export interface TicketType {
  id: number;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantity: number;
  sold: number;
  remaining: number;
  salesStart: string | null;
  salesEnd: string | null;
  maxPerOrder: number;
  onSale: boolean;
  saleState: 'ON_SALE' | 'NOT_STARTED' | 'ENDED' | 'SOLD_OUT';
  sortOrder: number;
}

export interface ScheduleItem {
  id: number;
  startsAt: string;
  title: string;
  description: string | null;
}

export interface Venue {
  id: number;
  name: string;
  address: string | null;
  city: string;
  country: string;
}

export interface OrganizerRef {
  id: number;
  name: string;
  organizationName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  publishedEvents: number;
}

export interface ApprovalHistoryItem {
  decision: 'APPROVED' | 'REJECTED';
  reason: string | null;
  adminName: string | null;
  createdAt: string;
}

export interface EventDetail {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  coverImageUrl: string | null;
  category: CategoryRef;
  startsAt: string;
  endsAt: string;
  timezone: string;
  format: EventFormat;
  venue: Venue | null;
  onlineUrl: string | null;
  onlineUrlHidden: boolean;
  status: EventStatus;
  availability: Availability;
  registrationState: RegistrationState;
  registrationMessage: string | null;
  featured: boolean;
  seed: boolean;
  minPriceCents: number;
  currency: string;
  totalCapacity: number;
  totalSold: number;
  schedule: ScheduleItem[];
  ticketTypes: TicketType[];
  organizer: OrganizerRef;
  rejectionReason: string | null;
  cancelReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewerIsOwner: boolean;
  viewerBookingReference: string | null;
  approvalHistory: ApprovalHistoryItem[];
}

export interface EventMeta {
  cities: string[];
  categories: Category[];
}

export interface EventUpsert {
  title: string;
  summary: string;
  description: string;
  categorySlug: string;
  coverImageUrl: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  format: EventFormat;
  venueName: string;
  venueAddress: string;
  city: string;
  onlineUrl: string;
  schedule: { startsAt: string; title: string; description: string }[];
}

export interface TicketTypeUpsert {
  name: string;
  description: string;
  priceCents: number;
  quantity: number;
  salesStart: string | null;
  salesEnd: string | null;
  maxPerOrder: number;
  sortOrder?: number;
}

export interface TicketResponse {
  id: number;
  code: string;
  status: TicketStatus;
  ticketTypeName: string;
  priceCents: number;
  checkedInAt: string | null;
}

export interface Booking {
  id: number;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProvider;
  paymentSimulated: boolean;
  totalCents: number;
  currency: string;
  createdAt: string;
  cancelledAt: string | null;
  seed: boolean;
  cancellable: boolean;
  event: EventSummary;
  tickets: TicketResponse[];
}

export interface RegistrationRow {
  reference: string;
  attendeeId: number;
  attendeeName: string;
  attendeeEmail: string;
  ticketSummary: string;
  quantity: number;
  checkedIn: number;
  totalCents: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
}

export interface TicketVerification {
  code: string;
  valid: boolean;
  status: TicketStatus | null;
  message: string;
  eventId: number | null;
  eventTitle: string | null;
  eventStartsAt: string | null;
  ticketTypeName: string | null;
  attendeeName: string | null;
  bookingReference: string | null;
  checkedInAt: string | null;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface Announcement {
  id: number;
  eventId: number;
  eventTitle: string;
  subject: string;
  message: string;
  recipientCount: number;
  channel: 'IN_APP';
  senderName: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorId: number | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface ApprovalRecord {
  id: number;
  eventId: number;
  eventTitle: string;
  eventSlug: string;
  adminName: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
}

export interface SettingItem {
  key: string;
  value: string;
  type: 'string' | 'email' | 'boolean' | 'integer';
  group: string;
  label: string;
  description: string;
}

export interface PublicSettings {
  platformName: string;
  supportEmail: string;
  allowAttendeeSignup: boolean;
  allowOrganizerSignup: boolean;
  devCheckoutEnabled: boolean;
}

export interface DayPoint {
  date: string;
  tickets: number;
  valueCents: number;
}

export interface Revenue {
  realCents: number;
  simulatedCents: number;
  liveProviderConfigured: boolean;
  note: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  usersByRole: Record<Role, number>;
  newUsersLast30Days: number;
  totalEvents: number;
  eventsByStatus: Record<string, number>;
  pendingApprovals: number;
  totalRegistrations: number;
  ticketsIssued: number;
  revenue: Revenue;
  registrationsByDay: DayPoint[];
  eventsCreatedByWeek: { week: string; count: number }[];
  recentActivity: AuditLog[];
  upcomingEvents: EventSummary[];
}

export interface OrganizerAnalytics {
  totalEvents: number;
  eventsByStatus: Record<string, number>;
  totalRegistrations: number;
  ticketsSold: number;
  checkedIn: number;
  attendanceRate: number;
  revenue: Revenue;
  registrationsByDay: DayPoint[];
  ticketsByType: { eventId: number; eventTitle: string; ticketType: string; sold: number; quantity: number }[];
  upcomingDeadlines: { eventId: number; eventTitle: string; label: string; at: string }[];
  recentBookings: {
    reference: string;
    attendeeName: string;
    eventTitle: string;
    quantity: number;
    totalCents: number;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }[];
  upcomingEvents: EventSummary[];
}

export interface UploadResponse {
  url: string;
  size: number;
  contentType: string;
}
