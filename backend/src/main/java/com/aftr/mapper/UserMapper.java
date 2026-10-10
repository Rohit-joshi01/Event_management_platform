package com.aftr.mapper;

import com.aftr.dto.UserDtos;
import com.aftr.entity.User;

public final class UserMapper {

    private UserMapper() {
    }

    public static UserDtos.UserResponse toResponse(User u) {
        return new UserDtos.UserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getStatus(),
                u.getAvatarUrl(), u.getBio(), u.getOrganizationName(), u.getCity(), u.isNotifyAnnouncements(),
                u.isNotifyReminders(), u.isNotifyRecommendations(), u.getCreatedAt(), u.getLastLoginAt());
    }

    public static UserDtos.AdminUserResponse toAdminResponse(User u, long eventCount, long bookingCount) {
        return new UserDtos.AdminUserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getStatus(),
                u.getAvatarUrl(), u.getOrganizationName(), u.getCity(), u.getCreatedAt(), u.getLastLoginAt(),
                eventCount, bookingCount, u.isSeed());
    }
}
