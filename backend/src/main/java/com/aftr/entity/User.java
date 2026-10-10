package com.aftr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(length = 600)
    private String bio;

    @Column(name = "organization_name", length = 160)
    private String organizationName;

    @Column(length = 100)
    private String city;

    @Column(name = "notify_announcements", nullable = false)
    private boolean notifyAnnouncements = true;

    @Column(name = "notify_reminders", nullable = false)
    private boolean notifyReminders = true;

    @Column(name = "notify_recommendations", nullable = false)
    private boolean notifyRecommendations = true;

    @Column(name = "is_seed", nullable = false)
    private boolean seed;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
    }
}
