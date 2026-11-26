import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../validators/validate.js';
import * as service from '../services/catalog.service.js';

const router = Router();
const managementRoles = ['ADMINISTRADOR', 'ASISTENTE_ADMINISTRATIVO', 'ENCARGADO_INVENTARIO'];
const productSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(255).optional().nullable(),
  price: z.coerce.number().positive(),
  minimumStock: z.coerce.number().int().nonnegative(),
  maximumStock: z.coerce.number().int().positive().optional().nullable(),
  initialStock: z.coerce.number().int().nonnegative().optional(),
  location: z.string().max(50).optional().nullable(),
  active: z.boolean().optional(),
});
const productUpdate = productSchema.partial();
const categorySchema = z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(150).optional().nullable(), active: z.boolean().optional() });

router.use(authenticate);
router.get('/productos', asyncHandler(async (req, res) => ok(res, await service.listProducts(req.query), 'Productos consultados.')));
router.post('/productos', authorize(...managementRoles), validate(productSchema), asyncHandler(async (req, res) =>
  ok(res, await service.createProduct(req.body, { userId: req.user.sub, ip: req.ip }), 'Producto creado.', 201)));
router.put('/productos/:id', authorize(...managementRoles), validate(productUpdate), asyncHandler(async (req, res) =>
  ok(res, await service.updateProduct(Number(req.params.id), req.body, { userId: req.user.sub, ip: req.ip }), 'Producto actualizado.')));
router.get('/categorias', asyncHandler(async (_req, res) => ok(res, await service.listCategories(), 'Categorías consultadas.')));
router.post('/categorias', authorize(...managementRoles), validate(categorySchema.omit({ active: true })), asyncHandler(async (req, res) =>
  ok(res, await service.createCategory(req.body), 'Categoría creada.', 201)));
router.put('/categorias/:id', authorize(...managementRoles), validate(categorySchema.partial()), asyncHandler(async (req, res) =>
  ok(res, await service.updateCategory(Number(req.params.id), req.body), 'Categoría actualizada.')));

export default router;
