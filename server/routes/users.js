const express = require('express');
const { body, param } = require('express-validator');

const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const { isDatabaseConnectionError } = require('../middleware/degradation');

const router = express.Router();

router.use(verifyToken);

const ALLOWED_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
const NOTIFICATION_PREFERENCE_KEYS = [
  'rsvp_confirm',
  'rsvp_cancel',
  'event_reminder',
  'event_update',
  'quiet_hours_start',
  'quiet_hours_end',
];
const NOTIFICATION_BOOLEAN_KEYS = [
  'rsvp_confirm',
  'rsvp_cancel',
  'event_reminder',
  'event_update',
];
const DEFAULT_NOTIFICATION_PREFERENCES = {
  rsvp_confirm: true,
  rsvp_cancel: true,
  event_reminder: true,
  event_update: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};
const ALLOWED_INTEREST_CATEGORIES = [
  'tech',
  'music',
  'sports',
  'social',
  'art',
  'food',
  'academic',
];
const QUIET_HOUR_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    eventId: row.event_id,
    createdAt: row.created_at,
  };
}

function hasOwnProperty(target, key) {
  return Object.prototype.hasOwnProperty.call(target || {}, key);
}

function validateEmptyBody(value) {
  if (value === undefined) {
    return true;
  }

  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Request body must be an object');
  }

  if (Object.keys(value).length > 0) {
    throw new Error('This endpoint does not accept a request body');
  }

  return true;
}

function normalizeQuietHoursValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

const profileUpdateValidation = [
  body().custom((value) => {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new Error('Request body must be an object');
    }

    const allowedFields = ['name', 'major', 'year', 'avatar_url'];
    const hasUpdatableField = allowedFields.some((field) => hasOwnProperty(value, field));

    if (!hasUpdatableField) {
      throw new Error('Provide at least one field to update: name, major, year, avatar_url');
    }

    return true;
  }),
  body('name')
    .optional()
    .isString()
    .withMessage('name must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('name must be 1 to 100 characters')
    .escape(),
  body('major')
    .optional()
    .isString()
    .withMessage('major must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('major must be 1 to 100 characters')
    .escape(),
  body('year')
    .optional()
    .isString()
    .withMessage('year must be a string')
    .bail()
    .trim()
    .isIn(ALLOWED_YEARS)
    .withMessage(`year must be one of: ${ALLOWED_YEARS.join(', ')}`),
  body('avatar_url')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('avatar_url must be a string or null')
    .bail()
    .customSanitizer((value) => {
      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    })
    .custom((value) => value === null || value.length <= 2048)
    .withMessage('avatar_url must be 2048 characters or fewer')
    .bail()
    .custom((value) => {
      if (value === null) {
        return true;
      }

      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (error) {
        return false;
      }
    })
    .withMessage('avatar_url must be a valid http/https URL'),
];

const readAllNotificationsValidation = [body().custom(validateEmptyBody)];
const markNotificationReadValidation = [
  param('id').isUUID().withMessage('Invalid notification id format'),
  body().custom(validateEmptyBody),
];
const notificationPreferencesUpdateValidation = [
  body().custom((value) => {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new Error('Request body must be an object');
    }

    const keys = Object.keys(value);
    if (keys.length === 0) {
      throw new Error(
        `Provide at least one field to update: ${NOTIFICATION_PREFERENCE_KEYS.join(', ')}`
      );
    }

    const invalidKeys = keys.filter((key) => !NOTIFICATION_PREFERENCE_KEYS.includes(key));
    if (invalidKeys.length > 0) {
      throw new Error(
        `Unsupported notification preference fields: ${invalidKeys.join(', ')}`
      );
    }

    return true;
  }),
  ...NOTIFICATION_BOOLEAN_KEYS.map((key) =>
    body(key)
      .optional()
      .isBoolean()
      .withMessage(`${key} must be a boolean`)
      .bail()
      .toBoolean()
  ),
  body('quiet_hours_start')
    .optional({ nullable: true })
    .customSanitizer(normalizeQuietHoursValue)
    .custom((value) => value === null || QUIET_HOUR_PATTERN.test(value))
    .withMessage('quiet_hours_start must be null or use HH:MM 24-hour format'),
  body('quiet_hours_end')
    .optional({ nullable: true })
    .customSanitizer(normalizeQuietHoursValue)
    .custom((value) => value === null || QUIET_HOUR_PATTERN.test(value))
    .withMessage('quiet_hours_end must be null or use HH:MM 24-hour format'),
];
const pushTokenValidation = [
  body('token')
    .isString()
    .withMessage('token is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('token must be 1 to 2048 characters'),
];
const interestsValidation = [
  body('categories')
    .isArray({ min: 1, max: 3 })
    .withMessage('categories must be an array with 1 to 3 items'),
  body('categories.*')
    .isString()
    .withMessage('each category must be a string')
    .bail()
    .trim()
    .toLowerCase()
    .isIn(ALLOWED_INTEREST_CATEGORIES)
    .withMessage(`categories must be one of: ${ALLOWED_INTEREST_CATEGORIES.join(', ')}`),
  body('categories').custom((categories) => {
    const unique = new Set((categories || []).map((entry) => String(entry).trim().toLowerCase()));

    if (unique.size !== categories.length) {
      throw new Error('categories must not include duplicates');
    }

    return true;
  }),
];

router.patch('/me', profileUpdateValidation, validateRequest, async (req, res, next) => {
  const bodyPayload = req.body ?? {};
  const hasName = hasOwnProperty(bodyPayload, 'name');
  const hasMajor = hasOwnProperty(bodyPayload, 'major');
  const hasYear = hasOwnProperty(bodyPayload, 'year');
  const hasAvatarUrl = hasOwnProperty(bodyPayload, 'avatar_url');

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET
          name = CASE WHEN $1::boolean THEN $2 ELSE name END,
          major = CASE WHEN $3::boolean THEN $4 ELSE major END,
          year = CASE WHEN $5::boolean THEN $6 ELSE year END,
          avatar_url = CASE WHEN $7::boolean THEN $8 ELSE avatar_url END
        WHERE id = $9
        RETURNING id, email, name, major, year, role, avatar_url, created_at
      `,
      [
        hasName,
        hasName ? bodyPayload.name : null,
        hasMajor,
        hasMajor ? bodyPayload.major : null,
        hasYear,
        hasYear ? bodyPayload.year : null,
        hasAvatarUrl,
        hasAvatarUrl ? bodyPayload.avatar_url : null,
        req.user.userId,
      ]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

router.post('/interests', interestsValidation, validateRequest, async (req, res, next) => {
  const categories = (req.body.categories || []).map((entry) => String(entry).trim().toLowerCase());

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET interests = $1::jsonb
        WHERE id = $2
        RETURNING interests
      `,
      [JSON.stringify(categories), req.user.userId]
    );

    const updatedUser = result.rows[0];
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      interests: Array.isArray(updatedUser.interests) ? updatedUser.interests : [],
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Update interests error:', error);
    return res.status(500).json({ message: 'Failed to update interests' });
  }
});

