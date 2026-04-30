const express = require('express');
const jwt = require('jsonwebtoken');
const { body, param } = require('express-validator');

const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const { sendPush } = require('../services/pushNotifier');

const router = express.Router();

router.use(verifyToken);

const CAMPUS_TIME_ZONE = 'America/Los_Angeles';

const CATEGORY_LABELS = {
  tech: 'Tech',
  music: 'Music',
  sports: 'Sports',
  social: 'Social',
  art: 'Art',
  food: 'Food',
  academic: 'Academic',
};
const DEFAULT_NOTIFICATION_PREFERENCES = {
  rsvp_confirm: true,
  rsvp_cancel: true,
  event_reminder: true,
  event_update: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};
const QUIET_HOUR_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: CAMPUS_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CAMPUS_TIME_ZONE,
});

function formatTimeRange(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return 'Time TBA';
  }

  const startText = timeFormatter.format(startDate);
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return startText;
  }

  return `${startText} - ${timeFormatter.format(endDate)}`;
}

function formatRsvpRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    status: row.status,
    qrToken: row.qr_token,
    createdAt: row.created_at,
  };
}

function formatEventRow(row) {
  const startDate = new Date(row.date);
  const endDate = row.end_date ? new Date(row.end_date) : null;
  const categoryKey = (row.category || '').toLowerCase();
  const category = CATEGORY_LABELS[categoryKey] || 'General';
  const rsvpCount = Number(row.rsvp_count) || 0;
  const hasValidCapacity = Number(row.capacity) > 0;
  const capacity = hasValidCapacity ? Number(row.capacity) : Math.max(rsvpCount, 1);
  const priceValue = row.price === null ? 0 : Number(row.price);
  const isFree = Boolean(row.is_free) || priceValue <= 0;
  const location =
    row.location && row.venue
      ? `${row.location} - ${row.venue}`
      : row.venue || row.location || 'Location TBA';

  return {
    id: row.id,
    title: row.title,
    org: row.org_name || 'CampusConnect',
    category,
    date: dateFormatter.format(startDate),
    time: formatTimeRange(startDate, endDate),
    location,
    description: row.description || 'Details coming soon.',
    rsvpCount,
    capacity,
    isFree,
    price: isFree ? 'Free' : `$${priceValue.toFixed(2)}`,
    aiRecommended: false,
    tags: [...new Set([categoryKey, row.source].filter(Boolean))],
    startsAt: row.date,
    endsAt: row.end_date,
    source: row.source,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
  };
}

function getQrTokenExpiry(dateValue) {
  const eventDate = new Date(dateValue);
  if (Number.isNaN(eventDate.getTime())) {
    return null;
  }

  return Math.floor(eventDate.getTime() / 1000);
}

function parseUtcHourMinute(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = QUIET_HOUR_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function isNowInQuietHours(preferences) {
  const startMinutes = parseUtcHourMinute(preferences?.quiet_hours_start);
  const endMinutes = parseUtcHourMinute(preferences?.quiet_hours_end);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

async function shouldInsertNotification(client, userId, notificationType) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATION_PREFERENCES, notificationType)) {
    return true;
  }

  const preferenceResult = await client.query(
    `
      SELECT COALESCE(notification_preferences, $2::jsonb) AS notification_preferences
      FROM users
      WHERE id = $1
    `,
    [userId, JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES)]
  );

  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(preferenceResult.rows[0]?.notification_preferences || {}),
  };

  if (preferences[notificationType] === false) {
    return false;
  }

  if (isNowInQuietHours(preferences)) {
    return false;
  }

  return true;
}

