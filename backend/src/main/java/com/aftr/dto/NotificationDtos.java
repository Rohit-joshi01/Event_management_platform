package com.aftr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationResponse(Long id, String type, String title, String body, String link, boolean read,
                                       Instant createdAt) {
    }

    public record UnreadCount(long unread) {
    }

    public record AnnouncementRequest(
            @NotBlank(message = "Add a subject.") @Size(min = 3, max = 160) String subject,
            @NotBlank(message = "Write a message.") @Size(min = 10, max = 4000) String message) {
    }

    /** channel is always IN_APP: no email provider is configured, so nothing is emailed. */
    public record AnnouncementResponse(Long id, Long eventId, String eventTitle, String subject, String message,
                                       int recipientCount, String channel, String senderName, Instant createdAt) {
    }

    public record RecipientPreview(long recipientCount, String channel) {
    }
}
