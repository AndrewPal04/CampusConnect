const express = require('express');
const { body } = require('express-validator');

const pool = require('../db');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validation');

const router = express.Router();

const verifyRequestValidation = [
  body('orgName')
    .isString()
    .withMessage('orgName is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('orgName must be 1 to 100 characters')
    .escape(),
  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('description must be a string')
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('description must be 500 characters or fewer')
    .escape(),
  body('proofLink')
    .customSanitizer((value, { req }) => value ?? req.body?.proofDocumentLink ?? null)
    .optional({ checkFalsy: true, nullable: true })
    .isString()
    .withMessage('proofLink must be a string')
    .bail()
    .trim()
    .isLength({ max: 2048 })
    .withMessage('proofLink must be 2048 characters or fewer')
    .bail()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage('proofLink must be a valid http/https URL'),
];

router.post('/verify-request', verifyToken, verifyRequestValidation, validateRequest, async (req, res) => {
  const { orgName } = req.body ?? {};
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
  const proofLink = typeof req.body?.proofLink === 'string' ? req.body.proofLink.trim() : null;

  if (req.user.role !== 'org_leader') {
    return res.status(403).json({ message: 'Only organization leaders can submit verification requests' });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO verification_requests (org_name, description, proof_url, submitted_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [orgName, description || null, proofLink || null, req.user.userId]
    );

    return res.status(201).json({
      message: 'Verification request submitted',
      requestId: result.rows[0].id,
    });
  } catch (error) {
    console.error('Submit org verification request error:', error);
    return res.status(500).json({ message: 'Failed to submit verification request' });
  }
});

module.exports = router;
