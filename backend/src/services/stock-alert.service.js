export async function syncStockAlert(db, productId) {
  const inventory = await db.query('SELECT stock_actual,stock_minimo FROM inventario WHERE id_producto=$1', [productId]);
  if (!inventory.rowCount) return;
  const stock = Number(inventory.rows[0].stock_actual);
  const minimum = Number(inventory.rows[0].stock_minimo);
  if (stock > minimum) return;
  const type = stock === 0 ? 'AGOTADO' : 'STOCK_MINIMO';
  await db.query(`INSERT INTO alerta_stock(id_producto,tipo_alerta,stock_actual,stock_minimo)
    SELECT $1::int,$2,$3::int,$4::int WHERE NOT EXISTS (
      SELECT 1 FROM alerta_stock WHERE id_producto=$1 AND estado='PENDIENTE'
        AND tipo_alerta IN ('AGOTADO','STOCK_MINIMO')
    )`, [productId, type, stock, minimum]);
}
