package com.aftr.mapper;

import com.aftr.dto.BookingDtos;
import com.aftr.entity.*;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Component
public class BookingMapper {

    private final EventMapper eventMapper;
    private final Clock clock;

    public BookingMapper(EventMapper eventMapper, Clock clock) {
        this.eventMapper = eventMapper;
        this.clock = clock;
    }

    public BookingDtos.TicketResponse ticket(Ticket t) {
        return new BookingDtos.TicketResponse(t.getId(), t.getCode(), t.getStatus(), t.getTicketType().getName(),
                t.getPriceCents(), t.getCheckedInAt());
    }

    public BookingDtos.BookingResponse toResponse(BookingOrder o, List<Ticket> tickets) {
        Instant now = Instant.now(clock);
        boolean cancellable = o.getStatus() == OrderStatus.CONFIRMED
                && o.getEvent().getStatus() != EventStatus.CANCELLED
                && o.getEvent().getStartsAt().isAfter(now)
                && tickets.stream().noneMatch(t -> t.getStatus() == TicketStatus.CHECKED_IN);
        boolean simulated = o.getPaymentProvider() == PaymentProvider.DEV_SIMULATED;
        return new BookingDtos.BookingResponse(o.getId(), o.getReference(), o.getStatus(), o.getPaymentStatus(),
                o.getPaymentProvider(), simulated, o.getTotalCents(), o.getCurrency(), o.getCreatedAt(),
                o.getCancelledAt(), o.isSeed(), cancellable, eventMapper.toSummary(o.getEvent()),
                tickets.stream().map(this::ticket).toList());
    }
}
