import pg from 'pg';
import { env } from './env.js';

let pool;

export function getPool() {
  if (!pool) {
    if (env.databaseUrl) {
      pool = new pg.Pool({ connectionString: env.databaseUrl });
    } else {
      pool = new pg.Pool({
        host: env.dbHost,
        port: env.dbPort,
        database: env.dbName,
        user: env.dbUser,
        password: env.dbPassword,
      });
    }
  }
  return pool;
}

export function setPool(nextPool) {
  pool = nextPool;
}

export function query(text, params = []) {
  return getPool().query(text, params);
}

export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool?.end) await pool.end();
  pool = undefined;
}
