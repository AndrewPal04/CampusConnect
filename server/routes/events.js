const express = require('express');
const { body, param } = require('express-validator');
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const { isDatabaseConnectionError } = require('../middleware/degradation');
const { runScraperWithStatus, getScrapeStatus } = require('../scrapers/scheduler');
const { getRecommendedEventIds } = require('../services/recommendationEngine');

const router = express.Router();

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
const ALLOWED_CATEGORIES = Object.keys(CATEGORY_LABELS);
const WRITE_ROLES = new Set(['org_leader', 'admin']);

const ALLOWED_SORT_KEYS = new Set(['date', 'date_asc', 'date_desc', 'popular', 'newest', 'title']);

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

function normalizeCategory(rawCategory) {
  if (typeof rawCategory !== 'string') {
    return null;
  }

  const normalized = rawCategory.trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return null;
  }

  return normalized;
}

function normalizeInterests(interests) {
  if (!Array.isArray(interests)) {
    return [];
  }

  return [...new Set(
    interests
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => ALLOWED_CATEGORIES.includes(entry))
  )];
}

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

function formatEvent(row) {
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
    categoryKey,
    locationName: row.location,
    venue: row.venue,
    priceAmount: priceValue,
    organizerId: row.organizer_id,
  };
}

function toNullableText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function isFutureDateString(value) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() > Date.now();
}

async function getUserOrganizationId(userId) {
  const orgResult = await pool.query(
    `
      SELECT id
      FROM organizations
      WHERE owner_id = $1
      ORDER BY verified DESC, created_at ASC
      LIMIT 1
    `,
    [userId]
  );

  return orgResult.rows[0]?.id || null;
}

async function fetchEventRowById(eventId) {
  const eventResult = await pool.query(
    `
      SELECT e.*, o.name AS org_name
      FROM events e
      LEFT JOIN organizations o ON o.id = e.organizer_id
      WHERE e.id = $1
    `,
    [eventId]
  );

  return eventResult.rows[0] || null;
}

async function fetchFormattedEventsByIds(eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT e.*, o.name AS org_name, ranked.ord
      FROM unnest($1::uuid[]) WITH ORDINALITY AS ranked(event_id, ord)
      JOIN events e ON e.id = ranked.event_id
      LEFT JOIN organizations o ON o.id = e.organizer_id
      WHERE e.date >= NOW()
      ORDER BY ranked.ord ASC
    `,
    [eventIds]
  );

  return result.rows.map((row) => formatEvent(row));
}

async function fetchUserInterests(userId) {
  const userResult = await pool.query(
    `
      SELECT interests
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return normalizeInterests(userResult.rows[0]?.interests);
}

async function cacheRecommendedEventIds(userId, recommendedIds) {
  const uniqueIds = [...new Set((recommendedIds || []).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return;
  }

  const scores = uniqueIds.map((_, index) => uniqueIds.length - index);

  await pool.query(
    `
      INSERT INTO recommended_events (user_id, event_id, score, updated_at)
      SELECT $1, rec.event_id, rec.score, now()
      FROM unnest($2::uuid[], $3::numeric[]) AS rec(event_id, score)
      ON CONFLICT (user_id, event_id)
      DO UPDATE
      SET score = EXCLUDED.score,
          updated_at = now()
    `,
    [userId, uniqueIds, scores]
  );
}

async function canManageEvent(user, eventRow) {
  if (user?.role === 'admin') {
    return true;
  }

  if (user?.role !== 'org_leader') {
    return false;
  }

  const userOrganizationId = await getUserOrganizationId(user.userId);
  return Boolean(userOrganizationId) && userOrganizationId === eventRow.organizer_id;
}

function formatRate(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return '0.0';
  }

  return ((numerator / denominator) * 100).toFixed(1);
}

function ensureAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  return next();
}

