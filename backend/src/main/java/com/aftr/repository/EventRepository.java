package com.aftr.repository;

import com.aftr.entity.Event;
import com.aftr.entity.EventStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long>, JpaSpecificationExecutor<Event> {

    Optional<Event> findBySlug(String slug);

    boolean existsBySlug(String slug);

    long countByStatus(EventStatus status);

    long countByOrganizerId(Long organizerId);

    long countByOrganizerIdAndStatus(Long organizerId, EventStatus status);

    @Query("select count(e) from Event e where e.organizer.id = :organizerId and e.status = com.aftr.entity.EventStatus.PUBLISHED and e.endsAt < :now")
    long countCompletedForOrganizer(@Param("organizerId") Long organizerId, @Param("now") Instant now);

    @Query("select count(e) from Event e where e.status = com.aftr.entity.EventStatus.PUBLISHED and e.endsAt < :now")
    long countCompleted(@Param("now") Instant now);

    List<Event> findByOrganizerId(Long organizerId);

    @Query("""
            select e from Event e
            where e.status = com.aftr.entity.EventStatus.PUBLISHED and e.endsAt > :now
            order by e.startsAt asc
            """)
    List<Event> findUpcomingPublished(@Param("now") Instant now, Pageable pageable);

    @Query("""
            select e from Event e
            where e.organizer.id = :organizerId and e.status in :statuses and e.endsAt > :now
            order by e.startsAt asc
            """)
    List<Event> findUpcomingForOrganizer(@Param("organizerId") Long organizerId,
                                         @Param("statuses") List<EventStatus> statuses,
                                         @Param("now") Instant now, Pageable pageable);

    @Query("""
            select distinct v.city from Event e join e.venue v
            where e.status = com.aftr.entity.EventStatus.PUBLISHED and e.endsAt > :now
            order by v.city
            """)
    List<String> findActiveCities(@Param("now") Instant now);

    @Query("""
            select e.category.id, count(e) from Event e
            where e.status = com.aftr.entity.EventStatus.PUBLISHED and e.endsAt > :now
            group by e.category.id
            """)
    List<Object[]> countUpcomingByCategory(@Param("now") Instant now);

    @Query("select e.status, count(e) from Event e group by e.status")
    List<Object[]> countGroupedByStatus();

    /** Atomically adjusts the denormalised sold counter used for listing and sorting. */
    @Modifying
    @Query(value = "UPDATE events SET total_sold = total_sold + :delta WHERE id = :eventId AND total_sold + :delta >= 0",
            nativeQuery = true)
    int adjustSold(@Param("eventId") Long eventId, @Param("delta") int delta);

    @Query(value = "SELECT total_sold FROM events WHERE id = :eventId", nativeQuery = true)
    int currentSold(@Param("eventId") Long eventId);

    @Query(value = """
            SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS wk, count(*)
            FROM events WHERE created_at >= :since GROUP BY wk ORDER BY wk
            """, nativeQuery = true)
    List<Object[]> createdPerWeek(@Param("since") Instant since);
}
