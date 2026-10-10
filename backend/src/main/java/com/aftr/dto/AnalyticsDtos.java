package com.aftr.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    public record DayPoint(String date, long tickets, long valueCents) {
    }

    public record WeekPoint(String week, long count) {
    }

    public record TypePoint(Long eventId, String eventTitle, String ticketType, int sold, int quantity) {
    }

    public record Deadline(Long eventId, String eventTitle, String label, Instant at) {
    }

    public record RecentBooking(String reference, String attendeeName, String eventTitle, int quantity,
                                long totalCents, String paymentStatus, Instant createdAt) {
    }

    /**
     * Revenue split. {@code realCents} only counts orders confirmed by a real payment provider
     * (none is configured, so it is 0). {@code simulatedCents} is development-checkout volume and must
     * never be presented as money received.
     */
    public record Revenue(long realCents, long simulatedCents, boolean liveProviderConfigured, String note) {
    }

    public record AdminAnalytics(
            long totalUsers, Map<String, Long> usersByRole, long newUsersLast30Days, long totalEvents,
            Map<String, Long> eventsByStatus, long pendingApprovals, long totalRegistrations, long ticketsIssued,
            Revenue revenue, List<DayPoint> registrationsByDay, List<WeekPoint> eventsCreatedByWeek,
            List<AdminDtos.AuditLogResponse> recentActivity, List<EventDtos.EventSummary> upcomingEvents) {
    }

    public record OrganizerAnalytics(
            long totalEvents, Map<String, Long> eventsByStatus, long totalRegistrations, long ticketsSold,
            long checkedIn, double attendanceRate, Revenue revenue, List<DayPoint> registrationsByDay,
            List<TypePoint> ticketsByType, List<Deadline> upcomingDeadlines, List<RecentBooking> recentBookings,
            List<EventDtos.EventSummary> upcomingEvents) {
    }
}
