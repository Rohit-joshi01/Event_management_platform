package com.aftr.controller;

import com.aftr.dto.NotificationDtos;
import com.aftr.dto.PageResponse;
import com.aftr.security.AuthUser;
import com.aftr.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public PageResponse<NotificationDtos.NotificationResponse> list(@RequestParam(defaultValue = "false") boolean unread,
                                                                    @RequestParam(defaultValue = "0") int page,
                                                                    @RequestParam(defaultValue = "20") int size,
                                                                    @AuthenticationPrincipal AuthUser me) {
        return notificationService.list(me.getId(), unread, page, size);
    }

    @GetMapping("/unread-count")
    public NotificationDtos.UnreadCount unread(@AuthenticationPrincipal AuthUser me) {
        return new NotificationDtos.UnreadCount(notificationService.unreadCount(me.getId()));
    }

    @PatchMapping("/{id}")
    public NotificationDtos.NotificationResponse mark(@PathVariable Long id, @RequestBody Map<String, Boolean> body,
                                                      @AuthenticationPrincipal AuthUser me) {
        return notificationService.markRead(me.getId(), id, Boolean.TRUE.equals(body.get("read")));
    }

    @PostMapping("/read-all")
    public Map<String, Integer> readAll(@AuthenticationPrincipal AuthUser me) {
        return Map.of("updated", notificationService.markAllRead(me.getId()));
    }
}
