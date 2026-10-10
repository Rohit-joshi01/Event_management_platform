package com.aftr.integration;

import com.aftr.entity.Role;
import com.aftr.entity.User;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RegistrationIT extends IntegrationTestBase {

    @Test
    void paidPurchaseUsesLabelledDevCheckoutAndIssuesQrCodes() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User attendee = createUser("att@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 50, 79900);

        var booking = body(perform(post("/api/v1/registrations"), attendee, purchaseBody(ids[0], ids[1], 2))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.paymentStatus").value("SIMULATED_PAID"))
                .andExpect(jsonPath("$.paymentSimulated").value(true))
                .andExpect(jsonPath("$.totalCents").value(159800))
                .andExpect(jsonPath("$.tickets.length()").value(2)));
        String code = booking.get("tickets").get(0).get("code").asText();
        assertThat(code).hasSizeGreaterThanOrEqualTo(32).doesNotContain("att");
        assertThat(ticketTypes.currentSold(ids[1])).isEqualTo(2);
        assertThat(events.currentSold(ids[0])).isEqualTo(2);

        // Duplicate booking for the same event is refused.
        perform(post("/api/v1/registrations"), attendee, purchaseBody(ids[0], ids[1], 1))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_REGISTERED"));

        // Admin revenue figures never count simulated payments as real.
        perform(get("/api/v1/admin/analytics"), admin, null)
                .andExpect(jsonPath("$.revenue.realCents").value(0))
                .andExpect(jsonPath("$.revenue.simulatedCents").value(159800));

        // Organizer sees the registration; another organizer cannot verify the ticket.
        perform(get("/api/v1/events/" + ids[0] + "/registrations"), organizer, null)
                .andExpect(jsonPath("$.content[0].attendeeEmail").value("att@example.com"));
        User stranger = createUser("stranger@example.com", Role.ORGANIZER);
        perform(get("/api/v1/tickets/" + code + "/verify"), stranger, null).andExpect(status().isForbidden());

        perform(post("/api/v1/tickets/" + code + "/check-in"), organizer, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CHECKED_IN"));
        perform(post("/api/v1/tickets/" + code + "/check-in"), organizer, null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_CHECKED_IN"));
    }

    @Test
    void cannotBuyMoreThanRemainingOrPerOrderLimit() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User a = createUser("a@example.com", Role.ATTENDEE);
        User b = createUser("b@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 3, 0);

        perform(post("/api/v1/registrations"), a, purchaseBody(ids[0], ids[1], 5))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OVER_LIMIT"));
        perform(post("/api/v1/registrations"), a, purchaseBody(ids[0], ids[1], 2)).andExpect(status().isCreated());
        perform(post("/api/v1/registrations"), b, purchaseBody(ids[0], ids[1], 2))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SOLD_OUT"));
        assertThat(ticketTypes.currentSold(ids[1])).isEqualTo(2);
        perform(post("/api/v1/registrations"), b, purchaseBody(ids[0], ids[1], 1)).andExpect(status().isCreated());
        perform(get("/api/v1/events/" + ids[0]), null, null).andExpect(jsonPath("$.registrationState").value("SOLD_OUT"));
    }

    @Test
    void attendeeCancellationReleasesSeats() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User a = createUser("a@example.com", Role.ATTENDEE);
        User other = createUser("other@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 2, 0);
        String ref = body(perform(post("/api/v1/registrations"), a, purchaseBody(ids[0], ids[1], 2))).get("reference").asText();

        // Other attendees can't see or cancel someone else's booking.
        perform(get("/api/v1/bookings/" + ref), other, null).andExpect(status().isNotFound());
        perform(post("/api/v1/bookings/" + ref + "/cancel"), other, null).andExpect(status().isNotFound());

        perform(post("/api/v1/bookings/" + ref + "/cancel"), a, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.tickets[0].status").value("CANCELLED"));
        assertThat(ticketTypes.currentSold(ids[1])).isZero();
        perform(get("/api/v1/bookings?scope=cancelled"), a, null).andExpect(jsonPath("$.totalElements").value(1));

        // After cancelling, the attendee may book again.
        perform(post("/api/v1/registrations"), a, purchaseBody(ids[0], ids[1], 1)).andExpect(status().isCreated());
    }

    @Test
    void cannotRegisterForUnpublishedEvents() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User a = createUser("a@example.com", Role.ATTENDEE);
        long id = body(perform(post("/api/v1/events"), organizer, eventBody("Draft only"))).get("id").asLong();
        long tid = body(perform(post("/api/v1/events/" + id + "/tickets"), organizer, ticketBody("Free", 0, 5, 1))).get("id").asLong();
        perform(post("/api/v1/registrations"), a, purchaseBody(id, tid, 1))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_OPEN"));
    }

    @Test
    void ticketTypeFromAnotherEventIsRejected() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User a = createUser("a@example.com", Role.ATTENDEE);
        long[] first = publishedEvent(organizer, admin, 5, 0);
        long[] second = publishedEvent(organizer, admin, 5, 0);
        perform(post("/api/v1/registrations"), a, purchaseBody(first[0], second[1], 1))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_TICKET_TYPE"));
    }

    @Test
    void organizerCanExportCsvAndSendAnnouncements() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User a = createUser("a@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 5, 0);

        perform(post("/api/v1/events/" + ids[0] + "/announcements"), organizer,
                Map.of("subject", "Hello", "message", "Doors open at six sharp."))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_RECIPIENTS"));

        perform(post("/api/v1/registrations"), a, purchaseBody(ids[0], ids[1], 1)).andExpect(status().isCreated());
        perform(get("/api/v1/events/" + ids[0] + "/announcements/preview"), organizer, null)
                .andExpect(jsonPath("$.recipientCount").value(1));
        perform(post("/api/v1/events/" + ids[0] + "/announcements"), organizer,
                Map.of("subject", "Hello", "message", "Doors open at six sharp."))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.recipientCount").value(1))
                .andExpect(jsonPath("$.channel").value("IN_APP"));
        perform(get("/api/v1/notifications/unread-count"), a, null).andExpect(jsonPath("$.unread").value(2));

        perform(get("/api/v1/events/" + ids[0] + "/registrations/export"), organizer, null)
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("a@example.com")));
    }
}
