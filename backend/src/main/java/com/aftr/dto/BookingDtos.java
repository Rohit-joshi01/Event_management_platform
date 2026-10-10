package com.aftr.dto;

import com.aftr.entity.OrderStatus;
import com.aftr.entity.PaymentProvider;
import com.aftr.entity.PaymentStatus;
import com.aftr.entity.TicketStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class BookingDtos {

    private BookingDtos() {
    }

    public record PurchaseItem(
            @NotNull Long ticketTypeId,
            @NotNull @Min(value = 1, message = "Choose at least one ticket.") @Max(10) Integer quantity) {
    }

    public record PurchaseRequest(
            @NotNull Long eventId,
            @NotEmpty(message = "Choose at least one ticket.") @Size(max = 6) @Valid List<PurchaseItem> items) {
    }

    public record TicketResponse(Long id, String code, TicketStatus status, String ticketTypeName, long priceCents,
                                 Instant checkedInAt) {
    }

    public record BookingResponse(
            Long id, String reference, OrderStatus status, PaymentStatus paymentStatus,
            PaymentProvider paymentProvider, boolean paymentSimulated, long totalCents, String currency,
            Instant createdAt, Instant cancelledAt, boolean seed, boolean cancellable,
            EventDtos.EventSummary event, List<TicketResponse> tickets) {
    }

    public record EventRegistrationRow(
            String reference, Long attendeeId, String attendeeName, String attendeeEmail, String ticketSummary,
            int quantity, int checkedIn, long totalCents, PaymentStatus paymentStatus, OrderStatus status,
            Instant createdAt) {
    }
}
