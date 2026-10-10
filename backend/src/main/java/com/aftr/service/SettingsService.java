package com.aftr.service;

import com.aftr.config.AppProperties;
import com.aftr.dto.AdminDtos;
import com.aftr.entity.PlatformSetting;
import com.aftr.exception.ApiException;
import com.aftr.repository.PlatformSettingRepository;
import com.aftr.security.AuthUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Typed access to the platform_settings key/value table, with validation of admin updates. */
@Service
public class SettingsService {

    public static final String PLATFORM_NAME = "platform.name";
    public static final String SUPPORT_EMAIL = "platform.supportEmail";
    public static final String ALLOW_ATTENDEE_SIGNUP = "registration.allowAttendeeSignup";
    public static final String ALLOW_ORGANIZER_SIGNUP = "registration.allowOrganizerSignup";
    public static final String REQUIRE_APPROVAL = "events.requireApproval";
    public static final String MIN_LEAD_HOURS = "events.minLeadHours";
    public static final String MAX_TICKET_TYPES = "events.maxTicketTypes";
    public static final String NOTIFY_ADMINS_ON_SUBMISSION = "notifications.notifyAdminsOnSubmission";
    public static final String NOTIFY_ORGANIZER_ON_REGISTRATION = "notifications.notifyOrganizerOnRegistration";

    private record Definition(String key, String type, String group, String label, String description,
                              String defaultValue, int min, int max) {
    }

    private static final List<Definition> DEFINITIONS = List.of(
            new Definition(PLATFORM_NAME, "string", "Platform", "Platform name", "Shown in notifications and the admin console.", "AFTR", 2, 40),
            new Definition(SUPPORT_EMAIL, "email", "Platform", "Support email", "Where attendees and organizers can reach the team.", "support@aftr.dev", 5, 254),
            new Definition(ALLOW_ATTENDEE_SIGNUP, "boolean", "Registration", "Allow attendee sign-ups", "New attendee accounts can be created from the sign-up page.", "true", 0, 0),
            new Definition(ALLOW_ORGANIZER_SIGNUP, "boolean", "Registration", "Allow organizer sign-ups", "New organizer accounts can be created from the sign-up page.", "true", 0, 0),
            new Definition(REQUIRE_APPROVAL, "boolean", "Event submissions", "Require admin approval", "Submitted events wait in the approval queue before going live. When off, submissions publish immediately.", "true", 0, 0),
            new Definition(MIN_LEAD_HOURS, "integer", "Event submissions", "Minimum lead time (hours)", "How far in the future an event must start when it is submitted.", "24", 0, 720),
            new Definition(MAX_TICKET_TYPES, "integer", "Event submissions", "Max ticket types per event", "Upper limit on ticket tiers per event.", "6", 1, 20),
            new Definition(NOTIFY_ADMINS_ON_SUBMISSION, "boolean", "Notifications", "Notify admins on submission", "Admins receive an in-app notification for each new submission.", "true", 0, 0),
            new Definition(NOTIFY_ORGANIZER_ON_REGISTRATION, "boolean", "Notifications", "Notify organizers on registration", "Organizers receive an in-app notification for every booking.", "true", 0, 0));

    private final PlatformSettingRepository repository;
    private final AppProperties props;
    private final AuditService audit;

    public SettingsService(PlatformSettingRepository repository, AppProperties props, AuditService audit) {
        this.repository = repository;
        this.props = props;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public String get(String key) {
        return repository.findById(key).map(PlatformSetting::getValue)
                .orElseGet(() -> definition(key).defaultValue());
    }

    public boolean getBoolean(String key) {
        return Boolean.parseBoolean(get(key));
    }

    public int getInt(String key) {
        try {
            return Integer.parseInt(get(key));
        } catch (NumberFormatException e) {
            return Integer.parseInt(definition(key).defaultValue());
        }
    }

    @Transactional(readOnly = true)
    public AdminDtos.SettingsResponse all() {
        Map<String, String> values = new HashMap<>();
        repository.findAll().forEach(s -> values.put(s.getKey(), s.getValue()));
        List<AdminDtos.SettingItem> items = DEFINITIONS.stream()
                .map(d -> new AdminDtos.SettingItem(d.key(), values.getOrDefault(d.key(), d.defaultValue()), d.type(),
                        d.group(), d.label(), d.description()))
                .toList();
        return new AdminDtos.SettingsResponse(items);
    }

    @Transactional(readOnly = true)
    public AdminDtos.PublicSettings publicSettings() {
        return new AdminDtos.PublicSettings(get(PLATFORM_NAME), get(SUPPORT_EMAIL), getBoolean(ALLOW_ATTENDEE_SIGNUP),
                getBoolean(ALLOW_ORGANIZER_SIGNUP), props.getPayments().isDevCheckoutEnabled());
    }

    @Transactional
    public AdminDtos.SettingsResponse update(Map<String, String> values, AuthUser admin) {
        List<String> changed = new ArrayList<>();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            Definition d = definition(entry.getKey());
            String value = normalize(d, entry.getValue());
            PlatformSetting setting = repository.findById(d.key()).orElseGet(() -> {
                PlatformSetting s = new PlatformSetting();
                s.setKey(d.key());
                return s;
            });
            if (!value.equals(setting.getValue())) {
                setting.setValue(value);
                setting.setUpdatedBy(admin.getId());
                repository.save(setting);
                changed.add(d.key() + "=" + value);
            }
        }
        if (!changed.isEmpty()) {
            audit.record(admin, "SETTINGS_UPDATED", "SETTINGS", null, "Updated " + String.join(", ", changed));
        }
        return all();
    }

    private Definition definition(String key) {
        return DEFINITIONS.stream().filter(d -> d.key().equals(key)).findFirst()
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_SETTING", "Unknown setting: " + key));
    }

    private String normalize(Definition d, String raw) {
        String v = raw == null ? "" : raw.trim();
        switch (d.type()) {
            case "boolean" -> {
                if (!v.equalsIgnoreCase("true") && !v.equalsIgnoreCase("false")) {
                    throw ApiException.badRequest("INVALID_SETTING", d.label() + " must be true or false.");
                }
                return v.toLowerCase(Locale.ROOT);
            }
            case "integer" -> {
                try {
                    int n = Integer.parseInt(v);
                    if (n < d.min() || n > d.max()) {
                        throw ApiException.badRequest("INVALID_SETTING", d.label() + " must be between " + d.min() + " and " + d.max() + ".");
                    }
                    return String.valueOf(n);
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("INVALID_SETTING", d.label() + " must be a whole number.");
                }
            }
            case "email" -> {
                if (!v.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
                    throw ApiException.badRequest("INVALID_SETTING", d.label() + " must be a valid email.");
                }
                return v;
            }
            default -> {
                if (v.length() < d.min() || v.length() > d.max()) {
                    throw ApiException.badRequest("INVALID_SETTING", d.label() + " must be " + d.min() + "–" + d.max() + " characters.");
                }
                return v;
            }
        }
    }
}