const createEventValidation = [
  body('title')
    .isString()
    .withMessage('title is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('title must be 1 to 200 characters'),
  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('description must be a string')
    .bail()
    .trim(),
  body('category')
    .isString()
    .withMessage('category is required')
    .bail()
    .trim()
    .toLowerCase()
    .isIn(ALLOWED_CATEGORIES)
    .withMessage(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`),
  body('date')
    .isString()
    .withMessage('date is required')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('date must be a valid ISO timestamp')
    .bail()
    .custom((value) => isFutureDateString(value))
    .withMessage('date must be in the future'),
  body('endDate')
    .optional({ nullable: true })
    .isString()
    .withMessage('endDate must be an ISO timestamp')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('endDate must be a valid ISO timestamp'),
  body('location')
    .optional({ nullable: true })
    .isString()
    .withMessage('location must be a string')
    .bail()
    .trim(),
  body('venue')
    .optional({ nullable: true })
    .isString()
    .withMessage('venue must be a string')
    .bail()
    .trim(),
  body('imageUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('imageUrl must be a string')
    .bail()
    .trim(),
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be boolean'),
  body('price')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('price must be a non-negative number')
    .toFloat(),
  body('capacity')
    .isInt({ min: 1 })
    .withMessage('capacity must be a positive integer')
    .toInt(),
  body().custom((payload) => {
    const isFree = parseBoolean(payload?.isFree, true);
    const hasPrice = payload?.price !== undefined && payload?.price !== null && payload?.price !== '';

    if (!isFree && !hasPrice) {
      throw new Error('price is required when isFree is false');
    }

    if (payload?.endDate) {
      const start = new Date(payload.date);
      const end = new Date(payload.endDate);

      if (end.getTime() <= start.getTime()) {
        throw new Error('endDate must be after date');
      }
    }

    return true;
  }),
];

const updateEventValidation = [
  param('id').isUUID().withMessage('Invalid event id format'),
  body().custom((payload) => {
    const allowedFields = [
      'title',
      'description',
      'category',
      'date',
      'endDate',
      'location',
      'venue',
      'imageUrl',
      'isFree',
      'price',
      'capacity',
    ];

    const hasUpdateField = allowedFields.some((field) => payload?.[field] !== undefined);

    if (!hasUpdateField) {
      throw new Error('At least one field must be provided for update');
    }

    return true;
  }),
  body('title')
    .optional()
    .isString()
    .withMessage('title must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('title must be 1 to 200 characters'),
  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('description must be a string')
    .bail()
    .trim(),
  body('category')
    .optional()
    .isString()
    .withMessage('category must be a string')
    .bail()
    .trim()
    .toLowerCase()
    .isIn(ALLOWED_CATEGORIES)
    .withMessage(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`),
  body('date')
    .optional()
    .isString()
    .withMessage('date must be an ISO timestamp')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('date must be a valid ISO timestamp')
    .bail()
    .custom((value) => isFutureDateString(value))
    .withMessage('date must be in the future'),
  body('endDate')
    .optional({ nullable: true })
    .isString()
    .withMessage('endDate must be an ISO timestamp')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('endDate must be a valid ISO timestamp'),
  body('location')
    .optional({ nullable: true })
    .isString()
    .withMessage('location must be a string')
    .bail()
    .trim(),
  body('venue')
    .optional({ nullable: true })
    .isString()
    .withMessage('venue must be a string')
    .bail()
    .trim(),
  body('imageUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('imageUrl must be a string')
    .bail()
    .trim(),
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be boolean'),
  body('price')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('price must be a non-negative number')
    .toFloat(),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('capacity must be a positive integer')
    .toInt(),
  body().custom((payload) => {
    const isFreeProvided = payload?.isFree !== undefined;
    const isFree = parseBoolean(payload?.isFree, true);
    const hasPrice = payload?.price !== undefined && payload?.price !== null && payload?.price !== '';

    if (isFreeProvided && !isFree && !hasPrice) {
      throw new Error('price is required when isFree is false');
    }

    return true;
  }),
];

const deleteEventValidation = [param('id').isUUID().withMessage('Invalid event id format')];
const eventAnalyticsValidation = [param('id').isUUID().withMessage('Invalid event id format')];
const viewEventValidation = [param('id').isUUID().withMessage('Invalid event id format')];

router.get('/', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const requestedLimit = parseInt(req.query.limit, 10) || 20;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);
  const offset = (page - 1) * limit;
  const category = normalizeCategory(req.query.category);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const requestedSort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : 'date';
  const sortKey = ALLOWED_SORT_KEYS.has(requestedSort) ? requestedSort : 'date';
  const tsSearch = search || null;
  const searchPattern = search ? `%${search}%` : null;

  if (category && !CATEGORY_LABELS[category]) {
    return res.status(400).json({ message: 'Invalid category filter' });
  }

  try {
    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM events e
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE ($1::text IS NULL OR e.category = $1)
          AND (
            $2::text IS NULL
            OR to_tsvector('english', e.title || ' ' || COALESCE(e.description, ''))
              @@ plainto_tsquery('english', $2)
            OR e.title ILIKE $3
            OR e.location ILIKE $3
            OR e.venue ILIKE $3
            OR o.name ILIKE $3
          )
      `,
      [category, tsSearch, searchPattern]
    );

    const total = countResult.rows[0]?.total ?? 0;
    const listResult = await pool.query(
      `
        SELECT e.*, o.name AS org_name
        FROM events e
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE ($1::text IS NULL OR e.category = $1)
          AND (
            $2::text IS NULL
            OR to_tsvector('english', e.title || ' ' || COALESCE(e.description, ''))
              @@ plainto_tsquery('english', $2)
            OR e.title ILIKE $3
            OR e.location ILIKE $3
            OR e.venue ILIKE $3
            OR o.name ILIKE $3
          )
        ORDER BY
          CASE WHEN $4::text IN ('date', 'date_asc') THEN e.date END ASC,
          CASE WHEN $4::text = 'date_desc' THEN e.date END DESC,
          CASE WHEN $4::text = 'popular' THEN e.rsvp_count END DESC,
          CASE WHEN $4::text = 'popular' THEN e.date END ASC,
          CASE WHEN $4::text = 'newest' THEN e.created_at END DESC,
          CASE WHEN $4::text = 'title' THEN e.title END ASC,
          e.date ASC,
          e.id ASC
        LIMIT $5
        OFFSET $6
      `,
      [category, tsSearch, searchPattern, sortKey, limit, offset]
    );

    return res.json({
      events: listResult.rows.map(formatEvent),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('List events error:', error);
    return res.status(500).json({ message: 'Failed to fetch events' });
  }
});

router.post('/', verifyToken, createEventValidation, validateRequest, async (req, res, next) => {
  if (!WRITE_ROLES.has(req.user?.role)) {
    return res.status(403).json({ message: 'Only organization leaders and admins can create events' });
  }

  try {
    const organizerId = await getUserOrganizationId(req.user.userId);

    if (!organizerId) {
      return res.status(400).json({ message: 'No organization is linked to this user' });
    }

    const isFree = parseBoolean(req.body.isFree, true);
    const price = isFree ? 0 : Number(req.body.price);
    const values = [
      req.body.title.trim(),
      toNullableText(req.body.description),
      req.body.category,
      req.body.date,
      req.body.endDate ?? null,
      toNullableText(req.body.location),
      toNullableText(req.body.venue),
      toNullableText(req.body.imageUrl),
      isFree,
      price,
      Number(req.body.capacity),
      organizerId,
    ];

    const insertResult = await pool.query(
      `
        INSERT INTO events (
          title,
          description,
          category,
          date,
          end_date,
          location,
          venue,
          image_url,
          is_free,
          price,
          capacity,
          organizer_id,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual')
        RETURNING id
      `,
      values
    );

    const event = await fetchEventRowById(insertResult.rows[0].id);

    return res.status(201).json({ event: formatEvent(event) });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Create event error:', error);
    return res.status(500).json({ message: 'Failed to create event' });
  }
});

router.patch('/:id', verifyToken, updateEventValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await fetchEventRowById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const canManage = await canManageEvent(req.user, event);
    if (!canManage) {
      return res.status(403).json({ message: 'You do not have permission to edit this event' });
    }

    const nextDate = req.body.date ?? event.date;
    const nextEndDate = req.body.endDate !== undefined ? req.body.endDate : event.end_date;

    if (nextEndDate && new Date(nextEndDate).getTime() <= new Date(nextDate).getTime()) {
      return res.status(400).json({ message: 'endDate must be after date' });
    }

    const updates = [];
    const values = [];

    const pushUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (req.body.title !== undefined) {
      pushUpdate('title', req.body.title.trim());
    }

    if (req.body.description !== undefined) {
      pushUpdate('description', toNullableText(req.body.description));
    }

    if (req.body.category !== undefined) {
      pushUpdate('category', req.body.category);
    }

    if (req.body.date !== undefined) {
      pushUpdate('date', req.body.date);
    }

    if (req.body.endDate !== undefined) {
      pushUpdate('end_date', req.body.endDate);
    }

    if (req.body.location !== undefined) {
      pushUpdate('location', toNullableText(req.body.location));
    }

    if (req.body.venue !== undefined) {
      pushUpdate('venue', toNullableText(req.body.venue));
    }

    if (req.body.imageUrl !== undefined) {
      pushUpdate('image_url', toNullableText(req.body.imageUrl));
    }

    if (req.body.isFree !== undefined) {
      pushUpdate('is_free', parseBoolean(req.body.isFree, true));
    }

    if (req.body.price !== undefined) {
      pushUpdate('price', Number(req.body.price));
    }

    if (req.body.capacity !== undefined) {
      pushUpdate('capacity', Number(req.body.capacity));
    }

    values.push(id);

    await pool.query(
      `
        UPDATE events
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
      `,
      values
    );

    const updatedEvent = await fetchEventRowById(id);
    return res.json({ event: formatEvent(updatedEvent) });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Update event error:', error);
    return res.status(500).json({ message: 'Failed to update event' });
  }
});

router.get('/scrape-now', verifyToken, ensureAdmin, async (req, res, next) => {
  try {
    const result = await runScraperWithStatus();
    return res.json({
      message: 'Scraper run completed',
      ...result,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Manual scrape error:', error);
    return res.status(500).json({ message: 'Failed to run scraper' });
  }
});

router.get('/scrape-status', verifyToken, ensureAdmin, async (req, res, next) => {
  try {
    return res.json(getScrapeStatus());
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Scrape status error:', error);
    return res.status(500).json({ message: 'Failed to fetch scrape status' });
  }
});

router.get('/upcoming', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT e.*, o.name AS org_name
        FROM events e
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE e.date >= NOW()
        ORDER BY e.date ASC
        LIMIT 10
      `
    );

    return res.json({ events: result.rows.map(formatEvent) });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Upcoming events error:', error);
    return res.status(500).json({ message: 'Failed to fetch upcoming events' });
  }
});

