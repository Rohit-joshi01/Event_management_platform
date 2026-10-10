-- AFTR core relational schema
-- All timestamps are stored as timestamptz (UTC). Money is stored in minor units (paise / cents).

CREATE TABLE users (
    id                     BIGSERIAL PRIMARY KEY,
    email                  VARCHAR(254) NOT NULL,
    password_hash          VARCHAR(100) NOT NULL,
    full_name              VARCHAR(120) NOT NULL,
    role                   VARCHAR(20)  NOT NULL,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    avatar_url             VARCHAR(500),
    bio                    VARCHAR(600),
    organization_name      VARCHAR(160),
    city                   VARCHAR(100),
    notify_announcements   BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_reminders       BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_recommendations BOOLEAN      NOT NULL DEFAULT TRUE,
    is_seed                BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at          TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_role_chk   CHECK (role IN ('ADMIN', 'ORGANIZER', 'ATTENDEE')),
    CONSTRAINT users_status_chk CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_created_idx ON users (created_at);

CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(60)  NOT NULL UNIQUE,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(300),
    sort_order  INT          NOT NULL DEFAULT 0
);

CREATE TABLE venues (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(160) NOT NULL,
    address    VARCHAR(300),
    city       VARCHAR(100) NOT NULL,
    country    VARCHAR(100) NOT NULL DEFAULT 'India',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX venues_city_idx ON venues (lower(city));

CREATE TABLE events (
    id               BIGSERIAL PRIMARY KEY,
    organizer_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    category_id      BIGINT       NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    venue_id         BIGINT       REFERENCES venues (id) ON DELETE SET NULL,
    title            VARCHAR(140) NOT NULL,
    slug             VARCHAR(180) NOT NULL UNIQUE,
    summary          VARCHAR(280) NOT NULL,
    description      TEXT         NOT NULL,
    cover_image_url  VARCHAR(500),
    starts_at        TIMESTAMPTZ  NOT NULL,
    ends_at          TIMESTAMPTZ  NOT NULL,
    timezone         VARCHAR(60)  NOT NULL DEFAULT 'Asia/Kolkata',
    format           VARCHAR(20)  NOT NULL DEFAULT 'IN_PERSON',
    online_url       VARCHAR(500),
    status           VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    featured         BOOLEAN      NOT NULL DEFAULT FALSE,
    rejection_reason VARCHAR(1000),
    cancel_reason    VARCHAR(1000),
    min_price_cents  BIGINT       NOT NULL DEFAULT 0,
    total_capacity   INT          NOT NULL DEFAULT 0,
    total_sold       INT          NOT NULL DEFAULT 0,
    submitted_at     TIMESTAMPTZ,
    published_at     TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    is_seed          BOOLEAN      NOT NULL DEFAULT FALSE,
    version          BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT events_status_chk CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT events_format_chk CHECK (format IN ('IN_PERSON', 'ONLINE', 'HYBRID')),
    CONSTRAINT events_dates_chk  CHECK (ends_at > starts_at),
    CONSTRAINT events_sold_chk   CHECK (total_sold >= 0)
);
CREATE INDEX events_status_starts_idx ON events (status, starts_at);
CREATE INDEX events_organizer_idx ON events (organizer_id);
CREATE INDEX events_category_idx ON events (category_id);
CREATE INDEX events_title_idx ON events (lower(title));

CREATE TABLE event_schedule_items (
    id          BIGSERIAL PRIMARY KEY,
    event_id    BIGINT       NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ  NOT NULL,
    title       VARCHAR(160) NOT NULL,
    description VARCHAR(500),
    sort_order  INT          NOT NULL DEFAULT 0
);
CREATE INDEX schedule_event_idx ON event_schedule_items (event_id);

CREATE TABLE ticket_types (
    id            BIGSERIAL PRIMARY KEY,
    event_id      BIGINT       NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    name          VARCHAR(80)  NOT NULL,
    description   VARCHAR(300),
    price_cents   BIGINT       NOT NULL DEFAULT 0,
    currency      VARCHAR(3)   NOT NULL DEFAULT 'INR',
    quantity      INT          NOT NULL,
    sold          INT          NOT NULL DEFAULT 0,
    sales_start   TIMESTAMPTZ,
    sales_end     TIMESTAMPTZ,
    max_per_order INT          NOT NULL DEFAULT 4,
    sort_order    INT          NOT NULL DEFAULT 0,
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ticket_price_chk     CHECK (price_cents >= 0),
    CONSTRAINT ticket_quantity_chk  CHECK (quantity > 0),
    CONSTRAINT ticket_sold_chk      CHECK (sold >= 0 AND sold <= quantity),
    CONSTRAINT ticket_max_order_chk CHECK (max_per_order BETWEEN 1 AND 20),
    CONSTRAINT ticket_window_chk    CHECK (sales_start IS NULL OR sales_end IS NULL OR sales_end > sales_start)
);
CREATE INDEX ticket_types_event_idx ON ticket_types (event_id);

CREATE TABLE orders (
    id               BIGSERIAL PRIMARY KEY,
    reference        VARCHAR(20)  NOT NULL UNIQUE,
    user_id          BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    event_id         BIGINT       NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
    status           VARCHAR(20)  NOT NULL,
    total_cents      BIGINT       NOT NULL DEFAULT 0,
    currency         VARCHAR(3)   NOT NULL DEFAULT 'INR',
    payment_status   VARCHAR(30)  NOT NULL,
    payment_provider VARCHAR(30)  NOT NULL,
    is_seed          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    cancelled_at     TIMESTAMPTZ,
    CONSTRAINT orders_status_chk  CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    CONSTRAINT orders_payment_chk CHECK (payment_status IN ('NOT_REQUIRED', 'SIMULATED_PAID', 'SIMULATED_REFUNDED', 'PAID', 'REFUNDED')),
    CONSTRAINT orders_total_chk   CHECK (total_cents >= 0)
);
-- One active booking per attendee per event (duplicate-registration backstop).
CREATE UNIQUE INDEX orders_one_active_per_event_uq ON orders (user_id, event_id) WHERE status = 'CONFIRMED';
CREATE INDEX orders_event_idx ON orders (event_id, created_at);
CREATE INDEX orders_user_idx ON orders (user_id, created_at);

CREATE TABLE tickets (
    id             BIGSERIAL PRIMARY KEY,
    order_id       BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    ticket_type_id BIGINT       NOT NULL REFERENCES ticket_types (id) ON DELETE RESTRICT,
    event_id       BIGINT       NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
    user_id        BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    code           VARCHAR(64)  NOT NULL UNIQUE,
    status         VARCHAR(20)  NOT NULL DEFAULT 'VALID',
    price_cents    BIGINT       NOT NULL DEFAULT 0,
    checked_in_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT tickets_status_chk CHECK (status IN ('VALID', 'CHECKED_IN', 'CANCELLED'))
);
CREATE INDEX tickets_event_idx ON tickets (event_id);
CREATE INDEX tickets_order_idx ON tickets (order_id);
CREATE INDEX tickets_type_idx ON tickets (ticket_type_id);

CREATE TABLE approval_records (
    id         BIGSERIAL PRIMARY KEY,
    event_id   BIGINT        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    admin_id   BIGINT        REFERENCES users (id) ON DELETE SET NULL,
    decision   VARCHAR(20)   NOT NULL,
    reason     VARCHAR(1000),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT approval_decision_chk CHECK (decision IN ('APPROVED', 'REJECTED'))
);
CREATE INDEX approval_event_idx ON approval_records (event_id);

CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       VARCHAR(40)   NOT NULL,
    title      VARCHAR(200)  NOT NULL,
    body       VARCHAR(2000) NOT NULL,
    link       VARCHAR(300),
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE announcements (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    sender_id       BIGINT        REFERENCES users (id) ON DELETE SET NULL,
    subject         VARCHAR(160)  NOT NULL,
    message         VARCHAR(4000) NOT NULL,
    recipient_count INT           NOT NULL DEFAULT 0,
    channel         VARCHAR(20)   NOT NULL DEFAULT 'IN_APP',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX announcements_event_idx ON announcements (event_id, created_at DESC);

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    BIGINT        REFERENCES users (id) ON DELETE SET NULL,
    actor_email VARCHAR(254),
    action      VARCHAR(60)   NOT NULL,
    entity_type VARCHAR(40)   NOT NULL,
    entity_id   BIGINT,
    summary     VARCHAR(500)  NOT NULL,
    ip_address  VARCHAR(64),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_action_idx ON audit_logs (action);

CREATE TABLE platform_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    value       VARCHAR(500) NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  BIGINT       REFERENCES users (id) ON DELETE SET NULL
);

INSERT INTO platform_settings (setting_key, value) VALUES
    ('platform.name', 'AFTR'),
    ('platform.supportEmail', 'support@aftr.dev'),
    ('registration.allowAttendeeSignup', 'true'),
    ('registration.allowOrganizerSignup', 'true'),
    ('events.requireApproval', 'true'),
    ('events.minLeadHours', '24'),
    ('events.maxTicketTypes', '6'),
    ('notifications.notifyAdminsOnSubmission', 'true'),
    ('notifications.notifyOrganizerOnRegistration', 'true');

INSERT INTO categories (slug, name, description, sort_order) VALUES
    ('technology', 'Technology', 'Conferences, hackathons and builder meetups.', 1),
    ('music', 'Music', 'Live sets, gigs, listening sessions and festivals.', 2),
    ('workshops', 'Workshops', 'Hands-on sessions where you leave with a new skill.', 3),
    ('art', 'Art', 'Exhibitions, studio visits and installations.', 4),
    ('business', 'Business', 'Founders, operators and industry gatherings.', 5),
    ('sports', 'Sports', 'Runs, tournaments and screenings.', 6),
    ('community', 'Community', 'Meetups, volunteering and neighbourhood culture.', 7);

-- Spring Session JDBC (persistent server-side sessions)
CREATE TABLE spring_session (
    primary_id            CHAR(36) NOT NULL,
    session_id            CHAR(36) NOT NULL,
    creation_time         BIGINT   NOT NULL,
    last_access_time      BIGINT   NOT NULL,
    max_inactive_interval INT      NOT NULL,
    expiry_time           BIGINT   NOT NULL,
    principal_name        VARCHAR(100),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id CHAR(36)     NOT NULL,
    attribute_name     VARCHAR(200) NOT NULL,
    attribute_bytes    BYTEA        NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id) REFERENCES spring_session (primary_id) ON DELETE CASCADE
);
