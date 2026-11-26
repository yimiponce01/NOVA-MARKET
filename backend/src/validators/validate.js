import { AppError } from '../utils/AppError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(new AppError('Los datos enviados no son válidos.', 422, 'VALIDATION_ERROR', result.error.flatten()));
  }
  req[source] = result.data;
  next();
};
