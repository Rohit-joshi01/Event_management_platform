package com.aftr.dto;

import com.aftr.entity.Role;
import com.aftr.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Enter your full name.") @Size(min = 2, max = 120) String fullName,
            @NotBlank(message = "Enter your email.") @Email(message = "Enter a valid email address.") @Size(max = 254) String email,
            @NotBlank(message = "Choose a password.") @StrongPassword String password,
            /** Only ATTENDEE or ORGANIZER are accepted; ADMIN is rejected server-side. */
            @NotNull(message = "Choose an account type.") Role role,
            @Size(max = 160) String organizationName) {
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email.") @Email(message = "Enter a valid email address.") String email,
            @NotBlank(message = "Enter your password.") String password) {
    }

    public record SessionResponse(boolean authenticated, UserDtos.UserResponse user) {
    }

    public record CsrfResponse(String headerName, String token) {
    }
}
