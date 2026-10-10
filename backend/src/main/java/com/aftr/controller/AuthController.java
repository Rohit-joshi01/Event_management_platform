package com.aftr.controller;

import com.aftr.dto.AuthDtos;
import com.aftr.dto.UserDtos;
import com.aftr.security.AuthUser;
import com.aftr.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contextRepository,
                          UserService userService) {
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.userService = userService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create an attendee or organizer account and start a session")
    public AuthDtos.SessionResponse register(@Valid @RequestBody AuthDtos.RegisterRequest req,
                                             HttpServletRequest request, HttpServletResponse response) {
        userService.register(req);
        return establishSession(req.email(), req.password(), request, response);
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password")
    public AuthDtos.SessionResponse login(@Valid @RequestBody AuthDtos.LoginRequest req,
                                          HttpServletRequest request, HttpServletResponse response) {
        return establishSession(req.email(), req.password(), request, response);
    }

    @GetMapping("/session")
    @Operation(summary = "Current session, or authenticated=false")
    public AuthDtos.SessionResponse session(@AuthenticationPrincipal AuthUser me) {
        if (me == null) {
            return new AuthDtos.SessionResponse(false, null);
        }
        return new AuthDtos.SessionResponse(true, userService.me(me.getId()));
    }

    @GetMapping("/csrf")
    @Operation(summary = "Issue the XSRF-TOKEN cookie; echo it in the X-XSRF-TOKEN header on writes")
    public AuthDtos.CsrfResponse csrf(CsrfToken token) {
        return new AuthDtos.CsrfResponse(token.getHeaderName(), token.getToken());
    }

    private AuthDtos.SessionResponse establishSession(String email, String password, HttpServletRequest request,
                                                      HttpServletResponse response) {
        Authentication auth = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email.trim().toLowerCase(), password));
        // Prevent session fixation: rotate the session id on privilege change.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        AuthUser principal = (AuthUser) auth.getPrincipal();
        UserDtos.UserResponse user = userService.recordLogin(principal.getId());
        return new AuthDtos.SessionResponse(true, user);
    }
}
