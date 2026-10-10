package com.aftr.dto;

import com.aftr.entity.TicketStatus;
import com.aftr.validation.TimeRange;
import com.aftr.validation.ValidTimeRange;
import jakarta.validation.constraints.*;

import java.time.Instant;

public final class TicketDtos {

    private TicketDtos() {
    }

    public record TicketTypeResponse(
            Long id, String name, String description, long priceCents, String currency, int quantity, int sold,
            int remaining, Instant salesStart, Instant salesEnd, int maxPerOrder, boolean onSale, String saleState,
            int sortOrder) {
    }

    @ValidTimeRange(message = "Sales must end after they start.")
    public record TicketTypeRequest(
            @NotBlank(message = "Name the ticket type.") @Size(max = 80) String name,
            @Size(max = 300) String description,
            @NotNull @Min(value = 0, message = "Price can't be negative.") @Max(value = 10_000_000_00L,
                    message = "Price is too high.") Long priceCents,
            @NotNull @Min(value = 1, message = "Quantity must be at least 1.") @Max(value = 100_000) Integer quantity,
            Instant salesStart,
            Instant salesEnd,
            @NotNull @Min(value = 1, message = "Allow at least 1 per order.") @Max(value = 10,
                    message = "At most 10 per order.") Integer maxPerOrder,
            Integer sortOrder) implements TimeRange {

        @Override
        public Instant rangeStart() {
            return salesStart;
        }

        @Override
        public Instant rangeEnd() {
            return salesEnd;
        }
    }

    public record TicketVerification(
            String code, boolean valid, TicketStatus status, String message, Long eventId, String eventTitle,
            Instant eventStartsAt, String ticketTypeName, String attendeeName, String bookingReference,
            Instant checkedInAt) {
    }
}
