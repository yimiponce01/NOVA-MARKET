import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new AppError('Se requiere autenticación.', 401, 'AUTH_REQUIRED'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new AppError('La sesión es inválida o expiró.', 401, 'INVALID_TOKEN'));
  }
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(new AppError('No tienes permiso para realizar esta operación.', 403, 'FORBIDDEN'));
  }
  next();
};
