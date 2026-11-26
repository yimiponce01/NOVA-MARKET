import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { newDb } from 'pg-mem';
import request from 'supertest';

let app;
let pool;
let tokens;
let ids;
let seedDatabase;
const demoPassword = String.fromCharCode(121, 105, 109, 105, 49, 50, 51);

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  process.env.JWT_SECRET = 'nova-market-test-secret-with-32-characters';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.PAYMENT_GATEWAY_ENABLED = 'true';
  process.env.SUNAT_ENABLED = 'true';
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  pool = new adapter.Pool();
  await pool.query(await fs.readFile(new URL('../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
  const database = await import('../src/config/database.js');
  database.setPool(pool);
  ({ seedDatabase } = await import('../src/services/seed.service.js'));
  await seedDatabase(pool, { adminPassword: 'NovaTest123!', demoPassword, nodeEnv: 'test' });
  app = (await import('../src/app.js')).default;

  async function login(login) {
    const response = await request(app).post('/api/auth/login').send({ login, password: 'NovaTest123!' });
    assert.equal(response.status, 200);
    return response.body.data.token;
  }
  tokens = {
    admin: await login('admin'),
    cashier: await login('mlopez'),
    warehouse: await login('lperez'),
    inventory: await login('jtorres'),
  };
  ids = {
    rice: (await pool.query(`SELECT id_producto FROM producto WHERE codigo_barra='7750000000123'`)).rows[0].id_producto,
    oil: (await pool.query(`SELECT id_producto FROM producto WHERE codigo_barra='7750000000789'`)).rows[0].id_producto,
    supplier: (await pool.query(`SELECT id_proveedor FROM proveedor LIMIT 1`)).rows[0].id_proveedor,
  };
});

after(async () => pool?.end());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('health usa el contrato uniforme', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'running');
  assert.equal(response.body.data.database, 'connected');
});

test('login rechaza credenciales incorrectas y protege rutas', async () => {
  const invalid = await request(app).post('/api/auth/login').send({ login: 'admin', password: 'Incorrecta1!' });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, 'INVALID_CREDENTIALS');
  const protectedResponse = await request(app).get('/api/productos');
  assert.equal(protectedResponse.status, 401);
});

test('autorización por rol se aplica en backend', async () => {
  const response = await request(app).get('/api/usuarios').set(auth(tokens.cashier));
  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'FORBIDDEN');
});

test('cuenta local yimi se autentica con hash y recibe permisos administrativos', async () => {
  const response = await request(app).post('/api/auth/login').send({ login: 'yimi', password: demoPassword });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.usuario, 'yimi');
  assert.equal(response.body.data.user.rol, 'ADMINISTRADOR');
  assert.equal(Object.hasOwn(response.body.data.user, 'contrasena_hash'), false);
  const stored = await pool.query('SELECT contrasena_hash FROM usuario WHERE usuario=$1', ['yimi']);
  assert.notEqual(stored.rows[0].contrasena_hash, demoPassword);
  assert.match(stored.rows[0].contrasena_hash, /^\$2[aby]\$/);
  const protectedResponse = await request(app).get('/api/usuarios').set(auth(response.body.data.token));
  assert.equal(protectedResponse.status, 200);
  await pool.query(`UPDATE usuario SET nombre='Perfil anterior',apellido='Local',estado='INACTIVO' WHERE usuario=$1`, ['yimi']);
  await seedDatabase(pool, { adminPassword: 'NovaTest123!', demoPassword, nodeEnv: 'test' });
  const repaired = await pool.query('SELECT nombre,apellido,estado FROM usuario WHERE usuario=$1', ['yimi']);
  assert.equal(repaired.rowCount, 1);
  assert.equal(repaired.rows[0].nombre, 'Usuario Demo');
  assert.equal(repaired.rows[0].apellido, 'Local');
  assert.equal(repaired.rows[0].estado, 'ACTIVO');
});

test('seed no crea la cuenta demo en producción', async () => {
  await pool.query('DELETE FROM usuario WHERE usuario=$1', ['yimi']);
  await seedDatabase(pool, { adminPassword: 'NovaTest123!', demoPassword, nodeEnv: 'Production' });
  assert.equal((await pool.query('SELECT count(*)::int AS total FROM usuario WHERE usuario=$1', ['yimi'])).rows[0].total, 0);
  await seedDatabase(pool, { adminPassword: 'NovaTest123!', demoPassword, nodeEnv: 'test' });
  assert.equal((await pool.query('SELECT count(*)::int AS total FROM usuario WHERE usuario=$1', ['yimi'])).rows[0].total, 1);
});

test('alta de usuario persiste bcrypt en PostgreSQL y permite iniciar sesión', async () => {
  const created = await request(app).post('/api/usuarios').set(auth(tokens.admin)).send({
    roleId: 2, name: 'Prueba', surname: 'Local', username: 'alta-prueba', password: 'StrongTest123!',
  });
  assert.equal(created.status, 201);
  assert.equal(Object.hasOwn(created.body.data, 'contrasena_hash'), false);
  const stored = await pool.query('SELECT contrasena_hash FROM usuario WHERE usuario=$1', ['alta-prueba']);
  assert.notEqual(stored.rows[0].contrasena_hash, 'StrongTest123!');
  assert.match(stored.rows[0].contrasena_hash, /^\$2[aby]\$/);
  const login = await request(app).post('/api/auth/login').send({ login: 'alta-prueba', password: 'StrongTest123!' });
  assert.equal(login.status, 200);
});

