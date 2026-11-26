import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/inventory.service.js';

const router = Router();
const warehouseRoles = ['ADMINISTRADOR', 'LOGISTICA_ALMACEN', 'ENCARGADO_INVENTARIO'];
const movementSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(['INGRESO', 'AJUSTE']),
  adjustment: z.enum(['POSITIVO', 'NEGATIVO']).optional(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(150),
  reference: z.string().max(50).optional().nullable(),
});

router.use(authenticate, authorize(...warehouseRoles));
router.get('/', asyncHandler(async (req, res) => ok(res, await service.listInventory(req.query), 'Inventario consultado.')));
router.get('/movimientos', asyncHandler(async (req, res) => ok(res, await service.listMovements(req.query), 'Movimientos consultados.')));
router.post('/movimientos', authorize('ADMINISTRADOR', 'ENCARGADO_INVENTARIO'), validate(movementSchema), asyncHandler(async (req, res) =>
  ok(res, await service.createMovement(req.body, { userId: req.user.sub, ip: req.ip }), 'Movimiento registrado.', 201)));
router.get('/alertas', asyncHandler(async (req, res) => ok(res, await service.listAlerts(req.query), 'Alertas consultadas.')));
router.patch('/alertas/:id/atender', asyncHandler(async (req, res) =>
  ok(res, await service.attendAlert(Number(req.params.id), { userId: req.user.sub, ip: req.ip }), 'Alerta atendida.')));
router.get('/lotes', asyncHandler(async (req, res) => ok(res, await service.listLots({ upcoming: req.query.proximosAVencer === 'true' }), 'Lotes consultados.')));

export default router;
