export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({ ok: false, message: status === 500 ? 'Error interno del servidor.' : error.message });
}
