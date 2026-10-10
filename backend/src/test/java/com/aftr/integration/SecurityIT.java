package com.aftr.integration;

import com.aftr.entity.Role;
import com.aftr.entity.User;
import com.aftr.entity.UserStatus;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Role-based access control and ownership checks are enforced by the server. */
class SecurityIT extends IntegrationTestBase {

    @Test
    void adminEndpointsRequireAdminRole() throws Exception {
        User attendee = createUser("att@example.com", Role.ATTENDEE);
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);

        perform(get("/api/v1/admin/analytics"), null, null).andExpect(status().isUnauthorized());
        perform(get("/api/v1/admin/analytics"), attendee, null).andExpect(status().isForbidden());
        perform(get("/api/v1/users"), organizer, null).andExpect(status().isForbidden());
        perform(get("/api/v1/admin/analytics"), admin, null).andExpect(status().isOk());
        perform(get("/api/v1/users"), admin, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void onlyOrganizersCreateEventsAndOnlyAttendeesBook() throws Exception {
        User attendee = createUser("att@example.com", Role.ATTENDEE);
        User admin = createUser("admin@example.com", Role.ADMIN);
        User organizer = createUser("org@example.com", Role.ORGANIZER);

        perform(post("/api/v1/events"), attendee, eventBody("Nope")).andExpect(status().isForbidden());
        perform(post("/api/v1/events"), admin, eventBody("Nope")).andExpect(status().isForbidden());
        long[] ids = publishedEvent(organizer, admin, 10, 0);
        perform(post("/api/v1/registrations"), organizer, purchaseBody(ids[0], ids[1], 1)).andExpect(status().isForbidden());
        perform(post("/api/v1/registrations"), attendee, purchaseBody(ids[0], ids[1], 1)).andExpect(status().isCreated());
    }

    @Test
    void organizersCannotTouchOtherOrganizersEvents() throws Exception {
        User owner = createUser("owner@example.com", Role.ORGANIZER);
        User other = createUser("other@example.com", Role.ORGANIZER);
        long eventId = body(perform(post("/api/v1/events"), owner, eventBody("Mine"))).get("id").asLong();

        // Draft is invisible to everyone except the owner and admins.
        perform(get("/api/v1/events/" + eventId), other, null).andExpect(status().isNotFound());
        perform(get("/api/v1/events/" + eventId), null, null).andExpect(status().isNotFound());
        perform(put("/api/v1/events/" + eventId), other, eventBody("Hijacked")).andExpect(status().isNotFound());
        perform(post("/api/v1/events/" + eventId + "/tickets"), other, ticketBody("Free", 0, 5, 1)).andExpect(status().isNotFound());
        perform(get("/api/v1/events/" + eventId + "/registrations"), other, null).andExpect(status().isForbidden());
        perform(delete("/api/v1/events/" + eventId), other, null).andExpect(status().isNotFound());
        perform(get("/api/v1/events/" + eventId), owner, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerIsOwner").value(true));
    }

    @Test
    void organizerCannotApproveOwnEvent() throws Exception {
        User owner = createUser("owner@example.com", Role.ORGANIZER);
        long eventId = body(perform(post("/api/v1/events"), owner, eventBody("Mine"))).get("id").asLong();
        perform(post("/api/v1/events/" + eventId + "/tickets"), owner, ticketBody("Free", 0, 5, 1)).andExpect(status().isCreated());
        perform(post("/api/v1/events/" + eventId + "/submit"), owner, null).andExpect(status().isOk());
        perform(post("/api/v1/events/" + eventId + "/approve"), owner, null).andExpect(status().isForbidden());
    }

    @Test
    void suspensionAndRoleChangesTakeEffectImmediately() throws Exception {
        User admin = createUser("admin@example.com", Role.ADMIN);
        User target = createUser("target@example.com", Role.ORGANIZER);

        perform(get("/api/v1/organizer/analytics"), target, null).andExpect(status().isOk());

        // Role changed in the database: the stale ORGANIZER principal must no longer work.
        perform(patch("/api/v1/users/" + target.getId()), admin,
                Map.of("fullName", "Target", "role", "ATTENDEE")).andExpect(status().isOk());
        perform(get("/api/v1/organizer/analytics"), target, null).andExpect(status().isForbidden());

        perform(post("/api/v1/users/" + target.getId() + "/suspend"), admin, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SUSPENDED"));
        User reloaded = users.findById(target.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(reloaded.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        perform(get("/api/v1/me"), target, null).andExpect(status().isUnauthorized());
    }

    @Test
    void adminCannotDemoteOrSuspendSelf() throws Exception {
        User admin = createUser("admin@example.com", Role.ADMIN);
        perform(patch("/api/v1/users/" + admin.getId()), admin, Map.of("fullName", "Admin", "role", "ATTENDEE"))
                .andExpect(status().isConflict());
        perform(post("/api/v1/users/" + admin.getId() + "/suspend"), admin, null).andExpect(status().isConflict());
    }

    @Test
    void auditLogRecordsAdministrativeActions() throws Exception {
        User admin = createUser("admin@example.com", Role.ADMIN);
        User target = createUser("target@example.com", Role.ATTENDEE);
        perform(post("/api/v1/users/" + target.getId() + "/suspend"), admin, null).andExpect(status().isOk());
        perform(get("/api/v1/admin/audit-logs?action=USER_SUSPENDED"), admin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].actorEmail").value("admin@example.com"));
    }
}
