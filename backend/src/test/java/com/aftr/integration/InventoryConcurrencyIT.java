package com.aftr.integration;

import com.aftr.dto.BookingDtos;
import com.aftr.entity.Role;
import com.aftr.entity.User;
import com.aftr.exception.ApiException;
import com.aftr.security.AuthUser;
import com.aftr.service.RegistrationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** Many attendees race for the last seats: exactly the available quantity must be sold, never more. */
class InventoryConcurrencyIT extends IntegrationTestBase {

    @Autowired
    RegistrationService registrationService;

    @Test
    void concurrentPurchasesNeverOversell() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        long[] ids = publishedEvent(organizer, admin, 5, 0);

        int buyers = 24;
        List<AuthUser> principals = new ArrayList<>();
        for (int i = 0; i < buyers; i++) {
            principals.add(AuthUser.from(createUser("buyer" + i + "@example.com", Role.ATTENDEE)));
        }

        ExecutorService pool = Executors.newFixedThreadPool(12);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger soldOut = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (AuthUser p : principals) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    registrationService.purchase(new BookingDtos.PurchaseRequest(ids[0],
                            List.of(new BookingDtos.PurchaseItem(ids[1], 1))), p);
                    success.incrementAndGet();
                } catch (ApiException e) {
                    if ("SOLD_OUT".equals(e.getCode())) soldOut.incrementAndGet();
                    else throw e;
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get(60, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(success.get()).isEqualTo(5);
        assertThat(soldOut.get()).isEqualTo(buyers - 5);
        assertThat(ticketTypes.currentSold(ids[1])).isEqualTo(5);
        assertThat(events.currentSold(ids[0])).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tickets WHERE ticket_type_id = ?", Long.class, ids[1])).isEqualTo(5);
    }

    @Test
    void sameAttendeeDoubleSubmitCreatesOneBooking() throws Exception {
        User organizer = createUser("org@example.com", Role.ORGANIZER);
        User admin = createUser("admin@example.com", Role.ADMIN);
        long[] ids = publishedEvent(organizer, admin, 50, 0);
        AuthUser buyer = AuthUser.from(createUser("eager@example.com", Role.ATTENDEE));

        ExecutorService pool = Executors.newFixedThreadPool(6);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger success = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    registrationService.purchase(new BookingDtos.PurchaseRequest(ids[0],
                            List.of(new BookingDtos.PurchaseItem(ids[1], 2))), buyer);
                    success.incrementAndGet();
                } catch (ApiException | DataIntegrityViolationException ignored) {
                    // duplicate refused
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get(60, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(success.get()).isEqualTo(1);
        assertThat(ticketTypes.currentSold(ids[1])).isEqualTo(2);
    }
}
