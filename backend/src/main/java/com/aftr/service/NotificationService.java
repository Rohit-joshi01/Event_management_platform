package com.aftr.service;

import com.aftr.dto.NotificationDtos;
import com.aftr.dto.PageResponse;
import com.aftr.entity.Notification;
import com.aftr.entity.User;
import com.aftr.exception.ApiException;
import com.aftr.repository.NotificationRepository;
import com.aftr.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;

/**
 * In-app notification inbox. No email provider is configured, so notifications are only
 * delivered inside the product — nothing claims to have been emailed.
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, UserRepository users, Clock clock) {
        this.notifications = notifications;
        this.users = users;
        this.clock = clock;
    }

    @Transactional
    public void notify(User user, String type, String title, String body, String link) {
        Notification n = new Notification();
        n.setUser(user);
        n.setType(type);
        n.setTitle(truncate(title, 200));
        n.setBody(truncate(body, 2000));
        n.setLink(link);
        notifications.save(n);
    }

    @Transactional
    public void notifyAll(Collection<Long> userIds, String type, String title, String body, String link) {
        for (Long id : userIds) {
            notify(users.getReferenceById(id), type, title, body, link);
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationDtos.NotificationResponse> list(Long userId, boolean unreadOnly, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<Notification> result = unreadOnly
                ? notifications.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId, pr)
                : notifications.findByUserIdOrderByCreatedAtDesc(userId, pr);
        return PageResponse.of(result, NotificationService::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public NotificationDtos.NotificationResponse markRead(Long userId, Long notificationId, boolean read) {
        Notification n = notifications.findById(notificationId)
                .filter(x -> x.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Notification"));
        n.setReadAt(read ? Instant.now(clock) : null);
        return toResponse(n);
    }

    @Transactional
    public int markAllRead(Long userId) {
        return notifications.markAllRead(userId, Instant.now(clock));
    }

    public static NotificationDtos.NotificationResponse toResponse(Notification n) {
        return new NotificationDtos.NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(),
                n.getReadAt() != null, n.getCreatedAt());
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
