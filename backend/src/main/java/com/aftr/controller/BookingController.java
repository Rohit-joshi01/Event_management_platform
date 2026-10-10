package com.aftr.controller;

import com.aftr.dto.BookingDtos;
import com.aftr.dto.PageResponse;
import com.aftr.security.AuthUser;
import com.aftr.service.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Registrations & bookings")
@PreAuthorize("hasRole('ATTENDEE')")
public class BookingController {

    private final RegistrationService registrationService;

    public BookingController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @PostMapping("/registrations")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register for an event / purchase tickets",
            description = "Inventory is reserved atomically. Paid tickets use the development checkout "
                    + "(paymentStatus=SIMULATED_PAID) because no payment provider is configured.")
    public BookingDtos.BookingResponse register(@Valid @RequestBody BookingDtos.PurchaseRequest req,
                                                @AuthenticationPrincipal AuthUser me) {
        return registrationService.purchase(req, me);
    }

    @GetMapping("/bookings")
    @Operation(summary = "My bookings. scope: upcoming | past | cancelled | all")
    public PageResponse<BookingDtos.BookingResponse> bookings(@RequestParam(defaultValue = "upcoming") String scope,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "20") int size,
                                                              @AuthenticationPrincipal AuthUser me) {
        return registrationService.myBookings(me.getId(), scope, page, size);
    }

    @GetMapping("/bookings/{reference}")
    public BookingDtos.BookingResponse booking(@PathVariable String reference, @AuthenticationPrincipal AuthUser me) {
        return registrationService.booking(reference, me);
    }

    @PostMapping("/bookings/{reference}/cancel")
    @Operation(summary = "Cancel my booking before the event starts and release the seats")
    public BookingDtos.BookingResponse cancel(@PathVariable String reference, @AuthenticationPrincipal AuthUser me) {
        return registrationService.cancel(reference, me);
    }
}
