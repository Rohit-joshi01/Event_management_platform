package com.aftr.repository;

import com.aftr.entity.Ticket;
import com.aftr.entity.TicketStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    Optional<Ticket> findByCode(String code);

    boolean existsByCode(String code);

    long countByStatus(TicketStatus status);

    @Query("select count(t) from Ticket t where t.status <> com.aftr.entity.TicketStatus.CANCELLED")
    long countActive();

    @Query("select count(t) from Ticket t where t.status <> com.aftr.entity.TicketStatus.CANCELLED and t.event.organizer.id = :organizerId")
    long countActiveForOrganizer(@Param("organizerId") Long organizerId);

    @Query("select count(t) from Ticket t where t.status = com.aftr.entity.TicketStatus.CHECKED_IN and t.event.organizer.id = :organizerId")
    long countCheckedInForOrganizer(@Param("organizerId") Long organizerId);

    @Query("select count(t) from Ticket t where t.status <> com.aftr.entity.TicketStatus.CANCELLED and t.event.id = :eventId")
    long countActiveForEvent(@Param("eventId") Long eventId);

    @Query("select count(t) from Ticket t where t.status = com.aftr.entity.TicketStatus.CHECKED_IN and t.event.id = :eventId")
    long countCheckedInForEvent(@Param("eventId") Long eventId);

    /** Daily ticket counts (IST calendar days). Pass 0 for organizerId / eventId to leave that filter off. */
    @Query(value = """
            SELECT to_char(t.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS d,
                   count(*) AS c,
                   coalesce(sum(t.price_cents), 0) AS revenue
            FROM tickets t JOIN events e ON e.id = t.event_id
            WHERE t.created_at >= :since AND t.status <> 'CANCELLED'
              AND (:organizerId = 0 OR e.organizer_id = :organizerId)
              AND (:eventId = 0 OR e.id = :eventId)
            GROUP BY d ORDER BY d
            """, nativeQuery = true)
    List<Object[]> dailyCounts(@Param("since") Instant since, @Param("organizerId") Long organizerId,
                               @Param("eventId") Long eventId);

    List<Ticket> findByOrderId(Long orderId);

    @EntityGraph(attributePaths = {"ticketType"})
    List<Ticket> findByOrderIdInOrderByIdAsc(List<Long> orderIds);

    @Query("""
            select count(t) from Ticket t where t.event.id = :eventId and t.status <> com.aftr.entity.TicketStatus.CANCELLED
            and t.createdAt >= :since
            """)
    long countSince(@Param("eventId") Long eventId, @Param("since") Instant since);

    @Query("select t from Ticket t where t.event.id = :eventId and t.status <> com.aftr.entity.TicketStatus.CANCELLED")
    List<Ticket> findActiveForEvent(@Param("eventId") Long eventId);

    @Query("select max(t.createdAt) from Ticket t where t.event.id = :eventId")
    Optional<Instant> lastSaleAt(@Param("eventId") Long eventId);
}
