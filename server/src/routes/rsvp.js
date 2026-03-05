import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/rsvp/:eventId       — RSVP to event
// DEL  /api/rsvp/:eventId       — cancel RSVP
// POST /api/rsvp/:eventId/checkin — check in attendee (organiser)

router.post('/:eventId',         requireAuth, (req, res) => res.status(201).json({ message: 'TODO' }));
router.delete('/:eventId',       requireAuth, (req, res) => res.json({ message: 'TODO' }));
router.post('/:eventId/checkin', requireAuth, (req, res) => res.json({ message: 'TODO' }));

export default router;
