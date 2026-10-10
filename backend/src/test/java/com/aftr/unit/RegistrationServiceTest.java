package com.aftr.unit;

import com.aftr.config.AppProperties;
import com.aftr.dto.BookingDtos;
import com.aftr.entity.*;
import com.aftr.exception.ApiException;
import com.aftr.mapper.BookingMapper;
import com.aftr.mapper.EventMapper;
import com.aftr.repository.*;
import com.aftr.security.AuthUser;
import com.aftr.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** Business rules of the purchase flow, verified in isolation from the database. */
class RegistrationServiceTest {

    private final Instant now = Instant.parse("2026-10-10T10:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    private EventRepository events;
    private TicketTypeRepository ticketTypes;
    private BookingOrderRepository orders;
    private InventoryService inventory;
    private AppProperties props;
    private RegistrationService service;

    private final AuthUser attendee = new AuthUser(7L, "a@example.com", "A", Role.ATTENDEE, true, null);

    @BeforeEach
    void setUp() {
        events = mock(EventRepository.class);
        ticketTypes = mock(TicketTypeRepository.class);
        orders = mock(BookingOrderRepository.class);
        inventory = mock(InventoryService.class);
        props = new AppProperties();
        EventMapper eventMapper = new EventMapper(clock);
        service = new RegistrationService(events, ticketTypes, orders, mock(TicketRepository.class),
                mock(UserRepository.class), inventory, mock(EventService.class), mock(NotificationService.class),
                mock(AuditService.class), mock(SettingsService.class), new CodeGenerator(),
                new BookingMapper(eventMapper, clock), props, clock);
    }

    private Event event(EventStatus status, Duration startsIn) {
        Event e = new Event();
        e.setId(1L);
        e.setStatus(status);
        e.setStartsAt(now.plus(startsIn));
        e.setEndsAt(now.plus(startsIn).plus(Duration.ofHours(2)));
        return e;
    }

    private TicketType type(Event e, long price, int maxPerOrder) {
        TicketType t = new TicketType();
        t.setId(11L);
        t.setEvent(e);
        t.setName("GA");
        t.setPriceCents(price);
        t.setQuantity(100);
        t.setMaxPerOrder(maxPerOrder);
        return t;
    }

    private BookingDtos.PurchaseRequest request(int qty) {
        return new BookingDtos.PurchaseRequest(1L, List.of(new BookingDtos.PurchaseItem(11L, qty)));
    }

    @Test
    void organizersAndAdminsCannotBuyTickets() {
        AuthUser organizer = new AuthUser(2L, "o@example.com", "O", Role.ORGANIZER, true, null);
        assertThatThrownBy(() -> service.purchase(request(1), organizer))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(inventory);
    }

    @Test
    void refusesUnpublishedCancelledOrStartedEvents() {
        for (Event e : List.of(event(EventStatus.PENDING, Duration.ofDays(1)), event(EventStatus.CANCELLED, Duration.ofDays(1)),
                event(EventStatus.PUBLISHED, Duration.ofMinutes(-5)))) {
            when(events.findById(1L)).thenReturn(Optional.of(e));
            assertThatThrownBy(() -> service.purchase(request(1), attendee)).isInstanceOf(ApiException.class);
        }
        verifyNoInteractions(inventory);
    }

    @Test
    void enforcesPerOrderLimit() {
        Event e = event(EventStatus.PUBLISHED, Duration.ofDays(1));
        when(events.findById(1L)).thenReturn(Optional.of(e));
        when(orders.findFirstByUserIdAndEventIdAndStatus(anyLong(), anyLong(), any())).thenReturn(Optional.empty());
        when(ticketTypes.findById(11L)).thenReturn(Optional.of(type(e, 0, 2)));
        assertThatThrownBy(() -> service.purchase(request(3), attendee))
                .isInstanceOf(ApiException.class).hasMessageContaining("at most 2");
        verifyNoInteractions(inventory);
    }

    @Test
    void paidTicketsAreRefusedWhenNoCheckoutIsAvailable() {
        props.getPayments().setDevCheckoutEnabled(false);
        Event e = event(EventStatus.PUBLISHED, Duration.ofDays(1));
        when(events.findById(1L)).thenReturn(Optional.of(e));
        when(orders.findFirstByUserIdAndEventIdAndStatus(anyLong(), anyLong(), any())).thenReturn(Optional.empty());
        when(ticketTypes.findById(11L)).thenReturn(Optional.of(type(e, 50000, 4)));
        assertThatThrownBy(() -> service.purchase(request(1), attendee))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getCode()).isEqualTo("PAYMENTS_UNAVAILABLE");
        verifyNoInteractions(inventory);
    }

    @Test
    void existingBookingBlocksDuplicate() {
        Event e = event(EventStatus.PUBLISHED, Duration.ofDays(1));
        BookingOrder existing = new BookingOrder();
        existing.setReference("AFT-ABC234");
        when(events.findById(1L)).thenReturn(Optional.of(e));
        when(orders.findFirstByUserIdAndEventIdAndStatus(7L, 1L, OrderStatus.CONFIRMED)).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> service.purchase(request(1), attendee))
                .isInstanceOf(ApiException.class).hasMessageContaining("AFT-ABC234");
        assertThat(props.getPayments().isDevCheckoutEnabled()).isTrue();
    }
}
