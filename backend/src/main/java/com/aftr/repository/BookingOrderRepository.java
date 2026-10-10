package com.aftr.repository;

import com.aftr.entity.BookingOrder;
import com.aftr.entity.OrderStatus;
import com.aftr.entity.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BookingOrderRepository extends JpaRepository<BookingOrder, Long> {

    Optional<BookingOrder> findByReference(String reference);

    boolean existsByReference(String reference);

    Optional<BookingOrder> findFirstByUserIdAndEventIdAndStatus(Long userId, Long eventId, OrderStatus status);

    long countByUserId(Long userId);

    long countByEventId(Long eventId);

    @EntityGraph(attributePaths = {"event", "event.venue", "event.category"})
    @Query("""
            select o from BookingOrder o where o.user.id = :userId
            and o.status = com.aftr.entity.OrderStatus.CONFIRMED and o.event.endsAt >= :now
            order by o.event.startsAt asc
            """)
    Page<BookingOrder> findUpcomingForUser(@Param("userId") Long userId, @Param("now") Instant now, Pageable pageable);

    @EntityGraph(attributePaths = {"event", "event.venue", "event.category"})
    @Query("""
            select o from BookingOrder o where o.user.id = :userId
            and o.status = com.aftr.entity.OrderStatus.CONFIRMED and o.event.endsAt < :now
            order by o.event.startsAt desc
            """)
    Page<BookingOrder> findPastForUser(@Param("userId") Long userId, @Param("now") Instant now, Pageable pageable);

    @EntityGraph(attributePaths = {"event", "event.venue", "event.category"})
    @Query("""
            select o from BookingOrder o where o.user.id = :userId
            and o.status = com.aftr.entity.OrderStatus.CANCELLED
            order by o.cancelledAt desc
            """)
    Page<BookingOrder> findCancelledForUser(@Param("userId") Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"event", "event.venue", "event.category"})
    @Query("select o from BookingOrder o where o.user.id = :userId order by o.createdAt desc")
    Page<BookingOrder> findAllForUser(@Param("userId") Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"user"})
    @Query("""
            select o from BookingOrder o where o.event.id = :eventId
            and (:status is null or o.status = :status)
            and (:q = '' or lower(o.user.fullName) like :q or lower(o.user.email) like :q or lower(o.reference) like :q)
            order by o.createdAt desc
            """)
    Page<BookingOrder> findForEvent(@Param("eventId") Long eventId, @Param("status") OrderStatus status,
                                    @Param("q") String q, Pageable pageable);

    List<BookingOrder> findByEventIdAndStatus(Long eventId, OrderStatus status);

    @Query("select distinct o.user.id from BookingOrder o where o.event.id = :eventId and o.status = com.aftr.entity.OrderStatus.CONFIRMED")
    List<Long> findConfirmedAttendeeIds(@Param("eventId") Long eventId);

    @Query("select o.event.category.id from BookingOrder o where o.user.id = :userId")
    List<Long> findCategoryIdsForUser(@Param("userId") Long userId);

    @Query("select o.event.id from BookingOrder o where o.user.id = :userId and o.status = com.aftr.entity.OrderStatus.CONFIRMED")
    List<Long> findActiveEventIdsForUser(@Param("userId") Long userId);

    @Query("select coalesce(sum(o.totalCents), 0) from BookingOrder o where o.status = com.aftr.entity.OrderStatus.CONFIRMED and o.paymentStatus = :ps")
    long sumConfirmedByPaymentStatus(@Param("ps") PaymentStatus ps);

    @Query("""
            select coalesce(sum(o.totalCents), 0) from BookingOrder o
            where o.status = com.aftr.entity.OrderStatus.CONFIRMED and o.paymentStatus = :ps and o.event.organizer.id = :organizerId
            """)
    long sumConfirmedByPaymentStatusForOrganizer(@Param("ps") PaymentStatus ps, @Param("organizerId") Long organizerId);

    @Query("select count(o) from BookingOrder o where o.status = com.aftr.entity.OrderStatus.CONFIRMED")
    long countConfirmed();

    @Query("select count(o) from BookingOrder o where o.status = com.aftr.entity.OrderStatus.CONFIRMED and o.event.organizer.id = :organizerId")
    long countConfirmedForOrganizer(@Param("organizerId") Long organizerId);

    @EntityGraph(attributePaths = {"user", "event"})
    @Query("select o from BookingOrder o where o.event.organizer.id = :organizerId order by o.createdAt desc")
    List<BookingOrder> findRecentForOrganizer(@Param("organizerId") Long organizerId, Pageable pageable);
}
