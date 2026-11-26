import { assertRuntimeEnv, env } from '../src/config/env.js';
import { closePool, getPool } from '../src/config/database.js';
import { seedDatabase } from '../database/seeds/seed.js';

async function main() {
  assertRuntimeEnv();
  const isLocal = env.nodeEnv.toLowerCase() !== 'production';
  if (isLocal && !process.env.DEMO_USER_PASSWORD) {
    throw new Error('DEMO_USER_PASSWORD debe definirse en backend/.env para inicializar la cuenta demo local.');
  }
  await seedDatabase(getPool(), {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    demoPassword: isLocal ? process.env.DEMO_USER_PASSWORD : undefined,
    nodeEnv: env.nodeEnv,
  });
  console.log('Datos iniciales cargados.');
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