router.get('/notification-preferences', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT COALESCE(notification_preferences, $2::jsonb) AS notification_preferences
        FROM users
        WHERE id = $1
      `,
      [req.user.userId, JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES)]
    );

    const userRow = result.rows[0];
    if (!userRow) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(userRow.notification_preferences || {}),
      },
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Get notification preferences error:', error);
    return res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
});

router.patch(
  '/notification-preferences',
  notificationPreferencesUpdateValidation,
  validateRequest,
  async (req, res, next) => {
    const updates = {};
    NOTIFICATION_PREFERENCE_KEYS.forEach((key) => {
      if (hasOwnProperty(req.body, key)) {
        updates[key] = req.body[key];
      }
    });

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET notification_preferences = COALESCE(notification_preferences, $1::jsonb) || $2::jsonb
          WHERE id = $3
          RETURNING notification_preferences
        `,
        [
          JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES),
          JSON.stringify(updates),
          req.user.userId,
        ]
      );

      const userRow = result.rows[0];
      if (!userRow) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.json({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(userRow.notification_preferences || {}),
        },
      });
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        return next(error);
      }

      console.error('Update notification preferences error:', error);
      return res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  }
);

router.post('/push-token', pushTokenValidation, validateRequest, async (req, res, next) => {
  const { token } = req.body ?? {};

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET push_token = $1
        WHERE id = $2
        RETURNING id
      `,
      [token.trim(), req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Update push token error:', error);
    return res.status(500).json({ message: 'Failed to update push token' });
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, type, title, body, read, event_id, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.user.userId]
    );

    return res.json({
      notifications: result.rows.map(mapNotification),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return next(error);
    }

    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.patch(
  '/notifications/read-all',
  readAllNotificationsValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `
          UPDATE notifications
          SET read = true
          WHERE user_id = $1
            AND read = false
        `,
        [req.user.userId]
      );

      return res.json({
        updated: result.rowCount ?? 0,
      });
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        return next(error);
      }

      console.error('Mark all notifications read error:', error);
      return res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
  }
);

router.patch(
  '/notifications/:id/read',
  markNotificationReadValidation,
  validateRequest,
  async (req, res, next) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `
          UPDATE notifications
          SET read = true
          WHERE id = $1
            AND user_id = $2
          RETURNING id, type, title, body, read, event_id, created_at
        `,
        [id, req.user.userId]
      );

      const notification = result.rows[0];

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      return res.json({
        notification: mapNotification(notification),
      });
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        return next(error);
      }

      console.error('Mark notification read error:', error);
      return res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  }
);

module.exports = router;
