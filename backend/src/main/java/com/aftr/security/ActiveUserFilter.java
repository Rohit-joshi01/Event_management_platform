package com.aftr.security;

import com.aftr.entity.User;
import com.aftr.entity.UserStatus;
import com.aftr.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Re-validates the session principal against the database on every request so that
 * suspensions, deletions and role changes made by an administrator take effect
 * immediately — the session can never carry stale or client-supplied privileges.
 */
public class ActiveUserFilter extends OncePerRequestFilter {

    private final UserRepository users;
    private final SecurityContextRepository contextRepository;

    public ActiveUserFilter(UserRepository users, SecurityContextRepository contextRepository) {
        this.users = users;
        this.contextRepository = contextRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser principal) {
            Optional<User> current = users.findById(principal.getId());
            if (current.isEmpty() || current.get().getStatus() != UserStatus.ACTIVE) {
                SecurityContextHolder.clearContext();
                HttpSession session = request.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
            } else {
                User user = current.get();
                if (user.getRole() != principal.getRole() || !user.getEmail().equals(principal.getEmail())
                        || !user.getFullName().equals(principal.getFullName())) {
                    AuthUser refreshed = AuthUser.from(user);
                    refreshed.eraseCredentials();
                    UsernamePasswordAuthenticationToken token =
                            UsernamePasswordAuthenticationToken.authenticated(refreshed, null, refreshed.getAuthorities());
                    SecurityContext context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(token);
                    SecurityContextHolder.setContext(context);
                    contextRepository.saveContext(context, request, response);
                }
            }
        }
        chain.doFilter(request, response);
    }
}
