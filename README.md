# AFTR — Online Event Management Platform

AFTR is a full-stack event platform with three roles:

- **Attendees** discover events, book tickets and keep QR tickets in one place.
- **Organizers** draft, ticket, submit and run their events.
- **Administrators** approve events, manage users and settings, and read the audit trail.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, React Three Fiber / Three.js (3D hero), GSAP ScrollTrigger, Framer Motion, Recharts, Lucide, TanStack Query |
| Backend  | **Java 21, Spring Boot 3.5** (Web, Security, Data JPA / Hibernate, Validation), Spring Session JDBC, Flyway, springdoc-openapi, Maven |
| Database | PostgreSQL 14+ |

```
aftr/
├── backend/            Spring Boot REST API (/api/v1)
│   ├── src/main/java/com/aftr/
│   │   ├── controller/  REST endpoints
│   │   ├── service/     business rules + @Transactional boundaries
│   │   ├── repository/  Spring Data JPA (incl. atomic inventory UPDATEs)
│   │   ├── entity/      JPA entities + enums
│   │   ├── dto/         request/response records (entities are never exposed)
│   │   ├── mapper/      entity → DTO
│   │   ├── security/    session auth, RBAC, CSRF, rate limiting
│   │   ├── exception/   uniform JSON errors
│   │   ├── validation/  custom Bean Validation constraints
│   │   ├── config/      app properties, OpenAPI, uploads
│   │   └── seed/        demo data (dates relative to "now")
│   ├── src/main/resources/db/migration/   Flyway SQL
│   └── src/test/java/com/aftr/            unit (*Test) + integration (*IT) tests
├── frontend/           React SPA
├── docker-compose.yml  optional PostgreSQL
└── .env.example        configuration template (no secrets)
```

---

## 1. Prerequisites

- **Java 21** (Temurin or Oracle JDK). Check with `java -version`.
- **Maven 3.9+**. Check with `mvn -v`. IntelliJ IDEA's bundled Maven also works.
- **PostgreSQL 14+**, installed natively or run with `docker compose up -d`.
- **Node.js 20+** and npm. Check with `node -v`.

## 2. Database

**Option A: native PostgreSQL (Windows, macOS, Linux)**

```bash
psql -U postgres -f backend/db/setup-postgres.sql
```

This creates the role `aftr` (password `aftr`) and the databases `aftr` and `aftr_test`. You don't create any tables yourself: Flyway builds the schema when the backend starts.

**Option B: Docker**

```bash
docker compose up -d
```

This starts the same setup, including `aftr_test`.

## 3. Run the backend

```bash
cd backend
mvn spring-boot:run
```

- The API runs at `http://localhost:8080`.
- Swagger UI is at `http://localhost:8080/swagger-ui.html`.

The defaults match the database setup above. To override them, set environment variables; see `.env.example`. On Windows PowerShell:

```powershell
$env:DATABASE_PASSWORD="your-password"; mvn spring-boot:run
```

On the first start, with an empty `users` table, the app seeds a realistic demo dataset. It includes about 225 users, 22 events in every state, bookings spread over the last 30 days, notifications, announcements, approvals and audit entries. Seeded rows are flagged `is_seed`.

**Demo accounts**

| Role      | Email                | Password         |
|-----------|----------------------|------------------|
| Admin     | `admin@aftr.dev`     | `Admin@2026`     |
| Organizer | `organizer@aftr.dev` | `Organizer@2026` |
| Attendee  | `attendee@aftr.dev`  | `Attendee@2026`  |

Other organizers (`lowlight@`, `studio@`, `commonground@aftr.dev`) use `Organizer@2026`. Generated attendees (`*@demo.aftr.dev`) use `Attendee@2026`.

To re-seed, drop and recreate the `aftr` database, then restart.

You can also build a jar and run it:

```bash
mvn -DskipTests package
java -jar target/aftr-backend-1.0.0.jar
```

## 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite proxies `/api` and `/uploads` to `http://localhost:8080`, so the session and CSRF cookies work without any cross-origin setup.

For a production build:

```bash
npm run build      # type-checks with tsc, then builds dist/
npm run preview
```

If you host the SPA on a different origin from the API:

- set `VITE_API_BASE_URL=https://api.example.com` when you build the frontend
- add the SPA's origin to `CORS_ALLOWED_ORIGINS` on the backend
- serve both over HTTPS with `COOKIE_SECURE=true`

## 5. Tests

The integration tests need a reachable `aftr_test` PostgreSQL database. Section 2 creates it.

```bash
cd backend
mvn test      # unit tests (*Test): validators, code generation, availability rules, purchase rules
mvn verify    # also runs the integration tests (*IT)
```

The integration tests boot the full application against PostgreSQL and use MockMvc. They cover:

