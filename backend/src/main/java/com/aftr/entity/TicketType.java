package com.aftr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "ticket_types")
@Getter
@Setter
@NoArgsConstructor
public class TicketType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 300)
    private String description;

    @Column(name = "price_cents", nullable = false)
    private long priceCents;

    @Column(nullable = false, length = 3)
    private String currency = "INR";

    @Column(nullable = false)
    private int quantity;

    /**
     * Never written through the entity: inventory changes go through atomic
     * conditional UPDATE statements in {@code TicketTypeRepository} so that concurrent
     * purchases cannot oversell and organizer edits cannot overwrite sales.
     */
    @Column(nullable = false, insertable = false, updatable = false)
    private int sold;

    @Column(name = "sales_start")
    private Instant salesStart;

    @Column(name = "sales_end")
    private Instant salesEnd;

    @Column(name = "max_per_order", nullable = false)
    private int maxPerOrder = 4;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public int remaining() {
        return Math.max(0, quantity - sold);
    }

    public boolean isOnSale(Instant now) {
        return (salesStart == null || !now.isBefore(salesStart)) && (salesEnd == null || now.isBefore(salesEnd));
    }
}
