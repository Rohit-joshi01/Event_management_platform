package com.aftr.seed;

import com.aftr.entity.*;
import com.aftr.repository.*;
import com.aftr.service.CodeGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Writes the demonstration dataset. All dates are relative to "now" so the demo never goes stale. */
@Component
public class DemoDataWriter {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String IMG = "https://images.unsplash.com/photo-%s?auto=format&fit=crop&w=1800&q=80";

    private final UserRepository users;
    private final CategoryRepository categories;
    private final VenueRepository venues;
    private final EventRepository events;
    private final TicketTypeRepository ticketTypes;
    private final BookingOrderRepository orders;
    private final TicketRepository tickets;
    private final ApprovalRecordRepository approvals;
    private final NotificationRepository notifications;
    private final AnnouncementRepository announcements;
    private final AuditLogRepository auditLogs;
    private final PasswordEncoder passwordEncoder;
    private final CodeGenerator codes;

    private final Random random = new Random(20261010L);
    private Instant now;
    private final List<AuditLog> pendingAudit = new ArrayList<>();

    public DemoDataWriter(UserRepository users, CategoryRepository categories, VenueRepository venues,
                          EventRepository events, TicketTypeRepository ticketTypes, BookingOrderRepository orders,
                          TicketRepository tickets, ApprovalRecordRepository approvals,
                          NotificationRepository notifications, AnnouncementRepository announcements,
                          AuditLogRepository auditLogs, PasswordEncoder passwordEncoder, CodeGenerator codes) {
        this.users = users;
        this.categories = categories;
        this.venues = venues;
        this.events = events;
        this.ticketTypes = ticketTypes;
        this.orders = orders;
        this.tickets = tickets;
        this.approvals = approvals;
        this.notifications = notifications;
        this.announcements = announcements;
        this.auditLogs = auditLogs;
        this.passwordEncoder = passwordEncoder;
        this.codes = codes;
    }

    // ------------------------------------------------------------------ specs

    private record Tier(String name, String description, long pricePaise, int quantity, int targetSold, int maxPerOrder) {
    }

    private record Spec(String key, String organizerKey, String category, String title, String summary,
                        String description, String image, String venueKey, int dayOffset, int startHour,
                        int startMinute, int durationHours, EventStatus status, boolean featured, List<Tier> tiers,
                        List<String[]> schedule, String note) {
    }

    // ------------------------------------------------------------------ entry point

