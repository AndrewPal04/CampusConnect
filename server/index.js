require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const rsvpRoutes = require('./routes/rsvp');
const userRoutes = require('./routes/users');
const orgRoutes = require('./routes/orgs');
const adminRoutes = require('./routes/admin');
const responseTimeMiddleware = require('./middleware/responseTime');
const degradationErrorHandler = require('./middleware/degradation');
const { startScraperScheduler } = require('./scrapers/scheduler');

const app = express();
const PORT = process.env.PORT || 4000;
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(responseTimeMiddleware);
app.use('/api', apiRateLimiter);

app.get('/api/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  let timeoutId = null;

  try {
    const dbProbePromise = pool.query('SELECT 1');
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error('Database health probe timed out');
        timeoutError.code = 'HEALTHCHECK_TIMEOUT';
        reject(timeoutError);
      }, 2000);
    });

    await Promise.race([dbProbePromise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp,
      db: 'connected',
    });
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    console.warn('Health check degraded:', error?.message || error);

    return res.status(200).json({
      status: 'degraded',
      uptime: process.uptime(),
      timestamp,
      db: 'disconnected',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/admin', adminRoutes);
app.use(degradationErrorHandler);
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Unhandled request error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScraperScheduler();
});
