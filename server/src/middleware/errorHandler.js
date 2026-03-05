export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}
