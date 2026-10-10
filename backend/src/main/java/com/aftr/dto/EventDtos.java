package com.aftr.dto;

import com.aftr.entity.EventFormat;
import com.aftr.entity.EventStatus;
import com.aftr.validation.TimeRange;
import com.aftr.validation.ValidTimeRange;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class EventDtos {

    private EventDtos() {
    }

    public record CategoryRef(Long id, String slug, String name) {
    }

    public record CategoryResponse(Long id, String slug, String name, String description, long upcomingCount) {
    }

    public record OrganizerRef(Long id, String name, String organizationName, String avatarUrl, String bio,
                               long publishedEvents) {
    }

    public record VenueResponse(Long id, String name, String address, String city, String country) {
    }

    public record ScheduleItemResponse(Long id, Instant startsAt, String title, String description) {
    }

    /**
     * Lightweight listing card. {@code availability} is derived server-side:
     * AVAILABLE, LIMITED (&lt;15% left), SOLD_OUT, CLOSED, ENDED, CANCELLED.
     */
    public record EventSummary(
            Long id, String slug, String title, String summary, String coverImageUrl, CategoryRef category,
            Instant startsAt, Instant endsAt, String timezone, EventFormat format, String venueName, String city,
            String organizerName, long minPriceCents, String currency, int totalCapacity, int totalSold,
            EventStatus status, String availability, boolean featured, boolean seed, Instant submittedAt,
            Instant createdAt) {
    }

    public record EventDetail(
            Long id, String slug, String title, String summary, String description, String coverImageUrl,
            CategoryRef category, Instant startsAt, Instant endsAt, String timezone, EventFormat format,
            VenueResponse venue, String onlineUrl, boolean onlineUrlHidden, EventStatus status, String availability,
            String registrationState, String registrationMessage, boolean featured, boolean seed,
            long minPriceCents, String currency, int totalCapacity, int totalSold,
            List<ScheduleItemResponse> schedule, List<TicketDtos.TicketTypeResponse> ticketTypes,
            OrganizerRef organizer, String rejectionReason, String cancelReason, Instant submittedAt,
            Instant publishedAt, Instant createdAt, Instant updatedAt, boolean viewerIsOwner,
            String viewerBookingReference, List<ApprovalHistoryItem> approvalHistory) {
    }

    public record ApprovalHistoryItem(String decision, String reason, String adminName, Instant createdAt) {
    }

    public record ScheduleItemRequest(
            @NotNull(message = "Schedule item needs a time.") Instant startsAt,
            @NotBlank(message = "Schedule item needs a title.") @Size(max = 160) String title,
            @Size(max = 500) String description) {
    }

    @ValidTimeRange(message = "The event must end after it starts.")
    public record EventUpsertRequest(
            @NotBlank(message = "Give your event a title.") @Size(min = 4, max = 140) String title,
            @NotBlank(message = "Add a one-line summary.") @Size(min = 10, max = 280) String summary,
            @NotBlank(message = "Describe your event.") @Size(min = 20, max = 20000) String description,
            @NotBlank(message = "Choose a category.") String categorySlug,
            @Size(max = 500) @Pattern(regexp = "^(|/uploads/[A-Za-z0-9._-]+|https://.+)$",
                    message = "Use an uploaded image or an https:// URL.") String coverImageUrl,
            @NotNull(message = "Set a start time.") Instant startsAt,
            @NotNull(message = "Set an end time.") Instant endsAt,
            @NotBlank @Size(max = 60) String timezone,
            @NotNull EventFormat format,
            @Size(max = 160) String venueName,
            @Size(max = 300) String venueAddress,
            @Size(max = 100) String city,
            @Size(max = 500) @Pattern(regexp = "^(|https://.+)$", message = "Online links must start with https://")
            String onlineUrl,
            @Valid @Size(max = 30) List<ScheduleItemRequest> schedule) implements TimeRange {

        @Override
        public Instant rangeStart() {
            return startsAt;
        }

        @Override
        public Instant rangeEnd() {
            return endsAt;
        }
    }

    public record RejectRequest(
            @NotBlank(message = "A reason is required when rejecting.") @Size(min = 10, max = 1000,
                    message = "Explain the decision in 10–1000 characters.") String reason) {
    }

    public record CancelEventRequest(
            @NotBlank(message = "Tell attendees why the event is cancelled.") @Size(min = 10, max = 1000) String reason) {
    }

    public record FeatureRequest(boolean featured) {
    }

    public record EventMeta(List<String> cities, List<CategoryResponse> categories) {
    }
}
