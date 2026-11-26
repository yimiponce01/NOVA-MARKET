import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';
import { syncStockAlert } from './stock-alert.service.js';

export async function listSuppliers({ q = '' }) {
  const result = await query(`SELECT id_proveedor AS id,ruc,nombre AS name,direccion AS address,
    telefono AS phone,correo AS email,estado AS status FROM proveedor
    WHERE nombre ILIKE $1 OR ruc ILIKE $1 ORDER BY nombre`, [`%${q}%`]);
  return result.rows;
}

export async function createSupplier(input, actor) {
  try {
    const result = await query(`INSERT INTO proveedor(ruc,nombre,direccion,telefono,correo)
      VALUES ($1,$2,$3,$4,$5) RETURNING id_proveedor AS id,ruc,nombre AS name,direccion AS address,
      telefono AS phone,correo AS email,estado AS status`,
    [input.ruc, input.name, input.address || null, input.phone || null, input.email || null]);
    await audit({ query }, { ...actor, action: 'PROVEEDOR_CREADO', description: `Proveedor ${input.ruc} creado` });
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AppError('El RUC del proveedor ya está registrado.', 409, 'DUPLICATE_RUC');
    throw error;
  }
}

export async function updateSupplier(id, input, actor) {
  const result = await query(`UPDATE proveedor SET ruc=COALESCE($2,ruc),nombre=COALESCE($3,nombre),
    direccion=COALESCE($4,direccion),telefono=COALESCE($5,telefono),correo=COALESCE($6,correo),
    estado=COALESCE($7,estado) WHERE id_proveedor=$1
    RETURNING id_proveedor AS id,ruc,nombre AS name,direccion AS address,telefono AS phone,correo AS email,estado AS status`,
  [id, input.ruc, input.name, input.address, input.phone, input.email, input.active == null ? null : input.active ? 'ACTIVO' : 'INACTIVO']);
  if (!result.rowCount) throw new AppError('Proveedor no encontrado.', 404, 'SUPPLIER_NOT_FOUND');
  await audit({ query }, { ...actor, action: 'PROVEEDOR_ACTUALIZADO', description: `Proveedor ${id} actualizado` });
  return result.rows[0];
}

export async function listOrders({ status, q = '' }) {
  const params = [`%${q}%`];
  const where = [`(pr.nombre ILIKE $1 OR CAST(o.id_orden AS TEXT) ILIKE $1)`];
  if (status) { params.push(status); where.push(`o.estado=$${params.length}`); }
  const result = await query(`SELECT o.id_orden AS id,o.fecha AS date,o.estado AS status,o.total,o.observacion AS observation,
    pr.id_proveedor AS "supplierId",pr.nombre AS supplier,COUNT(d.id_detalle)::int AS "productCount",
    COALESCE(SUM(d.cantidad),0)::int AS "requestedUnits",COALESCE(SUM(d.cantidad_recibida),0)::int AS "receivedUnits"
    FROM orden_compra o JOIN proveedor pr ON pr.id_proveedor=o.id_proveedor
    LEFT JOIN detalle_orden_compra d ON d.id_orden=o.id_orden
    WHERE ${where.join(' AND ')} GROUP BY o.id_orden,pr.id_proveedor ORDER BY o.fecha DESC,o.id_orden DESC`, params);
  return result.rows;
}

export async function getOrder(id, db = { query }) {
  const order = await db.query(`SELECT o.id_orden AS id,o.fecha AS date,o.estado AS status,o.total,o.observacion AS observation,
    pr.id_proveedor AS "supplierId",pr.nombre AS supplier,pr.ruc,u.usuario AS "createdBy"
    FROM orden_compra o JOIN proveedor pr ON pr.id_proveedor=o.id_proveedor
    LEFT JOIN usuario u ON u.id_usuario=o.id_usuario WHERE o.id_orden=$1`, [id]);
  if (!order.rowCount) throw new AppError('Orden de compra no encontrada.', 404, 'ORDER_NOT_FOUND');
  const details = await db.query(`SELECT d.id_detalle AS id,d.id_producto AS "productId",p.nombre AS product,p.codigo_barra AS code,
    d.cantidad AS quantity,d.cantidad_recibida AS "receivedQuantity",d.precio_compra AS price,d.subtotal
    FROM detalle_orden_compra d JOIN producto p ON p.id_producto=d.id_producto WHERE d.id_orden=$1 ORDER BY d.id_detalle`, [id]);
  return { ...order.rows[0], details: details.rows };
}

