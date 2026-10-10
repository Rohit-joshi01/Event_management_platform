package com.aftr.repository;

import com.aftr.entity.TicketType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TicketTypeRepository extends JpaRepository<TicketType, Long> {

    List<TicketType> findByEventIdOrderBySortOrderAscIdAsc(Long eventId);

    long countByEventId(Long eventId);

    /**
     * Reserves inventory with a single conditional UPDATE. PostgreSQL takes a row lock and
     * re-evaluates the predicate after any concurrent writer commits, so two buyers can never
     * both take the last seat. Returns 1 on success, 0 when not enough tickets remain.
     */
    @Modifying
    @Query(value = "UPDATE ticket_types SET sold = sold + :qty WHERE id = :id AND event_id = :eventId AND sold + :qty <= quantity",
            nativeQuery = true)
    int reserve(@Param("id") Long id, @Param("eventId") Long eventId, @Param("qty") int qty);

    @Modifying
    @Query(value = "UPDATE ticket_types SET sold = sold - :qty WHERE id = :id AND sold >= :qty", nativeQuery = true)
    int release(@Param("id") Long id, @Param("qty") int qty);

    @Query(value = "SELECT sold FROM ticket_types WHERE id = :id", nativeQuery = true)
    int currentSold(@Param("id") Long id);
}
