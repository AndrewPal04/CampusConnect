const express = require('express');
const { body, param } = require('express-validator');

const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const { isDatabaseConnectionError } = require('../middleware/degradation');

const router = express.Router();

const USER_ROLES = ['student', 'org_leader', 'admin'];
const VERIFICATION_STATUSES = ['approved', 'denied'];
const uuidParamValidation = [param('id').isUUID().withMessage('Invalid id format')];
const updateOrgValidation = [
  param('id').isUUID().withMessage('Invalid verification request id format'),
  body('status')
    .isString()
    .withMessage('status is required')
    .bail()
    .trim()
    .isIn(VERIFICATION_STATUSES)
    .withMessage('status must be approved or denied'),
];
const updateUserRoleValidation = [
  param('id').isUUID().withMessage('Invalid user id format'),
  body('role')
    .isString()
    .withMessage('role is required')
    .bail()
    .trim()
    .isIn(USER_ROLES)
    .withMessage('role must be student, org_leader, or admin'),
];

function ensureAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  return next();
}

router.use(verifyToken, ensureAdmin);

router.get('/events', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          e.id,
          e.title,
          e.date,
          e.source,
          e.category
        FROM events e
        ORDER BY e.date DESC
      `
    );

    return res.json({ events: result.rows });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin list events error:', error);
    return res.status(500).json({ message: 'Failed to fetch admin events' });
  }
});

router.get('/analytics/summary', async (req, res, next) => {
  try {
    const [totalsResult, categoriesResult] = await Promise.all([
      pool.query(
        `
          SELECT
            (SELECT COUNT(*)::int FROM events) AS total_events,
            (SELECT COUNT(*)::int FROM users) AS total_users,
            (SELECT COUNT(*)::int FROM rsvps WHERE status != 'cancelled') AS total_rsvps,
            (SELECT COUNT(*)::int FROM rsvps WHERE status = 'checked_in') AS total_check_ins,
            (SELECT COUNT(*)::int FROM events WHERE date >= NOW()) AS upcoming_events_count,
            (SELECT COUNT(*)::int FROM events WHERE source = 'scraped') AS scraped_events_count
        `
      ),
      pool.query(
        `
          SELECT
            COALESCE(NULLIF(TRIM(e.category), ''), 'uncategorized') AS category,
            COUNT(*)::int AS count
          FROM rsvps r
          JOIN events e ON e.id = r.event_id
          WHERE r.status != 'cancelled'
          GROUP BY COALESCE(NULLIF(TRIM(e.category), ''), 'uncategorized')
          ORDER BY count DESC, category ASC
          LIMIT 5
        `
      ),
    ]);

    const totals = totalsResult.rows[0] || {};

    return res.json({
      totalEvents: Number(totals.total_events) || 0,
      totalUsers: Number(totals.total_users) || 0,
      totalRsvps: Number(totals.total_rsvps) || 0,
      totalCheckIns: Number(totals.total_check_ins) || 0,
      topCategories: categoriesResult.rows.map((row) => ({
        category: row.category,
        count: Number(row.count) || 0,
      })),
      upcomingEventsCount: Number(totals.upcoming_events_count) || 0,
      scrapedEventsCount: Number(totals.scraped_events_count) || 0,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin analytics summary error:', error);
    return res.status(500).json({ message: 'Failed to fetch admin analytics summary' });
  }
});

router.delete('/events/:id', uuidParamValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
        DELETE FROM events
        WHERE id = $1
        RETURNING id, title
      `,
      [id]
    );

    const deletedEvent = result.rows[0];
    if (!deletedEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.json({
      message: 'Event deleted',
      event: deletedEvent,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin delete event error:', error);
    return res.status(500).json({ message: 'Failed to delete event' });
  }
});

router.get('/orgs', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          vr.id,
          vr.org_name,
          vr.description,
          vr.proof_url,
          vr.status,
          vr.submitted_by,
          vr.reviewed_by,
          vr.reviewed_at,
          vr.created_at,
          submitter.name AS submitter_name,
          submitter.email AS submitter_email,
          reviewer.name AS reviewer_name,
          reviewer.email AS reviewer_email
        FROM verification_requests vr
        LEFT JOIN users submitter ON submitter.id = vr.submitted_by
        LEFT JOIN users reviewer ON reviewer.id = vr.reviewed_by
        ORDER BY vr.created_at DESC
      `
    );

    return res.json({ orgs: result.rows });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin list organizations error:', error);
    return res.status(500).json({ message: 'Failed to fetch organizations' });
  }
});

router.patch('/orgs/:id', updateOrgValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body ?? {};
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateRequestResult = await client.query(
      `
        UPDATE verification_requests
        SET
          status = $2,
          reviewed_by = $3,
          reviewed_at = now()
        WHERE id = $1
        RETURNING id, submitted_by, org_name
      `,
      [id, status, req.user.userId]
    );

    const updatedRequest = updateRequestResult.rows[0];
    if (!updatedRequest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Verification request not found' });
    }

    let verifiedOrganizations = 0;

    if (status === 'approved') {
      const markVerifiedResult = await client.query(
        `
          UPDATE organizations
          SET verified = true
          WHERE owner_id = $1
            AND lower(trim(name)) = lower(trim($2))
        `,
        [updatedRequest.submitted_by, updatedRequest.org_name]
      );

      verifiedOrganizations = markVerifiedResult.rowCount ?? 0;
    }

    const hydratedRequestResult = await client.query(
      `
        SELECT
          vr.id,
          vr.org_name,
          vr.description,
          vr.proof_url,
          vr.status,
          vr.submitted_by,
          vr.reviewed_by,
          vr.reviewed_at,
          vr.created_at,
          submitter.name AS submitter_name,
          submitter.email AS submitter_email,
          reviewer.name AS reviewer_name,
          reviewer.email AS reviewer_email
        FROM verification_requests vr
        LEFT JOIN users submitter ON submitter.id = vr.submitted_by
        LEFT JOIN users reviewer ON reviewer.id = vr.reviewed_by
        WHERE vr.id = $1
      `,
      [id]
    );

    await client.query('COMMIT');

    return res.json({
      message: `Verification request ${status}`,
      request: hydratedRequestResult.rows[0],
      verifiedOrganizations,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Admin update organization rollback error:', rollbackError);
    }

    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin update organization error:', error);
    return res.status(500).json({ message: 'Failed to update organization verification' });
  } finally {
    client.release();
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          email,
          name,
          major,
          year,
          role,
          created_at
        FROM users
        ORDER BY created_at DESC
      `
    );

    return res.json({ users: result.rows });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin list users error:', error);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.patch('/users/:id', updateUserRoleValidation, validateRequest, async (req, res, next) => {
  const { id } = req.params;
  const role = req.body.role;

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET role = $2
        WHERE id = $1
        RETURNING id, email, name, major, year, role, created_at
      `,
      [id, role]
    );

    const updatedUser = result.rows[0];
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      message: 'User role updated',
      user: updatedUser,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Admin update user role error:', error);
    return res.status(500).json({ message: 'Failed to update user role' });
  }
});

module.exports = router;
