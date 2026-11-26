import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';
import { Boleta, Factura } from '../models/Comprobante.js';
import { syncStockAlert } from './stock-alert.service.js';

async function assertOwnedDraft(db, saleId, userId, lock = false) {
  const result = await db.query(`SELECT * FROM venta WHERE id_venta=$1 AND id_usuario=$2 ${lock ? 'FOR UPDATE' : ''}`, [saleId, userId]);
  if (!result.rowCount) throw new AppError('Venta no encontrada.', 404, 'SALE_NOT_FOUND');
  if (result.rows[0].estado !== 'EN_PROCESO') throw new AppError('La venta ya no puede modificarse.', 409, 'SALE_NOT_EDITABLE');
  return result.rows[0];
}

async function calculateSale(db, saleId) {
  const total = await db.query('SELECT COALESCE(SUM(subtotal),0) AS total FROM detalle_venta WHERE id_venta=$1', [saleId]);
  await db.query('UPDATE venta SET total=$2 WHERE id_venta=$1', [saleId, total.rows[0].total]);
  return Number(total.rows[0].total);
}

export async function getSale(id, userId, db = { query }) {
  const sale = await db.query(`SELECT v.*,c.codigo AS caja,CONCAT(u.nombre,' ',u.apellido) AS cajero
    FROM venta v JOIN caja c ON c.id_caja=v.id_caja JOIN usuario u ON u.id_usuario=v.id_usuario
    WHERE v.id_venta=$1 AND ($2::int IS NULL OR v.id_usuario=$2)`, [id, userId || null]);
  if (!sale.rowCount) throw new AppError('Venta no encontrada.', 404, 'SALE_NOT_FOUND');
  const details = await db.query(`SELECT d.id_detalle AS id,d.id_producto AS "productId",p.codigo_barra AS code,p.nombre,
    d.cantidad AS quantity,d.precio_unitario AS price,d.subtotal
    FROM detalle_venta d JOIN producto p ON p.id_producto=d.id_producto WHERE d.id_venta=$1 ORDER BY d.id_detalle`, [id]);
  const payments = await db.query(`SELECT id_pago AS id,metodo_pago AS method,monto,monto_recibido AS "receivedAmount",
    estado AS status,referencia AS reference FROM pago WHERE id_venta=$1 ORDER BY id_pago`, [id]);
  const total = Number(sale.rows[0].total);
  const paid = payments.rows.filter((payment) => payment.status === 'APROBADO').reduce((sum, payment) => sum + Number(payment.monto), 0);
  return {
    id: sale.rows[0].id_venta, status: sale.rows[0].estado, date: sale.rows[0].fecha_hora,
    cashRegisterId: sale.rows[0].id_caja, cashRegister: sale.rows[0].caja, cashier: sale.rows[0].cajero,
    total, taxable: Number((total / 1.18).toFixed(2)), tax: Number((total - total / 1.18).toFixed(2)),
    paid, pending: Number(Math.max(0, total - paid).toFixed(2)), items: details.rows, payments: payments.rows,
  };
}

export async function createSale(input, actor) {
  return transaction(async (db) => {
    const shift = await db.query(`SELECT 1 FROM cierre_caja WHERE id_caja=$1 AND id_usuario=$2 AND estado='ABIERTA'`, [input.cashRegisterId, actor.userId]);
    if (!shift.rowCount) throw new AppError('Debes abrir la caja antes de registrar ventas.', 409, 'CASH_NOT_OPEN');
    const result = await db.query(`INSERT INTO venta(id_usuario,id_caja) VALUES ($1,$2) RETURNING id_venta`, [actor.userId, input.cashRegisterId]);
    await audit(db, { ...actor, action: 'VENTA_INICIADA', description: `Venta ${result.rows[0].id_venta} iniciada` });
    return getSale(result.rows[0].id_venta, actor.userId, db);
  });
}

export async function setSaleItem(saleId, input, actor) {
  return transaction(async (db) => {
    await assertOwnedDraft(db, saleId, actor.userId, true);
    const product = await db.query(`SELECT p.id_producto,p.precio_venta,p.estado,i.stock_actual
      FROM producto p JOIN inventario i ON i.id_producto=p.id_producto WHERE p.id_producto=$1 FOR UPDATE`, [input.productId]);
    if (!product.rowCount || product.rows[0].estado !== 'ACTIVO') throw new AppError('Producto no disponible.', 404, 'PRODUCT_NOT_AVAILABLE');
    if (Number(product.rows[0].stock_actual) < input.quantity) throw new AppError('Stock insuficiente para la cantidad solicitada.', 409, 'INSUFFICIENT_STOCK');
    const subtotal = Number(product.rows[0].precio_venta) * input.quantity;
    await db.query(`INSERT INTO detalle_venta(id_venta,id_producto,cantidad,precio_unitario,subtotal)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT(id_venta,id_producto) DO UPDATE SET cantidad=EXCLUDED.cantidad,
      precio_unitario=EXCLUDED.precio_unitario,subtotal=EXCLUDED.subtotal`,
    [saleId, input.productId, input.quantity, product.rows[0].precio_venta, subtotal]);
    await calculateSale(db, saleId);
    return getSale(saleId, actor.userId, db);
  });
}

