package com.aftr.unit;

import com.aftr.entity.Event;
import com.aftr.entity.EventStatus;
import com.aftr.entity.TicketType;
import com.aftr.mapper.EventMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class EventMapperTest {

    private final Instant now = Instant.parse("2026-10-10T10:00:00Z");
    private final EventMapper mapper = new EventMapper(Clock.fixed(now, ZoneOffset.UTC));

    private Event event(EventStatus status, int capacity, int sold, Duration startsIn) {
        Event e = new Event();
        e.setStatus(status);
        e.setStartsAt(now.plus(startsIn));
        e.setEndsAt(now.plus(startsIn).plus(Duration.ofHours(3)));
        e.setTotalCapacity(capacity);
        ReflectionTestUtils.setField(e, "totalSold", sold);
        return e;
    }

    @Test
    void availabilityReflectsInventoryAndTime() {
        assertThat(mapper.availability(event(EventStatus.PUBLISHED, 100, 10, Duration.ofDays(2)))).isEqualTo("AVAILABLE");
        assertThat(mapper.availability(event(EventStatus.PUBLISHED, 100, 90, Duration.ofDays(2)))).isEqualTo("LIMITED");
        assertThat(mapper.availability(event(EventStatus.PUBLISHED, 100, 100, Duration.ofDays(2)))).isEqualTo("SOLD_OUT");
        assertThat(mapper.availability(event(EventStatus.PUBLISHED, 100, 10, Duration.ofHours(-1)))).isEqualTo("CLOSED");
        assertThat(mapper.availability(event(EventStatus.PUBLISHED, 100, 10, Duration.ofDays(-2)))).isEqualTo("ENDED");
        assertThat(mapper.availability(event(EventStatus.CANCELLED, 100, 0, Duration.ofDays(2)))).isEqualTo("CANCELLED");
        assertThat(mapper.availability(event(EventStatus.PENDING, 100, 0, Duration.ofDays(2)))).isEqualTo("PENDING");
    }

    @Test
    void ticketSaleStateRespectsWindowAndStock() {
        TicketType t = new TicketType();
        t.setName("GA");
        t.setQuantity(10);
        t.setSalesStart(now.plus(Duration.ofDays(1)));
        assertThat(mapper.toTicketType(t).saleState()).isEqualTo("NOT_STARTED");
        t.setSalesStart(null);
        t.setSalesEnd(now.minus(Duration.ofMinutes(1)));
        assertThat(mapper.toTicketType(t).saleState()).isEqualTo("ENDED");
        t.setSalesEnd(null);
        ReflectionTestUtils.setField(t, "sold", 10);
        assertThat(mapper.toTicketType(t).saleState()).isEqualTo("SOLD_OUT");
        ReflectionTestUtils.setField(t, "sold", 3);
        assertThat(mapper.toTicketType(t).onSale()).isTrue();
        assertThat(mapper.toTicketType(t).remaining()).isEqualTo(7);
    }
}
