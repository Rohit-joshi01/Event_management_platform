package com.aftr.service;

import com.aftr.entity.Ticket;
import com.aftr.entity.TicketStatus;
import com.aftr.entity.TicketType;
import com.aftr.exception.ApiException;
import com.aftr.repository.EventRepository;
import com.aftr.repository.TicketTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Map;
import java.util.TreeMap;

/**
 * The only code path that changes ticket inventory. Every change is a conditional, atomic
 * UPDATE executed inside the caller's transaction, applied in ascending ticket-type id order to
 * avoid lock-ordering deadlocks between concurrent buyers.
 */
@Service
public class InventoryService {

    private final TicketTypeRepository ticketTypes;
    private final EventRepository events;

    public InventoryService(TicketTypeRepository ticketTypes, EventRepository events) {
        this.ticketTypes = ticketTypes;
        this.events = events;
    }

    /**
     * Reserves the requested quantities or throws (rolling back the whole transaction).
     *
     * @param requested ticket type → quantity
     * @param names     ticket type → display name, for error messages
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void reserve(Long eventId, Map<Long, Integer> requested, Map<Long, String> names) {
        int total = 0;
        for (Map.Entry<Long, Integer> e : new TreeMap<>(requested).entrySet()) {
            int updated = ticketTypes.reserve(e.getKey(), eventId, e.getValue());
            if (updated != 1) {
                throw ApiException.conflict("SOLD_OUT",
                        "Not enough \"" + names.getOrDefault(e.getKey(), "tickets") + "\" left. Reduce the quantity or pick another ticket.");
            }
            total += e.getValue();
        }
        if (events.adjustSold(eventId, total) != 1) {
            throw ApiException.conflict("INVENTORY_ERROR", "Could not update event inventory.");
        }
    }

    /** Returns the seats held by the given (still active) tickets to inventory. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void release(Long eventId, Collection<Ticket> tickets) {
        Map<Long, Integer> counts = new TreeMap<>();
        for (Ticket t : tickets) {
            if (t.getStatus() != TicketStatus.CANCELLED) {
                TicketType type = t.getTicketType();
                counts.merge(type.getId(), 1, Integer::sum);
            }
        }
        int total = 0;
        for (Map.Entry<Long, Integer> e : counts.entrySet()) {
            ticketTypes.release(e.getKey(), e.getValue());
            total += e.getValue();
        }
        if (total > 0) {
            events.adjustSold(eventId, -total);
        }
    }
}