    @Transactional
    public void write() {
        now = Instant.now().truncatedTo(ChronoUnit.MINUTES);

        String attendeeHash = passwordEncoder.encode("Attendee@2026");
        String organizerHash = passwordEncoder.encode("Organizer@2026");

        User admin = user("admin@aftr.dev", "Nandini Rao", Role.ADMIN, passwordEncoder.encode("Admin@2026"), null, 160);
        admin.setBio("Platform operations lead.");
        User admin2 = user("ops@aftr.dev", "Farhan Siddiqui", Role.ADMIN, admin.getPasswordHash(), null, 150);

        Map<String, User> organizers = new LinkedHashMap<>();
        organizers.put("northfield", user("organizer@aftr.dev", "Priya Sharma", Role.ORGANIZER, organizerHash,
                "Northfield Tech Society", 140));
        organizers.get("northfield").setBio("A volunteer-run collective hosting applied-tech summits, hack weekends and founder dinners across North and South India.");
        organizers.get("northfield").setCity("Bengaluru");
        organizers.put("lowlight", user("lowlight@aftr.dev", "Arjun Rao", Role.ORGANIZER, organizerHash,
                "Lowlight Collective", 130));
        organizers.get("lowlight").setBio("Small rooms, big sound. Lowlight books independent electronic and acoustic acts in Mumbai, Delhi and Hyderabad.");
        organizers.get("lowlight").setCity("Mumbai");
        organizers.put("kinetic", user("studio@aftr.dev", "Meera Nair", Role.ORGANIZER, organizerHash,
                "Studio Kinetic", 120));
        organizers.get("kinetic").setBio("A design and motion studio running hands-on workshops, open studios and exhibitions about type, image and code.");
        organizers.get("kinetic").setCity("Pune");
        organizers.put("commonground", user("commonground@aftr.dev", "Kabir Malhotra", Role.ORGANIZER, organizerHash,
                "Common Ground Collective", 110));
        organizers.get("commonground").setBio("Neighbourhood-first gatherings: supper clubs, runs, markets and screenings that bring strangers to the same table.");
        organizers.get("commonground").setCity("New Delhi");

        User demoAttendee = user("attendee@aftr.dev", "Aarav Mehta", Role.ATTENDEE, attendeeHash, null, 95);
        demoAttendee.setCity("Bengaluru");
        demoAttendee.setBio("Product designer. Usually at the back of the room taking notes.");
        List<User> attendees = new ArrayList<>();
        attendees.add(demoAttendee);
        String[] first = {"Ananya", "Rohan", "Diya", "Kabir", "Isha", "Vihaan", "Saanvi", "Arjun", "Meera", "Aditya",
                "Tara", "Nikhil", "Zoya", "Ishaan", "Riya", "Karan", "Neha", "Siddharth", "Pooja", "Rahul",
                "Aisha", "Varun", "Sneha", "Harsh", "Kavya", "Manav", "Nisha", "Yash", "Ira", "Dev"};
        String[] last = {"Iyer", "Kapoor", "Sharma", "Singh", "Reddy", "Gupta", "Nair", "Desai", "Pillai", "Joshi",
                "Menon", "Verma", "Khan", "Bose", "Chatterjee", "Bhat", "Agarwal", "Kulkarni", "Das", "Saxena"};
        for (int i = 0; i < 220; i++) {
            String fn = first[i % first.length];
            String ln = last[(i / first.length + i % first.length) % last.length];
            String email = (fn + "." + ln).toLowerCase(Locale.ROOT) + "@demo.aftr.dev";
            User u = user(email, fn + " " + ln, Role.ATTENDEE, attendeeHash, null, 2 + random.nextInt(110));
            if (i % 23 == 4) u.setStatus(UserStatus.SUSPENDED);
            attendees.add(u);
        }
        users.saveAll(List.of(admin, admin2));
        users.saveAll(organizers.values());
        users.saveAll(attendees);
        users.flush();
        List<User> activeAttendees = attendees.stream().filter(u -> u.getStatus() == UserStatus.ACTIVE).toList();

        Map<String, Venue> venueMap = venues();
        Map<String, Category> cats = new HashMap<>();
        categories.findAll().forEach(c -> cats.put(c.getSlug(), c));

        Map<String, Event> created = new LinkedHashMap<>();
        for (Spec spec : specs()) {
            Event e = event(spec, organizers.get(spec.organizerKey()), cats.get(spec.category()), venueMap.get(spec.venueKey()));
            created.put(spec.key(), e);
            List<TicketType> types = new ArrayList<>();
            int order = 0;
            for (Tier tier : spec.tiers()) {
                TicketType t = new TicketType();
                t.setEvent(e);
                t.setName(tier.name());
                t.setDescription(tier.description());
                t.setPriceCents(tier.pricePaise());
                t.setQuantity(tier.quantity());
                t.setMaxPerOrder(tier.maxPerOrder());
                t.setSortOrder(order++);
                t.setCreatedAt(e.getCreatedAt());
                if ("Early Bird".equals(tier.name())) {
                    t.setSalesEnd(e.getStartsAt().minus(Duration.ofDays(3)));
                }
                types.add(t);
            }
            ticketTypes.saveAll(types);
            e.setMinPriceCents(types.stream().mapToLong(TicketType::getPriceCents).min().orElse(0));
            e.setTotalCapacity(types.stream().mapToInt(TicketType::getQuantity).sum());
            ticketTypes.flush();

            if (e.getStatus() == EventStatus.PUBLISHED) {
                approve(e, admin, spec);
                for (int i = 0; i < types.size(); i++) {
                    sell(e, types.get(i), spec.tiers().get(i).targetSold(), activeAttendees, demoAttendee);
                }
            } else if (e.getStatus() == EventStatus.PENDING) {
                audit(e.getOrganizer(), "EVENT_SUBMITTED", "EVENT", e.getId(), "Submitted for review: " + e.getTitle(), e.getSubmittedAt());
                notification(admin, "APPROVAL_REQUEST", "New submission: " + e.getTitle(),
                        e.getOrganizer().getOrganizationName() + " submitted an event for review.", "/admin/approvals", e.getSubmittedAt(), false);
                notification(admin2, "APPROVAL_REQUEST", "New submission: " + e.getTitle(),
                        e.getOrganizer().getOrganizationName() + " submitted an event for review.", "/admin/approvals", e.getSubmittedAt(), false);
            } else if (e.getStatus() == EventStatus.REJECTED) {
                ApprovalRecord r = new ApprovalRecord();
                r.setEvent(e);
                r.setAdmin(admin);
                r.setDecision(ApprovalDecision.REJECTED);
                r.setReason(spec.note());
                r.setCreatedAt(earliest(e.getSubmittedAt().plus(Duration.ofHours(20)), now.minus(Duration.ofHours(1))));
                approvals.save(r);
                audit(admin, "EVENT_REJECTED", "EVENT", e.getId(), "Rejected: " + e.getTitle() + " — " + spec.note(), r.getCreatedAt());
                notification(e.getOrganizer(), "EVENT_REJECTED", "Changes requested: " + e.getTitle(),
                        "Reviewer note: " + spec.note(), "/organizer/events/" + e.getId() + "/edit", r.getCreatedAt(), false);
            } else if (e.getStatus() == EventStatus.CANCELLED) {
                approve(e, admin, spec);
                audit(e.getOrganizer(), "EVENT_CANCELLED", "EVENT", e.getId(), "Cancelled: " + e.getTitle(), e.getCancelledAt());
            } else {
                audit(e.getOrganizer(), "EVENT_CREATED", "EVENT", e.getId(), "Draft created: " + e.getTitle(), e.getCreatedAt());
            }
        }

        demoAttendeeExtras(demoAttendee, created);
        announcement(created.get("lowlight14"), organizers.get("lowlight"), "Set times and entry",
                "Doors at 7:30 PM, first set at 8:15. Entry is from the side lane — bring your QR ticket on your phone. "
                        + "The room is standing-only; there's a coat check by the bar.");
        announcement(created.get("signal"), organizers.get("northfield"), "Venue access and Wi-Fi",
                "Registration desk opens at 8:30 AM at the Foundry's north entrance. Carry a photo ID that matches your ticket. "
                        + "Wi-Fi details will be on your badge.");

        for (User u : users.findAll()) {
            audit(u, "USER_REGISTERED", "USER", u.getId(), "New " + u.getRole().name().toLowerCase(Locale.ROOT) + " account: " + u.getFullName(), u.getCreatedAt());
        }
        audit(admin, "SETTINGS_UPDATED", "SETTINGS", null, "Updated events.minLeadHours=24", now.minus(Duration.ofDays(40)));
        attendees.stream().filter(u -> u.getStatus() == UserStatus.SUSPENDED).forEach(u ->
                audit(admin, "USER_SUSPENDED", "USER", u.getId(), "Suspended " + u.getEmail(), now.minus(Duration.ofDays(3 + random.nextInt(20)))));

        auditLogs.saveAll(pendingAudit);
    }

