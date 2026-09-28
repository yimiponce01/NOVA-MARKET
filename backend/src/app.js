import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use(errorHandler);
export default app;
