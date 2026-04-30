-- CampusConnect initial PostgreSQL schema

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  name text,
  major text,
  year text,
  role text NOT NULL DEFAULT 'student',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_year_check
    CHECK (year IS NULL OR year IN ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate')),
  CONSTRAINT users_role_check
    CHECK (role IN ('student', 'org_leader', 'admin'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  verified boolean NOT NULL DEFAULT false,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL,
  description text,
  proof_url text,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_requests_status_check
    CHECK (status IN ('pending', 'approved', 'denied'))
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  date timestamptz NOT NULL,
  end_date timestamptz,
  location text,
  venue text,
  image_url text,
  is_free boolean NOT NULL DEFAULT true,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  capacity integer,
  rsvp_count integer NOT NULL DEFAULT 0,
  organizer_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_category_check
    CHECK (category IS NULL OR category IN ('tech', 'music', 'sports', 'social', 'art', 'food', 'academic')),
  CONSTRAINT events_source_check
    CHECK (source IN ('manual', 'scraped')),
  CONSTRAINT events_price_nonnegative_check
    CHECK (price >= 0),
  CONSTRAINT events_capacity_nonnegative_check
    CHECK (capacity IS NULL OR capacity >= 0),
  CONSTRAINT events_rsvp_count_nonnegative_check
    CHECK (rsvp_count >= 0),
  CONSTRAINT events_end_after_start_check
    CHECK (end_date IS NULL OR end_date > date)
);

CREATE TABLE IF NOT EXISTS rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed',
  qr_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rsvps_status_check
    CHECK (status IN ('confirmed', 'cancelled', 'checked_in')),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check
    CHECK (type IN ('rsvp_confirm', 'rsvp_cancel', 'event_reminder', 'event_update'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_url_unique ON events(source_url);
CREATE INDEX IF NOT EXISTS idx_rsvps_user_id ON rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

COMMIT;
