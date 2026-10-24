# Build status and verification record

_Last updated: 21 Oct 2026_

## What was verified, and how

| Area | Status |
|------|--------|
| Frontend type-check (`tsc -b`) | ✅ Passes |
| Frontend production build (`vite build`) | ✅ Passes. The bundle contains no demo credentials. |
| Frontend rendering | ✅ Every main page was rendered in headless Chromium and checked from screenshots at desktop (1440px) and mobile (390px) widths (10 Oct, against a REST mock). On 21 Oct the dev server was also run against the real backend, with `/api` proxying confirmed. |
| Java backend compilation | ✅ Compiles on JDK 17 with the Maven Wrapper. |
| Backend unit tests | ✅ 12/12 pass (`mvnw.cmd test`). |
| Backend integration tests | ✅ 28/28 pass (`mvnw.cmd verify`) against PostgreSQL 16 in Docker. |
| Running app | ✅ Started with the `dev` profile: Flyway migrated, the demo data seeded in about 25 s, and all three demo roles signed in. Each role reaches its own endpoints and gets 403 on the others. |

## Fixed on first real run (21 Oct)

- **Startup failure on Windows:** Java reported the legacy time zone `Asia/Calcutta`, which PostgreSQL 16 rejects, so every database connection failed. The JVM is now pinned to UTC in `AftrApplication.main` and in the failsafe test JVM.
- **Slow seeding:** each seeded booking's native inventory `UPDATE` auto-flushed the entire persistence context. Seeding went from 64 s to about 25 s.

## Security hardening (21 Oct)

- Demo seeding is **off by default**. Enable it with the `dev` profile or `SEED_DEMO_DATA=true`. Before this change, deploying with default settings would have created an admin account with the public password `Admin@2026`.
- The seeder no longer writes passwords to the log.
- The sign-in demo helper is only in dev builds. The `VITE_SHOW_DEMO_ACCOUNTS` override that could ship it to production was removed.
- `docker-compose.yml` publishes PostgreSQL on `127.0.0.1` only, not on every network interface.

## First thing to do on your machine

```bash
docker compose up -d                                 # or: psql -U postgres -f backend/db/setup-postgres.sql
cd backend && mvnw.cmd verify                        # compiles, then runs unit + integration tests
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
cd ../frontend && npm ci && npm run dev
```

## Java version

The backend targets **Java 17** (it runs on 17 or newer). Maven isn't needed: the bundled Maven Wrapper (`mvnw.cmd`) downloads Maven automatically.