const checkinValidation = [
  body('qrToken')
    .isString()
    .withMessage('qrToken is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 4096 })
    .withMessage('qrToken must be 1 to 4096 characters'),
];

const eventIdValidation = [param('eventId').isUUID().withMessage('Invalid event id format')];

router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          r.id AS rsvp_id,
          r.user_id,
          r.event_id,
          r.status,
          r.qr_token,
          r.created_at AS rsvp_created_at,
          e.id,
          e.title,
          e.description,
          e.category,
          e.date,
          e.end_date,
          e.location,
          e.venue,
          e.image_url,
          e.is_free,
          e.price,
          e.capacity,
          e.rsvp_count,
          e.organizer_id,
          e.source,
          e.source_url,
          o.name AS org_name
        FROM rsvps r
        JOIN events e ON e.id = r.event_id
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE r.user_id = $1
          AND r.status = 'confirmed'
        ORDER BY e.date ASC
      `,
      [req.user.userId]
    );

    const rsvps = result.rows.map((row) => ({
      id: row.rsvp_id,
      userId: row.user_id,
      eventId: row.event_id,
      status: row.status,
      qrToken: row.qr_token,
      createdAt: row.rsvp_created_at,
      event: formatEventRow(row),
    }));

    return res.json({ rsvps });
  } catch (error) {
    console.error('Fetch my RSVPs error:', error);
    return res.status(500).json({ message: 'Failed to fetch RSVPs' });
  }
});

router.post('/checkin', checkinValidation, validateRequest, async (req, res) => {
  const { qrToken } = req.body ?? {};

  let decoded;
  try {
    decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired QR token' });
  }

  const { userId, eventId, rsvpId } = decoded;
  if (!userId || !eventId || !rsvpId) {
    return res.status(400).json({ message: 'QR token payload is invalid' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `
        UPDATE rsvps
        SET status = 'checked_in'
        WHERE id = $1
          AND user_id = $2
          AND event_id = $3
          AND status = 'confirmed'
        RETURNING id, user_id, event_id, status, qr_token, created_at
      `,
      [rsvpId, userId, eventId]
    );

    if (updateResult.rows.length === 0) {
      const existingResult = await client.query(
        `
          SELECT status
          FROM rsvps
          WHERE id = $1
            AND user_id = $2
            AND event_id = $3
        `,
        [rsvpId, userId, eventId]
      );

      const existing = existingResult.rows[0];
      await client.query('ROLLBACK');

      if (!existing) {
        return res.status(404).json({ message: 'RSVP not found for this QR token' });
      }

      if (existing.status === 'checked_in') {
        return res.status(409).json({ message: 'Attendee already checked in' });
      }

      if (existing.status === 'cancelled') {
        return res.status(409).json({ message: 'This RSVP has been cancelled' });
      }

      return res.status(409).json({ message: 'RSVP is not eligible for check-in' });
    }

    const attendanceSummaryResult = await client.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'checked_in')::int AS checked_in_count,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count,
          COUNT(*)::int AS total_rsvps
        FROM rsvps
        WHERE event_id = $1
      `,
      [eventId]
    );

    const attendanceSummary = attendanceSummaryResult.rows[0] || {
      checked_in_count: 0,
      confirmed_count: 0,
      cancelled_count: 0,
      total_rsvps: 0,
    };

    await client.query('COMMIT');
    return res.json({
      success: true,
      attendanceSummary: {
        eventId,
        checkedInCount: attendanceSummary.checked_in_count,
        confirmedCount: attendanceSummary.confirmed_count,
        cancelledCount: attendanceSummary.cancelled_count,
        totalRsvps: attendanceSummary.total_rsvps,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('RSVP check-in error:', error);
    return res.status(500).json({ message: 'Failed to check in attendee' });
  } finally {
    client.release();
  }
});