test('categorías y productos se crean, relacionan, consultan y actualizan con permisos', async () => {
  const forbidden = await request(app).post('/api/categorias').set(auth(tokens.cashier)).send({ name: 'Sin permiso' });
  assert.equal(forbidden.status, 403);

  const category = await request(app).post('/api/categorias').set(auth(tokens.admin))
    .send({ name: 'Prueba automatizada', description: 'Categoría de integración' });
  assert.equal(category.status, 201);

  const product = await request(app).post('/api/productos').set(auth(tokens.admin)).send({
    categoryId: category.body.data.id,
    code: 'TEST-CRUD-001',
    name: 'Producto de integración',
    description: 'Registro temporal de pruebas',
    price: 2.5,
    minimumStock: 1,
    maximumStock: 10,
    initialStock: 4,
    location: 'TEST-01',
  });
  assert.equal(product.status, 201);
  assert.equal(product.body.data.categoryId, category.body.data.id);
  assert.equal(product.body.data.stock, 4);
  assert.equal(product.body.data.location, 'TEST-01');

  const updated = await request(app).put(`/api/productos/${product.body.data.id}`).set(auth(tokens.admin))
    .send({ price: 3.25, maximumStock: 12, active: false });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.price, 3.25);
  assert.equal(updated.body.data.maximumStock, 12);
  assert.equal(updated.body.data.active, false);
  const search = await request(app).get('/api/productos?q=Producto%20de%20integraci%C3%B3n').set(auth(tokens.admin));
  assert.ok(search.body.data.some((item) => item.code === 'TEST-CRUD-001'));
});

test('flujo completo de apertura, venta, pago, inventario, comprobante y cierre', async () => {
  const opened = await request(app).post('/api/caja/apertura').set(auth(tokens.cashier))
    .send({ cashRegisterId: 1, initialAmount: 200 });
  assert.equal(opened.status, 201);

  const duplicate = await request(app).post('/api/caja/apertura').set(auth(tokens.cashier))
    .send({ cashRegisterId: 1, initialAmount: 100 });
  assert.equal(duplicate.status, 409);

  const created = await request(app).post('/api/ventas').set(auth(tokens.cashier)).send({ cashRegisterId: 1 });
  assert.equal(created.status, 201);
  const saleId = created.body.data.id;

  const added = await request(app).post(`/api/ventas/${saleId}/items`).set(auth(tokens.cashier))
    .send({ productId: ids.rice, quantity: 1 });
  assert.equal(added.status, 200);
  assert.equal(added.body.data.total, 24.9);

  const noStock = await request(app).post(`/api/ventas/${saleId}/items`).set(auth(tokens.cashier))
    .send({ productId: ids.rice, quantity: 9999 });
  assert.equal(noStock.status, 409);

  const external = await request(app).post(`/api/ventas/${saleId}/pagos`).set(auth(tokens.cashier))
    .send({ method: 'YAPE', amount: 24.9, reference: 'demo' });
  assert.equal(external.status, 503);
  assert.equal(external.body.code, 'INTEGRATION_NOT_CONFIGURED');

  const insufficient = await request(app).post(`/api/ventas/${saleId}/pagos`).set(auth(tokens.cashier))
    .send({ method: 'EFECTIVO', amount: 24.9, receivedAmount: 20 });
  assert.equal(insufficient.status, 422);

  const paid = await request(app).post(`/api/ventas/${saleId}/pagos`).set(auth(tokens.cashier))
    .send({ method: 'EFECTIVO', amount: 24.9, receivedAmount: 30 });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.data.change, 5.1);

  const confirmed = await request(app).post(`/api/ventas/${saleId}/confirmar`).set(auth(tokens.cashier));
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.status, 'PAGADA');
  const inventory = await pool.query('SELECT stock_actual FROM inventario WHERE id_producto=$1', [ids.rice]);
  assert.equal(inventory.rows[0].stock_actual, 31);
  const movement = await pool.query(`SELECT 1 FROM movimiento_inventario WHERE referencia=$1 AND tipo_movimiento='SALIDA_VENTA'`, [`VENTA-${saleId}`]);
  assert.equal(movement.rowCount, 1);

  const receipt = await request(app).post('/api/comprobantes').set(auth(tokens.cashier))
    .send({ saleId, type: 'BOLETA', client: null });
  assert.equal(receipt.status, 201);
  assert.equal(receipt.body.data.estado, 'GENERADO');
  assert.equal(receipt.body.data.externalStatus, 'INTEGRACION_NO_CONFIGURADA');

  const closed = await request(app).post('/api/caja/cierre').set(auth(tokens.cashier))
    .send({ cashRegisterId: 1, countedAmount: 224.9 });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.data.difference, 0);
});

