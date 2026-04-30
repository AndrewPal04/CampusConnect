const cron = require('node-cron');

const pool = require('../db');
const { runScraper } = require('./cppScraper');
const { getRecommendedEventsWithScores } = require('../services/recommendationEngine');

let scraperTask = null;
let recommendationTask = null;

async function refreshRecommendationsForActiveUsers() {
  const activeUsersResult = await pool.query(
    `
      SELECT id
      FROM users
      WHERE COALESCE(last_login_at, created_at) >= NOW() - INTERVAL '30 days'
    `
  );

  const activeUsers = activeUsersResult.rows.map((row) => row.id);

  if (activeUsers.length === 0) {
    return { processedUsers: 0, totalRows: 0 };
  }

  let totalRows = 0;

  for (const userId of activeUsers) {
    const client = await pool.connect();

    try {
      const recommendations = await getRecommendedEventsWithScores(userId, 10);
      const eventIds = recommendations.map((entry) => entry.eventId);
      const scores = recommendations.map((entry) => entry.score);

      await client.query('BEGIN');
      await client.query('DELETE FROM recommended_events WHERE user_id = $1', [userId]);

      if (eventIds.length > 0) {
        await client.query(
          `
            INSERT INTO recommended_events (user_id, event_id, score, updated_at)
            SELECT $1, rec.event_id, rec.score, now()
            FROM unnest($2::uuid[], $3::numeric[]) AS rec(event_id, score)
          `,
          [userId, eventIds, scores]
        );
      }

      await client.query('COMMIT');
      totalRows += eventIds.length;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[Recommendations] Failed to refresh for user ${userId}:`, error);
    } finally {
      client.release();
    }
  }

  return { processedUsers: activeUsers.length, totalRows };
}

function startScraperScheduler() {
  if (scraperTask && recommendationTask) {
    return { scraperTask, recommendationTask };
  }

  scraperTask = cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await runScraper();
      console.log(`[CPP scraper] Completed (${result.source}). Upserted ${result.upsertedCount} events.`);
    } catch (error) {
      console.error('[CPP scraper] Scheduled run failed:', error);
    }
  });

  recommendationTask = cron.schedule('0 2 * * *', async () => {
    try {
      const result = await refreshRecommendationsForActiveUsers();
      console.log(
        `[Recommendations] Refreshed for ${result.processedUsers} active users. Cached ${result.totalRows} rows.`
      );
    } catch (error) {
      console.error('[Recommendations] Scheduled refresh failed:', error);
    }
  });

  console.log('[CPP scraper] Scheduler started (runs every 6 hours).');
  console.log('[Recommendations] Scheduler started (runs every 24 hours).');

  return { scraperTask, recommendationTask };
}

module.exports = { startScraperScheduler };
