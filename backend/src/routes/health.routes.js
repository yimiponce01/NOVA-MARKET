import { Router } from 'express';
import { query } from '../config/database.js';
const router = Router();
router.get('/', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({
      success: true,
      data: { service: 'NOVA MARKET API', status: 'running', database: 'connected' },
      message: 'Servicio y base de datos disponibles.',
    });
  } catch {
    return res.status(503).json({
      success: false,
      data: { service: 'NOVA MARKET API', status: 'running', database: 'unavailable' },
      message: 'La API está activa, pero no puede conectarse a la base de datos.',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
});
export default router;
