package com.aftr.service;

import com.aftr.dto.TicketDtos;
import com.aftr.entity.Event;
import com.aftr.entity.EventStatus;
import com.aftr.entity.TicketType;
import com.aftr.exception.ApiException;
import com.aftr.mapper.EventMapper;
import com.aftr.repository.TicketTypeRepository;
import com.aftr.security.AuthUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class TicketTypeService {

    private final TicketTypeRepository ticketTypes;
    private final EventService eventService;
    private final SettingsService settings;
    private final AuditService audit;
    private final EventMapper mapper;
    private final Clock clock;

    public TicketTypeService(TicketTypeRepository ticketTypes, EventService eventService, SettingsService settings,
                             AuditService audit, EventMapper mapper, Clock clock) {
        this.ticketTypes = ticketTypes;
        this.eventService = eventService;
        this.settings = settings;
        this.audit = audit;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.TicketTypeResponse> list(Long eventId, AuthUser actor) {
        eventService.loadManaged(eventId, actor);
        return ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(eventId).stream().map(mapper::toTicketType).toList();
    }

    @Transactional
    public TicketDtos.TicketTypeResponse create(Long eventId, TicketDtos.TicketTypeRequest req, AuthUser actor) {
        Event event = editableEvent(eventId, actor);
        long existing = ticketTypes.countByEventId(eventId);
        int max = settings.getInt(SettingsService.MAX_TICKET_TYPES);
        if (existing >= max) {
            throw ApiException.conflict("TOO_MANY_TICKET_TYPES", "Events can have at most " + max + " ticket types.");
        }
        validateWindow(event, req);
        TicketType t = new TicketType();
        t.setEvent(event);
        applyEditable(t, req);
        t.setPriceCents(req.priceCents());
        t.setQuantity(req.quantity());
        t.setSortOrder(req.sortOrder() == null ? (int) existing : req.sortOrder());
        ticketTypes.saveAndFlush(t);
        recalculate(event);
        audit.record(actor, "TICKET_TYPE_CREATED", "EVENT", eventId, "Added ticket \"" + t.getName() + "\" to " + event.getTitle());
        return mapper.toTicketType(t);
    }

    @Transactional
    public TicketDtos.TicketTypeResponse update(Long eventId, Long ticketTypeId, TicketDtos.TicketTypeRequest req, AuthUser actor) {
        Event event = editableEvent(eventId, actor);
        TicketType t = load(eventId, ticketTypeId);
        validateWindow(event, req);
        int sold = ticketTypes.currentSold(t.getId());
        if (req.quantity() < sold) {
            throw ApiException.conflict("QUANTITY_BELOW_SOLD", sold + " tickets of this type are already sold — quantity can't go below that.");
        }
        if (sold > 0 && !Objects.equals(req.priceCents(), t.getPriceCents())) {
            throw ApiException.conflict("PRICE_LOCKED", "The price can't change after tickets have been sold. Add a new ticket type instead.");
        }
        applyEditable(t, req);
        t.setPriceCents(req.priceCents());
        t.setQuantity(req.quantity());
        if (req.sortOrder() != null) t.setSortOrder(req.sortOrder());
        ticketTypes.saveAndFlush(t);
        recalculate(event);
        audit.record(actor, "TICKET_TYPE_UPDATED", "EVENT", eventId, "Updated ticket \"" + t.getName() + "\" on " + event.getTitle());
        return mapper.toTicketType(t);
    }

    @Transactional
    public void delete(Long eventId, Long ticketTypeId, AuthUser actor) {
        Event event = editableEvent(eventId, actor);
        TicketType t = load(eventId, ticketTypeId);
        if (ticketTypes.currentSold(t.getId()) > 0) {
            throw ApiException.conflict("HAS_SALES", "Tickets of this type have been sold, so it can't be removed. Reduce its quantity instead.");
        }
        if (event.getStatus() == EventStatus.PUBLISHED && ticketTypes.countByEventId(eventId) <= 1) {
            throw ApiException.conflict("LAST_TICKET_TYPE", "A published event needs at least one ticket type.");
        }
        String name = t.getName();
        ticketTypes.delete(t);
        ticketTypes.flush();
        recalculate(event);
        audit.record(actor, "TICKET_TYPE_DELETED", "EVENT", eventId, "Removed ticket \"" + name + "\" from " + event.getTitle());
    }

    /** Keeps the denormalised price/capacity columns used for discovery filters in sync. */
    void recalculate(Event event) {
        List<TicketType> types = ticketTypes.findByEventIdOrderBySortOrderAscIdAsc(event.getId());
        event.setMinPriceCents(types.stream().mapToLong(TicketType::getPriceCents).min().orElse(0));
        event.setTotalCapacity(types.stream().mapToInt(TicketType::getQuantity).sum());
    }

    private Event editableEvent(Long eventId, AuthUser actor) {
        Event event = eventService.loadOwned(eventId, actor);
        if (event.getStatus() == EventStatus.PENDING) {
            throw ApiException.conflict("UNDER_REVIEW", "This event is under review. Withdraw the submission to change tickets.");
        }
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw ApiException.conflict("CANCELLED", "Cancelled events can't be changed.");
        }
        if (event.hasEnded(Instant.now(clock))) {
            throw ApiException.conflict("ENDED", "Past events can't be changed.");
        }
        return event;
    }

    private TicketType load(Long eventId, Long ticketTypeId) {
        return ticketTypes.findById(ticketTypeId)
                .filter(t -> t.getEvent().getId().equals(eventId))
                .orElseThrow(() -> ApiException.notFound("Ticket type"));
    }

    private void validateWindow(Event event, TicketDtos.TicketTypeRequest req) {
        if (req.salesEnd() != null && req.salesEnd().isAfter(event.getEndsAt())) {
            throw ApiException.badRequest("SALES_AFTER_EVENT", "Ticket sales must end before the event ends.");
        }
    }

    private static void applyEditable(TicketType t, TicketDtos.TicketTypeRequest req) {
        t.setName(req.name().trim());
        t.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());
        t.setSalesStart(req.salesStart());
        t.setSalesEnd(req.salesEnd());
        t.setMaxPerOrder(req.maxPerOrder());
    }
}
