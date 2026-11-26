import { Router } from 'express';
import { UserRepository } from '../repositories/user.repository.js';
import { AuthService } from '../services/auth.service.js';
import { AuthController } from '../controllers/auth.controller.js';
import { validateLogin } from '../validators/auth.validator.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();
const controller = new AuthController(new AuthService(new UserRepository()));
router.post('/login', validateLogin, controller.login);
router.get('/me', authenticate, controller.me);
export default router;
