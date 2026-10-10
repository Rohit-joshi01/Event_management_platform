# Build status and verification record

_Last updated: 10 Oct 2026_

## What was verified, and how

| Area | Status |
|------|--------|
| Frontend type-check (`tsc -b`) | ✅ Passes |
| Frontend production build (`vite build`) | ✅ Passes |
| Frontend rendering | ✅ Every main page was rendered in headless Chromium and checked from screenshots at desktop (1440px) and mobile (390px) widths. This includes the real WebGL hero, the scroll choreography, discovery, event detail with checkout, sign-in, and all three dashboards. These runs used a temporary mock of the REST contract (not shipped). |
| Flyway migration SQL | ✅ Applied cleanly to a real PostgreSQL 16 database. The native analytics and inventory SQL also ran against it. |
| Java backend compilation | ⚠️ **Not run.** This build environment's network policy blocks Maven Central, so the Spring Boot dependencies couldn't be downloaded. The code was reviewed line by line against the Spring Boot 3.5 / Spring Security 6.5 / Hibernate 6.6 APIs, and the problems found were fixed. |
| Backend unit and integration tests | ⚠️ **Written but not run**, for the same reason. |

## First thing to do on your machine

```bash
psql -U postgres -f backend/db/setup-postgres.sql   # or: docker compose up -d
cd backend && mvn verify                            # compiles, then runs unit + integration tests
mvn spring-boot:run                                 # starts the API and seeds demo data
cd ../frontend && npm install && npm run dev
```

If `mvn verify` reports a compile or test error, copy the first error block into the chat and it can be fixed quickly.

## Known risks to watch on the first run

- `TicketRepository.dailyCounts` is a native query that uses `0` as a "no filter" sentinel. It feeds `/admin/analytics` and `/organizer/analytics`.
- Spring Session JDBC tables are created by Flyway (`V1`). `spring.session.jdbc.initialize-schema` is `never`.
