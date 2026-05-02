const DB_CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', '57P01', 'XX000']);

function isDatabaseConnectionError(error) {
  const code = error?.code || error?.cause?.code;
  return DB_CONNECTION_ERROR_CODES.has(code);
}

function isEventsListRoute(req) {
  const requestPath = req.path || req.originalUrl.split('?')[0];
  return req.method === 'GET' && requestPath === '/api/events';
}

function degradationErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (isDatabaseConnectionError(err)) {
    if (isEventsListRoute(req)) {
      return res.status(200).json({
        events: [],
        degraded: true,
        message: 'Live data temporarily unavailable',
      });
    }

    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const explicitStatus = Number(err?.status || err?.statusCode);
  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600) {
    return res.status(explicitStatus).json(
      err?.payload || {
        error: err?.message || 'Request failed',
      }
    );
  }

  return next(err);
}

module.exports = degradationErrorHandler;
module.exports.isDatabaseConnectionError = isDatabaseConnectionError;