router.get('/recommended', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const cachedResult = await pool.query(
      `
        SELECT e.*, o.name AS org_name, rec.score
        FROM recommended_events rec
        JOIN events e ON e.id = rec.event_id
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE rec.user_id = $1
          AND e.date >= NOW()
        ORDER BY rec.score DESC NULLS LAST, e.date ASC
        LIMIT 10
      `,
      [userId]
    );

    if (cachedResult.rows.length > 0) {
      return res.json({
        events: cachedResult.rows.map((row) => ({
          ...formatEvent(row),
          aiRecommended: true,
          recommendationScore: Number(row.score) || 0,
        })),
      });
    }

    const userInterests = await fetchUserInterests(userId);

    if (userInterests.length === 0) {
      return res.json({ events: [] });
    }

    const recommendedIds = await getRecommendedEventIds(userId, 10);

    if (recommendedIds.length > 0) {
      await cacheRecommendedEventIds(userId, recommendedIds);
    }

    if (recommendedIds.length === 0) {
      return res.json({ events: [] });
    }

    const liveEvents = await fetchFormattedEventsByIds(recommendedIds);

    return res.json({
      events: liveEvents.map((event) => ({
        ...event,
        aiRecommended: true,
      })),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Recommended events error:', error);
    return res.status(500).json({ message: 'Failed to fetch recommended events' });
  }
});

