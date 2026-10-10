package com.aftr.service;

import com.aftr.dto.AuthDtos;
import com.aftr.dto.PageResponse;
import com.aftr.dto.UserDtos;
import com.aftr.entity.Role;
import com.aftr.entity.User;
import com.aftr.entity.UserStatus;
import com.aftr.exception.ApiException;
import com.aftr.mapper.UserMapper;
import com.aftr.repository.BookingOrderRepository;
import com.aftr.repository.EventRepository;
import com.aftr.repository.UserRepository;
import com.aftr.security.AuthUser;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class UserService {

    private static final Set<String> SORTABLE = Set.of("createdAt", "fullName", "email", "lastLoginAt");

    private final UserRepository users;
    private final EventRepository events;
    private final BookingOrderRepository orders;
    private final PasswordEncoder passwordEncoder;
    private final SettingsService settings;
    private final AuditService audit;
    private final NotificationService notifications;
    private final Clock clock;

    public UserService(UserRepository users, EventRepository events, BookingOrderRepository orders,
                       PasswordEncoder passwordEncoder, SettingsService settings, AuditService audit,
                       NotificationService notifications, Clock clock) {
        this.users = users;
        this.events = events;
        this.orders = orders;
        this.passwordEncoder = passwordEncoder;
        this.settings = settings;
        this.audit = audit;
        this.notifications = notifications;
        this.clock = clock;
    }

    // ---------------------------------------------------------------- registration & session

    @Transactional
    public UserDtos.UserResponse register(AuthDtos.RegisterRequest req) {
        if (req.role() == Role.ADMIN) {
            throw ApiException.forbidden("Administrator accounts can't be created through sign-up.");
        }
        if (req.role() == Role.ORGANIZER && !settings.getBoolean(SettingsService.ALLOW_ORGANIZER_SIGNUP)) {
            throw ApiException.forbidden("Organizer sign-ups are currently closed.");
        }
        if (req.role() == Role.ATTENDEE && !settings.getBoolean(SettingsService.ALLOW_ATTENDEE_SIGNUP)) {
            throw ApiException.forbidden("Sign-ups are currently closed.");
        }
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists.");
        }
        User user = new User();
        user.setEmail(email);
        user.setFullName(req.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(req.role());
        user.setStatus(UserStatus.ACTIVE);
        if (req.role() == Role.ORGANIZER && req.organizationName() != null && !req.organizationName().isBlank()) {
            user.setOrganizationName(req.organizationName().trim());
        }
        users.saveAndFlush(user);
        audit.record(user.getId(), user.getEmail(), "USER_REGISTERED", "USER", user.getId(),
                "New " + user.getRole().name().toLowerCase(Locale.ROOT) + " account: " + user.getFullName());
        notifications.notify(user, "WELCOME", "Welcome to " + settings.get(SettingsService.PLATFORM_NAME),
                user.getRole() == Role.ORGANIZER
                        ? "Your organizer workspace is ready. Create your first event and submit it for review."
                        : "Find something worth showing up for. Your tickets and updates will live here.",
                user.getRole() == Role.ORGANIZER ? "/organizer/events/new" : "/events");
        return UserMapper.toResponse(user);
    }

    @Transactional
    public UserDtos.UserResponse recordLogin(Long userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        user.setLastLoginAt(Instant.now(clock));
        audit.record(user.getId(), user.getEmail(), "USER_LOGIN", "USER", user.getId(), "Signed in");
        return UserMapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserDtos.UserResponse me(Long userId) {
        return UserMapper.toResponse(load(userId));
    }

    // ---------------------------------------------------------------- self-service profile

    @Transactional
    public UserDtos.UserResponse updateProfile(Long userId, UserDtos.UpdateProfileRequest req) {
        User user = load(userId);
        user.setFullName(req.fullName().trim());
        user.setBio(blankToNull(req.bio()));
        user.setAvatarUrl(blankToNull(req.avatarUrl()));
        user.setCity(blankToNull(req.city()));
        if (user.getRole() == Role.ORGANIZER) {
            user.setOrganizationName(blankToNull(req.organizationName()));
        }
        user.setNotifyAnnouncements(req.notifyAnnouncements());
        user.setNotifyReminders(req.notifyReminders());
        user.setNotifyRecommendations(req.notifyRecommendations());
        return UserMapper.toResponse(user);
    }

    @Transactional
    public void changePassword(Long userId, UserDtos.ChangePasswordRequest req) {
        User user = load(userId);
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("WRONG_PASSWORD", "Your current password is incorrect.");
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("SAME_PASSWORD", "Choose a password you haven't used here.");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        audit.record(user.getId(), user.getEmail(), "PASSWORD_CHANGED", "USER", user.getId(), "Password changed");
        notifications.notify(user, "SECURITY", "Your password was changed",
                "If this wasn't you, contact support immediately.", "/me/profile");
    }

    /**
     * Changes the sign-in email after re-authenticating with the current password. No email
     * provider is configured, so the address is not verified by link; the change is audited and
     * the user is notified in-app.
     */
    @Transactional
    public UserDtos.UserResponse changeEmail(Long userId, UserDtos.ChangeEmailRequest req) {
        User user = load(userId);
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("WRONG_PASSWORD", "Your current password is incorrect.");
        }
        String email = normalizeEmail(req.newEmail());
        if (email.equalsIgnoreCase(user.getEmail())) {
            return UserMapper.toResponse(user);
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists.");
        }
        String old = user.getEmail();
        user.setEmail(email);
        audit.record(user.getId(), email, "EMAIL_CHANGED", "USER", user.getId(), "Email changed from " + old + " to " + email);
        notifications.notify(user, "SECURITY", "Your sign-in email changed",
                "You now sign in with " + email + ".", "/me/profile");
        return UserMapper.toResponse(user);
    }

    // ---------------------------------------------------------------- administration

    @Transactional(readOnly = true)
    public PageResponse<UserDtos.AdminUserResponse> search(String q, Role role, UserStatus status, int page, int size,
                                                           String sort, String direction) {
        String sortField = SORTABLE.contains(sort) ? sort : "createdAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(dir, sortField));
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                p.add(cb.or(cb.like(cb.lower(root.<String>get("fullName")), like), cb.like(cb.lower(root.<String>get("email")), like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("organizationName"), "")), like)));
            }
            if (role != null) p.add(cb.equal(root.get("role"), role));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            return cb.and(p.toArray(Predicate[]::new));
        };
        Page<User> result = users.findAll(spec, pr);
        return PageResponse.of(result, this::toAdmin);
    }

    @Transactional(readOnly = true)
    public UserDtos.AdminUserResponse getForAdmin(Long id) {
        return toAdmin(load(id));
    }

    @Transactional
    public UserDtos.AdminUserResponse adminUpdate(Long id, UserDtos.AdminUpdateUserRequest req, AuthUser admin) {
        User user = load(id);
        if (user.getId().equals(admin.getId()) && req.role() != Role.ADMIN) {
            throw ApiException.conflict("SELF_DEMOTION", "You can't remove your own administrator role.");
        }
        Role previous = user.getRole();
        if (previous == Role.ORGANIZER && req.role() != Role.ORGANIZER && events.countByOrganizerId(user.getId()) > 0) {
            throw ApiException.conflict("HAS_EVENTS", "This organizer owns events. Reassign or remove them before changing the role.");
        }
        user.setFullName(req.fullName().trim());
        user.setOrganizationName(blankToNull(req.organizationName()));
        user.setRole(req.role());
        if (previous != req.role()) {
            audit.record(admin, "USER_ROLE_CHANGED", "USER", user.getId(),
                    user.getEmail() + ": " + previous + " → " + req.role());
            notifications.notify(user, "ACCOUNT", "Your account role changed",
                    "An administrator changed your role to " + req.role().name().toLowerCase(Locale.ROOT) + ".", "/me/profile");
        } else {
            audit.record(admin, "USER_UPDATED", "USER", user.getId(), "Updated profile of " + user.getEmail());
        }
        return toAdmin(user);
    }

    @Transactional
    public UserDtos.AdminUserResponse setStatus(Long id, UserStatus status, AuthUser admin) {
        User user = load(id);
        if (user.getId().equals(admin.getId())) {
            throw ApiException.conflict("SELF_SUSPEND", "You can't change the status of your own account.");
        }
        if (user.getStatus() == status) {
            return toAdmin(user);
        }
        user.setStatus(status);
        audit.record(admin, status == UserStatus.SUSPENDED ? "USER_SUSPENDED" : "USER_REACTIVATED", "USER", user.getId(),
                (status == UserStatus.SUSPENDED ? "Suspended " : "Reactivated ") + user.getEmail());
        return toAdmin(user);
    }

    @Transactional
    public void delete(Long id, AuthUser admin) {
        User user = load(id);
        if (user.getId().equals(admin.getId())) {
            throw ApiException.conflict("SELF_DELETE", "You can't delete your own account.");
        }
        if (events.countByOrganizerId(id) > 0 || orders.countByUserId(id) > 0) {
            throw ApiException.conflict("HAS_HISTORY",
                    "This account has events or bookings on record. Suspend it instead to preserve history.");
        }
        String email = user.getEmail();
        users.delete(user);
        audit.record(admin, "USER_DELETED", "USER", id, "Deleted account " + email);
    }

    // ---------------------------------------------------------------- helpers

    private UserDtos.AdminUserResponse toAdmin(User u) {
        return UserMapper.toAdminResponse(u, events.countByOrganizerId(u.getId()), orders.countByUserId(u.getId()));
    }

    private User load(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
