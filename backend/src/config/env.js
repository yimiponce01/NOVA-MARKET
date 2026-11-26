import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || (process.env.DB_PASSWORD
    ? `postgresql://${encodeURIComponent(process.env.DB_USER || 'nova_user')}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'nova_market'}`
    : ''),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 5432),
  dbName: process.env.DB_NAME || 'nova_market',
  dbUser: process.env.DB_USER || 'nova_user',
  dbPassword: process.env.DB_PASSWORD || '',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean),
  backupDir: process.env.BACKUP_DIR || '',
};

export function assertRuntimeEnv() {
  if (!env.databaseUrl && !env.dbPassword) {
    throw new Error('Configura DATABASE_URL o DB_PASSWORD en el entorno del backend.');
  }
  if (!env.jwtSecret || env.jwtSecret.length < 24) {
    throw new Error('JWT_SECRET es obligatorio y debe tener al menos 24 caracteres.');
  }
}
