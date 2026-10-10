package com.aftr.mapper;

import com.aftr.dto.EventDtos;
import com.aftr.dto.TicketDtos;
import com.aftr.entity.*;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Component
public class EventMapper {

    private final Clock clock;

    public EventMapper(Clock clock) {
        this.clock = clock;
    }

    public EventDtos.CategoryRef category(Category c) {
        return new EventDtos.CategoryRef(c.getId(), c.getSlug(), c.getName());
    }

    public EventDtos.EventSummary toSummary(Event e) {
        Venue v = e.getVenue();
        return new EventDtos.EventSummary(e.getId(), e.getSlug(), e.getTitle(), e.getSummary(), e.getCoverImageUrl(),
                category(e.getCategory()), e.getStartsAt(), e.getEndsAt(), e.getTimezone(), e.getFormat(),
                v == null ? null : v.getName(), v == null ? null : v.getCity(), organizerDisplayName(e.getOrganizer()),
                e.getMinPriceCents(), "INR", e.getTotalCapacity(), e.getTotalSold(), e.getStatus(), availability(e),
                e.isFeatured(), e.isSeed(), e.getSubmittedAt(), e.getCreatedAt());
    }

    public String organizerDisplayName(User organizer) {
        if (organizer == null) return null;
        return organizer.getOrganizationName() != null && !organizer.getOrganizationName().isBlank()
                ? organizer.getOrganizationName() : organizer.getFullName();
    }

    /** Coarse availability used on listing cards. */
    public String availability(Event e) {
        Instant now = Instant.now(clock);
        if (e.getStatus() == EventStatus.CANCELLED) return "CANCELLED";
        if (e.getEndsAt().isBefore(now)) return "ENDED";
        if (e.getStatus() != EventStatus.PUBLISHED) return e.getStatus().name();
        if (!e.getStartsAt().isAfter(now)) return "CLOSED";
        if (e.getTotalCapacity() > 0 && e.getTotalSold() >= e.getTotalCapacity()) return "SOLD_OUT";
        if (e.getTotalCapacity() > 0 && (e.getTotalCapacity() - e.getTotalSold()) <= Math.max(1, e.getTotalCapacity() * 0.15)) {
            return "LIMITED";
        }
        return "AVAILABLE";
    }

    public TicketDtos.TicketTypeResponse toTicketType(TicketType t) {
        Instant now = Instant.now(clock);
        String saleState;
        if (t.remaining() == 0) saleState = "SOLD_OUT";
        else if (t.getSalesStart() != null && now.isBefore(t.getSalesStart())) saleState = "NOT_STARTED";
        else if (t.getSalesEnd() != null && !now.isBefore(t.getSalesEnd())) saleState = "ENDED";
        else saleState = "ON_SALE";
        return new TicketDtos.TicketTypeResponse(t.getId(), t.getName(), t.getDescription(), t.getPriceCents(),
                t.getCurrency(), t.getQuantity(), t.getSold(), t.remaining(), t.getSalesStart(), t.getSalesEnd(),
                t.getMaxPerOrder(), "ON_SALE".equals(saleState), saleState, t.getSortOrder());
    }

    public List<EventDtos.ScheduleItemResponse> schedule(Event e) {
        return e.getSchedule().stream()
                .map(s -> new EventDtos.ScheduleItemResponse(s.getId(), s.getStartsAt(), s.getTitle(), s.getDescription()))
                .toList();
    }

    public EventDtos.VenueResponse venue(Venue v) {
        if (v == null) return null;
        return new EventDtos.VenueResponse(v.getId(), v.getName(), v.getAddress(), v.getCity(), v.getCountry());
    }
}
