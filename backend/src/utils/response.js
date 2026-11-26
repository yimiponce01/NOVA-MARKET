export function ok(res, data, message = 'Operación realizada correctamente.', status = 200) {
  return res.status(status).json({ success: true, data, message });
}
