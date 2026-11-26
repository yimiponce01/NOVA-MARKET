import bcrypt from 'bcryptjs';
import { closePool, getPool } from '../src/config/database.js';
import { env } from '../src/config/env.js';

const marker = 'DEMO-SEED:';
if (env.nodeEnv.toLowerCase() === 'production') {
  throw new Error('seed:demo está deshabilitado en NODE_ENV=production.');
}
if (!process.env.DEMO_USER_PASSWORD) {
  throw new Error('Define DEMO_USER_PASSWORD en backend/.env para crear el usuario local demo_cajero.');
}

async function seedDemo() {
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('nova-market-demo-fixtures-v1'))");

    const role = await db.query("SELECT id_rol FROM rol WHERE nombre='CAJERO'");
    const cashierRole = role.rows[0]?.id_rol;
    if (!cashierRole) throw new Error('Falta el rol CAJERO; ejecuta primero pnpm seed.');
    const passwordHash = await bcrypt.hash(process.env.DEMO_USER_PASSWORD, 12);
    await db.query(`INSERT INTO usuario(id_rol,nombre,apellido,correo,usuario,contrasena_hash)
      VALUES ($1,'Cajero Demo','Local','demo.cajero@nova.test','demo_cajero',$2)
      ON CONFLICT(usuario) DO NOTHING`, [cashierRole, passwordHash]);
    const cashierResult = await db.query("SELECT id_usuario,id_rol FROM usuario WHERE usuario='demo_cajero' AND estado='ACTIVO'");
    if (!cashierResult.rowCount) throw new Error('demo_cajero ya existe inactivo; no se modificó la cuenta existente.');
    if (cashierResult.rows[0].id_rol !== cashierRole) throw new Error('demo_cajero ya existe con un rol distinto; no se modificó la cuenta existente.');
    const cashierId = cashierResult.rows[0].id_usuario;

    await db.query(`INSERT INTO categoria(nombre,descripcion) VALUES
      ('DEMO | Muestras','Categoría exclusiva de datos de demostración local') ON CONFLICT(nombre) DO NOTHING`);
    const demoCategory = await db.query("SELECT id_categoria FROM categoria WHERE nombre='DEMO | Muestras'");
    const demoProducts = [
      ['DEMO-AGUA-01','DEMO | Agua de muestra 600 ml',2.50,4,12,'DEMO-A1'],
      ['DEMO-GALLETA-01','DEMO | Galleta de muestra',1.75,8,0,'DEMO-A2'],
      ['DEMO-ARROZ-01','DEMO | Arroz de muestra 1 kg',5.90,15,25,'DEMO-A3'],
    ];
    for (const [code,name,price,minimum,stock,location] of demoProducts) {
      await db.query(`INSERT INTO producto(id_categoria,codigo_barra,nombre,descripcion,precio_venta,stock_minimo)
        VALUES ($1,$2,$3,'Artículo ficticio para demostración local; no representa catálogo comercial',$4,$5)
        ON CONFLICT(codigo_barra) DO NOTHING`, [demoCategory.rows[0].id_categoria,code,name,price,minimum]);
      const product = await db.query('SELECT id_producto FROM producto WHERE codigo_barra=$1',[code]);
      await db.query(`INSERT INTO inventario(id_producto,stock_actual,stock_minimo,ubicacion)
        VALUES ($1,$2,$3,$4) ON CONFLICT(id_producto) DO NOTHING`, [product.rows[0].id_producto,stock,minimum,location]);
    }
    // Correct only the first-run demo fixture if an earlier version created this sample at normal stock.
    await db.query(`UPDATE inventario i SET stock_actual=0,stock_minimo=8
      FROM producto p WHERE p.id_producto=i.id_producto AND p.codigo_barra='DEMO-GALLETA-01'
      AND i.stock_actual=8 AND i.stock_minimo=0
      AND NOT EXISTS (SELECT 1 FROM movimiento_inventario m WHERE m.id_producto=p.id_producto)`);

    await db.query(`INSERT INTO proveedor(ruc,nombre,direccion,telefono,correo)
      VALUES ('20999999999','DEMO | Proveedor ficticio','Dirección de muestra','000000000','proveedor@nova.test')
      ON CONFLICT(ruc) DO NOTHING`);
    const supplier = await db.query("SELECT id_proveedor FROM proveedor WHERE ruc='20999999999'");
    let order = await db.query("SELECT id_orden FROM orden_compra WHERE observacion=$1", [`${marker}ORDER-PENDING`]);
    if (!order.rowCount) {
      const products = await db.query("SELECT id_producto,codigo_barra,precio_venta FROM producto WHERE codigo_barra IN ('DEMO-AGUA-01','DEMO-ARROZ-01') ORDER BY codigo_barra");
      const productByCode = new Map(products.rows.map((row) => [row.codigo_barra,row]));
      const items = [['DEMO-AGUA-01',12,1.40],['DEMO-ARROZ-01',10,4.10]];
      const total = items.reduce((sum, [,qty,price]) => sum + qty * price,0);
      order = await db.query(`INSERT INTO orden_compra(id_proveedor,id_usuario,total,observacion)
        VALUES ($1,$2,$3,$4) RETURNING id_orden`, [supplier.rows[0].id_proveedor,cashierId,total,`${marker}ORDER-PENDING`]);
      for (const [code,quantity,price] of items) {
        await db.query(`INSERT INTO detalle_orden_compra(id_orden,id_producto,cantidad,precio_compra,subtotal)
          VALUES ($1,$2,$3,$4,$5)`, [order.rows[0].id_orden,productByCode.get(code).id_producto,quantity,price,quantity*price]);
      }
    }
    let receivedOrder = await db.query("SELECT id_orden FROM orden_compra WHERE observacion=$1", [`${marker}ORDER-RECEIVED`]);
    if (!receivedOrder.rowCount) {
      const water = await db.query("SELECT id_producto FROM producto WHERE codigo_barra='DEMO-AGUA-01'");
      const received = await db.query(`INSERT INTO orden_compra(id_proveedor,id_usuario,estado,total,observacion)
        VALUES ($1,$2,'RECIBIDA',7.00,$3) RETURNING id_orden`, [supplier.rows[0].id_proveedor,cashierId,`${marker}ORDER-RECEIVED`]);
      receivedOrder = received;
      await db.query(`INSERT INTO detalle_orden_compra(id_orden,id_producto,cantidad,cantidad_recibida,precio_compra,subtotal)
        VALUES ($1,$2,5,5,1.40,7.00)`, [received.rows[0].id_orden,water.rows[0].id_producto]);
      await db.query("UPDATE inventario SET stock_actual=stock_actual+5 WHERE id_producto=$1",[water.rows[0].id_producto]);
      await db.query(`INSERT INTO lote(id_producto,id_orden,numero_lote,fecha_vencimiento,cantidad)
        VALUES ($1,$2,'DEMO-LOT-001',CURRENT_DATE+INTERVAL '180 days',5)`,[water.rows[0].id_producto,received.rows[0].id_orden]);
      await db.query(`INSERT INTO movimiento_inventario(id_producto,id_usuario,tipo_movimiento,cantidad,motivo,referencia)
        VALUES ($1,$2,'INGRESO',5,'Recepción de demostración local',$3)`,[water.rows[0].id_producto,cashierId,`${marker}ORDER-RECEIVED`]);
    }

    const cash = await db.query("SELECT id_caja FROM caja WHERE codigo='CAJA-01'");
    if (!cash.rowCount) throw new Error('Falta CAJA-01; ejecuta primero pnpm seed.');
    const cashierOpen = await db.query("SELECT id_cierre FROM cierre_caja WHERE id_caja=$1 AND estado='ABIERTA'", [cash.rows[0].id_caja]);
    let closedShift = await db.query("SELECT id_cierre FROM cierre_caja WHERE observacion=$1", [`${marker}CLOSED-SHIFT`]);
    if (!closedShift.rowCount) {
      const activeShift = cashierOpen.rows[0]?.id_cierre;
      if (activeShift) {
        // Preserve a pre-existing open turn; historical demo transactions can still be shown.
        throw new Error('CAJA-01 ya tiene un turno abierto. No se insertaron venta/cierre demo para evitar interferir con la caja actual. Usuario, catálogo y orden demo quedaron confirmados.');
      }
      const inserted = await db.query(`INSERT INTO cierre_caja(id_caja,id_usuario,fecha_apertura,fecha_cierre,monto_inicial,monto_esperado,monto_final,diferencia,observacion,estado)
        VALUES ($1,$2,NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',50,50,50,0,$3,'CERRADA') RETURNING id_cierre`,
      [cash.rows[0].id_caja,cashierId,`${marker}CLOSED-SHIFT`]);
      closedShift = inserted;
    }

    const demoSale = await db.query("SELECT v.id_venta FROM venta v JOIN pago p USING(id_venta) WHERE p.referencia=$1", [`${marker}SALE-001`]);
    if (!demoSale.rowCount) {
      const clientResult = await db.query(`INSERT INTO cliente(nombre,apellido,correo,tipo_cliente)
        VALUES ('Cliente Demo','Mostrador','cliente.demo@nova.test','NATURAL')
        ON CONFLICT DO NOTHING RETURNING id_cliente`);
      let clientId = clientResult.rows[0]?.id_cliente;
      if (!clientId) clientId = (await db.query("SELECT id_cliente FROM cliente WHERE correo='cliente.demo@nova.test'")).rows[0].id_cliente;
      const products = await db.query("SELECT id_producto,codigo_barra,precio_venta FROM producto WHERE codigo_barra IN ('DEMO-AGUA-01','DEMO-ARROZ-01') ORDER BY codigo_barra FOR UPDATE");
      const pmap = new Map(products.rows.map((row) => [row.codigo_barra,row]));
      const items = [['DEMO-AGUA-01',2],['DEMO-ARROZ-01',1]];
      const total = items.reduce((sum,[code,qty]) => sum + Number(pmap.get(code).precio_venta)*qty,0);
      const sale = await db.query(`INSERT INTO venta(id_cliente,id_usuario,id_caja,fecha_hora,tipo_comprobante,serie,numero,total,estado)
        VALUES ($1,$2,$3,NOW()-INTERVAL '90 minutes','BOLETA','D001','00000001',$4,'PAGADA') RETURNING id_venta`,
      [clientId,cashierId,cash.rows[0].id_caja,total]);
      for (const [code,quantity] of items) {
        const product = pmap.get(code);
        await db.query(`INSERT INTO detalle_venta(id_venta,id_producto,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5)`,
          [sale.rows[0].id_venta,product.id_producto,quantity,product.precio_venta,Number(product.precio_venta)*quantity]);
        await db.query('UPDATE inventario SET stock_actual=stock_actual-$2 WHERE id_producto=$1',[product.id_producto,quantity]);
        await db.query(`INSERT INTO movimiento_inventario(id_producto,id_usuario,tipo_movimiento,cantidad,motivo,referencia)
          VALUES ($1,$2,'SALIDA_VENTA',$3,'Venta de demostración local',$4)`,[product.id_producto,cashierId,quantity,`${marker}SALE-001`]);
      }
      await db.query(`INSERT INTO pago(id_venta,monto,monto_recibido,metodo_pago,estado,referencia)
        VALUES ($1,$2,$2,'EFECTIVO','APROBADO',$3)`,[sale.rows[0].id_venta,total,`${marker}SALE-001`]);
      await db.query(`INSERT INTO comprobante(id_venta,tipo,serie,numero,monto_total,estado)
        VALUES ($1,'BOLETA','D001','00000001',$2,'GENERADO') ON CONFLICT(tipo,serie,numero) DO NOTHING`,[sale.rows[0].id_venta,total]);
      await db.query(`INSERT INTO auditoria(id_usuario,accion,descripcion,ip)
        VALUES ($1,'DATOS_DEMO_CARGADOS','Venta y comprobante local de demostración; sin envío ni aceptación SUNAT','local')`,[cashierId]);
    }

    await db.query(`UPDATE cierre_caja cc SET
      monto_esperado=cc.monto_inicial+COALESCE((SELECT SUM(p.monto) FROM venta v JOIN pago p USING(id_venta)
        WHERE v.id_caja=cc.id_caja AND v.id_usuario=cc.id_usuario AND v.fecha_hora>=cc.fecha_apertura
          AND v.fecha_hora<=cc.fecha_cierre AND p.metodo_pago='EFECTIVO' AND p.estado='APROBADO'),0),
      monto_final=cc.monto_inicial+COALESCE((SELECT SUM(p.monto) FROM venta v JOIN pago p USING(id_venta)
        WHERE v.id_caja=cc.id_caja AND v.id_usuario=cc.id_usuario AND v.fecha_hora>=cc.fecha_apertura
          AND v.fecha_hora<=cc.fecha_cierre AND p.metodo_pago='EFECTIVO' AND p.estado='APROBADO'),0),
      diferencia=0 WHERE cc.observacion=$1`, [`${marker}CLOSED-SHIFT`]);

    // A fresh local demo login can enter POS only when the register is actually free.
    if (!cashierOpen.rowCount) {
      await db.query(`INSERT INTO cierre_caja(id_caja,id_usuario,monto_inicial,observacion)
        VALUES ($1,$2,50,'${marker}OPEN-SHIFT')`,[cash.rows[0].id_caja,cashierId]);
    }
    await db.query('COMMIT');
    console.log('Fixtures demo locales preparados (DEMO-*, demo_cajero); sin cambios a productos o usuarios existentes.');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

seedDemo().catch((error) => {
  console.error(`No se completó seed:demo: ${error.message}`);
  process.exitCode = 1;
}).finally(closePool);
