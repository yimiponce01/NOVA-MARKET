export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({
    success: false,
    data: null,
    message: status === 500 ? 'Error interno del servidor.' : error.message,
    code: error.code || 'INTERNAL_ERROR',
    ...(error.details ? { details: error.details } : {}),
  });
}
