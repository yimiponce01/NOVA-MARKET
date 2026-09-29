
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://nova-market-5zif.vercel.app',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

app.use(errorHandler);

export default app;
