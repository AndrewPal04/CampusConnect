const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');

const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');
const { sendMail } = require('../services/mailer');

const CPP_EMAIL_REGEX = /^[^\s@]+@(?:cpp\.edu|broncos\.cpp\.edu)$/i;
const ALLOWED_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

const router = express.Router();

function createAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const registerValidation = [
  body('email')
    .isString()
    .withMessage('email is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 254 })
    .withMessage('email must be 254 characters or fewer')
    .bail()
    .isEmail()
    .withMessage('Invalid email format')
    .bail()
    .normalizeEmail()
    .custom((value) => CPP_EMAIL_REGEX.test(value))
    .withMessage('Email must be a @cpp.edu or @broncos.cpp.edu address'),
  body('password')
    .isString()
    .withMessage('password is required')
    .bail()
    .isLength({ min: 8, max: 200 })
    .withMessage('password must be between 8 and 200 characters'),
  body('name')
    .isString()
    .withMessage('name is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('name must be 1 to 100 characters')
    .escape(),
  body('major')
    .isString()
    .withMessage('major is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('major must be 1 to 100 characters')
    .escape(),
  body('year')
    .isString()
    .withMessage('year is required')
    .bail()
    .trim()
    .isIn(ALLOWED_YEARS)
    .withMessage(`year must be one of: ${ALLOWED_YEARS.join(', ')}`),
];

const loginValidation = [
  body('email')
    .isString()
    .withMessage('email is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 254 })
    .withMessage('email must be 254 characters or fewer')
    .bail()
    .isEmail()
    .withMessage('Invalid email format')
    .bail()
    .normalizeEmail(),
  body('password')
    .isString()
    .withMessage('password is required')
    .bail()
    .isLength({ min: 1, max: 200 })
    .withMessage('password must be 1 to 200 characters'),
];

const forgotPasswordValidation = [
  body('email')
    .isString()
    .withMessage('email is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 254 })
    .withMessage('email must be 254 characters or fewer')
    .bail()
    .isEmail()
    .withMessage('Invalid email format')
    .bail()
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('token')
    .isString()
    .withMessage('token is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('token must be 1 to 200 characters'),
  body('newPassword')
    .isString()
    .withMessage('newPassword is required')
    .bail()
    .isLength({ min: 8, max: 200 })
    .withMessage('newPassword must be between 8 and 200 characters'),
];

router.post('/register', registerValidation, validateRequest, async (req, res) => {
  const { email, password, name, major, year } = req.body ?? {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await pool.query(
      `
        INSERT INTO users (email, password_hash, name, major, year, last_login_at)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING id, email, name, role, interests
      `,
      [normalizedEmail, passwordHash, name.trim(), major.trim(), year.trim()]
    );

    const user = insertResult.rows[0];
    const token = createAuthToken(user);

    return res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists' });
    }

    console.error('Register error:', error);
    return res.status(500).json({ message: 'Failed to register user' });
  }
});

router.post('/login', loginValidation, validateRequest, async (req, res) => {
  const { email, password } = req.body ?? {};

  try {
    const userResult = await pool.query(
      `
        SELECT id, email, name, role, interests, password_hash
        FROM users
        WHERE email = $1
      `,
      [email]
    );

    const user = userResult.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const updatedLoginResult = await pool.query(
      `
        UPDATE users
        SET last_login_at = now()
        WHERE id = $1
        RETURNING id, email, name, role, interests
      `,
      [user.id]
    );

    const authUser = updatedLoginResult.rows[0] || {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      interests: user.interests || [],
    };
    const token = createAuthToken(authUser);

    return res.json({ token, user: authUser });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Failed to login' });
  }
});

router.post('/forgot-password', forgotPasswordValidation, validateRequest, async (req, res) => {
  const { email } = req.body ?? {};
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const userResult = await pool.query(
      `
        SELECT id, email
        FROM users
        WHERE lower(email) = lower($1)
      `,
      [normalizedEmail]
    );

    const user = userResult.rows[0];

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `
          INSERT INTO password_reset_tokens (user_id, token, expires_at)
          VALUES ($1, $2, now() + interval '1 hour')
        `,
        [user.id, resetToken]
      );

      const resetLink = `https://campusconnect.app/reset-password?token=${resetToken}`;
      const html = `
        <p>We received a request to reset your CampusConnect password.</p>
        <p>Use the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
      `;

      try {
        await sendMail(user.email, 'CampusConnect Password Reset', html);
      } catch (mailError) {
        console.error('Failed to send password reset email:', mailError);
      }
    }

    return res.status(200).json({ message: 'If that email exists, a reset link was sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process forgot password request' });
  }
});

router.post('/reset-password', resetPasswordValidation, validateRequest, async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  const trimmedToken = token.trim();
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token = $1
          AND used = false
          AND expires_at > now()
        FOR UPDATE
      `,
      [trimmedToken]
    );

    const tokenRecord = tokenResult.rows[0];

    if (!tokenRecord) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await client.query(
      `
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
      `,
      [passwordHash, tokenRecord.user_id]
    );

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used = true
        WHERE id = $1
      `,
      [tokenRecord.id]
    );

    await client.query('COMMIT');

    return res.status(200).json({ message: 'Password reset successfully. Please log in.' });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Reset password rollback error:', rollbackError);
      }
    }
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `
        SELECT id, email, name, major, year, role, avatar_url, interests, created_at
        FROM users
        WHERE id = $1
      `,
      [req.user.userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Failed to fetch current user' });
  }
});

module.exports = router;