- **AuthFlowIT:** register, login, session, logout. Also checks that ADMIN self-registration is refused, validation errors are reported per field, duplicate emails are rejected, suspended accounts can't log in, and requests without CSRF are blocked.
- **SecurityIT:** role checks on admin, organizer and attendee endpoints, and organizer ownership checks. Also checks that organizers can't approve their own events, that a suspension or role change takes effect on the user's very next request, and that the audit log records these actions.
- **EventWorkflowIT:** the draft → submit → approve → publish lifecycle. Also checks that rejections require a reason, that bad dates and schedules fail validation, and that the approval toggle in settings works. On the ticket side, quantity can't drop below the number sold and ticket types with sales can't be deleted. Cancelling an event cascades to bookings and sends notifications.
- **RegistrationIT:** paid bookings through the labelled dev checkout, QR codes, duplicate-booking prevention, sold-out and per-order limits, cancellation releasing seats, CSV export, announcements, and check-in.
- **InventoryConcurrencyIT:** 24 attendees race for 5 seats and exactly 5 succeed. One attendee double-submitting gets exactly one booking.

## 6. How the important parts work

**Authentication**

- Sessions are server-side and stored in PostgreSQL by Spring Session JDBC, so they survive a restart. The cookie is HttpOnly and SameSite=Lax.
- Passwords are hashed with BCrypt (strength 12).
- Write requests need the `XSRF-TOKEN` cookie value echoed back in the `X-XSRF-TOKEN` header. The SPA does this automatically.
- Login and registration are rate-limited per IP.

**Authorization**

- Every endpoint is protected by URL rules in `SecurityConfig` plus `@PreAuthorize`. Ownership is checked again in the service layer: an organizer can only touch their own events, and an attendee can only see their own bookings.
- The user's role always comes from the database. `ActiveUserFilter` reloads the user on every request, so a suspension or role change applies immediately and nothing the client sends can raise privileges.

**Inventory**

- Seats are reserved with one conditional `UPDATE ticket_types SET sold = sold + :q WHERE … AND sold + :q <= quantity`, inside the booking transaction, taking locks in ticket-type id order. PostgreSQL row locking means two buyers can never take the last seat.
- A partial unique index (`orders(user_id, event_id) WHERE status='CONFIRMED'`) blocks duplicate bookings even under concurrency.
- `CHECK (sold <= quantity)` is a final guard in the database itself.

**Payments**

- No payment provider is integrated. Free tickets are recorded as `NOT_REQUIRED`.
- Paid tickets go through a *development checkout*. It shows a clear notice before confirming and records `SIMULATED_PAID` with provider `DEV_SIMULATED`.
- Dashboards show real revenue (always ₹0 here) separately from simulated volume and never add the two together.
- Set `DEV_CHECKOUT_ENABLED=false` to refuse paid checkout instead (HTTP 503).

**Notifications and email**

- Notifications are delivered in-app only. No email is sent, and the UI says so wherever it matters.

**Event lifecycle**

- `DRAFT → PENDING → PUBLISHED`, or `REJECTED` (a reason is required), or `CANCELLED`. A published event that has ended is shown as *Completed*.
- An organizer can withdraw a pending submission, or unpublish a live event that has no registrations yet.
- Drafts and rejected events can be deleted if they have no booking history.

**Tickets**

- QR codes encode only a random 192-bit identifier, with no personal data.
- Check-in is limited to the event's organizer or an administrator. A ticket that has already been scanned, or that was cancelled, is refused.

**Audit**

- Every important action (approvals, rejections, bookings, cancellations, role and status changes, settings, check-ins and exports) is written to `audit_logs`, with the actor, a timestamp and the client IP.

## 7. Main API endpoints (`/api/v1`)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `GET /auth/csrf` |
| Me | `GET/PUT /me`, `POST /me/password`, `POST /me/email`, `GET /me/recommendations` |
| Discovery | `GET /events?q&category&city&from&to&price&format&featured&sort&page&size`, `GET /events/meta/filters`, `GET /events/{idOrSlug}`, `GET /events/{id}/related`, `GET /categories` |
| Organizer | `POST /events`, `PUT /events/{id}`, `POST /events/{id}/submit\|withdraw\|unpublish\|cancel`, `DELETE /events/{id}`, `GET/POST /events/{id}/tickets`, `PUT/DELETE /events/{id}/tickets/{ticketId}`, `GET /events/{id}/registrations[/export]`, `GET/POST /events/{id}/announcements`, `GET /organizer/events`, `GET /organizer/analytics`, `GET /organizer/announcements` |
| Attendee | `POST /registrations`, `GET /bookings?scope=upcoming\|past\|cancelled\|all`, `GET /bookings/{reference}`, `POST /bookings/{reference}/cancel` |
| Check-in | `GET /tickets/{code}/verify`, `POST /tickets/{code}/check-in` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}`, `POST /notifications/read-all` |
| Admin | `POST /events/{id}/approve\|reject`, `GET /admin/analytics`, `GET /admin/events`, `PATCH /admin/events/{id}/feature`, `GET /admin/approvals`, `GET /admin/audit-logs`, `GET/PUT /admin/settings`, `GET/PATCH/DELETE /users/{id}`, `POST /users/{id}/suspend\|reactivate` |
| Uploads | `POST /uploads/images` (multipart, JPEG/PNG/WebP up to 5 MB, checked by magic bytes) |

Swagger UI has the full schemas.

## 8. Notes and limitations

- The seeded event photos load from Unsplash. If an image can't load, the UI shows a designed typographic placeholder instead of a broken image.
- The 3D hero uses WebGL. It falls back to a static vector version without WebGL or on low-power devices, and renders a still frame when *reduce motion* is enabled.
- Changing your sign-in email requires your current password. There's no verification link, because no email provider is configured.