    // ------------------------------------------------------------------ builders

    private User user(String email, String name, Role role, String hash, String org, int daysAgo) {
        User u = new User();
        u.setEmail(email);
        u.setFullName(name);
        u.setRole(role);
        u.setPasswordHash(hash);
        u.setOrganizationName(org);
        u.setStatus(UserStatus.ACTIVE);
        u.setSeed(true);
        u.setCreatedAt(now.minus(Duration.ofDays(daysAgo)).minus(Duration.ofMinutes(random.nextInt(600))));
        u.setLastLoginAt(now.minus(Duration.ofHours(random.nextInt(24 * 20) + 1)));
        return u;
    }

    private Map<String, Venue> venues() {
        Map<String, Venue> m = new LinkedHashMap<>();
        m.put("foundry", venue("The Foundry", "14 Defence Colony Road, Indiranagar", "Bengaluru"));
        m.put("courtyard9", venue("Courtyard No. 9", "9 Rest House Crescent, Richmond Town", "Bengaluru"));
        m.put("warehouse21", venue("Warehouse 21", "Mill Compound, Senapati Bapat Marg, Lower Parel", "Mumbai"));
        m.put("pier7", venue("Pier Seven Studios", "Apollo Bunder Lane, Colaba", "Mumbai"));
        m.put("millhall", venue("The Mill Hall", "Plot 41, Okhla Industrial Area Phase III", "New Delhi"));
        m.put("lodhi", venue("Lodhi Garden — Gate 1", "Lodhi Road", "New Delhi"));
        m.put("kinetic", venue("Kinetic Room", "Lane 6, Koregaon Park", "Pune"));
        m.put("hub", venue("Innovation Hub", "Knowledge Park II", "Greater Noida"));
        m.put("casaazul", venue("Casa Azul Gallery", "31 Rua de Natal, Fontainhas", "Panaji"));
        m.put("skyline", venue("Skyline Deck", "Level 12, Cyber Towers Road, HITEC City", "Hyderabad"));
        m.put("mudhouse", venue("Mudhouse Studio", "Road No. 36, Jubilee Hills", "Hyderabad"));
        m.put("turf", venue("Turf Arena", "Gachibowli Stadium Road", "Hyderabad"));
        m.put("marketyard", venue("Old Market Yard", "Shivaji Road, Kasba Peth", "Pune"));
        venues.saveAll(m.values());
        return m;
    }

    private Venue venue(String name, String address, String city) {
        Venue v = new Venue();
        v.setName(name);
        v.setAddress(address);
        v.setCity(city);
        v.setCountry("India");
        return v;
    }

    private Event event(Spec s, User organizer, Category category, Venue venue) {
        Event e = new Event();
        e.setOrganizer(organizer);
        e.setCategory(category);
        e.setVenue(venue);
        e.setFormat(venue == null ? EventFormat.ONLINE : EventFormat.IN_PERSON);
        if (venue == null) e.setOnlineUrl("https://meet.aftr.dev/" + s.key());
        e.setTitle(s.title());
        e.setSlug(codes.slug(s.title()));
        e.setSummary(s.summary());
        e.setDescription(s.description());
        e.setCoverImageUrl(String.format(IMG, s.image()));
        LocalDate day = now.atZone(IST).toLocalDate().plusDays(s.dayOffset());
        ZonedDateTime start = day.atTime(s.startHour(), s.startMinute()).atZone(IST);
        e.setStartsAt(start.toInstant());
        e.setEndsAt(start.plusHours(s.durationHours()).toInstant());
        e.setTimezone("Asia/Kolkata");
        e.setStatus(s.status());
        e.setFeatured(s.featured());
        e.setSeed(true);
        Instant createdAt = earliest(e.getStartsAt().minus(Duration.ofDays(30 + random.nextInt(25))), now.minus(Duration.ofDays(2)));
        e.setCreatedAt(createdAt);
        if (s.status() != EventStatus.DRAFT) {
            e.setSubmittedAt(earliest(createdAt.plus(Duration.ofDays(2)), now.minus(Duration.ofHours(6 + random.nextInt(40)))));
        }
        if (s.status() == EventStatus.PUBLISHED || s.status() == EventStatus.CANCELLED) {
            // submittedAt can be as recent as 6 hours ago; never publish (or sell) in the future.
            e.setPublishedAt(earliest(e.getSubmittedAt().plus(Duration.ofHours(18)), now.minus(Duration.ofHours(1))));
        }
        if (s.status() == EventStatus.REJECTED) e.setRejectionReason(s.note());
        if (s.status() == EventStatus.CANCELLED) {
            e.setCancelReason(s.note());
            e.setCancelledAt(now.minus(Duration.ofDays(2)));
        }
        int i = 0;
        for (String[] item : s.schedule()) {
            ScheduleItem si = new ScheduleItem();
            si.setEvent(e);
            String[] hm = item[0].split(":");
            int dayShift = item.length > 3 ? Integer.parseInt(item[3]) : 0;
            si.setStartsAt(day.plusDays(dayShift).atTime(Integer.parseInt(hm[0]), Integer.parseInt(hm[1])).atZone(IST).toInstant());
            si.setTitle(item[1]);
            si.setDescription(item[2]);
            si.setSortOrder(i++);
            e.getSchedule().add(si);
        }
        events.saveAndFlush(e);
        return e;
    }

