package com.aftr.service;

import com.aftr.dto.AdminDtos;
import com.aftr.dto.EventDtos;
import com.aftr.dto.PageResponse;
import com.aftr.entity.*;
import com.aftr.exception.ApiException;
import com.aftr.mapper.EventMapper;
import com.aftr.repository.*;
import com.aftr.security.AuthUser;
import jakarta.persistence.criteria.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EventService {

    private static final DateTimeFormatter HUMAN = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a");

    private final EventRepository events;
    private final CategoryRepository categories;
    private final VenueRepository venues;
    private final TicketTypeRepository ticketTypes;
    private final BookingOrderRepository orders;
    private final TicketRepository tickets;
    private final ApprovalRecordRepository approvals;
    private final UserRepository users;
    private final InventoryService inventory;
    private final NotificationService notifications;
    private final AuditService audit;
    private final SettingsService settings;
    private final CodeGenerator codes;
    private final EventMapper mapper;
    private final Clock clock;

    public EventService(EventRepository events, CategoryRepository categories, VenueRepository venues,
                        TicketTypeRepository ticketTypes, BookingOrderRepository orders, TicketRepository tickets,
                        ApprovalRecordRepository approvals, UserRepository users, InventoryService inventory,
                        NotificationService notifications, AuditService audit, SettingsService settings,
                        CodeGenerator codes, EventMapper mapper, Clock clock) {
        this.events = events;
        this.categories = categories;
        this.venues = venues;
        this.ticketTypes = ticketTypes;
        this.orders = orders;
        this.tickets = tickets;
        this.approvals = approvals;
        this.users = users;
        this.inventory = inventory;
        this.notifications = notifications;
        this.audit = audit;
        this.settings = settings;
        this.codes = codes;
        this.mapper = mapper;
        this.clock = clock;
    }

    // =====================================================================  public discovery

    public record SearchParams(String q, String category, String city, Instant from, Instant to, String price,
                               Long maxPriceCents, EventFormat format, Boolean featured, String sort,
                               int page, int size) {
    }

    @Transactional(readOnly = true)
    public PageResponse<EventDtos.EventSummary> search(SearchParams p) {
        Instant now = Instant.now(clock);
        Sort sort = switch (p.sort() == null ? "date" : p.sort()) {
            case "popular" -> Sort.by(Sort.Order.desc("totalSold"), Sort.Order.asc("startsAt"));
            case "newest" -> Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.desc("id"));
            case "price" -> Sort.by(Sort.Order.asc("minPriceCents"), Sort.Order.asc("startsAt"));
            default -> Sort.by(Sort.Order.asc("startsAt"), Sort.Order.asc("id"));
        };
        Pageable pageable = PageRequest.of(Math.max(p.page(), 0), Math.min(Math.max(p.size(), 1), 48), sort);

        Specification<Event> spec = (root, query, cb) -> {
            Joins j = joins(root, query);
            List<Predicate> preds = new ArrayList<>();
            preds.add(cb.equal(root.get("status"), EventStatus.PUBLISHED));
            preds.add(cb.greaterThan(root.get("endsAt"), now));
            if (notBlank(p.q())) {
                String like = "%" + p.q().trim().toLowerCase(Locale.ROOT) + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(root.<String>get("title")), like),
                        cb.like(cb.lower(root.<String>get("summary")), like),
                        cb.like(cb.lower(cb.coalesce(j.venue.<String>get("name"), "")), like),
                        cb.like(cb.lower(cb.coalesce(j.venue.<String>get("city"), "")), like),
                        cb.like(cb.lower(j.organizer.<String>get("fullName")), like),
                        cb.like(cb.lower(cb.coalesce(j.organizer.<String>get("organizationName"), "")), like),
                        cb.like(cb.lower(j.category.<String>get("name")), like)));
            }
            if (notBlank(p.category())) preds.add(cb.equal(j.category.get("slug"), p.category().trim()));
            if (notBlank(p.city())) {
                preds.add(cb.equal(cb.lower(j.venue.<String>get("city")), p.city().trim().toLowerCase(Locale.ROOT)));
            }
            if (p.from() != null) preds.add(cb.greaterThanOrEqualTo(root.get("startsAt"), p.from()));
            if (p.to() != null) preds.add(cb.lessThan(root.get("startsAt"), p.to()));
            if ("free".equalsIgnoreCase(p.price())) preds.add(cb.equal(root.get("minPriceCents"), 0L));
            if ("paid".equalsIgnoreCase(p.price())) preds.add(cb.greaterThan(root.get("minPriceCents"), 0L));
            if (p.maxPriceCents() != null) preds.add(cb.lessThanOrEqualTo(root.get("minPriceCents"), p.maxPriceCents()));
            if (p.format() != null) preds.add(cb.equal(root.get("format"), p.format()));
            if (Boolean.TRUE.equals(p.featured())) preds.add(cb.isTrue(root.get("featured")));
            return cb.and(preds.toArray(Predicate[]::new));
        };
        Page<Event> page = events.findAll(spec, pageable);
        return PageResponse.of(page, mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public EventDtos.EventMeta meta() {
        return new EventDtos.EventMeta(events.findActiveCities(Instant.now(clock)), categories());
    }

    @Transactional(readOnly = true)
    public List<EventDtos.CategoryResponse> categories() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : events.countUpcomingByCategory(Instant.now(clock))) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return categories.findAllByOrderBySortOrderAsc().stream()
                .map(c -> new EventDtos.CategoryResponse(c.getId(), c.getSlug(), c.getName(), c.getDescription(),
                        counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public EventDtos.EventDetail detail(String idOrSlug, AuthUser viewer) {
        Event e = findByIdOrSlug(idOrSlug);
        boolean owner = viewer != null && e.isOwnedBy(viewer.getId());
        boolean admin = viewer != null && viewer.isAdmin();
        boolean publicVisible = e.getStatus() == EventStatus.PUBLISHED || e.getStatus() == EventStatus.CANCELLED;
        if (!publicVisible && !owner && !admin) {
            throw ApiException.notFound("Event");
        }
        return toDetail(e, viewer, owner, admin);
    }

    @Transactional(readOnly = true)
    public List<EventDtos.EventSummary> related(Long id) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        Instant now = Instant.now(clock);
        Specification<Event> spec = (root, query, cb) -> {
            joins(root, query);
            return cb.and(cb.equal(root.get("status"), EventStatus.PUBLISHED), cb.greaterThan(root.get("endsAt"), now),
                    cb.notEqual(root.get("id"), e.getId()),
                    cb.or(cb.equal(root.get("category").get("id"), e.getCategory().getId()),
                            cb.equal(root.get("organizer").get("id"), e.getOrganizer().getId())));
        };
        List<EventDtos.EventSummary> result = new ArrayList<>(events.findAll(spec,
                PageRequest.of(0, 4, Sort.by("startsAt"))).map(mapper::toSummary).getContent());
        if (result.size() < 4) {
            Set<Long> seen = result.stream().map(EventDtos.EventSummary::id).collect(Collectors.toSet());
            seen.add(e.getId());
            for (Event other : events.findUpcomingPublished(now, PageRequest.of(0, 12))) {
                if (result.size() >= 4) break;
                if (seen.add(other.getId())) result.add(mapper.toSummary(other));
            }
        }
        return result;
    }

    /** Simple content-based suggestions: categories the attendee has booked before, then popular events. */
    @Transactional(readOnly = true)
    public List<EventDtos.EventSummary> recommendations(Long userId, int limit) {
        Instant now = Instant.now(clock);
        Set<Long> booked = new HashSet<>(orders.findActiveEventIdsForUser(userId));
        Set<Long> categoryIds = new HashSet<>(orders.findCategoryIdsForUser(userId));
        List<EventDtos.EventSummary> out = new ArrayList<>();
        if (!categoryIds.isEmpty()) {
            Specification<Event> spec = (root, query, cb) -> {
                joins(root, query);
                return cb.and(cb.equal(root.get("status"), EventStatus.PUBLISHED),
                        cb.greaterThan(root.get("startsAt"), now),
                        root.get("category").get("id").in(categoryIds));
            };
            for (Event e : events.findAll(spec, PageRequest.of(0, limit * 2, Sort.by("startsAt")))) {
                if (out.size() >= limit) break;
                if (!booked.contains(e.getId())) out.add(mapper.toSummary(e));
            }
        }
        if (out.size() < limit) {
            Set<Long> seen = out.stream().map(EventDtos.EventSummary::id).collect(Collectors.toSet());
            Specification<Event> popular = (root, query, cb) -> {
                joins(root, query);
                return cb.and(cb.equal(root.get("status"), EventStatus.PUBLISHED), cb.greaterThan(root.get("startsAt"), now));
            };
            for (Event e : events.findAll(popular, PageRequest.of(0, limit * 3, Sort.by(Sort.Order.desc("totalSold"))))) {
                if (out.size() >= limit) break;
                if (!booked.contains(e.getId()) && seen.add(e.getId())) out.add(mapper.toSummary(e));
            }
        }
        return out;
    }

    // =====================================================================  organizer lifecycle

    @Transactional
    public EventDtos.EventDetail create(EventDtos.EventUpsertRequest req, AuthUser actor) {
        requireOrganizer(actor);
        Instant now = Instant.now(clock);
        if (!req.startsAt().isAfter(now)) {
            throw ApiException.badRequest("START_IN_PAST", "The event must start in the future.");
        }
        Event e = new Event();
        e.setOrganizer(users.getReferenceById(actor.getId()));
        e.setStatus(EventStatus.DRAFT);
        e.setSlug(uniqueSlug(req.title()));
        apply(e, req);
        events.saveAndFlush(e);
        audit.record(actor, "EVENT_CREATED", "EVENT", e.getId(), "Draft created: " + e.getTitle());
        return toDetail(e, actor, true, false);
    }

    @Transactional
    public EventDtos.EventDetail update(Long id, EventDtos.EventUpsertRequest req, AuthUser actor) {
        Event e = loadOwned(id, actor);
        Instant now = Instant.now(clock);
        if (e.getStatus() == EventStatus.PENDING) {
            throw ApiException.conflict("UNDER_REVIEW", "This event is under review. Withdraw the submission to edit it.");
        }
        if (e.getStatus() == EventStatus.CANCELLED) {
            throw ApiException.conflict("CANCELLED", "Cancelled events can't be edited.");
        }
        if (e.hasEnded(now)) {
            throw ApiException.conflict("ENDED", "Past events can't be edited.");
        }
        boolean startChanged = !req.startsAt().equals(e.getStartsAt());
        if (startChanged && !req.startsAt().isAfter(now)) {
            throw ApiException.badRequest("START_IN_PAST", "The event must start in the future.");
        }
        if (e.getStatus() == EventStatus.PUBLISHED && e.getTotalSold() > 0 && !e.getStartsAt().isAfter(now)) {
            throw ApiException.conflict("IN_PROGRESS", "This event is in progress and can no longer be edited.");
        }
        String before = logistics(e);
        apply(e, req);
        events.saveAndFlush(e);
        String after = logistics(e);
        audit.record(actor, "EVENT_UPDATED", "EVENT", e.getId(), "Updated: " + e.getTitle());
        if (e.getStatus() == EventStatus.PUBLISHED && !before.equals(after)) {
            List<Long> attendees = orders.findConfirmedAttendeeIds(e.getId());
            notifications.notifyAll(attendees, "EVENT_UPDATED", "Updated details: " + e.getTitle(),
                    "The organizer changed the date, time or location. New details: " + after + ".",
                    "/events/" + e.getSlug());
        }
        return toDetail(e, actor, true, false);
    }

    @Transactional
    public EventDtos.EventDetail submit(Long id, AuthUser actor) {
        Event e = loadOwned(id, actor);
        if (e.getStatus() != EventStatus.DRAFT && e.getStatus() != EventStatus.REJECTED) {
            throw ApiException.conflict("INVALID_STATUS", "Only drafts or rejected events can be submitted.");
        }
        validateForSubmission(e);
        Instant now = Instant.now(clock);
        e.setSubmittedAt(now);
        e.setRejectionReason(null);
        if (settings.getBoolean(SettingsService.REQUIRE_APPROVAL)) {
            e.setStatus(EventStatus.PENDING);
            audit.record(actor, "EVENT_SUBMITTED", "EVENT", e.getId(), "Submitted for review: " + e.getTitle());
            if (settings.getBoolean(SettingsService.NOTIFY_ADMINS_ON_SUBMISSION)) {
                List<Long> admins = users.findAll((Specification<User>) (root, q, cb) -> cb.and(cb.equal(root.get("role"), Role.ADMIN),
                        cb.equal(root.get("status"), UserStatus.ACTIVE))).stream().map(User::getId).toList();
                notifications.notifyAll(admins, "APPROVAL_REQUEST", "New submission: " + e.getTitle(),
                        mapper.organizerDisplayName(e.getOrganizer()) + " submitted an event for review.",
                        "/admin/approvals");
            }
        } else {
            e.setStatus(EventStatus.PUBLISHED);
            e.setPublishedAt(now);
            audit.record(actor, "EVENT_AUTO_PUBLISHED", "EVENT", e.getId(),
                    "Published without review (approval disabled): " + e.getTitle());
        }
        return toDetail(e, actor, true, false);
    }

    @Transactional
    public EventDtos.EventDetail withdraw(Long id, AuthUser actor) {
        Event e = loadOwned(id, actor);
        if (e.getStatus() != EventStatus.PENDING) {
            throw ApiException.conflict("INVALID_STATUS", "Only events awaiting review can be withdrawn.");
        }
        e.setStatus(EventStatus.DRAFT);
        e.setSubmittedAt(null);
        audit.record(actor, "EVENT_WITHDRAWN", "EVENT", e.getId(), "Submission withdrawn: " + e.getTitle());
        return toDetail(e, actor, true, false);
    }

    @Transactional
    public EventDtos.EventDetail unpublish(Long id, AuthUser actor) {
        Event e = loadOwned(id, actor);
        if (e.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("INVALID_STATUS", "Only published events can be unpublished.");
        }
        if (events.currentSold(e.getId()) > 0) {
            throw ApiException.conflict("HAS_REGISTRATIONS",
                    "People are already registered. Cancel the event instead so they're notified.");
        }
        e.setStatus(EventStatus.DRAFT);
        e.setPublishedAt(null);
        audit.record(actor, "EVENT_UNPUBLISHED", "EVENT", e.getId(), "Unpublished: " + e.getTitle());
        return toDetail(e, actor, true, false);
    }

    @Transactional
    public EventDtos.EventDetail cancel(Long id, String reason, AuthUser actor) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        boolean owner = e.isOwnedBy(actor.getId());
        if (!owner && !actor.isAdmin()) {
            throw ApiException.forbidden("Only the organizer or an administrator can cancel this event.");
        }
        if (e.getStatus() != EventStatus.PUBLISHED && e.getStatus() != EventStatus.PENDING) {
            throw ApiException.conflict("INVALID_STATUS", "Only published or pending events can be cancelled. Delete drafts instead.");
        }
        if (e.hasEnded(Instant.now(clock))) {
            throw ApiException.conflict("ENDED", "This event has already ended.");
        }
        Instant now = Instant.now(clock);
        List<BookingOrder> active = orders.findByEventIdAndStatus(e.getId(), OrderStatus.CONFIRMED);
        Set<Long> attendeeIds = new LinkedHashSet<>();
        for (BookingOrder o : active) {
            List<Ticket> ts = tickets.findByOrderId(o.getId());
            inventory.release(e.getId(), ts);
            ts.forEach(t -> t.setStatus(TicketStatus.CANCELLED));
            o.setStatus(OrderStatus.CANCELLED);
            o.setCancelledAt(now);
            if (o.getPaymentStatus() == PaymentStatus.SIMULATED_PAID) o.setPaymentStatus(PaymentStatus.SIMULATED_REFUNDED);
            attendeeIds.add(o.getUser().getId());
        }
        e.setStatus(EventStatus.CANCELLED);
        e.setCancelledAt(now);
        e.setCancelReason(reason.trim());
        audit.record(actor, "EVENT_CANCELLED", "EVENT", e.getId(),
                "Cancelled: " + e.getTitle() + " (" + active.size() + " bookings cancelled)");
        notifications.notifyAll(attendeeIds, "EVENT_CANCELLED", e.getTitle() + " has been cancelled",
                "Reason from the organizer: " + reason.trim() + " Your booking has been cancelled.",
                "/account/tickets");
        if (!owner) {
            notifications.notify(e.getOrganizer(), "EVENT_CANCELLED", "An administrator cancelled " + e.getTitle(),
                    "Reason: " + reason.trim(), "/organizer/events/" + e.getId());
        }
        return toDetail(e, actor, owner, actor.isAdmin());
    }

    @Transactional
    public void delete(Long id, AuthUser actor) {
        Event e = loadOwned(id, actor);
        if (e.getStatus() != EventStatus.DRAFT && e.getStatus() != EventStatus.REJECTED) {
            throw ApiException.conflict("INVALID_STATUS", "Only drafts and rejected events can be deleted.");
        }
        if (orders.countByEventId(e.getId()) > 0) {
            throw ApiException.conflict("HAS_REGISTRATIONS", "This event has booking history and can't be deleted.");
        }
        String title = e.getTitle();
        ticketTypes.deleteAll(ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId()));
        events.delete(e);
        audit.record(actor, "EVENT_DELETED", "EVENT", id, "Deleted draft: " + title);
    }

    @Transactional(readOnly = true)
    public PageResponse<EventDtos.EventSummary> organizerEvents(AuthUser actor, String status, String q, int page, int size) {
        Long organizerId = actor.getId();
        Instant now = Instant.now(clock);
        Specification<Event> spec = (root, query, cb) -> {
            joins(root, query);
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("organizer").get("id"), organizerId));
            addStatusFilter(p, root, cb, status, now);
            if (notBlank(q)) p.add(cb.like(cb.lower(root.<String>get("title")), "%" + q.trim().toLowerCase(Locale.ROOT) + "%"));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Page<Event> result = events.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Order.desc("updatedAt"))));
        return PageResponse.of(result, mapper::toSummary);
    }

    // =====================================================================  administration

    @Transactional(readOnly = true)
    public PageResponse<EventDtos.EventSummary> adminEvents(String status, String q, int page, int size) {
        Instant now = Instant.now(clock);
        Specification<Event> spec = (root, query, cb) -> {
            Joins j = joins(root, query);
            List<Predicate> p = new ArrayList<>();
            addStatusFilter(p, root, cb, status, now);
            if (notBlank(q)) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                p.add(cb.or(cb.like(cb.lower(root.<String>get("title")), like), cb.like(cb.lower(j.organizer.<String>get("fullName")), like),
                        cb.like(cb.lower(cb.coalesce(j.organizer.<String>get("organizationName"), "")), like)));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        Sort sort = "PENDING".equalsIgnoreCase(status)
                ? Sort.by(Sort.Order.asc("submittedAt"))
                : Sort.by(Sort.Order.desc("createdAt"));
        Page<Event> result = events.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), sort));
        return PageResponse.of(result, mapper::toSummary);
    }

    @Transactional
    public EventDtos.EventDetail approve(Long id, AuthUser admin) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        if (e.getStatus() != EventStatus.PENDING) {
            throw ApiException.conflict("INVALID_STATUS", "Only events awaiting review can be approved.");
        }
        if (!e.getStartsAt().isAfter(Instant.now(clock))) {
            throw ApiException.conflict("START_PASSED", "This event's start time has passed. Reject it so the organizer can reschedule.");
        }
        e.setStatus(EventStatus.PUBLISHED);
        e.setPublishedAt(Instant.now(clock));
        e.setRejectionReason(null);
        saveApproval(e, admin, ApprovalDecision.APPROVED, null);
        audit.record(admin, "EVENT_APPROVED", "EVENT", e.getId(), "Approved: " + e.getTitle());
        notifications.notify(e.getOrganizer(), "EVENT_APPROVED", "Approved: " + e.getTitle(),
                "Your event is live and open for registration.", "/events/" + e.getSlug());
        return toDetail(e, admin, false, true);
    }

    @Transactional
    public EventDtos.EventDetail reject(Long id, String reason, AuthUser admin) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        if (e.getStatus() != EventStatus.PENDING) {
            throw ApiException.conflict("INVALID_STATUS", "Only events awaiting review can be rejected.");
        }
        String trimmed = reason.trim();
        e.setStatus(EventStatus.REJECTED);
        e.setRejectionReason(trimmed);
        saveApproval(e, admin, ApprovalDecision.REJECTED, trimmed);
        audit.record(admin, "EVENT_REJECTED", "EVENT", e.getId(), "Rejected: " + e.getTitle() + " — " + trimmed);
        notifications.notify(e.getOrganizer(), "EVENT_REJECTED", "Changes requested: " + e.getTitle(),
                "Reviewer note: " + trimmed, "/organizer/events/" + e.getId() + "/edit");
        return toDetail(e, admin, false, true);
    }

    @Transactional
    public EventDtos.EventSummary setFeatured(Long id, boolean featured, AuthUser admin) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        if (featured && e.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("INVALID_STATUS", "Only published events can be featured.");
        }
        e.setFeatured(featured);
        audit.record(admin, featured ? "EVENT_FEATURED" : "EVENT_UNFEATURED", "EVENT", e.getId(),
                (featured ? "Featured: " : "Unfeatured: ") + e.getTitle());
        return mapper.toSummary(e);
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.ApprovalRecordResponse> approvalHistory(int page, int size) {
        Page<ApprovalRecord> result = approvals.findAllByOrderByCreatedAtDesc(
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        return PageResponse.of(result, a -> new AdminDtos.ApprovalRecordResponse(a.getId(), a.getEvent().getId(),
                a.getEvent().getTitle(), a.getEvent().getSlug(), a.getAdmin() == null ? "Deleted admin" : a.getAdmin().getFullName(),
                a.getDecision().name(), a.getReason(), a.getCreatedAt()));
    }

    // =====================================================================  helpers

    /** Loads an event the actor owns. Non-owners get 404 for non-public events and 403 otherwise. */
    @Transactional(readOnly = true)
    public Event loadOwned(Long id, AuthUser actor) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        if (!e.isOwnedBy(actor.getId())) {
            if (e.getStatus() != EventStatus.PUBLISHED && !actor.isAdmin()) {
                throw ApiException.notFound("Event");
            }
            throw ApiException.forbidden("Only the event's organizer can do that.");
        }
        return e;
    }

    /** Loads an event the actor owns or administers (read access to registrations, analytics, check-in). */
    @Transactional(readOnly = true)
    public Event loadManaged(Long id, AuthUser actor) {
        Event e = events.findById(id).orElseThrow(() -> ApiException.notFound("Event"));
        if (!e.isOwnedBy(actor.getId()) && !actor.isAdmin()) {
            throw ApiException.forbidden("Only the event's organizer or an administrator can do that.");
        }
        return e;
    }

    private void requireOrganizer(AuthUser actor) {
        if (!actor.hasRole(Role.ORGANIZER)) {
            throw ApiException.forbidden("Only organizers can create events.");
        }
    }

    private void apply(Event e, EventDtos.EventUpsertRequest req) {
        Category category = categories.findBySlug(req.categorySlug().trim())
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_CATEGORY", "Choose a valid category."));
        try {
            ZoneId.of(req.timezone().trim());
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_TIMEZONE", "Choose a valid time zone.");
        }
        if (Duration.between(req.startsAt(), req.endsAt()).toDays() > 30) {
            throw ApiException.badRequest("TOO_LONG", "Events can last at most 30 days.");
        }
        e.setTitle(req.title().trim());
        e.setSummary(req.summary().trim());
        e.setDescription(req.description().trim());
        e.setCategory(category);
        e.setCoverImageUrl(blankToNull(req.coverImageUrl()));
        e.setStartsAt(req.startsAt());
        e.setEndsAt(req.endsAt());
        e.setTimezone(req.timezone().trim());
        e.setFormat(req.format());
        e.setOnlineUrl(req.format() == EventFormat.IN_PERSON ? null : blankToNull(req.onlineUrl()));
        if (req.format() == EventFormat.ONLINE) {
            e.setVenue(null);
        } else if (notBlank(req.venueName()) && notBlank(req.city())) {
            e.setVenue(resolveVenue(req.venueName().trim(), blankToNull(req.venueAddress()), req.city().trim()));
        } else {
            e.setVenue(null);
        }
        e.getSchedule().clear();
        if (req.schedule() != null) {
            int i = 0;
            for (EventDtos.ScheduleItemRequest s : req.schedule()) {
                if (s.startsAt().isBefore(req.startsAt().minus(Duration.ofHours(12))) || s.startsAt().isAfter(req.endsAt())) {
                    throw ApiException.badRequest("SCHEDULE_OUT_OF_RANGE",
                            "Schedule item \"" + s.title() + "\" must fall within the event's start and end time.");
                }
                ScheduleItem item = new ScheduleItem();
                item.setEvent(e);
                item.setStartsAt(s.startsAt());
                item.setTitle(s.title().trim());
                item.setDescription(blankToNull(s.description()));
                item.setSortOrder(i++);
                e.getSchedule().add(item);
            }
        }
    }

    private Venue resolveVenue(String name, String address, String city) {
        return venues.findFirstByNameIgnoreCaseAndCityIgnoreCase(name, city).map(v -> {
            if (address != null && !address.equals(v.getAddress())) v.setAddress(address);
            return v;
        }).orElseGet(() -> {
            Venue v = new Venue();
            v.setName(name);
            v.setAddress(address);
            v.setCity(city);
            return venues.save(v);
        });
    }

    private void validateForSubmission(Event e) {
        List<String> problems = new ArrayList<>();
        Instant now = Instant.now(clock);
        int leadHours = settings.getInt(SettingsService.MIN_LEAD_HOURS);
        if (e.getStartsAt().isBefore(now.plus(Duration.ofHours(leadHours)))) {
            problems.add("start at least " + leadHours + " hours from now");
        }
        if (e.getCoverImageUrl() == null) problems.add("add a cover image");
        if (e.getDescription().length() < 80) problems.add("write a description of at least 80 characters");
        if (e.getFormat() != EventFormat.ONLINE && e.getVenue() == null) problems.add("add a venue and city");
        if (e.getFormat() != EventFormat.IN_PERSON && e.getOnlineUrl() == null) problems.add("add the online event link");
        List<TicketType> types = ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId());
        if (types.isEmpty()) problems.add("add at least one ticket type");
        if (types.size() > settings.getInt(SettingsService.MAX_TICKET_TYPES)) {
            problems.add("use at most " + settings.getInt(SettingsService.MAX_TICKET_TYPES) + " ticket types");
        }
        for (TicketType t : types) {
            if (t.getSalesEnd() != null && t.getSalesEnd().isAfter(e.getEndsAt())) {
                problems.add("end sales for \"" + t.getName() + "\" before the event ends");
            }
        }
        if (!problems.isEmpty()) {
            throw ApiException.unprocessable("NOT_READY", "Before submitting, " + String.join("; ", problems) + ".");
        }
    }

    private void saveApproval(Event e, AuthUser admin, ApprovalDecision decision, String reason) {
        ApprovalRecord r = new ApprovalRecord();
        r.setEvent(e);
        r.setAdmin(users.getReferenceById(admin.getId()));
        r.setDecision(decision);
        r.setReason(reason);
        approvals.save(r);
    }

    private String logistics(Event e) {
        ZoneId zone = ZoneId.of(e.getTimezone());
        String where = e.getFormat() == EventFormat.ONLINE ? "Online"
                : e.getVenue() == null ? "Venue TBA" : e.getVenue().getName() + ", " + e.getVenue().getCity();
        return HUMAN.format(e.getStartsAt().atZone(zone)) + " – " + HUMAN.format(e.getEndsAt().atZone(zone)) + " at " + where;
    }

    private Event findByIdOrSlug(String idOrSlug) {
        Optional<Event> found = idOrSlug.chars().allMatch(Character::isDigit) && idOrSlug.length() < 19
                ? events.findById(Long.parseLong(idOrSlug))
                : events.findBySlug(idOrSlug);
        return found.orElseThrow(() -> ApiException.notFound("Event"));
    }

    private String uniqueSlug(String title) {
        String slug;
        do {
            slug = codes.slug(title);
        } while (events.existsBySlug(slug));
        return slug;
    }

    private void addStatusFilter(List<Predicate> p, Root<Event> root, CriteriaBuilder cb, String status, Instant now) {
        if (!notBlank(status) || "ALL".equalsIgnoreCase(status)) return;
        if ("COMPLETED".equalsIgnoreCase(status)) {
            p.add(cb.equal(root.get("status"), EventStatus.PUBLISHED));
            p.add(cb.lessThan(root.get("endsAt"), now));
            return;
        }
        if ("LIVE".equalsIgnoreCase(status)) {
            p.add(cb.equal(root.get("status"), EventStatus.PUBLISHED));
            p.add(cb.greaterThanOrEqualTo(root.get("endsAt"), now));
            return;
        }
        try {
            p.add(cb.equal(root.get("status"), EventStatus.valueOf(status.toUpperCase(Locale.ROOT))));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_STATUS_FILTER", "Unknown status filter: " + status);
        }
    }

    private record Joins(From<?, Category> category, From<?, Venue> venue, From<?, User> organizer) {
    }

    /** Fetch-joins associations for list queries (avoids N+1) and plain-joins them for count queries. */
    @SuppressWarnings("unchecked")
    private static Joins joins(Root<Event> root, CriteriaQuery<?> query) {
        boolean count = query.getResultType() == Long.class || query.getResultType() == long.class;
        if (count) {
            return new Joins(root.join("category"), root.join("venue", JoinType.LEFT), root.join("organizer"));
        }
        // Explicit type witnesses: without them fetch(..) infers Fetch<Object, Object>, whose
        // FetchParent<?, Object> supertype is provably distinct from From<?, Category> and the cast won't compile.
        return new Joins((From<?, Category>) root.<Event, Category>fetch("category"),
                (From<?, Venue>) root.<Event, Venue>fetch("venue", JoinType.LEFT),
                (From<?, User>) root.<Event, User>fetch("organizer"));
    }

    EventDtos.EventDetail toDetail(Event e, AuthUser viewer, boolean owner, boolean admin) {
        Instant now = Instant.now(clock);
        List<TicketType> types = ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId());
        String state;
        String message;
        if (e.getStatus() == EventStatus.CANCELLED) {
            state = "CANCELLED";
            message = "This event was cancelled by the organizer.";
        } else if (e.getStatus() != EventStatus.PUBLISHED) {
            state = "UNAVAILABLE";
            message = "This event isn't published yet.";
        } else if (e.hasEnded(now)) {
            state = "ENDED";
            message = "This event has ended.";
        } else if (!e.getStartsAt().isAfter(now)) {
            state = "CLOSED";
            message = "Registration closed when the event started.";
        } else if (!types.isEmpty() && types.stream().allMatch(t -> t.remaining() == 0)) {
            state = "SOLD_OUT";
            message = "Every ticket has been claimed.";
        } else if (types.stream().anyMatch(t -> t.remaining() > 0 && t.isOnSale(now))) {
            state = "OPEN";
            message = null;
        } else {
            Optional<Instant> nextOpen = types.stream().filter(t -> t.remaining() > 0 && t.getSalesStart() != null
                    && t.getSalesStart().isAfter(now)).map(TicketType::getSalesStart).min(Comparator.naturalOrder());
            if (nextOpen.isPresent()) {
                state = "NOT_YET_OPEN";
                message = "Tickets go on sale " + HUMAN.format(nextOpen.get().atZone(ZoneId.of(e.getTimezone()))) + ".";
            } else {
                state = "CLOSED";
                message = "Ticket sales have closed.";
            }
        }

        String bookingRef = null;
        if (viewer != null && viewer.hasRole(Role.ATTENDEE)) {
            bookingRef = orders.findFirstByUserIdAndEventIdAndStatus(viewer.getId(), e.getId(), OrderStatus.CONFIRMED)
                    .map(BookingOrder::getReference).orElse(null);
        }
        boolean canSeeLink = owner || admin || bookingRef != null;
        User org = e.getOrganizer();
        EventDtos.OrganizerRef organizer = new EventDtos.OrganizerRef(org.getId(), org.getFullName(),
                org.getOrganizationName(), org.getAvatarUrl(), org.getBio(),
                events.countByOrganizerIdAndStatus(org.getId(), EventStatus.PUBLISHED));
        List<EventDtos.ApprovalHistoryItem> history = (owner || admin)
                ? approvals.findByEventIdOrderByCreatedAtDesc(e.getId()).stream()
                    .map(a -> new EventDtos.ApprovalHistoryItem(a.getDecision().name(), a.getReason(),
                            a.getAdmin() == null ? null : a.getAdmin().getFullName(), a.getCreatedAt()))
                    .toList()
                : List.of();
        int sold = types.stream().mapToInt(TicketType::getSold).sum();
        return new EventDtos.EventDetail(e.getId(), e.getSlug(), e.getTitle(), e.getSummary(), e.getDescription(),
                e.getCoverImageUrl(), mapper.category(e.getCategory()), e.getStartsAt(), e.getEndsAt(), e.getTimezone(),
                e.getFormat(), mapper.venue(e.getVenue()), canSeeLink ? e.getOnlineUrl() : null,
                !canSeeLink && e.getOnlineUrl() != null, e.getStatus(), mapper.availability(e), state, message,
                e.isFeatured(), e.isSeed(), e.getMinPriceCents(), "INR", e.getTotalCapacity(), sold,
                mapper.schedule(e), types.stream().map(mapper::toTicketType).toList(), organizer,
                (owner || admin) ? e.getRejectionReason() : null, e.getCancelReason(), e.getSubmittedAt(),
                e.getPublishedAt(), e.getCreatedAt(), e.getUpdatedAt(), owner, bookingRef, history);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
