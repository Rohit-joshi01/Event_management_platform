package com.aftr.controller;

import com.aftr.dto.AnalyticsDtos;
import com.aftr.dto.EventDtos;
import com.aftr.dto.NotificationDtos;
import com.aftr.dto.PageResponse;
import com.aftr.security.AuthUser;
import com.aftr.service.AnalyticsService;
import com.aftr.service.AnnouncementService;
import com.aftr.service.EventService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/organizer")
@Tag(name = "Organizer workspace")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerController {

    private final EventService eventService;
    private final AnalyticsService analyticsService;
    private final AnnouncementService announcementService;

    public OrganizerController(EventService eventService, AnalyticsService analyticsService,
                               AnnouncementService announcementService) {
        this.eventService = eventService;
        this.analyticsService = analyticsService;
        this.announcementService = announcementService;
    }

    @GetMapping("/events")
    public PageResponse<EventDtos.EventSummary> events(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String q,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size,
                                                       @AuthenticationPrincipal AuthUser me) {
        return eventService.organizerEvents(me, status, q, page, size);
    }

    @GetMapping("/analytics")
    public AnalyticsDtos.OrganizerAnalytics analytics(@AuthenticationPrincipal AuthUser me) {
        return analyticsService.organizer(me);
    }

    @GetMapping("/announcements")
    public List<NotificationDtos.AnnouncementResponse> announcements(@AuthenticationPrincipal AuthUser me) {
        return announcementService.listForOrganizer(me);
    }
}
