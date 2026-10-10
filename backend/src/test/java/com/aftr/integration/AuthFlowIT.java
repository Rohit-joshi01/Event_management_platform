package com.aftr.integration;

import com.aftr.entity.Role;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthFlowIT extends IntegrationTestBase {

    @Test
    void registerLoginSessionAndLogout() throws Exception {
        MvcResult reg = mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("fullName", "Asha Verma", "email", "Asha@Example.com",
                                "password", "Secur3pass", "role", "ATTENDEE"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.email").value("asha@example.com"))
                .andExpect(jsonPath("$.user.role").value("ATTENDEE"))
                .andReturn();
        // Sessions are stored by Spring Session JDBC, which ignores MockHttpSession: the session
        // travels in the AFTR_SESSION cookie exactly as it does for the browser.
        Cookie session = reg.getResponse().getCookie("AFTR_SESSION");
        assertThat(session).isNotNull();

        mvc.perform(get("/api/v1/auth/session").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.fullName").value("Asha Verma"));

        mvc.perform(post("/api/v1/auth/logout").cookie(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void cannotSelfRegisterAsAdmin() throws Exception {
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("fullName", "Mallory", "email", "m@example.com",
                                "password", "Secur3pass", "role", "ADMIN"))))
                .andExpect(status().isForbidden());
        assertThat(users.findByEmailIgnoreCase("m@example.com")).isEmpty();
    }

    @Test
    void validationErrorsAreReportedPerField() throws Exception {
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("fullName", "A", "email", "not-an-email",
                                "password", "short", "role", "ATTENDEE"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(3));
    }

    @Test
    void duplicateEmailIsRejected() throws Exception {
        createUser("taken@example.com", Role.ATTENDEE);
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("fullName", "Someone", "email", "TAKEN@example.com",
                                "password", "Secur3pass", "role", "ORGANIZER"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void wrongPasswordIsUnauthorizedAndSuspendedAccountIsForbidden() throws Exception {
        var user = createUser("person@example.com", Role.ATTENDEE);
        mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("email", "person@example.com", "password", "wrongpass1"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("email", "person@example.com", "password", PASSWORD))))
                .andExpect(status().isOk());

        user.setStatus(com.aftr.entity.UserStatus.SUSPENDED);
        users.saveAndFlush(user);
        mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("email", "person@example.com", "password", PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void writesWithoutCsrfTokenAreRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("email", "x@example.com", "password", "whatever1"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void anonymousSessionEndpointReportsSignedOut() throws Exception {
        mvc.perform(get("/api/v1/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));
    }
}