    private void approve(Event e, User admin, Spec spec) {
        ApprovalRecord r = new ApprovalRecord();
        r.setEvent(e);
        r.setAdmin(admin);
        r.setDecision(ApprovalDecision.APPROVED);
        r.setCreatedAt(e.getPublishedAt());
        approvals.save(r);
        audit(e.getOrganizer(), "EVENT_SUBMITTED", "EVENT", e.getId(), "Submitted for review: " + e.getTitle(), e.getSubmittedAt());
        audit(admin, "EVENT_APPROVED", "EVENT", e.getId(), "Approved: " + e.getTitle(), e.getPublishedAt());
        notification(e.getOrganizer(), "EVENT_APPROVED", "Approved: " + e.getTitle(),
                "Your event is live and open for registration.", "/events/" + e.getSlug(), e.getPublishedAt(), true);
    }

    /** Creates seeded bookings until {@code target} seats of this tier are taken. */
    private void sell(Event e, TicketType type, int target, List<User> pool, User demoAttendee) {
        if (target <= 0) return;
        List<User> shuffled = new ArrayList<>(pool);
        shuffled.remove(demoAttendee); // the demo attendee's bookings are curated separately
        Collections.shuffle(shuffled, random);
        Set<Long> already = new HashSet<>();
        orders.findByEventIdAndStatus(e.getId(), OrderStatus.CONFIRMED).forEach(o -> already.add(o.getUser().getId()));
        int remaining = target;
        Instant windowStart = e.getPublishedAt();
        Instant windowEnd = earliest(e.getStartsAt().minus(Duration.ofHours(2)), now.minus(Duration.ofMinutes(30)));
        boolean past = e.getEndsAt().isBefore(now);
        for (User u : shuffled) {
            if (remaining <= 0) break;
            if (!already.add(u.getId())) continue;
            int qty = Math.min(remaining, Math.min(type.getMaxPerOrder(), 1 + (random.nextInt(10) < 6 ? 0 : random.nextInt(3))));
            Instant at = between(windowStart, windowEnd);
            booking(u, e, type, qty, at, past);
            remaining -= qty;
        }
    }

    private BookingOrder booking(User u, Event e, TicketType type, int qty, Instant at, boolean pastEvent) {
        ticketTypes.reserve(type.getId(), e.getId(), qty);
        events.adjustSold(e.getId(), qty);
        BookingOrder o = new BookingOrder();
        o.setReference(codes.bookingReference());
        o.setUser(u);
        o.setEvent(e);
        o.setStatus(OrderStatus.CONFIRMED);
        o.setTotalCents(type.getPriceCents() * qty);
        o.setCurrency("INR");
        boolean paid = type.getPriceCents() > 0;
        o.setPaymentStatus(paid ? PaymentStatus.SIMULATED_PAID : PaymentStatus.NOT_REQUIRED);
        o.setPaymentProvider(paid ? PaymentProvider.DEV_SIMULATED : PaymentProvider.NONE);
        o.setSeed(true);
        o.setCreatedAt(at);
        orders.save(o);
        List<Ticket> ts = new ArrayList<>();
        for (int i = 0; i < qty; i++) {
            Ticket t = new Ticket();
            t.setOrder(o);
            t.setTicketType(type);
            t.setEvent(e);
            t.setUser(u);
            t.setCode(codes.ticketCode());
            t.setPriceCents(type.getPriceCents());
            t.setCreatedAt(at);
            if (pastEvent && random.nextInt(100) < 82) {
                t.setStatus(TicketStatus.CHECKED_IN);
                t.setCheckedInAt(e.getStartsAt().plus(Duration.ofMinutes(random.nextInt(90))));
            } else {
                t.setStatus(TicketStatus.VALID);
            }
            ts.add(t);
        }
        tickets.saveAll(ts);
        return o;
    }

    private void demoAttendeeExtras(User me, Map<String, Event> created) {
        record Pick(String eventKey, int tierIndex, int qty, int daysAgo, boolean cancel) {
        }
        List<Pick> picks = List.of(
                new Pick("signal", 1, 1, 6, false),
                new Pick("lowlight14", 0, 2, 3, false),
                new Pick("hackathon", 0, 1, 2, false),
                new Pick("designsystems", 0, 1, 1, false),
                new Pick("lowlight13", 0, 2, 26, false),
                new Pick("analytics", 0, 1, 14, false),
                new Pick("sunrise", 0, 1, 5, true));
        for (Pick p : picks) {
            Event e = created.get(p.eventKey());
            TicketType type = ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(e.getId()).get(p.tierIndex());
            if (type.getQuantity() - ticketTypes.currentSold(type.getId()) < p.qty()) continue;
            Instant at = earliest(now.minus(Duration.ofDays(p.daysAgo())), e.getStartsAt().minus(Duration.ofDays(1)));
            BookingOrder o = booking(me, e, type, p.qty(), at, e.getEndsAt().isBefore(now));
            notification(me, "BOOKING_CONFIRMED", "You're going to " + e.getTitle(),
                    "Booking " + o.getReference() + " is confirmed. Your QR tickets are in My Tickets.",
                    "/account/tickets/" + o.getReference(), at, e.getEndsAt().isBefore(now) || p.daysAgo() > 4);
            if (p.cancel()) {
                List<Ticket> ts = tickets.findByOrderId(o.getId());
                ticketTypes.release(type.getId(), ts.size());
                events.adjustSold(e.getId(), -ts.size());
                ts.forEach(t -> t.setStatus(TicketStatus.CANCELLED));
                o.setStatus(OrderStatus.CANCELLED);
                o.setCancelledAt(at.plus(Duration.ofDays(1)));
                o.setPaymentStatus(o.getPaymentStatus() == PaymentStatus.SIMULATED_PAID
                        ? PaymentStatus.SIMULATED_REFUNDED : o.getPaymentStatus());
                notification(me, "BOOKING_CANCELLED", "Booking cancelled: " + e.getTitle(),
                        "Booking " + o.getReference() + " was cancelled and your seats were released.",
                        "/account/tickets", o.getCancelledAt(), true);
            }
        }
        notification(me, "WELCOME", "Welcome to AFTR", "Find something worth showing up for. Your tickets and updates will live here.",
                "/events", me.getCreatedAt(), true);
        notification(me, "RECOMMENDATION", "Picked for you: Type in Motion",
                "A small-format kinetic typography workshop in Pune — only a few seats left.",
                "/events/" + created.get("typeinmotion").getSlug(), now.minus(Duration.ofHours(20)), false);
    }

