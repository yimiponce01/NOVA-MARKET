import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/cash.service.js';

const router = Router();
const openSchema = z.object({ cashRegisterId: z.coerce.number().int().positive(), initialAmount: z.coerce.number().nonnegative() });
const closeSchema = z.object({ cashRegisterId: z.coerce.number().int().positive(), countedAmount: z.coerce.number().nonnegative(), observation: z.string().max(255).optional().nullable() });

router.use(authenticate);
router.get('/estado', authorize('CAJERO', 'ADMINISTRADOR'), asyncHandler(async (req, res) =>
  ok(res, await service.getCashState(req.user.sub), 'Estado de caja consultado.')));
router.post('/apertura', authorize('CAJERO'), validate(openSchema), asyncHandler(async (req, res) =>
  ok(res, await service.openCash(req.body, { userId: req.user.sub, ip: req.ip }), 'Caja abierta.', 201)));
router.post('/cierre', authorize('CAJERO'), validate(closeSchema), asyncHandler(async (req, res) =>
  ok(res, await service.closeCash(req.body, { userId: req.user.sub, ip: req.ip }), 'Caja cerrada.')));
router.get('/cierres', authorize('ADMINISTRADOR'), asyncHandler(async (req, res) =>
  ok(res, await service.listClosures(req.query), 'Cierres consultados.')));
router.get('/cierres/:id', authorize('ADMINISTRADOR'), asyncHandler(async (req, res) =>
  ok(res, await service.getShiftSummary(Number(req.params.id)), 'Cierre consultado.')));

export default router;