router.post('/:id/view', verifyToken, viewEventValidation, validateRequest, async (req, res, next) => {
  try {
    await pool.query(
      `
        INSERT INTO user_event_views (user_id, event_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, event_id) DO NOTHING
      `,
      [req.user.userId, req.params.id]
    );

    return res.status(204).send();
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    if (error.code === '23503') {
      return res.status(404).json({ message: 'Event not found' });
    }

    console.error('Record event view error:', error);
    return res.status(500).json({ message: 'Failed to record event view' });
  }
});

router.get('/:id/analytics', verifyToken, eventAnalyticsValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await fetchEventRowById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const canManage = await canManageEvent(req.user, event);
    if (!canManage) {
      return res.status(403).json({ message: 'You do not have permission to view analytics for this event' });
    }

    const [attendanceResult, timelineResult] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status = 'confirmed')::int AS rsvp_count,
            COUNT(*) FILTER (WHERE status = 'checked_in')::int AS checked_in_count
          FROM rsvps
          WHERE event_id = $1
        `,
        [id]
      ),
      pool.query(
        `
          SELECT DATE(created_at) AS date, COUNT(*)::int AS count
          FROM rsvps
          WHERE event_id = $1
            AND status != 'cancelled'
          GROUP BY DATE(created_at)
          ORDER BY date
        `,
        [id]
      ),
    ]);

    const attendance = attendanceResult.rows[0] || { rsvp_count: 0, checked_in_count: 0 };
    const rsvpCount = Number(attendance.rsvp_count) || 0;
    const checkedInCount = Number(attendance.checked_in_count) || 0;
    const capacity = Number(event.capacity) || 0;

    return res.json({
      eventId: event.id,
      title: event.title,
      capacity,
      rsvpCount,
      checkedInCount,
      rsvpRate: formatRate(rsvpCount, capacity),
      checkInRate: formatRate(checkedInCount, rsvpCount),
      categoryBreakdown: {},
      rsvpTimeline: timelineResult.rows.map((row) => ({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
        count: Number(row.count) || 0,
      })),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Get event analytics error:', error);
    return res.status(500).json({ message: 'Failed to fetch event analytics' });
  }
});

router.delete('/:id', verifyToken, deleteEventValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await fetchEventRowById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const canManage = await canManageEvent(req.user, event);
    if (!canManage) {
      return res.status(403).json({ message: 'You do not have permission to delete this event' });
    }

    const result = await pool.query(
      `
        DELETE FROM events
        WHERE id = $1
        RETURNING id, title
      `,
      [id]
    );

    return res.json({
      message: 'Event deleted',
      event: result.rows[0],
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Delete event error:', error);
    return res.status(500).json({ message: 'Failed to delete event' });
  }
});

router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
        SELECT e.*, o.name AS org_name
        FROM events e
        LEFT JOIN organizations o ON o.id = e.organizer_id
        WHERE e.id = $1
      `,
      [id]
    );

    const event = result.rows[0];

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.json(formatEvent(event));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    if (error.code === '22P02') {
      return res.status(400).json({ message: 'Invalid event id format' });
    }

    console.error('Get event detail error:', error);
    return res.status(500).json({ message: 'Failed to fetch event details' });
  }
});

module.exports = router;