    private void announcement(Event e, User sender, String subject, String message) {
        List<Long> recipients = orders.findConfirmedAttendeeIds(e.getId());
        Announcement a = new Announcement();
        a.setEvent(e);
        a.setSender(sender);
        a.setSubject(subject);
        a.setMessage(message);
        a.setRecipientCount(recipients.size());
        a.setChannel("IN_APP");
        Instant at = now.minus(Duration.ofHours(30));
        a.setCreatedAt(at);
        announcements.save(a);
        for (User u : users.findAllById(recipients)) {
            notification(u, "ANNOUNCEMENT", e.getTitle() + ": " + subject, message, "/events/" + e.getSlug(), at, false);
        }
        audit(sender, "ANNOUNCEMENT_SENT", "EVENT", e.getId(), "\"" + subject + "\" sent to " + recipients.size() + " attendee(s) of " + e.getTitle(), at);
    }

    private void notification(User u, String type, String title, String body, String link, Instant at, boolean read) {
        Notification n = new Notification();
        n.setUser(u);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLink(link);
        n.setCreatedAt(at);
        if (read) n.setReadAt(at.plus(Duration.ofHours(2)));
        notifications.save(n);
    }

    private void audit(User actor, String action, String type, Long id, String summary, Instant at) {
        AuditLog a = new AuditLog();
        a.setActorId(actor == null ? null : actor.getId());
        a.setActorEmail(actor == null ? null : actor.getEmail());
        a.setAction(action);
        a.setEntityType(type);
        a.setEntityId(id);
        a.setSummary(summary.length() > 500 ? summary.substring(0, 497) + "..." : summary);
        a.setIpAddress("seed");
        a.setCreatedAt(at);
        pendingAudit.add(a);
    }

    private Instant between(Instant a, Instant b) {
        if (!b.isAfter(a)) return a;
        long span = Duration.between(a, b).toMinutes();
        // Skew towards recent dates so the 30-day charts have shape.
        double r = Math.pow(random.nextDouble(), 0.55);
        return a.plus(Duration.ofMinutes((long) (span * r)));
    }

    private static Instant earliest(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
    }

    private static Tier tier(String name, String desc, long rupees, int qty, int sold, int max) {
        return new Tier(name, desc, rupees * 100, qty, sold, max);
    }

    private static String[] at(String time, String title, String desc) {
        return new String[]{time, title, desc};
    }

    private static String[] at(String time, String title, String desc, int day) {
        return new String[]{time, title, desc, String.valueOf(day)};
    }

    // ------------------------------------------------------------------ content

