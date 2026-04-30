const pool = require('../db');

const INTEREST_CATEGORIES = new Set([
  'tech',
  'music',
  'sports',
  'social',
  'art',
  'food',
  'academic',
]);

function normalizeCategoryList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => INTEREST_CATEGORIES.has(entry))
  )];
}

function normalizeUuidList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter(Boolean))];
}

async function getUserSignals(userId) {
  const [rsvpResult, viewResult, userResult] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(
            ARRAY_AGG(DISTINCT e.category) FILTER (WHERE e.category IS NOT NULL),
            ARRAY[]::text[]
          ) AS categories,
          COALESCE(
            ARRAY_AGG(DISTINCT r.event_id),
            ARRAY[]::uuid[]
          ) AS event_ids
        FROM rsvps r
        JOIN events e ON e.id = r.event_id
        WHERE r.user_id = $1
          AND r.status IN ('confirmed', 'checked_in')
      `,
      [userId]
    ),
    pool.query(
      `
        SELECT
          COUNT(*)::int AS total_views,
          COALESCE(
            ARRAY_AGG(DISTINCT e.category) FILTER (WHERE e.category IS NOT NULL),
            ARRAY[]::text[]
          ) AS categories
        FROM user_event_views v
        JOIN events e ON e.id = v.event_id
        WHERE v.user_id = $1
      `,
      [userId]
    ),
    pool.query(
      `
        SELECT interests
        FROM users
        WHERE id = $1
      `,
      [userId]
    ),
  ]);

  const rsvpRow = rsvpResult.rows[0] || {};
  const viewRow = viewResult.rows[0] || {};
  const userRow = userResult.rows[0] || {};

  return {
    rsvpCategories: normalizeCategoryList(rsvpRow.categories),
    viewedCategories: normalizeCategoryList(viewRow.categories),
    rsvpEventIds: normalizeUuidList(rsvpRow.event_ids),
    viewCount: Number(viewRow.total_views) || 0,
    interests: normalizeCategoryList(userRow.interests),
  };
}

async function getFutureEventCount(excludedEventIds) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM events e
      WHERE e.date >= NOW()
        AND NOT (e.id = ANY($1::uuid[]))
    `,
    [excludedEventIds]
  );

  return Number(result.rows[0]?.count) || 0;
}

async function getBehavioralRecommendations({
  excludedEventIds,
  rsvpCategories,
  viewedCategories,
  limit,
}) {
  const result = await pool.query(
    `
      SELECT
        e.id AS event_id,
        (
          CASE WHEN e.category = ANY($2::text[]) THEN 3 ELSE 0 END
          + CASE WHEN e.category = ANY($3::text[]) THEN 1 ELSE 0 END
          + CASE WHEN e.date <= NOW() + INTERVAL '7 days' THEN 2 ELSE 0 END
          - CEIL(EXTRACT(EPOCH FROM (e.date - NOW())) / 86400.0)
        )::numeric AS score
      FROM events e
      WHERE e.date >= NOW()
        AND NOT (e.id = ANY($1::uuid[]))
      ORDER BY score DESC, e.rsvp_count DESC, e.date ASC
      LIMIT $4
    `,
    [excludedEventIds, rsvpCategories, viewedCategories, limit]
  );

  return result.rows.map((row) => ({
    eventId: row.event_id,
    score: Number(row.score) || 0,
  }));
}

async function getColdStartRecommendations({
  excludedEventIds,
  interests,
  limit,
}) {
  const result = await pool.query(
    `
      SELECT
        e.id AS event_id,
        (
          e.rsvp_count
          + CASE WHEN e.category = ANY($2::text[]) THEN 5 ELSE 0 END
        )::numeric AS score
      FROM events e
      WHERE e.date >= NOW()
        AND NOT (e.id = ANY($1::uuid[]))
      ORDER BY score DESC, e.rsvp_count DESC, e.date ASC
      LIMIT $3
    `,
    [excludedEventIds, interests, limit]
  );

  return result.rows.map((row) => ({
    eventId: row.event_id,
    score: Number(row.score) || 0,
  }));
}

async function getRecommendedEventsWithScores(userId, limit = 10) {
  const safeLimit = Math.max(Math.min(Number(limit) || 10, 50), 1);
  const signals = await getUserSignals(userId);
  const futureEventsCount = await getFutureEventCount(signals.rsvpEventIds);

  if (futureEventsCount === 0) {
    return [];
  }

  if (signals.rsvpCategories.length > 0) {
    return getBehavioralRecommendations({
      excludedEventIds: signals.rsvpEventIds,
      rsvpCategories: signals.rsvpCategories,
      viewedCategories: signals.viewedCategories,
      limit: safeLimit,
    });
  }

  if (signals.viewCount < 3) {
    return getColdStartRecommendations({
      excludedEventIds: signals.rsvpEventIds,
      interests: signals.interests,
      limit: safeLimit,
    });
  }

  return getBehavioralRecommendations({
    excludedEventIds: signals.rsvpEventIds,
    rsvpCategories: [],
    viewedCategories: signals.viewedCategories,
    limit: safeLimit,
  });
}

async function getRecommendedEventIds(userId, limit = 10) {
  const scored = await getRecommendedEventsWithScores(userId, limit);
  return scored.map((entry) => entry.eventId);
}

module.exports = {
  getRecommendedEventIds,
  getRecommendedEventsWithScores,
};
