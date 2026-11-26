import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { dashboardSummary } from '../services/admin.service.js';

const router = Router();
router.get('/resumen', authenticate, asyncHandler(async (_req, res) => ok(res, await dashboardSummary(), 'Resumen consultado.')));
export default router;