test('movimiento de inventario valida rol y crea alerta de stock', async () => {
  const movement = await request(app).post('/api/inventario/movimientos').set(auth(tokens.inventory))
    .send({ productId: ids.oil, type: 'AJUSTE', adjustment: 'NEGATIVO', quantity: 2, reason: 'Conteo físico' });
  assert.equal(movement.status, 201);
  assert.equal(movement.body.data.resultingStock, 6);
  const alerts = await request(app).get('/api/inventario/alertas').set(auth(tokens.inventory));
  assert.equal(alerts.status, 200);
  assert.ok(alerts.body.data.some((alert) => alert.productId === ids.oil));
  const alert = alerts.body.data.find((item) => item.productId === ids.oil);
  const attended = await request(app).patch(`/api/inventario/alertas/${alert.id}/atender`).set(auth(tokens.inventory));
  assert.equal(attended.status, 200);
});

test('orden de compra conserva detalles y recepción incrementa stock', async () => {
  const created = await request(app).post('/api/ordenes-compra').set(auth(tokens.warehouse)).send({
    supplierId: ids.supplier,
    items: [{ productId: ids.oil, quantity: 10, price: 7.5 }],
  });
  assert.equal(created.status, 201);
  const order = created.body.data;
  assert.equal(order.details.length, 1);
  await request(app).patch(`/api/ordenes-compra/${order.id}/estado`).set(auth(tokens.warehouse)).send({ status: 'APROBADA' }).expect(200);
  await request(app).patch(`/api/ordenes-compra/${order.id}/estado`).set(auth(tokens.warehouse)).send({ status: 'ENVIADA' }).expect(200);
  const reception = await request(app).post(`/api/ordenes-compra/${order.id}/recepcion`).set(auth(tokens.warehouse)).send({
    items: [{ detailId: order.details[0].id, quantity: 10, lotNumber: 'LT-TEST-01', expirationDate: '2027-10-01' }],
  });
  assert.equal(reception.status, 200);
  assert.equal(reception.body.data.status, 'RECIBIDA');
  const inventory = await pool.query('SELECT stock_actual FROM inventario WHERE id_producto=$1', [ids.oil]);
  assert.equal(inventory.rows[0].stock_actual, 16);
  const lot = await pool.query(`SELECT 1 FROM lote WHERE numero_lote='LT-TEST-01'`);
  assert.equal(lot.rowCount, 1);
});

test('factura exige RUC y respaldo no finge integración', async () => {
  const { Factura } = await import('../src/models/Comprobante.js');
  assert.throws(() => new Factura({ type: 'FACTURA', client: { name: 'Cliente sin RUC' } }).validate(), /RUC de 11 dígitos/);
  const backup = await request(app).post('/api/respaldos').set(auth(tokens.admin));
  assert.equal(backup.status, 503);
  assert.equal(backup.body.code, 'INTEGRATION_NOT_CONFIGURED');
  const report = await request(app).get('/api/reportes/inventario').set(auth(tokens.admin));
  assert.equal(report.status, 200);
  assert.ok(report.body.data.rows.length > 0);
  const salesReport = await request(app).get('/api/reportes/ventas').set(auth(tokens.admin));
  assert.equal(salesReport.status, 200);
  assert.equal(salesReport.body.data.rows[0].transactions, 1);
  assert.equal(Number(salesReport.body.data.rows[0].total), 24.9);

  const cashierId = (await pool.query('SELECT id_usuario FROM usuario WHERE usuario=$1', ['mlopez'])).rows[0].id_usuario;
  const draft = await pool.query(`INSERT INTO venta(id_usuario,id_caja,total,estado)
    VALUES ($1,1,124.5,'EN_PROCESO') RETURNING id_venta`, [cashierId]);
  await pool.query(`INSERT INTO detalle_venta(id_venta,id_producto,cantidad,precio_unitario,subtotal)
    VALUES ($1,$2,5,24.9,124.5)`, [draft.rows[0].id_venta, ids.rice]);
  const productReport = await request(app).get('/api/reportes/productos').set(auth(tokens.admin));
  const rice = productReport.body.data.rows.find((row) => row.id === ids.rice);
  assert.equal(rice.units, 1);
  assert.equal(Number(rice.total), 24.9);
  const cashReport = await request(app).get('/api/reportes/caja').set(auth(tokens.admin));
  assert.equal(cashReport.status, 200);
  assert.equal(Number(cashReport.body.data.rows[0].cashPayments), 24.9);
  assert.equal(Number(cashReport.body.data.rows[0].cardPayments), 0);
});

test('auditoría contiene operaciones críticas ejecutadas', async () => {
  const response = await request(app).get('/api/auditoria').set(auth(tokens.admin));
  assert.equal(response.status, 200);
  const actions = response.body.data.map((row) => row.action);
  assert.ok(actions.includes('VENTA_CONFIRMADA'));
  assert.ok(actions.includes('CIERRE_CAJA'));
  assert.ok(actions.includes('MERCADERIA_RECEPCIONADA'));
});
