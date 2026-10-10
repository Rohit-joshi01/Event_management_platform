package com.aftr.security;

import com.aftr.entity.Role;
import com.aftr.entity.User;
import com.aftr.entity.UserStatus;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;

/**
 * Authenticated principal stored in the server-side session. The role is always
 * loaded from the database (never accepted from the client) and is re-checked on
 * every request by {@link ActiveUserFilter}.
 */
public class AuthUser implements UserDetails, CredentialsContainer, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long id;
    private final String email;
    private final String fullName;
    private final Role role;
    private final boolean active;
    private String passwordHash;

    public AuthUser(Long id, String email, String fullName, Role role, boolean active, String passwordHash) {
        this.id = id;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.active = active;
        this.passwordHash = passwordHash;
    }

    public static AuthUser from(User user) {
        return new AuthUser(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                user.getStatus() == UserStatus.ACTIVE, user.getPasswordHash());
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public Role getRole() {
        return role;
    }

    public boolean hasRole(Role r) {
        return role == r;
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }

    @Override
    public boolean isAccountNonLocked() {
        return active;
    }

    @Override
    public void eraseCredentials() {
        this.passwordHash = null;
    }
}
