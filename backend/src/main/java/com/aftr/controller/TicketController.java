package com.aftr.controller;

import com.aftr.dto.TicketDtos;
import com.aftr.security.AuthUser;
import com.aftr.service.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tickets")
@Tag(name = "Ticket verification")
@PreAuthorize("hasAnyRole('ORGANIZER','ADMIN')")
public class TicketController {

    private final RegistrationService registrationService;

    public TicketController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @GetMapping("/{code}/verify")
    @Operation(summary = "Look up a ticket by the code in its QR (organizer of that event or admin)")
    public TicketDtos.TicketVerification verify(@PathVariable String code, @AuthenticationPrincipal AuthUser me) {
        return registrationService.verify(code, me);
    }

    @PostMapping("/{code}/check-in")
    @Operation(summary = "Mark a valid ticket as used")
    public TicketDtos.TicketVerification checkIn(@PathVariable String code, @AuthenticationPrincipal AuthUser me) {
        return registrationService.checkIn(code, me);
    }
}
