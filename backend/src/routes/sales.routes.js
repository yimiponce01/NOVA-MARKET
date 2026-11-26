import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/sales.service.js';

const sales = Router();
const receipts = Router();
const itemSchema = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() });
const paymentSchema = z.object({
  method: z.enum(['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN']),
  amount: z.coerce.number().positive(),
  receivedAmount: z.coerce.number().positive().optional().nullable(),
  reference: z.string().max(60).optional().nullable(),
});
const clientSchema = z.object({
  name: z.string().trim().min(2).max(100), surname: z.string().max(60).optional(),
  dni: z.string().regex(/^\d{8}$/).optional(), ruc: z.string().regex(/^\d{11}$/).optional(),
  address: z.string().max(150).optional(), email: z.string().email().optional(),
});
const receiptSchema = z.object({ saleId: z.coerce.number().int().positive(), type: z.enum(['BOLETA', 'FACTURA']), client: clientSchema.optional().nullable() });

sales.use(authenticate, authorize('CAJERO'));
sales.post('/', validate(z.object({ cashRegisterId: z.coerce.number().int().positive() })), asyncHandler(async (req, res) =>
  ok(res, await service.createSale(req.body, { userId: req.user.sub, ip: req.ip }), 'Venta iniciada.', 201)));
sales.get('/:id', asyncHandler(async (req, res) => ok(res, await service.getSale(Number(req.params.id), req.user.sub), 'Venta consultada.')));
sales.post('/:id/items', validate(itemSchema), asyncHandler(async (req, res) =>
  ok(res, await service.setSaleItem(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Producto actualizado en la venta.')));
sales.delete('/:id/items/:detailId', asyncHandler(async (req, res) =>
  ok(res, await service.removeSaleItem(Number(req.params.id), Number(req.params.detailId), { userId: req.user.sub, ip: req.ip }), 'Producto retirado.')));
sales.post('/:id/pagos', validate(paymentSchema), asyncHandler(async (req, res) =>
  ok(res, await service.addPayment(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Pago registrado.', 201)));
sales.post('/:id/confirmar', asyncHandler(async (req, res) =>
  ok(res, await service.confirmSale(Number(req.params.id), { userId: req.user.sub, ip: req.ip }), 'Venta confirmada.')));
sales.post('/:id/anular', asyncHandler(async (req, res) =>
  ok(res, await service.cancelSale(Number(req.params.id), { userId: req.user.sub, ip: req.ip }), 'Venta anulada.')));

receipts.use(authenticate);
receipts.post('/', authorize('CAJERO'), validate(receiptSchema), asyncHandler(async (req, res) =>
  ok(res, await service.issueReceipt(req.body, { userId: req.user.sub, ip: req.ip }), 'Comprobante generado localmente.', 201)));
receipts.get('/', asyncHandler(async (req, res) => ok(res, await service.listReceipts(req.query), 'Comprobantes consultados.')));
receipts.get('/:id', asyncHandler(async (req, res) => ok(res, await service.getReceipt(Number(req.params.id)), 'Comprobante consultado.')));

export { sales, receipts };
