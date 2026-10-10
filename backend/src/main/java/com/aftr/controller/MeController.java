package com.aftr.controller;

import com.aftr.dto.EventDtos;
import com.aftr.dto.UserDtos;
import com.aftr.security.AuthUser;
import com.aftr.service.EventService;
import com.aftr.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "My account")
public class MeController {

    private final UserService userService;
    private final EventService eventService;

    public MeController(UserService userService, EventService eventService) {
        this.userService = userService;
        this.eventService = eventService;
    }

    @GetMapping
    public UserDtos.UserResponse me(@AuthenticationPrincipal AuthUser me) {
        return userService.me(me.getId());
    }

    @PutMapping
    @Operation(summary = "Update profile and notification preferences")
    public UserDtos.UserResponse update(@AuthenticationPrincipal AuthUser me,
                                        @Valid @RequestBody UserDtos.UpdateProfileRequest req) {
        return userService.updateProfile(me.getId(), req);
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Change password (requires the current password)")
    public void changePassword(@AuthenticationPrincipal AuthUser me,
                               @Valid @RequestBody UserDtos.ChangePasswordRequest req) {
        userService.changePassword(me.getId(), req);
    }

    @PostMapping("/email")
    @Operation(summary = "Change sign-in email (requires the current password)")
    public UserDtos.UserResponse changeEmail(@AuthenticationPrincipal AuthUser me,
                                             @Valid @RequestBody UserDtos.ChangeEmailRequest req) {
        return userService.changeEmail(me.getId(), req);
    }

    @GetMapping("/recommendations")
    @PreAuthorize("hasRole('ATTENDEE')")
    @Operation(summary = "Suggested events based on booking history")
    public List<EventDtos.EventSummary> recommendations(@AuthenticationPrincipal AuthUser me,
                                                        @RequestParam(defaultValue = "6") int limit) {
        return eventService.recommendations(me.getId(), Math.min(Math.max(limit, 1), 12));
    }
}
