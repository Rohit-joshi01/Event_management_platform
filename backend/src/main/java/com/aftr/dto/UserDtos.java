package com.aftr.dto;

import com.aftr.entity.Role;
import com.aftr.entity.UserStatus;
import com.aftr.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class UserDtos {

    private UserDtos() {
    }

    public record UserResponse(
            Long id, String email, String fullName, Role role, UserStatus status, String avatarUrl, String bio,
            String organizationName, String city, boolean notifyAnnouncements, boolean notifyReminders,
            boolean notifyRecommendations, Instant createdAt, Instant lastLoginAt) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Name can't be empty.") @Size(min = 2, max = 120) String fullName,
            @Size(max = 600) String bio,
            @Size(max = 500) @Pattern(regexp = "^(|/uploads/[A-Za-z0-9._-]+|https://.+)$",
                    message = "Use an uploaded image or an https:// URL.") String avatarUrl,
            @Size(max = 160) String organizationName,
            @Size(max = 100) String city,
            boolean notifyAnnouncements,
            boolean notifyReminders,
            boolean notifyRecommendations) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter your current password.") String currentPassword,
            @NotBlank(message = "Choose a new password.") @StrongPassword String newPassword) {
    }

    public record ChangeEmailRequest(
            @NotBlank @Email(message = "Enter a valid email address.") @Size(max = 254) String newEmail,
            @NotBlank(message = "Confirm with your current password.") String currentPassword) {
    }

    public record AdminUserResponse(
            Long id, String email, String fullName, Role role, UserStatus status, String avatarUrl,
            String organizationName, String city, Instant createdAt, Instant lastLoginAt, long eventCount,
            long bookingCount, boolean seed) {
    }

    public record AdminUpdateUserRequest(
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @NotNull Role role,
            @Size(max = 160) String organizationName) {
    }
}