export async function createOrder(input, actor) {
  return transaction(async (db) => {
    const supplier = await db.query(`SELECT 1 FROM proveedor WHERE id_proveedor=$1 AND estado='ACTIVO'`, [input.supplierId]);
    if (!supplier.rowCount) throw new AppError('Proveedor no disponible.', 404, 'SUPPLIER_NOT_AVAILABLE');
    const unique = new Set(input.items.map((item) => item.productId));
    if (unique.size !== input.items.length) throw new AppError('No repitas productos en la orden.', 422, 'DUPLICATE_ORDER_ITEM');
    const total = input.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const order = await db.query(`INSERT INTO orden_compra(id_proveedor,id_usuario,total,observacion)
      VALUES ($1,$2,$3,$4) RETURNING id_orden`, [input.supplierId, actor.userId, total, input.observation || null]);
    for (const item of input.items) {
      const product = await db.query(`SELECT 1 FROM producto WHERE id_producto=$1 AND estado='ACTIVO'`, [item.productId]);
      if (!product.rowCount) throw new AppError(`Producto ${item.productId} no disponible.`, 404, 'PRODUCT_NOT_AVAILABLE');
      await db.query(`INSERT INTO detalle_orden_compra(id_orden,id_producto,cantidad,precio_compra,subtotal)
        VALUES ($1,$2,$3,$4,$5)`, [order.rows[0].id_orden, item.productId, item.quantity, item.price, item.quantity * item.price]);
    }
    await audit(db, { ...actor, action: 'ORDEN_COMPRA_CREADA', description: `Orden ${order.rows[0].id_orden} creada por S/ ${total.toFixed(2)}` });
    return getOrder(order.rows[0].id_orden, db);
  });
}

const transitions = {
  PENDIENTE: ['APROBADA', 'ANULADA'],
  APROBADA: ['ENVIADA', 'ANULADA'],
  ENVIADA: ['ANULADA'],
};

export async function changeOrderStatus(id, status, actor) {
  return transaction(async (db) => {
    const order = await db.query('SELECT estado FROM orden_compra WHERE id_orden=$1 FOR UPDATE', [id]);
    if (!order.rowCount) throw new AppError('Orden no encontrada.', 404, 'ORDER_NOT_FOUND');
    if (!transitions[order.rows[0].estado]?.includes(status)) throw new AppError('Transición de estado no permitida.', 409, 'INVALID_ORDER_TRANSITION');
    await db.query('UPDATE orden_compra SET estado=$2 WHERE id_orden=$1', [id, status]);
    await audit(db, { ...actor, action: 'ORDEN_COMPRA_ESTADO', description: `Orden ${id}: ${order.rows[0].estado} → ${status}` });
    return getOrder(id, db);
  });
}

export async function receiveOrder(id, input, actor) {
  return transaction(async (db) => {
    const order = await db.query(`SELECT estado FROM orden_compra WHERE id_orden=$1 FOR UPDATE`, [id]);
    if (!order.rowCount || order.rows[0].estado !== 'ENVIADA') throw new AppError('Solo se puede recepcionar una orden enviada.', 409, 'ORDER_NOT_RECEIVABLE');
    for (const received of input.items) {
      const detail = await db.query(`SELECT * FROM detalle_orden_compra WHERE id_detalle=$1 AND id_orden=$2 FOR UPDATE`, [received.detailId, id]);
      if (!detail.rowCount) throw new AppError('Detalle de orden inválido.', 422, 'INVALID_ORDER_ITEM');
      const pending = Number(detail.rows[0].cantidad) - Number(detail.rows[0].cantidad_recibida);
      if (received.quantity > pending) throw new AppError('La cantidad recibida supera la pendiente.', 422, 'RECEIPT_EXCEEDS_PENDING');
      await db.query(`UPDATE detalle_orden_compra SET cantidad_recibida=cantidad_recibida+$2 WHERE id_detalle=$1`, [received.detailId, received.quantity]);
      await db.query(`UPDATE inventario SET stock_actual=stock_actual+$2 WHERE id_producto=$1`, [detail.rows[0].id_producto, received.quantity]);
      await syncStockAlert(db, detail.rows[0].id_producto);
      await db.query(`INSERT INTO movimiento_inventario(id_producto,id_usuario,tipo_movimiento,cantidad,motivo,referencia)
        VALUES ($1,$2,'INGRESO',$3,'Recepción de mercadería',$4)`,
      [detail.rows[0].id_producto, actor.userId, received.quantity, `OC-${id}`]);
      if (received.lotNumber || received.expirationDate) {
        if (!received.lotNumber || !received.expirationDate) throw new AppError('El lote requiere número y fecha de vencimiento.', 422, 'INCOMPLETE_LOT');
        await db.query(`INSERT INTO lote(id_producto,id_orden,numero_lote,fecha_vencimiento,cantidad)
          VALUES ($1,$2,$3,$4,$5)`, [detail.rows[0].id_producto, id, received.lotNumber, received.expirationDate, received.quantity]);
      }
    }
    const pending = await db.query(`SELECT 1 FROM detalle_orden_compra WHERE id_orden=$1 AND cantidad_recibida<cantidad LIMIT 1`, [id]);
    if (!pending.rowCount) await db.query(`UPDATE orden_compra SET estado='RECIBIDA' WHERE id_orden=$1`, [id]);
    if (input.observation) await db.query('UPDATE orden_compra SET observacion=$2 WHERE id_orden=$1', [id, input.observation]);
    await audit(db, { ...actor, action: 'MERCADERIA_RECEPCIONADA', description: `Recepción registrada para orden ${id}` });
    return getOrder(id, db);
  });
}
