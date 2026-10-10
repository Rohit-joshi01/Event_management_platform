package com.aftr.service;

import com.aftr.dto.AdminDtos;
import com.aftr.dto.AnalyticsDtos;
import com.aftr.dto.EventDtos;
import com.aftr.entity.*;
import com.aftr.mapper.EventMapper;
import com.aftr.repository.*;
import com.aftr.security.AuthUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** All dashboard figures are computed from persisted data — nothing here is hard-coded. */
@Service
public class AnalyticsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String REVENUE_NOTE = "No live payment provider is configured. Paid bookings go through the "
            + "development checkout and are recorded as simulated — they are not real revenue.";

    private final UserRepository users;
    private final EventRepository events;
    private final BookingOrderRepository orders;
    private final TicketRepository tickets;
    private final TicketTypeRepository ticketTypes;
    private final AuditLogRepository auditLogs;
    private final EventMapper mapper;
    private final Clock clock;

    public AnalyticsService(UserRepository users, EventRepository events, BookingOrderRepository orders,
                            TicketRepository tickets, TicketTypeRepository ticketTypes, AuditLogRepository auditLogs,
                            EventMapper mapper, Clock clock) {
        this.users = users;
        this.events = events;
        this.orders = orders;
        this.tickets = tickets;
        this.ticketTypes = ticketTypes;
        this.auditLogs = auditLogs;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AnalyticsDtos.AdminAnalytics admin() {
        Instant now = Instant.now(clock);
        Map<String, Long> byRole = new LinkedHashMap<>();
        for (Role r : Role.values()) byRole.put(r.name(), users.countByRole(r));
        long totalUsers = byRole.values().stream().mapToLong(Long::longValue).sum();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (EventStatus s : EventStatus.values()) byStatus.put(s.name(), 0L);
        for (Object[] row : events.countGroupedByStatus()) {
            byStatus.put(((EventStatus) row[0]).name(), ((Number) row[1]).longValue());
        }
        long completed = events.countCompleted(now);
        byStatus.put("COMPLETED", completed);
        byStatus.put("PUBLISHED", byStatus.get("PUBLISHED") - completed);
        long totalEvents = events.count();

        Instant since = now.minus(Duration.ofDays(30));
        List<AnalyticsDtos.DayPoint> days = fillDays(tickets.dailyCounts(since, 0L, 0L), 30, now);

        List<AnalyticsDtos.WeekPoint> weeks = new ArrayList<>();
        for (Object[] row : events.createdPerWeek(now.minus(Duration.ofDays(84)))) {
            weeks.add(new AnalyticsDtos.WeekPoint((String) row[0], ((Number) row[1]).longValue()));
        }

        List<AdminDtos.AuditLogResponse> recent = auditLogs.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 12)).stream()
                .map(AuditQueryService::toResponse).toList();
        List<EventDtos.EventSummary> upcoming = events.findUpcomingPublished(now, PageRequest.of(0, 6)).stream()
                .map(mapper::toSummary).toList();

        return new AnalyticsDtos.AdminAnalytics(totalUsers, byRole, users.countByCreatedAtAfter(since), totalEvents,
                byStatus, byStatus.get("PENDING"), orders.countConfirmed(), tickets.countActive(),
                revenue(orders.sumConfirmedByPaymentStatus(PaymentStatus.PAID),
                        orders.sumConfirmedByPaymentStatus(PaymentStatus.SIMULATED_PAID)),
                days, weeks, recent, upcoming);
    }

    @Transactional(readOnly = true)
    public AnalyticsDtos.OrganizerAnalytics organizer(AuthUser actor) {
        Long organizerId = actor.getId();
        Instant now = Instant.now(clock);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (EventStatus s : EventStatus.values()) {
            byStatus.put(s.name(), events.countByOrganizerIdAndStatus(organizerId, s));
        }
        long completed = events.countCompletedForOrganizer(organizerId, now);
        byStatus.put("COMPLETED", completed);
        byStatus.put("PUBLISHED", byStatus.get("PUBLISHED") - completed);

        long sold = tickets.countActiveForOrganizer(organizerId);
        long checkedIn = tickets.countCheckedInForOrganizer(organizerId);

        List<Event> mine = events.findByOrganizerId(organizerId);
        List<AnalyticsDtos.TypePoint> byType = new ArrayList<>();
        for (Event e : mine) {
            if (e.getStatus() == EventStatus.DRAFT || e.getStatus() == EventStatus.REJECTED) continue;
            for (TicketType t : ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId())) {
                byType.add(new AnalyticsDtos.TypePoint(e.getId(), e.getTitle(), t.getName(), t.getSold(), t.getQuantity()));
            }
        }

        List<AnalyticsDtos.Deadline> deadlines = new ArrayList<>();
        List<Event> upcomingMine = events.findUpcomingForOrganizer(organizerId,
                List.of(EventStatus.PUBLISHED, EventStatus.PENDING, EventStatus.DRAFT, EventStatus.REJECTED), now,
                PageRequest.of(0, 20));
        for (Event e : upcomingMine) {
            if (e.getStatus() == EventStatus.DRAFT || e.getStatus() == EventStatus.REJECTED) {
                deadlines.add(new AnalyticsDtos.Deadline(e.getId(), e.getTitle(),
                        e.getStatus() == EventStatus.REJECTED ? "Revise and resubmit" : "Submit for review", e.getStartsAt()));
            }
            if (e.getStatus() == EventStatus.PUBLISHED) {
                for (TicketType t : ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId())) {
                    if (t.getSalesEnd() != null && t.getSalesEnd().isAfter(now)) {
                        deadlines.add(new AnalyticsDtos.Deadline(e.getId(), e.getTitle(), "\"" + t.getName() + "\" sales close", t.getSalesEnd()));
                    }
                }
                if (e.getStartsAt().isAfter(now)) {
                    deadlines.add(new AnalyticsDtos.Deadline(e.getId(), e.getTitle(), "Doors open", e.getStartsAt()));
                }
            }
        }
        deadlines.sort(Comparator.comparing(AnalyticsDtos.Deadline::at));

        List<AnalyticsDtos.RecentBooking> recent = orders.findRecentForOrganizer(organizerId, PageRequest.of(0, 8)).stream()
                .map(o -> new AnalyticsDtos.RecentBooking(o.getReference(), o.getUser().getFullName(), o.getEvent().getTitle(),
                        tickets.findByOrderId(o.getId()).size(), o.getTotalCents(), o.getPaymentStatus().name(), o.getCreatedAt()))
                .toList();

        List<EventDtos.EventSummary> upcoming = upcomingMine.stream()
                .filter(e -> e.getStatus() == EventStatus.PUBLISHED).limit(5).map(mapper::toSummary).toList();

        return new AnalyticsDtos.OrganizerAnalytics(mine.size(), byStatus, orders.countConfirmedForOrganizer(organizerId),
                sold, checkedIn, sold == 0 ? 0 : (double) checkedIn / sold,
                revenue(orders.sumConfirmedByPaymentStatusForOrganizer(PaymentStatus.PAID, organizerId),
                        orders.sumConfirmedByPaymentStatusForOrganizer(PaymentStatus.SIMULATED_PAID, organizerId)),
                fillDays(tickets.dailyCounts(now.minus(Duration.ofDays(30)), organizerId, 0L), 30, now),
                byType, deadlines.stream().limit(8).toList(), recent, upcoming);
    }

    private AnalyticsDtos.Revenue revenue(long real, long simulated) {
        return new AnalyticsDtos.Revenue(real, simulated, false, REVENUE_NOTE);
    }

    /** Converts sparse SQL rows into a continuous day series (zero-filled) ending today (IST). */
    private List<AnalyticsDtos.DayPoint> fillDays(List<Object[]> rows, int days, Instant now) {
        Map<String, long[]> byDay = new HashMap<>();
        for (Object[] r : rows) {
            byDay.put((String) r[0], new long[]{((Number) r[1]).longValue(), ((Number) r[2]).longValue()});
        }
        LocalDate today = now.atZone(IST).toLocalDate();
        List<AnalyticsDtos.DayPoint> out = new ArrayList<>(days);
        for (int i = days - 1; i >= 0; i--) {
            String key = today.minusDays(i).format(DateTimeFormatter.ISO_LOCAL_DATE);
            long[] v = byDay.getOrDefault(key, new long[]{0, 0});
            out.add(new AnalyticsDtos.DayPoint(key, v[0], v[1]));
        }
        return out;
    }
}
