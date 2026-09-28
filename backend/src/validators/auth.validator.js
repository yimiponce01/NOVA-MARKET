export function validateLogin(req, res, next) {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 1) {
    return res.status(400).json({ ok: false, message: 'Ingresa un correo válido y una contraseña.' });
  }
  next();
}
