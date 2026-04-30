const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs/promises');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../db');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to server/.env or your shell environment.');
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      token text UNIQUE NOT NULL,
      expires_at timestamptz NOT NULL,
      used boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT
      '{"rsvp_confirm":true,"rsvp_cancel":true,"event_reminder":true,"event_update":true,"quiet_hours_start":null,"quiet_hours_end":null}';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS push_token text;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
  `);

  await pool.query(`
    UPDATE users
    SET last_login_at = COALESCE(last_login_at, created_at)
    WHERE last_login_at IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_event_views (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      event_id uuid REFERENCES events(id) ON DELETE CASCADE,
      viewed_at timestamptz DEFAULT now(),
      UNIQUE(user_id, event_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recommended_events (
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      event_id uuid REFERENCES events(id) ON DELETE CASCADE,
      score numeric,
      updated_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_id, event_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_event_views_user_id
    ON user_event_views(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommended_events_user_id
    ON recommended_events(user_id);
  `);
}

async function main() {
  try {
    await migrate();
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
