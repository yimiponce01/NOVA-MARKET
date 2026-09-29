
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',

  // Frontend principal
  'https://nova-market-5zif.vercel.app',

  // Dominio de la rama main
  'https://nova-market-5zif-git-main-nova-market5.vercel.app',

  // Deployment específico del frontend
  'https://nova-market-5zif-9vu75bl-nova-market5.vercel.app',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('Origen bloqueado por CORS:', origin);
      callback(new Error('Origen no permitido por CORS'));
    }
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: ['Content-Type', 'Authorization'],

  optionsSuccessStatus: 204,
};

// CORS debe ejecutarse antes de las rutas
app.use(cors(corsOptions));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

app.use(errorHandler);

export default app;
