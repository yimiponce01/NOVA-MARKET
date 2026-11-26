import bcrypt from 'bcryptjs';

export async function seedDatabase(db, { adminPassword, demoPassword, nodeEnv = process.env.NODE_ENV || 'development' }) {
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.');
  }
  const roles = [
    ['ADMINISTRADOR', 'Supervisión general y configuración'],
    ['CAJERO', 'Ventas, pagos, comprobantes y caja'],
    ['ASISTENTE_ADMINISTRATIVO', 'Catálogo, proveedores y registros'],
    ['LOGISTICA_ALMACEN', 'Órdenes, recepción y proveedores'],
    ['ENCARGADO_INVENTARIO', 'Stock, movimientos y alertas'],
  ];
  for (const [name, description] of roles) {
    await db.query('INSERT INTO rol(nombre, descripcion) VALUES ($1,$2) ON CONFLICT(nombre) DO NOTHING', [name, description]);
  }
  await db.query(`INSERT INTO caja(codigo, descripcion) VALUES ('CAJA-01','Caja principal') ON CONFLICT(codigo) DO NOTHING`);
  const configs = [
    ['IGV', '18', 'Tasa de IGV'],
    ['SERIE_BOLETA', 'B001', 'Serie de boletas'],
    ['SERIE_FACTURA', 'F001', 'Serie de facturas'],
    ['CORRELATIVO_BOLETA', '0', 'Último correlativo de boleta'],
    ['CORRELATIVO_FACTURA', '0', 'Último correlativo de factura'],
    ['DIAS_ALERTA_VENCIMIENTO', '30', 'Valor técnico provisional; pendiente de validación del negocio'],
  ];
  for (const row of configs) {
    await db.query('INSERT INTO configuracion(clave,valor,descripcion) VALUES ($1,$2,$3) ON CONFLICT(clave) DO NOTHING', row);
  }
  const categories = [
    ['Abarrotes', 'Productos de consumo básico'],
    ['Lácteos', 'Leches y derivados'],
    ['Bebidas', 'Bebidas sin alcohol'],
    ['Snacks', 'Galletas y alimentos rápidos'],
    ['Servicio', 'Conceptos de servicio'],
  ];
  for (const row of categories) {
    await db.query('INSERT INTO categoria(nombre,descripcion) VALUES ($1,$2) ON CONFLICT(nombre) DO NOTHING', row);
  }
  const products = [
    ['7750000000123', 'Arroz extra 5 kg', 'Abarrotes', 24.9, 10, 32, 'A-01'],
    ['7750000000456', 'Leche evaporada 400 g', 'Lácteos', 3.8, 12, 48, 'B-03'],
    ['7750000000789', 'Aceite vegetal 1 L', 'Abarrotes', 9.5, 10, 8, 'A-04'],
    ['7750000000911', 'Gaseosa lima limón 1.5 L', 'Bebidas', 5.9, 8, 0, 'C-02'],
    ['7750000001024', 'Azúcar rubia 1 kg', 'Abarrotes', 4.5, 10, 18, 'A-02'],
    ['7750000001153', 'Yogurt fresa 1 L', 'Lácteos', 7.9, 8, 6, 'B-05'],
    ['BOLSA', 'Bolsa biodegradable', 'Servicio', 0.5, 50, 200, 'MOSTRADOR'],
  ];
  for (const [code, name, category, price, minimum, stock, location] of products) {
    const result = await db.query(`INSERT INTO producto(id_categoria,codigo_barra,nombre,precio_venta,stock_minimo)
      SELECT id_categoria,$1,$2,$3::numeric,$4::int FROM categoria WHERE nombre=$5
      ON CONFLICT(codigo_barra) DO UPDATE SET nombre=EXCLUDED.nombre
      RETURNING id_producto`, [code, name, price, minimum, category]);
    const productId = result.rows[0]?.id_producto ?? (await db.query('SELECT id_producto FROM producto WHERE codigo_barra=$1', [code])).rows[0].id_producto;
    await db.query(`INSERT INTO inventario(id_producto,stock_actual,stock_minimo,ubicacion)
      VALUES ($1,$2,$3,$4) ON CONFLICT(id_producto) DO NOTHING`, [productId, stock, minimum, location]);
  }
  await db.query(`INSERT INTO proveedor(ruc,nombre,direccion,telefono,correo)
    VALUES ('20123456789','Distribuidora Andina SAC','Tingo María','999111222','ventas@andina.test')
    ON CONFLICT(ruc) DO NOTHING`);
  const hash = await bcrypt.hash(adminPassword, 12);
  const users = [
    ['Carlos', 'Ramos', 'admin', 'admin@nova.test', 'ADMINISTRADOR'],
    ['María', 'López', 'mlopez', 'cajero@nova.test', 'CAJERO'],
    ['Lucía', 'Pérez', 'lperez', 'almacen@nova.test', 'LOGISTICA_ALMACEN'],
    ['José', 'Torres', 'jtorres', 'inventario@nova.test', 'ENCARGADO_INVENTARIO'],
  ];
  for (const [name, surname, username, email, role] of users) {
    await db.query(`INSERT INTO usuario(id_rol,nombre,apellido,usuario,correo,contrasena_hash)
      SELECT id_rol,$1,$2,$3,$4,$5 FROM rol WHERE nombre=$6
      ON CONFLICT(usuario) DO NOTHING`, [name, surname, username, email, hash, role]);
  }

  if (nodeEnv.toLowerCase() !== 'production' && demoPassword) {
    const role = await db.query('SELECT id_rol FROM rol WHERE nombre=$1', ['ADMINISTRADOR']);
    const existing = await db.query('SELECT id_usuario,id_rol,contrasena_hash,estado,nombre,apellido FROM usuario WHERE usuario=$1', ['yimi']);
    if (!existing.rowCount) {
      const demoHash = await bcrypt.hash(demoPassword, 12);
      await db.query(`INSERT INTO usuario(id_rol,nombre,apellido,correo,usuario,contrasena_hash,estado)
        VALUES ($1,'Usuario Demo','Local',NULL,'yimi',$2,'ACTIVO')`, [role.rows[0].id_rol, demoHash]);
    } else {
      const passwordMatches = await bcrypt.compare(demoPassword, existing.rows[0].contrasena_hash);
      if (!passwordMatches || existing.rows[0].id_rol !== role.rows[0].id_rol || existing.rows[0].estado !== 'ACTIVO'
        || existing.rows[0].nombre !== 'Usuario Demo' || existing.rows[0].apellido !== 'Local') {
        const demoHash = passwordMatches ? existing.rows[0].contrasena_hash : await bcrypt.hash(demoPassword, 12);
        await db.query(`UPDATE usuario SET id_rol=$2,contrasena_hash=$3,estado='ACTIVO',nombre='Usuario Demo',apellido='Local'
          WHERE id_usuario=$1`, [existing.rows[0].id_usuario, role.rows[0].id_rol, demoHash]);
      }
    }
  }
}
