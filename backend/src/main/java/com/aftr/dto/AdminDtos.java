package com.aftr.dto;

import jakarta.validation.constraints.NotEmpty;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record AuditLogResponse(Long id, Long actorId, String actorEmail, String action, String entityType,
                                   Long entityId, String summary, String ipAddress, Instant createdAt) {
    }

    public record ApprovalRecordResponse(Long id, Long eventId, String eventTitle, String eventSlug, String adminName,
                                         String decision, String reason, Instant createdAt) {
    }

    public record SettingItem(String key, String value, String type, String group, String label, String description) {
    }

    public record SettingsUpdateRequest(@NotEmpty Map<String, String> values) {
    }

    public record PublicSettings(String platformName, String supportEmail, boolean allowAttendeeSignup,
                                 boolean allowOrganizerSignup, boolean devCheckoutEnabled) {
    }

    public record SettingsResponse(List<SettingItem> settings) {
    }
}
