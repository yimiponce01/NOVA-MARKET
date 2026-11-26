import { z } from 'zod';
import { validate } from './validate.js';

const loginSchema = z.object({
  login: z.string().trim().min(3).max(100),
  // Login accepts the locally seeded demo credential; password policy is enforced on account creation.
  password: z.string().min(1).max(100),
});

export const validateLogin = validate(loginSchema);