export async function removeSaleItem(saleId, detailId, actor) {
  return transaction(async (db) => {
    await assertOwnedDraft(db, saleId, actor.userId, true);
    const result = await db.query('DELETE FROM detalle_venta WHERE id_detalle=$1 AND id_venta=$2', [detailId, saleId]);
    if (!result.rowCount) throw new AppError('Detalle no encontrado.', 404, 'SALE_ITEM_NOT_FOUND');
    await calculateSale(db, saleId);
    return getSale(saleId, actor.userId, db);
  });
}

export async function addPayment(saleId, input, actor) {
  return transaction(async (db) => {
    await assertOwnedDraft(db, saleId, actor.userId, true);
    if (input.method !== 'EFECTIVO') {
      throw new AppError('La integración financiera no está configurada.', 503, 'INTEGRATION_NOT_CONFIGURED');
    }
    const sale = await getSale(saleId, actor.userId, db);
    if (sale.total <= 0) throw new AppError('La venta no tiene productos.', 409, 'EMPTY_SALE');
    if (input.amount > sale.pending + 0.001) throw new AppError('El monto aplicado supera el saldo pendiente.', 422, 'PAYMENT_EXCEEDS_BALANCE');
    if (input.method === 'EFECTIVO' && Number(input.receivedAmount) < Number(input.amount)) {
      throw new AppError('El monto recibido no cubre el pago.', 422, 'INSUFFICIENT_CASH');
    }
    const result = await db.query(`INSERT INTO pago(id_venta,monto,monto_recibido,metodo_pago,estado,referencia)
      VALUES ($1,$2,$3,$4,'APROBADO',$5)
      RETURNING id_pago AS id,metodo_pago AS method,monto,monto_recibido AS "receivedAmount",estado AS status,referencia AS reference`,
    [saleId, input.amount, input.receivedAmount || null, input.method, input.reference || null]);
    return {
      ...result.rows[0],
      change: input.method === 'EFECTIVO'
        ? Number((Number(input.receivedAmount) - Number(input.amount)).toFixed(2))
        : 0,
    };
  });
}

export async function confirmSale(saleId, actor) {
  return transaction(async (db) => {
    await assertOwnedDraft(db, saleId, actor.userId, true);
    const details = await db.query(`SELECT d.*,p.nombre,i.stock_actual FROM detalle_venta d
      JOIN producto p ON p.id_producto=d.id_producto JOIN inventario i ON i.id_producto=d.id_producto
      WHERE d.id_venta=$1 ORDER BY d.id_producto FOR UPDATE`, [saleId]);
    if (!details.rowCount) throw new AppError('La venta no tiene productos.', 409, 'EMPTY_SALE');
    const sale = await getSale(saleId, actor.userId, db);
    if (Math.abs(sale.paid - sale.total) > 0.001) throw new AppError('El pago debe cubrir exactamente el total.', 409, 'PAYMENT_INCOMPLETE');
    for (const detail of details.rows) {
      if (Number(detail.stock_actual) < Number(detail.cantidad)) throw new AppError(`Stock insuficiente para ${detail.nombre}.`, 409, 'INSUFFICIENT_STOCK');
      const resultingStock = Number(detail.stock_actual) - Number(detail.cantidad);
      await db.query('UPDATE inventario SET stock_actual=$2::int WHERE id_producto=$1', [detail.id_producto, resultingStock]);
      await syncStockAlert(db, detail.id_producto);
      await db.query(`INSERT INTO movimiento_inventario(id_producto,id_usuario,tipo_movimiento,cantidad,motivo,referencia)
        VALUES ($1,$2,'SALIDA_VENTA',$3,'Venta confirmada',$4)`, [detail.id_producto, actor.userId, detail.cantidad, `VENTA-${saleId}`]);
    }
    await db.query(`UPDATE venta SET estado='PAGADA' WHERE id_venta=$1`, [saleId]);
    await audit(db, { ...actor, action: 'VENTA_CONFIRMADA', description: `Venta ${saleId} confirmada por S/ ${sale.total.toFixed(2)}` });
    return getSale(saleId, actor.userId, db);
  });
}

export async function cancelSale(saleId, actor) {
  return transaction(async (db) => {
    await assertOwnedDraft(db, saleId, actor.userId, true);
    await db.query(`UPDATE venta SET estado='ANULADA' WHERE id_venta=$1`, [saleId]);
    await audit(db, { ...actor, action: 'VENTA_ANULADA', description: `Venta ${saleId} anulada antes de confirmar` });
    return { id: saleId, status: 'ANULADA' };
  });
}

