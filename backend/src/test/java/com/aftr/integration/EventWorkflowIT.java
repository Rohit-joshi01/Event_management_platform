package com.aftr.integration;

import com.aftr.entity.Role;
import com.aftr.entity.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EventWorkflowIT extends IntegrationTestBase {

    @Test
    void draftSubmitApprovePublishLifecycle() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);

        long id = body(perform(post("/api/v1/events"), organizer, eventBody("Lifecycle Summit"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))).get("id").asLong();

        // Not ready: no ticket types yet.
        perform(post("/api/v1/events/" + id + "/submit"), organizer, null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOT_READY"));

        perform(post("/api/v1/events/" + id + "/tickets"), organizer, ticketBody("Standard", 49900, 100, 4))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.remaining").value(100));
        perform(post("/api/v1/events/" + id + "/submit"), organizer, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));

        // Pending events are not public and not editable.
        perform(get("/api/v1/events?q=Lifecycle"), null, null).andExpect(jsonPath("$.totalElements").value(0));
        perform(put("/api/v1/events/" + id), organizer, eventBody("Edited")).andExpect(status().isConflict());

        perform(get("/api/v1/admin/events?status=PENDING"), admin, null)
                .andExpect(jsonPath("$.totalElements").value(1));
        perform(post("/api/v1/events/" + id + "/approve"), admin, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.registrationState").value("OPEN"));

        perform(get("/api/v1/events?q=lifecycle&category=technology&city=Bengaluru"), null, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].minPriceCents").value(49900));
        perform(get("/api/v1/events?price=free"), null, null).andExpect(jsonPath("$.totalElements").value(0));
        perform(get("/api/v1/admin/approvals"), admin, null)
                .andExpect(jsonPath("$.content[0].decision").value("APPROVED"));
    }

    @Test
    void rejectionRequiresReasonAndReturnsEventToOrganizer() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        long id = body(perform(post("/api/v1/events"), organizer, eventBody("Needs Work"))).get("id").asLong();
        perform(post("/api/v1/events/" + id + "/tickets"), organizer, ticketBody("Free", 0, 10, 1));
        perform(post("/api/v1/events/" + id + "/submit"), organizer, null).andExpect(status().isOk());

        perform(post("/api/v1/events/" + id + "/reject"), admin, Map.of("reason", ""))
                .andExpect(status().isBadRequest());
        perform(post("/api/v1/events/" + id + "/reject"), admin, Map.of("reason", "Please confirm the venue booking."))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("Please confirm the venue booking."));

        // Organizer can edit and resubmit; notification was delivered.
        perform(put("/api/v1/events/" + id), organizer, eventBody("Needs Work v2")).andExpect(status().isOk());
        perform(post("/api/v1/events/" + id + "/submit"), organizer, null)
                .andExpect(jsonPath("$.status").value("PENDING"));
        perform(get("/api/v1/notifications"), organizer, null)
                .andExpect(jsonPath("$.content[0].type").value("EVENT_REJECTED"));
    }

    @Test
    void invalidScheduleAndDatesAreRejected() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        Map<String, Object> body = eventBody("Bad Dates");
        body.put("endsAt", Instant.parse((String) body.get("startsAt")).minus(Duration.ofHours(1)).toString());
        perform(post("/api/v1/events"), organizer, body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        Map<String, Object> past = eventBody("Past");
        past.put("startsAt", Instant.now().minus(Duration.ofDays(1)).toString());
        past.put("endsAt", Instant.now().minus(Duration.ofHours(20)).toString());
        perform(post("/api/v1/events"), organizer, past).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("START_IN_PAST"));
    }

    @Test
    void approvalCanBeSwitchedOffInSettings() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        perform(put("/api/v1/admin/settings"), admin, Map.of("values", Map.of("events.requireApproval", "false")))
                .andExpect(status().isOk());
        long id = body(perform(post("/api/v1/events"), organizer, eventBody("Instant"))).get("id").asLong();
        perform(post("/api/v1/events/" + id + "/tickets"), organizer, ticketBody("Free", 0, 10, 1));
        perform(post("/api/v1/events/" + id + "/submit"), organizer, null)
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        perform(put("/api/v1/admin/settings"), admin, Map.of("values", Map.of("events.minLeadHours", "9999")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ticketQuantityCannotDropBelowSoldAndSoldTypesCannotBeDeleted() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User attendee = createUser("att@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 10, 0);
        perform(post("/api/v1/registrations"), attendee, purchaseBody(ids[0], ids[1], 3)).andExpect(status().isCreated());

        perform(put("/api/v1/events/" + ids[0] + "/tickets/" + ids[1]), organizer, ticketBody("General", 0, 2, 4))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUANTITY_BELOW_SOLD"));
        perform(put("/api/v1/events/" + ids[0] + "/tickets/" + ids[1]), organizer, ticketBody("General", 0, 3, 4))
                .andExpect(status().isOk()).andExpect(jsonPath("$.remaining").value(0));
        perform(delete("/api/v1/events/" + ids[0] + "/tickets/" + ids[1]), organizer, null)
                .andExpect(status().isConflict());
        perform(post("/api/v1/events/" + ids[0] + "/unpublish"), organizer, null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("HAS_REGISTRATIONS"));
    }

    @Test
    void cancellingAnEventCancelsBookingsAndNotifiesAttendees() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User attendee = createUser("att@example.com", Role.ATTENDEE);
        long[] ids = publishedEvent(organizer, admin, 10, 50000);
        String ref = body(perform(post("/api/v1/registrations"), attendee, purchaseBody(ids[0], ids[1], 2))).get("reference").asText();

        perform(post("/api/v1/events/" + ids[0] + "/cancel"), organizer, Map.of("reason", "The venue flooded overnight."))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        perform(get("/api/v1/bookings/" + ref), attendee, null)
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.paymentStatus").value("SIMULATED_REFUNDED"));
        perform(get("/api/v1/notifications?unread=true"), attendee, null)
                .andExpect(jsonPath("$.content[0].type").value("EVENT_CANCELLED"));
        org.assertj.core.api.Assertions.assertThat(ticketTypes.currentSold(ids[1])).isZero();
    }
}
