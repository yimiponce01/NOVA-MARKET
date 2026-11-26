import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/procurement.service.js';

const suppliers = Router();
const orders = Router();
const supplyRoles = ['ADMINISTRADOR', 'ASISTENTE_ADMINISTRATIVO', 'LOGISTICA_ALMACEN'];
const supplierSchema = z.object({
  ruc: z.string().regex(/^\d{11}$/), name: z.string().trim().min(2).max(120),
  address: z.string().max(150).optional().nullable(), phone: z.string().max(15).optional().nullable(),
  email: z.string().email().optional().nullable(), active: z.boolean().optional(),
});
const orderSchema = z.object({
  supplierId: z.coerce.number().int().positive(), observation: z.string().max(255).optional().nullable(),
  items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive(), price: z.coerce.number().positive() })).min(1),
});
const receptionSchema = z.object({
  observation: z.string().max(255).optional().nullable(),
  items: z.array(z.object({
    detailId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive(),
    lotNumber: z.string().max(30).optional().nullable(), expirationDate: z.string().date().optional().nullable(),
  })).min(1),
});

suppliers.use(authenticate, authorize(...supplyRoles));
suppliers.get('/', asyncHandler(async (req, res) => ok(res, await service.listSuppliers(req.query), 'Proveedores consultados.')));
suppliers.post('/', validate(supplierSchema.omit({ active: true })), asyncHandler(async (req, res) =>
  ok(res, await service.createSupplier(req.body, { userId: req.user.sub, ip: req.ip }), 'Proveedor creado.', 201)));
suppliers.put('/:id', validate(supplierSchema.partial()), asyncHandler(async (req, res) =>
  ok(res, await service.updateSupplier(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Proveedor actualizado.')));

orders.use(authenticate, authorize('ADMINISTRADOR', 'LOGISTICA_ALMACEN'));
orders.get('/', asyncHandler(async (req, res) => ok(res, await service.listOrders(req.query), 'Órdenes consultadas.')));
orders.get('/:id', asyncHandler(async (req, res) => ok(res, await service.getOrder(Number(req.params.id)), 'Orden consultada.')));
orders.post('/', validate(orderSchema), asyncHandler(async (req, res) =>
  ok(res, await service.createOrder(req.body, { userId: req.user.sub, ip: req.ip }), 'Orden creada.', 201)));
orders.patch('/:id/estado', validate(z.object({ status: z.enum(['APROBADA', 'ENVIADA', 'ANULADA']) })), asyncHandler(async (req, res) =>
  ok(res, await service.changeOrderStatus(Number(req.params.id), req.body.status, { userId: req.user.sub, ip: req.ip }), 'Estado actualizado.')));
orders.post('/:id/recepcion', validate(receptionSchema), asyncHandler(async (req, res) =>
  ok(res, await service.receiveOrder(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Recepción registrada.')));

export { suppliers, orders };
