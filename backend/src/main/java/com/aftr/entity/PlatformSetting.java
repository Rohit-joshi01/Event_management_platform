package com.aftr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "platform_settings")
@Getter
@Setter
@NoArgsConstructor
public class PlatformSetting {

    @Id
    @Column(name = "setting_key", length = 80)
    private String key;

    @Column(nullable = false, length = 500)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
