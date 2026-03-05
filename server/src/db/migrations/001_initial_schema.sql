-- ──────────────────────────────────────────────────────────────────────────────
-- CampusConnect · Initial Schema · Migration 001
-- ──────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid  TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  user_type     TEXT NOT NULL CHECK (user_type IN ('student','organiser')),
  university    TEXT,
  avatar_url    TEXT,
  interests     TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organiser_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  date_start    TIMESTAMPTZ NOT NULL,
  date_end      TIMESTAMPTZ,
  location_name TEXT NOT NULL,
  location_lat  NUMERIC(10,7),
  location_lng  NUMERIC(10,7),
  cover_image   TEXT,
  capacity      INTEGER,
  is_free       BOOLEAN DEFAULT TRUE,
  price_cents   INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'published'
                     CHECK (status IN ('draft','published','cancelled')),
  rsvp_count    INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RSVPs
CREATE TABLE rsvps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','cancelled','checked_in')),
  checked_in_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- Notifications
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_events_organiser   ON events(organiser_id);
CREATE INDEX idx_events_category    ON events(category);
CREATE INDEX idx_events_date_start  ON events(date_start);
CREATE INDEX idx_events_status      ON events(status);
CREATE INDEX idx_rsvps_event        ON rsvps(event_id);
CREATE INDEX idx_rsvps_user         ON rsvps(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
