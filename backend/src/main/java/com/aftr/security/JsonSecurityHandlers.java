package com.aftr.security;

import com.aftr.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Consistent JSON bodies for 401 / 403 responses produced by the security filter chain. */
@Component
public class JsonSecurityHandlers {

    private final ObjectMapper mapper;

    public JsonSecurityHandlers(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public AuthenticationEntryPoint entryPoint() {
        return (request, response, ex) ->
                write(request, response, HttpStatus.UNAUTHORIZED, "Sign in to continue.");
    }

    public AccessDeniedHandler accessDenied() {
        return (request, response, ex) -> {
            String message = ex instanceof CsrfException
                    ? "Your session token expired. Refresh the page and try again."
                    : "You don't have permission to do that.";
            write(request, response, HttpStatus.FORBIDDEN, message);
        };
    }

    private void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ErrorResponse.of(status, message, request.getRequestURI()));
    }
}
