
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',

  // Dominio principal
  'https://nova-market-5zif.vercel.app',

  // Dominio de la rama main (CORREGIDO)
  'https://nova-market-5zif-git-main-nova-market5.vercel.app',

  // Deployment anterior
  'https://nova-market-5zif-9vu75bl-nova-market5.vercel.app',

  // Agrega aquí el dominio exacto del otro deployment
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('Origen bloqueado por CORS:', origin);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

app.use(errorHandler);

export default app;
