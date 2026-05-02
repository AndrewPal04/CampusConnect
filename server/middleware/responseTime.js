const SLOW_REQUEST_THRESHOLD_MS = 2000;

function formatDurationMs(durationMs) {
  const safeDuration = Number.isFinite(durationMs) ? durationMs : 0;
  return `${safeDuration}ms`;
}

function isPerfLoggedPath(reqPath, method) {
  if (reqPath === '/api/rsvp/checkin') {
    return true;
  }

  return method === 'GET' && reqPath === '/api/events';
}

function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  let durationMs;

  const originalEnd = res.end;
  res.end = function patchedEnd(...args) {
    durationMs = Number((process.hrtime.bigint() - start) / 1000000n);

    if (!res.headersSent) {
      res.setHeader('X-Response-Time', formatDurationMs(durationMs));
    }

    return originalEnd.apply(this, args);
  };

  res.on('finish', () => {
    const requestPath = req.path || req.originalUrl.split('?')[0];
    const measuredDurationMs =
      Number.isFinite(durationMs)
        ? durationMs
        : Number((process.hrtime.bigint() - start) / 1000000n);

    if (!isPerfLoggedPath(requestPath, req.method)) {
      return;
    }

    const logLine = `[PERF] ${req.method} ${requestPath} \u2014 ${formatDurationMs(measuredDurationMs)}`;

    if (measuredDurationMs > SLOW_REQUEST_THRESHOLD_MS) {
      console.warn(logLine);
      return;
    }

    console.log(logLine);
  });

  next();
}

module.exports = responseTimeMiddleware;

