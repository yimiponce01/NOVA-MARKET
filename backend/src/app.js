
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import cashRoutes from './routes/cash.routes.js';
import { sales, receipts } from './routes/sales.routes.js';
import { suppliers, orders } from './routes/procurement.routes.js';
import { users, admin } from './routes/admin.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { env } from './config/env.js';

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '200kb' }));

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', catalogRoutes);
app.use('/api/inventario', inventoryRoutes);
app.use('/api/caja', cashRoutes);
app.use('/api/ventas', sales);
app.use('/api/comprobantes', receipts);
app.use('/api/proveedores', suppliers);
app.use('/api/ordenes-compra', orders);
app.use('/api/usuarios', users);
app.use('/api', admin);

app.use(notFound);
app.use(errorHandler);

export default app;