    private List<Spec> specs() {
        List<Spec> s = new ArrayList<>();
        s.add(new Spec("signal", "northfield", "technology", "Signal/Noise: Applied AI Summit",
                "A one-day summit for engineers shipping machine learning into real products — no keynotes about the future, only talks about what broke.",
                """
                Signal/Noise is a working summit for people who put models into production and then have to live with them. Every talk is a case study from a team in India: what they shipped, what failed in week two, and how they measured whether it was worth it.

                The day runs on two tracks. The main hall covers evaluation, retrieval, latency budgets and cost control. The workshop room runs three 90-minute labs with a maximum of 40 people each — bring a laptop.

                Lunch, coffee and an evening mixer on the terrace are included with every ticket. Student tickets require a valid college ID at entry.""",
                "1540575467063-178a50c2df87", "foundry", 12, 9, 30, 9, EventStatus.PUBLISHED, true,
                List.of(tier("Early Bird", "Released to the first 60 registrations.", 1499, 60, 60, 2),
                        tier("Standard", "Full-day access to talks, labs (first come) and the evening mixer.", 2499, 240, 118, 4),
                        tier("Student", "Valid college ID required at the door.", 499, 80, 48, 1)),
                List.of(at("09:30", "Registration and coffee", "North entrance. Badges with Wi-Fi details."),
                        at("10:15", "Opening: The evaluation gap", "Why offline metrics keep lying to product teams."),
                        at("11:30", "Retrieval that survives contact with users", "A search team's rewrite, 18 months later."),
                        at("13:00", "Lunch on the terrace", null),
                        at("14:00", "Lab sessions (parallel)", "Latency budgets · Guardrails · Cost dashboards"),
                        at("17:30", "Panel: What we turned off", "Four teams on features they shipped and then removed."),
                        at("18:30", "Mixer", "Terrace. Food and drinks included.")),
                null));
        s.add(new Spec("lowlight14", "lowlight", "music", "Lowlight Sessions: Vol. 14",
                "Three live electronic sets in a 250-capacity warehouse. Low light, loud system, no phones on the dance floor.",
                """
                Lowlight Sessions returns to Warehouse 21 with three acts working across ambient, broken-beat and late-night house. The room is kept dark and the system is tuned for the space — this is a night for listening closely and then not at all.

                Front Row passes include early entry at 7:30 PM and a reserved spot along the barrier for the first set. General Admission doors open at 8:00 PM.

                18+ only. Please carry a government ID.""",
                "1470229722913-7c0e2dbbafd3", "warehouse21", 5, 20, 0, 5, EventStatus.PUBLISHED, true,
                List.of(tier("General Admission", "Entry from 8:00 PM.", 799, 210, 164, 4),
                        tier("Front Row", "Early entry at 7:30 PM and barrier access for the opening set.", 1499, 40, 37, 2)),
                List.of(at("19:30", "Doors (Front Row)", null),
                        at("20:15", "Set one — ambient opener", null),
                        at("21:30", "Set two — broken beat", null),
                        at("23:00", "Closing set", null)),
                null));
        s.add(new Spec("monsoon", "kinetic", "art", "Monsoon Open Studio",
                "Six artists open their working studios inside one old Fontainhas house for a weekend of unfinished work and long conversations.",
                """
                Monsoon Open Studio is an invitation into the middle of the process. Six resident artists — painters, a printmaker, a ceramicist and two photographers — open the rooms where they have been working through the rains.

                Nothing is hung like an exhibition. You'll see sketches pinned to walls, test prints and the pieces that didn't work. Artists are present throughout and happy to talk.

                Entry is free but registration is required so we can manage numbers inside the house.""",
                "1460661419201-fd4cecdf8a8b", "casaazul", 18, 11, 0, 8, EventStatus.PUBLISHED, false,
                List.of(tier("Free RSVP", "Timed entry, any slot during the day.", 0, 150, 71, 4)),
                List.of(at("11:00", "Studios open", null), at("16:00", "Walkthrough with the artists", "Meet in the courtyard.")),
                null));
        s.add(new Spec("typeinmotion", "kinetic", "workshops", "Type in Motion: Kinetic Typography Workshop",
                "A four-hour, hands-on session on animating type with intent — timing, rhythm and restraint. Small group, laptops required.",
                """
                Most motion type is either too much or not enough. This workshop is about the space between: how timing, easing and hierarchy make words feel like they are speaking at the right pace.

                We start with paper and a metronome, move into After Effects and finish with a short piece you'll take home. Templates and project files are provided.

                Limited to 24 people so every participant gets feedback. Bring a laptop with After Effects (trial versions work).""",
                "1517245386807-bb43f82c33c4", "kinetic", 9, 14, 0, 4, EventStatus.PUBLISHED, false,
                List.of(tier("Workshop seat", "Includes project files and coffee.", 1200, 24, 21, 2)),
                List.of(at("14:00", "Rhythm on paper", null), at("15:00", "Building the first sequence", null),
                        at("17:15", "Critique and export", null)),
                null));
        s.add(new Spec("founders", "northfield", "business", "Founders After Dark",
                "An evening of honest numbers: five early-stage founders share the metric that almost killed their company.",
                """
                Founders After Dark is a closed-door evening for people building companies. Five founders each get ten minutes and one slide: the number that nearly ended them and what they did next.

                The talks are followed by dinner at long tables seated by stage — pre-seed, seed and Series A — so the conversation stays useful.

                Ticket includes dinner. Recording and photography are not permitted during the talks.""",
                "1511578314322-379afb476865", "millhall", 7, 19, 0, 3, EventStatus.PUBLISHED, false,
                List.of(tier("Dinner seat", "Talks and seated dinner.", 999, 120, 83, 2)),
                List.of(at("19:00", "Arrivals", null), at("19:30", "Five founders, five numbers", null), at("20:30", "Dinner", null)),
                null));
        s.add(new Spec("hackathon", "northfield", "technology", "Builders' Weekend Hackathon",
                "Thirty-six hours, teams of up to four, one brief revealed at the start. Mentors on site, meals covered, no pitch theatre.",
                """
                Builders' Weekend is a 36-hour hackathon designed around shipping. The brief is announced at the opening and judged on a working demo — slides are not allowed in the final round.

                Mentors from product, design and infrastructure teams rotate through the night. Meals, snacks and a quiet room for sleeping are provided.

                Open to students and working professionals. Register individually; team formation happens on the first evening.""",
                "1504384308090-c894fdcc538d", "hub", 21, 18, 0, 36, EventStatus.PUBLISHED, true,
                List.of(tier("Participant", "Meals and workspace for the full weekend.", 0, 200, 142, 1)),
                List.of(at("18:00", "Check-in and team formation", null), at("20:00", "Brief revealed", null),
                        at("09:00", "Mentor rounds", null, 1), at("06:00", "Code freeze", "Demos begin at 7:00.", 2)),
                null));
        s.add(new Spec("sunrise", "commonground", "sports", "Sunrise 10K: Lodhi Loop",
                "A timed 10K through Lodhi Garden and the surrounding avenues, finishing with breakfast under the trees.",
                """
                The Sunrise 10K is an unhurried, chip-timed run for every pace. The route loops through Lodhi Garden and the quiet roads around it before the city wakes up.

                Pacers run at 50, 60 and 70 minutes. Water stations at 3K and 7K. Breakfast and coffee are served at the finish.

                The kit ticket includes a technical tee and a finisher's medal, collected at the start village.""",
                "1461896836934-ffe607ba8211", "lodhi", 14, 6, 0, 3, EventStatus.PUBLISHED, false,
                List.of(tier("Run entry", "Chip timing, water stations and breakfast.", 600, 400, 180, 4),
                        tier("Run + kit", "Adds a technical tee and finisher's medal.", 1200, 100, 50, 4)),
                List.of(at("05:30", "Start village opens", null), at("06:00", "Flag off", null), at("07:30", "Breakfast", null)),
                null));
        s.add(new Spec("supper", "commonground", "community", "Neighbourhood Supper Club",
                "Thirty-six strangers, one long table, a five-course menu cooked from the week's market.",
                """
                The Supper Club is a monthly dinner for people who live nearby and haven't met yet. Seats are assigned so you won't be sitting with the people you came with.

                The menu is built around whatever looked best at the market that week and is mostly vegetarian. Tell us about allergies in your profile notes and the kitchen will plan around them.

                Doors at 7:30. Dinner starts at 8:00 sharp.""",
                "1529156069898-49953e39b3ac", "courtyard9", 4, 19, 30, 3, EventStatus.PUBLISHED, false,
                List.of(tier("Seat at the table", "Five courses and a welcome drink.", 1800, 36, 36, 2)),
                List.of(),
                null));
        s.add(new Spec("designsystems", "kinetic", "technology", "Design Systems at Scale",
                "A free online session on keeping a design system useful after the hundredth component.",
                """
                Design systems rarely fail at launch — they fail in year two, when the component count passes a hundred and nobody remembers why the buttons have six variants.

                This 90-minute online session covers governance that doesn't slow teams down, token naming that survives rebrands and how to retire components without breaking products.

                The link to join is shown on this page after you register.""",
                "1475721027785-f74eccf877e2", null, 10, 18, 30, 2, EventStatus.PUBLISHED, false,
                List.of(tier("Online pass", "Live session and recording.", 0, 1000, 168, 1)),
                List.of(at("18:30", "Talk", null), at("19:30", "Q&A", null)),
                null));
        s.add(new Spec("clay", "kinetic", "workshops", "Clay & Coffee: Wheel Throwing Basics",
                "A slow Saturday morning at the wheel. Learn to centre, open and pull your first cylinder.",
                """
                No experience needed. Each participant gets their own wheel, an apron and enough clay to fail a few times — which is the point.

                You'll learn centring, opening and pulling walls, then choose one piece to keep. Pieces are trimmed, glazed and fired by the studio and ready for pickup three weeks later.

                Wear clothes you don't mind getting dirty.""",
                "1452860606245-08befc0ff44b", "mudhouse", 16, 9, 30, 3, EventStatus.PUBLISHED, false,
                List.of(tier("Wheel seat", "Clay, firing and one glazed piece.", 2200, 16, 9, 2)),
                List.of(),
                null));
        s.add(new Spec("ctrlaltart", "kinetic", "art", "Ctrl+Alt+Art: Generative Art Exhibition",
                "Twelve artists, twelve systems. A three-day exhibition of work made with code, plotters and rules.",
                """
                Ctrl+Alt+Art brings together twelve artists who build systems that make images. Pen plotters run live in the main room; screens show work that changes every time you look.

                Each artist has published the rules behind their piece on the wall next to it. Saturday afternoon includes a short talk from three of the artists about where the system ends and they begin.

                Your ticket is valid for one entry on any of the three days.""",
                "1518998053901-5348d3961a04", "pier7", 25, 11, 0, 56, EventStatus.PUBLISHED, true,
                List.of(tier("Day entry", "One entry on any day.", 300, 400, 96, 4)),
                List.of(at("11:00", "Exhibition opens", null), at("16:00", "Artist talk", null, 1)),
                null));
        s.add(new Spec("longtable", "northfield", "business", "The Long Table: Climate Founders Roundtable",
                "A facilitated roundtable for founders working on climate and energy — capped at sixty seats.",
                """
                The Long Table is a working session, not a conference. Sixty founders sit around three tables and work through the questions they normally only discuss with investors: unit economics, policy risk and hiring for hard problems.

                Each table has a facilitator and leaves with a written summary shared with every participant.

                Free to attend. We review registrations to keep the room balanced across sectors.""",
                "1556761175-5973dc0f32e7", "foundry", 30, 15, 0, 4, EventStatus.PUBLISHED, false,
                List.of(tier("Founder seat", "One seat per company.", 0, 60, 22, 1)),
                List.of(),
                null));
        s.add(new Spec("cup", "commonground", "sports", "Five-a-Side Corporate Cup",
                "A one-day five-a-side tournament for office teams. Group stage in the morning, knockouts under lights.",
                """
                Twenty-four teams, eight groups, one trophy. Matches are twelve minutes each way on full-size five-a-side turf with certified referees.

                Every team plays at least three games. Knockout rounds start at 4:00 PM and the final kicks off under floodlights.

                One ticket registers a team of up to eight players.""",
                "1431324155629-1a6deb1dec8d", "turf", 33, 8, 0, 12, EventStatus.PUBLISHED, false,
                List.of(tier("Team entry", "Up to eight players per team.", 4000, 24, 11, 1)),
                List.of(at("08:00", "Group stage", null), at("16:00", "Knockouts", null), at("19:30", "Final", null)),
                null));
        s.add(new Spec("stepwell", "lowlight", "music", "Sundays at the Mill: Acoustic Sets",
                "An early-evening acoustic bill — three songwriters, unamplified, in a restored mill hall.",
                """
                Sundays at the Mill is the quietest thing Lowlight does. Three songwriters play short, unamplified sets in the restored mill hall, with the audience seated close.

                Doors at 5:00 PM. The music starts at 5:30 and finishes before 8:00 so you can make it home for Monday.

                Seating is unreserved and limited to 140.""",
                "1501386761578-eac5c94b800a", "millhall", 40, 17, 0, 3, EventStatus.PUBLISHED, false,
                List.of(tier("Seated entry", "Unreserved seating.", 650, 140, 18, 4)),
                List.of(),
                null));
        s.add(new Spec("lowlight13", "lowlight", "music", "Lowlight Sessions: Vol. 13",
                "The previous edition of Lowlight Sessions at Warehouse 21.",
                """
                Volume 13 of Lowlight Sessions brought three acts to Warehouse 21 for a night of ambient and late house.

                Thanks to everyone who came out — Volume 14 is on sale now.""",
                "1493225457124-a3eb161ffa5f", "warehouse21", -20, 20, 0, 5, EventStatus.PUBLISHED, false,
                List.of(tier("General Admission", "Entry from 8:00 PM.", 699, 220, 196, 4)),
                List.of(),
                null));
        s.add(new Spec("analytics", "northfield", "workshops", "Intro to Product Analytics",
                "A live online workshop on picking the three metrics that actually matter for an early product.",
                """
                A two-hour live workshop covering event design, activation metrics and the difference between a dashboard and a decision.

                Recording and worksheets were shared with registered participants after the session.""",
                "1551288049-bebda4e38f71", null, -9, 18, 0, 2, EventStatus.PUBLISHED, false,
                List.of(tier("Online seat", "Live workshop and recording.", 0, 300, 140, 1)),
                List.of(),
                null));
        s.add(new Spec("nightmarket", "commonground", "community", "Night Market: Makers & Music",
                "Forty local makers, two food streets and a small stage in Pune's old market yard — one evening only.",
                """
                The Night Market turns the old market yard into a single evening of stalls, food and live music. Forty makers have been selected — ceramics, prints, textiles, small-batch food — and every stall is run by the person who made the work.

                Two food streets, a kids' corner with clay and chalk, and a small stage with three local bands between 7 and 10 PM.

                Entry tickets help us cover the venue and cleaning crew; stall-holders keep 100% of their sales.""",
                "1533900298318-6b8da08a523e", "marketyard", 28, 17, 0, 6, EventStatus.PENDING, false,
                List.of(tier("Entry", "Evening entry.", 150, 1200, 0, 6)),
                List.of(at("17:00", "Market opens", null), at("19:00", "Live music", null)),
                null));
        s.add(new Spec("promptdesign", "kinetic", "workshops", "Prompt Craft for Designers",
                "A practical online workshop on using image and text models inside a real design process — with critique, not hype.",
                """
                This online workshop is for designers who want to use generative tools without handing over their judgment. We'll work through three briefs and compare what models produce with what a designer would actually ship.

                Covers reference gathering, iteration loops, licensing questions and where these tools still fall short.

                Two hours, live, with a recording for registered participants.""",
                "1558655146-9f40138edfeb", null, 19, 19, 0, 2, EventStatus.PENDING, false,
                List.of(tier("Online seat", "Live workshop and recording.", 499, 200, 0, 1)),
                List.of(),
                null));
        s.add(new Spec("rooftopjazz", "lowlight", "music", "Rooftop Jazz Evenings",
                "A trio and a horizon. Twelve floors up in HITEC City, two sets as the sun goes down.",
                """
                A three-piece jazz group plays two sets on an open-air deck twelve floors above HITEC City. Seating is at small tables of four; the bar serves a short menu all evening.

                The first set starts at sunset and the second after a short break. In case of rain, the event moves to the covered lounge on the same floor.""",
                "1415201364774-f6f0bb35f28f", "skyline", 35, 18, 0, 4, EventStatus.PENDING, false,
                List.of(tier("Table seat", "Seat at a shared table of four.", 1100, 120, 0, 4)),
                List.of(),
                null));
        s.add(new Spec("gamejam", "northfield", "technology", "Indie Game Jam",
                "A 48-hour game jam for students and indie developers. Theme announced at kick-off.",
                """
                Draft — venue and judging panel still being confirmed.

                The jam will run over a weekend with a theme announced at kick-off and a public play session on the final evening.""",
                "1550745165-9bc0b252726f", "hub", 45, 18, 0, 48, EventStatus.DRAFT, false,
                List.of(tier("Jammer", "Entry for one participant.", 0, 120, 0, 1)),
                List.of(),
                null));
        s.add(new Spec("expo", "northfield", "business", "Mega Startup Expo",
                "An expo for startups to meet investors and customers.",
                """
                A large expo for startups to exhibit and meet investors. More details to be added soon about speakers and stalls.""",
                "1505373877841-8d25f7d46678", "millhall", 26, 10, 0, 8, EventStatus.REJECTED, false,
                List.of(tier("Visitor", "Expo entry.", 299, 2000, 0, 4)),
                List.of(),
                "Please add a confirmed agenda and exhibitor list, and upload proof of the venue booking before resubmitting."));
        s.add(new Spec("cinema", "commonground", "community", "Open-Air Cinema: Classics Under the Stars",
                "A free outdoor screening of a restored classic with blankets, chai and a short introduction by a film historian.",
                """
                A free outdoor screening of a restored classic on a large inflatable screen. Bring a blanket; chai and snacks were to be sold by local vendors.

                We're sorry to cancel — we hope to reschedule once permissions are restored.""",
                "1489599849927-2ee91cede3ba", "lodhi", 11, 19, 0, 3, EventStatus.CANCELLED, false,
                List.of(tier("Free RSVP", "Blanket seating.", 0, 300, 0, 4)),
                List.of(),
                "The venue permission was withdrawn by the local authority. All registrations have been cancelled."));
        return s;
    }
}
