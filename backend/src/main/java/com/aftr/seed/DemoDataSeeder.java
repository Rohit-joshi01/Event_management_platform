package com.aftr.seed;

import com.aftr.config.AppProperties;
import com.aftr.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Seeds a realistic demonstration dataset on first start (empty users table) when
 * {@code app.seed.enabled=true}. Every seeded row is flagged {@code is_seed=true}; seeded paid
 * bookings are recorded as SIMULATED_PAID and are never presented as real payments.
 */
@Component
@Order(10)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final AppProperties props;
    private final UserRepository users;
    private final DemoDataWriter writer;

    public DemoDataSeeder(AppProperties props, UserRepository users, DemoDataWriter writer) {
        this.props = props;
        this.users = users;
        this.writer = writer;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.getSeed().isEnabled()) {
            return;
        }
        if (users.count() > 0) {
            log.info("Demo data: database already has users — skipping seed.");
            return;
        }
        long started = System.currentTimeMillis();
        writer.write();
        log.info("Demo data seeded in {} ms. Sign in with admin@aftr.dev / Admin@2026, "
                + "organizer@aftr.dev / Organizer@2026 or attendee@aftr.dev / Attendee@2026.",
                System.currentTimeMillis() - started);
    }
}
