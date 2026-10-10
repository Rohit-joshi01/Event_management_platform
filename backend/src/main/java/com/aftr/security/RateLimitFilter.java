package com.aftr.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window, per-IP rate limiting for credential endpoints (login, registration,
 * password change) to slow down brute-force and enumeration attempts.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/me/password", "/api/v1/me/email");

    private final int maxRequests;
    private final long windowSeconds;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(int maxRequests, long windowSeconds) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod()) || !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = Instant.now().getEpochSecond();
        String key = request.getRemoteAddr() + "|" + request.getRequestURI();
        Window w = windows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.start >= windowSeconds) {
                return new Window(now, 1);
            }
            return new Window(existing.start, existing.count + 1);
        });
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> now - e.getValue().start >= windowSeconds);
        }
        if (w.count > maxRequests) {
            long retry = Math.max(1, windowSeconds - (now - w.start));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retry));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":"
                    + "\"Too many attempts. Try again in " + retry + " seconds.\",\"path\":\""
                    + request.getRequestURI() + "\",\"fieldErrors\":[]}");
            return;
        }
        chain.doFilter(request, response);
    }

    private record Window(long start, int count) {
    }
}
