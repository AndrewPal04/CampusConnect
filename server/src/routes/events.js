import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
// import * as eventController from '../controllers/events.js';

const router = Router();

// GET  /api/events          — list events (paginated, filtered)
// GET  /api/events/:id      — get single event
// POST /api/events          — create event (organiser only)
// PUT  /api/events/:id      — update event (organiser only)
// DEL  /api/events/:id      — cancel event (organiser only)

router.get('/',    /* eventController.list   */ (req, res) => res.json({ events: [], message: 'TODO' }));
router.get('/:id', /* eventController.getOne */ (req, res) => res.json({ event: null, message: 'TODO' }));
router.post('/',   requireAuth, /* eventController.create */ (req, res) => res.status(201).json({ message: 'TODO' }));
router.put('/:id', requireAuth, /* eventController.update */ (req, res) => res.json({ message: 'TODO' }));
router.delete('/:id', requireAuth, /* eventController.cancel */ (req, res) => res.json({ message: 'TODO' }));

export default router;
