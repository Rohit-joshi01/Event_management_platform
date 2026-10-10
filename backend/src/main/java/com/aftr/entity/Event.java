package com.aftr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizer_id", nullable = false)
    private User organizer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @Column(nullable = false, length = 140)
    private String title;

    @Column(nullable = false, unique = true, length = 180)
    private String slug;

    @Column(nullable = false, length = 280)
    private String summary;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(nullable = false, length = 60)
    private String timezone = "Asia/Kolkata";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventFormat format = EventFormat.IN_PERSON;

    @Column(name = "online_url", length = 500)
    private String onlineUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventStatus status = EventStatus.DRAFT;

    @Column(nullable = false)
    private boolean featured;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Column(name = "cancel_reason", length = 1000)
    private String cancelReason;

    @Column(name = "min_price_cents", nullable = false)
    private long minPriceCents;

    @Column(name = "total_capacity", nullable = false)
    private int totalCapacity;

    /** Maintained only through atomic UPDATE statements in {@code EventRepository}. */
    @Column(name = "total_sold", nullable = false, insertable = false, updatable = false)
    private int totalSold;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "is_seed", nullable = false)
    private boolean seed;

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, startsAt ASC")
    private List<ScheduleItem> schedule = new ArrayList<>();

    @OneToMany(mappedBy = "event")
    @OrderBy("sortOrder ASC, id ASC")
    private List<TicketType> ticketTypes = new ArrayList<>();

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

    public boolean isOwnedBy(Long userId) {
        return organizer != null && organizer.getId().equals(userId);
    }

    public boolean hasEnded(Instant now) {
        return endsAt.isBefore(now);
    }
}
