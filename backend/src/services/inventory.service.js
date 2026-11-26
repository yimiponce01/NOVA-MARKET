import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';
import { syncStockAlert } from './stock-alert.service.js';

export async function listInventory(filters) {
  const params = [`%${filters.q || ''}%`];
  const where = ['(p.nombre ILIKE $1 OR p.codigo_barra ILIKE $1)'];
  if (filters.category) { params.push(filters.category); where.push(`p.id_categoria=$${params.length}`); }
  const result = await query(`SELECT p.id_producto AS id,p.codigo_barra AS code,p.nombre AS name,c.nombre AS category,
    i.stock_actual AS stock,i.stock_minimo AS "minimumStock",i.stock_maximo AS "maximumStock",i.ubicacion AS location,
    CASE WHEN i.stock_actual=0 THEN 'AGOTADO' WHEN i.stock_actual<=i.stock_minimo THEN 'STOCK_BAJO' ELSE 'DISPONIBLE' END AS status
    FROM inventario i JOIN producto p ON p.id_producto=i.id_producto JOIN categoria c ON c.id_categoria=p.id_categoria
    WHERE ${where.join(' AND ')} ORDER BY p.nombre`, params);
  return result.rows.map((row) => ({ ...row, stock: Number(row.stock), minimumStock: Number(row.minimumStock) }));
}

export async function listMovements({ productId, from, to }) {
  const params = [];
  const where = ['1=1'];
  if (productId) { params.push(productId); where.push(`m.id_producto=$${params.length}`); }
  if (from) { params.push(from); where.push(`m.fecha >= $${params.length}`); }
  if (to) { params.push(to); where.push(`m.fecha < ($${params.length}::date + INTERVAL '1 day')`); }
  const result = await query(`SELECT m.id_movimiento AS id,m.tipo_movimiento AS type,m.cantidad AS quantity,
    m.fecha AS date,m.motivo AS reason,m.referencia AS reference,p.nombre AS product,
    CONCAT(u.nombre,' ',u.apellido) AS user
    FROM movimiento_inventario m JOIN producto p ON p.id_producto=m.id_producto
    LEFT JOIN usuario u ON u.id_usuario=m.id_usuario
    WHERE ${where.join(' AND ')} ORDER BY m.fecha DESC LIMIT 200`, params);
  return result.rows;
}

export async function createMovement(input, actor) {
  return transaction(async (db) => {
    const inventory = await db.query('SELECT * FROM inventario WHERE id_producto=$1 FOR UPDATE', [input.productId]);
    if (!inventory.rowCount) throw new AppError('Producto sin inventario.', 404, 'INVENTORY_NOT_FOUND');
    const current = Number(inventory.rows[0].stock_actual);
    let next;
    if (input.type === 'INGRESO') next = current + input.quantity;
    else {
      next = input.adjustment === 'NEGATIVO' ? current - input.quantity : current + input.quantity;
    }
    if (next < 0) throw new AppError('El ajuste dejaría el stock en negativo.', 409, 'INSUFFICIENT_STOCK');
    await db.query('UPDATE inventario SET stock_actual=$2 WHERE id_producto=$1', [input.productId, next]);
    await syncStockAlert(db, input.productId);
    const movement = await db.query(`INSERT INTO movimiento_inventario(id_producto,id_usuario,tipo_movimiento,cantidad,motivo,referencia)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.productId, actor.userId, input.type, input.quantity, input.reason, input.reference || null]);
    await audit(db, { ...actor, action: 'MOVIMIENTO_INVENTARIO', description: `${input.type} de ${input.quantity} unidades en producto ${input.productId}` });
    return { ...movement.rows[0], resultingStock: next };
  });
}

export async function listAlerts({ status = 'PENDIENTE', type }) {
  const params = [status];
  const where = ['a.estado=$1'];
  if (type) { params.push(type); where.push(`a.tipo_alerta=$${params.length}`); }
  const result = await query(`SELECT a.id_alerta AS id,a.tipo_alerta AS type,a.stock_actual AS stock,
    a.stock_minimo AS "minimumStock",a.fecha_generacion AS date,a.estado AS status,
    p.id_producto AS "productId",p.nombre AS product,p.codigo_barra AS code
    FROM alerta_stock a JOIN producto p ON p.id_producto=a.id_producto
    WHERE ${where.join(' AND ')} ORDER BY a.fecha_generacion DESC`, params);
  return result.rows;
}

export async function attendAlert(id, actor) {
  const result = await query(`UPDATE alerta_stock SET estado='ATENDIDA' WHERE id_alerta=$1 AND estado='PENDIENTE'
    RETURNING id_alerta AS id,estado AS status`, [id]);
  if (!result.rowCount) throw new AppError('Alerta pendiente no encontrada.', 404, 'ALERT_NOT_FOUND');
  await audit({ query }, { ...actor, action: 'ALERTA_ATENDIDA', description: `Alerta ${id} atendida` });
  return result.rows[0];
}

export async function listLots({ upcoming = false }) {
  const extra = upcoming ? `AND l.fecha_vencimiento <= CURRENT_DATE +
    (SELECT COALESCE(valor,'30')::int FROM configuracion WHERE clave='DIAS_ALERTA_VENCIMIENTO')` : '';
  const result = await query(`SELECT l.id_lote AS id,l.numero_lote AS number,l.fecha_vencimiento AS "expirationDate",
    l.cantidad AS quantity,l.estado AS status,p.nombre AS product,p.id_producto AS "productId"
    FROM lote l JOIN producto p ON p.id_producto=l.id_producto
    WHERE l.estado='VIGENTE' ${extra} ORDER BY l.fecha_vencimiento`);
  return result.rows;
}
