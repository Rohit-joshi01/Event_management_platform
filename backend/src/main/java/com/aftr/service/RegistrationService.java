package com.aftr.service;

import com.aftr.config.AppProperties;
import com.aftr.dto.BookingDtos;
import com.aftr.dto.PageResponse;
import com.aftr.dto.TicketDtos;
import com.aftr.entity.*;
import com.aftr.exception.ApiException;
import com.aftr.mapper.BookingMapper;
import com.aftr.repository.*;
import com.aftr.security.AuthUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Attendee registration and ticket purchase, booking history, cancellations and on-site
 * ticket verification.
 */
@Service
public class RegistrationService {

    private static final int MAX_TICKETS_PER_BOOKING = 10;

    private final EventRepository events;
    private final TicketTypeRepository ticketTypes;
    private final BookingOrderRepository orders;
    private final TicketRepository tickets;
    private final UserRepository users;
    private final InventoryService inventory;
    private final EventService eventService;
    private final NotificationService notifications;
    private final AuditService audit;
    private final SettingsService settings;
    private final CodeGenerator codes;
    private final BookingMapper mapper;
    private final AppProperties props;
    private final Clock clock;

    public RegistrationService(EventRepository events, TicketTypeRepository ticketTypes, BookingOrderRepository orders,
                               TicketRepository tickets, UserRepository users, InventoryService inventory,
                               EventService eventService, NotificationService notifications, AuditService audit,
                               SettingsService settings, CodeGenerator codes, BookingMapper mapper,
                               AppProperties props, Clock clock) {
        this.events = events;
        this.ticketTypes = ticketTypes;
        this.orders = orders;
        this.tickets = tickets;
        this.users = users;
        this.inventory = inventory;
        this.eventService = eventService;
        this.notifications = notifications;
        this.audit = audit;
        this.settings = settings;
        this.codes = codes;
        this.mapper = mapper;
        this.props = props;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ purchase

    @Transactional
    public BookingDtos.BookingResponse purchase(BookingDtos.PurchaseRequest req, AuthUser actor) {
        if (!actor.hasRole(Role.ATTENDEE)) {
            throw ApiException.forbidden("Only attendee accounts can register for events.");
        }
        Instant now = Instant.now(clock);
        Event event = events.findById(req.eventId()).orElseThrow(() -> ApiException.notFound("Event"));
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("NOT_OPEN", event.getStatus() == EventStatus.CANCELLED
                    ? "This event has been cancelled." : "This event isn't open for registration.");
        }
        if (!event.getStartsAt().isAfter(now)) {
            throw ApiException.conflict("REGISTRATION_CLOSED", "Registration closed when the event started.");
        }
        orders.findFirstByUserIdAndEventIdAndStatus(actor.getId(), event.getId(), OrderStatus.CONFIRMED).ifPresent(o -> {
            throw ApiException.conflict("ALREADY_REGISTERED",
                    "You already have a booking for this event (" + o.getReference() + ").");
        });

        // Merge duplicate lines and validate each ticket type against the event and its sale rules.
        Map<Long, Integer> requested = new LinkedHashMap<>();
        for (BookingDtos.PurchaseItem item : req.items()) {
            requested.merge(item.ticketTypeId(), item.quantity(), Integer::sum);
        }
        int totalQty = requested.values().stream().mapToInt(Integer::intValue).sum();
        if (totalQty > MAX_TICKETS_PER_BOOKING) {
            throw ApiException.badRequest("TOO_MANY_TICKETS", "You can book at most " + MAX_TICKETS_PER_BOOKING + " tickets at once.");
        }
        Map<Long, TicketType> typeById = new HashMap<>();
        Map<Long, String> names = new HashMap<>();
        long total = 0;
        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            TicketType type = ticketTypes.findById(entry.getKey())
                    .filter(t -> t.getEvent().getId().equals(event.getId()))
                    .orElseThrow(() -> ApiException.badRequest("INVALID_TICKET_TYPE", "That ticket type doesn't belong to this event."));
            if (!type.isOnSale(now)) {
                throw ApiException.conflict("NOT_ON_SALE", "\"" + type.getName() + "\" isn't on sale right now.");
            }
            if (entry.getValue() > type.getMaxPerOrder()) {
                throw ApiException.badRequest("OVER_LIMIT", "You can book at most " + type.getMaxPerOrder()
                        + " \"" + type.getName() + "\" tickets per booking.");
            }
            typeById.put(type.getId(), type);
            names.put(type.getId(), type.getName());
            total += type.getPriceCents() * entry.getValue();
        }

