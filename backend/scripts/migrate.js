import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRuntimeEnv } from '../src/config/env.js';
import { closePool, query, transaction } from '../src/config/database.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  assertRuntimeEnv();
  await query(`CREATE TABLE IF NOT EXISTS schema_migration (
    nombre VARCHAR(160) PRIMARY KEY,
    aplicado_en TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  const directory = path.join(root, 'database/migrations');
  for (const name of (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    const exists = await query('SELECT 1 FROM schema_migration WHERE nombre = $1', [name]);
    if (exists.rowCount) continue;
    const sql = await fs.readFile(path.join(directory, name), 'utf8');
    await transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migration(nombre) VALUES ($1)', [name]);
    });
    console.log(`Aplicada: ${name}`);
  }
}

main().finally(closePool).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
