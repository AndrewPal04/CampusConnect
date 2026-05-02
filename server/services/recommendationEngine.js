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

async function getUserInterests(userId) {
  const userResult = await pool.query(
    `
      SELECT interests
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return normalizeCategoryList(userResult.rows[0]?.interests);
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
        AND COALESCE(to_jsonb(e)->>'status', '') != 'cancelled'
        AND NOT (e.id = ANY($1::uuid[]))
    `,
    [excludedEventIds]
  );

  return Number(result.rows[0]?.count) || 0;
}

async function getTrendingRecommendations({ excludedEventIds, limit }) {
  if (limit <= 0) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        e.id AS event_id,
        e.rsvp_count::numeric AS score
      FROM events e
      WHERE e.date > NOW()
        AND COALESCE(to_jsonb(e)->>'status', '') != 'cancelled'
        AND NOT (e.id = ANY($1::uuid[]))
      ORDER BY e.rsvp_count DESC, e.date ASC
      LIMIT $2
    `,
    [excludedEventIds, limit]
  );

  return result.rows.map((row) => ({
    eventId: row.event_id,
    score: Number(row.score) || 0,
  }));
}

async function getBehavioralRecommendations({
  excludedEventIds,
  rsvpCategories,
  viewedCategories,
  interests,
  limit,
}) {
  const result = await pool.query(
    `
      SELECT
        e.id AS event_id,
        (
          CASE WHEN e.category = ANY($2::text[]) THEN 3 ELSE 0 END
          + CASE WHEN e.category = ANY($3::text[]) THEN 1 ELSE 0 END
          + CASE WHEN e.category = ANY($4::text[]) THEN 1 ELSE 0 END
          + CASE WHEN e.date <= NOW() + INTERVAL '7 days' THEN 2 ELSE 0 END
          - CEIL(EXTRACT(EPOCH FROM (e.date - NOW())) / 86400.0)
        )::numeric AS score
      FROM events e
      WHERE e.date >= NOW()
        AND COALESCE(to_jsonb(e)->>'status', '') != 'cancelled'
        AND NOT (e.id = ANY($1::uuid[]))
      ORDER BY score DESC, e.rsvp_count DESC, e.date ASC
      LIMIT $5
    `,
    [excludedEventIds, rsvpCategories, viewedCategories, interests, limit]
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
  if (limit <= 0) {
    return [];
  }

  const normalizedInterests = normalizeCategoryList(interests);

  if (normalizedInterests.length === 0) {
    return getTrendingRecommendations({ excludedEventIds, limit });
  }

  const interestResult = await pool.query(
    `
      SELECT
        e.id AS event_id,
        (e.rsvp_count + 5)::numeric AS score
      FROM events e
      WHERE e.category = ANY($2::text[])
        AND e.date > NOW()
        AND COALESCE(to_jsonb(e)->>'status', '') != 'cancelled'
        AND NOT (e.id = ANY($1::uuid[]))
      ORDER BY e.rsvp_count DESC, e.date ASC
      LIMIT $3
    `,
    [excludedEventIds, normalizedInterests, limit]
  );

  const interestRecommendations = interestResult.rows.map((row) => ({
    eventId: row.event_id,
    score: Number(row.score) || 0,
  }));

  if (interestRecommendations.length >= limit) {
    return interestRecommendations;
  }

  const interestEventIds = interestRecommendations.map((entry) => entry.eventId);
  const trendingRecommendations = await getTrendingRecommendations({
    excludedEventIds: normalizeUuidList([...excludedEventIds, ...interestEventIds]),
    limit: limit - interestRecommendations.length,
  });

  return [...interestRecommendations, ...trendingRecommendations];
}

async function getRecommendedEventsWithScoresFromSignals(signals, limit) {
  const futureEventsCount = await getFutureEventCount(signals.rsvpEventIds);

  if (futureEventsCount === 0) {
    return [];
  }

  if (signals.rsvpCategories.length > 0) {
    return getBehavioralRecommendations({
      excludedEventIds: signals.rsvpEventIds,
      rsvpCategories: signals.rsvpCategories,
      viewedCategories: signals.viewedCategories,
      interests: signals.interests,
      limit,
    });
  }

  if (signals.viewCount < 3) {
    return getColdStartRecommendations({
      excludedEventIds: signals.rsvpEventIds,
      interests: signals.interests,
      limit,
    });
  }

  return getBehavioralRecommendations({
    excludedEventIds: signals.rsvpEventIds,
    rsvpCategories: [],
    viewedCategories: signals.viewedCategories,
    interests: signals.interests,
    limit,
  });
}

async function getRecommendedEventsWithScores(userId, limit = 10) {
  const safeLimit = Math.max(Math.min(Number(limit) || 10, 50), 1);
  const signals = await getUserSignals(userId);
  return getRecommendedEventsWithScoresFromSignals(signals, safeLimit);
}

async function getRecommendedEventIds(userId, limit = 10) {
  const safeLimit = Math.max(Math.min(Number(limit) || 10, 50), 1);
  const interests = await getUserInterests(userId);
  const signals = await getUserSignals(userId);
  const scored = await getRecommendedEventsWithScoresFromSignals(
    {
      ...signals,
      interests,
    },
    safeLimit
  );
  return scored.map((entry) => entry.eventId);
}

module.exports = {
  getRecommendedEventIds,
  getRecommendedEventsWithScores,
};