async function resolveClient(db, type, client) {
  if (!client) return null;
  const Document = type === 'FACTURA' ? Factura : Boleta;
  new Document({ type, client }).validate();
  const field = type === 'FACTURA' ? 'ruc' : 'dni';
  const document = client[field];
  if (!document) return null;
  const existing = await db.query(`SELECT id_cliente FROM cliente WHERE ${field}=$1`, [document]);
  if (existing.rowCount) return existing.rows[0].id_cliente;
  const result = await db.query(`INSERT INTO cliente(nombre,apellido,dni,ruc,direccion,correo,tipo_cliente)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_cliente`,
  [client.name, client.surname || null, client.dni || null, client.ruc || null, client.address || null, client.email || null, type === 'FACTURA' ? 'JURIDICO' : 'NATURAL']);
  return result.rows[0].id_cliente;
}

export async function issueReceipt(input, actor) {
  return transaction(async (db) => {
    const sale = await db.query('SELECT * FROM venta WHERE id_venta=$1 FOR UPDATE', [input.saleId]);
    if (!sale.rowCount || sale.rows[0].estado !== 'PAGADA') throw new AppError('Solo una venta pagada puede emitir comprobante.', 409, 'SALE_NOT_PAID');
    const document = input.type === 'FACTURA' ? new Factura(input) : new Boleta(input);
    document.validate();
    const clientId = await resolveClient(db, input.type, input.client);
    const configKey = input.type === 'FACTURA' ? 'FACTURA' : 'BOLETA';
    const settings = await db.query(`SELECT clave,valor FROM configuracion
      WHERE clave IN ($1,$2) FOR UPDATE`, [`SERIE_${configKey}`, `CORRELATIVO_${configKey}`]);
    const values = Object.fromEntries(settings.rows.map((row) => [row.clave, row.valor]));
    const next = Number(values[`CORRELATIVO_${configKey}`] || 0) + 1;
    const number = String(next).padStart(8, '0');
    const series = values[`SERIE_${configKey}`];
    const receipt = await db.query(`INSERT INTO comprobante(id_venta,tipo,serie,numero,monto_total,estado)
      VALUES ($1,$2,$3,$4,$5,'GENERADO') RETURNING *`,
    [input.saleId, input.type, series, number, sale.rows[0].total]);
    await db.query('UPDATE configuracion SET valor=$2 WHERE clave=$1', [`CORRELATIVO_${configKey}`, String(next)]);
    await db.query(`UPDATE venta SET id_cliente=$2,tipo_comprobante=$3,serie=$4,numero=$5 WHERE id_venta=$1`,
    [input.saleId, clientId, input.type, series, number]);
    await audit(db, { ...actor, action: 'COMPROBANTE_GENERADO', description: `${input.type} ${series}-${number} generada; SUNAT no configurada` });
    return { ...receipt.rows[0], externalStatus: 'INTEGRACION_NO_CONFIGURADA' };
  });
}

export async function listReceipts(filters) {
  const params = [`%${filters.q || ''}%`];
  const where = [`(co.serie || '-' || co.numero ILIKE $1 OR COALESCE(cl.nombre,'') ILIKE $1)`];
  if (filters.type) { params.push(filters.type); where.push(`co.tipo=$${params.length}`); }
  if (filters.status) { params.push(filters.status); where.push(`co.estado=$${params.length}`); }
  const result = await query(`SELECT co.id_comprobante AS id,co.tipo AS type,co.serie AS series,co.numero AS number,
    co.fecha_emision AS "issuedAt",co.monto_total AS total,co.estado AS status,v.id_venta AS "saleId",
    COALESCE(cl.nombre,'Cliente general') AS client
    FROM comprobante co JOIN venta v ON v.id_venta=co.id_venta LEFT JOIN cliente cl ON cl.id_cliente=v.id_cliente
    WHERE ${where.join(' AND ')} ORDER BY co.fecha_emision DESC LIMIT 200`, params);
  return result.rows;
}

export async function getReceipt(id) {
  const result = await query(`SELECT co.*,v.fecha_hora,v.total,CONCAT(u.nombre,' ',u.apellido) AS cajero,
    c.codigo AS caja,cl.nombre AS cliente,cl.dni,cl.ruc
    FROM comprobante co JOIN venta v ON v.id_venta=co.id_venta JOIN usuario u ON u.id_usuario=v.id_usuario
    JOIN caja c ON c.id_caja=v.id_caja LEFT JOIN cliente cl ON cl.id_cliente=v.id_cliente
    WHERE co.id_comprobante=$1`, [id]);
  if (!result.rowCount) throw new AppError('Comprobante no encontrado.', 404, 'RECEIPT_NOT_FOUND');
  const items = await query(`SELECT p.nombre,d.cantidad AS quantity,d.precio_unitario AS price,d.subtotal
    FROM detalle_venta d JOIN producto p ON p.id_producto=d.id_producto WHERE d.id_venta=$1`, [result.rows[0].id_venta]);
  return { ...result.rows[0], items: items.rows, externalStatus: 'INTEGRACION_NO_CONFIGURADA' };
}
