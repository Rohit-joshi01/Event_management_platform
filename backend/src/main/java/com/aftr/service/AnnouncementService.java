package com.aftr.service;

import com.aftr.dto.NotificationDtos;
import com.aftr.entity.Announcement;
import com.aftr.entity.Event;
import com.aftr.entity.EventStatus;
import com.aftr.entity.User;
import com.aftr.exception.ApiException;
import com.aftr.repository.AnnouncementRepository;
import com.aftr.repository.BookingOrderRepository;
import com.aftr.repository.UserRepository;
import com.aftr.security.AuthUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Organizer → attendee announcements. Delivered as in-app notifications only (channel IN_APP);
 * attendees who turned off announcement notifications are skipped and not counted.
 */
@Service
public class AnnouncementService {

    private final AnnouncementRepository announcements;
    private final BookingOrderRepository orders;
    private final UserRepository users;
    private final EventService eventService;
    private final NotificationService notifications;
    private final AuditService audit;

    public AnnouncementService(AnnouncementRepository announcements, BookingOrderRepository orders, UserRepository users,
                               EventService eventService, NotificationService notifications, AuditService audit) {
        this.announcements = announcements;
        this.orders = orders;
        this.users = users;
        this.eventService = eventService;
        this.notifications = notifications;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public NotificationDtos.RecipientPreview preview(Long eventId, AuthUser actor) {
        eventService.loadOwned(eventId, actor);
        return new NotificationDtos.RecipientPreview(recipients(eventId).size(), "IN_APP");
    }

    @Transactional
    public NotificationDtos.AnnouncementResponse send(Long eventId, NotificationDtos.AnnouncementRequest req, AuthUser actor) {
        Event e = eventService.loadOwned(eventId, actor);
        if (e.getStatus() != EventStatus.PUBLISHED) {
            throw ApiException.conflict("INVALID_STATUS", "Announcements can only be sent for published events.");
        }
        List<User> recipients = recipients(eventId);
        if (recipients.isEmpty()) {
            throw ApiException.conflict("NO_RECIPIENTS", "No registered attendees are subscribed to announcements yet.");
        }
        Announcement a = new Announcement();
        a.setEvent(e);
        a.setSender(users.getReferenceById(actor.getId()));
        a.setSubject(req.subject().trim());
        a.setMessage(req.message().trim());
        a.setRecipientCount(recipients.size());
        a.setChannel("IN_APP");
        announcements.save(a);
        for (User u : recipients) {
            notifications.notify(u, "ANNOUNCEMENT", e.getTitle() + ": " + a.getSubject(), a.getMessage(),
                    "/events/" + e.getSlug());
        }
        audit.record(actor, "ANNOUNCEMENT_SENT", "EVENT", e.getId(),
                "\"" + a.getSubject() + "\" sent to " + recipients.size() + " attendee(s) of " + e.getTitle());
        return toResponse(a);
    }

    @Transactional(readOnly = true)
    public List<NotificationDtos.AnnouncementResponse> list(Long eventId, AuthUser actor) {
        eventService.loadManaged(eventId, actor);
        return announcements.findByEventIdOrderByCreatedAtDesc(eventId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationDtos.AnnouncementResponse> listForOrganizer(AuthUser actor) {
        return announcements.findByEventOrganizerIdOrderByCreatedAtDesc(actor.getId()).stream().map(this::toResponse).toList();
    }

    private List<User> recipients(Long eventId) {
        return users.findAllById(orders.findConfirmedAttendeeIds(eventId)).stream()
                .filter(User::isNotifyAnnouncements)
                .filter(User::isActive)
                .toList();
    }

    private NotificationDtos.AnnouncementResponse toResponse(Announcement a) {
        return new NotificationDtos.AnnouncementResponse(a.getId(), a.getEvent().getId(), a.getEvent().getTitle(),
                a.getSubject(), a.getMessage(), a.getRecipientCount(), a.getChannel(),
                a.getSender() == null ? null : a.getSender().getFullName(), a.getCreatedAt());
    }
}
