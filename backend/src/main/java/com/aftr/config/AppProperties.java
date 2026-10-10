package com.aftr.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Cors cors = new Cors();
    private final Payments payments = new Payments();
    private final Seed seed = new Seed();
    private final Uploads uploads = new Uploads();
    private final RateLimit rateLimit = new RateLimit();

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173"));
    }

    @Getter
    @Setter
    public static class Payments {
        /**
         * When true, paid tickets can be booked through a clearly-labelled development
         * checkout that records SIMULATED_PAID. No real money moves. When false and no
         * real provider is configured, paid checkout is refused with 503.
         */
        private boolean devCheckoutEnabled = true;
    }

    @Getter
    @Setter
    public static class Seed {
        private boolean enabled = true;
    }

    @Getter
    @Setter
    public static class Uploads {
        private String dir = "./uploads";
        private long maxBytes = 5 * 1024 * 1024;
    }

    @Getter
    @Setter
    public static class RateLimit {
        private int maxAttempts = 10;
        private long windowSeconds = 60;
    }
}
