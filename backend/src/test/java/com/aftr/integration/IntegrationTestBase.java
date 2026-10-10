package com.aftr.integration;

import com.aftr.entity.*;
import com.aftr.repository.*;
import com.aftr.security.AuthUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Boots the full application against a real PostgreSQL database (profile "test", database
 * aftr_test) and resets all mutable tables before each test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    protected static final String PASSWORD = "Passw0rd!x";

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected UserRepository users;
    @Autowired protected EventRepository events;
    @Autowired protected TicketTypeRepository ticketTypes;
    @Autowired protected PasswordEncoder passwordEncoder;

    private String passwordHash;

    @BeforeEach
    void resetDatabase() {
        jdbc.execute("""
                TRUNCATE TABLE tickets, orders, ticket_types, event_schedule_items, approval_records, announcements,
                notifications, audit_logs, events, venues, spring_session_attributes, spring_session, users
                RESTART IDENTITY CASCADE""");
        // TRUNCATE ... CASCADE also empties platform_settings (FK updated_by -> users), so restore defaults.
        jdbc.execute("""
                INSERT INTO platform_settings (setting_key, value) VALUES
                ('platform.name', 'AFTR'), ('platform.supportEmail', 'support@aftr.dev'),
                ('registration.allowAttendeeSignup', 'true'), ('registration.allowOrganizerSignup', 'true'),
                ('events.requireApproval', 'true'), ('events.minLeadHours', '24'), ('events.maxTicketTypes', '6'),
                ('notifications.notifyAdminsOnSubmission', 'true'), ('notifications.notifyOrganizerOnRegistration', 'true')
                ON CONFLICT (setting_key) DO UPDATE SET value = EXCLUDED.value, updated_by = NULL""");
    }

    // ------------------------------------------------------------ fixtures

    protected User createUser(String email, Role role) {
        if (passwordHash == null) passwordHash = passwordEncoder.encode(PASSWORD);
        User u = new User();
        u.setEmail(email);
        u.setFullName(email.substring(0, email.indexOf('@')));
        u.setRole(role);
        u.setPasswordHash(passwordHash);
        u.setStatus(UserStatus.ACTIVE);
        return users.saveAndFlush(u);
    }

    protected RequestPostProcessor as(User u) {
        AuthUser principal = AuthUser.from(u);
        principal.eraseCredentials();
        return authentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
    }

    protected Map<String, Object> eventBody(String title) {
        Instant start = Instant.now().plus(Duration.ofDays(10)).truncatedTo(ChronoUnit.HOURS);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("summary", "A test event used by the integration suite.");
        m.put("description", "This is a long enough description for the submission rules, describing what attendees can expect on the day.");
        m.put("categorySlug", "technology");
        m.put("coverImageUrl", "https://images.example.com/cover.jpg");
        m.put("startsAt", start.toString());
        m.put("endsAt", start.plus(Duration.ofHours(4)).toString());
        m.put("timezone", "Asia/Kolkata");
        m.put("format", "IN_PERSON");
        m.put("venueName", "Test Hall");
        m.put("venueAddress", "1 Test Road");
        m.put("city", "Bengaluru");
        m.put("schedule", List.of(Map.of("startsAt", start.plus(Duration.ofMinutes(30)).toString(), "title", "Opening")));
        return m;
    }

    protected Map<String, Object> ticketBody(String name, long pricePaise, int quantity, int maxPerOrder) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("priceCents", pricePaise);
        m.put("quantity", quantity);
        m.put("maxPerOrder", maxPerOrder);
        return m;
    }

    /** Creates, ticket-ups, submits and approves an event through the real API. Returns {eventId, ticketTypeId}. */
    protected long[] publishedEvent(User organizer, User admin, int quantity, long pricePaise) throws Exception {
        long eventId = body(perform(post("/api/v1/events"), organizer, eventBody("Published Event"))).get("id").asLong();
        long ticketId = body(perform(post("/api/v1/events/" + eventId + "/tickets"), organizer,
                ticketBody("General", pricePaise, quantity, 4))).get("id").asLong();
        perform(post("/api/v1/events/" + eventId + "/submit"), organizer, null);
        perform(post("/api/v1/events/" + eventId + "/approve"), admin, null);
        return new long[]{eventId, ticketId};
    }

    // ------------------------------------------------------------ request helpers

    protected ResultActions perform(MockHttpServletRequestBuilder req, User actor, Object body) throws Exception {
        if (actor != null) req.with(as(actor));
        req.with(csrf());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        }
        return mvc.perform(req);
    }

    protected JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    protected Map<String, Object> purchaseBody(long eventId, long ticketTypeId, int qty) {
        return Map.of("eventId", eventId, "items", List.of(Map.of("ticketTypeId", ticketTypeId, "quantity", qty)));
    }

}
