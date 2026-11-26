import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL || 'http://localhost:4000/api';
const response = await fetch(`${baseUrl}/health`);
assert.equal(response.status, 200, 'API health debe responder HTTP 200');

const result = await response.json();
assert.equal(result.success, true, 'API health debe indicar success');
assert.equal(result.data.database, 'connected', 'API debe tener conexión activa a PostgreSQL');
console.log(`Smoke OK: API y PostgreSQL disponibles en ${baseUrl}`);
