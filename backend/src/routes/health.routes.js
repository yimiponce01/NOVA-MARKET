import { Router } from 'express';
const router = Router();
router.get('/', (_req, res) => res.json({ ok: true, service: 'NOVA MARKET API', status: 'running' }));
export default router;