router.post('/:eventId', eventIdValidation, validateRequest, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let shouldSendRsvpConfirmPush = false;

    const eventResult = await client.query(
      `
        SELECT id, title, date, capacity, rsvp_count
        FROM events
        WHERE id = $1
        FOR UPDATE
      `,
      [eventId]
    );

    const event = eventResult.rows[0];

    if (!event) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Event not found' });
    }

    const existingRsvpResult = await client.query(
      `
        SELECT id, status
        FROM rsvps
        WHERE user_id = $1
          AND event_id = $2
        FOR UPDATE
      `,
      [userId, eventId]
    );

    const existingRsvp = existingRsvpResult.rows[0];

    if (existingRsvp && ['confirmed', 'checked_in'].includes(existingRsvp.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'You already have an active RSVP for this event' });
    }

    const capacityValue = event.capacity === null ? null : Number(event.capacity);
    const hasCapacityLimit = Number.isFinite(capacityValue);
    const currentCount = Number(event.rsvp_count) || 0;
    if (hasCapacityLimit && currentCount >= capacityValue) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Event is full' });
    }

    let rsvp;

    if (existingRsvp && existingRsvp.status === 'cancelled') {
      const updatedRsvpResult = await client.query(
        `
          UPDATE rsvps
          SET status = 'confirmed'
          WHERE id = $1
          RETURNING id, user_id, event_id, status, qr_token, created_at
        `,
        [existingRsvp.id]
      );
      rsvp = updatedRsvpResult.rows[0];
    } else {
      const insertRsvpResult = await client.query(
        `
          INSERT INTO rsvps (user_id, event_id, status)
          VALUES ($1, $2, 'confirmed')
          RETURNING id, user_id, event_id, status, qr_token, created_at
        `,
        [userId, eventId]
      );
      rsvp = insertRsvpResult.rows[0];
    }

    const qrExpiry = getQrTokenExpiry(event.date);

    if (!qrExpiry) {
      await client.query('ROLLBACK');
      return res.status(500).json({ message: 'Unable to generate RSVP ticket token' });
    }

    const qrToken = jwt.sign(
      {
        userId,
        eventId,
        rsvpId: rsvp.id,
        exp: qrExpiry,
      },
      process.env.JWT_SECRET
    );

    const withTokenResult = await client.query(
      `
        UPDATE rsvps
        SET qr_token = $2
        WHERE id = $1
        RETURNING id, user_id, event_id, status, qr_token, created_at
      `,
      [rsvp.id, qrToken]
    );

    const confirmedRsvp = withTokenResult.rows[0];

    await client.query(
      `
        UPDATE events
        SET rsvp_count = rsvp_count + 1
        WHERE id = $1
      `,
      [eventId]
    );

    if (await shouldInsertNotification(client, userId, 'rsvp_confirm')) {
      await client.query(
        `
          INSERT INTO notifications (user_id, type, title, body, event_id)
          VALUES ($1, 'rsvp_confirm', 'RSVP Confirmed', $2, $3)
        `,
        [userId, `You're registered for ${event.title}.`, eventId]
      );
      shouldSendRsvpConfirmPush = true;
    }

    await client.query('COMMIT');

    if (shouldSendRsvpConfirmPush) {
      sendPush(userId, {
        title: 'RSVP Confirmed',
        body: `You're going to ${event.title}!`,
        data: { eventId },
      });
    }

    return res.status(201).json({
      rsvp: formatRsvpRow(confirmedRsvp),
      qrToken,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '22P02') {
      return res.status(400).json({ message: 'Invalid event id format' });
    }

    if (error.code === '23505') {
      return res.status(409).json({ message: 'You already RSVPed to this event' });
    }

    console.error('Create RSVP error:', error);
    return res.status(500).json({ message: 'Failed to RSVP for event' });
  } finally {
    client.release();
  }
});

router.delete('/:eventId', eventIdValidation, validateRequest, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const eventResult = await client.query(
      `
        SELECT id, title
        FROM events
        WHERE id = $1
        FOR UPDATE
      `,
      [eventId]
    );

    const event = eventResult.rows[0];
    if (!event) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Event not found' });
    }

    const cancelResult = await client.query(
      `
        UPDATE rsvps
        SET status = 'cancelled'
        WHERE user_id = $1
          AND event_id = $2
          AND status = 'confirmed'
        RETURNING id, user_id, event_id, status, qr_token, created_at
      `,
      [userId, eventId]
    );

    const cancelledRsvp = cancelResult.rows[0];
    if (!cancelledRsvp) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Confirmed RSVP not found' });
    }

    await client.query(
      `
        UPDATE events
        SET rsvp_count = GREATEST(rsvp_count - 1, 0)
        WHERE id = $1
      `,
      [eventId]
    );

    if (await shouldInsertNotification(client, userId, 'rsvp_cancel')) {
      await client.query(
        `
          INSERT INTO notifications (user_id, type, title, body, event_id)
          VALUES ($1, 'rsvp_cancel', 'RSVP Cancelled', $2, $3)
        `,
        [userId, `You cancelled your RSVP for ${event.title}.`, eventId]
      );
    }

    await client.query('COMMIT');
    return res.json({ rsvp: formatRsvpRow(cancelledRsvp) });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Cancel RSVP error:', error);
    return res.status(500).json({ message: 'Failed to cancel RSVP' });
  } finally {
    client.release();
  }
});

module.exports = router;
