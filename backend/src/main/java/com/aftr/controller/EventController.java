package com.aftr.controller;

import com.aftr.dto.*;
import com.aftr.entity.EventFormat;
import com.aftr.entity.OrderStatus;
import com.aftr.security.AuthUser;
import com.aftr.service.AnnouncementService;
import com.aftr.service.EventService;
import com.aftr.service.RegistrationService;
import com.aftr.service.TicketTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/events")
@Tag(name = "Events")
public class EventController {

    private final EventService eventService;
    private final TicketTypeService ticketTypeService;
    private final RegistrationService registrationService;
    private final AnnouncementService announcementService;

    public EventController(EventService eventService, TicketTypeService ticketTypeService,
                           RegistrationService registrationService, AnnouncementService announcementService) {
        this.eventService = eventService;
        this.ticketTypeService = ticketTypeService;
        this.registrationService = registrationService;
        this.announcementService = announcementService;
    }

    // ------------------------------------------------------------ public discovery

    @GetMapping
    @Operation(summary = "Search published, upcoming events",
            description = "sort: date | popular | newest | price. price: free | paid. from/to are ISO-8601 instants.")
    public PageResponse<EventDtos.EventSummary> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String price,
            @RequestParam(required = false) Long maxPriceCents,
            @RequestParam(required = false) EventFormat format,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(defaultValue = "date") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return eventService.search(new EventService.SearchParams(q, category, city, from, to, price, maxPriceCents,
                format, featured, sort, page, size));
    }

    @GetMapping("/meta/filters")
    @Operation(summary = "Cities and categories with upcoming events, for filter controls")
    public EventDtos.EventMeta filters() {
        return eventService.meta();
    }

    @GetMapping("/{idOrSlug}")
    @Operation(summary = "Event details. Unpublished events are only visible to their organizer and admins.")
    public EventDtos.EventDetail detail(@PathVariable String idOrSlug, @AuthenticationPrincipal AuthUser viewer) {
        return eventService.detail(idOrSlug, viewer);
    }

    @GetMapping("/{id}/related")
    public List<EventDtos.EventSummary> related(@PathVariable Long id) {
        return eventService.related(id);
    }

    // ------------------------------------------------------------ organizer lifecycle

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ORGANIZER')")
    @Operation(summary = "Create a draft event")
    public EventDtos.EventDetail create(@Valid @RequestBody EventDtos.EventUpsertRequest req,
                                        @AuthenticationPrincipal AuthUser me) {
        return eventService.create(req, me);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public EventDtos.EventDetail update(@PathVariable Long id, @Valid @RequestBody EventDtos.EventUpsertRequest req,
                                        @AuthenticationPrincipal AuthUser me) {
        return eventService.update(id, req, me);
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('ORGANIZER')")
    @Operation(summary = "Submit a draft for admin review")
    public EventDtos.EventDetail submit(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return eventService.submit(id, me);
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('ORGANIZER')")
    public EventDtos.EventDetail withdraw(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return eventService.withdraw(id, me);
    }

    @PostMapping("/{id}/unpublish")
    @PreAuthorize("hasRole('ORGANIZER')")
    @Operation(summary = "Return a published event with no registrations to draft")
    public EventDtos.EventDetail unpublish(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return eventService.unpublish(id, me);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
    @Operation(summary = "Cancel an event, cancelling all bookings and notifying attendees")
    public EventDtos.EventDetail cancel(@PathVariable Long id, @Valid @RequestBody EventDtos.CancelEventRequest req,
                                        @AuthenticationPrincipal AuthUser me) {
        return eventService.cancel(id, req.reason(), me);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ORGANIZER')")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        eventService.delete(id, me);
    }

    // ------------------------------------------------------------ moderation

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public EventDtos.EventDetail approve(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return eventService.approve(id, me);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public EventDtos.EventDetail reject(@PathVariable Long id, @Valid @RequestBody EventDtos.RejectRequest req,
                                        @AuthenticationPrincipal AuthUser me) {
        return eventService.reject(id, req.reason(), me);
    }

    // ------------------------------------------------------------ tickets

    @GetMapping("/{id}/tickets")
    @PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
    public List<TicketDtos.TicketTypeResponse> ticketTypes(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return ticketTypeService.list(id, me);
    }

    @PostMapping("/{id}/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ORGANIZER')")
    public TicketDtos.TicketTypeResponse createTicketType(@PathVariable Long id,
                                                         @Valid @RequestBody TicketDtos.TicketTypeRequest req,
                                                         @AuthenticationPrincipal AuthUser me) {
        return ticketTypeService.create(id, req, me);
    }

    @PutMapping("/{id}/tickets/{ticketTypeId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public TicketDtos.TicketTypeResponse updateTicketType(@PathVariable Long id, @PathVariable Long ticketTypeId,
                                                         @Valid @RequestBody TicketDtos.TicketTypeRequest req,
                                                         @AuthenticationPrincipal AuthUser me) {
        return ticketTypeService.update(id, ticketTypeId, req, me);
    }

    @DeleteMapping("/{id}/tickets/{ticketTypeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ORGANIZER')")
    public void deleteTicketType(@PathVariable Long id, @PathVariable Long ticketTypeId,
                                 @AuthenticationPrincipal AuthUser me) {
        ticketTypeService.delete(id, ticketTypeId, me);
    }

    // ------------------------------------------------------------ registrations & communication

    @GetMapping("/{id}/registrations")
    @PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
    public PageResponse<BookingDtos.EventRegistrationRow> registrations(
            @PathVariable Long id, @RequestParam(required = false) String q,
            @RequestParam(required = false) OrderStatus status, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size, @AuthenticationPrincipal AuthUser me) {
        return registrationService.eventRegistrations(id, me, q, status, page, size);
    }

    @GetMapping(value = "/{id}/registrations/export", produces = "text/csv")
    @PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
    @Operation(summary = "Download registrations as CSV")
    public ResponseEntity<byte[]> export(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        byte[] body = registrationService.exportCsv(id, me).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"registrations-event-" + id + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(body);
    }

    @GetMapping("/{id}/announcements")
    @PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
    public List<NotificationDtos.AnnouncementResponse> announcements(@PathVariable Long id,
                                                                     @AuthenticationPrincipal AuthUser me) {
        return announcementService.list(id, me);
    }

    @GetMapping("/{id}/announcements/preview")
    @PreAuthorize("hasRole('ORGANIZER')")
    @Operation(summary = "How many attendees an announcement would reach")
    public NotificationDtos.RecipientPreview announcementPreview(@PathVariable Long id,
                                                                 @AuthenticationPrincipal AuthUser me) {
        return announcementService.preview(id, me);
    }

    @PostMapping("/{id}/announcements")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ORGANIZER')")
    @Operation(summary = "Send an in-app announcement to registered attendees")
    public NotificationDtos.AnnouncementResponse announce(@PathVariable Long id,
                                                         @Valid @RequestBody NotificationDtos.AnnouncementRequest req,
                                                         @AuthenticationPrincipal AuthUser me) {
        return announcementService.send(id, req, me);
    }
}
