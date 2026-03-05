export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
}
