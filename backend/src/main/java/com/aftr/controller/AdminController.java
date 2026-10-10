package com.aftr.controller;

import com.aftr.dto.AdminDtos;
import com.aftr.dto.AnalyticsDtos;
import com.aftr.dto.EventDtos;
import com.aftr.dto.PageResponse;
import com.aftr.security.AuthUser;
import com.aftr.service.AnalyticsService;
import com.aftr.service.AuditQueryService;
import com.aftr.service.EventService;
import com.aftr.service.SettingsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Administration")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AnalyticsService analyticsService;
    private final EventService eventService;
    private final AuditQueryService auditQueryService;
    private final SettingsService settingsService;

    public AdminController(AnalyticsService analyticsService, EventService eventService,
                           AuditQueryService auditQueryService, SettingsService settingsService) {
        this.analyticsService = analyticsService;
        this.eventService = eventService;
        this.auditQueryService = auditQueryService;
        this.settingsService = settingsService;
    }

    @GetMapping("/analytics")
    public AnalyticsDtos.AdminAnalytics analytics() {
        return analyticsService.admin();
    }

    @GetMapping("/events")
    public PageResponse<EventDtos.EventSummary> events(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String q,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        return eventService.adminEvents(status, q, page, size);
    }

    @PatchMapping("/events/{id}/feature")
    public EventDtos.EventSummary feature(@PathVariable Long id, @RequestBody EventDtos.FeatureRequest req,
                                          @AuthenticationPrincipal AuthUser me) {
        return eventService.setFeatured(id, req.featured(), me);
    }

    @GetMapping("/approvals")
    public PageResponse<AdminDtos.ApprovalRecordResponse> approvals(@RequestParam(defaultValue = "0") int page,
                                                                    @RequestParam(defaultValue = "20") int size) {
        return eventService.approvalHistory(page, size);
    }

    @GetMapping("/audit-logs")
    public PageResponse<AdminDtos.AuditLogResponse> auditLogs(
            @RequestParam(required = false) String q, @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size) {
        return auditQueryService.search(q, action, entityType, from, to, page, size);
    }

    @GetMapping("/settings")
    public AdminDtos.SettingsResponse settings() {
        return settingsService.all();
    }

    @PutMapping("/settings")
    public AdminDtos.SettingsResponse updateSettings(@Valid @RequestBody AdminDtos.SettingsUpdateRequest req,
                                                     @AuthenticationPrincipal AuthUser me) {
        return settingsService.update(req.values(), me);
    }
}
