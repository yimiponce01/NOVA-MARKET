import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/admin.service.js';

const users = Router();
const admin = Router();
const userSchema = z.object({
  roleId: z.coerce.number().int().positive(), name: z.string().trim().min(2).max(60),
  surname: z.string().trim().min(2).max(60), dni: z.string().regex(/^\d{8}$/).optional().nullable(),
  email: z.string().email().optional().nullable(), username: z.string().trim().min(3).max(30),
  password: z.string().min(8).max(100), active: z.boolean().optional(),
});

users.use(authenticate, authorize('ADMINISTRADOR'));
users.get('/', asyncHandler(async (_req, res) => ok(res, await service.listUsers(), 'Usuarios consultados.')));
users.post('/', validate(userSchema), asyncHandler(async (req, res) =>
  ok(res, await service.createUser(req.body, { userId: req.user.sub, ip: req.ip }), 'Usuario creado.', 201)));
users.put('/:id', validate(userSchema.partial()), asyncHandler(async (req, res) =>
  ok(res, await service.updateUser(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Usuario actualizado.')));

admin.use(authenticate, authorize('ADMINISTRADOR'));
admin.get('/roles', asyncHandler(async (_req, res) => ok(res, await service.listRoles(), 'Roles consultados.')));
admin.get('/configuracion', asyncHandler(async (_req, res) => ok(res, await service.getConfiguration(), 'Configuración consultada.')));
admin.put('/configuracion', validate(z.record(z.union([z.string(), z.number()]))), asyncHandler(async (req, res) =>
  ok(res, await service.updateConfiguration(req.body, { userId: req.user.sub, ip: req.ip }), 'Configuración actualizada.')));
admin.get('/auditoria', asyncHandler(async (req, res) => ok(res, await service.listAudit(req.query), 'Auditoría consultada.')));
admin.get('/reportes/:tipo', asyncHandler(async (req, res) =>
  ok(res, await service.report(req.params.tipo, req.query, req.user.sub), 'Reporte generado.')));
admin.get('/respaldos', asyncHandler(async (_req, res) => ok(res, await service.listBackups(), 'Respaldos consultados.')));
admin.post('/respaldos', asyncHandler(async (req, res) =>
  ok(res, await service.createBackup({ userId: req.user.sub, ip: req.ip }), 'Respaldo generado.', 201)));
admin.post('/respaldos/:id/restaurar', validate(z.object({ confirmation: z.literal('RESTAURAR') })), asyncHandler(async (req, res) =>
  ok(res, await service.restoreBackup(Number(req.params.id), req.body.confirmation, { userId: req.user.sub, ip: req.ip }), 'Respaldo restaurado.')));

export { users, admin };
