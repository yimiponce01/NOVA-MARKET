import { Router } from 'express';
import { DemoUserRepository } from '../repositories/demoUserRepository.js';
import { AuthService } from '../services/auth.service.js';
import { AuthController } from '../controllers/auth.controller.js';
import { validateLogin } from '../validators/auth.validator.js';

const router = Router();
const controller = new AuthController(new AuthService(new DemoUserRepository()));
router.post('/login', validateLogin, controller.login);
export default router;