        PaymentStatus paymentStatus;
        PaymentProvider provider;
        if (total == 0) {
            paymentStatus = PaymentStatus.NOT_REQUIRED;
            provider = PaymentProvider.NONE;
        } else if (props.getPayments().isDevCheckoutEnabled()) {
            // No payment provider credentials are configured. The development checkout records the
            // booking as SIMULATED_PAID — it is never reported as real revenue.
            paymentStatus = PaymentStatus.SIMULATED_PAID;
            provider = PaymentProvider.DEV_SIMULATED;
        } else {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENTS_UNAVAILABLE",
                    "Paid tickets are unavailable: no payment provider is configured.");
        }

        // Atomic, conditional inventory reservation. Throws (and rolls back) if anything is short.
        inventory.reserve(event.getId(), requested, names);

        User user = users.getReferenceById(actor.getId());
        BookingOrder order = new BookingOrder();
        order.setReference(uniqueReference());
        order.setUser(user);
        order.setEvent(event);
        order.setStatus(OrderStatus.CONFIRMED);
        order.setTotalCents(total);
        order.setCurrency("INR");
        order.setPaymentStatus(paymentStatus);
        order.setPaymentProvider(provider);
        orders.saveAndFlush(order); // partial unique index rejects a concurrent duplicate booking here

        List<Ticket> issued = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            TicketType type = typeById.get(entry.getKey());
            for (int i = 0; i < entry.getValue(); i++) {
                Ticket t = new Ticket();
                t.setOrder(order);
                t.setTicketType(type);
                t.setEvent(event);
                t.setUser(user);
                t.setCode(codes.ticketCode());
                t.setStatus(TicketStatus.VALID);
                t.setPriceCents(type.getPriceCents());
                issued.add(t);
            }
        }
        tickets.saveAll(issued);
        order.getTickets().addAll(issued);

        audit.record(actor, "BOOKING_CREATED", "ORDER", order.getId(),
                order.getReference() + " — " + totalQty + " ticket(s) for " + event.getTitle()
                        + (provider == PaymentProvider.DEV_SIMULATED ? " [simulated payment]" : ""));
        notifications.notify(user, "BOOKING_CONFIRMED", "You're going to " + event.getTitle(),
                "Booking " + order.getReference() + " is confirmed. Your QR tickets are in My Tickets.",
                "/account/tickets/" + order.getReference());
        if (settings.getBoolean(SettingsService.NOTIFY_ORGANIZER_ON_REGISTRATION)) {
            notifications.notify(event.getOrganizer(), "NEW_REGISTRATION", "New registration: " + event.getTitle(),
                    actor.getFullName() + " booked " + totalQty + " ticket(s).",
                    "/organizer/events/" + event.getId() + "/registrations");
        }
        return mapper.toResponse(order, issued);
    }

    // ------------------------------------------------------------------ attendee bookings

    @Transactional(readOnly = true)
    public PageResponse<BookingDtos.BookingResponse> myBookings(Long userId, String scope, int page, int size) {
        Instant now = Instant.now(clock);
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<BookingOrder> result = switch (scope == null ? "upcoming" : scope.toLowerCase(Locale.ROOT)) {
            case "past" -> orders.findPastForUser(userId, now, pr);
            case "cancelled" -> orders.findCancelledForUser(userId, pr);
            case "all" -> orders.findAllForUser(userId, pr);
            default -> orders.findUpcomingForUser(userId, now, pr);
        };
        Map<Long, List<Ticket>> byOrder = ticketsFor(result.getContent());
        return PageResponse.fromMapped(result, result.getContent().stream()
                .map(o -> mapper.toResponse(o, byOrder.getOrDefault(o.getId(), List.of()))).toList());
    }

    @Transactional(readOnly = true)
    public BookingDtos.BookingResponse booking(String reference, AuthUser actor) {
        BookingOrder o = orders.findByReference(reference).orElseThrow(() -> ApiException.notFound("Booking"));
        if (!o.getUser().getId().equals(actor.getId())) {
            throw ApiException.notFound("Booking"); // don't reveal other people's references
        }
        return mapper.toResponse(o, tickets.findByOrderId(o.getId()));
    }

    @Transactional
    public BookingDtos.BookingResponse cancel(String reference, AuthUser actor) {
        BookingOrder o = orders.findByReference(reference).orElseThrow(() -> ApiException.notFound("Booking"));
        if (!o.getUser().getId().equals(actor.getId())) {
            throw ApiException.notFound("Booking");
        }
        if (o.getStatus() != OrderStatus.CONFIRMED) {
            throw ApiException.conflict("ALREADY_CANCELLED", "This booking is already cancelled.");
        }
        Instant now = Instant.now(clock);
        if (!o.getEvent().getStartsAt().isAfter(now)) {
            throw ApiException.conflict("EVENT_STARTED", "Bookings can't be cancelled after the event has started.");
        }
        List<Ticket> ts = tickets.findByOrderId(o.getId());
        if (ts.stream().anyMatch(t -> t.getStatus() == TicketStatus.CHECKED_IN)) {
            throw ApiException.conflict("CHECKED_IN", "A ticket in this booking has already been used.");
        }
        inventory.release(o.getEvent().getId(), ts);
        ts.forEach(t -> t.setStatus(TicketStatus.CANCELLED));
        o.setStatus(OrderStatus.CANCELLED);
        o.setCancelledAt(now);
        if (o.getPaymentStatus() == PaymentStatus.SIMULATED_PAID) {
            o.setPaymentStatus(PaymentStatus.SIMULATED_REFUNDED);
        }
        audit.record(actor, "BOOKING_CANCELLED", "ORDER", o.getId(), o.getReference() + " cancelled by attendee");
        notifications.notify(o.getUser(), "BOOKING_CANCELLED", "Booking cancelled: " + o.getEvent().getTitle(),
                "Booking " + o.getReference() + " was cancelled and your seats were released.", "/account/tickets");
        return mapper.toResponse(o, ts);
    }

    // ------------------------------------------------------------------ organizer views

    @Transactional(readOnly = true)
    public PageResponse<BookingDtos.EventRegistrationRow> eventRegistrations(Long eventId, AuthUser actor, String q,
                                                                             OrderStatus status, int page, int size) {
        eventService.loadManaged(eventId, actor);
        String like = q == null || q.isBlank() ? "" : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
        Page<BookingOrder> result = orders.findForEvent(eventId, status, like,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        Map<Long, List<Ticket>> byOrder = ticketsFor(result.getContent());
        return PageResponse.fromMapped(result, result.getContent().stream()
                .map(o -> row(o, byOrder.getOrDefault(o.getId(), List.of()))).toList());
    }

    @Transactional
    public String exportCsv(Long eventId, AuthUser actor) {
        Event e = eventService.loadManaged(eventId, actor);
        Page<BookingOrder> all = orders.findForEvent(eventId, null, "", PageRequest.of(0, 10_000));
        Map<Long, List<Ticket>> byOrder = ticketsFor(all.getContent());
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of(e.getTimezone()));
        StringBuilder sb = new StringBuilder("reference,attendee,email,tickets,quantity,checked_in,total_inr,payment_status,status,booked_at\n");
        for (BookingOrder o : all.getContent()) {
            BookingDtos.EventRegistrationRow r = row(o, byOrder.getOrDefault(o.getId(), List.of()));
            sb.append(csv(r.reference())).append(',').append(csv(r.attendeeName())).append(',')
              .append(csv(r.attendeeEmail())).append(',').append(csv(r.ticketSummary())).append(',')
              .append(r.quantity()).append(',').append(r.checkedIn()).append(',')
              .append(String.format(Locale.ROOT, "%.2f", r.totalCents() / 100.0)).append(',')
              .append(r.paymentStatus()).append(',').append(r.status()).append(',')
              .append(fmt.format(r.createdAt())).append('\n');
        }
        audit.record(actor, "REGISTRATIONS_EXPORTED", "EVENT", eventId, "Exported registrations for " + e.getTitle());
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public TicketDtos.TicketVerification verify(String code, AuthUser actor) {
        Ticket t = tickets.findByCode(code.trim()).orElse(null);
        if (t == null) {
            return new TicketDtos.TicketVerification(code, false, null, "No ticket matches this code.", null, null,
                    null, null, null, null, null);
        }
        eventService.loadManaged(t.getEvent().getId(), actor);
        return verification(t);
    }

    @Transactional
    public TicketDtos.TicketVerification checkIn(String code, AuthUser actor) {
        Ticket t = tickets.findByCode(code.trim()).orElseThrow(() -> ApiException.notFound("Ticket"));
        Event e = eventService.loadManaged(t.getEvent().getId(), actor);
        if (e.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("EVENT_NOT_ACTIVE", "This event isn't active.");
        }
        if (t.getStatus() == TicketStatus.CANCELLED) {
            throw ApiException.conflict("TICKET_CANCELLED", "This ticket was cancelled and isn't valid for entry.");
        }
        if (t.getStatus() == TicketStatus.CHECKED_IN) {
            throw ApiException.conflict("ALREADY_CHECKED_IN", "This ticket was already used at "
                    + DateTimeFormatter.ofPattern("h:mm a, d MMM").withZone(ZoneId.of(e.getTimezone())).format(t.getCheckedInAt()) + ".");
        }
        t.setStatus(TicketStatus.CHECKED_IN);
        t.setCheckedInAt(Instant.now(clock));
        audit.record(actor, "TICKET_CHECKED_IN", "TICKET", t.getId(),
                "Checked in " + t.getUser().getFullName() + " at " + e.getTitle());
        return verification(t);
    }

    // ------------------------------------------------------------------ helpers

    private TicketDtos.TicketVerification verification(Ticket t) {
        boolean valid = t.getStatus() == TicketStatus.VALID && t.getEvent().getStatus() == EventStatus.PUBLISHED;
        String msg = switch (t.getStatus()) {
            case VALID -> valid ? "Valid ticket — ready to check in." : "The event is not active.";
            case CHECKED_IN -> "Already checked in.";
            case CANCELLED -> "Cancelled ticket — not valid for entry.";
        };
        return new TicketDtos.TicketVerification(t.getCode(), valid, t.getStatus(), msg, t.getEvent().getId(),
                t.getEvent().getTitle(), t.getEvent().getStartsAt(), t.getTicketType().getName(),
                t.getUser().getFullName(), t.getOrder().getReference(), t.getCheckedInAt());
    }

    private BookingDtos.EventRegistrationRow row(BookingOrder o, List<Ticket> ts) {
        String summary = ts.stream().collect(Collectors.groupingBy(t -> t.getTicketType().getName(), LinkedHashMap::new,
                Collectors.counting())).entrySet().stream().map(en -> en.getValue() + "× " + en.getKey())
                .collect(Collectors.joining(", "));
        int checkedIn = (int) ts.stream().filter(t -> t.getStatus() == TicketStatus.CHECKED_IN).count();
        return new BookingDtos.EventRegistrationRow(o.getReference(), o.getUser().getId(), o.getUser().getFullName(),
                o.getUser().getEmail(), summary, ts.size(), checkedIn, o.getTotalCents(), o.getPaymentStatus(),
                o.getStatus(), o.getCreatedAt());
    }

    private Map<Long, List<Ticket>> ticketsFor(List<BookingOrder> list) {
        if (list.isEmpty()) return Map.of();
        return tickets.findByOrderIdInOrderByIdAsc(list.stream().map(BookingOrder::getId).toList()).stream()
                .collect(Collectors.groupingBy(t -> t.getOrder().getId()));
    }

    private String uniqueReference() {
        String ref;
        do {
            ref = codes.bookingReference();
        } while (orders.existsByReference(ref));
        return ref;
    }

    private static String csv(String s) {
        if (s == null) return "";
        String safe = s;
        // Neutralise spreadsheet formula injection.
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) safe = "'" + safe;
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n")) {
            safe = "\"" + safe.replace("\"", "\"\"") + "\"";
        }
        return safe;
    }
}
